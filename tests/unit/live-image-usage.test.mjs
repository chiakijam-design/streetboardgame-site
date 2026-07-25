import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import {
  classifyLiveImageTransformUsage,
  recordLiveImageTransformUsage,
} from '../../src/live/ops.js';

test('Cloudflare Imagesの月間変換数を通常・黄色・赤色へ分類する', () => {
  assert.equal(classifyLiveImageTransformUsage({ successful_transformations: 3_999 }).status, 'normal');
  assert.equal(classifyLiveImageTransformUsage({ successful_transformations: 4_000 }).status, 'yellow');
  assert.equal(classifyLiveImageTransformUsage({ successful_transformations: 4_799 }).status, 'yellow');
  assert.equal(classifyLiveImageTransformUsage({ successful_transformations: 4_800 }).status, 'red');
});

test('9422フォールバックが1件でもあれば赤色警告にする', () => {
  const usage = classifyLiveImageTransformUsage({
    usage_month: '2026-07',
    source_images: 2_500,
    successful_transformations: 4_700,
    limit_fallbacks: 1,
    updated_at: 123,
  });
  assert.equal(usage.status, 'red');
  assert.equal(usage.freeLimit, 5_000);
  assert.equal(usage.warningAt, 4_000);
  assert.equal(usage.criticalAt, 4_800);
  assert.equal(usage.limitFallbacks, 1);
});

test('実SQLiteで月次利用量と黄色・赤色・9422イベントを記録する', async () => {
  const sqlite = new DatabaseSync(':memory:');
  const env = { REMOTE_DB: d1Adapter(sqlite) };
  const now = Date.parse('2026-07-25T00:00:00Z');

  const yellow = await recordLiveImageTransformUsage(env, {
    now, code: '123456', sourceImages: 2_000, successfulTransformations: 4_000,
  });
  assert.equal(yellow.status, 'yellow');

  const red = await recordLiveImageTransformUsage(env, {
    now: now + 1, code: '123456', sourceImages: 400, successfulTransformations: 800,
  });
  assert.equal(red.status, 'red');

  const fallback = await recordLiveImageTransformUsage(env, {
    now: now + 2, code: '123456', sourceImages: 1, limitFallbacks: 1,
  });
  assert.equal(fallback.sourceImages, 2_401);
  assert.equal(fallback.successfulTransformations, 4_800);
  assert.equal(fallback.limitFallbacks, 1);
  await recordLiveImageTransformUsage(env, {
    now: now + 3, code: '654321', sourceImages: 1, limitFallbacks: 1,
  });

  const events = sqlite.prepare(`
    SELECT event_type FROM live_ops_events WHERE category = 'images'
  `).all().map((row) => row.event_type).sort();
  assert.deepEqual(events, [
    'images-transform-limit-reached',
    'images-transform-usage-critical',
    'images-transform-usage-warning',
  ].sort());
});

function d1Adapter(sqlite) {
  return {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return {
        bindings: [],
        bind(...bindings) { this.bindings = bindings; return this; },
        async first() { return statement.get(...this.bindings) || null; },
        async all() { return { results: statement.all(...this.bindings) }; },
        async run() {
          const result = statement.run(...this.bindings);
          return { meta: { changes: Number(result.changes) } };
        },
      };
    },
  };
}
