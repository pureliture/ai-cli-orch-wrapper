export interface ClaudeHookCommand {
  command: string;
  matcher?: string;
  timeout?: number;
  async?: boolean;
}

export interface ClaudeHookEvent {
  commands: ClaudeHookCommand[];
}

export interface ClaudeHooks {
  [event: string]: ClaudeHookEvent;
}

interface RawClaudeHookEntry {
  type?: string;
  command?: string;
  timeout?: number;
  async?: boolean;
}

interface RawClaudeMatcherEntry {
  matcher?: string;
  hooks?: RawClaudeHookEntry[];
}

export function parseHooks(content: string): ClaudeHooks | undefined {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;

    // Claude Code settings.json format: top-level event names with matcher arrays
    // { "PostToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "..." }] }] }
    const hasEventKeys = Object.keys(parsed).some(
      (k) => k !== 'hooks' && Array.isArray(parsed[k])
    );
    if (hasEventKeys) {
      const normalized = normalizeHooks(parsed);
      return Object.keys(normalized).length > 0 ? normalized : undefined;
    }

    // Legacy format: { "hooks": { [event]: { commands: [...] } } }
    if (parsed.hooks && typeof parsed.hooks === 'object') {
      return parsed.hooks as ClaudeHooks;
    }
  } catch {
    // Invalid JSON
  }
  return undefined;
}

function normalizeHooks(raw: Record<string, unknown>): ClaudeHooks {
  const result: ClaudeHooks = {};

  for (const [event, entries] of Object.entries(raw)) {
    if (!Array.isArray(entries)) continue;

    const commands: ClaudeHookCommand[] = [];

    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const matcherEntry = entry as RawClaudeMatcherEntry;
      const matcher = matcherEntry.matcher;

      for (const hookEntry of matcherEntry.hooks ?? []) {
        if (!hookEntry.command) continue;
        const cmd: ClaudeHookCommand = {
          command: hookEntry.command,
        };
        if (matcher) cmd.matcher = matcher;
        if (hookEntry.timeout != null) cmd.timeout = hookEntry.timeout;
        if (hookEntry.async != null) cmd.async = hookEntry.async;
        commands.push(cmd);
      }
    }

    if (commands.length > 0) {
      result[event] = { commands };
    }
  }

  return result;
}

// Codex supported hook events
const CODEX_SUPPORTED_EVENTS = new Set(['PostToolUse']);

// Gemini supported hook events
const GEMINI_SUPPORTED_EVENTS = new Set(['PostToolUse']);

export function toCodexHooks(hooks: ClaudeHooks): { hooks: Array<{event: string; command: string; matcher?: string; timeout?: number}>; warnings: string[] } {
  const result: Array<{event: string; command: string; matcher?: string; timeout?: number}> = [];
  const warnings: string[] = [];

  for (const [event, eventConfig] of Object.entries(hooks)) {
    if (!CODEX_SUPPORTED_EVENTS.has(event)) {
      warnings.push(`Event "${event}" is not supported by Codex hooks`);
      continue;
    }

    for (const cmd of eventConfig.commands || []) {
      const hook: {event: string; command: string; matcher?: string; timeout?: number} = {
        event,
        command: cmd.command,
      };

      if (cmd.matcher) {
        hook.matcher = cmd.matcher;
      }
      if (cmd.timeout) {
        hook.timeout = cmd.timeout;
      }

      if (cmd.async) {
        warnings.push(`Hook "${event}" has async: true — Codex hooks are synchronous, async semantics will be lost`);
      }

      result.push(hook);
    }
  }

  return { hooks: result, warnings };
}

export function toGeminiHooks(hooks: ClaudeHooks): { hooks: Record<string, {command: string; matcher?: string; timeout?: number}>; warnings: string[] } {
  const result: Record<string, {command: string; matcher?: string; timeout?: number}> = {};
  const warnings: string[] = [];

  for (const [event, eventConfig] of Object.entries(hooks)) {
    if (!GEMINI_SUPPORTED_EVENTS.has(event)) {
      warnings.push(`Event "${event}" is not supported by Gemini hooks`);
      continue;
    }

    // Gemini takes one command per event (simplified)
    const cmd = eventConfig.commands?.[0];
    if (!cmd) continue;

    const hook: {command: string; matcher?: string; timeout?: number} = {
      command: cmd.command,
    };

    if (cmd.matcher) {
      hook.matcher = cmd.matcher;
    }
    if (cmd.timeout) {
      // Convert seconds to milliseconds for Gemini
      hook.timeout = cmd.timeout * 1000;
    }

    if (cmd.async) {
      warnings.push(`Hook "${event}" has async: true — Gemini hooks are synchronous, async semantics will be lost`);
    }

    result[event] = hook;
  }

  return { hooks: result, warnings };
}
