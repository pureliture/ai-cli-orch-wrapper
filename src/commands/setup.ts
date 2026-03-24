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
const TMUX_CONF = join(homedir(), '.tmux.conf');
const AI_CLI_CONF_DIR = join(homedir(), '.config', 'tmux');
const AI_CLI_CONF = join(AI_CLI_CONF_DIR, 'ai-cli.conf');
const SOURCE_LINE = `source-file ${AI_CLI_CONF}`;

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
  // Step 1: Prerequisite check (per D-04, D-05, D-06)
  const missing = REQUIRED_TOOLS.filter(t => !isOnPath(t));
  if (missing.length > 0) {
    console.error(`Error: missing prerequisites: ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log('✓ prerequisites: cao, tmux, workmux found');

  // Step 2: Write ~/.config/tmux/ai-cli.conf (per D-07, D-08)
  if (existsSync(AI_CLI_CONF)) {
    console.log('✓ ~/.config/tmux/ai-cli.conf: already exists');
  } else {
    mkdirSync(AI_CLI_CONF_DIR, { recursive: true });
    writeFileSync(AI_CLI_CONF, AI_CLI_CONF_CONTENT, 'utf8');
    console.log('✓ ~/.config/tmux/ai-cli.conf written');
  }

  // Step 3: Inject source-file line into ~/.tmux.conf (per D-07, D-09)
  if (!existsSync(TMUX_CONF)) {
    writeFileSync(TMUX_CONF, SOURCE_LINE + '\n', 'utf8');
    console.log('✓ ~/.tmux.conf: source line added');
  } else {
    const content = readFileSync(TMUX_CONF, 'utf8');
    if (content.includes(AI_CLI_CONF)) {
      console.log('✓ ~/.tmux.conf: already configured');
    } else {
      appendFileSync(TMUX_CONF, '\n' + SOURCE_LINE + '\n', 'utf8');
      console.log('✓ ~/.tmux.conf: source line added');
    }
  }

  console.log('Setup complete.');
}
