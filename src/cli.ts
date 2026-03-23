#!/usr/bin/env node

/**
 * AI CLI Orchestration Wrapper
 *
 * CLI entry point for the download command.
 */

import { downloadCommand } from './commands/download.js';

const args = process.argv.slice(2);
const command = args[0];

async function main(): Promise<void> {
  if (command === 'download') {
    const url = args[1];
    if (!url) {
      console.error('Usage: wrapper download <url>');
      process.exit(1);
    }
    await downloadCommand(url);
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
ai-cli-orch-wrapper - AI CLI Orchestration Wrapper

Usage: wrapper <command> [options]

Commands:
  download <url>   Download a file from a URL
  help             Show this help
  version          Show version
`);
}

main().catch(error => {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
