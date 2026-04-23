import type { IProvider } from './interface.js';
import { CodexProvider, GeminiProvider } from './gemini.js';

export class ProviderRegistry {
  private readonly providers = new Map<string, IProvider>();

  constructor() {
    const geminiProvider = new GeminiProvider();
    const codexProvider = new CodexProvider();
    this.register('gemini', geminiProvider);
    this.register('codex', codexProvider);
  }

  register(key: string, provider: IProvider): void {
    this.providers.set(key, provider);
  }

  get(key: string): IProvider | undefined {
    return this.providers.get(key);
  }

  keys(): string[] {
    return [...this.providers.keys()];
  }
}

export const providerRegistry = new ProviderRegistry();
