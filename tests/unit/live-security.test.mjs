import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LIVE_SUPPORT_MESSAGES_PUBLIC,
  assessStripePaymentRisk,
  createLiveCreatorInvite,
  normalizeParticipantName,
  requireLiveCreatorInvite,
  revokeLiveCreatorInvite,
} from '../../src/live/security.js';

test('参加者名は正規化し、重大な攻撃語・URL・連絡先らしい値を拒否する', () => {
  assert.equal(normalizeParticipantName('  視聴者　A  '), '視聴者 A');
  assert.throws(() => normalizeParticipantName('し・ね'), /participant-name-not-allowed/);
  assert.throws(() => normalizeParticipantName('https://example.com'), /participant-name-not-allowed/);
  assert.throws(() => normalizeParticipantName('09012345678'), /participant-name-not-allowed/);
});

test('初期版は応援メッセージを公開しない', () => {
  assert.equal(LIVE_SUPPORT_MESSAGES_PUBLIC, false);
});

test('Stripeの早期不正警告・異議申立て・高リスク判定を停止対象にする', () => {
  assert.equal(assessStripePaymentRisk({ type: 'radar.early_fraud_warning.created', data: { object: {} } }).blocked, true);
  assert.equal(assessStripePaymentRisk({ type: 'charge.dispute.created', data: { object: {} } }).blocked, true);
  assert.equal(assessStripePaymentRisk({ type: 'charge.succeeded', data: { object: { outcome: { risk_level: 'elevated', risk_score: 70 } } } }).blocked, true);
  assert.equal(assessStripePaymentRisk({ type: 'charge.succeeded', data: { object: { outcome: { risk_level: 'normal', risk_score: 20 } } } }).blocked, false);
});

test('手動審査済みチャンネルに固定した招待を発行・検証・失効する', async () => {
  let inviteRow = null;
  const db = {
    prepare(sql) {
      const text = String(sql).replace(/\s+/g, ' ').trim();
      return {
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() {
          if (text.includes('FROM live_creator_invites WHERE token_hash')) return inviteRow && { ...inviteRow };
          return null;
        },
        async all() { return { results: [] }; },
        async run() {
          if (text.startsWith('INSERT INTO live_creator_invites')) {
            const [inviteId, channelId, channelName, channelUrl, tokenHash, expiresAt, createdAt, reviewedAt] = this.values;
            inviteRow = { invite_id: inviteId, channel_id: channelId, channel_name: channelName, channel_url: channelUrl, token_hash: tokenHash, status: 'active', expires_at: expiresAt, created_at: createdAt, reviewed_at: reviewedAt };
          }
          if (text.startsWith("UPDATE live_creator_invites SET status = 'revoked'")) {
            if (!inviteRow || inviteRow.status !== 'active' || inviteRow.invite_id !== this.values[1]) return { meta: { changes: 0 } };
            inviteRow.status = 'revoked';
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 1 } };
        },
      };
    },
  };
  const env = { REMOTE_DB: db };
  const issued = await createLiveCreatorInvite(env, {
    channelId: 'UC1234567890_test', channelName: '審査済み', channelUrl: 'https://www.youtube.com/channel/UC1234567890_test',
  }, { reviewed: true });
  assert.match(issued.inviteToken, /^[a-f0-9]{64}$/);
  assert.notEqual(inviteRow.token_hash, issued.inviteToken, 'D1には招待コードの平文を保存しない');
  const request = new Request('https://example.com/api/live/games', { headers: { 'x-live-creator-invite': issued.inviteToken } });
  assert.equal((await requireLiveCreatorInvite(request, env, issued.channelId)).invite_id, issued.inviteId);
  await assert.rejects(() => requireLiveCreatorInvite(request, env, 'UC9999999999_other'), /creator-invite-invalid/);
  await revokeLiveCreatorInvite(env, issued.inviteId);
  await assert.rejects(() => requireLiveCreatorInvite(request, env, issued.channelId), /creator-invite-invalid/);
});
