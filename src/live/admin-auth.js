const TOTP_PERIOD_MS = 30_000;
const ADMIN_SESSION_TTL_MS = 15 * 60 * 1000;
const ADMIN_TRUSTED_SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const ADMIN_COOKIE_NAME = 'sbg_admin_session';
const ADMIN_CSRF_HEADER = 'x-admin-csrf';
const ADMIN_SESSION_PREFIX = 'live:admin-session:';

export async function createLiveAdminSession(request, env, now = Date.now()) {
  const config = adminAuthConfig(env);
  const token = String(request.headers.get('x-live-admin-token') || '');
  const otp = String(request.headers.get('x-live-admin-otp') || '').replace(/\D/g, '');
  const trusted = request.headers.get('x-live-admin-remember') === '1';
  if (!safeStringEqual(token, config.adminToken)) throw authError('admin-forbidden', 403);
  if (!await verifyLiveAdminTotp(config.totpSecret, otp, now)) throw authError('admin-otp-invalid', 403);

  const sessionToken = randomSecret(32);
  const csrfToken = await deriveAdminCsrfToken(sessionToken, config.sessionSecret);
  const sessionId = crypto.randomUUID();
  const expiresAt = now + (trusted ? ADMIN_TRUSTED_SESSION_TTL_MS : ADMIN_SESSION_TTL_MS);
  const record = {
    sessionIdHash: await hashAdminSecret(sessionId, config.sessionSecret),
    tokenHash: await hashAdminSecret(sessionToken, config.sessionSecret),
    csrfHash: await hashAdminSecret(csrfToken, config.sessionSecret),
    trusted,
    createdAt: now,
    expiresAt,
    lastSeenAt: now,
  };
  await saveAdminSession(env, record);
  return {
    sessionToken,
    csrfToken,
    expiresAt,
    trusted,
    cookie: serializeAdminCookie(sessionToken, expiresAt, now),
  };
}

export async function requireLiveAdminSession(request, env, now = Date.now(), options = {}) {
  const config = adminAuthConfig(env);
  const cookieToken = readCookie(request, ADMIN_COOKIE_NAME);
  if (cookieToken) {
    const tokenHash = await hashAdminSecret(cookieToken, config.sessionSecret);
    const session = await loadAdminSession(env, tokenHash);
    if (!session || session.revokedAt || session.expiresAt <= now) {
      throw authError('admin-session-expired', 401);
    }
    if (options.mutation) await verifyAdminMutation(request, config, session.csrfHash);
    await touchAdminSession(env, tokenHash, now).catch(() => {});
    return {
      expiresAt: session.expiresAt,
      trusted: session.trusted,
      sessionIdHash: session.sessionIdHash,
    };
  }

  throw authError('admin-session-required', 401);
}

export async function getLiveAdminSession(request, env, now = Date.now()) {
  const cookieToken = readCookie(request, ADMIN_COOKIE_NAME);
  if (!cookieToken) throw authError('admin-session-required', 401);
  const session = await requireLiveAdminSession(request, env, now);
  const config = adminAuthConfig(env);
  const csrfToken = await deriveAdminCsrfToken(cookieToken, config.sessionSecret);
  return { csrfToken, expiresAt: session.expiresAt, trusted: session.trusted };
}

export async function revokeLiveAdminSession(request, env, { all = false } = {}, now = Date.now()) {
  const config = adminAuthConfig(env);
  const token = readCookie(request, ADMIN_COOKIE_NAME);
  if (!token) return { revoked: false, cookie: clearAdminCookie() };
  const tokenHash = await hashAdminSecret(token, config.sessionSecret);
  const current = await loadAdminSession(env, tokenHash);
  if (!current) return { revoked: false, cookie: clearAdminCookie() };
  if (all) await revokeAllAdminSessions(env, now);
  else await revokeAdminSession(env, tokenHash, now);
  return { revoked: true, all, cookie: clearAdminCookie() };
}

export async function listLiveAdminSessions(env, now = Date.now()) {
  if (!env?.REMOTE_DB) return [];
  await ensureAdminSessionSchema(env);
  const result = await env.REMOTE_DB.prepare(`
    SELECT session_id_hash, trusted, created_at, expires_at, last_seen_at, revoked_at
    FROM live_admin_sessions
    WHERE expires_at > ?
    ORDER BY last_seen_at DESC
    LIMIT 100
  `).bind(now).all();
  return (result?.results || []).map((row) => ({
    sessionId: String(row.session_id_hash || '').slice(0, 16),
    trusted: Boolean(row.trusted),
    createdAt: Number(row.created_at),
    expiresAt: Number(row.expires_at),
    lastSeenAt: Number(row.last_seen_at),
    revokedAt: row.revoked_at == null ? null : Number(row.revoked_at),
  }));
}

