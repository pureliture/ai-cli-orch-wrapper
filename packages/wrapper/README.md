# @pureliture/aco-wrapper

Provider-based wrapper runtime for the `aco` CLI. Owns execution dispatch, session lifecycle, and output management for Gemini CLI and GitHub Copilot CLI.

## CLI Reference

### `aco run <provider> <command> [options]`

Dispatch a command to a provider. Content is read from `--input` or stdin.

```bash
# Review git diff via Gemini
git diff HEAD | aco run gemini review

# Review a specific file via Copilot
aco run copilot review --input "$(cat src/auth.ts)"

# With a permission profile
aco run gemini adversarial --permission-profile restricted
```

Options:
- `--input <text>` — inline input content
- `--permission-profile default|restricted|unrestricted` — execution permissions

### `aco result [--session <id>]`

Print output from the last session (or named session).

### `aco status [--session <id>]`

Show provider, command, status, and timestamps for the last/named session.

### `aco cancel [--session <id>]`

Send SIGTERM to the provider subprocess and mark session as `cancelled`.

### `aco --version`

Print the wrapper version.

## Session Storage

Each invocation creates `~/.aco/sessions/<uuid>/`:
- `task.json` — provider, command, status, timestamps, pid
- `output.log` — streamed provider output
- `error.log` — stderr / error messages

## Adding a New Provider

1. Create `src/providers/<name>.ts` implementing `IProvider`:

```typescript
import type { IProvider, AuthResult, InvokeOptions } from './interface.js';

export class MyProvider implements IProvider {
  readonly key = 'my-provider';
  readonly installHint = 'npm install -g my-provider-cli';

  isAvailable(): boolean { /* check PATH */ }
  async checkAuth(): Promise<AuthResult> { /* verify credentials */ }
  buildArgs(command: string, options?: InvokeOptions): string[] { /* CLI flags */ }
  async *invoke(command: string, prompt: string, content: string, options?: InvokeOptions): AsyncIterable<string> { /* spawn */ }
}
```

2. Register in `src/providers/registry.ts`:
```typescript
this.register('my-provider', new MyProvider());
```

That's it — `aco run my-provider <command>` will work immediately.

## Development

```bash
npm run build     # compile TypeScript
npm test          # run unit tests
```
