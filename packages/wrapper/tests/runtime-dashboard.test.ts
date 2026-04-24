import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderRuntimeDashboard } from '../src/runtime/dashboard.js';
import type { RuntimeContext } from '../src/runtime/types.js';

function buildContext(overrides: Partial<RuntimeContext> = {}): RuntimeContext {
  return {
    active: {
      provider: 'gemini',
      command: 'review',
      sessionId: 'session-1234',
      permissionProfile: 'default',
      cwd: '/tmp/project',
      promptTemplatePath: '/tmp/project/.claude/aco/prompts/gemini/review.md',
      auth: {
        ok: true,
        method: 'oauth',
      },
      ...overrides.active,
    },
    exposed: {
      sharedSkills: ['review-skill', 'planner-skill'],
      providerAgents: ['planner', 'reviewer'],
      providerHooks: ['PreToolUse', 'PostToolUse'],
      providerConfigFiles: ['settings.json'],
      provider: 'gemini',
      ...overrides.exposed,
    },
  };
}

describe('runtime dashboard rendering', () => {
  it('renders colorful output in TTY mode when color is forced', () => {
    const output = renderRuntimeDashboard(buildContext(), { color: true });

    assert.ok(output.includes('\x1b['));
    assert.ok(output.includes('🛰️  aco Runtime Session'));
    assert.ok(output.includes('✨ Active'));
    assert.ok(output.includes('🧩 Exposed'));
    assert.ok(/Auth/.test(output));
    assert.ok(output.includes('oauth'));
    assert.ok(output.includes('Session ID'));
    assert.ok(output.includes('Providers'));
  });

  it('renders plain text output when color is disabled', () => {
    const output = renderRuntimeDashboard(buildContext(), { color: false });
    assert.equal(output.includes('\x1b['), false);
    assert.ok(output.includes('Runtime Session'));
    assert.ok(output.includes('Active'));
    assert.ok(output.includes('Exposed'));
  });

  it('falls back to plain text for CI environment by default', () => {
    const originalCI = process.env.CI;
    const originalNoColor = process.env.NO_COLOR;
    process.env.CI = '1';
    delete process.env.NO_COLOR;

    try {
      const output = renderRuntimeDashboard(buildContext());
      assert.equal(output.includes('\x1b['), false);
    } finally {
      if (originalCI === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = originalCI;
      }

      if (originalNoColor === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = originalNoColor;
      }
    }
  });
});
