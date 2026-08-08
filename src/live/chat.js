import { scanQuestionSafety } from '../questions/safety.js';

export const LIVE_CHAT_MESSAGE_MAX_LENGTH = 120;
export const LIVE_CHAT_VISIBLE_LIMIT = 80;
export const LIVE_CHAT_COOLDOWN_MS = 4_000;

let readyDb = null;
let readyPromise = null;

export async function ensureLiveChatD1(env) {
  const db = env?.REMOTE_DB;
  if (!db) return false;
  if (readyDb !== db || !readyPromise) {
    readyDb = db;
    readyPromise = Promise.all([
      db.prepare(`
        CREATE TABLE IF NOT EXISTS live_chat_messages (
          message_id TEXT PRIMARY KEY,
          code TEXT NOT NULL,
          participant_id TEXT NOT NULL,
          participant_name TEXT NOT NULL,
          sender_role TEXT NOT NULL DEFAULT 'viewer',
          message_text TEXT NOT NULL,
          message_type TEXT NOT NULL DEFAULT 'chat',
          amount INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'visible',
          stripe_order_id TEXT UNIQUE,
          report_count INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `).run(),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS live_chat_reports (
          report_id TEXT PRIMARY KEY, code TEXT NOT NULL, message_id TEXT NOT NULL,
          reporter_hash TEXT NOT NULL, reason TEXT NOT NULL DEFAULT 'other',
          detail TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
          UNIQUE (message_id, reporter_hash)
        )
      `).run(),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS live_reporter_restrictions (
          reporter_hash TEXT PRIMARY KEY, reason TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
          expires_at INTEGER, revoked_at INTEGER
        )
      `).run(),
    ]).then(() => Promise.all([
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_chat_messages_room ON live_chat_messages (code, status, created_at DESC)').run(),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_chat_messages_sender ON live_chat_messages (code, participant_id, created_at DESC)').run(),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_chat_messages_review ON live_chat_messages (status, updated_at DESC)').run(),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_chat_reports_review ON live_chat_reports (code, message_id, created_at DESC)').run(),
    ])).catch((error) => {
      readyPromise = null;
      throw error;
    });
  }
  await readyPromise;
  return true;
}

export function normalizeLiveChatText(value, { optional = false } = {}) {
  const text = String(value || '').normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2060\ufeff]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
  const length = [...text].length;
  if (!text && optional) return '';
  if (!text) throw chatError('chat-message-required', 400);
  if (length > LIVE_CHAT_MESSAGE_MAX_LENGTH) throw chatError('chat-message-too-long', 400);
  if (/https?:\/\/|www\.|(?:^|\s)@[A-Za-z0-9_.-]{2,30}\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/iu.test(text)) {
    throw chatError('chat-message-personal-information', 400);
  }
  const safety = scanQuestionSafety({ text });
  if (safety.personalInfoFlags.length) throw chatError('chat-message-personal-information', 400);
  if (safety.moderationFlags.length) throw chatError('chat-message-not-allowed', 400);
  return text;
}

