/**
 * Workflow config resolution tests
 *
 * Wave 0 tests for ORCH-02 and ORCH-04: named/ad-hoc workflow resolution
 * and role-to-provider mapping via config.roles.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'wrapper-wf-config-test-'));
}

function writeConfig(dir: string, config: object): string {
  const configPath = join(dir, '.wrapper.json');
  writeFileSync(configPath, JSON.stringify(config), 'utf8');
  return configPath;
}

// Test 1: named workflow resolves roles to providers through config.roles (D-06, D-07)
test('resolveNamedWorkflow resolves roles to providers through config.roles', async () => {
  const { readWrapperConfig } = await import('../dist/config/wrapper-config.js');
  const { resolveNamedWorkflow } = await import('../dist/orchestration/workflow-config.js');

  const dir = makeTempDir();
  const configPath = writeConfig(dir, {
    aliases: {},
    roles: {
      orchestrator: 'claude_code',
      reviewer: 'gemini_cli',
    },
    workflows: {
      'plan-review': {
        plannerRole: 'orchestrator',
        plannerAgent: 'developer',
        reviewerRole: 'reviewer',
        reviewerAgent: 'reviewer',
        maxIterations: 3,
      },
    },
  });

  const config = readWrapperConfig(configPath);
  const resolved = resolveNamedWorkflow(config, 'plan-review');

  assert.equal(resolved.workflowName, 'plan-review');
  assert.equal(resolved.plannerRole, 'orchestrator');
  assert.equal(resolved.plannerAgent, 'developer');
  assert.equal(resolved.reviewerRole, 'reviewer');
  assert.equal(resolved.reviewerAgent, 'reviewer');
  assert.equal(resolved.maxIterations, 3);
  assert.equal(resolved.plannerProvider, 'claude_code');
  assert.equal(resolved.reviewerProvider, 'gemini_cli');
  assert.deepEqual(resolved.plannerLaunchArgs, []);
  assert.deepEqual(resolved.reviewerLaunchArgs, []);
});

// Test 2: named workflow applies one-run overrides (D-09, D-10)
test('resolveNamedWorkflow applies one-run overrides', async () => {
  const { readWrapperConfig } = await import('../dist/config/wrapper-config.js');
  const { resolveNamedWorkflow } = await import('../dist/orchestration/workflow-config.js');

  const dir = makeTempDir();
  const configPath = writeConfig(dir, {
    aliases: {},
    roles: {
      orchestrator: 'claude_code',
      reviewer: 'gemini_cli',
      coder: 'codex',
    },
    workflows: {
      'plan-review': {
        plannerRole: 'orchestrator',
        plannerAgent: 'developer',
        reviewerRole: 'reviewer',
        reviewerAgent: 'reviewer',
        maxIterations: 3,
      },
    },
  });

  const config = readWrapperConfig(configPath);
  const resolved = resolveNamedWorkflow(config, 'plan-review', {
    plannerRole: 'coder',
    plannerAgent: 'architect',
    reviewerAgent: 'senior-reviewer',
    maxIterations: 5,
    plannerLaunchArgs: ['--model', 'gpt-4'],
    reviewerLaunchArgs: ['--verbose'],
    roleOverrides: { reviewer: 'claude_code' },
  });

  assert.equal(resolved.plannerRole, 'coder');
  assert.equal(resolved.plannerAgent, 'architect');
  assert.equal(resolved.plannerProvider, 'codex');
  assert.equal(resolved.reviewerAgent, 'senior-reviewer');
  assert.equal(resolved.reviewerProvider, 'claude_code');
  assert.equal(resolved.maxIterations, 5);
  assert.deepEqual(resolved.plannerLaunchArgs, ['--model', 'gpt-4']);
  assert.deepEqual(resolved.reviewerLaunchArgs, ['--verbose']);
});

// Test 3: missing role reference fails with "Unknown role" prefix
test('resolveNamedWorkflow throws for missing role reference', async () => {
  const { readWrapperConfig } = await import('../dist/config/wrapper-config.js');
  const { resolveNamedWorkflow } = await import('../dist/orchestration/workflow-config.js');

  const dir = makeTempDir();
  const configPath = writeConfig(dir, {
    aliases: {},
    roles: { orchestrator: 'claude_code' },
    workflows: {
      'plan-review': {
        plannerRole: 'orchestrator',
        plannerAgent: 'developer',
        reviewerRole: 'nonexistent',
        reviewerAgent: 'reviewer',
        maxIterations: 3,
      },
    },
  });

  const config = readWrapperConfig(configPath);
  assert.throws(
    () => resolveNamedWorkflow(config, 'plan-review'),
    (err: Error) => err.message.startsWith('Unknown role'),
  );
});

// Test 4: malformed workflow definition fails with "Invalid workflow" prefix
test('resolveNamedWorkflow throws for malformed workflow definition', async () => {
  const { readWrapperConfig } = await import('../dist/config/wrapper-config.js');
  const { resolveNamedWorkflow } = await import('../dist/orchestration/workflow-config.js');

  const dir = makeTempDir();
  const configPath = writeConfig(dir, {
    aliases: {},
    roles: { orchestrator: 'claude_code' },
    workflows: {
      'bad-workflow': {
        plannerRole: 'orchestrator',
        // missing required fields
      },
    },
  });

  const config = readWrapperConfig(configPath);
  assert.throws(
    () => resolveNamedWorkflow(config, 'bad-workflow'),
    (err: Error) => err.message.startsWith('Invalid workflow'),
  );
});

// Test 5: resolveAdHocWorkflow produces same resolved shape (D-02, D-11)
test('resolveAdHocWorkflow produces resolved shape with provider resolution', async () => {
  const { readWrapperConfig } = await import('../dist/config/wrapper-config.js');
  const { resolveAdHocWorkflow } = await import('../dist/orchestration/workflow-config.js');

  const dir = makeTempDir();
  const configPath = writeConfig(dir, {
    aliases: {},
    roles: {
      orchestrator: 'claude_code',
      reviewer: 'gemini_cli',
    },
  });

  const config = readWrapperConfig(configPath);
  const resolved = resolveAdHocWorkflow(config, {
    plannerRole: 'orchestrator',
    plannerAgent: 'developer',
    reviewerRole: 'reviewer',
    reviewerAgent: 'reviewer',
    maxIterations: 2,
  });

  assert.equal(resolved.workflowName, 'ad-hoc');
  assert.equal(resolved.plannerProvider, 'claude_code');
  assert.equal(resolved.reviewerProvider, 'gemini_cli');
  assert.equal(resolved.maxIterations, 2);
  assert.deepEqual(resolved.plannerLaunchArgs, []);
  assert.deepEqual(resolved.reviewerLaunchArgs, []);
});

// Test 6: resolveNamedWorkflow throws when workflow name not found
test('resolveNamedWorkflow throws for unknown workflow name', async () => {
  const { readWrapperConfig } = await import('../dist/config/wrapper-config.js');
  const { resolveNamedWorkflow } = await import('../dist/orchestration/workflow-config.js');

  const dir = makeTempDir();
  const configPath = writeConfig(dir, {
    aliases: {},
    roles: {},
    workflows: {},
  });

  const config = readWrapperConfig(configPath);
  assert.throws(
    () => resolveNamedWorkflow(config, 'nonexistent'),
    (err: Error) => err.message.startsWith('Invalid workflow'),
  );
});
