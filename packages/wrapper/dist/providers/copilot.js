"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotProvider = void 0;
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const which_js_1 = require("../util/which.js");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
class CopilotProvider {
    key = 'copilot';
    installHint = 'npm install -g @github/copilot\n  gh auth login  # GitHub CLI must be installed';
    isAvailable() {
        return (0, which_js_1.which)('copilot') !== null;
    }
    async checkAuth() {
        if (!this.isAvailable()) {
            return { ok: false, hint: this.installHint };
        }
        const gh = (0, which_js_1.which)('gh');
        if (!gh) {
            return { ok: false, hint: 'gh auth login  # Install GitHub CLI: https://cli.github.com' };
        }
        try {
            await execFileAsync(gh, ['auth', 'status'], { timeout: 5000 });
            return { ok: true };
        }
        catch {
            return { ok: false, hint: 'gh auth login' };
        }
    }
    buildArgs(command, _options) {
        return ['--allow-all-tools', '--silent', '-p'];
    }
    async *invoke(prompt, content, _options) {
        const binary = (0, which_js_1.which)('copilot');
        if (!binary)
            throw new Error('copilot CLI not found in PATH');
        const fullPrompt = content ? `${content}\n\n${prompt}` : prompt;
        const args = [...this.buildArgs(''), fullPrompt];
        yield* spawnStream(binary, args);
    }
}
exports.CopilotProvider = CopilotProvider;
async function* spawnStream(binary, args) {
    const child = (0, node_child_process_1.spawn)(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    for await (const chunk of child.stdout) {
        yield chunk.toString();
    }
    await new Promise((resolve, reject) => {
        child.on('close', (code) => {
            if (code !== 0)
                reject(new Error(`copilot exited with code ${code}`));
            else
                resolve();
        });
        child.on('error', reject);
    });
}
//# sourceMappingURL=copilot.js.map