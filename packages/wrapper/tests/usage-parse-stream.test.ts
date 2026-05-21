/**
 * usage-parse-stream.test.ts
 *
 * gemini-usage-telemetry spec 회귀 테스트.
 *
 * - 마지막 JSONL 라인만 반환된다 (다중 라인, trailing newline 유무 무관).
 * - 빈 파일, malformed last line, usage 필드 누락에 대해 기존 분기를 보존한다.
 * - 신규: 마지막 라인이 1 MB(MAX_LAST_LINE_BYTES)를 초과하면 parse_error로 분류한다.
 *
 * `~/.gemini/tmp/<uuid>/chats/session-<id>.jsonl` 레이아웃을 fake HOME 디렉토리에
 * 만들어 parseGeminiUsage가 실제 파일을 읽어들이도록 한다.
 */

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseGeminiUsage } from '../src/util/usage-parse.js';

/** 한 시나리오를 위한 fake HOME + chat 디렉토리 + JSONL 파일을 만든다. */
async function makeSessionFile(opts: {
  fakeHome: string;
  tmpUuid?: string;
  fileName?: string;
  content: string;
}): Promise<string> {
  const { fakeHome, tmpUuid = 'fake-uuid', fileName = 'session-stream.jsonl', content } = opts;
  const chatDir = join(fakeHome, '.gemini', 'tmp', tmpUuid, 'chats');
  await mkdir(chatDir, { recursive: true });
  const filePath = join(chatDir, fileName);
  await writeFile(filePath, content, { encoding: 'utf8' });
  return filePath;
}

