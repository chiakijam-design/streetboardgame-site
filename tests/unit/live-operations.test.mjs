import test from 'node:test';
import assert from 'node:assert/strict';
import { handleLiveApi, verifyLiveStripeSignature } from '../../src/live/api.js';

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
  await kv.put('live:123456', JSON.stringify(game));
  await kv.put('live:reservations', JSON.stringify([{ code: '123456', scheduledAt: game.scheduledAt, expiresAt: game.expiresAt }]));
  const env = { LIVE_KV: kv, LIVE_ADMIN_TOKEN: 'admin'.repeat(8) };
  const rotateResponse = await handleLiveApi(new Request('https://example.com/api/live/admin/games/123456/rotate-links', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-live-admin-token': env.LIVE_ADMIN_TOKEN },
    body: JSON.stringify({ host: true, subject: false }),
  }), env, '/api/live/admin/games/123456/rotate-links');
  assert.equal(rotateResponse.status, 200);
  const rotated = await rotateResponse.json();
  assert.match(rotated.hostUrl, /\/live\?room=123456#host=[a-f0-9]{48}$/);
  assert.equal(new URL(rotated.hostUrl).searchParams.has('host'), false);
  const storedAfterRotate = await kv.get('live:123456', { type: 'json' });
  assert.notEqual(storedAfterRotate.hostToken, game.hostToken);
  assert.equal(storedAfterRotate.subjectToken, game.subjectToken);

  const terminateResponse = await handleLiveApi(new Request('https://example.com/api/live/admin/games/123456/terminate', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-live-admin-token': env.LIVE_ADMIN_TOKEN },
    body: JSON.stringify({ message: '安全のため終了します。' }),
  }), env, '/api/live/admin/games/123456/terminate');
  assert.equal(terminateResponse.status, 200);
  assert.equal((await terminateResponse.json()).game.phase, 'terminated');
  assert.deepEqual(await kv.get('live:reservations', { type: 'json' }), []);
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
