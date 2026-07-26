const TAB_SESSION_KEY = 'live:admin-session';
const TRUSTED_SESSION_KEY = 'live:trusted-admin-session';

export function getAdminSessionToken() {
  return readStorage(sessionStorage, TAB_SESSION_KEY)
    || readStorage(localStorage, TRUSTED_SESSION_KEY);
}

export function saveAdminSessionToken(sessionToken, rememberDevice) {
  clearAdminSessionToken();
  const storage = rememberDevice ? localStorage : sessionStorage;
  const key = rememberDevice ? TRUSTED_SESSION_KEY : TAB_SESSION_KEY;
  writeStorage(storage, key, sessionToken);
}

export function clearAdminSessionToken() {
  removeStorage(sessionStorage, TAB_SESSION_KEY);
  removeStorage(localStorage, TRUSTED_SESSION_KEY);
}

export function hasTrustedAdminSession() {
  return Boolean(readStorage(localStorage, TRUSTED_SESSION_KEY));
}

function readStorage(storage, key) {
  try {
    return storage.getItem(key) || '';
  } catch (error) {
    return '';
  }
}

function writeStorage(storage, key, value) {
  try {
    storage.setItem(key, String(value || ''));
  } catch (error) {
    sessionStorage.setItem(TAB_SESSION_KEY, String(value || ''));
  }
}

function removeStorage(storage, key) {
  try {
    storage.removeItem(key);
  } catch (error) {
    // Storage can be unavailable in strict private-browsing modes.
  }
}
