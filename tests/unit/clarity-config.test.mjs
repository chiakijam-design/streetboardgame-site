import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Clarityに必要な通信先だけをCSPで許可する', async () => {
  const worker = await readFile(new URL('../../_worker.js', import.meta.url), 'utf8');
  const staticHeaders = await readFile(new URL('../../_headers', import.meta.url), 'utf8');

  for (const source of [worker, staticHeaders]) {
    assert.match(source, /script-src[^\n]+https:\/\/www\.clarity\.ms[^\n]+https:\/\/scripts\.clarity\.ms/);
    assert.match(source, /img-src[^\n]+https:\/\/c\.clarity\.ms/);
    assert.match(source, /connect-src[^\n]+https:\/\/h\.clarity\.ms/);
    assert.doesNotMatch(source, /https:\/\/\*\.clarity\.ms/);
    assert.match(source, /frame-src 'none'/);
  }
});
