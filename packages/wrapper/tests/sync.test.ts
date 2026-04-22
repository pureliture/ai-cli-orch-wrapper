import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseAgentSpec } from '../src/sync/agent-parse.js';
import {
  toCodexAgent,
  serializeCodexAgent,
} from '../src/sync/agent-codex-transform.js';
import {
  toGeminiAgent,
  serializeGeminiAgent,
} from '../src/sync/agent-gemini-transform.js';
import { parseHooks, toCodexHooks, toGeminiHooks } from '../src/sync/hook-parse.js';
import { syncSkills } from '../src/sync/skill-transform.js';
import type { SyncSource } from '../src/sync/transform-interface.js';
import { computeHash } from '../src/sync/hash.js';

// ---------------------------------------------------------------------------
// Agent parse + transform fixtures (Task 4.6)
// ---------------------------------------------------------------------------

describe('Agent Transforms', () => {
  const reviewerFrontmatter = `---
id: reviewer
when: Perform code reviews for pull requests
modelAlias: sonnet-4.6
workspaceMode: read-only
permissionProfile: restricted
---

You are an expert code reviewer. Focus on correctness, security, and maintainability.`;

  const researcherFrontmatter = `---
id: researcher
when: Research and synthesize information
modelAlias: opus
turnLimit: 20
workspaceMode: read-only
---

You are a research specialist. Gather and synthesize information from multiple sources.`;

  const executorFrontmatter = `---
id: executor
when: Execute implementation tasks
modelAlias: sonnet-4.6
workspaceMode: edit
---

You are an implementation specialist. Write and modify code to complete tasks.`;

  const claudeAgentFrontmatter = `---
name: typescript-reviewer
description: Expert TypeScript/JavaScript code reviewer
tools: ["Read", "Grep", "Glob", "Bash"]
model: haiku
---

You are a senior TypeScript engineer.`;

  describe('parseAgentSpec', () => {
    it('parses reviewer frontmatter correctly', () => {
      const spec = parseAgentSpec(reviewerFrontmatter);
      assert.equal(spec.id, 'reviewer');
      assert.equal(spec.when, 'Perform code reviews for pull requests');
      assert.equal(spec.modelAlias, 'sonnet-4.6');
      assert.equal(spec.workspaceMode, 'read-only');
      assert.equal(spec.permissionProfile, 'restricted');
      assert.ok(spec.body.includes('expert code reviewer'));
    });

    it('parses researcher frontmatter with turnLimit', () => {
      const spec = parseAgentSpec(researcherFrontmatter);
      assert.equal(spec.id, 'researcher');
      assert.equal(spec.modelAlias, 'opus');
      assert.equal(spec.turnLimit, 20);
    });

    it('parses executor frontmatter with edit workspace mode', () => {
      const spec = parseAgentSpec(executorFrontmatter);
      assert.equal(spec.id, 'executor');
      assert.equal(spec.workspaceMode, 'edit');
    });

    it('parses Claude-style agent description when when is absent', () => {
      const spec = parseAgentSpec(claudeAgentFrontmatter);
      assert.equal(spec.id, 'typescript-reviewer');
      assert.equal(spec.description, 'Expert TypeScript/JavaScript code reviewer');
      assert.equal(spec.when, '');
    });
  });

  describe('Codex agent transform', () => {
    it('reviewer: maps read-only to sandbox_mode read-only', () => {
      const spec = parseAgentSpec(reviewerFrontmatter);
      const agent = toCodexAgent(spec);
      assert.equal(agent.name, 'reviewer');
      assert.equal(agent.description, 'Perform code reviews for pull requests');
      assert.equal(agent.sandbox_mode, 'read-only');
      assert.ok(agent.developer_instructions?.includes('expert code reviewer'));
    });

    it('executor: maps edit to sandbox_mode workspace-write', () => {
      const spec = parseAgentSpec(executorFrontmatter);
      const agent = toCodexAgent(spec);
      assert.equal(agent.sandbox_mode, 'workspace-write');
    });

    it('uses Claude-style description for Codex agent descriptions when when is absent', () => {
      const spec = parseAgentSpec(claudeAgentFrontmatter);
      const agent = toCodexAgent(spec);
      assert.equal(agent.name, 'typescript-reviewer');
      assert.equal(agent.description, 'Expert TypeScript/JavaScript code reviewer');
    });

    it('serializes Codex agent to TOML format with expected keys', () => {
      const spec = parseAgentSpec(reviewerFrontmatter);
      const agent = toCodexAgent(spec);
      agent.model = 'gpt-5.4';
      const toml = serializeCodexAgent(agent);
      assert.ok(toml.includes('name = "reviewer"'));
      assert.ok(toml.includes('model = "gpt-5.4"'));
      assert.ok(toml.includes('sandbox_mode = "read-only"'));
    });

    it('does not include --reasoning-effort in generated TOML', () => {
      const spec = parseAgentSpec(reviewerFrontmatter);
      const agent = toCodexAgent(spec);
      const toml = serializeCodexAgent(agent);
      assert.ok(!toml.includes('reasoning-effort'));
      assert.ok(!toml.includes('--reasoning-effort'));
    });
  });

  describe('Gemini agent transform', () => {
    it('researcher: maps turnLimit to max_turns', () => {
      const spec = parseAgentSpec(researcherFrontmatter);
      const agent = toGeminiAgent(spec);
      assert.equal(agent.name, 'researcher');
      assert.equal(agent.max_turns, 20);
      assert.equal(agent.kind, 'local');
    });

    it('serializes Gemini agent to markdown with frontmatter', () => {
      const spec = parseAgentSpec(researcherFrontmatter);
      const agent = toGeminiAgent(spec);
      agent.model = 'gemini-2.5-pro';
      const md = serializeGeminiAgent(agent);
      assert.ok(md.startsWith('---'));
      assert.ok(md.includes('name: researcher'));
      assert.ok(md.includes('model: gemini-2.5-pro'));
      assert.ok(md.includes('kind: local'));
      assert.ok(md.includes('max_turns: 20'));
    });

    it('uses Claude-style description for Gemini agent descriptions when when is absent', () => {
      const spec = parseAgentSpec(claudeAgentFrontmatter);
      const agent = toGeminiAgent(spec);
      assert.equal(agent.name, 'typescript-reviewer');
      assert.equal(agent.description, 'Expert TypeScript/JavaScript code reviewer');
    });

    it('omits reasoningEffort from Gemini agent output', () => {
      const frontmatter = `---
id: thinker
when: Deep analysis
reasoningEffort: high
---
Body text.`;
      const spec = parseAgentSpec(frontmatter);
      assert.equal(spec.reasoningEffort, 'high');
      const agent = toGeminiAgent(spec);
      const md = serializeGeminiAgent(agent);
      assert.ok(!md.includes('reasoningEffort'));
      assert.ok(!md.includes('reasoning_effort'));
      assert.ok(!md.includes('--reasoning-effort'));
    });
  });
});

