import { appendFile } from 'node:fs/promises';
import type { Writable } from 'node:stream';
import type { PermissionProfile, IProvider } from '../providers/interface.js';
import type { TaskRecord } from '../session/store.js';
import { getCachedProviderAuth } from '../providers/auth-cache.js';
import { emitRuntimeDashboard } from './session-dashboard.js';
import { resolveRunPromptTemplate } from './run-prompt-template.js';
import type {
  ProviderCancellationState,
  ProviderCancellationHandlerDeps,
  ProviderCancellationHandle,
} from './provider-cancellation.js';
import type {
  ProviderSessionRunOptions,
  ProviderSessionRunResult,
} from './provider-session-runner.js';

export interface ISessionStore {
  create(
    provider: string,
    command: string,
    pid?: number,
    permissionProfile?: string
  ): Promise<TaskRecord>;
  update(id: string, patch: Partial<TaskRecord>): Promise<TaskRecord>;
  read(id: string): Promise<TaskRecord>;
  markDone(id: string): Promise<void>;
  markFailed(id: string): Promise<void>;
  markCancelled(id: string): Promise<void>;
  errorLogPath(id: string): string;
  createOutputTee(id: string): Writable;
}

export interface IProviderRegistry {
  get(key: string): IProvider | undefined;
}

export interface IProviderRunner {
  run(options: ProviderSessionRunOptions): Promise<ProviderSessionRunResult>;
}

export interface ICancellationInstaller {
  install(deps: ProviderCancellationHandlerDeps): ProviderCancellationHandle;
}

export interface SessionOrchestratorOptions {
  sessionStore: ISessionStore;
  providerRegistry: IProviderRegistry;
  providerRunner: IProviderRunner;
  cancellationInstaller: ICancellationInstaller;
}

export interface SessionOrchestratorRunInput {
  providerKey: string;
  command: string;
  permissionProfile: PermissionProfile;
  timeoutMs?: number;
  killGraceMs?: number;
  inputContent: string;
  model?: string;
  cwd: string;
  home: string;
}

export class SessionOrchestrator {
  private readonly sessionStore: ISessionStore;
  private readonly providerRegistry: IProviderRegistry;
  private readonly providerRunner: IProviderRunner;
  private readonly cancellationInstaller: ICancellationInstaller;

  constructor(options: SessionOrchestratorOptions) {
    this.sessionStore = options.sessionStore;
    this.providerRegistry = options.providerRegistry;
    this.providerRunner = options.providerRunner;
    this.cancellationInstaller = options.cancellationInstaller;
  }

  async run(input: SessionOrchestratorRunInput): Promise<void> {
    const {
      providerKey,
      command,
      permissionProfile,
      timeoutMs,
      killGraceMs,
      inputContent,
      model,
      cwd,
      home,
    } = input;

    const provider = this.providerRegistry.get(providerKey);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerKey}`);
    }

    const { prompt, promptTemplatePath } = await resolveRunPromptTemplate({
      cwd,
      home,
      providerKey,
      command,
    });

    const session = await this.sessionStore.create(
      providerKey,
      command,
      undefined,
      permissionProfile
    );

    // Any rejection after create() must leave the session in a terminal state
    // with an error log, rather than stranding it as 'running' forever.
    try {
      const auth = await getCachedProviderAuth(provider, { skipCache: true });
      const runtimeContext = await emitRuntimeDashboard({
        provider: providerKey,
        command,
        sessionId: session.id,
        permissionProfile,
        promptTemplatePath,
        auth,
      });
      await this.sessionStore.update(session.id, { runtimeContext });

      const tee = this.sessionStore.createOutputTee(session.id);
      const cancellationState: ProviderCancellationState = {
        activePid: undefined,
        sessionId: session.id,
      };
      const cancellation = this.cancellationInstaller.install({
        state: cancellationState,
        markCancelled: (sessionId) => this.sessionStore.markCancelled(sessionId),
        killGraceMs,
      });

      let runResult: ProviderSessionRunResult;
      try {
        runResult = await this.providerRunner.run({
          store: this.sessionStore,
          provider,
          command,
          prompt,
          content: inputContent,
          permissionProfile,
          sessionId: session.id,
          output: tee,
          outputBuffer: { mode: 'stream-only' },
          timeoutMs,
          killGraceMs,
          ...(model ? { model } : {}),
          envPolicy: 'allowlist',
          onPid: (pid) => {
            cancellationState.activePid = pid;
          },
        });
      } finally {
        cancellationState.activePid = undefined;
        cancellation.dispose();
      }

      const runError = runResult.error;
      const latest = await this.sessionStore.read(session.id).catch(() => undefined);

      if (latest?.status === 'cancelled') {
        throw new Error(`Session ${session.id} cancelled.`);
      }

      if (runError) {
        const msg = runError instanceof Error ? runError.message : String(runError);
        await this.appendErrorLog(session.id, msg + '\n');
        await this.sessionStore.markFailed(session.id);
        throw new Error(`Error: ${msg}`);
      }

      if (!runResult.hasOutput && permissionProfile === 'restricted') {
        await this.appendErrorLog(
          session.id,
          'Permission profile: restricted — output may be blocked\n'
        );
      }

      await this.sessionStore.markDone(session.id);
    } catch (err) {
      await this.finalizeFailure(session.id, err);
      throw err;
    }
  }

  /**
   * Appends to the session error log, swallowing filesystem failures so they
   * never mask the real run error or skip the failed-state transition.
   */
  private async appendErrorLog(sessionId: string, message: string): Promise<void> {
    try {
      await appendFile(this.sessionStore.errorLogPath(sessionId), message, { mode: 0o600 });
    } catch (fileErr) {
      console.warn(
        `Failed to write session error log: ${
          fileErr instanceof Error ? fileErr.message : String(fileErr)
        }`
      );
    }
  }

  /**
   * Records a post-create failure as the terminal session state. Preserves an
   * already-terminal status (failed/cancelled/done) so it is neither
   * double-logged nor overwritten. Wraps markFailed in try/catch to defend
   * against both synchronous throws and async rejections on the cleanup path.
   */
  private async finalizeFailure(sessionId: string, err: unknown): Promise<void> {
    const latest = await this.sessionStore.read(sessionId).catch(() => undefined);
    if (latest && latest.status !== 'running') {
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    await this.appendErrorLog(sessionId, msg + '\n');
    try {
      await this.sessionStore.markFailed(sessionId);
    } catch (markErr) {
      console.warn(
        `Failed to mark session failed: ${
          markErr instanceof Error ? markErr.message : String(markErr)
        }`
      );
    }
  }
}
