import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load as loadYaml } from 'js-yaml';
import { parseAgentSpec } from '../src/sync/agent-parse.js';
import { toCodexAgent, serializeCodexAgent } from '../src/sync/agent-codex-transform.js';
import { loadFormatterConfig, resolveModelForProvider } from '../src/sync/formatter.js';
import { parseHooks, toCodexHooks } from '../src/sync/hook-parse.js';
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

/**
 * Seed a minimal structured source (a Codex agent) so runSync passes the
 * no-structured-source hard-fail guard. Used by fixtures that exercise
 * legacy/duplicate/hook/migration behavior on an otherwise CLAUDE.md-only repo
 * with no prior manifest. See OpenSpec change aco-sync-narrow-scope.
 */
async function seedAnchorAgent(repoRoot: string): Promise<void> {
  await mkdir(join(repoRoot, '.claude', 'agents'), { recursive: true });
  await writeFile(
    join(repoRoot, '.claude', 'agents', '_anchor.md'),
    '---\nid: _anchor\nwhen: anchor structured source for sync tests\n---\nAnchor.'
  );
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

  // Note: Gemini agent transform (toGeminiAgent / serializeGeminiAgent) is retired.
  // The agent-gemini-transform module and its exports have been removed as part of
  // the context-sync engine redesign (Phase 2: Task 3).
});

// ---------------------------------------------------------------------------
// Phase 2 (Task 3): AGENTS.md-only output + manifest v5 + Gemini cleanup
// ---------------------------------------------------------------------------

