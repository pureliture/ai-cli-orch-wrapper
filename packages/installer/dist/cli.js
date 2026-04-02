#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_process_1 = __importDefault(require("node:process"));
const MIN_NODE = '18.0.0';
checkNodeVersion();
const pack_install_js_1 = require("./commands/pack-install.js");
async function main() {
    const [, , group, subOrName, ...rest] = node_process_1.default.argv;
    // npx aco-install  → shorthand for pack setup
    if (!group) {
        await (0, pack_install_js_1.packSetup)({});
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
                await (0, pack_install_js_1.packInstall)({ global: isGlobal, force, binaryName });
                break;
            }
            case 'uninstall': {
                const isGlobal = rest.includes('--global');
                await (0, pack_install_js_1.packUninstall)({ global: isGlobal });
                break;
            }
            case 'status': {
                const isGlobal = rest.includes('--global');
                await (0, pack_install_js_1.packStatus)({ global: isGlobal });
                break;
            }
            case 'setup': {
                const isGlobal = rest.includes('--global');
                const force = rest.includes('--force');
                await (0, pack_install_js_1.packSetup)({ global: isGlobal, force });
                break;
            }
            default:
                console.error(`Unknown pack sub-command: ${sub ?? ''}`);
                printUsage();
                node_process_1.default.exit(1);
        }
        return;
    }
    if (group === 'provider') {
        const name = subOrName;
        if (!name) {
            console.error('Usage: aco provider setup <name>');
            node_process_1.default.exit(1);
        }
        if (name === 'setup') {
            // aco provider setup <name>
            const providerName = rest[0];
            if (!providerName) {
                console.error('Usage: aco provider setup <name>');
                node_process_1.default.exit(1);
            }
            await (0, pack_install_js_1.providerSetup)(providerName);
        }
        else {
            console.error(`Unknown provider sub-command: ${name}`);
            node_process_1.default.exit(1);
        }
        return;
    }
    console.error(`Unknown command: ${group}`);
    printUsage();
    node_process_1.default.exit(1);
}
function checkNodeVersion() {
    const [major, minor] = node_process_1.default.versions.node.split('.').map(Number);
    const [reqMajor, reqMinor] = MIN_NODE.split('.').map(Number);
    if (major < reqMajor || (major === reqMajor && minor < reqMinor)) {
        console.error(`aco-install requires Node.js >= ${MIN_NODE} (current: ${node_process_1.default.versions.node})`);
        node_process_1.default.exit(1);
    }
}
function printUsage() {
    console.log(`
Usage:
  aco-install                    — shorthand for 'aco pack setup'
  aco pack install [--global] [--force] [--binary-name <name>]
  aco pack uninstall [--global]
  aco pack status [--global]
  aco pack setup [--global] [--force]
  aco provider setup <gemini|copilot>
`);
}
main().catch((err) => {
    console.error(err);
    node_process_1.default.exit(1);
});
//# sourceMappingURL=cli.js.map