#!/usr/bin/env node

/**
 * AI CLI Orchestration Wrapper
 *
 * CLI entry point — dispatches to command handlers.
 */

import { setupCommand } from './commands/setup.js';
import { aliasCommand } from './commands/alias.js';
import { workflowCommand } from './commands/workflow.js';
import { workflowRunCommand } from './commands/workflow-run.js';
import { formatHelp, formatUnknownCommand, formatVersionLine } from './cli-surface.js';
import { readWrapperConfig } from './config/wrapper-config.js';

const args = process.argv.slice(2);
const command = args[0];

async function main(): Promise<void> {
  const config = readWrapperConfig();

  if (command === 'setup') {
    await setupCommand();
  } else if (command === 'help' || command === '--help' || command === '-h') {
    console.log(formatHelp(config));
  } else if (command === 'version' || command === '--version' || command === '-V') {
    console.log(formatVersionLine());
  } else if (command === 'workflow') {
    await workflowCommand(args.slice(1));
  } else if (command === 'workflow-run') {
    await workflowRunCommand(args.slice(1));
  } else if (command && config.aliases[command]) {
    await aliasCommand(command, config.aliases[command], args.slice(1));
  } else {
    console.error(formatUnknownCommand(command));
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
