#!/usr/bin/env tsx
/**
 * Generate `templates/skills/` from `.claude/skills/` using the context-sync
 * allowlist (`.aco/sync.yaml` `skills.include`) as the single source of which
 * skills are distributable via `aco pack install --global`.
 *
 * `.claude/skills/` is the source of truth; `templates/skills/` is a derived,
 * committed artifact. CI re-runs this generator and fails on `git diff` drift
 * (`npm run check:skill-templates`), giving both content parity and selection
 * parity with the sync allowlist for free.
 *
 * Run: `npm run build:skill-templates`
 */
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSyncConfig } from '../packages/wrapper/src/sync/sync-config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

async function main(): Promise<void> {
  const config = await loadSyncConfig(repoRoot);
  const include = config.skills?.include ?? [];

  const skillsSrcRoot = path.join(repoRoot, '.claude', 'skills');
  const skillsDestRoot = path.join(repoRoot, 'templates', 'skills');

  // Clean-regenerate so de-listed or renamed skills never linger. Deterministic
  // output is what lets the CI `git diff` parity gate work.
  await rm(skillsDestRoot, { recursive: true, force: true });

  const copied: string[] = [];
  const missing: string[] = [];
  const invalid: string[] = [];

  // Skill names become path segments under both `.claude/skills/` and
  // `templates/skills/`. Even though `.aco/sync.yaml` is maintainer-controlled,
  // validate each entry as a single safe segment so a stray `../` or absolute
  // path can never let the generator read or write outside those roots.
  const SAFE_SKILL_NAME = /^[a-z0-9][a-z0-9._-]*$/;

  for (const name of include) {
    if (!SAFE_SKILL_NAME.test(name) || name.includes('..')) {
      invalid.push(name);
      continue;
    }
    const src = path.join(skillsSrcRoot, name);
    if (!existsSync(src)) {
      missing.push(name);
      continue;
    }
    const dest = path.join(skillsDestRoot, name);
    await mkdir(path.dirname(dest), { recursive: true });
    await cp(src, dest, { recursive: true });
    copied.push(name);
  }

  if (invalid.length > 0) {
    console.error(
      `build-skill-templates: refusing unsafe skill name(s) in .aco/sync.yaml include: ${invalid.join(', ')}`
    );
    process.exitCode = 1;
  }

  console.log(
    `build-skill-templates: copied ${copied.length} skill(s): ${copied.join(', ') || '(none)'}`
  );
  if (missing.length > 0) {
    console.warn(
      `build-skill-templates: [warn] include entries not found under .claude/skills: ${missing.join(', ')}`
    );
  }
  if (copied.length === 0) {
    console.warn(
      'build-skill-templates: [warn] no distributable skills resolved; templates/skills left empty'
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