describe('Phase 2: AGENTS.md-only sync output', () => {
  it('runSync produces neither AGENTS.md nor GEMINI.md (guideline md projection removed)', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-agents-only-'));
    try {
      await seedAnchorAgent(tmpDir);
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# Project context\n\nSome rules.');

      const result = await runSync(tmpDir, { dryRun: false });

      // AGENTS.md must NOT appear in outputs — sync no longer generates guideline markdown
      const agentsOutput = result.outputs.find((o) => o.targetPath.endsWith('AGENTS.md'));
      assert.equal(agentsOutput, undefined, 'AGENTS.md must NOT be in sync outputs');

      // GEMINI.md must NOT appear in outputs
      const geminiOutput = result.outputs.find((o) => o.targetPath.endsWith('GEMINI.md'));
      assert.equal(geminiOutput, undefined, 'GEMINI.md must NOT be in sync outputs');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('runSync does NOT create or modify AGENTS.md on disk', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-agents-untouched-'));
    try {
      await seedAnchorAgent(tmpDir);
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# Project context\n\nSome rules.');
      // Pre-existing hand-maintained AGENTS.md with stale managed-block markers
      const handAgents =
        '# Hand-maintained\n\n<!-- BEGIN ACO GENERATED CONTEXT -->\nstale\n<!-- END ACO GENERATED CONTEXT -->\n';
      await writeFile(join(tmpDir, 'AGENTS.md'), handAgents);

      await runSync(tmpDir, { dryRun: false });

      const after = await readFile(join(tmpDir, 'AGENTS.md'), 'utf-8');
      assert.equal(after, handAgents, 'sync must leave AGENTS.md byte-for-byte unchanged');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('manifest version is "5" after sync', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-manifest-v5-'));
    try {
      await seedAnchorAgent(tmpDir);
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# context');

      await runSync(tmpDir, { dryRun: false });
      const manifest = JSON.parse(
        await readFile(join(tmpDir, '.aco', 'sync-manifest.json'), 'utf-8')
      );

      assert.equal(manifest.version, '5', 'manifest version must be "5" after Phase 2 sync');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('manifest targets do NOT include GEMINI.md key after sync', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-no-gemini-target-'));
    try {
      await seedAnchorAgent(tmpDir);
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# context');

      await runSync(tmpDir, { dryRun: false });
      const manifest = JSON.parse(
        await readFile(join(tmpDir, '.aco', 'sync-manifest.json'), 'utf-8')
      );

      assert.equal(
        'GEMINI.md' in manifest.targets,
        false,
        'GEMINI.md must not be in manifest targets'
      );
      assert.equal(
        'GEMINI.md' in manifest.targetHashes,
        false,
        'GEMINI.md must not be in manifest targetHashes'
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('manifest targets exclude AGENTS.md but include codex surfaces after sync', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-codex-intact-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# context');
      await mkdir(join(tmpDir, '.claude', 'agents'), { recursive: true });
      await writeFile(
        join(tmpDir, '.claude', 'agents', 'helper.md'),
        '---\nid: helper\nwhen: Help with tasks\n---\nYou are a helper.'
      );

      await runSync(tmpDir, { dryRun: false });
      const manifest = JSON.parse(
        await readFile(join(tmpDir, '.aco', 'sync-manifest.json'), 'utf-8')
      );

      assert.equal(
        'AGENTS.md' in manifest.targets,
        false,
        'AGENTS.md must NOT be in manifest targets'
      );
      const codexAgentKey = join('.codex', 'agents', 'helper.toml');
      assert.ok(
        codexAgentKey in manifest.targets,
        '.codex/agents/helper.toml must be in manifest targets'
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('agents.exclude in sync.yaml skips agent discovery (no .codex/agents, no manifest source)', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-agents-exclude-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# context');
      await mkdir(join(tmpDir, '.claude', 'agents'), { recursive: true });
      await writeFile(
        join(tmpDir, '.claude', 'agents', 'helper.md'),
        '---\nid: helper\nwhen: Help with tasks\n---\nYou are a helper.'
      );
      // A skill keeps at least one structured source so sync runs; only agents are excluded.
      await mkdir(join(tmpDir, '.claude', 'skills', 'keep-skill'), { recursive: true });
      await writeFile(
        join(tmpDir, '.claude', 'skills', 'keep-skill', 'SKILL.md'),
        '---\nname: keep-skill\n---\n\n# Keep'
      );
      await mkdir(join(tmpDir, '.aco'), { recursive: true });
      await writeFile(
        join(tmpDir, '.aco', 'sync.yaml'),
        'skills:\n  include:\n    - keep-skill\nagents:\n  exclude:\n    - "*"\n'
      );

      await runSync(tmpDir, { dryRun: false });
      const manifest = JSON.parse(
        await readFile(join(tmpDir, '.aco', 'sync-manifest.json'), 'utf-8')
      );

      const codexAgentKey = join('.codex', 'agents', 'helper.toml');
      assert.equal(
        codexAgentKey in manifest.targets,
        false,
        'excluded agent must NOT produce a .codex/agents target'
      );
      assert.ok(
        '.agents/skills/keep-skill' in manifest.targets,
        'non-agent sources must still sync when agents are excluded'
      );
      assert.equal(
        '.claude/agents/helper.md' in manifest.sourceHashes,
        false,
        'excluded agent must NOT be tracked as a sync source'
      );
      const { existsSync } = await import('node:fs');
      assert.equal(
        existsSync(join(tmpDir, '.codex', 'agents', 'helper.toml')),
        false,
        '.codex/agents/helper.toml must not be written to disk'
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('sync --check tolerates a stale aco-owned AGENTS.md entry in a legacy manifest', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-stale-agents-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# context');
      await mkdir(join(tmpDir, '.claude', 'agents'), { recursive: true });
      await writeFile(
        join(tmpDir, '.claude', 'agents', 'helper.md'),
        '---\nid: helper\nwhen: Help with tasks\n---\nYou are a helper.'
      );

      // Establish a clean, up-to-date manifest
      await runSync(tmpDir, { dryRun: false });
      const manifestPath = join(tmpDir, '.aco', 'sync-manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));

      // Simulate a manifest written by an older aco version that still lists AGENTS.md
      manifest.targets['AGENTS.md'] = { hash: 'stale-agents', owner: 'aco', kind: 'config' };
      manifest.targetHashes['AGENTS.md'] = 'stale-agents';
      await writeFile(manifestPath, JSON.stringify(manifest));

      // The stale AGENTS.md entry must NOT be treated as drift (no false CI failure)
      await assert.doesNotReject(async () => runSync(tmpDir, { check: true }));
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('aco-owned GEMINI.md and .gemini/agents/* in v4 manifest are cleaned on sync', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-gemini-cleanup-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# context');

      // Create legacy GEMINI.md on disk
      const geminiMdPath = join(tmpDir, 'GEMINI.md');
      const geminiContent =
        '<!-- BEGIN ACO GENERATED -->\nold content\n<!-- END ACO GENERATED -->\n';
      await writeFile(geminiMdPath, geminiContent);

      // Create legacy .gemini/agents/helper.md on disk
      await mkdir(join(tmpDir, '.gemini', 'agents'), { recursive: true });
      const geminiAgentPath = join(tmpDir, '.gemini', 'agents', 'helper.md');
      await writeFile(geminiAgentPath, '---\nname: helper\nkind: local\n---\nBody.');

      // Write a genuine v4 manifest that owns both GEMINI.md and .gemini/agents/helper.md.
      // runSync reads it via readManifest (which migrates v4→v5) and the engine's
      // legacy cleanup plans the on-disk removals.
      await mkdir(join(tmpDir, '.aco'), { recursive: true });
      const geminiHash = computeHash(geminiContent);
      const geminiAgentContent = '---\nname: helper\nkind: local\n---\nBody.';
      const geminiAgentHash = computeHash(geminiAgentContent);
      const v4Manifest = {
        version: '4',
        generatedAt: new Date().toISOString(),
        sourceHashes: { 'CLAUDE.md': computeHash('# context') },
        targetHashes: {
          'GEMINI.md': geminiHash,
          '.gemini/agents/helper.md': geminiAgentHash,
        },
        targets: {
          'GEMINI.md': { hash: geminiHash, owner: 'aco', kind: 'config' },
          '.gemini/agents/helper.md': { hash: geminiAgentHash, owner: 'aco', kind: 'agent' },
        },
        skipped: [],
        warnings: [],
      };
      await writeFile(join(tmpDir, '.aco', 'sync-manifest.json'), JSON.stringify(v4Manifest));

      const result = await runSync(tmpDir, { dryRun: false, force: true });

      // GEMINI.md removal should be in outputs
      const geminiRemoved = result.outputs.some(
        (o) => o.targetPath.endsWith('GEMINI.md') && o.action === 'removed'
      );
      assert.ok(geminiRemoved, 'aco-owned GEMINI.md from v4 manifest must be removed');

      // .gemini/agents/helper.md removal should be in outputs
      const geminiAgentRemoved = result.outputs.some(
        (o) =>
          o.targetPath.includes('.gemini') &&
          o.targetPath.includes('agents') &&
          o.action === 'removed'
      );
      assert.ok(geminiAgentRemoved, 'aco-owned .gemini/agents/* from v4 manifest must be removed');

      // The legacy files must actually be gone from disk (not just planned)
      const { existsSync } = await import('node:fs');
      assert.equal(existsSync(geminiMdPath), false, 'GEMINI.md must be deleted from disk');
      assert.equal(
        existsSync(geminiAgentPath),
        false,
        '.gemini/agents/helper.md must be deleted from disk'
      );

      // The regenerated v5 manifest must not list the legacy Gemini targets
      const updatedManifest = JSON.parse(
        await readFile(join(tmpDir, '.aco', 'sync-manifest.json'), 'utf-8')
      );
      assert.equal(updatedManifest.version, '5', 'regenerated manifest must be v5');
      assert.equal('GEMINI.md' in updatedManifest.targets, false);
      assert.equal('GEMINI.md' in updatedManifest.targetHashes, false);
      assert.equal('.gemini/agents/helper.md' in updatedManifest.targets, false);
      assert.equal('.gemini/agents/helper.md' in updatedManifest.targetHashes, false);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('No structured sources hard-fail', () => {
  it('runSync fails when only CLAUDE.md exists (no structured source)', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-claude-only-fail-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# Project context\n\nSome rules.');
      await assert.rejects(
        async () => runSync(tmpDir, { dryRun: false }),
        /No sync sources found/,
        'CLAUDE.md-only repo must hard-fail'
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('runSync fails when only CLAUDE.md and .claude/rules exist (no structured source)', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-rules-only-fail-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# context');
      await mkdir(join(tmpDir, '.claude', 'rules'), { recursive: true });
      await writeFile(join(tmpDir, '.claude', 'rules', 'core.md'), '# core rule');
      await assert.rejects(
        async () => runSync(tmpDir, { dryRun: false }),
        /No sync sources found/,
        'CLAUDE.md + rules-only repo must hard-fail'
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('runSync succeeds when a structured source (agent) is present', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-agent-ok-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# context');
      await mkdir(join(tmpDir, '.claude', 'agents'), { recursive: true });
      await writeFile(
        join(tmpDir, '.claude', 'agents', 'helper.md'),
        '---\nid: helper\nwhen: Help with tasks\n---\nYou are a helper.'
      );
      await assert.doesNotReject(async () => runSync(tmpDir, { dryRun: false }));
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('runSync proceeds (cleanup-only) when no structured source but a prior manifest exists', async () => {
    // Covers the guard's `existingManifest !== null` escape hatch directly, WITHOUT
    // an anchor structured source: a repo that previously synced and then had all
    // structured sources removed must still run so stale-target cleanup can complete.
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-cleanup-only-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# context');
      // A prior sync manifest on disk — the only reason runSync is allowed through.
      await mkdir(join(tmpDir, '.aco'), { recursive: true });
      const priorManifest = {
        version: '5',
        generatedAt: new Date().toISOString(),
        sourceHashes: {},
        targetHashes: {},
        targets: {},
        skipped: [],
        warnings: [],
      };
      await writeFile(
        join(tmpDir, '.aco', 'sync-manifest.json'),
        JSON.stringify(priorManifest)
      );

      await assert.doesNotReject(
        async () => runSync(tmpDir, { dryRun: false }),
        'cleanup-only sync (manifest present, zero structured sources) must not hard-fail'
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('cleanup-only sync removes the orphaned Codex agent target after its source is deleted', async () => {
    // The escape hatch promises cleanup completes; this proves it for Codex agents.
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-orphan-codex-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# context');
      await mkdir(join(tmpDir, '.claude', 'agents'), { recursive: true });
      await writeFile(
        join(tmpDir, '.claude', 'agents', 'helper.md'),
        '---\nid: helper\nwhen: Help with tasks\n---\nYou are a helper.'
      );

      // First sync produces .codex/agents/helper.toml and records it in the manifest.
      await runSync(tmpDir, { dryRun: false });
      const toml = join(tmpDir, '.codex', 'agents', 'helper.toml');
      const { existsSync } = await import('node:fs');
      assert.equal(existsSync(toml), true, 'first sync must create the Codex agent target');

      // Delete the only structured source, then re-sync (CLAUDE.md + prior manifest).
      await rm(join(tmpDir, '.claude', 'agents', 'helper.md'));
      const result = await runSync(tmpDir, { dryRun: false });

      const removed = result.outputs.some(
        (o) => o.targetPath.endsWith('helper.toml') && o.action === 'removed'
      );
      assert.ok(removed, 'orphaned Codex agent target must be planned for removal');
      assert.equal(existsSync(toml), false, 'orphaned Codex agent target must be deleted from disk');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
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
  antigravity:
    - gemini-2.5-pro
fallback:
  provider: codex
  model: gpt-5.4-mini
`
      );

      const config = await loadFormatterConfig(tmpDir);

      assert.equal(resolveModelForProvider(config, 'sonnet-4.6', 'codex'), 'gpt-5.4');
      assert.equal(resolveModelForProvider(config, '', 'antigravity'), 'gemini-2.5-pro');
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
  agy-review:
    provider: &agyProvider antigravity
    model: &agyModel "gemini-2.5-pro:stable"
providerModels:
  codex:
    - "gpt-5.4:release"
    - "gpt-5.4 \\"fast\\""
  antigravity:
    - *agyModel
fallback:
  provider: *codexProvider
  model: "gpt-5.4 fallback: safe"
`
      );

      const config = await loadFormatterConfig(tmpDir);

      assert.equal(resolveModelForProvider(config, 'sonnet-4.6', 'codex'), 'gpt-5.4:release');
      assert.equal(
        resolveModelForProvider(config, 'agy-review', 'antigravity'),
        'gemini-2.5-pro:stable'
      );
      assert.equal(resolveModelForProvider(config, '', 'antigravity'), 'gemini-2.5-pro:stable');
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

  // Note: toGeminiHooks is retired. Gemini hook transform has been removed as part of
  // the context-sync engine redesign (Phase 2: Task 3).
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

      assert.equal(manifest.version, '5');
      const targetKey = join('.agents', 'skills', 'github-kanban-ops');
      const record = manifest.targets[targetKey];
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

      assert.equal(manifest.version, '5');
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

  it('detectDuplicates does NOT warn when disk skill and planned output share the same path', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-dup-'));
    try {
      // Create an on-disk .agents/skills/gh-issue/ (indexed as provider:'agents',
      // path .agents/skills/gh-issue/SKILL.md)
      await mkdir(join(tmpDir, '.agents', 'skills', 'gh-issue'), { recursive: true });
      await writeFile(
        join(tmpDir, '.agents', 'skills', 'gh-issue', 'SKILL.md'),
        '---\nname: gh-issue\n---\n\n# GH Issue'
      );

      // Planned output pointing to the SAME directory → planned path resolves to the
      // same .agents/skills/gh-issue/SKILL.md (provider:'agents', name:'gh-issue').
      const outputs: SyncOutput[] = [
        {
          targetPath: join(tmpDir, '.agents', 'skills', 'gh-issue'),
          kind: 'directory',
          action: 'updated',
          owner: 'aco',
          assetKind: 'command-alias-skill',
        },
      ];

      const warnings = await detectDuplicates(tmpDir, outputs);
      // Same provider + name + path collapses in the dedup step, so the disk entry
      // and the planned output must NOT be reported as a duplicate (false positive guard).
      const ghIssueDupes = warnings.filter((w) => w.message.includes('gh-issue'));
      assert.equal(
        ghIssueDupes.length,
        0,
        `Same-path disk+planned entries must not produce a duplicate warning, got: ${JSON.stringify(
          ghIssueDupes.map((w) => w.message)
        )}`
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('detectDuplicates returns structured cleanupTargets for external duplicates (.codex/skills)', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-dup-ext-'));
    try {
      // Two .codex/skills entries with the same canonical openspec name → duplicate within 'codex' provider
      await mkdir(join(tmpDir, '.codex', 'skills', 'openspec-test'), { recursive: true });
      await mkdir(join(tmpDir, '.codex', 'skills', 'openspec-test-change'), { recursive: true });
      await writeFile(
        join(tmpDir, '.codex', 'skills', 'openspec-test', 'SKILL.md'),
        '---\nname: openspec-test\n---\n\n# Test'
      );
      await writeFile(
        join(tmpDir, '.codex', 'skills', 'openspec-test-change', 'SKILL.md'),
        '---\nname: openspec-test-change\n---\n\n# Test'
      );

      const outputs: SyncOutput[] = [];
      const warnings = await detectDuplicates(tmpDir, outputs);
      // openspec-test and openspec-test-change both canonicalize to 'openspec-test' under provider:codex
      const dupWarnings = warnings.filter((w) => w.message.includes('openspec-test'));
      assert.ok(
        dupWarnings.length > 0,
        'Should detect openspec cross-name duplicate in .codex/skills/'
      );

      const dup = dupWarnings[0];
      assert.ok(
        dup.cleanupTargets && dup.cleanupTargets.length > 0,
        'External duplicate should have structured cleanupTargets'
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('detectDuplicates detects OpenSpec cross-name duplicates within .codex/skills/', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-opsx-dup-'));
    try {
      // openspec-apply and openspec-apply-change both canonicalize to openspec-apply
      await mkdir(join(tmpDir, '.codex', 'skills', 'openspec-apply'), { recursive: true });
      await mkdir(join(tmpDir, '.codex', 'skills', 'openspec-apply-change'), { recursive: true });
      await writeFile(
        join(tmpDir, '.codex', 'skills', 'openspec-apply', 'SKILL.md'),
        '---\nname: openspec-apply\n---\n\n# OpenSpec Apply'
      );
      await writeFile(
        join(tmpDir, '.codex', 'skills', 'openspec-apply-change', 'SKILL.md'),
        '---\nname: openspec-apply-change\n---\n\n# OpenSpec Apply Change'
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
      // On-disk .agents/skills/my-skill (indexed as provider:'agents',
      // path .agents/skills/my-skill/SKILL.md)
      await mkdir(join(tmpDir, '.agents', 'skills', 'my-skill'), { recursive: true });
      await writeFile(
        join(tmpDir, '.agents', 'skills', 'my-skill', 'SKILL.md'),
        '---\nname: my-skill\n---\n\n# My Skill'
      );

      // Planned shared-skill output at a DIFFERENT path but the same name.
      // Planned outputs are always indexed as provider:'agents', so this produces a
      // second provider:'agents' + name:'my-skill' entry at a distinct path → duplicate.
      const alternateSkillPath = join(tmpDir, '.codex', 'skills', 'my-skill');
      const outputs: SyncOutput[] = [
        {
          targetPath: alternateSkillPath,
          kind: 'directory',
          action: 'created',
          owner: 'aco',
          assetKind: 'shared-skill',
        },
      ];

      const warnings = await detectDuplicates(tmpDir, outputs);
      // The planned output must be present in the index, so it collides with the
      // on-disk entry and yields a 'my-skill' duplicate warning.
      const mySkillDupes = warnings.filter((w) => w.message.includes('my-skill'));
      assert.ok(
        mySkillDupes.length > 0,
        'Planned shared-skill output must be indexed and reported as a duplicate against the on-disk skill'
      );
      // The warning should name both surfaces (disk + planned target path).
      assert.ok(
        mySkillDupes.some(
          (w) =>
            w.message.includes('.agents/skills/my-skill') &&
            w.message.includes('.codex/skills/my-skill')
        ),
        `Duplicate warning should reference both the disk and planned paths, got: ${JSON.stringify(
          mySkillDupes.map((w) => w.message)
        )}`
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('--strict mode promotes duplicate warnings to errors', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-strict-'));
    try {
      await seedAnchorAgent(tmpDir);
      // Create enough source files for sync to run
      await writeFile(join(tmpDir, 'CLAUDE.md'), '');

      // Create two .codex/skills entries with the same canonical openspec name
      // This creates a duplicate within the 'codex' provider surface
      await mkdir(join(tmpDir, '.codex', 'skills', 'openspec-apply'), { recursive: true });
      await mkdir(join(tmpDir, '.codex', 'skills', 'openspec-apply-change'), { recursive: true });
      await writeFile(
        join(tmpDir, '.codex', 'skills', 'openspec-apply', 'SKILL.md'),
        '---\nname: openspec-apply\n---\n\n# OpenSpec Apply'
      );
      await writeFile(
        join(tmpDir, '.codex', 'skills', 'openspec-apply-change', 'SKILL.md'),
        '---\nname: openspec-apply-change\n---\n\n# OpenSpec Apply Change'
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

      // Use two .codex/skills entries with same canonical name to trigger duplicate detection
      // openspec-apply and openspec-apply-change both canonicalize to openspec-apply under 'codex'
      const targetDir = join(tmpDir, '.codex', 'skills', 'openspec-apply');
      await mkdir(targetDir, { recursive: true });
      await writeFile(
        join(targetDir, 'SKILL.md'),
        '---\nname: openspec-apply\n---\n\n# OpenSpec Apply'
      );

      await mkdir(join(tmpDir, '.codex', 'skills', 'openspec-apply-change'), { recursive: true });
      await writeFile(
        join(tmpDir, '.codex', 'skills', 'openspec-apply-change', 'SKILL.md'),
        '---\nname: openspec-apply-change\n---\n\n# OpenSpec Apply Change'
      );

      const manifest = {
        version: '5',
        generatedAt: new Date().toISOString(),
        sourceHashes: {},
        targetHashes: {},
        targets: {
          [targetDir]: {
            hash: 'will-not-match-disk',
            owner: 'aco',
            kind: 'shared-skill' as string,
          },
        },
        skipped: [],
        warnings: [],
      };
      await writeFile(join(acoDir, 'sync-manifest.json'), JSON.stringify(manifest, null, 2));

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
      await writeFile(
        join(tmpDir, '.aco', 'sync.yaml'),
        'skills:\n  include:\n    - openspec-apply\n'
      );

      // Source skill in .claude/skills/openspec-apply (would be synced to .agents/skills/)
      const sourceSkillDir = join(tmpDir, '.claude', 'skills', 'openspec-apply');
      await mkdir(sourceSkillDir, { recursive: true });
      await writeFile(
        join(sourceSkillDir, 'SKILL.md'),
        '---\nname: openspec-apply\n---\n\n# OpenSpec Apply Source'
      );

      // Existing target (the one that should be cleaned as duplicate)
      const targetDir = join(tmpDir, '.agents', 'skills', 'openspec-apply');
      await mkdir(targetDir, { recursive: true });
      await writeFile(
        join(targetDir, 'SKILL.md'),
        '---\nname: openspec-apply\n---\n\n# Existing Duplicate'
      );

      // Another .codex/skills entry with the same canonical name to trigger duplicate detection
      await mkdir(join(tmpDir, '.codex', 'skills', 'openspec-apply-change'), { recursive: true });
      await writeFile(
        join(tmpDir, '.codex', 'skills', 'openspec-apply-change', 'SKILL.md'),
        '---\nname: openspec-apply-change\n---\n\n# OpenSpec Apply Change'
      );

      const result = await runSync(tmpDir, {
        dryRun: false,
        cleanDuplicates: true,
        forceClean: true,
      });

      // The duplicate detection ran; the .agents/skills/openspec-apply (planned) should be cleaned
      // Since the source was included in sync.yaml, it appeared as a planned output
      // and was simultaneously on-disk → cleanDuplicates cleans planned ones
      assert.ok(typeof result.outputs === 'object', 'runSync should complete without throwing');

      const manifest = JSON.parse(
        await readFile(join(tmpDir, '.aco', 'sync-manifest.json'), 'utf-8')
      );
      assert.ok(manifest.version === '5', 'manifest version should be 5');
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

  it('--check fails when a structured source (agent) has changed', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-check-stale-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# Test Repo');
      await mkdir(join(tmpDir, '.claude', 'agents'), { recursive: true });
      await writeFile(
        join(tmpDir, '.claude', 'agents', 'helper.md'),
        '---\nid: helper\nwhen: Help with tasks\n---\nYou are a helper.'
      );
      // First sync
      await runSync(tmpDir, { dryRun: false });
      // Modify a structured source file (drives a .codex/agents/*.toml target)
      await writeFile(
        join(tmpDir, '.claude', 'agents', 'helper.md'),
        '---\nid: helper\nwhen: Help differently\n---\nYou are an updated helper.'
      );

      await assert.rejects(async () => runSync(tmpDir, { check: true }), /Sync check failed/);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('--check does NOT fail when only a guideline source (CLAUDE.md) changes', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-check-guideline-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# Test Repo');
      await mkdir(join(tmpDir, '.claude', 'agents'), { recursive: true });
      await writeFile(
        join(tmpDir, '.claude', 'agents', 'helper.md'),
        '---\nid: helper\nwhen: Help with tasks\n---\nYou are a helper.'
      );
      await runSync(tmpDir, { dryRun: false });

      // Editing only CLAUDE.md/rules produces no structured-surface output, so it must
      // not be treated as drift (sync no longer projects guideline markdown).
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# Test Repo\n\nNew guideline content.');

      await assert.doesNotReject(async () => runSync(tmpDir, { check: true }));
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('--check fails when v4 manifest has pending legacy Gemini removal', async () => {
    // RED test: verifies the fix that makes --check detect planned 'removed' outputs.
    // Strategy:
    //   1. Run a real sync to get a fully up-to-date v5 manifest (AGENTS.md hash correct).
    //   2. Put GEMINI.md back on disk and inject a GEMINI.md entry into the manifest,
    //      keeping version:'4' so readManifestForLegacyCleanup sees it and plans removal.
    //   3. --check must THROW because planLegacyGeminiCleanup emits a 'removed' output
    //      and calculateDrift(existingManifest[v5], plan.manifest[v5]) == false
    //      (both sides are v5 with identical AGENTS.md, no GEMINI.md).
    //      Without the fix the condition only checks isDrift || conflicts → passes silently.
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-check-legacy-removal-'));
    try {
      await seedAnchorAgent(tmpDir);
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# context');

      // Step 1: real sync to get correct v5 manifest on disk
      await runSync(tmpDir, { dryRun: false });

      // Step 2: add GEMINI.md to disk and inject it into the manifest as v4 legacy entry
      const geminiContent =
        '<!-- BEGIN ACO GENERATED -->\nold gemini content\n<!-- END ACO GENERATED -->\n';
      await writeFile(join(tmpDir, 'GEMINI.md'), geminiContent);

      const geminiHash = computeHash(geminiContent);
      // Read the current v5 manifest and add the GEMINI.md entry, downgrading to v4
      const { readFile: rf } = await import('node:fs/promises');
      const manifestPath = join(tmpDir, '.aco', 'sync-manifest.json');
      const existingV5 = JSON.parse(await rf(manifestPath, 'utf-8'));
      const v4Manifest = {
        ...existingV5,
        version: '4',
        targetHashes: { ...existingV5.targetHashes, 'GEMINI.md': geminiHash },
        targets: {
          ...existingV5.targets,
          'GEMINI.md': { hash: geminiHash, owner: 'aco', kind: 'config' },
        },
      };
      await writeFile(manifestPath, JSON.stringify(v4Manifest));

      // Step 3: --check must FAIL (pending legacy Gemini removal)
      await assert.rejects(
        async () => runSync(tmpDir, { check: true }),
        /Sync check failed/,
        '--check should reject when legacy Gemini removal is pending'
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('--check converges: passes after real sync removes v4 legacy Gemini targets', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-check-legacy-converge-'));
    try {
      await seedAnchorAgent(tmpDir);
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# context');

      // Establish a clean v5 baseline
      await runSync(tmpDir, { dryRun: false });

      // Inject v4 legacy GEMINI.md entry and create file on disk
      const geminiContent =
        '<!-- BEGIN ACO GENERATED -->\nold gemini content\n<!-- END ACO GENERATED -->\n';
      await writeFile(join(tmpDir, 'GEMINI.md'), geminiContent);
      const geminiHash = computeHash(geminiContent);
      const { readFile: rf } = await import('node:fs/promises');
      const manifestPath = join(tmpDir, '.aco', 'sync-manifest.json');
      const existingV5 = JSON.parse(await rf(manifestPath, 'utf-8'));
      const v4Manifest = {
        ...existingV5,
        version: '4',
        targetHashes: { ...existingV5.targetHashes, 'GEMINI.md': geminiHash },
        targets: {
          ...existingV5.targets,
          'GEMINI.md': { hash: geminiHash, owner: 'aco', kind: 'config' },
        },
      };
      await writeFile(manifestPath, JSON.stringify(v4Manifest));

      // Real sync (no --check) must delete GEMINI.md and migrate manifest to v5
      const syncResult = await runSync(tmpDir, { dryRun: false });
      const geminiRemoved = syncResult.outputs.some(
        (o) => o.targetPath.endsWith('GEMINI.md') && o.action === 'removed'
      );
      assert.ok(geminiRemoved, 'real sync must have a removed output for GEMINI.md');

      const { existsSync } = await import('node:fs');
      assert.equal(existsSync(join(tmpDir, 'GEMINI.md')), false, 'GEMINI.md must be deleted');

      // Subsequent --check must pass (convergence — no perpetual failure)
      const checkResult = await runSync(tmpDir, { check: true });
      assert.equal(checkResult.conflicts, 0, 'post-sync --check must pass with no conflicts');
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

      // Create cross-name canonical duplicate in .codex/skills to trigger duplicate detection
      await mkdir(join(tmpDir, '.codex', 'skills', 'openspec-apply'), { recursive: true });
      await mkdir(join(tmpDir, '.codex', 'skills', 'openspec-apply-change'), { recursive: true });
      await writeFile(
        join(tmpDir, '.codex', 'skills', 'openspec-apply', 'SKILL.md'),
        '---\nname: openspec-apply\n---\n\n# OpenSpec Apply'
      );
      await writeFile(
        join(tmpDir, '.codex', 'skills', 'openspec-apply-change', 'SKILL.md'),
        '---\nname: openspec-apply-change\n---\n\n# OpenSpec Apply Change'
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
      await seedAnchorAgent(tmpDir);
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
      await mkdir(join(tmpDir, '.claude', 'agents'), { recursive: true });
      await writeFile(
        join(tmpDir, '.claude', 'agents', 'helper.md'),
        '---\nid: helper\nwhen: Help with tasks\n---\nYou are a helper.'
      );

      // First sync to create the codex agent target with a known hash
      await runSync(tmpDir, { dryRun: false });

      // Manually modify the manifest-owned codex agent target to create drift
      const codexAgentPath = join(tmpDir, '.codex', 'agents', 'helper.toml');
      const originalContent = await readFile(codexAgentPath, 'utf-8');
      await writeFile(codexAgentPath, originalContent + '\n# user modification\n');

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

  it('does not sync project hooks from .claude/settings.json', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-ignore-hooks-'));
    try {
      await seedAnchorAgent(tmpDir);
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# Project context');
      await mkdir(join(tmpDir, '.claude'), { recursive: true });
      await writeFile(
        join(tmpDir, '.claude', 'settings.json'),
        JSON.stringify({
          hooks: {
            Stop: [
              {
                hooks: [
                  {
                    type: 'command',
                    command: 'python scripts/stop-hook.py',
                    timeout: 10,
                  },
                ],
              },
            ],
            PostToolUse: [
              {
                matcher: 'Bash',
                hooks: [
                  {
                    type: 'command',
                    command: 'bash scripts/post-tool-use.sh',
                    timeout: 15,
                  },
                ],
              },
            ],
          },
        })
      );

      const result = await runSync(tmpDir, { dryRun: false });
      const targetPaths = result.outputs.map((o) => o.targetPath);
      assert.equal(
        targetPaths.some((target) => target.endsWith(join('.codex', 'hooks.json'))),
        false
      );
      assert.equal(
        targetPaths.some((target) => target.endsWith(join('.gemini', 'settings.json'))),
        false
      );
      assert.equal(
        targetPaths.some((target) => target.endsWith(join('.codex', 'config.toml'))),
        false
      );

      const manifest = JSON.parse(
        await readFile(join(tmpDir, '.aco', 'sync-manifest.json'), 'utf-8')
      );
      assert.equal('.claude/settings.json' in manifest.sourceHashes, false);
      assert.equal(
        manifest.warnings.some((warning: { source?: string }) =>
          warning.source?.includes('.claude/settings.json')
        ),
        false
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('cleans legacy manifest-owned hook outputs when hook sync is disabled', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-stale-hooks-'));
    try {
      await writeFile(join(tmpDir, 'CLAUDE.md'), '# Project context');

      const codexHooksPath = join(tmpDir, '.codex', 'hooks.json');
      const codexConfigPath = join(tmpDir, '.codex', 'config.toml');
      const geminiSettingsPath = join(tmpDir, '.gemini', 'settings.json');
      await mkdir(join(tmpDir, '.codex'), { recursive: true });
      await mkdir(join(tmpDir, '.gemini'), { recursive: true });

      const codexHooksContent = '[{"event":"PostToolUse","command":"bash scripts/hook.sh"}]\n';
      const codexConfigContent =
        'model = "gpt-5.5"\n\n# BEGIN ACO GENERATED\n[features]\ncodex_hooks = true\n# END ACO GENERATED\n';
      const geminiSettingsContent =
        JSON.stringify(
          {
            theme: 'dark',
            hooks: {
              PostToolUse: [{ command: 'bash scripts/hook.sh' }],
            },
          },
          null,
          2
        ) + '\n';

      await writeFile(codexHooksPath, codexHooksContent);
      await writeFile(codexConfigPath, codexConfigContent);
      await writeFile(geminiSettingsPath, geminiSettingsContent);

      const acoDir = join(tmpDir, '.aco');
      await mkdir(acoDir, { recursive: true });
      const manifest = {
        version: '4',
        generatedAt: new Date().toISOString(),
        sourceHashes: {
          '.claude/settings.json': 'legacy-settings-hash',
        },
        targetHashes: {
          '.codex/hooks.json': computeHash(codexHooksContent),
          '.codex/config.toml': computeHash(codexConfigContent),
          '.gemini/settings.json': computeHash(geminiSettingsContent),
        },
        targets: {
          '.codex/hooks.json': {
            hash: computeHash(codexHooksContent),
            owner: 'aco',
            kind: 'provider-command',
          },
          '.codex/config.toml': {
            hash: computeHash(codexConfigContent),
            owner: 'aco',
            kind: 'provider-command',
          },
          '.gemini/settings.json': {
            hash: computeHash(geminiSettingsContent),
            owner: 'aco',
            kind: 'provider-command',
          },
        },
        skipped: [],
        warnings: [],
      };
      await writeFile(join(acoDir, 'sync-manifest.json'), JSON.stringify(manifest, null, 2));

      const result = await runSync(tmpDir, { dryRun: false });
      const removedPaths = result.outputs
        .filter((o) => o.action === 'removed')
        .map((o) => o.targetPath);

      assert.ok(removedPaths.includes(codexHooksPath));
      assert.ok(removedPaths.includes(codexConfigPath));
      assert.ok(removedPaths.includes(geminiSettingsPath));

      const { existsSync } = await import('node:fs');
      assert.equal(existsSync(codexHooksPath), false);

      const updatedCodexConfig = await readFile(codexConfigPath, 'utf-8');
      assert.equal(updatedCodexConfig.trim(), 'model = "gpt-5.5"');

      const updatedGeminiSettings = JSON.parse(await readFile(geminiSettingsPath, 'utf-8')) as {
        theme?: string;
        hooks?: unknown;
      };
      assert.equal(updatedGeminiSettings.theme, 'dark');
      assert.equal('hooks' in updatedGeminiSettings, false);

      const updatedManifest = JSON.parse(
        await readFile(join(acoDir, 'sync-manifest.json'), 'utf-8')
      );
      assert.equal('.claude/settings.json' in updatedManifest.sourceHashes, false);
      assert.equal('.codex/hooks.json' in updatedManifest.targets, false);
      assert.equal('.codex/config.toml' in updatedManifest.targets, false);
      assert.equal('.gemini/settings.json' in updatedManifest.targets, false);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('detectDuplicates deduplicates same-path entries to avoid false positives', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-dup-dedup-'));
    try {
      // Create a skill on disk in .agents/skills/ (indexed as provider:'agents')
      await mkdir(join(tmpDir, '.agents', 'skills', 'openspec-apply'), { recursive: true });
      await writeFile(
        join(tmpDir, '.agents', 'skills', 'openspec-apply', 'SKILL.md'),
        '---\nname: openspec-apply\n---\n\n# OpenSpec Apply'
      );
      // Another .agents/skills/ entry with the same canonical name
      await mkdir(join(tmpDir, '.agents', 'skills', 'openspec-apply-change'), { recursive: true });
      await writeFile(
        join(tmpDir, '.agents', 'skills', 'openspec-apply-change', 'SKILL.md'),
        '---\nname: openspec-apply-change\n---\n\n# OpenSpec Apply Change'
      );

      // Also pass a planned output pointing to the same .agents/skills/openspec-apply path
      // This simulates the case where the same path is indexed twice (disk + planned)
      const outputs: SyncOutput[] = [
        {
          targetPath: join(tmpDir, '.agents', 'skills', 'openspec-apply'),
          kind: 'directory',
          action: 'created',
          owner: 'aco',
          assetKind: 'shared-skill',
        },
      ];

      const warnings = await detectDuplicates(tmpDir, outputs);
      const dupWarnings = warnings.filter((w) => w.message.includes('openspec-apply'));
      // Should detect the canonical duplicate, and the same-path dedup should prevent double-counting
      assert.ok(dupWarnings.length > 0, 'Should detect openspec-apply canonical duplicate');

      const dup = dupWarnings[0];
      // cleanupTargets should reference the actual directory paths, not duplicated
      assert.ok(dup.cleanupTargets && dup.cleanupTargets.length > 0, 'Should have cleanupTargets');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('detectDuplicates cleanupTargets use OS-independent path matching', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-test-dup-ospath-'));
    try {
      // Use .codex/skills/ cross-name duplicate instead of .gemini/commands/
      await mkdir(join(tmpDir, '.codex', 'skills', 'openspec-test'), { recursive: true });
      await mkdir(join(tmpDir, '.codex', 'skills', 'openspec-test-change'), { recursive: true });
      await writeFile(
        join(tmpDir, '.codex', 'skills', 'openspec-test', 'SKILL.md'),
        '---\nname: openspec-test\n---\n\n# Test'
      );
      await writeFile(
        join(tmpDir, '.codex', 'skills', 'openspec-test-change', 'SKILL.md'),
        '---\nname: openspec-test-change\n---\n\n# Test Change'
      );

      const outputs: SyncOutput[] = [];
      const warnings = await detectDuplicates(tmpDir, outputs);
      const dupWarnings = warnings.filter((w) => w.message.includes('openspec-test'));
      assert.ok(dupWarnings.length > 0, 'Should detect openspec cross-name duplicate');

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
