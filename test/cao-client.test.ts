/**
 * CAO HTTP client tests
 *
 * Wave 0 integration tests for the CAO endpoint seam.
 */

import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { test } from 'node:test';

async function startServer(
  handler: (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => void,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createServer(handler);

  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start test server');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    }),
  };
}

test('CaoHttpClient uses exact CAO endpoints and query keys', async () => {
  const requests: {
    sessionSearchParams?: URLSearchParams;
    inputSearchParams?: URLSearchParams;
    outputMode?: string | null;
    exitCalled: boolean;
    terminalReads: number;
  } = {
    exitCalled: false,
    terminalReads: 0,
  };

  const terminalId = 'terminal-1';
  const { baseUrl, close } = await startServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/sessions') {
      requests.sessionSearchParams = url.searchParams;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: terminalId,
        name: 'planner-session',
        provider: url.searchParams.get('provider'),
        session_name: url.searchParams.get('session_name'),
        agent_profile: url.searchParams.get('agent_profile'),
        status: 'processing',
      }));
      return;
    }

    if (req.method === 'POST' && url.pathname === `/terminals/${terminalId}/input`) {
      requests.inputSearchParams = url.searchParams;
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === `/terminals/${terminalId}`) {
      requests.terminalReads += 1;
      const status = requests.terminalReads < 2 ? 'processing' : 'completed';
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: terminalId,
        name: 'planner-session',
        provider: 'claude_code',
        session_name: 'plan-review-run-01-planner-01',
        agent_profile: 'developer',
        status,
      }));
      return;
    }

    if (req.method === 'GET' && url.pathname === `/terminals/${terminalId}/output`) {
      requests.outputMode = url.searchParams.get('mode');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ output: 'done', mode: 'last' }));
      return;
    }

    if (req.method === 'POST' && url.pathname === `/terminals/${terminalId}/exit`) {
      requests.exitCalled = true;
      res.writeHead(204);
      res.end();
      return;
    }

    res.writeHead(404);
    res.end();
  });

  try {
    const { CaoHttpClient } = await import('../dist/orchestration/cao-client.js');

    const client = new CaoHttpClient(baseUrl);
    await client.checkHealth();

    const terminal = await client.createSession({
      provider: 'claude_code',
      agentProfile: 'developer',
      sessionName: 'plan-review-run-01-planner-01',
      workingDirectory: '/repo',
      launchArgs: ['--model', 'gpt-5.4'],
    });

    await client.sendInput(terminal.id, 'write plan');
    const completedTerminal = await client.waitForCompletion(terminal.id, {
      pollIntervalMs: 1,
      timeoutMs: 50,
    });
    const output = await client.getOutput(terminal.id, 'last');
    await client.exitTerminal(terminal.id);

    assert.equal(completedTerminal.status, 'completed');
    assert.equal(output.output, 'done');
    assert.equal(output.mode, 'last');

    assert.ok(requests.sessionSearchParams?.has('provider'));
    assert.ok(requests.sessionSearchParams?.has('agent_profile'));
    assert.ok(requests.sessionSearchParams?.has('session_name'));
    assert.ok(requests.sessionSearchParams?.has('working_directory'));
    assert.equal(requests.sessionSearchParams?.get('provider'), 'claude_code');
    assert.equal(requests.sessionSearchParams?.get('agent_profile'), 'developer');
    assert.equal(requests.sessionSearchParams?.get('session_name'), 'plan-review-run-01-planner-01');
    assert.equal(requests.sessionSearchParams?.get('working_directory'), '/repo');
    assert.equal(requests.sessionSearchParams?.has('agentProfile'), false);
    assert.equal(requests.sessionSearchParams?.has('sessionName'), false);
    assert.equal(requests.sessionSearchParams?.has('workingDirectory'), false);

    assert.ok(requests.inputSearchParams?.has('message'));
    assert.equal(requests.inputSearchParams?.get('message'), 'write plan');
    assert.equal(requests.inputSearchParams?.has('prompt'), false);

    assert.equal(requests.outputMode, 'last');
    assert.ok(requests.terminalReads >= 2, 'waitForCompletion should poll until completion');
    assert.equal(requests.exitCalled, true);
  } finally {
    await close();
  }
});

test('CaoHttpClient checkHealth throws exact startup message when CAO is unavailable', async () => {
  const { CaoHttpClient } = await import('../dist/orchestration/cao-client.js');
  const client = new CaoHttpClient('http://127.0.0.1:9');

  await assert.rejects(
    () => client.checkHealth(),
    (error: Error) => error.message === "CAO server is not running. Start it with 'cao-server'.",
  );
});

test('CaoHttpClient waitForCompletion rejects waiting_user_answer terminals', async () => {
  const terminalId = 'terminal-2';
  const { baseUrl, close } = await startServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === `/terminals/${terminalId}`) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: terminalId,
        name: 'reviewer-session',
        provider: 'gemini_cli',
        session_name: 'plan-review-run-01-reviewer-01',
        agent_profile: 'reviewer',
        status: 'waiting_user_answer',
      }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  try {
    const { CaoHttpClient } = await import('../dist/orchestration/cao-client.js');
    const client = new CaoHttpClient(baseUrl);

    await assert.rejects(
      () => client.waitForCompletion(terminalId, { pollIntervalMs: 1, timeoutMs: 50 }),
      (error: Error) => error.message.includes('waiting_user_answer'),
    );
  } finally {
    await close();
  }
});

test('CaoHttpClient waitForCompletion treats idle terminals as completed work', async () => {
  const terminalId = 'terminal-3';
  let readCount = 0;
  const { baseUrl, close } = await startServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === `/terminals/${terminalId}`) {
      readCount += 1;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: terminalId,
        name: 'planner-session',
        provider: 'claude_code',
        session_name: 'plan-review-run-01-planner-01',
        agent_profile: 'developer',
        status: readCount === 1 ? 'processing' : 'idle',
      }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  try {
    const { CaoHttpClient } = await import('../dist/orchestration/cao-client.js');
    const client = new CaoHttpClient(baseUrl);
    const terminal = await client.waitForCompletion(terminalId, { pollIntervalMs: 1, timeoutMs: 50 });

    assert.equal(terminal.status, 'idle');
    assert.ok(readCount >= 2);
  } finally {
    await close();
  }
});
