#!/usr/bin/env node
import process from 'node:process';

const MIN_NODE = '18.0.0';
const EXIT_ERROR = 1;
checkNodeVersion();

import {
  packInstall,
  packUninstall,
  packStatus,
  packSetup,
  providerSetup,
} from './commands/pack-install.js';

async function main(): Promise<void> {
  const [, , group, subOrName, ...rest] = process.argv;

  // npx aco-install  → shorthand for pack setup
  if (!group) {
    await packSetup({});
    return;
  }

  if (group === 'pack') {
    const sub = subOrName;
    switch (sub) {
      case 'install': {
        const isGlobal = rest.includes('--global');
        const force = rest.includes('--force');
        const bnIdx = rest.indexOf('--binary-name');
        const binaryName = bnIdx !== -1 ? rest[bnIdx + 1] : undefined;
        await packInstall({ global: isGlobal, force, binaryName });
        break;
      }
      case 'uninstall': {
        const isGlobal = rest.includes('--global');
        await packUninstall({ global: isGlobal });
        break;
      }
      case 'status': {
        const isGlobal = rest.includes('--global');
        await packStatus({ global: isGlobal });
        break;
      }
      case 'setup': {
        const isGlobal = rest.includes('--global');
        const force = rest.includes('--force');
        await packSetup({ global: isGlobal, force });
        break;
      }
      default:
        console.error(`Unknown pack sub-command: ${sub ?? ''}`);
        printUsage();
        process.exit(EXIT_ERROR);
    }
    return;
  }

  if (group === 'provider') {
    const name = subOrName;
    if (!name) {
      console.error('Usage: aco-install provider setup <name>');
      process.exit(EXIT_ERROR);
    }
    if (name === 'setup') {
      // aco-install provider setup <name>
      const providerName = rest[0];
      if (!providerName) {
        console.error('Usage: aco-install provider setup <name>');
        process.exit(EXIT_ERROR);
      }
      await providerSetup(providerName);
    } else {
      console.error(`Unknown provider sub-command: ${name}`);
      process.exit(EXIT_ERROR);
    }
    return;
  }

  console.error(`Unknown command: ${group}`);
  printUsage();
  process.exit(EXIT_ERROR);
}

function checkNodeVersion(): void {
  const [major, minor] = process.versions.node.split('.').map(Number);
  const [reqMajor, reqMinor] = MIN_NODE.split('.').map(Number);
  if (major < reqMajor || (major === reqMajor && minor < reqMinor)) {
    console.error(
      `@pureliture/aco-install requires Node.js >= ${MIN_NODE} (current: ${process.versions.node})`
    );
    process.exit(EXIT_ERROR);
  }
}

function printUsage(): void {
  console.log(`
Usage:
  aco-install                    — shorthand for 'aco-install pack setup'
  aco-install pack install [--global] [--force] [--binary-name <name>]
  aco-install pack uninstall [--global]
  aco-install pack status [--global]
  aco-install pack setup [--global] [--force]
  aco-install provider setup <gemini|copilot>
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(EXIT_ERROR);
});
