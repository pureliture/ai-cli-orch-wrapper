import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

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

const DOCUMENTED_PROMPT_COMMANDS = new Set(['gemini:review', 'codex:review']);

export async function resolveRunPromptTemplate(
  input: RunPromptTemplateInput
): Promise<RunPromptTemplateResult> {
  const relativePath = join('.claude', 'aco', 'prompts', input.providerKey, `${input.command}.md`);
  const candidates = [join(input.cwd, relativePath), join(input.home, relativePath)];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return {
        prompt: await readFile(candidate, 'utf8'),
        promptTemplatePath: candidate,
      };
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