export async function listLiveChatMessages(env, code, { includeHidden = false } = {}) {
  if (!await ensureLiveChatD1(env)) return [];
  const where = includeHidden ? '' : "AND status = 'visible'";
  const result = await env.REMOTE_DB.prepare(`
    SELECT message_id, participant_id, participant_name, sender_role, message_text,
      message_type, amount, status, report_count, created_at
    FROM live_chat_messages
    WHERE code = ? ${where}
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(code, LIVE_CHAT_VISIBLE_LIMIT).all();
  return (result?.results || []).reverse().map(publicLiveChatMessage);
}

export async function createLiveChatMessage(env, {
  code,
  participantId,
  participantName,
  senderRole = 'viewer',
  text,
}) {
  if (!await ensureLiveChatD1(env)) throw chatError('live-chat-storage-not-configured', 503);
  const messageText = normalizeLiveChatText(text);
  const now = Date.now();
  const recent = await env.REMOTE_DB.prepare(`
    SELECT created_at FROM live_chat_messages
    WHERE code = ? AND participant_id = ? AND message_type = 'chat'
    ORDER BY created_at DESC LIMIT 1
  `).bind(code, participantId).first();
  if (recent && now - Number(recent.created_at) < LIVE_CHAT_COOLDOWN_MS) {
    throw chatError('chat-message-too-fast', 429);
  }
  const messageId = `msg_${crypto.randomUUID()}`;
  await env.REMOTE_DB.prepare(`
    INSERT INTO live_chat_messages (
      message_id, code, participant_id, participant_name, sender_role, message_text,
      message_type, amount, status, report_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'chat', 0, 'visible', 0, ?, ?)
  `).bind(
    messageId,
    code,
    participantId,
    String(participantName || '').slice(0, 24),
    senderRole === 'host' ? 'host' : 'viewer',
    messageText,
    now,
    now,
  ).run();
  return publicLiveChatMessage({
    message_id: messageId,
    participant_id: participantId,
    participant_name: participantName,
    sender_role: senderRole,
    message_text: messageText,
    message_type: 'chat',
    amount: 0,
    status: 'visible',
    report_count: 0,
    created_at: now,
  });
}

export async function publishPaidLiveChatMessage(env, {
  orderId,
  code,
  participantId,
  participantName,
  text,
  amount,
}) {
  if (!await ensureLiveChatD1(env)) throw chatError('live-chat-storage-not-configured', 503);
  const messageText = normalizeLiveChatText(text, { optional: true })
    || `${String(participantName || '視聴者').slice(0, 24)}さんから応援が届きました！`;
  const now = Date.now();
  const messageId = `support_${String(orderId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80)}`;
  await env.REMOTE_DB.prepare(`
    INSERT OR IGNORE INTO live_chat_messages (
      message_id, code, participant_id, participant_name, sender_role, message_text,
      message_type, amount, status, stripe_order_id, report_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'viewer', ?, 'support', ?, 'visible', ?, 0, ?, ?)
  `).bind(
    messageId,
    code,
    participantId,
    String(participantName || '').slice(0, 24),
    messageText,
    Math.max(0, Number(amount) || 0),
    orderId,
    now,
    now,
  ).run();
  const row = await env.REMOTE_DB.prepare(`
    SELECT message_id, participant_id, participant_name, sender_role, message_text,
      message_type, amount, status, report_count, created_at
    FROM live_chat_messages WHERE stripe_order_id = ? LIMIT 1
  `).bind(orderId).first();
  return row ? publicLiveChatMessage(row) : null;
}

export async function reportLiveChatMessage(env, code, messageId, {
  reporterHash,
  reason = 'other',
  detail = '',
} = {}) {
  if (!await ensureLiveChatD1(env)) throw chatError('live-chat-storage-not-configured', 503);
  if (!/^[a-f0-9]{64}$/i.test(String(reporterHash || ''))) throw chatError('chat-reporter-invalid', 400);
  const now = Date.now();
  const restriction = await env.REMOTE_DB.prepare(`
    SELECT reporter_hash FROM live_reporter_restrictions
    WHERE reporter_hash = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)
  `).bind(reporterHash, now).first();
  if (restriction) throw chatError('chat-reporter-restricted', 403);
  const message = await env.REMOTE_DB.prepare(`
    SELECT message_type, status FROM live_chat_messages WHERE code = ? AND message_id = ? LIMIT 1
  `).bind(code, messageId).first();
  if (!message) throw chatError('chat-message-not-found', 404);
  const inserted = await env.REMOTE_DB.prepare(`
    INSERT OR IGNORE INTO live_chat_reports
      (report_id, code, message_id, reporter_hash, reason, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), code, messageId, reporterHash,
    String(reason || 'other').slice(0, 40), String(detail || '').slice(0, 300), now).run();
  const duplicate = Number(inserted?.meta?.changes || 0) !== 1;
  const count = await env.REMOTE_DB.prepare(`
    SELECT COUNT(DISTINCT reporter_hash) AS count FROM live_chat_reports WHERE message_id = ?
  `).bind(messageId).first();
  const reportCount = Number(count?.count || 0);
  const paidSupport = message.message_type === 'support';
  const nextStatus = paidSupport ? message.status : 'quarantined';
  await env.REMOTE_DB.prepare(`
    UPDATE live_chat_messages SET status = ?, report_count = ?, updated_at = ?
    WHERE code = ? AND message_id = ?
  `).bind(nextStatus, reportCount, now, code, messageId).run();
  return {
    messageId,
    status: nextStatus,
    reportCount,
    duplicate,
    quarantined: nextStatus === 'quarantined',
    requiresHostReview: paidSupport,
    updatedAt: now,
  };
}

