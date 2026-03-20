#!/usr/bin/env node

/**
 * AI CLI Orchestration Wrapper
 *
 * CLI entry point for registry commands.
 */

import {
  registrySync,
  registrySearch,
  registryInstall,
  registryLock,
  registryAdd,
} from './commands/registry.js';
import type { Channel } from './registry/types.js';

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

async function main(): Promise<void> {
  if (command === 'registry' || command === 'reg') {
    switch (subcommand) {
      case 'sync':
        await registrySync({
          hub: getArg('--hub'),
          verbose: hasFlag('--verbose', '-v'),
        });
        break;

      case 'search':
        const query = args[2];
        if (!query) {
          console.error('Usage: wrapper registry search <query> [--type skill|cao-profile|reprogate] [--channel stable|experimental]');
          process.exit(1);
        }
        await registrySearch(query, {
          type: getArg('--type'),
          channel: getArg('--channel') as Channel | undefined,
          refresh: hasFlag('--refresh'),
        });
        break;

      case 'install':
        const idOrName = args[2];
        if (!idOrName) {
          console.error('Usage: wrapper registry install <canonical-id|name> [--dry-run] [--force]');
          process.exit(1);
        }
        await registryInstall(idOrName, {
          dryRun: hasFlag('--dry-run'),
          force: hasFlag('--force'),
        });
        break;

      case 'lock':
        await registryLock({
          generate: hasFlag('--generate'),
          show: hasFlag('--show'),
        });
        break;

      case 'add':
        const source = args[2];
        if (!source) {
          console.error('Usage: wrapper registry add <github:org/repo|url>');
          process.exit(1);
        }
        await registryAdd(source);
        break;

      default:
        printRegistryHelp();
        break;
    }
  } else if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
  } else if (command === 'version' || command === '--version' || command === '-V') {
    console.log('ai-cli-orch-wrapper v0.1.0');
  } else {
    printHelp();
  }
}

function printHelp(): void {
  console.log(`
ai-cli-orch-wrapper - AI CLI Orchestration Wrapper

Usage: wrapper <command> [options]

Commands:
  registry, reg    Registry management commands
  help             Show this help
  version          Show version

Run 'wrapper registry' for registry subcommands.
`);
}

function printRegistryHelp(): void {
  console.log(`
Registry Commands:

  wrapper registry add <source>
    Add a hub source (github:org/repo or full URL)
    Example: wrapper registry add github:skillinterop/registry-hub

  wrapper registry sync [--hub <url>]
    Sync registry index from hub

  wrapper registry search <query> [options]
    Search for items
    Options:
      --type <type>       Filter by registry type (skill, cao-profile, reprogate)
      --channel <channel> Filter by channel (stable, experimental)
      --refresh           Force refresh from remote

  wrapper registry install <id|name> [options]
    Install an item
    Options:
      --dry-run    Preview without installing
      --force      Install even if deprecated

  wrapper registry lock [options]
    Manage lock file
    Options:
      --show       Display current lock file
      --generate   Regenerate lock file
`);
}

function getArg(name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1 || index + 1 >= args.length) {
    return undefined;
  }
  return args[index + 1];
}

function hasFlag(...names: string[]): boolean {
  return names.some(name => args.includes(name));
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
