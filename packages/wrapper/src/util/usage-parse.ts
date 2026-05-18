/**
 * usage-parse.ts
 *
 * Gemini/Codex native session 로그에서 usage 필드(입력 토큰, 출력 토큰, 모델)를
 * 파싱하는 헬퍼 모듈.
 *
 * 각 provider별 네이티브 세션 파일을 찾아 마지막 항목을 읽고,
 * 파싱 실패 또는 파일 미발견 시 unavailable/parse_error를 반환한다.
 */

import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface UsageResult {
  usageStatus: 'captured' | 'unavailable' | 'parse_error';
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  nativeSessionPath?: string;
}

/**
 * Gemini CLI native session 로그에서 usage를 파싱한다.
 *
 * Gemini는 ~/.gemini/tmp/<uuid>/chats/session-<id>.jsonl 형식으로 대화를 기록한다.
 * sessionId를 기반으로 해당 파일을 탐색하고, 마지막 JSONL 라인에서
 * totalInputTokenCount / totalOutputTokenCount / modelVersion 필드를 읽는다.
 *
 * @param sessionId - ACO session ID (Gemini 내부 세션 ID와 매칭 시도)
 */
export async function parseGeminiUsage(sessionId: string): Promise<UsageResult> {
  const geminiTmpDir = join(homedir(), '.gemini', 'tmp');

  let tmpEntries: string[];
  try {
    tmpEntries = await readdir(geminiTmpDir);
  } catch {
    return { usageStatus: 'unavailable' };
  }

  // sessionId 또는 가장 최근에 수정된 파일을 탐색한다
  for (const tmpEntry of tmpEntries) {
    const chatDir = join(geminiTmpDir, tmpEntry, 'chats');
    let chatFiles: string[];
    try {
      chatFiles = await readdir(chatDir);
    } catch {
      continue;
    }

    const jsonlFiles = chatFiles.filter((f) => f.endsWith('.jsonl'));
    for (const jsonlFile of jsonlFiles) {
      // session ID와 파일명 매칭 시도
      if (!jsonlFile.includes(sessionId) && jsonlFiles.length > 1) {
        continue;
      }

      const filePath = join(chatDir, jsonlFile);
      try {
        const content = await readFile(filePath, 'utf8');
        const lines = content.trim().split('\n').filter(Boolean);
        if (lines.length === 0) {
          return { usageStatus: 'unavailable' };
        }

        const lastLine = lines[lines.length - 1];
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(lastLine) as Record<string, unknown>;
        } catch {
          return { usageStatus: 'parse_error', nativeSessionPath: filePath };
        }

        const inputTokens =
          typeof parsed['totalInputTokenCount'] === 'number'
            ? (parsed['totalInputTokenCount'] as number)
            : undefined;
        const outputTokens =
          typeof parsed['totalOutputTokenCount'] === 'number'
            ? (parsed['totalOutputTokenCount'] as number)
            : undefined;
        const model =
          typeof parsed['modelVersion'] === 'string'
            ? (parsed['modelVersion'] as string)
            : undefined;

        if (inputTokens === undefined && outputTokens === undefined && model === undefined) {
          return { usageStatus: 'parse_error', nativeSessionPath: filePath };
        }

        return {
          usageStatus: 'captured',
          model,
          inputTokens,
          outputTokens,
          nativeSessionPath: filePath,
        };
      } catch {
        return { usageStatus: 'parse_error', nativeSessionPath: filePath };
      }
    }
  }

  return { usageStatus: 'unavailable' };
}

/**
 * Codex native session 로그에서 usage를 파싱한다.
 *
 * 현재 Codex는 표준화된 session 로그 포맷을 노출하지 않으므로
 * unavailable을 반환한다.
 *
 * @param _sessionId - ACO session ID (미래 매칭용)
 */
export async function parseCodexUsage(_sessionId: string): Promise<UsageResult> {
  // TODO: ~/.codex/ 내 session output에서 token info 파싱 구현
  return { usageStatus: 'unavailable' };
}
