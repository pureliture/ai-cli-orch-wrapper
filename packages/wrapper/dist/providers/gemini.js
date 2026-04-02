"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiProvider = void 0;
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const which_js_1 = require("../util/which.js");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
class GeminiProvider {
    key = 'gemini';
    installHint = 'npm install -g @google/gemini-cli';
    isAvailable() {
        return (0, which_js_1.which)('gemini') !== null;
    }
    async checkAuth() {
        if (!this.isAvailable()) {
            return { ok: false, hint: this.installHint };
        }
        try {
            await execFileAsync('gemini', ['--version'], { timeout: 5000 });
            return { ok: true };
        }
        catch {
            return { ok: false, hint: 'gemini auth login  # or run `gemini` interactively' };
        }
    }
    buildArgs(command, _options) {
        return ['--yolo', '-p'];
    }
    async *invoke(prompt, content, _options) {
        const binary = (0, which_js_1.which)('gemini');
        if (!binary)
            throw new Error('gemini CLI not found in PATH');
        const args = [...this.buildArgs(''), `${prompt}\n\n${content}`];
        yield* spawnStream(binary, args, content);
    }
}
exports.GeminiProvider = GeminiProvider;
async function* spawnStream(binary, args, _stdinContent) {
    const child = (0, node_child_process_1.spawn)(binary, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdin.end();
    for await (const chunk of child.stdout) {
        yield chunk.toString();
    }
    await new Promise((resolve, reject) => {
        child.on('close', (code) => {
            if (code !== 0)
                reject(new Error(`gemini exited with code ${code}`));
            else
                resolve();
        });
        child.on('error', reject);
    });
}
//# sourceMappingURL=gemini.js.map