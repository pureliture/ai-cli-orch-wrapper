/**
 * CAO HTTP client
 *
 * Thin fetch-based client for the confirmed CAO session and terminal endpoints.
 */

export interface CaoTerminal {
  id: string;
  name: string;
  provider: string;
  session_name: string;
  agent_profile?: string | null;
  status?: 'idle' | 'processing' | 'completed' | 'waiting_user_answer' | 'error' | null;
}

export interface TerminalOutput {
  output: string;
  mode: 'full' | 'last';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function parseJsonResponse<T>(response: Response, errorMessage: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${errorMessage}: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export class CaoHttpClient {
  private readonly baseUrl: string;

  constructor(baseUrl = 'http://localhost:9889') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async checkHealth(): Promise<void> {
    const healthUrl = new URL('/health', `${this.baseUrl}/`);

    try {
      const response = await fetch(healthUrl);
      if (!response.ok) {
        throw new Error('health-check-failed');
      }
    } catch {
      throw new Error("CAO server is not running. Start it with 'cao-server'.");
    }
  }

  async createSession(input: {
    provider: string;
    agentProfile: string;
    sessionName: string;
    workingDirectory: string;
    launchArgs?: string[];
  }): Promise<CaoTerminal> {
    const url = new URL('/sessions', `${this.baseUrl}/`);
    url.searchParams.set('provider', input.provider);
    url.searchParams.set('agent_profile', input.agentProfile);
    url.searchParams.set('session_name', input.sessionName);
    url.searchParams.set('working_directory', input.workingDirectory);

    for (const launchArg of input.launchArgs ?? []) {
      url.searchParams.append('launch_arg', launchArg);
    }

    const response = await fetch(url, { method: 'POST' });
    return parseJsonResponse<CaoTerminal>(response, 'Failed to create CAO session');
  }

  async sendInput(terminalId: string, message: string): Promise<void> {
    const url = new URL(`/terminals/${terminalId}/input`, `${this.baseUrl}/`);
    url.searchParams.set('message', message);

    const response = await fetch(url, { method: 'POST' });
    if (!response.ok) {
      throw new Error(`Failed to send input to terminal ${terminalId}: ${response.status} ${response.statusText}`);
    }
  }

  async getTerminal(terminalId: string): Promise<CaoTerminal> {
    const url = new URL(`/terminals/${terminalId}`, `${this.baseUrl}/`);
    const response = await fetch(url);
    return parseJsonResponse<CaoTerminal>(response, `Failed to read terminal ${terminalId}`);
  }

  async waitForCompletion(
    terminalId: string,
    options?: { pollIntervalMs?: number; timeoutMs?: number },
  ): Promise<CaoTerminal> {
    const pollIntervalMs = options?.pollIntervalMs ?? 1000;
    const timeoutMs = options?.timeoutMs ?? 120000;
    const startedAt = Date.now();

    while (Date.now() - startedAt <= timeoutMs) {
      const terminal = await this.getTerminal(terminalId);

      if (terminal.status === 'completed') {
        return terminal;
      }

      if (terminal.status === 'error') {
        throw new Error(`CAO terminal ${terminalId} entered error state.`);
      }

      if (terminal.status === 'waiting_user_answer') {
        throw new Error(`CAO terminal ${terminalId} entered waiting_user_answer state.`);
      }

      await sleep(pollIntervalMs);
    }

    throw new Error(`Timed out waiting for terminal ${terminalId} to complete.`);
  }

  async getOutput(terminalId: string, mode: 'full' | 'last' = 'last'): Promise<TerminalOutput> {
    const url = new URL(`/terminals/${terminalId}/output`, `${this.baseUrl}/`);
    url.searchParams.set('mode', mode);

    const response = await fetch(url);
    return parseJsonResponse<TerminalOutput>(response, `Failed to read output for terminal ${terminalId}`);
  }

  async exitTerminal(terminalId: string): Promise<void> {
    const url = new URL(`/terminals/${terminalId}/exit`, `${this.baseUrl}/`);

    try {
      await fetch(url, { method: 'POST' });
    } catch {
      // Best-effort cleanup only; callers should preserve the original workflow result.
    }
  }
}
