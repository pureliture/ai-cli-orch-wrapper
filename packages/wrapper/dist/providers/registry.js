"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.providerRegistry = exports.ProviderRegistry = void 0;
const gemini_js_1 = require("./gemini.js");
const copilot_js_1 = require("./copilot.js");
class ProviderRegistry {
    providers = new Map();
    constructor() {
        this.register('gemini', new gemini_js_1.GeminiProvider());
        this.register('copilot', new copilot_js_1.CopilotProvider());
    }
    register(key, provider) {
        this.providers.set(key, provider);
    }
    get(key) {
        return this.providers.get(key);
    }
    keys() {
        return [...this.providers.keys()];
    }
}
exports.ProviderRegistry = ProviderRegistry;
exports.providerRegistry = new ProviderRegistry();
//# sourceMappingURL=registry.js.map