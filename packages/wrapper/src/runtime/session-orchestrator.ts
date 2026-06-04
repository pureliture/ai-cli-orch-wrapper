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
      await appendFile(this.sessionStore.errorLogPath(session.id), msg + '\n', { mode: 0o600 });
      await this.sessionStore.markFailed(session.id);
      throw new Error(`Error: ${msg}`);
    }

    if (!runResult.hasOutput && permissionProfile === 'restricted') {
      await appendFile(
        this.sessionStore.errorLogPath(session.id),
        'Permission profile: restricted — output may be blocked\n',
        { mode: 0o600 }
      );
    }

    await this.sessionStore.markDone(session.id);
  }
}
