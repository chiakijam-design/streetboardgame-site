// Hourly Cron cleanup of personal data in REMOTE_DB.
// LIVE (games, purchases, creator assets, YouTube captions) was removed on
// 2026-11-15 together with its tables; a copy of those tables is kept offline.
export const PRIVACY_RETENTION = Object.freeze({
  challengeGameDays: 30,
  ga4Months: 14,
  contactMonths: 12,
});

export async function runPrivacyCleanup(env, now = Date.now()) {
  const summary = {
    expiredChallengeRooms: 0,
    deletedContactMessages: 0,
  };
  if (env?.REMOTE_DB) await cleanupGameDatabase(env, now, summary);
  return summary;
}

async function cleanupGameDatabase(env, now, summary) {
  const expiredChallenges = await safeRows(
    env.REMOTE_DB,
    'SELECT code FROM challenge_rooms WHERE expires_at < ? LIMIT 500',
    [now],
  );
  if (expiredChallenges.length) {
    const codes = expiredChallenges.map((row) => String(row.code));
    const placeholders = codes.map(() => '?').join(',');
    await safeRun(env.REMOTE_DB, `DELETE FROM challenge_participants WHERE room_code IN (${placeholders})`, codes);
    const deletedRooms = await safeRun(
      env.REMOTE_DB,
      `DELETE FROM challenge_rooms WHERE code IN (${placeholders}) AND expires_at < ?`,
      [...codes, now],
    );
    summary.expiredChallengeRooms = changes(deletedRooms);
  }
  // Transient, hashed rate-limit windows and expired operator sessions.
  await safeRun(env.REMOTE_DB, 'DELETE FROM rate_limits WHERE expires_at < ?', [now]);
  await safeRun(env.REMOTE_DB, 'DELETE FROM admin_sessions WHERE expires_at < ?', [now]);
  // 2026-11-22（Gemini 見直し32）：お題の選択の記録（IP・端末のハッシュ付き）は30日を過ぎたら消す。
  // 使い道は1時間の回数の確かめと重複よけだけ（数の合計は question_selection_stats に残る）
  await safeRun(env.REMOTE_DB, 'DELETE FROM question_selection_events WHERE created_at < ?', [now - 30 * 24 * 60 * 60 * 1000]);
  // Contact messages: the policy promises at most 12 months after resolution; we delete
  // 12 calendar months after receipt, which is never later than that.
  const deletedContacts = await safeRun(
    env.REMOTE_DB,
    'DELETE FROM contact_messages WHERE created_at < ?',
    [contactCutoff(now)],
  );
  summary.deletedContactMessages = changes(deletedContacts);
}

export function contactCutoff(now) {
  const date = new Date(now);
  date.setUTCMonth(date.getUTCMonth() - PRIVACY_RETENTION.contactMonths);
  return date.getTime();
}

async function safeRows(db, sql, bindings = []) {
  try {
    const result = await db.prepare(sql).bind(...bindings).all();
    return result?.results || [];
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}

async function safeRun(db, sql, bindings = []) {
  try {
    return await db.prepare(sql).bind(...bindings).run();
  } catch (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
}

function isMissingTable(error) {
  return /no such table|does not exist/i.test(String(error?.message || error || ''));
}

function changes(result) {
  return Number(result?.meta?.changes || 0);
}
