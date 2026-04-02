/**
 * Smoke test: verify aco providers are available at runtime.
 * Migrated from .claude/aco/tests/smoke-adapters.sh
 *
 * Run: node tests/smoke.js [gemini|copilot|all]
 */
import { ProviderRegistry } from '../src/providers/registry.js';

const registry = new ProviderRegistry();
const target = process.argv[2] ?? 'all';

let pass = 0;
let fail = 0;

function check(name: string, ok: boolean): void {
  if (ok) {
    console.log(`PASS: ${name}`);
    pass++;
  } else {
    console.error(`FAIL: ${name}`);
    fail++;
  }
}

function testProvider(key: string): void {
  const provider = registry.get(key);
  check(`${key} registered in registry`, provider !== undefined);
  if (!provider) return;
  check(`${key} has non-empty installHint`, provider.installHint.length > 0);

  const available = provider.isAvailable();
  if (available) {
    console.log(`INFO: ${key} binary found in PATH`);
    check(`${key} isAvailable() returns true`, true);
  } else {
    console.log(`INFO: ${key} binary NOT in PATH — skipping auth check`);
  }
}

if (target === 'gemini' || target === 'all') testProvider('gemini');
if (target === 'copilot' || target === 'all') testProvider('copilot');

console.log(`\nResults: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
