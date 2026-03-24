#!/usr/bin/env node

/**
 * AI CLI Orchestration Wrapper
 *
 * CLI entry point — dispatches to command handlers.
 */

import { setupCommand } from './commands/setup.js';

const args = process.argv.slice(2);
const command = args[0];

async function main(): Promise<void> {
  if (command === 'setup') {
    await setupCommand();
  } else if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
  } else if (command === 'version' || command === '--version' || command === '-V') {
    console.log('ai-cli-orch-wrapper v0.2.0');
  } else {
    printHelp();
  }
}

function printHelp(): void {
  console.log(`
ai-cli-orch-wrapper - AI CLI orchestration environment setup

Usage: wrapper <command>

Commands:
  setup    Bootstrap the AI CLI orchestration environment
  help     Show this help
  version  Show version
`);
}

main().catch(error => {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
