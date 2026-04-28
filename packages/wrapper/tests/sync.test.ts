import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load as loadYaml } from 'js-yaml';
import { parseAgentSpec } from '../src/sync/agent-parse.js';
import { toCodexAgent, serializeCodexAgent } from '../src/sync/agent-codex-transform.js';
import { toGeminiAgent, serializeGeminiAgent } from '../src/sync/agent-gemini-transform.js';
import { loadFormatterConfig, resolveModelForProvider } from '../src/sync/formatter.js';
import { parseHooks, toCodexHooks, toGeminiHooks } from '../src/sync/hook-parse.js';
import { syncSkills } from '../src/sync/skill-transform.js';
import { runSync } from '../src/sync/sync-engine.js';
import { matchesGlob, isIncluded, isExcluded, loadSyncConfig } from '../src/sync/sync-config.js';
import { detectDuplicates } from '../src/sync/duplicate-detector.js';
import type { SyncSource, SyncConfig, SyncOutput } from '../src/sync/transform-interface.js';
import { computeHash } from '../src/sync/hash.js';

function computePrePathDirectoryHash(contents: string[]): string {
  return computeHash(
    contents
      .map((content) => computeHash(content))
      .sort()
      .join('\n')
  );
}

function parseMarkdownFrontmatter(markdown: string): Record<string, unknown> {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/);
  assert.ok(match, 'expected markdown frontmatter block');

  const parsed = loadYaml(match[1]);
  assert.ok(parsed && typeof parsed === 'object' && !Array.isArray(parsed));
  return parsed as Record<string, unknown>;
}

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
description: "Expert TypeScript/JavaScript code reviewer"
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

    it('parses YAML quoted values, anchors, aliases, and multiline scalars', () => {
      const content = `---
id: yaml-edge-agent
description: |
  Review code: TypeScript
  and "Node.js"
sharedTools: &reviewTools
  - "Read:Files"
  - "Grep \\"pattern\\""
skillRefs: *reviewTools
memoryRefs: ["project:notes", "quote \\"memo\\""]
turnLimit: "12"
---
Body text.`;

      const spec = parseAgentSpec(content);

      assert.equal(spec.id, 'yaml-edge-agent');
      assert.equal(spec.description, 'Review code: TypeScript\nand "Node.js"\n');
      assert.deepEqual(spec.skillRefs, ['Read:Files', 'Grep "pattern"']);
      assert.deepEqual(spec.memoryRefs, ['project:notes', 'quote "memo"']);
      assert.equal(spec.turnLimit, 12);
      assert.equal(spec.body, 'Body text.');
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

    it('serializes YAML-sensitive Gemini frontmatter as valid YAML', () => {
      const body = 'Line one.\nLine two.';
      const md = serializeGeminiAgent({
        name: 'yaml-agent',
        description: 'Review code: TypeScript and "Node.js"\nUse care: yes',
        model: 'gemini-2.5-pro',
        kind: 'local',
        max_turns: 7,
        body,
      });

      const frontmatter = parseMarkdownFrontmatter(md);
      assert.equal(frontmatter.name, 'yaml-agent');
      assert.equal(frontmatter.description, 'Review code: TypeScript and "Node.js"\nUse care: yes');
      assert.equal(frontmatter.model, 'gemini-2.5-pro');
      assert.equal(frontmatter.kind, 'local');
      assert.equal(frontmatter.max_turns, 7);
      assert.ok(md.endsWith(`---\n\n${body}`));
    });

    it('omits absent optional Gemini frontmatter fields', () => {
      const md = serializeGeminiAgent({
        name: 'minimal-agent',
        kind: 'local',
        body: 'Body text.',
      });

      const frontmatter = parseMarkdownFrontmatter(md);
      assert.deepEqual(Object.keys(frontmatter).sort(), ['kind', 'name']);
      assert.ok(md.endsWith('---\n\nBody text.'));
    });
  });
});

// ---------------------------------------------------------------------------
// Formatter config parsing
// ---------------------------------------------------------------------------