describe('parseGeminiUsage last-line stream contract', () => {
  let fakeHome: string;
  let originalHome: string | undefined;

  before(() => {
    originalHome = process.env['HOME'];
  });

  after(() => {
    if (originalHome !== undefined) {
      process.env['HOME'] = originalHome;
    } else {
      delete process.env['HOME'];
    }
  });

  beforeEach(async () => {
    fakeHome = await mkdtemp(join(tmpdir(), 'aco-usage-parse-stream-'));
    process.env['HOME'] = fakeHome;
  });

  afterEach(async () => {
    // chmod 000 으로 잠금된 fixture가 남아 있으면 rm이 실패하므로 복원 후 제거한다.
    await chmod(fakeHome, 0o755).catch(() => {});
    await rm(fakeHome, { recursive: true, force: true });
  });

  // ── tmp 디렉토리 미존재 → unavailable ─────────────────────────────────────
  it('returns unavailable when ~/.gemini/tmp does not exist at all', async () => {
    // fakeHome은 mkdtemp로 만들었지만 .gemini/tmp는 아직 없음.
    const result = await parseGeminiUsage('test');
    assert.equal(result.usageStatus, 'unavailable');
  });

  // ── 다중 라인 — 마지막 라인 wins ───────────────────────────────────────────
  it('returns usage from the last line when multiple JSONL records exist', async () => {
    const earlier = JSON.stringify({ totalInputTokenCount: 1, totalOutputTokenCount: 1, modelVersion: 'old' });
    const middle = JSON.stringify({ totalInputTokenCount: 2, totalOutputTokenCount: 2, modelVersion: 'mid' });
    const last = JSON.stringify({
      totalInputTokenCount: 999,
      totalOutputTokenCount: 333,
      modelVersion: 'gemini-2.5-flash',
    });
    await makeSessionFile({ fakeHome, content: `${earlier}\n${middle}\n${last}\n` });

    const result = await parseGeminiUsage('test');
    assert.equal(result.usageStatus, 'captured');
    assert.equal(result.inputTokens, 999);
    assert.equal(result.outputTokens, 333);
    assert.equal(result.model, 'gemini-2.5-flash');
  });

  // ── trailing newline 없는 경우 ─────────────────────────────────────────────
  it('returns usage from the last line when file has no trailing newline', async () => {
    const earlier = JSON.stringify({ totalInputTokenCount: 5, totalOutputTokenCount: 5, modelVersion: 'old' });
    const last = JSON.stringify({
      totalInputTokenCount: 42,
      totalOutputTokenCount: 21,
      modelVersion: 'gemini-2.5-pro',
    });
    await makeSessionFile({ fakeHome, content: `${earlier}\n${last}` });

    const result = await parseGeminiUsage('test');
    assert.equal(result.usageStatus, 'captured');
    assert.equal(result.inputTokens, 42);
    assert.equal(result.outputTokens, 21);
    assert.equal(result.model, 'gemini-2.5-pro');
  });

  // ── 빈 파일 → unavailable ─────────────────────────────────────────────────
  it('returns unavailable for an empty JSONL file', async () => {
    await makeSessionFile({ fakeHome, content: '' });
    const result = await parseGeminiUsage('test');
    assert.equal(result.usageStatus, 'unavailable');
  });

  // ── 모두 newline만 있는 파일 → unavailable ────────────────────────────────
  it('returns unavailable for a JSONL file containing only newlines', async () => {
    await makeSessionFile({ fakeHome, content: '\n\n\n' });
    const result = await parseGeminiUsage('test');
    assert.equal(result.usageStatus, 'unavailable');
  });

  // ── newline-only가 MAX_LAST_LINE_BYTES를 초과해도 unavailable ────────────
  //
  // 기존 readFile 구현은 `content.trim().split('\n').filter(Boolean)` 후
  // lines.length === 0 → unavailable로 매핑했다. tail-block reverse read 구현
  // 도입 이후 1 MB 초과 newline-only 파일이 parse_error로 오분류되어 분기
  // 호환성이 깨졌다(PR #138 review r3274272924). 이 회귀 케이스는 본 contract을
  // 다시 보장한다. 파일 자체는 10 MB 미만(MAX_JSONL_BYTES 통과)이어야 한다.
  it('returns unavailable for a newline-only file larger than MAX_LAST_LINE_BYTES (1 MB)', async () => {
    // 2 MB의 \n. MAX_LAST_LINE_BYTES(1 MB) 초과, MAX_JSONL_BYTES(10 MB) 미만.
    const content = '\n'.repeat(2 * 1024 * 1024);
    await makeSessionFile({ fakeHome, content });

    const result = await parseGeminiUsage('test');
    assert.equal(
      result.usageStatus,
      'unavailable',
      `newline-only 파일은 크기와 무관하게 unavailable. 실제: ${result.usageStatus}`
    );
  });

  // ── malformed JSON last line → parse_error + nativeSessionPath ───────────
  it('returns parse_error when the last JSONL line is not valid JSON', async () => {
    const filePath = await makeSessionFile({
      fakeHome,
      content: '{"totalInputTokenCount":1,"totalOutputTokenCount":1,"modelVersion":"a"}\nNOT_JSON\n',
    });
    const result = await parseGeminiUsage('test');
    assert.equal(result.usageStatus, 'parse_error');
    assert.equal(result.nativeSessionPath, filePath);
  });

  // ── usage 필드 누락 → parse_error ─────────────────────────────────────────
  it('returns parse_error when the last line is valid JSON but lacks usage fields', async () => {
    const filePath = await makeSessionFile({
      fakeHome,
      content: '{"unrelated":"payload"}\n',
    });
    const result = await parseGeminiUsage('test');
    assert.equal(result.usageStatus, 'parse_error');
    assert.equal(result.nativeSessionPath, filePath);
  });

  // ── 1 MB+ 단일 라인 → parse_error (신규: MAX_LAST_LINE_BYTES) ────────────
  //
  // 본 시나리오는 새 tail-block 알고리즘이 도입하는 안전 상한이다. 단일 라인이
  // 1 MB(MAX_LAST_LINE_BYTES)를 초과하면 streaming 추출 자체를 포기하고
  // parse_error로 분류해야 한다. 기존 readFile 기반 구현에서는 valid JSON으로
  // captured를 반환하므로, 이 테스트는 GREEN 단계에서만 통과한다.
  it('returns parse_error when the last JSONL line exceeds MAX_LAST_LINE_BYTES (1 MB)', async () => {
    // padding 1.1 MB → 전체 JSON 객체는 1 MB를 확실히 초과한다.
    const padding = 'x'.repeat(1.1 * 1024 * 1024);
    const huge = JSON.stringify({
      totalInputTokenCount: 7,
      totalOutputTokenCount: 7,
      modelVersion: 'gemini-2.5-flash',
      padding,
    });
    // 앞 줄은 정상 라인. 마지막 줄이 초과 대상.
    const earlier = JSON.stringify({ totalInputTokenCount: 1, totalOutputTokenCount: 1, modelVersion: 'a' });
    const filePath = await makeSessionFile({ fakeHome, content: `${earlier}\n${huge}\n` });

    const result = await parseGeminiUsage('test');
    assert.equal(
      result.usageStatus,
      'parse_error',
      `1 MB 초과 단일 라인은 parse_error여야 한다. 실제: ${result.usageStatus}`
    );
    assert.equal(result.nativeSessionPath, filePath);
  });

  // ── 경계 케이스: 마지막 newline이 첫 8 KB tail-block 너머에 위치 ─────────
  //
  // tail-block reverse read가 첫 블록에서 마지막 newline을 못 찾아 추가 블록을
  // 더 읽어야 하는 경로를 검증한다. earlier 라인을 8 KB 이상으로 부풀려 newline
  // 위치를 파일 끝에서 8 KB 이상 떨어뜨린다.
  it('reads beyond a single 8 KB tail block when needed to find the last newline', async () => {
    const fatEarlier = JSON.stringify({
      totalInputTokenCount: 1,
      totalOutputTokenCount: 1,
      modelVersion: 'pad',
      padding: 'y'.repeat(16 * 1024), // 16 KB padding → 한 줄이 16 KB+
    });
    const last = JSON.stringify({
      totalInputTokenCount: 88,
      totalOutputTokenCount: 99,
      modelVersion: 'gemini-2.5-boundary',
    });
    await makeSessionFile({ fakeHome, content: `${fatEarlier}\n${last}\n` });

    const result = await parseGeminiUsage('test');
    assert.equal(result.usageStatus, 'captured');
    assert.equal(result.inputTokens, 88);
    assert.equal(result.outputTokens, 99);
    assert.equal(result.model, 'gemini-2.5-boundary');
  });

  // ── 경계 케이스: 마지막 라인이 ~ 800 KB (MAX_LAST_LINE_BYTES 직전) ────────
  //
  // 1 MB 미만이지만 충분히 큰 단일 라인은 정상 captured를 반환해야 한다.
  // MAX_LAST_LINE_BYTES 경계 바로 아래에서 알고리즘이 over-reject 하지 않는지
  // 확인한다.
  it('returns captured for a ~800 KB last line just under MAX_LAST_LINE_BYTES', async () => {
    const padding = 'z'.repeat(800 * 1024); // 800 KB
    const big = JSON.stringify({
      totalInputTokenCount: 7,
      totalOutputTokenCount: 7,
      modelVersion: 'gemini-2.5-undermax',
      padding,
    });
    await makeSessionFile({ fakeHome, content: `${big}\n` });

    const result = await parseGeminiUsage('test');
    assert.equal(result.usageStatus, 'captured');
    assert.equal(result.inputTokens, 7);
    assert.equal(result.outputTokens, 7);
    assert.equal(result.model, 'gemini-2.5-undermax');
  });

  // ── open() 실패 (권한 거부) → parse_error 분기 검증 ────────────────────────
  //
  // stat() → open() 사이의 race 또는 권한 변경으로 open이 실패할 수 있다.
  // chmod 000 으로 강제로 EACCES를 일으켜 try/catch 경로가 parse_error를
  // 반환하는지 확인한다 (macOS/Linux POSIX 전제).
  it('returns parse_error when readLastJsonlLine throws (permission denied)', async () => {
    if (process.getuid !== undefined && process.getuid() === 0) {
      // root는 chmod 000을 무시하므로 의미 있는 검증이 어렵다.
      return;
    }
    const filePath = await makeSessionFile({
      fakeHome,
      content: '{"totalInputTokenCount":1,"totalOutputTokenCount":1,"modelVersion":"x"}\n',
    });
    await chmod(filePath, 0o000);

    const result = await parseGeminiUsage('test');
    assert.equal(result.usageStatus, 'parse_error');
    assert.equal(result.nativeSessionPath, filePath);

    // 다음 afterEach가 rm 가능하도록 복원
    await chmod(filePath, 0o644);
  });

  // ── 큰 파일이지만 라인 자체는 짧은 경우 — 정상 captured ──────────────────
  //
  // 다수의 짧은 라인이 누적되어 파일이 ~1 MB가 되더라도, 마지막 라인 자체가
  // MAX_LAST_LINE_BYTES 이하면 정상적으로 captured를 반환해야 한다. 이 시나리오는
  // tail-block 알고리즘의 정상 경로를 검증한다.
  it('returns captured for a ~1 MB file made of many short JSONL records', async () => {
    const shortLine = JSON.stringify({ totalInputTokenCount: 1, totalOutputTokenCount: 1, modelVersion: 'pad' });
    const lastLine = JSON.stringify({
      totalInputTokenCount: 123,
      totalOutputTokenCount: 456,
      modelVersion: 'gemini-2.5-tail',
    });
    // 짧은 라인을 누적해 ~1 MB 만든 뒤 마지막 라인을 추가한다.
    const padRepeat = Math.ceil((1 * 1024 * 1024) / (shortLine.length + 1));
    const content = `${(shortLine + '\n').repeat(padRepeat)}${lastLine}\n`;
    await makeSessionFile({ fakeHome, content });

    const result = await parseGeminiUsage('test');
    assert.equal(result.usageStatus, 'captured');
    assert.equal(result.inputTokens, 123);
    assert.equal(result.outputTokens, 456);
    assert.equal(result.model, 'gemini-2.5-tail');
  });
});
