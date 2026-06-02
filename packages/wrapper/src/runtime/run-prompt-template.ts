import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export interface RunPromptTemplateInput {
  cwd: string;
  home: string;
  providerKey: string;
  command: string;
}

export interface RunPromptTemplateResult {
  prompt: string;
  promptTemplatePath?: string;
}

// NOTE: antigravity:review를 documented로 추가했지만 Phase 3에서
// .claude/aco/prompts/antigravity/review.md 파일이 생성되기 전까지는
// 해당 커맨드 실행 시 오류가 발생하므로 그 전에 prompt 파일을 배포해야 한다.
const DOCUMENTED_PROMPT_COMMANDS = new Set(['antigravity:review', 'codex:review']);
const SAFE_PATH_SEGMENT = /^[A-Za-z0-9_-]+$/;

function assertSafePathSegment(name: string, value: string): void {
  if (!SAFE_PATH_SEGMENT.test(value)) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
}

function getPromptTemplateCandidates(input: RunPromptTemplateInput): string[] {
  assertSafePathSegment('provider key', input.providerKey);
  assertSafePathSegment('command name', input.command);

  const relativePath = join('.claude', 'aco', 'prompts', input.providerKey, `${input.command}.md`);
  const candidates: string[] = [];
  const seen = new Set<string>();

  let current = resolve(input.cwd);
  while (true) {
    const candidate = join(current, relativePath);
    if (!seen.has(candidate)) {
      candidates.push(candidate);
      seen.add(candidate);
    }

    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  const homeCandidate = join(resolve(input.home), relativePath);
  if (!seen.has(homeCandidate)) {
    candidates.push(homeCandidate);
  }

  return candidates;
}

export async function resolveRunPromptTemplate(
  input: RunPromptTemplateInput
): Promise<RunPromptTemplateResult> {
  const candidates = getPromptTemplateCandidates(input);

  for (const candidate of candidates) {
    try {
      return {
        prompt: await readFile(candidate, 'utf8'),
        promptTemplatePath: candidate,
      };
    } catch (err) {
      if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
        continue;
      }
      throw err;
    }
  }

  if (DOCUMENTED_PROMPT_COMMANDS.has(`${input.providerKey}:${input.command}`)) {
    throw new Error(
      [
        `Missing prompt template for documented command '${input.providerKey} ${input.command}'.`,
        `Checked: ${candidates.join(', ')}`,
        "Run 'aco pack setup' again, or restore the packaged prompt template before invoking the provider.",
      ].join(' ')
    );
  }

  return {
    prompt: `You are a code reviewer. Perform a ${input.command} for the following content.`,
  };
}
