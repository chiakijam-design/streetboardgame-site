const CSRF_SESSION_KEY = 'live:admin-csrf';
const TRUSTED_HINT_KEY = 'live:admin-trusted-hint';

export function getAdminSessionToken() {
  return readStorage(sessionStorage, CSRF_SESSION_KEY);
}

export function saveAdminSessionToken(csrfToken, rememberDevice) {
  writeStorage(sessionStorage, CSRF_SESSION_KEY, csrfToken);
  if (rememberDevice) writeStorage(localStorage, TRUSTED_HINT_KEY, '1');
  else removeStorage(localStorage, TRUSTED_HINT_KEY);
}

export async function restoreAdminSessionToken() {
  const response = await fetch('/api/live/admin/session', {
    method: 'GET',
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.csrfToken) return false;
  saveAdminSessionToken(data.csrfToken, Boolean(data.trusted));
  return true;
}

export async function revokeAdminSession({ all = false } = {}) {
  const csrfToken = getAdminSessionToken();
  if (csrfToken) {
    await fetch(`/api/live/admin/session/${all ? 'logout-all' : 'logout'}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-admin-csrf': csrfToken },
      body: '{}',
    }).catch(() => null);
  }
  clearAdminSessionToken();
}

export function clearAdminSessionToken() {
  removeStorage(sessionStorage, CSRF_SESSION_KEY);
  removeStorage(sessionStorage, 'live:admin-session');
  removeStorage(localStorage, 'live:trusted-admin-session');
  removeStorage(localStorage, TRUSTED_HINT_KEY);
}

export function hasTrustedAdminSession() {
  return readStorage(localStorage, TRUSTED_HINT_KEY) === '1';
}

function readStorage(storage, key) {
  try { return storage.getItem(key) || ''; } catch (error) { return ''; }
}

function writeStorage(storage, key, value) {
  try { storage.setItem(key, String(value || '')); } catch (error) { /* no-op */ }
}

function removeStorage(storage, key) {
  try { storage.removeItem(key); } catch (error) { /* no-op */ }
}
