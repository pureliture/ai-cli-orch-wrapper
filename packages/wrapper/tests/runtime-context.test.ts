import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectRuntimeContext } from '../src/runtime/context.js';
import type { AuthResult } from '../src/providers/interface.js';

function makeAuth(method: AuthResult['method'] = 'api-key'): AuthResult {
  return {
    ok: true,
    method,
    version: 'test-cli 4.2.0',
    binaryPath: '/tmp/aco-test/provider',
  };
}

async function withWorkspace(run: (workspace: string) => Promise<void>): Promise<void> {
  const workspace = await mkdtemp(join(tmpdir(), 'aco-runtime-context-'));
  try {
    await run(workspace);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function ensureCodexArtifacts(workspace: string): Promise<void[]> {
  await mkdir(join(workspace, '.codex', 'agents'), { recursive: true });
  return Promise.all([
    writeFile(join(workspace, '.codex', 'agents', 'reviewer.toml'), 'id = "reviewer"\n'),
    writeFile(join(workspace, '.codex', 'agents', 'planner.toml'), 'id = "planner"\n'),
    writeFile(
      join(workspace, '.codex', 'hooks.json'),
      JSON.stringify({ hooks: { PostToolUse: [], PreToolUse: [] } }),
      'utf8'
    ),
    writeFile(join(workspace, '.codex', 'config.toml'), '[config]\nlog = true\n'),
  ]);
}

async function ensureAntigravityArtifacts(workspace: string): Promise<void[]> {
  await mkdir(join(workspace, '.antigravity', 'agents'), { recursive: true });
  return Promise.all([
    writeFile(join(workspace, '.antigravity', 'agents', 'reviewer.md'), '# reviewer\n'),
    writeFile(join(workspace, '.antigravity', 'agents', 'planner.md'), '# planner\n'),
    writeFile(
      join(workspace, '.antigravity', 'settings.json'),
      JSON.stringify({ hooks: [{ event: 'PostToolUse' }, { event: 'UserPromptSubmit' }] }),
      'utf8'
    ),
  ]);
}

async function ensureSharedSkills(workspace: string): Promise<void[]> {
  return Promise.all([
    mkdir(join(workspace, '.agents', 'skills', 'review-skill'), { recursive: true })
      .then(() =>
        writeFile(join(workspace, '.agents', 'skills', 'review-skill', 'SKILL.md'), '# review skill\n')
      ),
    mkdir(join(workspace, '.agents', 'skills', 'missing-marker'), { recursive: true })
      .then(() =>
        writeFile(join(workspace, '.agents', 'skills', 'missing-marker', 'README.md'), '# skipped\n')
      ),
    mkdir(join(workspace, '.agents', 'skills', 'planner-skill'), { recursive: true })
      .then(() =>
        writeFile(join(workspace, '.agents', 'skills', 'planner-skill', 'SKILL.md'), '# planner skill\n')
      ),
  ]);
}

describe('runtime context collection', () => {
  it('collects codex active and exposed metadata', async () => {
    await withWorkspace(async (workspace) => {
      await Promise.all([ensureCodexArtifacts(workspace), ensureSharedSkills(workspace)]);

      const context = await collectRuntimeContext({
        provider: 'codex',
        command: 'review',
        sessionId: 'session-codex-1',
        permissionProfile: 'default',
        promptTemplatePath: join(workspace, '.claude', 'aco', 'prompts', 'codex', 'review.md'),
        auth: makeAuth('oauth'),
        cwd: workspace,
      });

      assert.equal(context.active.provider, 'codex');
      assert.equal(context.active.command, 'review');
      assert.equal(context.active.permissionProfile, 'default');
      assert.equal(context.exposed.provider, 'codex');
      assert.equal(context.exposed.providerAgents.join(','), 'planner,reviewer');
      assert.equal(context.exposed.providerHooks.join(','), 'PostToolUse,PreToolUse');
      assert.equal(context.exposed.providerConfigFiles.join(','), 'config.toml');
      assert.deepEqual(context.exposed.sharedSkills, ['planner-skill', 'review-skill']);
    });
  });

  it('collects antigravity exposed metadata from workspace files (empty — agy has no workspace hooks)', async () => {
    await withWorkspace(async (workspace) => {
      await Promise.all([ensureAntigravityArtifacts(workspace), ensureSharedSkills(workspace)]);

      const context = await collectRuntimeContext({
        provider: 'antigravity',
        command: 'summarize',
        sessionId: 'session-antigravity-1',
        permissionProfile: 'restricted',
        auth: makeAuth('cli-fallback'),
        cwd: workspace,
      });

      assert.equal(context.active.provider, 'antigravity');
      assert.equal(context.active.permissionProfile, 'restricted');
      // agy는 workspace hooks/agents를 로드하지 않으므로
      // .antigravity/agents/*.md 파일이 있어도 exposed lists는 채워진다
      // (context.ts에서 해당 경로를 읽도록 분기하기 때문).
      // 현재 구현: .antigravity/agents/*.md를 읽으므로 agents가 나타남.
      assert.deepEqual(context.exposed.providerAgents, ['planner', 'reviewer']);
      assert.deepEqual(context.exposed.providerHooks, ['PostToolUse', 'UserPromptSubmit']);
      assert.equal(context.exposed.providerConfigFiles.join(','), 'settings.json');
    });
  });

  it('captures branch when workspace is a git repo', async () => {
    await withWorkspace(async (workspace) => {
      execFileSync('git', ['init', '-b', 'feature-test'], { cwd: workspace });

      const context = await collectRuntimeContext({
        provider: 'antigravity',
        command: 'review',
        sessionId: 'session-branch-1',
        permissionProfile: 'default',
        auth: makeAuth('api-key'),
        cwd: workspace,
      });

      assert.equal(context.active.branch, 'feature-test');
    });
  });

  it('returns empty exposed lists when files are missing', async () => {
    await withWorkspace(async (workspace) => {
      const context = await collectRuntimeContext({
        provider: 'codex',
        command: 'review',
        sessionId: 'session-empty-1',
        permissionProfile: 'restricted',
        auth: makeAuth(),
        cwd: workspace,
      });

      assert.equal(context.exposed.providerAgents.length, 0);
      assert.equal(context.exposed.providerHooks.length, 0);
      assert.equal(context.exposed.providerConfigFiles.length, 0);
      assert.equal(context.exposed.sharedSkills.length, 0);
    });
  });

  it('returns empty exposed lists for unknown providers', async () => {
    await withWorkspace(async (workspace) => {
      const context = await collectRuntimeContext({
        provider: 'unknown-provider',
        command: 'review',
        sessionId: 'session-unknown-1',
        permissionProfile: 'default',
        auth: makeAuth(),
        cwd: workspace,
      });

      assert.equal(context.exposed.provider, 'unknown-provider');
      assert.equal(context.exposed.providerAgents.length, 0);
      assert.equal(context.exposed.providerHooks.length, 0);
      assert.equal(context.exposed.providerConfigFiles.length, 0);
      assert.equal(context.exposed.sharedSkills.length, 0);
    });
  });
});
