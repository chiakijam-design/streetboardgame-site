import { recordLiveOpsEvent } from '../live/ops.js';

const DEFAULT_X_BUDGET_MICRO_USD = 9_500_000;
const DEFAULT_X_URL_POST_COST_MICRO_USD = 200_000;
const DEFAULT_X_TEXT_POST_COST_MICRO_USD = 15_000;
const DEFAULT_CYCLE_DAY = 27;
const MAX_POSTS_PER_RUN = 3;
const MAX_ATTEMPTS = 3;
const DAY_MS = 86_400_000;
const X_CREATE_POST_URL = 'https://api.x.com/2/tweets';

const CAMPAIGN_POSTS = Object.freeze([
  {
    locale: 'ja',
    text: '友達は、あなたの答えを何問当てられる？\n「わたし理解度診断」は、10問を作ってURLを送るだけ。再挑戦OK、結果公開は自分で選べます。',
    linkUrl: 'https://www.streetboardgame.com/',
  },
  {
    locale: 'ja',
    text: '当てることより、答え合わせから会話が始まる10問。\n学校・放課後・食べもの・SNSなど、好きなお題から「わたし理解度診断」を作れます。',
    linkUrl: 'https://www.streetboardgame.com/challenge/library',
  },
  {
    locale: 'en',
    text: 'How well do your friends really know you?\nCreate 10 questions, share one link, and compare answers. Retakes are welcome, and sharing your score is always optional.',
    linkUrl: 'https://www.streetboardgame.com/en/',
  },
  {
    locale: 'ja',
    text: '配信者と視聴者が、同じ問題へ同時に回答。\n1問ずつ答え合わせできるLIVE版の「わたし理解度診断」は、小さな配信でも遊べます。',
    linkUrl: 'https://www.streetboardgame.com/live-challenge',
  },
  {
    locale: 'en',
    text: 'A conversation-first quiz for friends and livestreams.\nAnswer the same 10 questions, reveal them one by one, and turn every mismatch into something new to talk about.',
    linkUrl: 'https://www.streetboardgame.com/en/live-challenge',
  },
  {
    locale: 'ja',
    text: '低い点数でも大丈夫。知らなかった話が見つかったということ。\n結果を公開せずにもう一度挑戦することもできます。',
    linkUrl: 'https://www.streetboardgame.com/',
  },
  {
    locale: 'ja',
    text: '10問選ぶ時間がないときは、テーマ別の10問パックからすぐ作れます。\n初対面・学校・食べもの・意外な一面など、お題をまとめて選べます。',
    linkUrl: 'https://www.streetboardgame.com/challenge/library',
  },
  {
    locale: 'en',
    text: 'Not just a score: see where your answers matched, discover the surprises, and get a conversation-ready answer check report.',
    linkUrl: 'https://www.streetboardgame.com/en/',
  },
  {
    locale: 'ja',
    text: '答え合わせのあと、同じ10問で役割交代。\n今度はあなたが出題者になって、相手に答えを予想してもらえます。',
    linkUrl: 'https://www.streetboardgame.com/',
  },
  {
    locale: 'en',
    text: 'Built for low-pressure sharing: retry anytime, keep your result private, or swap roles and make the same 10 questions your own.',
    linkUrl: 'https://www.streetboardgame.com/en/',
  },
]);

const schemaReadyByDatabase = new WeakMap();

