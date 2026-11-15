// Keyed hashes for sender counting (contact form, rate limits; 2026-11-15).
// A plain SHA-256 of an IPv4 address can be reversed by trying every address,
// so the hash is an HMAC keyed with a Worker secret. RATE_LIMIT_SECRET is used
// when set; otherwise a key is derived from the existing admin session secret
// with a separate label, so the admin secret itself is never used directly.
// Without any secret (local tests) it falls back to plain SHA-256.
const keyCache = new Map();
const encoder = new TextEncoder();

function hex(buffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmac(keyBytes, message) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', key, encoder.encode(message));
}

async function senderKey(env) {
  const own = String(env?.RATE_LIMIT_SECRET || '');
  const base = own || String(env?.LIVE_ADMIN_SESSION_SECRET || '');
  if (!base) return null;
  const cacheId = (own ? 'own:' : 'derived:') + base;
  if (!keyCache.has(cacheId)) {
    keyCache.set(cacheId, own
      ? Promise.resolve(encoder.encode(own))
      : hmac(encoder.encode(base), 'watachan-sender-key-v1').then((bytes) => new Uint8Array(bytes)));
  }
  return keyCache.get(cacheId);
}

export async function senderDigest(env, message) {
  const key = await senderKey(env);
  if (key) return hex(await hmac(key, message));
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(message)));
}