export async function hideLiveChatMessage(env, code, messageId) {
  if (!await ensureLiveChatD1(env)) throw chatError('live-chat-storage-not-configured', 503);
  const now = Date.now();
  const result = await env.REMOTE_DB.prepare(`
    UPDATE live_chat_messages SET status = 'hidden', updated_at = ?
    WHERE code = ? AND message_id = ? AND status IN ('visible', 'reported', 'quarantined')
  `).bind(now, code, messageId).run();
  if (Number(result?.meta?.changes || 0) !== 1) throw chatError('chat-message-not-found', 404);
  return { messageId, status: 'hidden', updatedAt: now };
}

export async function restoreLiveChatMessage(env, code, messageId) {
  if (!await ensureLiveChatD1(env)) throw chatError('live-chat-storage-not-configured', 503);
  const now = Date.now();
  const result = await env.REMOTE_DB.prepare(`
    UPDATE live_chat_messages SET status = 'visible', updated_at = ?
    WHERE code = ? AND message_id = ? AND status IN ('hidden', 'reported', 'quarantined')
  `).bind(now, code, messageId).run();
  if (Number(result?.meta?.changes || 0) !== 1) throw chatError('chat-message-not-found', 404);
  return { messageId, status: 'visible', updatedAt: now };
}

export async function listLiveChatModerationQueue(env) {
  if (!await ensureLiveChatD1(env)) return [];
  const result = await env.REMOTE_DB.prepare(`
    SELECT m.message_id, m.code, m.participant_id, m.participant_name, m.sender_role,
      m.message_text, m.message_type, m.amount, m.status, m.report_count, m.created_at,
      MAX(r.created_at) AS last_reported_at,
      GROUP_CONCAT(DISTINCT r.reporter_hash) AS reporter_hashes,
      GROUP_CONCAT(DISTINCT r.reason) AS report_reasons
    FROM live_chat_messages m
    LEFT JOIN live_chat_reports r ON r.message_id = m.message_id
    WHERE m.report_count > 0 OR m.status IN ('quarantined', 'hidden')
    GROUP BY m.message_id
    ORDER BY last_reported_at DESC
    LIMIT 300
  `).all();
  return (result?.results || []).map((row) => ({
    ...publicLiveChatMessage(row),
    code: String(row.code || ''),
    lastReportedAt: Number(row.last_reported_at || 0),
    reporterHashes: String(row.reporter_hashes || '').split(',').filter(Boolean),
    reportReasons: String(row.report_reasons || '').split(',').filter(Boolean),
  }));
}

export async function setLiveReporterRestriction(env, reporterHash, restricted, reason = '') {
  if (!await ensureLiveChatD1(env)) throw chatError('live-chat-storage-not-configured', 503);
  const now = Date.now();
  if (!restricted) {
    await env.REMOTE_DB.prepare(`UPDATE live_reporter_restrictions SET revoked_at = ? WHERE reporter_hash = ?`)
      .bind(now, reporterHash).run();
    return { reporterHash, restricted: false };
  }
  await env.REMOTE_DB.prepare(`
    INSERT INTO live_reporter_restrictions (reporter_hash, reason, created_at, expires_at, revoked_at)
    VALUES (?, ?, ?, NULL, NULL)
    ON CONFLICT(reporter_hash) DO UPDATE SET reason = excluded.reason,
      created_at = excluded.created_at, expires_at = NULL, revoked_at = NULL
  `).bind(reporterHash, String(reason || '').slice(0, 180), now).run();
  return { reporterHash, restricted: true };
}

function publicLiveChatMessage(row) {
  return {
    id: String(row.message_id || ''),
    participantId: String(row.participant_id || ''),
    name: String(row.participant_name || '').slice(0, 24),
    role: row.sender_role === 'host' ? 'host' : 'viewer',
    text: String(row.message_text || ''),
    type: row.message_type === 'support' ? 'support' : 'chat',
    amount: Math.max(0, Number(row.amount) || 0),
    status: String(row.status || 'visible'),
    reportCount: Math.max(0, Number(row.report_count) || 0),
    createdAt: Number(row.created_at) || 0,
  };
}

function chatError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
