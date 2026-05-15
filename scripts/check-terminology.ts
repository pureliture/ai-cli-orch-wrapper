#!/usr/bin/env tsx
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type Rule = {
  id: string;
  discouraged: string;
  preferred: string;
  reason: string;
};

const DEFAULT_SCAN_FILES = [
  'README.md',
  'docs/README.md',
  'docs/architecture.md',
  'docs/security.md',
  'docs/reference/session-artifacts.md',
  'docs/reference/ubiquitous-language.md',
  'openspec/changes/introduce-ubiquitous-language/proposal.md',
  'openspec/changes/introduce-ubiquitous-language/design.md',
  'openspec/changes/introduce-ubiquitous-language/tasks.md',
  'openspec/changes/introduce-ubiquitous-language/specs/ubiquitous-language/spec.md',
] as const;

const DEFAULT_RULES: Rule[] = [
  {
    id: 'provider-output-is-advisory',
    discouraged: 'provider truth',
    preferred: 'provider advisory output',
    reason: 'Provider output is evidence for review, not authoritative truth.',
  },
  {
    id: 'provider-output-is-advisory',
    discouraged: 'raw provider truth',
    preferred: 'full provider output',
    reason: 'The raw/full output can be stored, but it is still advisory.',
  },
  {
    id: 'generated-target-not-source',
    discouraged: 'generated source',
    preferred: 'generated target',
    reason: 'Source surfaces are maintained by humans; generated targets are produced by sync.',
  },
  {
    id: 'brief-is-bounded-summary',
    discouraged: 'brief log',
    preferred: 'brief',
    reason: 'Briefs are bounded summaries, while output.log stores full provider output.',
  },
].sort((left, right) => right.discouraged.length - left.discouraged.length);

function parseArgs(argv: string[]): { root: string; files: string[] } {
  let root = process.cwd();
  const files: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--root') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('--root requires a path');
      }

      root = path.resolve(value);
      index += 1;
      continue;
    }

    if (arg === '--file') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('--file requires a repo-relative path');
      }

      files.push(value);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    root,
    files: files.length > 0 ? files : [...DEFAULT_SCAN_FILES],
  };
}

function includesDiscouragedTerm(line: string, term: string): boolean {
  return line.toLocaleLowerCase().includes(term.toLocaleLowerCase());
}

function allowedTermsForLine(line: string): string[] {
  const matches = line.matchAll(/terminology-check allow:\s*(.*?)\s*-->/g);
  return [...matches].map((match) => match[1].trim().toLocaleLowerCase());
}

function hasAllowComment(line: string, term: string): boolean {
  const normalizedTerm = term.toLocaleLowerCase();
  return allowedTermsForLine(line).some(
    (allowed) => allowed === normalizedTerm || allowed.includes(normalizedTerm)
  );
}

function main(): void {
  const { root, files } = parseArgs(process.argv.slice(2));
  const violations: string[] = [];

  for (const file of files) {
    const absolutePath = path.join(root, file);
    if (!existsSync(absolutePath)) {
      continue;
    }

    const lines = readFileSync(absolutePath, 'utf8').split(/\r?\n/);

    lines.forEach((line, lineIndex) => {
      let lineForMatching = line.toLocaleLowerCase();
      for (const rule of DEFAULT_RULES) {
        const discouragedLower = rule.discouraged.toLocaleLowerCase();
        if (!lineForMatching.includes(discouragedLower)) {
          continue;
        }

        if (hasAllowComment(line, rule.discouraged)) {
          continue;
        }

        violations.push(
          [
            `${file}:${lineIndex + 1}`,
            `discouraged term: "${rule.discouraged}"`,
            `preferred term: "${rule.preferred}"`,
            `rule: ${rule.id}`,
            `reason: ${rule.reason}`,
          ].join('\n  ')
        );

        lineForMatching = lineForMatching.split(discouragedLower).join(' '.repeat(discouragedLower.length));
      }
    });
  }

  if (violations.length > 0) {
    console.error(`terminology check failed with ${violations.length} violation(s):`);
    console.error(violations.join('\n\n'));
    process.exitCode = 1;
    return;
  }

  console.log(`terminology check passed (${files.length} files scanned)`);
}

main();