export async function ensureSocialPublishingD1(env) {
  if (!env?.REMOTE_DB) return false;
  let readyPromise = schemaReadyByDatabase.get(env.REMOTE_DB);
  if (!readyPromise) {
    readyPromise = Promise.all([
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS social_posts (
          post_id TEXT PRIMARY KEY,
          platform TEXT NOT NULL,
          locale TEXT NOT NULL DEFAULT 'ja',
          post_text TEXT NOT NULL,
          link_url TEXT NOT NULL DEFAULT '',
          media_url TEXT NOT NULL DEFAULT '',
          scheduled_at INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          attempts INTEGER NOT NULL DEFAULT 0,
          external_id TEXT NOT NULL DEFAULT '',
          last_error TEXT NOT NULL DEFAULT '',
          estimated_cost_micro_usd INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          published_at INTEGER
        )
      `).run(),
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS social_billing_usage (
          period_key TEXT NOT NULL,
          platform TEXT NOT NULL,
          estimated_cost_micro_usd INTEGER NOT NULL DEFAULT 0,
          post_count INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (period_key, platform)
        )
      `).run(),
    ]).then(() => Promise.all([
      env.REMOTE_DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_social_posts_due ON social_posts (status, scheduled_at)'
      ).run(),
      env.REMOTE_DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_social_posts_published ON social_posts (platform, published_at DESC)'
      ).run(),
    ])).catch((error) => {
      schemaReadyByDatabase.delete(env.REMOTE_DB);
      throw error;
    });
    schemaReadyByDatabase.set(env.REMOTE_DB, readyPromise);
  }
  await readyPromise;
  return true;
}

export async function runSocialPublishing(env, now = Date.now(), options = {}) {
  const checkedAt = Number(now) || Date.now();
  if (String(env?.SOCIAL_PUBLISHING_ENABLED || '').toLowerCase() !== 'true') {
    return { enabled: false, checkedAt, queued: 0, published: 0, failed: 0, budgetStopped: 0 };
  }
  if (!await ensureSocialPublishingD1(env)) {
    return { enabled: true, configured: false, checkedAt, queued: 0, published: 0, failed: 0, budgetStopped: 0 };
  }

  const queued = await ensureXCampaignSchedule(env, checkedAt);
  const due = await env.REMOTE_DB.prepare(`
    SELECT post_id, platform, locale, post_text, link_url, media_url, scheduled_at, attempts
    FROM social_posts
    WHERE status IN ('pending', 'failed') AND attempts < ? AND scheduled_at <= ?
    ORDER BY scheduled_at ASC
    LIMIT ?
  `).bind(MAX_ATTEMPTS, checkedAt, MAX_POSTS_PER_RUN).all();

  const summary = { enabled: true, configured: true, checkedAt, queued, published: 0, failed: 0, budgetStopped: 0 };
  for (const post of due.results || []) {
    const claimed = await env.REMOTE_DB.prepare(`
      UPDATE social_posts SET status = 'publishing', updated_at = ?
      WHERE post_id = ? AND status IN ('pending', 'failed') AND attempts < ?
    `).bind(checkedAt, post.post_id, MAX_ATTEMPTS).run();
    if (Number(claimed?.meta?.changes) !== 1) continue;

    if (post.platform !== 'x') {
      await reschedulePost(env, post, checkedAt, 'platform-not-configured', false);
      summary.failed += 1;
      continue;
    }

    const estimatedCost = post.link_url
      ? positiveInteger(env.SOCIAL_X_URL_POST_COST_MICRO_USD, DEFAULT_X_URL_POST_COST_MICRO_USD)
      : positiveInteger(env.SOCIAL_X_TEXT_POST_COST_MICRO_USD, DEFAULT_X_TEXT_POST_COST_MICRO_USD);
    const budget = positiveInteger(env.SOCIAL_X_BUDGET_MICRO_USD, DEFAULT_X_BUDGET_MICRO_USD);
    const cycleDay = clampCycleDay(env.SOCIAL_X_BILLING_CYCLE_DAY);
    const billing = billingPeriod(checkedAt, cycleDay);
    const usage = await getBillingUsage(env, billing.key, 'x');
    if (usage + estimatedCost > budget) {
      await env.REMOTE_DB.prepare(`
        UPDATE social_posts SET status = 'pending', scheduled_at = ?, last_error = 'budget-limit',
          estimated_cost_micro_usd = ?, updated_at = ? WHERE post_id = ?
      `).bind(billing.nextStart, estimatedCost, checkedAt, post.post_id).run();
      summary.budgetStopped += 1;
      await recordLiveOpsEvent(env, {
        category: 'social',
        severity: 'warning',
        eventType: 'x-budget-limit',
        externalId: billing.key,
        message: 'X投稿の推定利用額がサイト側の上限に達したため、次回請求期間まで投稿を停止しました。',
        metadata: { periodKey: billing.key, estimatedUsageMicroUsd: usage, budgetMicroUsd: budget },
      }).catch(() => {});
      continue;
    }

    if (!hasXCredentials(env)) {
      await reschedulePost(env, post, checkedAt, 'x-credentials-missing', false);
      summary.failed += 1;
      continue;
    }

    await addBillingUsage(env, billing.key, 'x', estimatedCost, checkedAt);
    try {
      const result = await publishXPost(env, post, options.fetchImpl || fetch);
      await env.REMOTE_DB.prepare(`
        UPDATE social_posts SET status = 'published', attempts = attempts + 1, external_id = ?,
          last_error = '', estimated_cost_micro_usd = ?, published_at = ?, updated_at = ?
        WHERE post_id = ?
      `).bind(result.id, estimatedCost, checkedAt, checkedAt, post.post_id).run();
      summary.published += 1;
    } catch (error) {
      await addBillingUsage(env, billing.key, 'x', -estimatedCost, checkedAt);
      await reschedulePost(env, post, checkedAt, normalizeError(error), true);
      summary.failed += 1;
      await recordLiveOpsEvent(env, {
        category: 'social',
        severity: 'warning',
        eventType: 'x-publish-failed',
        externalId: post.post_id,
        message: 'Xへの自動投稿に失敗しました。再試行キューへ戻しました。',
        metadata: { postId: post.post_id, error: normalizeError(error) },
      }).catch(() => {});
    }
  }
  return summary;
}

