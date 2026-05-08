import type { AuthResult, InvokeOptions, IProvider } from './interface.js';

export class MockProvider implements IProvider {
  readonly key = 'mock';
  readonly installHint = 'mock provider is built in for deterministic no-auth demos';

  isAvailable(): boolean {
    return true;
  }

  async checkAuth(): Promise<AuthResult> {
    return {
      ok: true,
      method: 'cli-fallback',
      version: 'mock-provider 0.1.0',
      binaryPath: 'built-in',
    };
  }

  buildArgs(command: string, _options?: InvokeOptions): string[] {
    return ['mock', command];
  }

  async *invoke(command: string, prompt: string, content: string): AsyncIterable<string> {
    if (process.env.ACO_MOCK_DELAY_MS) {
      const delayMs = Number.parseInt(process.env.ACO_MOCK_DELAY_MS, 10);
      if (Number.isFinite(delayMs) && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    const input = content.length > 0 ? content : '(empty input)';
    yield [
      'Provider: mock',
      'Mode: deterministic demo',
      'Purpose: validates aco ask/result workflow without external credentials',
      '',
      `Command: ${command}`,
      'Task prompt:',
      prompt.trim(),
      '',
      'Input:',
      input,
      '',
      'Findings:',
      '- medium: Consent-gated delegation should show the plan before provider execution.',
      '- low: Treat this mock output as deterministic test data, not AI quality evidence.',
      '',
    ].join('\n');

    if (process.env.ACO_MOCK_FAIL === '1') {
      throw new Error('mock provider forced failure');
    }
  }
}
