const ready = new WeakMap();
export const CHALLENGE_CREATE_LIMIT = 60;
export const CHALLENGE_RATE_WINDOW_MS = 60_000;

// Production uses a single atomic D1 increment. Never persist raw IPs/tokens.
// Expired window buckets are removed by the existing Cron.
export async function enforceChallengeRateLimit(env, identity, scope = 'create', limit = CHALLENGE_CREATE_LIMIT, now = Date.now()) {
  if (!identity || !env.REMOTE_DB) return;
  const db = env.REMOTE_DB;
  if (!ready.has(db)) ready.set(db, db.prepare(`CREATE TABLE IF NOT EXISTS live_rate_limits (
    rate_key TEXT PRIMARY KEY, window_start INTEGER NOT NULL,
    request_count INTEGER NOT NULL, expires_at INTEGER NOT NULL
  )`).run().catch(error => { ready.delete(db); throw error; }));
  await ready.get(db);
  const start = Math.floor(now / CHALLENGE_RATE_WINDOW_MS) * CHALLENGE_RATE_WINDOW_MS;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${start}:${identity}`));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const row = await db.prepare(`INSERT INTO live_rate_limits (rate_key, window_start, request_count, expires_at)
    VALUES (?, ?, 1, ?) ON CONFLICT(rate_key) DO UPDATE SET request_count = request_count + 1
    RETURNING request_count`).bind(`challenge:${scope}:${hash}`, start, start + CHALLENGE_RATE_WINDOW_MS * 2).first();
  if (Number(row?.request_count) > limit) {
    const error = new Error('rate-limit-exceeded');
    error.status = 429;
    error.retryAfter = Math.max(1, Math.ceil((start + CHALLENGE_RATE_WINDOW_MS - now) / 1000));
    throw error;
  }
}
