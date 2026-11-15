import { senderDigest } from '../security/sender-key.js';

const ready = new WeakSet();
export const CHALLENGE_CREATE_LIMIT = 30;
export const CHALLENGE_RATE_WINDOW_MS = 60_000;
// Per sender address and minute. Loose on purpose: a class of up to 50 players
// on one school network must be able to join a room, answer 10 questions and
// retry within a minute; only scripted bulk traffic reaches these numbers.
export const CHALLENGE_PLAY_LIMITS = Object.freeze({ join: 120, answer: 1200, submit: 120, retry: 120, ranking: 120 });

// Production uses a single atomic D1 increment. Never persist raw IPs/tokens.
// Expired window buckets are removed by the existing Cron.
export async function enforceChallengeRateLimit(env, identity, scope = 'create', limit = CHALLENGE_CREATE_LIMIT, now = Date.now()) {
  if (!identity || !env.REMOTE_DB) return;
  const db = env.REMOTE_DB;
  if (!ready.has(db)) {
    // Only cache completed setup, never another request's in-flight D1 IO.
    await db.prepare(`CREATE TABLE IF NOT EXISTS rate_limits (
      rate_key TEXT PRIMARY KEY, window_start INTEGER NOT NULL,
      request_count INTEGER NOT NULL, expires_at INTEGER NOT NULL
    )`).run();
    ready.add(db);
  }
  const start = Math.floor(now / CHALLENGE_RATE_WINDOW_MS) * CHALLENGE_RATE_WINDOW_MS;
  const hash = await senderDigest(env, `${start}:${identity}`);
  const row = await db.prepare(`INSERT INTO rate_limits (rate_key, window_start, request_count, expires_at)
    VALUES (?, ?, 1, ?) ON CONFLICT(rate_key) DO UPDATE SET request_count = request_count + 1
    RETURNING request_count`).bind(`challenge:${scope}:${hash}`, start, start + CHALLENGE_RATE_WINDOW_MS * 2).first();
  if (Number(row?.request_count) > limit) {
    const error = new Error('rate-limit-exceeded');
    error.status = 429;
    error.retryAfter = Math.max(1, Math.ceil((start + CHALLENGE_RATE_WINDOW_MS - now) / 1000));
    throw error;
  }
}
