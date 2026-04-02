import type { AuthResult, InvokeOptions, IProvider } from './interface.js';
export declare class CopilotProvider implements IProvider {
    readonly key = "copilot";
    readonly installHint = "npm install -g @github/copilot\n  gh auth login  # GitHub CLI must be installed";
    isAvailable(): boolean;
    checkAuth(): Promise<AuthResult>;
    buildArgs(command: string, _options?: InvokeOptions): string[];
    invoke(prompt: string, content: string, _options?: InvokeOptions): AsyncIterable<string>;
}
//# sourceMappingURL=copilot.d.ts.map