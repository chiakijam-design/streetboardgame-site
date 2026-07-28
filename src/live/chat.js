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
    ]).then(() => Promise.all([
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_chat_messages_room ON live_chat_messages (code, status, created_at DESC)').run(),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_chat_messages_sender ON live_chat_messages (code, participant_id, created_at DESC)').run(),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_chat_messages_review ON live_chat_messages (status, updated_at DESC)').run(),
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

export async function reportLiveChatMessage(env, code, messageId) {
  if (!await ensureLiveChatD1(env)) throw chatError('live-chat-storage-not-configured', 503);
  const now = Date.now();
  const result = await env.REMOTE_DB.prepare(`
    UPDATE live_chat_messages
    SET status = 'reported', report_count = report_count + 1, updated_at = ?
    WHERE code = ? AND message_id = ? AND status = 'visible'
  `).bind(now, code, messageId).run();
  if (Number(result?.meta?.changes || 0) !== 1) throw chatError('chat-message-not-found', 404);
  return { messageId, status: 'reported', updatedAt: now };
}

export async function hideLiveChatMessage(env, code, messageId) {
  if (!await ensureLiveChatD1(env)) throw chatError('live-chat-storage-not-configured', 503);
  const now = Date.now();
  const result = await env.REMOTE_DB.prepare(`
    UPDATE live_chat_messages SET status = 'hidden', updated_at = ?
    WHERE code = ? AND message_id = ? AND status IN ('visible', 'reported')
  `).bind(now, code, messageId).run();
  if (Number(result?.meta?.changes || 0) !== 1) throw chatError('chat-message-not-found', 404);
  return { messageId, status: 'hidden', updatedAt: now };
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
