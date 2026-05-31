import type { IProvider } from './interface.js';
import { AntigravityProvider } from './antigravity.js';
import { CodexProvider } from './codex.js';
import { MockProvider } from './mock.js';

export class ProviderRegistry {
  private readonly providers = new Map<string, IProvider>();

  constructor() {
    const antigravityProvider = new AntigravityProvider();
    const codexProvider = new CodexProvider();
    const mockProvider = new MockProvider();
    this.register('antigravity', antigravityProvider);
    this.register('codex', codexProvider);
    this.register('mock', mockProvider);
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
