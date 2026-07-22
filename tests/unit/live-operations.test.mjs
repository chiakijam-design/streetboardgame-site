import test from 'node:test';
import assert from 'node:assert/strict';
import { handleLiveApi, verifyLiveStripeSignature } from '../../src/live/api.js';
import { createLiveAdminSession, generateLiveAdminTotp, requireLiveAdminSession } from '../../src/live/admin-auth.js';

test('Stripe Webhook署名は正しいv1署名だけを受理する', async () => {
  const secret = 'whsec_test_secret';
  const payload = JSON.stringify({ id: 'evt_test', type: 'payment_intent.payment_failed' });
  const timestamp = 1_800_000_000;
  const signature = await sign(secret, `${timestamp}.${payload}`);
  const now = timestamp * 1000;

  assert.equal(await verifyLiveStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, now), true);
  assert.equal(await verifyLiveStripeSignature(`${payload}x`, `t=${timestamp},v1=${signature}`, secret, now), false);
  assert.equal(await verifyLiveStripeSignature(payload, `t=${timestamp - 301},v1=${signature}`, secret, now), false);
});

test('Stripe署名ローテーション中は複数v1のいずれかが一致すれば受理する', async () => {
  const secret = 'whsec_test_secret';
  const payload = '{}';
  const timestamp = 1_800_000_000;
  const signature = await sign(secret, `${timestamp}.${payload}`);
  assert.equal(await verifyLiveStripeSignature(
    payload,
    `t=${timestamp},v1=${'0'.repeat(64)},v1=${signature}`,
    secret,
    timestamp * 1000,
  ), true);
});

test('緊急メンテナンス中は公開状態を返し、新規LIVE処理を503で止める', async () => {
  const env = {
    LIVE_EMERGENCY_MODE: 'maintenance',
    LIVE_EMERGENCY_TITLE: '緊急メンテナンス',
    LIVE_EMERGENCY_MESSAGE: '新規参加を停止しています。',
    LIVE_KV: memoryKv(),
  };
  const statusResponse = await handleLiveApi(new Request('https://example.com/api/live/status'), env, '/api/live/status');
  assert.equal(statusResponse.status, 200);
  assert.deepEqual((await statusResponse.json()).status, {
    mode: 'maintenance', title: '緊急メンテナンス', message: '新規参加を停止しています。', source: 'environment', updatedAt: 0,
  });
  const createResponse = await handleLiveApi(new Request('https://example.com/api/live/games', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  }), env, '/api/live/games');
  assert.equal(createResponse.status, 503);
  assert.equal((await createResponse.json()).error, 'live-maintenance');
});

test('外形監視はWorker・D1・リアルタイム構成が正常な場合だけ200を返す', async () => {
  const healthyEnv = {
    REMOTE_DB: healthD1(),
    LIVE_ROOM_COORDINATOR: {},
    LIVE_VOTE_SHARD: {},
  };
  const healthyResponse = await handleLiveApi(
    new Request('https://example.com/api/live/health'), healthyEnv, '/api/live/health',
  );
  assert.equal(healthyResponse.status, 200);
  assert.deepEqual((await healthyResponse.json()).checks, { worker: true, database: true, realtime: true });

  const missingBindingResponse = await handleLiveApi(
    new Request('https://example.com/api/live/health'), {}, '/api/live/health',
  );
  assert.equal(missingBindingResponse.status, 503);
  assert.equal((await missingBindingResponse.json()).state, 'unavailable');

  const maintenanceResponse = await handleLiveApi(
    new Request('https://example.com/api/live/health'),
    { ...healthyEnv, LIVE_EMERGENCY_MODE: 'maintenance' },
    '/api/live/health',
  );
  assert.equal(maintenanceResponse.status, 503);
  assert.equal((await maintenanceResponse.json()).state, 'maintenance');
});

test('管理画面は管理トークンとTOTPの二要素で15分セッションを発行する', async () => {
  assert.equal(await generateLiveAdminTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000), '287082');
  const now = 1_800_000_000_000;
  const env = adminAuthEnv(memoryKv());
  const otp = await generateLiveAdminTotp(env.LIVE_ADMIN_TOTP_SECRET, now);
  const session = await createLiveAdminSession(new Request('https://example.com/api/live/admin/session', {
    method: 'POST', headers: { 'x-live-admin-token': env.LIVE_ADMIN_TOKEN, 'x-live-admin-otp': otp },
  }), env, now);
  assert.match(session.sessionToken, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(session.expiresAt, now + 15 * 60 * 1000);
  assert.deepEqual(await requireLiveAdminSession(new Request('https://example.com/api/live/admin/overview', {
    headers: { 'x-live-admin-session': session.sessionToken },
  }), env, now + 14 * 60 * 1000), { expiresAt: session.expiresAt });
  await assert.rejects(
    requireLiveAdminSession(new Request('https://example.com/api/live/admin/overview', {
      headers: { 'x-live-admin-session': session.sessionToken },
    }), env, now + 16 * 60 * 1000),
    (error) => error.message === 'admin-session-expired' && error.status === 401,
  );
});

