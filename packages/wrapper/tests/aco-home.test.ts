import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { acoHome } from '../src/util/aco-home.js';

const ORIGINAL = process.env.ACO_HOME;

function restore(): void {
  if (ORIGINAL === undefined) delete process.env.ACO_HOME;
  else process.env.ACO_HOME = ORIGINAL;
}

describe('acoHome', () => {
  afterEach(restore);

  it('defaults to ~/.aco when ACO_HOME is unset', () => {
    delete process.env.ACO_HOME;
    assert.equal(acoHome(), join(homedir(), '.aco'));
  });

  it('uses ACO_HOME when set', () => {
    process.env.ACO_HOME = '/tmp/aco-test-home';
    assert.equal(acoHome(), '/tmp/aco-test-home');
  });

  it('trims surrounding whitespace from ACO_HOME', () => {
    process.env.ACO_HOME = '  /tmp/aco-test-home  ';
    assert.equal(acoHome(), '/tmp/aco-test-home');
  });

  it('resolves a relative ACO_HOME to an absolute path', () => {
    process.env.ACO_HOME = './aco-rel-home';
    assert.equal(acoHome(), resolve('./aco-rel-home'));
  });

  it('falls back to ~/.aco when ACO_HOME is empty or whitespace', () => {
    process.env.ACO_HOME = '   ';
    assert.equal(acoHome(), join(homedir(), '.aco'));
  });
});
