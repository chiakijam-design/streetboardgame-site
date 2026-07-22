const INVITE_HEADER = 'x-live-creator-invite';
const INVITE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const NAME_BLOCK_PATTERNS = [
  /死ね|しね|殺す|ころす|消えろ|きもい|キモい|池沼|穢多|非人/u,
  /nigg(?:er|a)|chink|fagg?ot|retard/i,
];

export const LIVE_SUPPORT_MESSAGES_PUBLIC = false;

let readyDb = null;
let readyPromise = null;

export async function ensureLiveSecurityD1(env) {
  const db = env?.REMOTE_DB;
  if (!db) return false;
  if (readyDb !== db || !readyPromise) {
    readyDb = db;
    readyPromise = Promise.all([
      db.prepare(`
        CREATE TABLE IF NOT EXISTS live_creator_invites (
          invite_id TEXT PRIMARY KEY, channel_id TEXT NOT NULL, channel_name TEXT NOT NULL,
          channel_url TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'active',
          expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, created_by TEXT NOT NULL DEFAULT 'admin',
          reviewed_at INTEGER NOT NULL, last_used_at INTEGER, revoked_at INTEGER
        )
      `).run(),
    ]).then(() => Promise.all([
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_creator_invites_channel ON live_creator_invites (channel_id, status)').run(),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_creator_invites_expiry ON live_creator_invites (expires_at, status)').run(),
    ])).catch((error) => {
      readyPromise = null;
      throw error;
    });
  }
  await readyPromise;
  return true;
}

export async function createLiveCreatorInvite(env, profile, input = {}) {
  if (!await ensureLiveSecurityD1(env)) throw securityError('live-d1-required', 503);
  if (input.reviewed !== true) throw securityError('creator-manual-review-required', 400);
  const channelId = String(profile?.channelId || '');
  if (!/^UC[A-Za-z0-9_-]{10,}$/.test(channelId)) throw securityError('youtube-channel-not-found', 400);
  const inviteId = crypto.randomUUID();
  const inviteToken = randomHex(32);
  const now = Date.now();
  const expiresAt = now + INVITE_TTL_MS;
  await env.REMOTE_DB.prepare(`
    INSERT INTO live_creator_invites
      (invite_id, channel_id, channel_name, channel_url, token_hash, status, expires_at, created_at, created_by, reviewed_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?, 'admin', ?)
  `).bind(
    inviteId,
    channelId,
    String(profile.channelName || '').slice(0, 120),
    String(profile.channelUrl || '').slice(0, 500),
    await sha256(inviteToken),
    expiresAt,
    now,
    now,
  ).run();
  return { inviteId, inviteToken, channelId, channelName: profile.channelName, channelUrl: profile.channelUrl, expiresAt };
}

export async function revokeLiveCreatorInvite(env, inviteId) {
  if (!await ensureLiveSecurityD1(env)) throw securityError('live-d1-required', 503);
  const now = Date.now();
  const result = await env.REMOTE_DB.prepare(`
    UPDATE live_creator_invites SET status = 'revoked', revoked_at = ?
    WHERE invite_id = ? AND status = 'active'
  `).bind(now, inviteId).run();
  if (Number(result?.meta?.changes || 0) !== 1) throw securityError('creator-invite-not-found', 404);
  return { inviteId, status: 'revoked', revokedAt: now };
}

export async function listLiveCreatorInvites(env) {
  if (!await ensureLiveSecurityD1(env)) return [];
  const result = await env.REMOTE_DB.prepare(`
    SELECT invite_id, channel_id, channel_name, channel_url, status, expires_at,
      created_at, reviewed_at, last_used_at, revoked_at
    FROM live_creator_invites ORDER BY created_at DESC LIMIT 100
  `).all();
  return result?.results || [];
}

export async function requireLiveCreatorInvite(request, env, channelId, expectedInviteId = '') {
  const token = String(request.headers.get(INVITE_HEADER) || '').trim();
  const bypass = String(env?.LIVE_CREATOR_INVITE_BYPASS_TOKEN || '');
  if (bypass.length >= 32 && safeEqual(token, bypass)) {
    return { invite_id: 'test-bypass', channel_id: channelId, status: 'active' };
  }
  if (!/^[a-f0-9]{64}$/i.test(token)) throw securityError('creator-invite-required', 403);
  if (!await ensureLiveSecurityD1(env)) throw securityError('creator-invite-storage-required', 503);
  const row = await env.REMOTE_DB.prepare(`
    SELECT invite_id, channel_id, channel_name, status, expires_at
    FROM live_creator_invites WHERE token_hash = ? LIMIT 1
  `).bind(await sha256(token)).first();
  const valid = row && row.status === 'active' && Number(row.expires_at) > Date.now()
    && row.channel_id === channelId && (!expectedInviteId || row.invite_id === expectedInviteId);
  if (!valid) throw securityError('creator-invite-invalid', 403);
  await env.REMOTE_DB.prepare('UPDATE live_creator_invites SET last_used_at = ? WHERE invite_id = ?')
    .bind(Date.now(), row.invite_id).run();
  return row;
}

export function normalizeParticipantName(value) {
  const name = String(value || '').normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2060\ufeff]/gu, '')
    .replace(/\s+/gu, ' ').trim().slice(0, 24);
  if (!name) throw securityError('name-required', 400);
  const compact = name.replace(/[\p{P}\p{S}\s_]+/gu, '');
  if (NAME_BLOCK_PATTERNS.some((pattern) => pattern.test(compact))) {
    throw securityError('participant-name-not-allowed', 400);
  }
  if (/https?:|www\.|@|\d{8,}/i.test(name)) throw securityError('participant-name-not-allowed', 400);
  return name;
}

export function assessStripePaymentRisk(event) {
  const object = event?.data?.object || {};
  const charge = object?.charges?.data?.[0] || object;
  const outcome = charge?.outcome || {};
  const riskLevel = String(outcome.risk_level || object.risk_level || '').toLowerCase();
  const riskScore = Number(outcome.risk_score ?? object.risk_score);
  const fraudEvent = ['radar.early_fraud_warning.created', 'charge.dispute.created'].includes(String(event?.type || ''));
  const blocked = fraudEvent || ['elevated', 'highest'].includes(riskLevel) || (Number.isFinite(riskScore) && riskScore >= 65);
  return { blocked, fraudEvent, riskLevel, riskScore: Number.isFinite(riskScore) ? riskScore : null };
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomHex(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeEqual(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  return difference === 0;
}

function securityError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
