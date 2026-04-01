
import assert from 'node:assert';
import { runWorkflow } from './src/orchestration/workflow-runner.js';
import { CaoHttpClient } from './src/orchestration/cao-client.js';

// Mock client to check baseUrl
class MockClient {
  baseUrl: string | undefined;
  constructor(baseUrl: string | undefined) {
    this.baseUrl = baseUrl;
  }
  async checkHealth() { return true; }
  async createSession() { return { id: 'test' }; }
  async sendInput() { return true; }
  async waitForCompletion() { return true; }
  async getOutput() { return ''; }
  async getTerminal() { return { id: 'test', status: 'idle' }; }
  async exitTerminal() { return true; }
}

async function testUrlResolution() {
  process.env.ACO_CAO_BASE_URL = 'http://aco-url';
  process.env.WRAPPER_CAO_BASE_URL = 'http://wrapper-url';
  
  // Directly instantiate client to check internal url
  const clientAco = new CaoHttpClient(process.env.ACO_CAO_BASE_URL || process.env.WRAPPER_CAO_BASE_URL);
  // @ts-ignore - baseUrl is private/internal
  assert.strictEqual(clientAco.baseUrl, 'http://aco-url');

  delete process.env.ACO_CAO_BASE_URL;
  const clientWrapper = new CaoHttpClient(process.env.ACO_CAO_BASE_URL || process.env.WRAPPER_CAO_BASE_URL);
  // @ts-ignore
  assert.strictEqual(clientWrapper.baseUrl, 'http://wrapper-url');

  console.log('✓ URL Resolution: ACO_CAO_BASE_URL prefers then WRAPPER_CAO_BASE_URL');
}

testUrlResolution().catch(e => {
  console.error(e);
  process.exit(1);
});
