import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import {
  billingPeriod,
  ensureSocialPublishingD1,
  ensureXCampaignSchedule,
  runSocialPublishing,
} from '../../src/social/publisher.js';

const CREDENTIALS = {
  SOCIAL_X_CONSUMER_KEY: 'consumer-key',
  SOCIAL_X_CONSUMER_SECRET: 'consumer-secret',
  SOCIAL_X_ACCESS_TOKEN: 'access-token',
  SOCIAL_X_ACCESS_TOKEN_SECRET: 'access-secret',
};

test('自動投稿が無効ならDBや通信へ触れない', async () => {
  let fetched = false;
  const summary = await runSocialPublishing({}, Date.now(), {
    fetchImpl: async () => {
      fetched = true;
      throw new Error('unexpected');
    },
  });
  assert.equal(summary.enabled, false);
  assert.equal(fetched, false);
});

test('平日2週間分を一度だけキューへ登録する', async () => {
  const sqlite = new DatabaseSync(':memory:');
  const env = { REMOTE_DB: d1Adapter(sqlite) };
  await ensureSocialPublishingD1(env);
  const now = Date.parse('2026-07-27T00:00:00Z');
  const first = await ensureXCampaignSchedule(env, now);
  const second = await ensureXCampaignSchedule(env, now);
  assert.equal(first, 10);
  assert.equal(second, 0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM social_posts').get().count, 10);
});

test('X投稿を署名して成功状態と利用額を記録する', async () => {
  const sqlite = new DatabaseSync(':memory:');
  const env = {
    REMOTE_DB: d1Adapter(sqlite),
    SOCIAL_PUBLISHING_ENABLED: 'true',
    ...CREDENTIALS,
  };
  const now = Date.parse('2026-07-27T10:30:00Z');
  let request;
  const summary = await runSocialPublishing(env, now, {
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ data: { id: 'x-post-1' } }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert.equal(summary.published, 1);
  assert.equal(request.url, 'https://api.x.com/2/tweets');
  assert.match(request.init.headers.authorization, /^OAuth /);
  assert.match(JSON.parse(request.init.body).text, /streetboardgame\.com/);
  assert.match(JSON.parse(request.init.body).text, /utm_source=x&utm_medium=social&utm_campaign=always_on/);
  const post = sqlite.prepare("SELECT status, external_id FROM social_posts WHERE status = 'published'").get();
  assert.equal(post.status, 'published');
  assert.equal(post.external_id, 'x-post-1');
  const usage = sqlite.prepare('SELECT estimated_cost_micro_usd, post_count FROM social_billing_usage').get();
  assert.equal(usage.estimated_cost_micro_usd, 200_000);
  assert.equal(usage.post_count, 1);
});

test('サイト側予算を超える投稿は通信せず次期へ送る', async () => {
  const sqlite = new DatabaseSync(':memory:');
  const env = {
    REMOTE_DB: d1Adapter(sqlite),
    SOCIAL_PUBLISHING_ENABLED: 'true',
    SOCIAL_X_BUDGET_MICRO_USD: '100000',
    ...CREDENTIALS,
  };
  const now = Date.parse('2026-07-27T10:30:00Z');
  let fetched = false;
  const summary = await runSocialPublishing(env, now, {
    fetchImpl: async () => {
      fetched = true;
      throw new Error('unexpected');
    },
  });
  assert.equal(summary.budgetStopped, 1);
  assert.equal(fetched, false);
  const post = sqlite.prepare("SELECT status, last_error, scheduled_at FROM social_posts WHERE post_id = 'auto:x:2026-07-27'").get();
  assert.equal(post.status, 'pending');
  assert.equal(post.last_error, 'budget-limit');
  assert.equal(post.scheduled_at, billingPeriod(now, 27).nextStart);
});

test('公開済み投稿は次回Cronで二重投稿しない', async () => {
  const sqlite = new DatabaseSync(':memory:');
  const env = {
    REMOTE_DB: d1Adapter(sqlite),
    SOCIAL_PUBLISHING_ENABLED: 'true',
    ...CREDENTIALS,
  };
  const now = Date.parse('2026-07-27T10:30:00Z');
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(JSON.stringify({ data: { id: `x-${calls}` } }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  };
  await runSocialPublishing(env, now, { fetchImpl });
  await runSocialPublishing(env, now + 1_000, { fetchImpl });
  assert.equal(calls, 1);
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