// ---------------------------------------------------------------------------
// Hook parse + transform fixtures (Task 5.6)
// ---------------------------------------------------------------------------

describe('Hook Transforms', () => {
  const settingsJsonWithPostToolUse = JSON.stringify({
    PostToolUse: [
      {
        matcher: 'Bash',
        hooks: [
          {
            type: 'command',
            command: 'bash scripts/pm-hook.sh',
            timeout: 15,
            async: true,
          },
        ],
      },
    ],
  });

  describe('parseHooks — Claude Code settings.json format', () => {
    it('parses PostToolUse from settings.json format', () => {
      const hooks = parseHooks(settingsJsonWithPostToolUse);
      assert.ok(hooks !== undefined);
      assert.ok('PostToolUse' in hooks);
      assert.equal(hooks.PostToolUse.commands.length, 1);
      assert.equal(hooks.PostToolUse.commands[0].command, 'bash scripts/pm-hook.sh');
      assert.equal(hooks.PostToolUse.commands[0].timeout, 15);
      assert.equal(hooks.PostToolUse.commands[0].async, true);
      assert.equal(hooks.PostToolUse.commands[0].matcher, 'Bash');
    });

    it('returns undefined for invalid JSON', () => {
      assert.equal(parseHooks('not json'), undefined);
    });

    it('returns undefined when no hook events found', () => {
      assert.equal(parseHooks(JSON.stringify({ version: 1 })), undefined);
    });
  });

  describe('toCodexHooks', () => {
    it('converts PostToolUse Bash hook with matcher and timeout', () => {
      const hooks = parseHooks(settingsJsonWithPostToolUse)!;
      const { hooks: codexHooks } = toCodexHooks(hooks);
      assert.equal(codexHooks.length, 1);
      assert.equal(codexHooks[0].event, 'PostToolUse');
      assert.equal(codexHooks[0].command, 'bash scripts/pm-hook.sh');
      assert.equal(codexHooks[0].matcher, 'Bash');
      assert.equal(codexHooks[0].timeout, 15);
    });

    it('emits warning for async: true', () => {
      const hooks = parseHooks(settingsJsonWithPostToolUse)!;
      const { warnings } = toCodexHooks(hooks);
      assert.ok(warnings.some((w) => w.includes('async: true')));
    });

    it('skips and warns on unsupported events', () => {
      const hooks = {
        PreToolUse: { commands: [{ command: 'echo pre' }] },
        PostToolUse: { commands: [{ command: 'echo post' }] },
      };
      const { hooks: codexHooks, warnings } = toCodexHooks(hooks);
      assert.equal(codexHooks.length, 1);
      assert.ok(warnings.some((w) => w.includes('PreToolUse')));
    });
  });

  describe('toGeminiHooks', () => {
    it('converts PostToolUse with timeout converted to milliseconds', () => {
      const hooks = parseHooks(settingsJsonWithPostToolUse)!;
      const { hooks: geminiHooks } = toGeminiHooks(hooks);
      assert.ok('PostToolUse' in geminiHooks);
      assert.equal(geminiHooks.PostToolUse.command, 'bash scripts/pm-hook.sh');
      // 15 seconds * 1000 = 15000 ms
      assert.equal(geminiHooks.PostToolUse.timeout, 15000);
    });

    it('emits warning for async: true', () => {
      const hooks = parseHooks(settingsJsonWithPostToolUse)!;
      const { warnings } = toGeminiHooks(hooks);
      assert.ok(warnings.some((w) => w.includes('async: true')));
    });
  });
});