export async function revokeLiveAdminSessionById(env, sessionIdPrefix, now = Date.now()) {
  if (!env?.REMOTE_DB || !/^[a-f0-9]{8,64}$/i.test(String(sessionIdPrefix || ''))) {
    throw authError('admin-session-id-invalid', 400);
  }
  await ensureAdminSessionSchema(env);
  const result = await env.REMOTE_DB.prepare(`
    UPDATE live_admin_sessions SET revoked_at = ?
    WHERE session_id_hash LIKE ? AND revoked_at IS NULL
  `).bind(now, `${sessionIdPrefix}%`).run();
  if (Number(result?.meta?.changes || 0) !== 1) throw authError('admin-session-not-found', 404);
  return { revoked: true, sessionId: sessionIdPrefix };
}

export async function generateLiveAdminTotp(secret, now = Date.now()) {
  const normalizedSecret = normalizeBase32Secret(secret);
  if (normalizedSecret.length < 32) throw authError('admin-2fa-not-configured', 503);
  const counter = BigInt(Math.floor(now / TOTP_PERIOD_MS));
  const counterBytes = new Uint8Array(8);
  let value = counter;
  for (let index = counterBytes.length - 1; index >= 0; index -= 1) {
    counterBytes[index] = Number(value & 0xffn);
    value >>= 8n;
  }
  const digest = await signHmac(counterBytes, decodeBase32(normalizedSecret), 'SHA-1', true);
  const offset = digest[digest.length - 1] & 0x0f;
  const number = ((digest[offset] & 0x7f) << 24)
    | (digest[offset + 1] << 16)
    | (digest[offset + 2] << 8)
    | digest[offset + 3];
  return String(number % 1_000_000).padStart(6, '0');
}

async function verifyLiveAdminTotp(secret, otp, now) {
  if (!/^\d{6}$/.test(otp)) return false;
  for (const windowOffset of [-1, 0, 1]) {
    const expected = await generateLiveAdminTotp(secret, now + windowOffset * TOTP_PERIOD_MS);
    if (safeStringEqual(otp, expected)) return true;
  }
  return false;
}

async function verifyAdminMutation(request, config, expectedCsrfHash) {
  verifySameOrigin(request);
  const csrf = String(request.headers.get(ADMIN_CSRF_HEADER) || '');
  if (!csrf || !safeStringEqual(await hashAdminSecret(csrf, config.sessionSecret), expectedCsrfHash)) {
    throw authError('admin-csrf-invalid', 403);
  }
}

function verifySameOrigin(request) {
  const origin = String(request.headers.get('origin') || '');
  const expected = new URL(request.url).origin;
  if (!origin || origin !== expected) throw authError('admin-origin-invalid', 403);
}

