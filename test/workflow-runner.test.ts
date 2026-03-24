/**
 * Workflow runner tests
 *
 * Wave 0 integration tests for the shared planner-reviewer loop engine.
 */

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

interface FakeTerminal {
  id: string;
  name: string;
  provider: string;
  session_name: string;
  agent_profile?: string | null;
  status?: 'idle' | 'processing' | 'completed' | 'waiting_user_answer' | 'error' | null;
}

type ReviewBehavior = 'approved' | 'changes_requested' | 'missing_status' | 'malformed_status';

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'wrapper-workflow-runner-test-'));
}

function createWorkflowDefinition(maxIterations: number) {
  return {
    workflowName: 'plan-review',
    plannerRole: 'orchestrator',
    plannerAgent: 'developer',
    plannerProvider: 'claude_code',
    reviewerRole: 'reviewer',
    reviewerAgent: 'reviewer',
    reviewerProvider: 'gemini_cli',
    maxIterations,
    plannerLaunchArgs: [],
    reviewerLaunchArgs: [],
    roleMappings: {
      orchestrator: 'claude_code',
      reviewer: 'gemini_cli',
    },
  };
}

function parseRequiredPath(prompt: string, marker: string): string {
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = prompt.match(new RegExp(`${escapedMarker}(.+)$`, 'm'));
  if (!match) {
    throw new Error(`Missing prompt marker: ${marker}`);
  }
  return match[1].trim();
}

class FakeCaoClient {
  private terminalCounter = 0;
  private reviewIndex = 0;
  private readonly reviewBehaviors: ReviewBehavior[];

  readonly sessionNames: string[] = [];
  readonly terminalIds: string[] = [];
  readonly promptsByTerminal = new Map<string, string>();

  constructor(reviewBehaviors: ReviewBehavior[]) {
    this.reviewBehaviors = reviewBehaviors;
  }

  async checkHealth(): Promise<void> {}

  async createSession(input: {
    provider: string;
    agentProfile: string;
    sessionName: string;
    workingDirectory: string;
    launchArgs?: string[];
  }): Promise<FakeTerminal> {
    this.terminalCounter += 1;
    const terminalId = `terminal-${this.terminalCounter}`;
    this.sessionNames.push(input.sessionName);
    this.terminalIds.push(terminalId);

    return {
      id: terminalId,
      name: terminalId,
      provider: input.provider,
      session_name: input.sessionName,
      agent_profile: input.agentProfile,
      status: 'processing',
    };
  }

  async sendInput(terminalId: string, message: string): Promise<void> {
    this.promptsByTerminal.set(terminalId, message);

    if (message.includes('planner for this workflow iteration')) {
      const planPath = parseRequiredPath(message, 'exact file: ');
      writeFileSync(planPath, `Generated plan for ${terminalId}\n`, 'utf8');
      return;
    }

    const reviewPath = parseRequiredPath(message, 'Write human-readable review feedback to: ');
    const reviewStatusPath = parseRequiredPath(message, 'Write machine-readable status to review.status.json at: ');
    const behavior = this.reviewBehaviors[this.reviewIndex] ?? 'changes_requested';
    this.reviewIndex += 1;

    writeFileSync(reviewPath, `Review for ${terminalId}\n`, 'utf8');

    if (behavior === 'missing_status') {
      return;
    }

    if (behavior === 'malformed_status') {
      writeFileSync(reviewStatusPath, '{ not valid json }', 'utf8');
      return;
    }

    writeFileSync(
      reviewStatusPath,
      `${JSON.stringify({
        schemaVersion: 1,
        status: behavior,
        summary: `Reviewer decided ${behavior}`,
      }, null, 2)}\n`,
      'utf8',
    );
  }

  async waitForCompletion(terminalId: string): Promise<FakeTerminal> {
    return {
      id: terminalId,
      name: terminalId,
      provider: terminalId.includes('1') ? 'claude_code' : 'gemini_cli',
      session_name: `${terminalId}-session`,
      agent_profile: null,
      status: 'completed',
    };
  }

  async getOutput(): Promise<{ output: string; mode: 'last' }> {
    return { output: 'done', mode: 'last' };
  }

  async exitTerminal(): Promise<void> {}
}

