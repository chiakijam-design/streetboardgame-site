const DAY_MS = 86_400_000;
export const PLAY_FLUSH_INTERVAL_MS = 60_000;

export function playDayJst(now) {
  return new Date(Number(now) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Called inside the existing vote transaction. No identity/answer goes into
// these counters; existing participant votes supply first/last-answer detection.
export async function addRealtimePlayCounts(storage, previousAnswerCount, questionCount, now) {
  const day = playDayJst(now);
  const key = `play:day:${day}`;
  const counts = await storage.get(key) || { started: 0, completed: 0, votes: 0, deliveredVotes: 0 };
  const total = Number(questionCount);
  counts.started += previousAnswerCount === 0 ? 1 : 0;
  counts.completed += total > 0 && previousAnswerCount + 1 === total ? 1 : 0;
  counts.votes += 1;
  const streamId = await storage.get('play:stream') || crypto.randomUUID();
  await storage.put({ [key]: counts, 'play:stream': streamId });
}

// Absolute, monotonic snapshots + SQL delta triggers make retries idempotent.
// Random stream cursors expire; the durable table only keeps day/mode/counts.
export async function flushRealtimePlayCounts(storage, db, now = Date.now(), force = false) {
  if (!db) return null;
  const entries = await storage.list({ prefix: 'play:day:' });
  const pending = [...entries].filter(([, counts]) => counts.votes > (counts.deliveredVotes || 0));
  if (!pending.length) return null;
  const nextAt = Number(await storage.get('play:nextFlushAt')) || 0;
  if (!force && now < nextAt) return nextAt;
  const streamId = await storage.get('play:stream');
  const cleanupAt = Number(await storage.get('cleanupAt')) || now;
  // Once retry cursors may have expired, absolute snapshots could re-add
  // already delivered counts. Keep the anonymous outbox for investigation
  // instead of silently inventing a complete total or double-counting.
  if (now > cleanupAt + 7 * DAY_MS) throw new Error('daily-play-retry-window-expired');
  for (const [key, counts] of pending) {
    await db.prepare(`
      INSERT INTO play_daily_live_streams
        (stream_id, day, plays_started, plays_completed, votes_recorded, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(stream_id, day) DO UPDATE SET
        plays_started = MAX(plays_started, excluded.plays_started),
        plays_completed = MAX(plays_completed, excluded.plays_completed),
        votes_recorded = MAX(votes_recorded, excluded.votes_recorded),
        expires_at = MAX(expires_at, excluded.expires_at)
    `).bind(streamId, key.slice('play:day:'.length), counts.started, counts.completed,
      counts.votes, cleanupAt + 7 * DAY_MS).run();
    // A vote may arrive during external D1 I/O. Only acknowledge the snapshot,
    // preserving any newer totals in the local transaction.
    await storage.transaction(async (tx) => {
      const current = await tx.get(key);
      if (current) await tx.put(key, { ...current, deliveredVotes: Math.max(current.deliveredVotes || 0, counts.votes) });
    });
  }
  await storage.put('play:nextFlushAt', now + PLAY_FLUSH_INTERVAL_MS);
  const remaining = await storage.list({ prefix: 'play:day:' });
  return [...remaining.values()].some((item) => item.votes > (item.deliveredVotes || 0))
    ? now + PLAY_FLUSH_INTERVAL_MS : null;
}