// ---------------------------------------------------------------------------
// Skill sync with scripts/, references/, metadata assets (Task 3.5)
// ---------------------------------------------------------------------------

describe('Skill Sync', () => {
  it('recursively copies skill directory with bundled assets', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-skill-'));
    try {
      const skillDir = join(tmpDir, '.claude', 'skills', 'my-skill');
      await mkdir(join(skillDir, 'scripts'), { recursive: true });
      await mkdir(join(skillDir, 'references'), { recursive: true });
      await writeFile(join(skillDir, 'SKILL.md'), '# My Skill\n\nThis is my skill.');
      await writeFile(join(skillDir, 'scripts', 'run.sh'), '#!/bin/bash\necho hello');
      await writeFile(join(skillDir, 'references', 'api.md'), '# API\n\nReference docs.');
      await writeFile(join(skillDir, 'metadata.json'), '{"version":"1.0"}');

      const sources: SyncSource[] = [
        {
          path: join(skillDir, 'SKILL.md'),
          kind: 'skill',
          content: '# My Skill\n\nThis is my skill.',
          hash: computeHash('# My Skill\n\nThis is my skill.'),
        },
      ];

      const { outputs, warnings } = await syncSkills(sources, tmpDir, null, false);

      assert.equal(warnings.length, 0);
      assert.equal(outputs.length, 1);
      assert.equal(outputs[0].action, 'created');

      const targetDir = join(tmpDir, '.agents', 'skills', 'my-skill');
      const skillMd = await readFile(join(targetDir, 'SKILL.md'), 'utf-8');
      assert.ok(skillMd.includes('My Skill'));

      const runSh = await readFile(join(targetDir, 'scripts', 'run.sh'), 'utf-8');
      assert.ok(runSh.includes('echo hello'));

      const apiMd = await readFile(join(targetDir, 'references', 'api.md'), 'utf-8');
      assert.ok(apiMd.includes('Reference docs'));

      const metadata = await readFile(join(targetDir, 'metadata.json'), 'utf-8');
      assert.ok(metadata.includes('"version"'));
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('produces no outputs when no skill sources provided', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-noskill-'));
    try {
      const { outputs, warnings } = await syncSkills([], tmpDir, null, false);
      assert.equal(outputs.length, 0);
      assert.equal(warnings.length, 0);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('dry-run reports planned output without writing files', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-dryrun-'));
    try {
      const skillDir = join(tmpDir, '.claude', 'skills', 'dry-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, 'SKILL.md'), '# Dry Skill');

      const sources: SyncSource[] = [
        {
          path: join(skillDir, 'SKILL.md'),
          kind: 'skill',
          content: '# Dry Skill',
          hash: computeHash('# Dry Skill'),
        },
      ];

      const { outputs } = await syncSkills(sources, tmpDir, null, true);
      assert.equal(outputs.length, 1);
      assert.equal(outputs[0].action, 'created');

      // No files should have been written
      let exists = false;
      try {
        await readFile(join(tmpDir, '.agents', 'skills', 'dry-skill', 'SKILL.md'), 'utf-8');
        exists = true;
      } catch {
        exists = false;
      }
      assert.equal(exists, false);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
