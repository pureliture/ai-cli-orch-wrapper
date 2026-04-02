"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.which = which;
const node_child_process_1 = require("node:child_process");
/** Returns the full path of a binary if found in PATH, or null. */
function which(binary) {
    try {
        const result = (0, node_child_process_1.execSync)(`command -v ${binary}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        return result.trim() || null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=which.js.map