import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import process from 'node:process';
import { parseAgentSpec } from '../sync/agent-parse.js';

const USAGE = `Usage: aco delegate <agent-id> [--input <text>] [--input-file <path>]

Delegates a task to a named agent spec, combining the seed prompt with the supplied input.
The combined prompt is written to stdout.

Agent specs are read from: .claude/agents/<agent-id>.md

Options:
  --input <text>        Inline input text
  --input-file <path>   Path to input file
  --help, -h            Print this usage
`;

export async function cmdDelegate(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(USAGE);
    process.exit(0);
  }

  // First positional arg is agent ID. Enforce strict whitelist to prevent path traversal:
  // agent IDs must be alphanumeric/hyphen/underscore so they cannot escape `.claude/agents/`.
  const agentId = args[0];
  if (
    !agentId ||
    agentId.startsWith('-') ||
    !/^[a-zA-Z0-9_-]+$/.test(agentId)
  ) {
    process.stderr.write(
      'Error: agent-id is required as the first argument (alphanumeric, hyphen, underscore only)\n'
    );
    process.stderr.write(USAGE);
    process.exit(1);
  }

  const cwd = process.cwd();
  const specFilePath = resolve(join(cwd, '.claude', 'agents', agentId + '.md'));

  if (!existsSync(specFilePath)) {
    process.stderr.write(`Agent spec not found: ${specFilePath}\n`);
    process.exit(1);
  }

  const content = await readFile(specFilePath, 'utf8');
  const spec = parseAgentSpec(content);

  let seedContent = '';
  if (spec.promptSeedFile) {
    const specDir = dirname(specFilePath);

    // Resolve promptSeedFile in two stages so both agent-spec-local seeds
    // (e.g. `seeds/foo.md` next to the spec) and project-rooted seeds
    // (e.g. `.aco/prompts/reviewer.md` shipped at the repo root) work.
    const candidates = [resolve(specDir, spec.promptSeedFile), resolve(cwd, spec.promptSeedFile)];

    const cwdPrefix = cwd.endsWith('/') ? cwd : cwd + '/';
    let resolvedSeedPath: string | undefined;
    for (const candidate of candidates) {
      // Path traversal guard: every candidate must stay inside cwd.
      if (candidate !== cwd && !candidate.startsWith(cwdPrefix)) {
        continue;
      }
      if (existsSync(candidate)) {
        resolvedSeedPath = candidate;
        break;
      }
    }

    if (!resolvedSeedPath) {
      // Report the spec-dir-relative candidate so users see the canonical path first.
      process.stderr.write(`promptSeedFile not found: ${candidates[0]}\n`);
      process.exit(1);
    }
    seedContent = await readFile(resolvedSeedPath, 'utf8');
  }

  let input = '';
  const inputIdx = args.indexOf('--input');
  const inputFileIdx = args.indexOf('--input-file');

  if (inputIdx !== -1 && args[inputIdx + 1] !== undefined) {
    input = args[inputIdx + 1];
  } else if (inputFileIdx !== -1 && args[inputFileIdx + 1] !== undefined) {
    const inputFilePath = resolve(args[inputFileIdx + 1]);
    if (!existsSync(inputFilePath)) {
      process.stderr.write(`Input file not found: ${inputFilePath}\n`);
      process.exit(1);
    }
    input = await readFile(inputFilePath, 'utf8');
  }

  const parts: string[] = [];
  if (seedContent) parts.push(seedContent);
  if (spec.body) parts.push(spec.body);
  if (input) parts.push(input);

  if (parts.length > 0) {
    process.stdout.write(parts.join('\n\n') + '\n');
  }
}
