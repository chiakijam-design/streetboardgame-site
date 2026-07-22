const TOTP_PERIOD_MS = 30_000;
const ADMIN_SESSION_TTL_MS = 15 * 60 * 1000;

export async function createLiveAdminSession(request, env, now = Date.now()) {
  const config = adminAuthConfig(env);
  const token = String(request.headers.get('x-live-admin-token') || '');
  const otp = String(request.headers.get('x-live-admin-otp') || '').replace(/\D/g, '');
  if (!safeStringEqual(token, config.adminToken)) throw authError('admin-forbidden', 403);
  if (!await verifyLiveAdminTotp(config.totpSecret, otp, now)) throw authError('admin-otp-invalid', 403);
  const expiresAt = now + ADMIN_SESSION_TTL_MS;
  const payload = encodeBase64Url(new TextEncoder().encode(JSON.stringify({
    version: 1,
    expiresAt,
    nonce: crypto.randomUUID(),
  })));
  const signature = encodeBase64Url(await signHmac(payload, config.sessionSecret, 'SHA-256'));
  return { sessionToken: `${payload}.${signature}`, expiresAt };
}

export async function requireLiveAdminSession(request, env, now = Date.now()) {
  const config = adminAuthConfig(env);
  const sessionToken = String(request.headers.get('x-live-admin-session') || '');
  const [payload, signature, extra] = sessionToken.split('.');
  if (!payload || !signature || extra) throw authError('admin-session-required', 401);
  const expectedSignature = encodeBase64Url(await signHmac(payload, config.sessionSecret, 'SHA-256'));
  if (!safeStringEqual(signature, expectedSignature)) throw authError('admin-session-invalid', 401);
  let session;
  try {
    session = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
  } catch (error) {
    throw authError('admin-session-invalid', 401);
  }
  const expiresAt = Number(session?.expiresAt);
  if (session?.version !== 1 || !Number.isFinite(expiresAt) || expiresAt <= now
    || expiresAt > now + ADMIN_SESSION_TTL_MS) {
    throw authError('admin-session-expired', 401);
  }
  return { expiresAt };
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

function adminAuthConfig(env) {
  const adminToken = String(env?.LIVE_ADMIN_TOKEN || '');
  const totpSecret = normalizeBase32Secret(env?.LIVE_ADMIN_TOTP_SECRET);
  const sessionSecret = String(env?.LIVE_ADMIN_SESSION_SECRET || '');
  if (adminToken.length < 32 || totpSecret.length < 32 || sessionSecret.length < 32) {
    throw authError('admin-2fa-not-configured', 503);
  }
  return { adminToken, totpSecret, sessionSecret };
}

async function signHmac(message, secret, hash, secretIsBytes = false) {
  const keyBytes = secretIsBytes ? secret : new TextEncoder().encode(String(secret));
  const messageBytes = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, messageBytes));
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

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
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
