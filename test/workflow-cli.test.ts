/**
 * Workflow CLI tests
 *
 * Covers named/ad-hoc workflow commands, help text, and built-ins-first dispatch.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const PROJECT_ROOT = join(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..');
const CLI_PATH = join(PROJECT_ROOT, 'dist', 'cli.js');

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'wrapper-workflow-cli-test-'));
}

function writeConfig(dir: string, config: object): void {
  writeFileSync(join(dir, '.wrapper.json'), JSON.stringify(config, null, 2), 'utf8');
}

function runCli(args: string[], cwd: string, env?: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

function createBaseConfig(overrides?: Record<string, unknown>) {
  return {
    aliases: {
      claude: { provider: 'claude_code', agent: 'developer' },
    },
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
        plannerLaunchArgs: [],
        reviewerLaunchArgs: [],
      },
    },
    ...overrides,
  };
}

test('help lists workflow and workflow-run commands', () => {
  const dir = makeTempDir();
  writeConfig(dir, createBaseConfig());

  const result = runCli(['help'], dir);

  assert.equal(result.status, 0);
  assert.ok(result.stdout.includes('workflow     Run named workflow from .wrapper.json'));
  assert.ok(result.stdout.includes('workflow-run Run ad-hoc workflow with runtime overrides'));
});

test('workflow missing-workflow exits 1 with exact error even if alias named workflow exists', () => {
  const dir = makeTempDir();
  writeConfig(dir, createBaseConfig({
    aliases: {
      workflow: { provider: 'codex', agent: 'developer' },
    },
  }));

  const result = runCli(['workflow', 'missing-workflow'], dir);

  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes("Error: unknown workflow 'missing-workflow'"));
});

test('workflow-run exits 1 with exact missing required flags error', () => {
  const dir = makeTempDir();
  writeConfig(dir, createBaseConfig({
    aliases: {
      'workflow-run': { provider: 'codex', agent: 'developer' },
    },
  }));

  const result = runCli(['workflow-run'], dir);

  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes('Error: missing required flags: --planner-role, --reviewer-role'));
});

test('workflow named command passes overrides through to the command layer', () => {
  const dir = makeTempDir();
  writeConfig(dir, createBaseConfig());

  const result = runCli(
    ['workflow', 'plan-review', '--max-iterations', '5', '--planner-role', 'reviewer'],
    dir,
    { WRAPPER_CAO_BASE_URL: 'http://127.0.0.1:9' },
  );

  const runsDir = join(dir, '.wrapper', 'workflows', 'plan-review', 'runs');
  const runDirectories = readdirSync(runsDir, { withFileTypes: true }).filter(entry => entry.isDirectory());
  const runDir = join(runsDir, runDirectories[0].name);
  const runSnapshot = JSON.parse(readFileSync(join(runDir, 'run.json'), 'utf8'));

  assert.equal(result.status, 1);
  assert.equal(runDirectories.length, 1);
  assert.equal(runSnapshot.maxIterations, 5);
  assert.equal(runSnapshot.roles.planner, 'reviewer');
  assert.equal(runSnapshot.providers.planner, 'gemini_cli');
  assert.ok(!result.stderr.includes("Error: unknown command 'workflow'"));
});

test('built-ins help and version still win over config-defined workflow names and aliases', () => {
  const dir = makeTempDir();
  writeConfig(dir, {
    aliases: {
      help: { provider: 'codex', agent: 'developer' },
    },
    roles: {
      orchestrator: 'claude_code',
      reviewer: 'gemini_cli',
    },
    workflows: {
      version: {
        plannerRole: 'orchestrator',
        plannerAgent: 'developer',
        reviewerRole: 'reviewer',
        reviewerAgent: 'reviewer',
        maxIterations: 3,
        plannerLaunchArgs: [],
        reviewerLaunchArgs: [],
      },
    },
  });

  const helpResult = runCli(['help'], dir);
  const versionResult = runCli(['version'], dir);

  assert.equal(helpResult.status, 0);
  assert.ok(helpResult.stdout.includes('Usage: aco <command>'));
  assert.equal(versionResult.status, 0);
  assert.ok(versionResult.stdout.startsWith('aco v'));
});