test('購入履歴専用D1がない場合はゲーム用保存先へフォールバックしない', async () => {
  const response = await handleLiveApi(
    new Request('https://example.com/api/live/result-entitlements/purchase01?access=secret'),
    { LIVE_KV: memoryKv() },
    '/api/live/result-entitlements/purchase01',
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'live-purchase-storage-not-configured');
});

test('漏えいURLを再発行すると旧トークンを失効し、強制終了で予約を解放する', async () => {
  const kv = memoryKv();
  const now = Date.now();
  const game = {
    version: 5, title: '運営テスト', subjectName: '本人', channelName: 'チャンネル',
    questions: [{ id: 'q1', type: 'guess-person', text: '問題', options: ['1','2','3','4','5'], lockedIndex: null }],
    hostToken: 'a'.repeat(48), subjectToken: 'b'.repeat(48), phase: 'lobby', currentQuestionIndex: 0,
    participants: [], votes: {}, results: [], showVoteCount: false, participantCount: 0, participantLimit: 50,
    createdAt: now, updatedAt: now, scheduledAt: now + 60_000, reservationEndsAt: now + 3_600_000, expiresAt: now + 3_600_000,
  };
  const reservationToCancel = {
    ...game,
    title: 'キャンセル対象',
    hostToken: 'c'.repeat(48),
    subjectToken: 'd'.repeat(48),
    scheduledAt: now + 120_000,
    reservationEndsAt: now + 3_660_000,
    expiresAt: now + 3_660_000,
  };
  await kv.put('live:123456', JSON.stringify(game));
  await kv.put('live:654321', JSON.stringify(reservationToCancel));
  await kv.put('live:reservations', JSON.stringify([
    { code: '123456', scheduledAt: game.scheduledAt, expiresAt: game.expiresAt },
    { code: '654321', scheduledAt: reservationToCancel.scheduledAt, expiresAt: reservationToCancel.expiresAt },
  ]));
  const env = adminAuthEnv(kv);
  const otp = await generateLiveAdminTotp(env.LIVE_ADMIN_TOTP_SECRET);
  const sessionResponse = await handleLiveApi(new Request('https://example.com/api/live/admin/session', {
    method: 'POST', headers: {
      'content-type': 'application/json',
      'x-live-admin-token': env.LIVE_ADMIN_TOKEN,
      'x-live-admin-otp': otp,
    }, body: '{}',
  }), env, '/api/live/admin/session');
  assert.equal(sessionResponse.status, 200);
  const sessionToken = (await sessionResponse.json()).sessionToken;
  const rotateResponse = await handleLiveApi(new Request('https://example.com/api/live/admin/games/123456/rotate-links', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-live-admin-session': sessionToken },
    body: JSON.stringify({ host: true, subject: false }),
  }), env, '/api/live/admin/games/123456/rotate-links');
  assert.equal(rotateResponse.status, 200);
  const rotated = await rotateResponse.json();
  assert.match(rotated.hostUrl, /\/live\?room=123456#host=[a-f0-9]{48}$/);
  assert.equal(new URL(rotated.hostUrl).searchParams.has('host'), false);
  const storedAfterRotate = await kv.get('live:123456', { type: 'json' });
  assert.notEqual(storedAfterRotate.hostToken, game.hostToken);
  assert.equal(storedAfterRotate.subjectToken, game.subjectToken);

  const cancelResponse = await handleLiveApi(new Request('https://example.com/api/live/admin/games/654321/cancel', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-live-admin-session': sessionToken },
    body: '{}',
  }), env, '/api/live/admin/games/654321/cancel');
  assert.equal(cancelResponse.status, 200);
  assert.equal((await cancelResponse.json()).game.phase, 'cancelled');
  assert.deepEqual((await kv.get('live:reservations', { type: 'json' })).map((item) => item.code), ['123456']);

  const terminateResponse = await handleLiveApi(new Request('https://example.com/api/live/admin/games/123456/terminate', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-live-admin-session': sessionToken },
    body: JSON.stringify({ message: '安全のため終了します。' }),
  }), env, '/api/live/admin/games/123456/terminate');
  assert.equal(terminateResponse.status, 200);
  assert.equal((await terminateResponse.json()).game.phase, 'terminated');
  assert.deepEqual(await kv.get('live:reservations', { type: 'json' }), []);
});

