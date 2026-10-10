import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { TARGET_LOCALES } from '../../src/i18n/locales.js';

test('locale worker routing stays within Cloudflare rule limit and covers all public entries', () => {
  const source = readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8');
  const body = source.match(/"run_worker_first"\s*:\s*\[([\s\S]*?)\]/)?.[1];
  assert.ok(body);
  const rules = JSON.parse('[' + body.replace(/\/\/[^\n]*/g, '') + ']');
  assert.ok(rules.length <= 100, `${rules.length} worker routing rules exceeds 100`);
  assert.ok(rules.includes('/'));
  for (const locale of TARGET_LOCALES.filter(value => value !== 'ja')) {
    assert.ok(rules.includes('/' + locale), locale + ' bare entry');
    assert.ok(rules.includes('/' + locale + '/*'), locale + ' public and game paths');
  }
});
