/**
 * usage-parse.ts
 *
 * Gemini/Codex native session 로그에서 usage 필드(입력 토큰, 출력 토큰, 모델)를
 * 파싱하는 헬퍼 모듈.
 *
 * 각 provider별 네이티브 세션 파일을 찾아 마지막 항목을 읽고,
 * 파싱 실패 또는 파일 미발견 시 unavailable/parse_error를 반환한다.
 *
 * Gemini 경로는 tail-block reverse read 알고리즘을 사용해 파일 전체를 메모리에
 * 적재하지 않고 마지막 JSONL 라인만 추출한다 (#137). 마지막 라인이
 * MAX_LAST_LINE_BYTES(1 MB)를 초과하면 parse_error로 분류한다.
 */

import { readdir, open } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface UsageResult {
  usageStatus: 'captured' | 'unavailable' | 'parse_error';
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  nativeSessionPath?: string;
}

const MAX_JSONL_BYTES = 10 * 1024 * 1024; // 10 MB — file-size guard
const TAIL_BLOCK_BYTES = 8 * 1024; // 8 KB — tail-block reverse-read unit
const MAX_LAST_LINE_BYTES = 1 * 1024 * 1024; // 1 MB — 마지막 라인 안전 상한

/**
 * 파일이 MAX_JSONL_BYTES를 초과하는 경우를 호출자에게 알리는 sentinel.
 * 별도 stat() pre-check를 두지 않고 open() 직후 handle.stat()으로 일원화하여
 * TOCTOU 윈도우를 닫는다.
 */
const FILE_TOO_LARGE = Symbol('FILE_TOO_LARGE');

/**
 * 파일 끝에서부터 블록을 역방향으로 읽어 마지막 한 줄(trailing newline 제외)을
 * 반환한다. 파일 전체를 메모리에 적재하지 않으며, 마지막 newline 이후의 본문만
 * 디코드한다.
 *
 * 반환값:
 * - 정상: 마지막 라인 문자열 (trailing newline은 제거됨)
 * - 빈 파일 / newline-only 파일: 빈 문자열 ('')
 * - 파일 크기가 MAX_JSONL_BYTES를 초과: FILE_TOO_LARGE sentinel (호출자가 unavailable로 분류)
 * - 마지막 라인 크기가 MAX_LAST_LINE_BYTES를 초과: null (호출자가 parse_error로 분류)
 */
async function readLastJsonlLine(filePath: string): Promise<string | null | typeof FILE_TOO_LARGE> {
  const handle = await open(filePath, 'r');
  try {
    const { size } = await handle.stat();
    if (size > MAX_JSONL_BYTES) {
      return FILE_TOO_LARGE;
    }
    if (size === 0) {
      return '';
    }

    // tail 쪽으로 누적해 가는 버퍼. 가장 오른쪽 바이트가 파일 끝이다.
    let tail: Buffer = Buffer.alloc(0);
    let position = size;
    // 본문(non-newline) byte가 한 번이라도 관찰되었는지. newline-only 파일을
    // 기존 readFile 구현과 동일하게 unavailable로 매핑하기 위한 추적값이다.
    let hasContent = false;

    while (position > 0) {
      const desiredLen = Math.min(TAIL_BLOCK_BYTES, position);
      // allocUnsafe: 직후 read()가 [0, bytesRead) 영역을 채우고, 우리는 정확히
      // 그 영역만 subarray로 사용하므로 uninitialized 메모리가 새지 않는다.
      const block = Buffer.allocUnsafe(desiredLen);
      const { bytesRead } = await handle.read(block, 0, desiredLen, position - desiredLen);
      if (bytesRead === 0) {
        // 더 이상 읽어들일 바이트가 없다. 부분 읽기 또는 동시 truncation으로
        // 도달 가능. 누적된 tail을 그대로 사용하여 종료한다.
        break;
      }
      position -= bytesRead;
      const actualBlock = bytesRead === desiredLen ? block : block.subarray(0, bytesRead);
      if (!hasContent && containsNonNewline(actualBlock)) {
        hasContent = true;
      }
      tail = Buffer.concat([actualBlock, tail]);

      const lineStart = findLastLineStart(tail);
      if (lineStart !== -1) {
        if (tail.length - lineStart > MAX_LAST_LINE_BYTES) {
          return null;
        }
        return decodeLineRange(tail, lineStart);
      }

      if (tail.length > MAX_LAST_LINE_BYTES) {
        // 본문 newline을 아직 못 만났는데 누적 tail이 안전 상한을 넘었다.
        // - 본문이 없었다면(newline-only) 기존 readFile 구현과 동일하게 '' →
        //   unavailable로 매핑한다.
        // - 본문이 있었다면 진짜로 단일 라인이 1 MB를 초과한 것으로 parse_error.
        return hasContent ? null : '';
      }
    }

    // 파일 앞까지 도달했고 본문 newline을 만나지 못했다.
    if (!hasContent) {
      // newline-only 또는 빈 본문 — unavailable로 매핑.
      return '';
    }
    if (tail.length > MAX_LAST_LINE_BYTES) {
      return null;
    }
    return decodeLineRange(tail, 0);
  } finally {
    await handle.close();
  }
}

