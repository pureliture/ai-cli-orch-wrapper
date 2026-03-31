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
  '# Managed by aco setup — do not edit manually.',
  '# CLI alias bindings are managed via .wrapper.json in the project root.',
  '',
].join('\n');

const WRAPPER_CONFIG_FILE = '.wrapper.json';

const DEFAULT_WRAPPER_CONFIG =
  JSON.stringify(
    {
      aliases: {
        claude: { provider: 'claude_code', agent: 'developer' },
        gemini: { provider: 'gemini_cli', agent: 'developer' },
        codex: { provider: 'codex', agent: 'developer' },
      },
      roles: {
        orchestrator: 'claude_code',
        reviewer: 'gemini_cli',
      },
    },
    null,
    2,
  ) + '\n';

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

  // Step 4: Scaffold .wrapper.json if not present (per D-07, D-08 — idempotent)
  const wrapperConfigPath = join(process.cwd(), WRAPPER_CONFIG_FILE);
  if (existsSync(wrapperConfigPath)) {
    console.log('✓ .wrapper.json: already exists');
  } else {
    writeFileSync(wrapperConfigPath, DEFAULT_WRAPPER_CONFIG, 'utf8');
    console.log('✓ .wrapper.json: created with default aliases');
  }

  console.log('Setup complete.');
}
