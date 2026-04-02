import type { AuthResult, InvokeOptions, IProvider } from './interface.js';
export declare class GeminiProvider implements IProvider {
    readonly key = "gemini";
    readonly installHint = "npm install -g @google/gemini-cli";
    isAvailable(): boolean;
    checkAuth(): Promise<AuthResult>;
    buildArgs(command: string, _options?: InvokeOptions): string[];
    invoke(prompt: string, content: string, _options?: InvokeOptions): AsyncIterable<string>;
}
//# sourceMappingURL=gemini.d.ts.map