/** Buffer에 newline(0x0a)이 아닌 byte가 하나라도 존재하는지. */
function containsNonNewline(buf: Buffer): boolean {
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] !== 0x0a) {
      return true;
    }
  }
  return false;
}

/**
 * 누적된 tail 버퍼에서 "마지막 라인이 시작하는 인덱스"를 반환한다. 마지막 줄을
 * 식별하기 위해 끝쪽 연속된 newline은 무시한다.
 *
 * 반환값이 -1이면 본문 내 newline이 아직 발견되지 않은 상태이므로 호출자가
 * 추가 블록을 더 읽어야 한다. 본문이 비어 있으면(파일이 newline만 포함) -1을
 * 반환해 호출자가 추가 블록을 읽도록 한다.
 *
 * 사후조건: tail이 완전히 빈 Buffer로 전달되는 경우는 호출자(readLastJsonlLine)의
 * size === 0 early return으로 이미 차단되므로 도달하지 않는다.
 */
function findLastLineStart(tail: Buffer): number {
  let contentEnd = tail.length;
  while (contentEnd > 0 && tail[contentEnd - 1] === 0x0a) {
    contentEnd--;
  }
  if (contentEnd === 0) {
    // 본문 없음(newline만 있거나 빈 버퍼) — 호출자가 더 읽어야 한다
    return -1;
  }
  const lastNewline = tail.lastIndexOf(0x0a, contentEnd - 1);
  if (lastNewline === -1) {
    return -1;
  }
  return lastNewline + 1;
}

/** 라인 시작 인덱스부터 끝의 newline을 trim한 본문 문자열을 반환한다. */
function decodeLineRange(tail: Buffer, lineStart: number): string {
  let end = tail.length;
  while (end > lineStart && tail[end - 1] === 0x0a) {
    end--;
  }
  return tail.subarray(lineStart, end).toString('utf8');
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
      // session ID와 파일명 매칭
      if (!jsonlFile.includes(sessionId)) {
        continue;
      }

      const filePath = join(chatDir, jsonlFile);

      // open()과 size guard를 readLastJsonlLine 내부로 일원화한다. 외부 stat()을
      // 두면 stat()과 open() 사이에 파일이 커지는 TOCTOU 윈도우가 생기므로,
      // 한 번 연 fd로 size를 재확인하여 spec 계약("size > 10MB → unavailable")을
      // 유지한다.
      let lastLine: string | null | typeof FILE_TOO_LARGE;
      try {
        lastLine = await readLastJsonlLine(filePath);
      } catch {
        return { usageStatus: 'parse_error', nativeSessionPath: filePath };
      }

      if (lastLine === FILE_TOO_LARGE) {
        return { usageStatus: 'unavailable' };
      }
      if (lastLine === null) {
        // 마지막 라인이 MAX_LAST_LINE_BYTES를 초과 → 안전 상한 위반
        return { usageStatus: 'parse_error', nativeSessionPath: filePath };
      }
      if (lastLine === '') {
        return { usageStatus: 'unavailable' };
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(lastLine) as Record<string, unknown>;
      } catch {
        return { usageStatus: 'parse_error', nativeSessionPath: filePath };
      }

      const inputTokens =
        typeof parsed['totalInputTokenCount'] === 'number'
          ? parsed['totalInputTokenCount']
          : undefined;
      const outputTokens =
        typeof parsed['totalOutputTokenCount'] === 'number'
          ? parsed['totalOutputTokenCount']
          : undefined;
      const model = typeof parsed['modelVersion'] === 'string' ? parsed['modelVersion'] : undefined;

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