test('スタッフは開始前の予約を安全に変更・URL再発行・キャンセルできる', async () => {
  const kv = memoryKv();
  const now = Date.now();
  const originalScheduledAt = now + 48 * 60 * 60 * 1000;
  const conflictingScheduledAt = now + 96 * 60 * 60 * 1000;
  const changedScheduledAt = now + 144 * 60 * 60 * 1000;
  const hostToken = 'c'.repeat(48);
  const game = {
    version: 5, title: '予約管理テスト', subjectName: '本人', channelName: 'チャンネル',
    questions: [{ id: 'q1', type: 'guess-person', text: '問題', options: ['1','2','3','4','5'], lockedIndex: null }],
    hostToken, subjectToken: 'd'.repeat(48), phase: 'lobby', currentQuestionIndex: 0,
    participants: [], votes: {}, results: [], showVoteCount: false, participantCount: 0, participantLimit: 50,
    createdAt: now, updatedAt: now, scheduledAt: originalScheduledAt,
    reservationEndsAt: originalScheduledAt + 20 * 60 * 60 * 1000,
    expiresAt: originalScheduledAt + 20 * 60 * 60 * 1000,
  };
  await kv.put('live:654321', JSON.stringify(game));
  await kv.put('live:reservations', JSON.stringify([
    { code: '654321', scheduledAt: originalScheduledAt, expiresAt: game.expiresAt },
    { code: '999999', scheduledAt: conflictingScheduledAt, expiresAt: conflictingScheduledAt + 20 * 60 * 60 * 1000 },
  ]));
  const env = { LIVE_KV: kv };
  const hostHeaders = { 'content-type': 'application/json', 'x-live-host-token': hostToken };

  const unavailableResponse = await handleLiveApi(new Request(
    `https://example.com/api/live/reservations/availability?scheduledAt=${conflictingScheduledAt}&code=654321`,
    { headers: hostHeaders },
  ), env, '/api/live/reservations/availability');
  assert.equal(unavailableResponse.status, 200);
  assert.equal((await unavailableResponse.json()).available, false);

  const conflictingMoveResponse = await handleLiveApi(new Request('https://example.com/api/live/games/654321/reschedule', {
    method: 'POST', headers: hostHeaders, body: JSON.stringify({ scheduledAt: conflictingScheduledAt }),
  }), env, '/api/live/games/654321/reschedule');
  assert.equal(conflictingMoveResponse.status, 409);
  assert.equal((await conflictingMoveResponse.json()).error, 'live-slot-unavailable');
  assert.equal((await kv.get('live:654321', { type: 'json' })).scheduledAt, originalScheduledAt);
  assert.equal((await kv.get('live:reservations', { type: 'json' })).find((item) => item.code === '654321').scheduledAt, originalScheduledAt);

  const rescheduleResponse = await handleLiveApi(new Request('https://example.com/api/live/games/654321/reschedule', {
    method: 'POST', headers: hostHeaders, body: JSON.stringify({ scheduledAt: changedScheduledAt }),
  }), env, '/api/live/games/654321/reschedule');
  assert.equal(rescheduleResponse.status, 200);
  assert.equal((await rescheduleResponse.json()).game.scheduledAt, changedScheduledAt);
  const reservationsAfterMove = await kv.get('live:reservations', { type: 'json' });
  assert.equal(reservationsAfterMove.find((item) => item.code === '654321').scheduledAt, changedScheduledAt);

  const rotateResponse = await handleLiveApi(new Request('https://example.com/api/live/games/654321/rotate-links', {
    method: 'POST', headers: hostHeaders, body: JSON.stringify({ host: true }),
  }), env, '/api/live/games/654321/rotate-links');
  assert.equal(rotateResponse.status, 200);
  const rotated = await rotateResponse.json();
  assert.match(rotated.hostUrl, /\/live\?room=654321#host=[a-f0-9]{48}$/);
  assert.notEqual(rotated.hostToken, hostToken);

  const oldTokenResponse = await handleLiveApi(new Request('https://example.com/api/live/games/654321/cancel', {
    method: 'POST', headers: hostHeaders, body: '{}',
  }), env, '/api/live/games/654321/cancel');
  assert.equal(oldTokenResponse.status, 403);
  assert.equal((await oldTokenResponse.json()).error, 'host-forbidden');

  const cancelResponse = await handleLiveApi(new Request('https://example.com/api/live/games/654321/cancel', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-live-host-token': rotated.hostToken },
    body: '{}',
  }), env, '/api/live/games/654321/cancel');
  assert.equal(cancelResponse.status, 200);
  assert.equal((await cancelResponse.json()).game.phase, 'cancelled');
  assert.deepEqual((await kv.get('live:reservations', { type: 'json' })).map((item) => item.code), ['999999']);

  const joinResponse = await handleLiveApi(new Request('https://example.com/api/live/games/654321/join', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '視聴者' }),
  }), env, '/api/live/games/654321/join');
  assert.equal(joinResponse.status, 410);
  assert.equal((await joinResponse.json()).error, 'game-cancelled');
});

async function sign(secret, value) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function memoryKv() {
  const values = new Map();
  return {
    async get(key, options = {}) {
      const value = values.get(key);
      if (value === undefined) return null;
      return options.type === 'json' ? JSON.parse(value) : value;
    },
    async put(key, value) { values.set(key, String(value)); },
    async delete(key) { values.delete(key); },
  };
}

function adminAuthEnv(kv) {
  return {
    LIVE_KV: kv,
    LIVE_ADMIN_TOKEN: 'admin-token-'.repeat(4),
    LIVE_ADMIN_TOTP_SECRET: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
    LIVE_ADMIN_SESSION_SECRET: 'session-secret-'.repeat(3),
  };
}

function healthD1() {
  return {
    prepare(sql) {
      return {
        bind() { return this; },
        async run() { return { success: true }; },
        async first() {
          if (/SELECT 1 AS ok/i.test(sql)) return { ok: 1 };
          return null;
        },
      };
    },
  };
}