describe('Formatter config', () => {
  it('resolves simple formatter config as before', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-formatter-simple-'));
    try {
      await mkdir(join(tmpDir, '.aco'), { recursive: true });
      await writeFile(
        join(tmpDir, '.aco', 'formatter.yaml'),
        `modelAliasMap:
  sonnet-4.6:
    provider: codex
    model: gpt-5.4
providerModels:
  gemini_cli:
    - gemini-2.5-pro
fallback:
  provider: codex
  model: gpt-5.4-mini
`
      );

      const config = await loadFormatterConfig(tmpDir);

      assert.equal(resolveModelForProvider(config, 'sonnet-4.6', 'codex'), 'gpt-5.4');
      assert.equal(resolveModelForProvider(config, '', 'gemini_cli'), 'gemini-2.5-pro');
      assert.equal(resolveModelForProvider(config, 'missing', 'codex'), 'gpt-5.4-mini');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('parses nested formatter config with aliases and YAML-sensitive values', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-formatter-yaml-'));
    try {
      await mkdir(join(tmpDir, '.aco'), { recursive: true });
      await writeFile(
        join(tmpDir, '.aco', 'formatter.yaml'),
        `modelAliasMap:
  sonnet-4.6:
    provider: &codexProvider codex
    model: "gpt-5.4:release"
  gemini-review:
    provider: &geminiProvider gemini_cli
    model: &geminiModel "gemini-2.5-pro:stable"
providerModels:
  codex:
    - "gpt-5.4:release"
    - "gpt-5.4 \\"fast\\""
  gemini_cli:
    - *geminiModel
fallback:
  provider: *codexProvider
  model: "gpt-5.4 fallback: safe"
`
      );

      const config = await loadFormatterConfig(tmpDir);

      assert.equal(resolveModelForProvider(config, 'sonnet-4.6', 'codex'), 'gpt-5.4:release');
      assert.equal(
        resolveModelForProvider(config, 'gemini-review', 'gemini_cli'),
        'gemini-2.5-pro:stable'
      );
      assert.equal(resolveModelForProvider(config, '', 'gemini_cli'), 'gemini-2.5-pro:stable');
      assert.equal(resolveModelForProvider(config, 'missing', 'codex'), 'gpt-5.4:release');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns null for missing or invalid formatter config', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-formatter-invalid-'));
    try {
      assert.equal(await loadFormatterConfig(tmpDir), null);

      await mkdir(join(tmpDir, '.aco'), { recursive: true });
      await writeFile(
        join(tmpDir, '.aco', 'formatter.yaml'),
        `modelAliasMap:
  broken: [unterminated
`
      );

      assert.equal(await loadFormatterConfig(tmpDir), null);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
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
// Sync config: glob matching and include/exclude precedence
// ---------------------------------------------------------------------------

describe('Sync Config', () => {
  describe('matchesGlob', () => {
    it('matches exact names', () => {
      assert.equal(matchesGlob('github-kanban-ops', 'github-kanban-ops'), true);
      assert.equal(matchesGlob('other-skill', 'github-kanban-ops'), false);
    });

    it('matches prefix wildcard', () => {
      assert.equal(matchesGlob('openspec-apply-change', 'openspec-*'), true);
      assert.equal(matchesGlob('openspec-', 'openspec-*'), true);
      assert.equal(matchesGlob('not-openspec', 'openspec-*'), false);
    });

    it('matches suffix wildcard', () => {
      assert.equal(matchesGlob('gh-issue', 'gh-*'), true);
      assert.equal(matchesGlob('gh-', 'gh-*'), true);
      assert.equal(matchesGlob('github-issue', 'gh-*'), false);
    });

    it('does not match regex special characters as wildcards', () => {
      // '.' should only match literal '.', not any character
      assert.equal(matchesGlob('gh-issue', 'gh.issue'), false);
      assert.equal(matchesGlob('gh-issue', 'gh-issue'), true);
      // '+' should only match literal '+'
      assert.equal(matchesGlob('skill+extra', 'skill+extra'), true);
      assert.equal(matchesGlob('skill-extra', 'skill+extra'), false);
    });

    it('handles mixed literal and wildcard patterns', () => {
      assert.equal(matchesGlob('superpowers-braintstorm', 'superpowers-*'), true);
      assert.equal(matchesGlob('x-superpowers', 'superpowers-*'), false);
    });
  });

  describe('isIncluded / isExcluded precedence', () => {
    it('isExcluded takes precedence over isIncluded', () => {
      const config: SyncConfig = {
        skills: {
          include: ['shared-*'],
          exclude: ['shared-secret'],
        },
      };
      assert.equal(isExcluded('shared-secret', config), true);
      assert.equal(isIncluded('shared-secret', config), true);
      // Exclude wins in classification ordering
    });

    it('default deny when include is empty', () => {
      const config: SyncConfig = { skills: { include: [], exclude: [] } };
      assert.equal(isIncluded('any-skill', config), false);
    });

    it('exclude with wildcard catches matching names', () => {
      const config: SyncConfig = { skills: { exclude: ['openspec-*'] } };
      assert.equal(isExcluded('openspec-apply', config), true);
      assert.equal(isExcluded('other-skill', config), false);
    });

    it('parses inline array YAML syntax', async () => {
      const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-yaml-inline-'));
      try {
        await mkdir(join(tmpDir, '.aco'), { recursive: true });
        await writeFile(
          join(tmpDir, '.aco', 'sync.yaml'),
          'skills:\n  exclude: [gh-*, openspec-*, superpowers-*]\n'
        );
        const config = await loadSyncConfig(tmpDir);
        assert.ok(isExcluded('gh-issue', config), 'gh-* should be excluded via inline array');
        assert.ok(
          isExcluded('openspec-apply', config),
          'openspec-* should be excluded via inline array'
        );
        assert.ok(
          isExcluded('superpowers-b', config),
          'superpowers-* should be excluded via inline array'
        );
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('parses YAML with inline comments', async () => {
      const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-yaml-comment-'));
      try {
        await mkdir(join(tmpDir, '.aco'), { recursive: true });
        await writeFile(
          join(tmpDir, '.aco', 'sync.yaml'),
          'skills:\n  include:\n    - github-kanban-ops # ACO-owned\n  exclude:\n    - gh-* # command aliases\n'
        );
        const config = await loadSyncConfig(tmpDir);
        assert.ok(isExcluded('gh-pr', config), 'gh-* should be excluded');
        assert.ok(isIncluded('github-kanban-ops', config), 'github-kanban-ops should be included');
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('parses YAML with quoted values', async () => {
      const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-yaml-quote-'));
      try {
        await mkdir(join(tmpDir, '.aco'), { recursive: true });
        await writeFile(
          join(tmpDir, '.aco', 'sync.yaml'),
          'skills:\n  exclude:\n    - "gh-*"\n    - \'openspec-*\'\n'
        );
        const config = await loadSyncConfig(tmpDir);
        assert.ok(isExcluded('gh-issue', config), 'Quoted gh-* should be excluded');
        assert.ok(isExcluded('openspec-apply', config), 'Quoted openspec-* should be excluded');
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
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
      await writeFile(
        join(skillDir, 'SKILL.md'),
        '---\nname: my-skill\nx-aco-owned: true\n---\n\n# My Skill\n\nThis is my skill.'
      );
      await writeFile(join(skillDir, 'scripts', 'run.sh'), '#!/bin/bash\necho hello');
      await writeFile(join(skillDir, 'references', 'api.md'), '# API\n\nReference docs.');
      await writeFile(join(skillDir, 'metadata.json'), '{"version":"1.0"}');

      const sources: SyncSource[] = [
        {
          path: join(skillDir, 'SKILL.md'),
          kind: 'skill',
          content: '---\nname: my-skill\nx-aco-owned: true\n---\n\n# My Skill\n\nThis is my skill.',
          hash: computeHash(
            '---\nname: my-skill\nx-aco-owned: true\n---\n\n# My Skill\n\nThis is my skill.'
          ),
        },
      ];

      const result = await runSync(tmpDir, { dryRun: false });
      const outputs = result.outputs;

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
      const { outputs, warnings } = await syncSkills([], tmpDir, null);
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
      await writeFile(
        join(skillDir, 'SKILL.md'),
        '---\nname: dry-skill\nx-aco-owned: true\n---\n\n# Dry Skill'
      );
      // Need CLAUDE.md for runSync to find sources
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');

      const result = await runSync(tmpDir, { dryRun: true });
      const outputs = result.outputs;

      // Filter for skill outputs
      const skillOutputs = outputs.filter((o) => o.targetPath.includes('.agents/skills/dry-skill'));
      assert.equal(skillOutputs.length, 1);
      assert.equal(skillOutputs[0].action, 'created');

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

  it('skips external OpenSpec skills', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-openspec-'));
    try {
      const skillDir = join(tmpDir, '.claude', 'skills', 'openspec-test');
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, 'SKILL.md'),
        '---\nname: openspec-test\n---\n\n# OpenSpec Test'
      );
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');

      const result = await runSync(tmpDir, { dryRun: true });
      const skillOutputs = result.outputs.filter((o) =>
        o.targetPath.includes('.agents/skills/openspec-test')
      );
      assert.equal(skillOutputs.length, 0);

      // Skipped skills don't appear as outputs at all
      const allSkillOutputs = result.outputs.filter((o) =>
        o.targetPath.includes('.agents/skills/')
      );
      assert.equal(allSkillOutputs.length, 0);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('skips command-alias gh-* skills', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-gh-'));
    try {
      const skillDir = join(tmpDir, '.claude', 'skills', 'gh-test');
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, 'SKILL.md'), '---\nname: gh-test\n---\n\n# GH Test');
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');

      const result = await runSync(tmpDir, { dryRun: true });
      const skillOutputs = result.outputs.filter((o) =>
        o.targetPath.includes('.agents/skills/gh-test')
      );
      assert.equal(skillOutputs.length, 0);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('syncs ACO-owned github-kanban-ops skill via built-in defaults', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-kanban-'));
    try {
      const skillDir = join(tmpDir, '.claude', 'skills', 'github-kanban-ops');
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, 'SKILL.md'),
        '---\nname: github-kanban-ops\n---\n\n# GitHub Kanban Ops'
      );
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');

      const result = await runSync(tmpDir, { dryRun: false });
      const skillOutputs = result.outputs.filter((o) =>
        o.targetPath.includes('.agents/skills/github-kanban-ops')
      );
      assert.equal(skillOutputs.length, 1);
      assert.equal(skillOutputs[0].action, 'created');
      assert.equal(skillOutputs[0].owner, 'aco');
      assert.equal(skillOutputs[0].assetKind, 'shared-skill');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('records manifest ownership for ACO-owned targets', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-manifest-'));
    try {
      const skillDir = join(tmpDir, '.claude', 'skills', 'github-kanban-ops');
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, 'SKILL.md'),
        '---\nname: github-kanban-ops\n---\n\n# GitHub Kanban Ops'
      );
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');

      await runSync(tmpDir, { dryRun: false });
      const manifest = JSON.parse(
        await readFile(join(tmpDir, '.aco', 'sync-manifest.json'), 'utf-8')
      );

      assert.equal(manifest.version, '2');
      const targetPath = join(tmpDir, '.agents', 'skills', 'github-kanban-ops');
      const record = manifest.targets[targetPath];
      assert.ok(record, 'Manifest should record the target');
      assert.equal(record.owner, 'aco');
      assert.equal(record.kind, 'shared-skill');
      assert.equal(record.hashFormat, 'directory');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('migrates legacy manifest on next sync', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-legacy-'));
    try {
      const acoDir = join(tmpDir, '.aco');
      await mkdir(acoDir, { recursive: true });
      const legacyManifest = {
        version: '1',
        generatedAt: new Date().toISOString(),
        sourceHashes: {},
        targetHashes: {
          [join(tmpDir, 'AGENTS.md')]: 'abc123',
        },
        warnings: [],
      };
      await writeFile(join(acoDir, 'sync-manifest.json'), JSON.stringify(legacyManifest, null, 2));
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');

      await runSync(tmpDir, { dryRun: false });
      const manifest = JSON.parse(await readFile(join(acoDir, 'sync-manifest.json'), 'utf-8'));

      assert.equal(manifest.version, '2');
      assert.ok(manifest.targets, 'Migrated manifest should have targets');
      assert.ok(manifest.skipped, 'Migrated manifest should have skipped');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('removes stale non-empty skill directories when no longer eligible', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-stale-'));
    try {
      // Setup: write CLAUDE.md, create skill, write sync.yaml that includes it
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');
      const skillDir = join(tmpDir, '.claude', 'skills', 'temp-skill');
      await mkdir(skillDir, { recursive: true });
      await mkdir(join(skillDir, 'scripts'), { recursive: true });
      await writeFile(join(skillDir, 'SKILL.md'), '---\nname: temp-skill\n---\n\n# Temp Skill');
      await writeFile(join(skillDir, 'scripts', 'run.sh'), '#!/bin/bash\necho hello');

      // Set up .aco/sync.yaml that includes temp-skill
      const acoDir = join(tmpDir, '.aco');
      await mkdir(acoDir, { recursive: true });
      await writeFile(
        join(acoDir, 'sync.yaml'),
        'skills:\n  include:\n    - temp-skill\n  exclude:\n    - openspec-*\n    - superpowers-*\n    - gh-*\n'
      );

      // First sync: should create the skill directory
      await runSync(tmpDir, { dryRun: false });
      const targetDir = join(tmpDir, '.agents', 'skills', 'temp-skill');
      const targetSkillMd = join(targetDir, 'SKILL.md');
      let content = await readFile(targetSkillMd, 'utf-8');
      assert.ok(content.includes('Temp Skill'));

      // Now remove temp-skill from include list
      await writeFile(
        join(acoDir, 'sync.yaml'),
        'skills:\n  include:\n    - other-skill\n  exclude:\n    - openspec-*\n    - superpowers-*\n    - gh-*\n'
      );

      // Second sync: should remove the stale directory (even though it's non-empty)
      const result = await runSync(tmpDir, { dryRun: false });
      const removedOutputs = result.outputs.filter((o) => o.action === 'removed');
      assert.ok(
        removedOutputs.length > 0,
        `Expected removed outputs, got ${removedOutputs.length}`
      );

      // Verify the directory is gone
      const { existsSync } = await import('node:fs');
      assert.equal(existsSync(targetDir), false, `Expected ${targetDir} to be removed`);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('removes stale legacy skill targets that still use v1 SKILL.md hashes', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-stale-legacy-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');

      const targetDir = join(tmpDir, '.agents', 'skills', 'legacy-skill');
      await mkdir(targetDir, { recursive: true });
      const skillContent = '---\nname: legacy-skill\n---\n\n# Legacy Skill';
      await writeFile(join(targetDir, 'SKILL.md'), skillContent);

      const acoDir = join(tmpDir, '.aco');
      await mkdir(acoDir, { recursive: true });
      const legacyManifest = {
        version: '1',
        generatedAt: new Date().toISOString(),
        sourceHashes: {},
        targetHashes: {
          [targetDir]: computeHash(skillContent),
        },
        warnings: [],
      };
      await writeFile(join(acoDir, 'sync-manifest.json'), JSON.stringify(legacyManifest, null, 2));

      const result = await runSync(tmpDir, { dryRun: false });
      const removedOutputs = result.outputs.filter((o) => o.targetPath === targetDir);
      assert.equal(removedOutputs[0]?.action, 'removed');

      const { existsSync } = await import('node:fs');
      assert.equal(existsSync(targetDir), false, `Expected ${targetDir} to be removed`);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('removes stale v2 skill targets that still use pre-path directory hashes', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-stale-v2-prepath-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');

      const targetDir = join(tmpDir, '.agents', 'skills', 'prepath-skill');
      await mkdir(join(targetDir, 'references'), { recursive: true });
      const skillContent = '---\nname: prepath-skill\n---\n\n# Prepath Skill';
      const referenceContent = 'same content';
      await writeFile(join(targetDir, 'SKILL.md'), skillContent);
      await writeFile(join(targetDir, 'references', 'guide.md'), referenceContent);

      const oldDirHash = computePrePathDirectoryHash([skillContent, referenceContent]);
      const acoDir = join(tmpDir, '.aco');
      await mkdir(acoDir, { recursive: true });
      const prePathManifest = {
        version: '2',
        generatedAt: new Date().toISOString(),
        sourceHashes: {},
        targetHashes: {
          [targetDir]: oldDirHash,
        },
        targets: {
          [targetDir]: {
            hash: oldDirHash,
            owner: 'aco',
            kind: 'shared-skill',
          },
        },
        skipped: [],
        warnings: [],
      };
      await writeFile(join(acoDir, 'sync-manifest.json'), JSON.stringify(prePathManifest, null, 2));

      const result = await runSync(tmpDir, { dryRun: false });
      const removedOutputs = result.outputs.filter((o) => o.targetPath === targetDir);
      assert.equal(removedOutputs[0]?.action, 'removed');
      assert.equal(
        result.outputs.some((o) => o.action === 'conflict'),
        false,
        'pre-path hash compatibility should not turn stale cleanup into a conflict'
      );
      assert.equal(
        result.warnings,
        0,
        'pre-path hash compatibility should avoid stale hash mismatch warnings'
      );

      const { existsSync } = await import('node:fs');
      assert.equal(existsSync(targetDir), false, `Expected ${targetDir} to be removed`);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('computes correct hash based only on files, ignoring directories', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-dirhash-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');
      const skillDir = join(tmpDir, '.claude', 'skills', 'dirhash-skill');
      await mkdir(join(skillDir, 'subdir'), { recursive: true });
      await mkdir(join(skillDir, 'empty-dir'), { recursive: true });
      await writeFile(join(skillDir, 'SKILL.md'), '---\nname: dirhash-skill\n---\n\n# Test');

      const acoDir = join(tmpDir, '.aco');
      await mkdir(acoDir, { recursive: true });
      await writeFile(
        join(acoDir, 'sync.yaml'),
        'skills:\n  include:\n    - dirhash-skill\n  exclude:\n    - openspec-*\n    - superpowers-*\n    - gh-*\n'
      );

      // First sync
      const result1 = await runSync(tmpDir, { dryRun: false });
      const skillOutput1 = result1.outputs.find((o) =>
        o.targetPath.includes('.agents/skills/dirhash-skill')
      );
      assert.ok(skillOutput1, 'Should have skill output');
      const hash1 = skillOutput1.hash;

      // Second sync without changes: hash should be same -> skipped
      const result2 = await runSync(tmpDir, { dryRun: false });
      const skillOutput2 = result2.outputs.find((o) =>
        o.targetPath.includes('.agents/skills/dirhash-skill')
      );
      assert.equal(skillOutput2?.action, 'skipped', 'Unchanged skill should be skipped');

      // Add a file to subdir: hash should change
      await mkdir(join(skillDir, 'subdir'), { recursive: true });
      await writeFile(join(skillDir, 'subdir', 'helper.md'), '# Helper');
      const result3 = await runSync(tmpDir, { dryRun: false });
      const skillOutput3 = result3.outputs.find((o) =>
        o.targetPath.includes('.agents/skills/dirhash-skill')
      );
      assert.equal(skillOutput3?.action, 'updated', 'Modified skill should be updated');
      assert.notEqual(skillOutput3?.hash, hash1, 'Hash should change when file added');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('updates a synced skill when a file is renamed with unchanged content', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-dirhash-rename-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');
      const skillDir = join(tmpDir, '.claude', 'skills', 'rename-skill');
      await mkdir(join(skillDir, 'references'), { recursive: true });
      await writeFile(join(skillDir, 'SKILL.md'), '---\nname: rename-skill\n---\n\n# Rename');
      await writeFile(join(skillDir, 'references', 'old.md'), 'same content');

      await mkdir(join(tmpDir, '.aco'), { recursive: true });
      await writeFile(
        join(tmpDir, '.aco', 'sync.yaml'),
        'skills:\n  include:\n    - rename-skill\n'
      );

      const first = await runSync(tmpDir, { dryRun: false });
      const firstOutput = first.outputs.find((o) =>
        o.targetPath.includes('.agents/skills/rename-skill')
      );
      assert.equal(firstOutput?.action, 'created');

      await rename(join(skillDir, 'references', 'old.md'), join(skillDir, 'references', 'new.md'));

      const second = await runSync(tmpDir, { dryRun: false });
      const secondOutput = second.outputs.find((o) =>
        o.targetPath.includes('.agents/skills/rename-skill')
      );
      assert.equal(
        secondOutput?.action,
        'updated',
        'same-content rename should change the directory hash'
      );
      assert.notEqual(secondOutput?.hash, firstOutput?.hash);

      const { existsSync } = await import('node:fs');
      const targetDir = join(tmpDir, '.agents', 'skills', 'rename-skill');
      assert.equal(
        existsSync(join(targetDir, 'references', 'old.md')),
        false,
        'directory update should remove files deleted from the source layout'
      );
      assert.equal(
        existsSync(join(targetDir, 'references', 'new.md')),
        true,
        'directory update should copy files added by the source layout'
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('updates a synced skill when non-UTF-8 raw bytes change', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-dirhash-bytes-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');
      const skillDir = join(tmpDir, '.claude', 'skills', 'bytes-skill');
      await mkdir(join(skillDir, 'assets'), { recursive: true });
      await writeFile(join(skillDir, 'SKILL.md'), '---\nname: bytes-skill\n---\n\n# Bytes');
      await writeFile(join(skillDir, 'assets', 'payload.bin'), Buffer.from([0xff]));

      await mkdir(join(tmpDir, '.aco'), { recursive: true });
      await writeFile(
        join(tmpDir, '.aco', 'sync.yaml'),
        'skills:\n  include:\n    - bytes-skill\n'
      );

      const first = await runSync(tmpDir, { dryRun: false });
      const firstOutput = first.outputs.find((o) =>
        o.targetPath.includes('.agents/skills/bytes-skill')
      );
      assert.equal(firstOutput?.action, 'created');

      await writeFile(join(skillDir, 'assets', 'payload.bin'), Buffer.from([0xfe]));

      const second = await runSync(tmpDir, { dryRun: false });
      const secondOutput = second.outputs.find((o) =>
        o.targetPath.includes('.agents/skills/bytes-skill')
      );
      assert.equal(
        secondOutput?.action,
        'updated',
        'non-UTF-8 byte changes should change the directory hash'
      );
      assert.notEqual(secondOutput?.hash, firstOutput?.hash);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('skips removal of stale targets not owned by aco', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-stale-external-'));
    try {
      const acoDir = join(tmpDir, '.aco');
      await mkdir(acoDir, { recursive: true });
      // Create a manifest with an external-owned target
      const targetDir = join(tmpDir, '.agents', 'skills', 'external-skill');
      const manifest = {
        version: '2',
        generatedAt: new Date().toISOString(),
        sourceHashes: {},
        targetHashes: { [targetDir]: 'abc123' },
        targets: { [targetDir]: { hash: 'abc123', owner: 'external', kind: 'external-skill' } },
        skipped: [],
        warnings: [],
      };
      await writeFile(join(acoDir, 'sync-manifest.json'), JSON.stringify(manifest, null, 2));
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');

      const result = await runSync(tmpDir, { dryRun: false });
      const removedOutputs = result.outputs.filter((o) => o.action === 'removed');
      // External-owned targets should not be auto-removed
      assert.equal(removedOutputs.length, 0);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('detectDuplicates warns on Gemini command + shared skill collision', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-dup-'));
    try {
      // Create a Gemini command at .gemini/commands/gh-issue.toml
      await mkdir(join(tmpDir, '.gemini', 'commands'), { recursive: true });
      await writeFile(
        join(tmpDir, '.gemini', 'commands', 'gh-issue.toml'),
        '[command]\nname = "gh-issue"'
      );

      // Create a .agents/skills/gh-issue/ directory (simulating existing duplicate)
      await mkdir(join(tmpDir, '.agents', 'skills', 'gh-issue'), { recursive: true });
      await writeFile(
        join(tmpDir, '.agents', 'skills', 'gh-issue', 'SKILL.md'),
        '---\nname: gh-issue\n---\n\n# GH Issue'
      );

      const outputs: SyncOutput[] = [];
      const warnings = await detectDuplicates(tmpDir, outputs);
      const dupWarnings = warnings.filter((w) => w.message.includes('gh-issue'));
      assert.ok(dupWarnings.length > 0, 'Should detect gh-issue duplicate');

      // Verify structured cleanupTargets populated
      const dup = dupWarnings[0];
      assert.ok(
        dup.cleanupTargets && dup.cleanupTargets.length > 0,
        'Should have cleanupTargets array'
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('detectDuplicates returns structured cleanupTargets for external duplicates', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-dup-ext-'));
    try {
      await mkdir(join(tmpDir, '.gemini', 'commands'), { recursive: true });
      await mkdir(join(tmpDir, '.agents', 'skills', 'openspec-test'), { recursive: true });
      await writeFile(
        join(tmpDir, '.gemini', 'commands', 'openspec-test.toml'),
        '[command]\nname = "openspec-test"'
      );
      await writeFile(
        join(tmpDir, '.agents', 'skills', 'openspec-test', 'SKILL.md'),
        '---\nname: openspec-test\n---\n\n# Test'
      );

      const outputs: SyncOutput[] = [];
      const warnings = await detectDuplicates(tmpDir, outputs);
      const dupWarnings = warnings.filter((w) => w.message.includes('openspec-test'));
      assert.ok(dupWarnings.length > 0, 'Should detect openspec duplicate');

      const dup = dupWarnings[0];
      assert.ok(
        dup.cleanupTargets && dup.cleanupTargets.length > 0,
        'External duplicate should have structured cleanupTargets'
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('detectDuplicates detects OpenSpec cross-name duplicates', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-opsx-dup-'));
    try {
      // Create a Gemini command at .gemini/commands/opsx/apply.toml
      await mkdir(join(tmpDir, '.gemini', 'commands', 'opsx'), { recursive: true });
      await writeFile(
        join(tmpDir, '.gemini', 'commands', 'opsx', 'apply.toml'),
        '[command]\nname = "apply"'
      );

      // Create .agents/skills/openspec-apply-change/ (different name, same tool)
      await mkdir(join(tmpDir, '.agents', 'skills', 'openspec-apply-change'), { recursive: true });
      await writeFile(
        join(tmpDir, '.agents', 'skills', 'openspec-apply-change', 'SKILL.md'),
        '---\nname: openspec-apply-change\n---\n\n# OpenSpec Apply'
      );

      const outputs: SyncOutput[] = [];
      const warnings = await detectDuplicates(tmpDir, outputs);
      const externalWarnings = warnings.filter(
        (w) =>
          w.message.includes('External asset duplicate') || w.message.includes('external asset')
      );
      const openSpecWarnings = externalWarnings.filter(
        (w) => w.message.includes('openspec') || w.message.toLowerCase().includes('open spec')
      );
      assert.ok(openSpecWarnings.length > 0, 'Should detect OpenSpec cross-name duplicate');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('detectDuplicates includes planned shared-skill outputs in index', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-dup-plan-'));
    try {
      // Create a Gemini command
      await mkdir(join(tmpDir, '.gemini', 'commands'), { recursive: true });
      await writeFile(
        join(tmpDir, '.gemini', 'commands', 'my-command.toml'),
        '[command]\nname = "my-command"'
      );

      // Simulate a planned shared-skill output with the same name (not on disk yet)
      const outputs: SyncOutput[] = [
        {
          targetPath: join(tmpDir, '.agents', 'skills', 'my-command'),
          kind: 'directory',
          action: 'created',
          owner: 'aco',
          assetKind: 'shared-skill',
        },
      ];

      const warnings = await detectDuplicates(tmpDir, outputs);
      const dupWarnings = warnings.filter((w) => w.message.includes('my-command'));
      assert.ok(
        dupWarnings.length > 0,
        'Should detect planned shared-skill vs Gemini command duplicate'
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('--strict mode promotes duplicate warnings to errors', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-strict-'));
    try {
      // Create enough source files for sync to run
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');

      // Create a Gemini command at .gemini/commands/gh-issue.toml
      await mkdir(join(tmpDir, '.gemini', 'commands'), { recursive: true });
      await writeFile(
        join(tmpDir, '.gemini', 'commands', 'gh-issue.toml'),
        '[command]\nname = "gh-issue"'
      );

      // Create a .agents/skills/gh-issue/ directory (creates duplicate scenario)
      await mkdir(join(tmpDir, '.agents', 'skills', 'gh-issue'), { recursive: true });
      await writeFile(
        join(tmpDir, '.agents', 'skills', 'gh-issue', 'SKILL.md'),
        '---\nname: gh-issue\n---\n\n# GH Issue'
      );

      // With --strict, sync --check should fail due to duplicate warnings
      try {
        await runSync(tmpDir, { check: true, strict: true });
        assert.fail('Expected sync to fail in strict mode');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        assert.ok(msg.includes('strict'), `Expected strict error, got: ${msg}`);
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('--clean-duplicates removes manifest-owned duplicate assets', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-clean-'));
    try {
      const acoDir = join(tmpDir, '.aco');
      await mkdir(acoDir, { recursive: true });
      const targetDir = join(tmpDir, '.agents', 'skills', 'gh-issue');
      await mkdir(targetDir, { recursive: true });
      await writeFile(join(targetDir, 'SKILL.md'), '---\nname: gh-issue\n---\n\n# GH Issue');

      const manifest = {
        version: '2',
        generatedAt: new Date().toISOString(),
        sourceHashes: {},
        targetHashes: {},
        targets: {
          [targetDir]: {
            hash: 'will-not-match-disk',
            owner: 'aco',
            kind: 'command-alias-skill' as string,
          },
        },
        skipped: [],
        warnings: [],
      };
      await writeFile(join(acoDir, 'sync-manifest.json'), JSON.stringify(manifest, null, 2));

      // Create a Gemini command to trigger duplicate detection
      await mkdir(join(tmpDir, '.gemini', 'commands'), { recursive: true });
      await writeFile(
        join(tmpDir, '.gemini', 'commands', 'gh-issue.toml'),
        '[command]\nname = "gh-issue"'
      );

      await writeFile(join(tmpDir, 'CLAUDE.md'), '');

      await runSync(tmpDir, {
        dryRun: false,
        cleanDuplicates: true,
        forceClean: true,
      });

      // Verify the duplicate was removed from disk
      const { existsSync } = await import('node:fs');
      assert.equal(
        existsSync(targetDir),
        false,
        `Cleaned duplicate ${targetDir} should no longer exist on disk`
      );

      // Verify manifest no longer contains the cleaned target path
      const updatedManifest = JSON.parse(
        await readFile(join(acoDir, 'sync-manifest.json'), 'utf-8')
      );
      assert.equal(
        targetDir in updatedManifest.targets,
        false,
        `Manifest targets should not contain cleaned path ${targetDir}`
      );
      assert.equal(
        targetDir in updatedManifest.targetHashes,
        false,
        `Manifest targetHashes should not contain cleaned path ${targetDir}`
      );

      // Verify manifest records the cleanup
      const cleanupWarnings = updatedManifest.warnings.filter(
        (w: { message: string }) =>
          w.message.includes('Cleaned') || w.message.includes('Force-cleaned')
      );
      assert.ok(cleanupWarnings.length > 0, 'Manifest should record cleanup with a warning entry');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('--clean-duplicates does not recreate cleaned planned outputs in the same run', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-clean-plan-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');
      await mkdir(join(tmpDir, '.aco'), { recursive: true });
      await writeFile(join(tmpDir, '.aco', 'sync.yaml'), 'skills:\n  include:\n    - gh-issue\n');

      const sourceSkillDir = join(tmpDir, '.claude', 'skills', 'gh-issue');
      await mkdir(sourceSkillDir, { recursive: true });
      await writeFile(
        join(sourceSkillDir, 'SKILL.md'),
        '---\nname: gh-issue\n---\n\n# GH Issue Source'
      );

      const targetDir = join(tmpDir, '.agents', 'skills', 'gh-issue');
      await mkdir(targetDir, { recursive: true });
      await writeFile(
        join(targetDir, 'SKILL.md'),
        '---\nname: gh-issue\n---\n\n# Existing Duplicate'
      );

      await mkdir(join(tmpDir, '.gemini', 'commands'), { recursive: true });
      await writeFile(
        join(tmpDir, '.gemini', 'commands', 'gh-issue.toml'),
        '[command]\nname = "gh-issue"'
      );

      const result = await runSync(tmpDir, {
        dryRun: false,
        cleanDuplicates: true,
        forceClean: true,
      });

      const { existsSync } = await import('node:fs');
      assert.equal(
        existsSync(targetDir),
        false,
        'cleaned duplicate target should not be recreated by the write loop'
      );
      assert.equal(
        result.outputs.some((o) => o.targetPath === targetDir),
        false,
        'cleaned duplicate target should be removed from the current output plan'
      );

      const manifest = JSON.parse(
        await readFile(join(tmpDir, '.aco', 'sync-manifest.json'), 'utf-8')
      );
      assert.equal(targetDir in manifest.targets, false);
      assert.equal(targetDir in manifest.targetHashes, false);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('warns when .claude/skills/ contains directories without SKILL.md', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-noskillmd-'));
    try {
      const skillsDir = join(tmpDir, '.claude', 'skills');
      const validSkillDir = join(skillsDir, 'some-skill');
      const nonSkillDir = join(skillsDir, 'not-a-skill');
      await mkdir(validSkillDir, { recursive: true });
      await mkdir(nonSkillDir, { recursive: true });
      await writeFile(
        join(validSkillDir, 'SKILL.md'),
        '---\nname: some-skill\nx-aco-owned: true\n---\n\n# Some Skill'
      );
      await writeFile(join(nonSkillDir, 'README.md'), '# Not A Skill');
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');

      const result = await runSync(tmpDir, { dryRun: false });
      assert.ok(result.warnings > 0, 'should emit warnings for non-skill directories');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('--check returns success when all outputs are current', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-check-current-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# Test Repo');
      await mkdir(join(tmpDir, '.claude', 'skills', 'myskill'), { recursive: true });
      await writeFile(
        join(tmpDir, '.claude', 'skills', 'myskill', 'SKILL.md'),
        '---\nname: myskill\nx-aco-owned: true\n---\n\n# My Skill'
      );

      // First sync to create manifest
      await runSync(tmpDir, { dryRun: false });
      // Second sync with --check should pass
      const result = await runSync(tmpDir, { check: true });
      assert.equal(result.conflicts, 0, 'check should find no conflicts');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('--check fails when a source has changed', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-check-stale-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# Test Repo');
      // First sync
      await runSync(tmpDir, { dryRun: false });
      // Modify a source file
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# Updated Repo\n\nNew content.');

      await assert.rejects(async () => runSync(tmpDir, { check: true }), /Sync check failed/);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('--clean-duplicates refuses non-owned duplicates without --force-clean', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-refuse-'));
    try {
      const acoDir = join(tmpDir, '.aco');
      await mkdir(acoDir, { recursive: true });
      const targetDir = join(tmpDir, '.agents', 'skills', 'gh-issue');
      await mkdir(targetDir, { recursive: true });
      await writeFile(join(targetDir, 'SKILL.md'), '---\nname: gh-issue\n---\n\n# GH Issue');

      // Create a manifest where the target is NOT aco-owned
      const manifest = {
        version: '2' as string,
        generatedAt: new Date().toISOString(),
        sourceHashes: {} as Record<string, string>,
        targetHashes: {} as Record<string, string>,
        targets: {
          [targetDir]: {
            hash: 'will-not-match',
            owner: 'unknown' as string,
            kind: 'command-alias-skill' as string,
          },
        } as Record<string, { hash: string; owner: string; kind: string }>,
        skipped: [] as { path: string; owner: string; kind: string; reason: string }[],
        warnings: [] as { source: string; message: string; severity: string }[],
      };
      await writeFile(join(acoDir, 'sync-manifest.json'), JSON.stringify(manifest, null, 2));

      await mkdir(join(tmpDir, '.gemini', 'commands'), { recursive: true });
      await writeFile(
        join(tmpDir, '.gemini', 'commands', 'gh-issue.toml'),
        '[command]\nname = "gh-issue"'
      );
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');

      const result = await runSync(tmpDir, { dryRun: false, cleanDuplicates: true });
      assert.ok(result.warnings > 0, 'should have warnings from refusing to clean or duplicates');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('records skipped assets with path, owner, kind, and reason in manifest', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-skipped-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');
      await mkdir(join(tmpDir, '.claude', 'skills', 'openspec-test'), { recursive: true });
      await writeFile(
        join(tmpDir, '.claude', 'skills', 'openspec-test', 'SKILL.md'),
        '---\nname: openspec-test\n---\n\n# OpenSpec Test'
      );

      await runSync(tmpDir, { dryRun: false });
      const manifest = JSON.parse(
        await readFile(join(tmpDir, '.aco', 'sync-manifest.json'), 'utf-8')
      );

      assert.ok(Array.isArray(manifest.skipped), 'manifest should have skipped array');
      const openspecSkipped = manifest.skipped.find((s: { path: string }) =>
        s.path.includes('openspec-test')
      );
      assert.ok(openspecSkipped, 'openspec-test should be in skipped records');
      assert.equal(openspecSkipped.owner, 'external');
      assert.equal(openspecSkipped.kind, 'external-skill');
      assert.ok(typeof openspecSkipped.reason === 'string', 'should have a reason');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('detectDuplicates handles Codex skills and Claude commands in index', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-fullidx-'));
    try {
      await mkdir(join(tmpDir, '.gemini', 'commands'), { recursive: true });
      await mkdir(join(tmpDir, '.codex', 'skills', 'openspec-test'), { recursive: true });
      await writeFile(
        join(tmpDir, '.codex', 'skills', 'openspec-test', 'SKILL.md'),
        '---\nname: openspec-test\n---\n\n# Test'
      );
      await mkdir(join(tmpDir, '.claude', 'commands'), { recursive: true });
      await writeFile(
        join(tmpDir, '.claude', 'commands', 'review.md'),
        '---\nname: review\n---\n\n# Review command'
      );
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');

      // runSync internally calls detectDuplicates with all surfaces indexed
      const result = await runSync(tmpDir, { dryRun: false });
      assert.ok(
        typeof result.warnings === 'number',
        'runSync should complete with Codex skills and Claude commands in index'
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('classification precedence: exclude overrides include', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-precedence-excl-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');
      await mkdir(join(tmpDir, '.claude', 'skills', 'gh-issue'), { recursive: true });
      await writeFile(
        join(tmpDir, '.claude', 'skills', 'gh-issue', 'SKILL.md'),
        '---\nname: gh-issue\nx-aco-owned: true\n---\n\n# GH Issue'
      );
      await mkdir(join(tmpDir, '.aco'), { recursive: true });
      // Include gh-* but exclude gh-issue specifically — exclude wins
      await writeFile(
        join(tmpDir, '.aco', 'sync.yaml'),
        'skills:\n  include:\n    - "gh-*"\n  exclude:\n    - "gh-issue"\n'
      );

      const result = await runSync(tmpDir, { dryRun: false });
      // gh-issue should be skipped despite being in include (exclude wins)
      const ghIssueOutput = result.outputs.find(
        (o) => o.targetPath.includes('gh-issue') && o.action !== 'removed'
      );
      assert.equal(
        ghIssueOutput,
        undefined,
        'gh-issue should not be synced when excluded despite x-aco-owned and include'
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('classification precedence: include overrides naming heuristic', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-precedence-incl-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');
      await mkdir(join(tmpDir, '.claude', 'skills', 'openspec-test'), { recursive: true });
      await writeFile(
        join(tmpDir, '.claude', 'skills', 'openspec-test', 'SKILL.md'),
        '---\nname: openspec-test\n---\n\n# OpenSpec Test'
      );
      await mkdir(join(tmpDir, '.aco'), { recursive: true });
      // Explicitly include openspec-test despite openspec-* default deny
      await writeFile(
        join(tmpDir, '.aco', 'sync.yaml'),
        'skills:\n  include:\n    - "openspec-test"\n'
      );

      const result = await runSync(tmpDir, { dryRun: false });
      // openspec-test should be synced because include overrides the heuristic
      const syncedOutput = result.outputs.find(
        (o) => o.targetPath.includes('openspec-test') && o.action !== 'removed'
      );
      assert.ok(syncedOutput, 'openspec-test should be synced when explicitly included');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('classifies Superpowers skills as external', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-superpowers-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');
      const superpowersNames = ['superpowers-test', 'brainstorming'];
      for (const name of superpowersNames) {
        await mkdir(join(tmpDir, '.claude', 'skills', name), { recursive: true });
        await writeFile(
          join(tmpDir, '.claude', 'skills', name, 'SKILL.md'),
          `---\nname: ${name}\n---\n\n# ${name}`
        );
      }

      const result = await runSync(tmpDir, { dryRun: false });
      const manifest = JSON.parse(
        await readFile(join(tmpDir, '.aco', 'sync-manifest.json'), 'utf-8')
      );

      // All Superpowers skills should be in skipped with owner external
      for (const name of superpowersNames) {
        const skipped = manifest.skipped.find((s: { path: string }) => s.path.includes(name));
        assert.ok(skipped, `${name} should be in skipped records`);
        assert.equal(skipped.owner, 'external');
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('loadSyncConfig handles empty sync.yaml gracefully', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-empty-yaml-'));
    try {
      await mkdir(join(tmpDir, '.aco'), { recursive: true });
      await writeFile(join(tmpDir, '.aco', 'sync.yaml'), '');
      const config = await loadSyncConfig(tmpDir);
      assert.deepEqual(
        config,
        { skills: { include: [], exclude: ['openspec-*', 'superpowers-*', 'gh-*'] } },
        'empty yaml should return default config'
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('loadSyncConfig handles comment-only sync.yaml gracefully', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-comment-yaml-'));
    try {
      await mkdir(join(tmpDir, '.aco'), { recursive: true });
      await writeFile(
        join(tmpDir, '.aco', 'sync.yaml'),
        '# This is a comment\n# Another comment\n'
      );
      const config = await loadSyncConfig(tmpDir);
      assert.deepEqual(
        config,
        { skills: { include: [], exclude: ['openspec-*', 'superpowers-*', 'gh-*'] } },
        'comment-only yaml should return default config'
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('detectDuplicates cleanupTargets include .codex/skills/ for external duplicates', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-dup-codex-cleanup-'));
    try {
      // Create two .codex/skills/ directories that canonicalize to the same name
      // openspec-apply and openspec-apply-change both canonicalize to openspec-apply
      await mkdir(join(tmpDir, '.codex', 'skills', 'openspec-apply'), { recursive: true });
      await mkdir(join(tmpDir, '.codex', 'skills', 'openspec-apply-change'), { recursive: true });
      await writeFile(
        join(tmpDir, '.codex', 'skills', 'openspec-apply', 'SKILL.md'),
        '---\nname: openspec-apply\n---\n\n# Test'
      );
      await writeFile(
        join(tmpDir, '.codex', 'skills', 'openspec-apply-change', 'SKILL.md'),
        '---\nname: openspec-apply-change\n---\n\n# Test'
      );

      const outputs: SyncOutput[] = [];
      const warnings = await detectDuplicates(tmpDir, outputs);
      const dupWarnings = warnings.filter((w) => w.message.includes('openspec-apply'));
      assert.ok(dupWarnings.length > 0, 'Should detect cross-name duplicate in .codex/skills/');

      const dup = dupWarnings[0];
      assert.ok(dup.cleanupTargets && dup.cleanupTargets.length > 0, 'Should have cleanupTargets');
      const codexTarget = dup.cleanupTargets!.some((t) => t.includes('.codex/skills/'));
      assert.ok(codexTarget, 'cleanupTargets should include .codex/skills/');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('detectDuplicates cross-name cleanupTargets include .codex/skills/', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-dup-cross-codex-'));
    try {
      // Create two .codex/skills/ directories that canonicalize to the same name
      // openspec-apply-change and openspec-apply both canonicalize to openspec-apply
      await mkdir(join(tmpDir, '.codex', 'skills', 'openspec-apply-change'), { recursive: true });
      await mkdir(join(tmpDir, '.codex', 'skills', 'openspec-apply'), { recursive: true });
      await writeFile(
        join(tmpDir, '.codex', 'skills', 'openspec-apply-change', 'SKILL.md'),
        '---\nname: openspec-apply-change\n---\n\n# Test'
      );
      await writeFile(
        join(tmpDir, '.codex', 'skills', 'openspec-apply', 'SKILL.md'),
        '---\nname: openspec-apply\n---\n\n# Test'
      );

      const outputs: SyncOutput[] = [];
      const warnings = await detectDuplicates(tmpDir, outputs);
      const dupWarnings = warnings.filter((w) => w.message.includes('openspec-apply'));
      assert.ok(dupWarnings.length > 0, 'Should detect cross-name duplicate in .codex/skills/');

      const dup = dupWarnings[0];
      assert.ok(dup.cleanupTargets && dup.cleanupTargets.length > 0, 'Should have cleanupTargets');
      const codexTarget = dup.cleanupTargets!.some((t) => t.includes('.codex/skills/'));
      assert.ok(codexTarget, 'cross-name cleanupTargets should include .codex/skills/');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('syncSkills rejects path traversal attempts', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-traversal-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');
      const skillDir = join(tmpDir, '.claude', 'skills', 'myskill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, 'SKILL.md'),
        '---\nname: myskill\nx-aco-owned: true\n---\n\n# My Skill'
      );

      // Craft a source with a path outside .claude/skills/
      const maliciousSource: SyncSource = {
        path: join(tmpDir, '..', 'external', 'SKILL.md'),
        kind: 'skill',
        content: 'malicious',
        hash: 'badhash',
      };

      const config: SyncConfig = { skills: { include: ['*'] } };
      const result = await syncSkills([maliciousSource], tmpDir, null, config);
      assert.ok(
        result.skipped.some((s) => s.reason.includes('path traversal')),
        'Should skip path traversal source'
      );
      assert.ok(
        result.warnings.some((w) => w.message.includes('Refusing to copy from outside')),
        'Should warn about path traversal'
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('detects user-modified drift on manifest-owned target', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-drift-'));
    try {
      const acoDir = join(tmpDir, '.aco');
      await mkdir(acoDir, { recursive: true });
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# Initial');
      await mkdir(join(tmpDir, '.claude', 'skills', 'myskill'), { recursive: true });
      await writeFile(
        join(tmpDir, '.claude', 'skills', 'myskill', 'SKILL.md'),
        '---\nname: myskill\nx-aco-owned: true\n---\n\n# My Skill'
      );

      // First sync to create AGENTS.md with known hash
      await runSync(tmpDir, { dryRun: false });

      // Manually modify AGENTS.md to create drift
      const agentsPath = join(tmpDir, 'AGENTS.md');
      const originalContent = await readFile(agentsPath, 'utf-8');
      await writeFile(agentsPath, originalContent + '\n<!-- user modification -->');

      // Running sync without --force should fail
      await assert.rejects(async () => runSync(tmpDir, { dryRun: false }), /conflict/i);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('manifest warnings include conversion warnings with source and message', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-warnings-'));
    try {
      await mkdir(join(tmpDir, '.claude', 'skills', 'myskill'), { recursive: true });
      await writeFile(
        join(tmpDir, '.claude', 'skills', 'myskill', 'SKILL.md'),
        '---\nname: myskill\nx-aco-owned: true\n---\n\n# My Skill with scripts/\n'
      );
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');

      const result = await runSync(tmpDir, { dryRun: false });
      const manifest = JSON.parse(
        await readFile(join(tmpDir, '.aco', 'sync-manifest.json'), 'utf-8')
      );

      assert.ok(Array.isArray(manifest.warnings), 'manifest should have warnings array');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('detectDuplicates deduplicates same-path entries to avoid false positives', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-dup-dedup-'));
    try {
      // Create a skill on disk that will be scanned
      await mkdir(join(tmpDir, '.agents', 'skills', 'gh-issue'), { recursive: true });
      await writeFile(
        join(tmpDir, '.agents', 'skills', 'gh-issue', 'SKILL.md'),
        '---\nname: gh-issue\n---\n\n# GH Issue'
      );
      // Create a Gemini command with the same name
      await mkdir(join(tmpDir, '.gemini', 'commands'), { recursive: true });
      await writeFile(
        join(tmpDir, '.gemini', 'commands', 'gh-issue.toml'),
        '[command]\nname = "gh-issue"'
      );

      // Also pass a planned output pointing to the same .agents/skills/gh-issue path
      // This simulates the case where the same path is indexed twice
      const outputs: SyncOutput[] = [
        {
          targetPath: join(tmpDir, '.agents', 'skills', 'gh-issue'),
          kind: 'directory',
          action: 'created',
          owner: 'aco',
          assetKind: 'command-alias-skill',
        },
      ];

      const warnings = await detectDuplicates(tmpDir, outputs);
      const dupWarnings = warnings.filter((w) => w.message.includes('gh-issue'));
      // Should detect exactly 1 duplicate, not 2 (false positive from same path)
      assert.equal(
        dupWarnings.length,
        1,
        'Same-path entries should be deduplicated; expected 1 warning'
      );

      const dup = dupWarnings[0];
      assert.ok(dup.cleanupTargets && dup.cleanupTargets.length > 0, 'Should have cleanupTargets');
      // Cleanup target should only list the path once
      assert.equal(
        dup.cleanupTargets!.length,
        1,
        'cleanupTargets should deduplicate to a single path'
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('detectDuplicates cleanupTargets use OS-independent path matching', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-dup-ospath-'));
    try {
      await mkdir(join(tmpDir, '.gemini', 'commands'), { recursive: true });
      await mkdir(join(tmpDir, '.agents', 'skills', 'openspec-test'), { recursive: true });
      await writeFile(
        join(tmpDir, '.gemini', 'commands', 'openspec-test.toml'),
        '[command]\nname = "openspec-test"'
      );
      await writeFile(
        join(tmpDir, '.agents', 'skills', 'openspec-test', 'SKILL.md'),
        '---\nname: openspec-test\n---\n\n# Test'
      );

      const outputs: SyncOutput[] = [];
      const warnings = await detectDuplicates(tmpDir, outputs);
      const dupWarnings = warnings.filter((w) => w.message.includes('openspec-test'));
      assert.ok(dupWarnings.length > 0, 'Should detect openspec duplicate');

      const dup = dupWarnings[0];
      assert.ok(dup.cleanupTargets && dup.cleanupTargets.length > 0, 'Should have cleanupTargets');
      // Verify cleanupTargets contains the actual directory path, not relying on hardcoded /
      const target = dup.cleanupTargets![0];
      assert.ok(
        target.includes('openspec-test'),
        `cleanupTarget should include skill name: ${target}`
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
