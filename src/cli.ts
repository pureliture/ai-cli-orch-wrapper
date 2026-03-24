#!/usr/bin/env node

/**
 * AI CLI Orchestration Wrapper
 *
 * CLI entry point — dispatches to command handlers.
 */

import { setupCommand } from './commands/setup.js';
import { aliasCommand } from './commands/alias.js';
import { readWrapperConfig } from './config/wrapper-config.js';
import type { WrapperConfig } from './config/wrapper-config.js';

const args = process.argv.slice(2);
const command = args[0];

async function main(): Promise<void> {
  const config = readWrapperConfig();

  if (command === 'setup') {
    await setupCommand();
  } else if (command === 'help' || command === '--help' || command === '-h') {
    printHelp(config);
  } else if (command === 'version' || command === '--version' || command === '-V') {
    console.log('ai-cli-orch-wrapper v0.3.0');
  } else if (command && config.aliases[command]) {
    await aliasCommand(command, config.aliases[command], args.slice(1));
  } else {
    console.error(`Error: unknown command '${command}'`);
    printHelp(config);
    process.exit(1);
  }
}

function printHelp(config: WrapperConfig): void {
  const aliasLines = Object.keys(config.aliases)
    .map(name => `  ${name.padEnd(8)} Launch ${config.aliases[name].provider} via cao`)
    .join('\n');
  console.log(`
ai-cli-orch-wrapper - AI CLI orchestration environment setup

Usage: wrapper <command>

Commands:
  setup    Bootstrap the AI CLI orchestration environment
  help     Show this help
  version  Show version
${aliasLines ? '\nAliases:\n' + aliasLines : ''}
`);
}

main().catch(error => {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
