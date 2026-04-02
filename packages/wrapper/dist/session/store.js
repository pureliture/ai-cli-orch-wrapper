"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionStore = exports.SessionStore = void 0;
const promises_1 = require("node:fs/promises");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_os_1 = require("node:os");
const node_crypto_1 = require("node:crypto");
const node_stream_1 = require("node:stream");
class SessionStore {
    baseDir;
    constructor(baseDir) {
        this.baseDir = baseDir ?? (0, node_path_1.join)((0, node_os_1.homedir)(), '.aco', 'sessions');
    }
    async create(provider, command, pid, permissionProfile) {
        const id = (0, node_crypto_1.randomUUID)();
        const sessionDir = (0, node_path_1.join)(this.baseDir, id);
        await (0, promises_1.mkdir)(sessionDir, { recursive: true });
        const record = {
            id,
            provider,
            command,
            status: 'running',
            pid,
            permissionProfile,
            startedAt: new Date().toISOString(),
        };
        await (0, promises_1.writeFile)((0, node_path_1.join)(sessionDir, 'task.json'), JSON.stringify(record, null, 2));
        return record;
    }
    async update(id, patch) {
        const record = await this.read(id);
        const updated = { ...record, ...patch };
        await (0, promises_1.writeFile)((0, node_path_1.join)(this.baseDir, id, 'task.json'), JSON.stringify(updated, null, 2));
        return updated;
    }
    async read(id) {
        const path = (0, node_path_1.join)(this.baseDir, id, 'task.json');
        const raw = await (0, promises_1.readFile)(path, 'utf8');
        return JSON.parse(raw);
    }
    async markDone(id) {
        await this.update(id, { status: 'done', endedAt: new Date().toISOString() });
    }
    async markFailed(id) {
        await this.update(id, { status: 'failed', endedAt: new Date().toISOString() });
    }
    async markCancelled(id) {
        await this.update(id, { status: 'cancelled', endedAt: new Date().toISOString() });
    }
    outputLogPath(id) {
        return (0, node_path_1.join)(this.baseDir, id, 'output.log');
    }
    errorLogPath(id) {
        return (0, node_path_1.join)(this.baseDir, id, 'error.log');
    }
    sessionDir(id) {
        return (0, node_path_1.join)(this.baseDir, id);
    }
    /** Returns the most-recently-created session ID, or undefined if none exist. */
    latestId() {
        if (!(0, node_fs_1.existsSync)(this.baseDir))
            return undefined;
        const entries = (0, node_fs_1.readdirSync)(this.baseDir)
            .map((name) => {
            const dir = (0, node_path_1.join)(this.baseDir, name);
            try {
                const stat = (0, node_fs_1.statSync)(dir);
                return { name, mtime: stat.mtimeMs };
            }
            catch {
                return null;
            }
        })
            .filter((e) => e !== null);
        if (entries.length === 0)
            return undefined;
        entries.sort((a, b) => b.mtime - a.mtime);
        return entries[0].name;
    }
    /** Creates a tee writable: chunks go to stdout AND to the session output.log. */
    createOutputTee(id) {
        const logPath = this.outputLogPath(id);
        const fileStream = (0, node_fs_1.createWriteStream)(logPath, { flags: 'a' });
        const tee = new node_stream_1.Transform({
            transform(chunk, _enc, cb) {
                process.stdout.write(chunk);
                fileStream.write(chunk);
                this.push(chunk);
                cb();
            },
            flush(cb) {
                fileStream.end(cb);
            },
        });
        return tee;
    }
}
exports.SessionStore = SessionStore;
exports.sessionStore = new SessionStore();
//# sourceMappingURL=store.js.map