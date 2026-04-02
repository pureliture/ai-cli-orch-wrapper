"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.packInstall = packInstall;
exports.packUninstall = packUninstall;
exports.packStatus = packStatus;
exports.packSetup = packSetup;
exports.providerSetup = providerSetup;
const promises_1 = require("node:fs/promises");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_os_1 = require("node:os");
const wrapper_1 = require("@aco/wrapper");
const TEMPLATES_DIR = (0, node_path_1.resolve)(__dirname, '..', '..', '..', 'templates');
async function packInstall(options = {}) {
    const targetBase = options.global ? (0, node_path_1.join)((0, node_os_1.homedir)(), '.claude') : (0, node_path_1.join)(process.cwd(), '.claude');
    const commandsSrc = (0, node_path_1.join)(TEMPLATES_DIR, 'commands');
    const promptsSrc = (0, node_path_1.join)(TEMPLATES_DIR, 'prompts');
    const commandsDest = (0, node_path_1.join)(targetBase, 'commands');
    const promptsDest = (0, node_path_1.join)(targetBase, 'aco', 'prompts');
    console.log(`Installing aco command pack to ${targetBase} …\n`);
    await copyTree(commandsSrc, commandsDest, options.force ?? false, 'command');
    await copyTree(promptsSrc, promptsDest, options.force ?? false, 'prompt template');
    const binaryName = options.binaryName ?? 'aco';
    await placeWrapperBinary(targetBase, binaryName);
    console.log(`\n✓ Pack installed. Run 'aco pack setup' to verify provider readiness.`);
}
async function packUninstall(options = {}) {
    const targetBase = options.global ? (0, node_path_1.join)((0, node_os_1.homedir)(), '.claude') : (0, node_path_1.join)(process.cwd(), '.claude');
    const commandsDest = (0, node_path_1.join)(targetBase, 'commands');
    const promptsDest = (0, node_path_1.join)(targetBase, 'aco', 'prompts');
    console.log('Uninstalling aco command pack …');
    for (const dir of [commandsDest, promptsDest]) {
        if ((0, node_fs_1.existsSync)(dir)) {
            await (0, promises_1.rm)(dir, { recursive: true, force: true });
            console.log(`  removed ${dir}`);
        }
    }
    console.log('✓ Pack uninstalled.');
}
async function packStatus(options = {}) {
    const targetBase = options.global ? (0, node_path_1.join)((0, node_os_1.homedir)(), '.claude') : (0, node_path_1.join)(process.cwd(), '.claude');
    const commandsDest = (0, node_path_1.join)(targetBase, 'commands');
    console.log('aco pack status\n');
    console.log(`Target: ${targetBase}`);
    // List installed commands
    const installedFiles = [];
    if ((0, node_fs_1.existsSync)(commandsDest)) {
        await collectFiles(commandsDest, installedFiles);
    }
    if (installedFiles.length === 0) {
        console.log('Commands: (none installed)');
    }
    else {
        console.log('Commands:');
        for (const f of installedFiles) {
            const rel = f.replace(commandsDest + '/', '');
            console.log(`  /${rel.replace(/\.md$/, '').replace('/', ':')}`);
        }
    }
    // Per-provider status
    console.log('\nProviders:');
    for (const key of wrapper_1.providerRegistry.keys()) {
        const provider = wrapper_1.providerRegistry.get(key);
        const available = provider.isAvailable();
        const auth = available ? await provider.checkAuth() : { ok: false, hint: provider.installHint };
        const avIcon = available ? '✓' : '✗';
        const authIcon = auth.ok ? '✓' : '✗';
        console.log(`  ${key}: installed ${avIcon}  auth ${authIcon}${auth.ok ? '' : `  → ${auth.hint}`}`);
    }
}
async function packSetup(options = {}) {
    await packInstall(options);
    console.log('\n--- Provider Status ---');
    for (const key of wrapper_1.providerRegistry.keys()) {
        const provider = wrapper_1.providerRegistry.get(key);
        const available = provider.isAvailable();
        if (!available) {
            console.log(`  ${key}: not installed  → run: aco provider setup ${key}`);
        }
        else {
            console.log(`  ${key}: installed ✓`);
        }
    }
    console.log('\nNext step: aco provider setup <gemini|copilot>');
}
async function providerSetup(name) {
    const provider = wrapper_1.providerRegistry.get(name);
    if (!provider) {
        console.error(`Unknown provider: ${name}`);
        console.error(`Available: ${wrapper_1.providerRegistry.keys().join(', ')}`);
        process.exit(1);
    }
    const available = provider.isAvailable();
    if (!available) {
        console.error(`${name}: not installed ✗`);
        console.error(`  Install: ${provider.installHint}`);
        process.exit(1);
    }
    const auth = await provider.checkAuth();
    if (!auth.ok) {
        console.error(`${name}: installed ✓  auth ✗`);
        console.error(`  Fix: ${auth.hint}`);
        process.exit(1);
    }
    console.log(`${name}: installed ✓  auth: ok ✓`);
}
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
async function copyTree(src, dest, force, kind) {
    if (!(0, node_fs_1.existsSync)(src)) {
        console.warn(`  [warn] template source not found: ${src}`);
        return;
    }
    const files = [];
    await collectFiles(src, files);
    for (const srcFile of files) {
        const rel = srcFile.slice(src.length + 1);
        const destFile = (0, node_path_1.join)(dest, rel);
        if (!force && (0, node_fs_1.existsSync)(destFile)) {
            console.warn(`  [skip] ${destFile} already exists (use --force to overwrite)`);
            continue;
        }
        await (0, promises_1.cp)(srcFile, destFile, { recursive: false, force: true });
        console.log(`  copied ${kind}: ${destFile}`);
    }
}
async function collectFiles(dir, out) {
    if (!(0, node_fs_1.existsSync)(dir))
        return;
    const entries = await (0, promises_1.readdir)(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = (0, node_path_1.join)(dir, entry.name);
        if (entry.isDirectory()) {
            await collectFiles(full, out);
        }
        else {
            out.push(full);
        }
    }
}
async function placeWrapperBinary(targetBase, binaryName) {
    // The wrapper bin is handled via npm workspace linking; just inform the user.
    console.log(`  binary: '${binaryName}' available via npm workspace (run 'npm link packages/wrapper' if not in PATH)`);
}
//# sourceMappingURL=pack-install.js.map