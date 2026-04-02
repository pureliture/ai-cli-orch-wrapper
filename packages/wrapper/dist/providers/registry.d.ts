import type { IProvider } from './interface.js';
export declare class ProviderRegistry {
    private readonly providers;
    constructor();
    register(key: string, provider: IProvider): void;
    get(key: string): IProvider | undefined;
    keys(): string[];
}
export declare const providerRegistry: ProviderRegistry;
//# sourceMappingURL=registry.d.ts.map