async function saveAdminSession(env, record) {
  if (env?.REMOTE_DB) {
    await ensureAdminSessionSchema(env);
    await env.REMOTE_DB.prepare(`
      INSERT INTO live_admin_sessions
        (session_id_hash, token_hash, csrf_hash, trusted, created_at, expires_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(record.sessionIdHash, record.tokenHash, record.csrfHash, record.trusted ? 1 : 0,
      record.createdAt, record.expiresAt, record.lastSeenAt).run();
    return;
  }
  if (!env?.LIVE_KV) throw authError('admin-session-storage-not-configured', 503);
  await env.LIVE_KV.put(`${ADMIN_SESSION_PREFIX}${record.tokenHash}`, JSON.stringify(record), {
    expirationTtl: Math.max(60, Math.ceil((record.expiresAt - Date.now()) / 1000)),
  });
}

async function loadAdminSession(env, tokenHash) {
  if (!tokenHash) return null;
  if (env?.REMOTE_DB) {
    await ensureAdminSessionSchema(env);
    const row = await env.REMOTE_DB.prepare(`
      SELECT session_id_hash, token_hash, csrf_hash, trusted, created_at, expires_at, last_seen_at, revoked_at
      FROM live_admin_sessions WHERE token_hash = ? LIMIT 1
    `).bind(tokenHash).first();
    return row ? {
      sessionIdHash: row.session_id_hash,
      tokenHash: row.token_hash,
      csrfHash: row.csrf_hash,
      trusted: Boolean(row.trusted),
      createdAt: Number(row.created_at),
      expiresAt: Number(row.expires_at),
      lastSeenAt: Number(row.last_seen_at),
      revokedAt: row.revoked_at == null ? null : Number(row.revoked_at),
    } : null;
  }
  if (!env?.LIVE_KV) return null;
  return await env.LIVE_KV.get(`${ADMIN_SESSION_PREFIX}${tokenHash}`, { type: 'json' });
}

async function touchAdminSession(env, tokenHash, now) {
  if (env?.REMOTE_DB) {
    await env.REMOTE_DB.prepare('UPDATE live_admin_sessions SET last_seen_at = ? WHERE token_hash = ?')
      .bind(now, tokenHash).run();
    return;
  }
  const record = await loadAdminSession(env, tokenHash);
  if (!record) return;
  record.lastSeenAt = now;
  await saveAdminSession(env, record);
}

async function revokeAdminSession(env, tokenHash, now) {
  if (env?.REMOTE_DB) {
    await env.REMOTE_DB.prepare('UPDATE live_admin_sessions SET revoked_at = ? WHERE token_hash = ?')
      .bind(now, tokenHash).run();
  } else if (env?.LIVE_KV) {
    await env.LIVE_KV.delete(`${ADMIN_SESSION_PREFIX}${tokenHash}`);
  }
}

async function revokeAllAdminSessions(env, now) {
  if (env?.REMOTE_DB) {
    await ensureAdminSessionSchema(env);
    await env.REMOTE_DB.prepare('UPDATE live_admin_sessions SET revoked_at = ? WHERE revoked_at IS NULL')
      .bind(now).run();
  } else {
    // KV cannot safely enumerate every key in all test/runtime implementations.
    throw authError('admin-all-session-revoke-requires-d1', 503);
  }
}

const adminSchemaByDatabase = new WeakMap();
async function ensureAdminSessionSchema(env) {
  let adminSchemaPromise = adminSchemaByDatabase.get(env.REMOTE_DB);
  if (!adminSchemaPromise) {
    adminSchemaPromise = env.REMOTE_DB.prepare(`
      CREATE TABLE IF NOT EXISTS live_admin_sessions (
        session_id_hash TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        csrf_hash TEXT NOT NULL,
        trusted INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        revoked_at INTEGER
      )
    `).run().then(() => env.REMOTE_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_live_admin_sessions_active
      ON live_admin_sessions (revoked_at, expires_at DESC)
    `).run()).catch((error) => {
      adminSchemaByDatabase.delete(env.REMOTE_DB);
      throw error;
    });
    adminSchemaByDatabase.set(env.REMOTE_DB, adminSchemaPromise);
  }
  return adminSchemaPromise;
}

function adminAuthConfig(env) {
  const adminToken = String(env?.LIVE_ADMIN_TOKEN || '');
  const totpSecret = normalizeBase32Secret(env?.LIVE_ADMIN_TOTP_SECRET);
  const sessionSecret = String(env?.LIVE_ADMIN_SESSION_SECRET || '');
  if (adminToken.length < 32 || totpSecret.length < 32 || sessionSecret.length < 32) {
    throw authError('admin-2fa-not-configured', 503);
  }
  return { adminToken, totpSecret, sessionSecret };
}

async function hashAdminSecret(value, secret) {
  return encodeHex(await signHmac(String(value || ''), secret, 'SHA-256'));
}

async function deriveAdminCsrfToken(sessionToken, secret) {
  return encodeBase64Url(await signHmac(`csrf:${sessionToken}`, secret, 'SHA-256'));
}

async function signHmac(message, secret, hash, secretIsBytes = false) {
  const keyBytes = secretIsBytes ? secret : new TextEncoder().encode(String(secret));
  const messageBytes = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, messageBytes));
}

function randomSecret(bytes) {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

function readCookie(request, name) {
  const prefix = `${name}=`;
  for (const part of String(request.headers.get('cookie') || '').split(';')) {
    const value = part.trim();
    if (value.startsWith(prefix)) return decodeURIComponent(value.slice(prefix.length));
  }
  return '';
}

function serializeAdminCookie(token, expiresAt, now) {
  const maxAge = Math.max(0, Math.floor((expiresAt - now) / 1000));
  return `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

function clearAdminCookie() {
  return `${ADMIN_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

function normalizeBase32Secret(value) {
  return String(value || '').toUpperCase().replace(/[\s=-]/g, '');
}

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of value) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw authError('admin-2fa-not-configured', 503);
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  return new Uint8Array(bytes);
}

function encodeBase64Url(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function encodeHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeStringEqual(left, right) {
  const leftBytes = new TextEncoder().encode(String(left || ''));
  const rightBytes = new TextEncoder().encode(String(right || ''));
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }
  return difference === 0;
}

function authError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