test('runWorkflow returns exit code 0 when review is approved on the first iteration', async () => {
  const { runWorkflow } = await import('../dist/orchestration/workflow-runner.js');

  const repoRoot = makeTempDir();
  const result = await runWorkflow(createWorkflowDefinition(3), {
    repoRoot,
    client: new FakeCaoClient(['approved']),
    pollIntervalMs: 1,
    timeoutMs: 50,
  });

  const state = JSON.parse(readFileSync(join(result.runDir, 'state.json'), 'utf8'));

  assert.equal(result.exitCode, 0);
  assert.equal(result.finalStatus, 'approved');
  assert.equal(result.iterationCount, 1);
  assert.equal(state.finalStatus, 'approved');
  assert.ok(existsSync(join(result.runDir, 'iterations', '01', 'review.status.json')));
});

test('runWorkflow carries previous review path into the next planner prompt and uses fresh sessions', async () => {
  const { runWorkflow } = await import('../dist/orchestration/workflow-runner.js');

  const client = new FakeCaoClient(['changes_requested', 'approved']);
  const repoRoot = makeTempDir();
  const result = await runWorkflow(createWorkflowDefinition(3), {
    repoRoot,
    client,
    pollIntervalMs: 1,
    timeoutMs: 50,
  });

  const plannerPrompt = readFileSync(join(result.runDir, 'iterations', '02', 'planner.prompt.md'), 'utf8');

  assert.equal(result.exitCode, 0);
  assert.equal(result.iterationCount, 2);
  assert.ok(plannerPrompt.includes(join(result.runDir, 'iterations', '01', 'review.md')));
  assert.equal(new Set(client.sessionNames).size, 4, 'planner/reviewer sessions should be fresh per step');
  assert.equal(new Set(client.terminalIds).size, 4, 'terminal ids should be distinct per step');
});

test('runWorkflow returns exit code 2 and preserves artifacts when max iterations are reached', async () => {
  const { runWorkflow } = await import('../dist/orchestration/workflow-runner.js');

  const repoRoot = makeTempDir();
  const result = await runWorkflow(createWorkflowDefinition(2), {
    repoRoot,
    client: new FakeCaoClient(['changes_requested', 'changes_requested']),
    pollIntervalMs: 1,
    timeoutMs: 50,
  });

  const state = JSON.parse(readFileSync(join(result.runDir, 'state.json'), 'utf8'));

  assert.equal(result.exitCode, 2);
  assert.equal(result.finalStatus, 'max_iterations');
  assert.equal(result.iterationCount, 2);
  assert.ok(existsSync(join(result.runDir, 'iterations', '01')));
  assert.ok(existsSync(join(result.runDir, 'iterations', '02')));
  assert.equal(state.finalStatus, 'max_iterations');
  assert.match(state.nextAction, /inspect artifacts/i);
});

test('runWorkflow returns exit code 1 when review.status.json is missing', async () => {
  const { runWorkflow } = await import('../dist/orchestration/workflow-runner.js');

  const repoRoot = makeTempDir();
  const result = await runWorkflow(createWorkflowDefinition(2), {
    repoRoot,
    client: new FakeCaoClient(['missing_status']),
    pollIntervalMs: 1,
    timeoutMs: 50,
  });

  const state = JSON.parse(readFileSync(join(result.runDir, 'state.json'), 'utf8'));

  assert.equal(result.exitCode, 1);
  assert.equal(result.finalStatus, 'failed');
  assert.equal(state.finalStatus, 'failed');
});

test('runWorkflow returns exit code 1 when review.status.json is malformed', async () => {
  const { runWorkflow } = await import('../dist/orchestration/workflow-runner.js');

  const repoRoot = makeTempDir();
  const result = await runWorkflow(createWorkflowDefinition(2), {
    repoRoot,
    client: new FakeCaoClient(['malformed_status']),
    pollIntervalMs: 1,
    timeoutMs: 50,
  });

  const state = JSON.parse(readFileSync(join(result.runDir, 'state.json'), 'utf8'));

  assert.equal(result.exitCode, 1);
  assert.equal(result.finalStatus, 'failed');
  assert.equal(state.finalStatus, 'failed');
});
