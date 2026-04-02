# Runbook

## Publishing

### 1. Build

```bash
npm run build
```

### 2. Publish packages (in order)

```bash
# wrapper first — installer depends on it
cd packages/wrapper && npm publish
cd ../installer && npm publish
```

`packages/installer` has a `prepublishOnly` hook that re-runs `tsc` automatically.

### 3. Verify

```bash
npx aco-install --version
npx aco --version
```

---

## Installation (end-user)

```bash
# Option 1: npx (no local install)
npx aco-install

# Option 2: from repo
npm install
aco-install pack setup
```

---

## Session Data

Sessions are stored at `~/.aco/sessions/<uuid>/` with restrictive permissions (`0700` directory, `0600` files):

| File | Permissions | Contents |
|------|-------------|----------|
| `task.json` | `0600` | status, provider, command, pid, timestamps |
| `output.log` | `0600` | streaming stdout from the provider CLI |
| `error.log` | `0600` | stderr / error details |

### Inspect a session

```bash
aco status                      # last session
aco status --session <id>       # named session
aco result                      # last session output
aco result --session <id>       # named session output
```

### Cancel a running session

```bash
aco cancel --session <id>
```

---

## Common Issues

### `aco: command not found`

The `aco` binary is provided by `@aco/wrapper`. Run `npm install` from the repo root or install globally:

```bash
npm install -g @aco/wrapper
```

### Provider not found / not authenticated

```bash
aco-install provider setup gemini     # install + auth guidance for Gemini CLI
aco-install provider setup copilot    # install + auth guidance for Copilot CLI
```

Gemini CLI: `npm install -g @google/gemini-cli`  
Copilot CLI: `npm install -g @github/copilot && gh auth login`

### Slash commands missing after install

Re-run the pack install to copy templates:

```bash
aco-install pack install
```

Templates are copied (not symlinked) from `templates/commands/` → `.claude/commands/`.  
Symlinks are intentionally avoided because they break under nvm/fnm version switches.

### Build fails: installer errors before wrapper

The installer depends on `packages/wrapper/dist/`. Always build wrapper first:

```bash
npm run build --workspace=packages/wrapper
npm run build --workspace=packages/installer
```

The root `npm run build` script enforces this order automatically.

---

## Rollback

1. `npm unpublish <package>@<version>` (within 72 h of publish)
2. Or publish a patch release with the fix.

---

## Permissions

`aco run --permission-profile <default|restricted|unrestricted>`

`restricted` mode currently emits a warning log only. OS-level sandboxing is out of scope for v1.