export async function ensureXCampaignSchedule(env, now = Date.now()) {
  if (!await ensureSocialPublishingD1(env)) return 0;
  const current = new Date(Number(now) || Date.now());
  let queued = 0;
  for (let offset = 0; offset < 14; offset += 1) {
    const date = new Date(current.getTime() + offset * DAY_MS);
    const jstParts = jstDateParts(date);
    if (jstParts.weekday === 0 || jstParts.weekday === 6) continue;
    const dateKey = `${jstParts.year}-${pad2(jstParts.month)}-${pad2(jstParts.day)}`;
    const scheduledAt = Date.UTC(jstParts.year, jstParts.month - 1, jstParts.day, 10, 0, 0);
    if (scheduledAt < current.getTime() - DAY_MS) continue;
    const contentIndex = Math.abs(daysSinceEpoch(jstParts.year, jstParts.month, jstParts.day)) % CAMPAIGN_POSTS.length;
    const content = CAMPAIGN_POSTS[contentIndex];
    const result = await env.REMOTE_DB.prepare(`
      INSERT OR IGNORE INTO social_posts
        (post_id, platform, locale, post_text, link_url, media_url, scheduled_at, status,
         attempts, estimated_cost_micro_usd, created_at, updated_at)
      VALUES (?, 'x', ?, ?, ?, '', ?, 'pending', 0, 0, ?, ?)
    `).bind(`auto:x:${dateKey}`, content.locale, content.text, content.linkUrl, scheduledAt, Number(now), Number(now)).run();
    queued += Number(result?.meta?.changes) || 0;
  }
  return queued;
}

