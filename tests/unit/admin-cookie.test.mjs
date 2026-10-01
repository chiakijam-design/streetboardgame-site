import test from 'node:test';
import assert from 'node:assert/strict';
import { handleLiveApi } from '../../src/live/api.js';
import {
  createLiveAdminSession, generateLiveAdminTotp, getLiveAdminSession,
  requireLiveAdminSession, revokeLiveAdminSession,
} from '../../src/live/admin-auth.js';

function authEnv() {
  const values = new Map();
  return {
    LIVE_ADMIN_TOKEN: 'local-test-admin-token-'.repeat(3),
    LIVE_ADMIN_TOTP_SECRET: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
    LIVE_ADMIN_SESSION_SECRET: 'local-test-session-secret-'.repeat(3),
    LIVE_KV: {
      async get(key, options = {}) {
        const value = values.get(key);
        return value === undefined ? null : options.type === 'json' ? JSON.parse(value) : value;
      },
      async put(key, value) { values.set(key, String(value)); },
      async delete(key) { values.delete(key); },
    },
  };
}

function request(cookie, path = '/api/live/admin/session') {
  return new Request(`https://example.com${path}`, { headers: { cookie } });
}

for (const malformed of ['%', '%C0', '%E3%81', '%GG']) {
  test(`malformed admin cookie ${malformed} returns controlled 401, not 500`, async () => {
    const response = await handleLiveApi(request(`sbg_admin_session=${malformed}`), authEnv(), '/api/live/admin/session');
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, 'admin-session-invalid');
  });
}

test('all shared admin cookie readers reject malformed encoding without exposing the value', async () => {
  const env = authEnv();
  for (const read of [getLiveAdminSession, requireLiveAdminSession, revokeLiveAdminSession]) {
    await assert.rejects(read(request('sbg_admin_session=%E3%81'), env),
      (error) => error.status === 401 && error.message === 'admin-session-invalid');
  }
});

test('malformed unrelated cookies do not prevent a valid encoded admin session', async () => {
  const env = authEnv();
  const now = Date.now();
  const otp = await generateLiveAdminTotp(env.LIVE_ADMIN_TOTP_SECRET, now);
  const session = await createLiveAdminSession(new Request('https://example.com/api/live/admin/session', {
    method: 'POST', headers: { 'x-live-admin-token': env.LIVE_ADMIN_TOKEN, 'x-live-admin-otp': otp },
  }), env, now);
  const encoded = [...session.sessionToken].map((character) => `%${character.charCodeAt(0).toString(16)}`).join('');
  const restored = await getLiveAdminSession(request(`unrelated=%; sbg_admin_session=${encoded}`), env, now + 1000);
  assert.equal(restored.csrfToken, session.csrfToken);
  assert.equal(restored.expiresAt, session.expiresAt);
  await assert.rejects(getLiveAdminSession(request(`sbg_admin_session=%; sbg_admin_session=${encoded}`), env, now + 1000),
    (error) => error.status === 401 && error.message === 'admin-session-invalid');
});

test('missing admin cookie remains unauthorized and unrelated malformed values are ignored', async () => {
  const response = await handleLiveApi(request('unrelated=%'), authEnv(), '/api/live/admin/session');
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'admin-session-required');
});
