#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_process_1 = __importDefault(require("node:process"));
const registry_js_1 = require("./providers/registry.js");
const store_js_1 = require("./session/store.js");
const VERSION = '0.4.0';
async function main() {
    const [, , subcommand, ...rest] = node_process_1.default.argv;
    switch (subcommand) {
        case '--version':
        case '-v':
            console.log(`aco ${VERSION}`);
            break;
        case 'run':
            await cmdRun(rest);
            break;
        case 'result':
            await cmdResult(rest);
            break;
        case 'status':
            await cmdStatus(rest);
            break;
        case 'cancel':
            await cmdCancel(rest);
            break;
        default:
            console.error(`aco: unknown command '${subcommand ?? ''}'`);
            console.error('Usage: aco <run|result|status|cancel> [options]');
            node_process_1.default.exit(1);
    }
}
// ---------------------------------------------------------------------------
// aco run <provider> <command> [--input <text>] [--permission-profile <profile>]
// ---------------------------------------------------------------------------
async function cmdRun(args) {
    const providerKey = args[0];
    const command = args[1];
    if (!providerKey || !command) {
        console.error('Usage: aco run <provider> <command> [--input <text>] [--permission-profile default|restricted|unrestricted]');
        node_process_1.default.exit(1);
    }
    const provider = registry_js_1.providerRegistry.get(providerKey);
    if (!provider) {
        console.error(`Unknown provider: ${providerKey}`);
        node_process_1.default.exit(1);
    }
    const permissionProfile = parseFlag(args, '--permission-profile') ?? 'default';
    const inputFlag = parseFlag(args, '--input') ?? '';
    // Read stdin if not a TTY and no --input flag
    let content = inputFlag;
    if (!content && !node_process_1.default.stdin.isTTY) {
        const chunks = [];
        for await (const chunk of node_process_1.default.stdin)
            chunks.push(chunk);
        content = Buffer.concat(chunks).toString();
    }
    // Load prompt from prompt template directory if available
    const promptPath = (0, node_path_1.join)(node_process_1.default.cwd(), '.claude', 'aco', 'prompts', providerKey, `${command}.md`);
    let prompt = `You are a code reviewer. Perform a ${command} for the following content.`;
    if ((0, node_fs_1.existsSync)(promptPath)) {
        prompt = await (0, promises_1.readFile)(promptPath, 'utf8');
    }
    const session = await store_js_1.sessionStore.create(providerKey, command, undefined, permissionProfile);
    try {
        const outputLogPath = store_js_1.sessionStore.outputLogPath(session.id);
        let hasOutput = false;
        for await (const chunk of provider.invoke(prompt, content, { permissionProfile, sessionId: session.id })) {
            node_process_1.default.stdout.write(chunk);
            await (0, promises_1.appendFile)(outputLogPath, chunk);
            hasOutput = true;
        }
        if (!hasOutput && permissionProfile === 'restricted') {
            await (0, promises_1.appendFile)(store_js_1.sessionStore.errorLogPath(session.id), 'Permission profile: restricted — output may be blocked\n');
        }
        await store_js_1.sessionStore.markDone(session.id);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await (0, promises_1.appendFile)(store_js_1.sessionStore.errorLogPath(session.id), msg + '\n');
        await store_js_1.sessionStore.markFailed(session.id);
        console.error(`Error: ${msg}`);
        node_process_1.default.exit(1);
    }
}
// ---------------------------------------------------------------------------
// aco result [--session <id>]
// ---------------------------------------------------------------------------
async function cmdResult(args) {
    const sessionId = parseFlag(args, '--session') ?? store_js_1.sessionStore.latestId();
    if (!sessionId) {
        console.error('No sessions found.');
        node_process_1.default.exit(1);
    }
    const logPath = store_js_1.sessionStore.outputLogPath(sessionId);
    if (!(0, node_fs_1.existsSync)(logPath)) {
        console.error(`No output log found for session ${sessionId}`);
        node_process_1.default.exit(1);
    }
    const output = await (0, promises_1.readFile)(logPath, 'utf8');
    node_process_1.default.stdout.write(output);
}
// ---------------------------------------------------------------------------
// aco status [--session <id>]
// ---------------------------------------------------------------------------
async function cmdStatus(args) {
    const sessionId = parseFlag(args, '--session') ?? store_js_1.sessionStore.latestId();
    if (!sessionId) {
        console.error('No sessions found.');
        node_process_1.default.exit(1);
    }
    try {
        const record = await store_js_1.sessionStore.read(sessionId);
        console.log(`Session:    ${record.id}`);
        console.log(`Provider:   ${record.provider}`);
        console.log(`Command:    ${record.command}`);
        console.log(`Status:     ${record.status}`);
        console.log(`Started:    ${record.startedAt}`);
        if (record.endedAt)
            console.log(`Ended:      ${record.endedAt}`);
        if (record.permissionProfile)
            console.log(`Permission: ${record.permissionProfile}`);
    }
    catch {
        console.error(`Session not found: ${sessionId}`);
        node_process_1.default.exit(1);
    }
}
// ---------------------------------------------------------------------------
// aco cancel [--session <id>]
// ---------------------------------------------------------------------------
async function cmdCancel(args) {
    const sessionId = parseFlag(args, '--session') ?? store_js_1.sessionStore.latestId();
    if (!sessionId) {
        console.error('No sessions found.');
        node_process_1.default.exit(1);
    }
    let record;
    try {
        record = await store_js_1.sessionStore.read(sessionId);
    }
    catch {
        console.error(`Session not found: ${sessionId}`);
        node_process_1.default.exit(1);
    }
    if (record.status === 'done' || record.status === 'failed') {
        console.warn(`Session ${sessionId} is already ${record.status} — nothing to cancel.`);
        return;
    }
    if (record.status === 'cancelled') {
        console.warn(`Session ${sessionId} is already cancelled.`);
        return;
    }
    if (record.pid) {
        try {
            node_process_1.default.kill(record.pid, 'SIGTERM');
        }
        catch {
            // process may already be gone
        }
    }
    await store_js_1.sessionStore.markCancelled(sessionId);
    console.log(`Session ${sessionId} cancelled.`);
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseFlag(args, flag) {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length)
        return undefined;
    return args[idx + 1];
}
main().catch((err) => {
    console.error(err);
    node_process_1.default.exit(1);
});
//# sourceMappingURL=cli.js.map