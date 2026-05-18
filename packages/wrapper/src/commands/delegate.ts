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

  // First positional arg is agent ID
  const positional = args.filter((a) => !a.startsWith('-'));
  const agentId = positional[0];

  if (!agentId) {
    process.stderr.write('Error: agent-id is required\n');
    process.stderr.write(USAGE);
    process.exit(1);
  }

  const specFilePath = resolve(join(process.cwd(), '.claude', 'agents', agentId + '.md'));

  if (!existsSync(specFilePath)) {
    process.stderr.write(`Agent spec not found: ${specFilePath}\n`);
    process.exit(1);
  }

  const content = await readFile(specFilePath, 'utf8');
  const spec = parseAgentSpec(content);

  let seedContent = '';
  if (spec.promptSeedFile) {
    const specDir = dirname(specFilePath);
    const resolvedSeedPath = join(specDir, spec.promptSeedFile);
    if (!resolvedSeedPath.startsWith(specDir + '/')) {
      process.stderr.write(
        `promptSeedFile must be within agent spec directory: ${resolvedSeedPath}\n`
      );
      process.exit(1);
    }
    if (!existsSync(resolvedSeedPath)) {
      process.stderr.write(`promptSeedFile not found: ${resolvedSeedPath}\n`);
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
