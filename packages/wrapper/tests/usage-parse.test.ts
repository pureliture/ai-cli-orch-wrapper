/**
 * usage-parse.test.ts
 *
 * parseGeminiUsage 파일 크기 가드 검증.
 * 10MB를 초과하는 .jsonl 파일은 usageStatus: 'unavailable'을 반환해야 한다.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import { parseGeminiUsage } from '../src/util/usage-parse.js';

describe('parseGeminiUsage file size guard', () => {
  let fakeHome: string;
  let originalHome: string | undefined;

  before(async () => {
    fakeHome = await mkdtemp(join(tmpdir(), 'aco-usage-parse-large-'));
    originalHome = process.env['HOME'];
    process.env['HOME'] = fakeHome;
  });

  after(async () => {
    if (originalHome !== undefined) {
      process.env['HOME'] = originalHome;
    } else {
      delete process.env['HOME'];
    }
    await rm(fakeHome, { recursive: true, force: true });
  });

  it('returns unavailable when .jsonl file exceeds 10 MB', async () => {
    const chatDir = join(fakeHome, '.gemini', 'tmp', 'fake-uuid', 'chats');
    await mkdir(chatDir, { recursive: true });

    const filePath = join(chatDir, 'session-large.jsonl');
    // 10MB + 1바이트 크기의 파일 생성
    const fd = await open(filePath, 'w');
    const chunk = Buffer.alloc(1024 * 1024, 'x');
    for (let i = 0; i < 10; i++) {
      await fd.write(chunk);
    }
    await fd.write(Buffer.alloc(1, 'x'));
    await fd.close();

    const fileStats = await stat(filePath);
    assert.ok(
      fileStats.size > 10 * 1024 * 1024,
      `파일 크기 ${fileStats.size}가 10MB를 초과해야 함`
    );

    const result = await parseGeminiUsage('session');
    assert.equal(result.usageStatus, 'unavailable');
  });
});

describe('parseGeminiUsage valid content within size limit', () => {
  let fakeHome: string;
  let originalHome: string | undefined;

  before(async () => {
    fakeHome = await mkdtemp(join(tmpdir(), 'aco-usage-parse-small-'));
    originalHome = process.env['HOME'];
    process.env['HOME'] = fakeHome;
  });

  after(async () => {
    if (originalHome !== undefined) {
      process.env['HOME'] = originalHome;
    } else {
      delete process.env['HOME'];
    }
    await rm(fakeHome, { recursive: true, force: true });
  });

  it('returns captured when .jsonl file is within 10 MB and has valid content', async () => {
    const chatDir = join(fakeHome, '.gemini', 'tmp', 'fake-uuid-small', 'chats');
    await mkdir(chatDir, { recursive: true });

    const validLine = JSON.stringify({
      totalInputTokenCount: 100,
      totalOutputTokenCount: 50,
      modelVersion: 'gemini-2.0-flash',
    });
    const filePath = join(chatDir, 'session-small.jsonl');
    await writeFile(filePath, validLine + '\n', { encoding: 'utf8' });

    const result = await parseGeminiUsage('session');
    assert.equal(result.usageStatus, 'captured');
    assert.equal(result.inputTokens, 100);
    assert.equal(result.outputTokens, 50);
    assert.equal(result.model, 'gemini-2.0-flash');
  });
});