export async function publishXPost(env, post, fetchImpl = fetch) {
  const text = [String(post.post_text || '').trim(), String(post.link_url || '').trim()].filter(Boolean).join('\n');
  if (!text) throw new Error('empty-post');
  const authorization = await createOAuth1Header(env, 'POST', X_CREATE_POST_URL);
  const response = await fetchImpl(X_CREATE_POST_URL, {
    method: 'POST',
    headers: {
      authorization,
      'content-type': 'application/json; charset=UTF-8',
      accept: 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.data?.id) {
    const detail = body?.detail || body?.title || body?.errors?.[0]?.message || `HTTP ${response.status}`;
    throw new Error(`x-api-${response.status}:${String(detail).slice(0, 180)}`);
  }
  return { id: String(body.data.id) };
}

export function billingPeriod(now, cycleDay = DEFAULT_CYCLE_DAY) {
  const date = new Date(Number(now) || Date.now());
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  let year = jst.getUTCFullYear();
  let month = jst.getUTCMonth();
  if (jst.getUTCDate() < cycleDay) {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  return {
    key: `${year}-${pad2(month + 1)}-${pad2(cycleDay)}`,
    nextStart: Date.UTC(nextYear, nextMonth, cycleDay, -9, 0, 0),
  };
}

async function createOAuth1Header(env, method, url) {
  const params = {
    oauth_consumer_key: env.SOCIAL_X_CONSUMER_KEY,
    oauth_nonce: crypto.randomUUID().replaceAll('-', ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: env.SOCIAL_X_ACCESS_TOKEN,
    oauth_version: '1.0',
  };
  const parameterString = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${oauthEncode(key)}=${oauthEncode(value)}`)
    .join('&');
  const baseString = [method.toUpperCase(), oauthEncode(url), oauthEncode(parameterString)].join('&');
  const signingKey = `${oauthEncode(env.SOCIAL_X_CONSUMER_SECRET)}&${oauthEncode(env.SOCIAL_X_ACCESS_TOKEN_SECRET)}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingKey),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(baseString));
  params.oauth_signature = bytesToBase64(new Uint8Array(signatureBuffer));
  return `OAuth ${Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([keyName, value]) => `${oauthEncode(keyName)}="${oauthEncode(value)}"`)
    .join(', ')}`;
}

async function getBillingUsage(env, periodKey, platform) {
  const row = await env.REMOTE_DB.prepare(`
    SELECT estimated_cost_micro_usd FROM social_billing_usage
    WHERE period_key = ? AND platform = ? LIMIT 1
  `).bind(periodKey, platform).first();
  return Math.max(0, Number(row?.estimated_cost_micro_usd) || 0);
}

async function addBillingUsage(env, periodKey, platform, amount, now) {
  await env.REMOTE_DB.prepare(`
    INSERT INTO social_billing_usage
      (period_key, platform, estimated_cost_micro_usd, post_count, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(period_key, platform) DO UPDATE SET
      estimated_cost_micro_usd = MAX(0, estimated_cost_micro_usd + excluded.estimated_cost_micro_usd),
      post_count = MAX(0, post_count + excluded.post_count),
      updated_at = excluded.updated_at
  `).bind(periodKey, platform, amount, amount > 0 ? 1 : -1, now).run();
}

async function reschedulePost(env, post, now, error, countAttempt) {
  const attempts = Number(post.attempts) + (countAttempt ? 1 : 0);
  const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
  const delay = countAttempt ? Math.min(6, Math.max(1, attempts)) * 60 * 60 * 1000 : 6 * 60 * 60 * 1000;
  await env.REMOTE_DB.prepare(`
    UPDATE social_posts SET status = ?, attempts = ?, scheduled_at = ?, last_error = ?, updated_at = ?
    WHERE post_id = ?
  `).bind(status, attempts, now + delay, String(error).slice(0, 300), now, post.post_id).run();
}

function hasXCredentials(env) {
  return [
    env?.SOCIAL_X_CONSUMER_KEY,
    env?.SOCIAL_X_CONSUMER_SECRET,
    env?.SOCIAL_X_ACCESS_TOKEN,
    env?.SOCIAL_X_ACCESS_TOKEN_SECRET,
  ].every((value) => String(value || '').trim());
}

function jstDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(values.weekday);
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day), weekday };
}

function daysSinceEpoch(year, month, day) {
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function clampCycleDay(value) {
  return Math.min(28, Math.max(1, positiveInteger(value, DEFAULT_CYCLE_DAY)));
}

function positiveInteger(value, fallback) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function oauthEncode(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function normalizeError(error) {
  return String(error?.message || error || 'unknown-error').replace(/\s+/g, ' ').slice(0, 300);
}

function pad2(value) {
  return String(value).padStart(2, '0');
}
