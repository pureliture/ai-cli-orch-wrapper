/**
 * Setup command
 *
 * Bootstraps the AI CLI orchestration environment on any machine.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const REQUIRED_TOOLS = ['cao', 'tmux', 'workmux'];

const AI_CLI_CONF_CONTENT = [
  '# ai-cli-orch-wrapper tmux config',
  '# Managed by wrapper setup — do not edit manually.',
  '# Phase 2 will populate CLI alias bindings here.',
  '',
].join('\n');

function isOnPath(tool: string): boolean {
  const result = spawnSync('which', [tool], { encoding: 'utf8' });
  return result.status === 0;
}

export async function setupCommand(): Promise<void> {
  // Resolve home-directory paths at call time so process.env.HOME overrides work in tests
  const home = homedir();
  const tmuxConf = join(home, '.tmux.conf');
  const aiCliConfDir = join(home, '.config', 'tmux');
  const aiCliConf = join(aiCliConfDir, 'ai-cli.conf');
  const sourceLine = `source-file ${aiCliConf}`;

  // Step 1: Prerequisite check (per D-04, D-05, D-06)
  const missing = REQUIRED_TOOLS.filter(t => !isOnPath(t));
  if (missing.length > 0) {
    console.error(`Error: missing prerequisites: ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log('✓ prerequisites: cao, tmux, workmux found');

  // Step 2: Write ~/.config/tmux/ai-cli.conf (per D-07, D-08)
  if (existsSync(aiCliConf)) {
    console.log('✓ ~/.config/tmux/ai-cli.conf: already exists');
  } else {
    mkdirSync(aiCliConfDir, { recursive: true });
    writeFileSync(aiCliConf, AI_CLI_CONF_CONTENT, 'utf8');
    console.log('✓ ~/.config/tmux/ai-cli.conf written');
  }

  // Step 3: Inject source-file line into ~/.tmux.conf (per D-07, D-09)
  if (!existsSync(tmuxConf)) {
    writeFileSync(tmuxConf, sourceLine + '\n', 'utf8');
    console.log('✓ ~/.tmux.conf: source line added');
  } else {
    const content = readFileSync(tmuxConf, 'utf8');
    if (content.includes(aiCliConf)) {
      console.log('✓ ~/.tmux.conf: already configured');
    } else {
      appendFileSync(tmuxConf, '\n' + sourceLine + '\n', 'utf8');
      console.log('✓ ~/.tmux.conf: source line added');
    }
  }

  console.log('Setup complete.');
}
