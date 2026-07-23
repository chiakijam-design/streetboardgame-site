import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { acceptCreatorAgreement, getCreatorAgreement } from '../../src/live/agreement.js';
import { CREATOR_TERMS } from '../../src/live/creator-agreement-config.js';

const VERIFICATION_ID = 'a'.repeat(32);
const ACCESS_TOKEN = 'b'.repeat(48);

test('収益分配規約のバージョンとSHA-256を実際の規約全文へ固定する', async () => {
  const document = (await readFile(new URL('../../creator-terms.html', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  assert.equal(CREATOR_TERMS.version, '1.2');
  assert.equal(createHash('sha256').update(document).digest('hex'), CREATOR_TERMS.documentSha256);
});

test('Web同意は規約・日時・IP・端末・Connect IDを改変せず保存する', async () => {
  const db = new AgreementDb(await sha256(ACCESS_TOKEN));
  const env = { REMOTE_DB: db };
  const request = new Request(`https://example.com/api/live/channel-verifications/${VERIFICATION_ID}/agreement`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-live-verification-token': ACCESS_TOKEN,
      'cf-connecting-ip': '203.0.113.10',
      'user-agent': 'Agreement Test Browser/1.0',
    },
    body: JSON.stringify({
      termsVersion: CREATOR_TERMS.version,
      termsDocumentSha256: CREATOR_TERMS.documentSha256,
      contractingName: 'テスト株式会社',
      contactEmail: 'CREATOR@example.com',
      confirmTerms: true,
      confirmAuthority: true,
      confirmPrivacy: true,
    }),
  });
  const response = await acceptCreatorAgreement(request, env, VERIFICATION_ID);
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.accepted, true);
  assert.equal(result.agreement.termsVersion, '1.2');
  assert.equal(result.agreement.contractingName, 'テスト株式会社');
  assert.equal(result.agreement.contactEmailMasked, 'cr•••••@example.com');
  assert.equal(db.agreements.length, 1);
  assert.equal(db.agreements[0].stripe_account_id, 'acct_creator123');
  assert.equal(db.agreements[0].accepted_ip, '203.0.113.10');
  assert.equal(db.agreements[0].user_agent, 'Agreement Test Browser/1.0');
  assert.equal(db.agreements[0].contact_email, 'creator@example.com');

  const status = await getCreatorAgreement(new Request('https://example.com', {
    headers: { 'x-live-verification-token': ACCESS_TOKEN },
  }), env, VERIFICATION_ID);
  assert.equal((await status.json()).accepted, true);
});

test('古い規約画面、所有未確認、Connect未登録では同意を保存しない', async () => {
  const cases = [
    { status: 'pending', stripeAccountId: 'acct_creator123', expected: 'channel-ownership-required' },
    { status: 'verified', stripeAccountId: '', expected: 'stripe-account-registration-required' },
  ];
  for (const item of cases) {
    const db = new AgreementDb(await sha256(ACCESS_TOKEN), item.status, item.stripeAccountId);
    await assert.rejects(
      acceptCreatorAgreement(agreementRequest({}), { REMOTE_DB: db }, VERIFICATION_ID),
      (error) => error.message === item.expected,
    );
  }
  const db = new AgreementDb(await sha256(ACCESS_TOKEN));
  await assert.rejects(
    acceptCreatorAgreement(agreementRequest({ termsVersion: '0.9' }), { REMOTE_DB: db }, VERIFICATION_ID),
    (error) => error.message === 'creator-terms-stale' && error.status === 409,
  );
});

function agreementRequest(overrides) {
  return new Request('https://example.com', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-live-verification-token': ACCESS_TOKEN },
    body: JSON.stringify({
      termsVersion: CREATOR_TERMS.version,
      termsDocumentSha256: CREATOR_TERMS.documentSha256,
      contractingName: '契約者名',
      contactEmail: 'creator@example.com',
      confirmTerms: true,
      confirmAuthority: true,
      confirmPrivacy: true,
      ...overrides,
    }),
  });
}

class AgreementDb {
  constructor(accessTokenHash, ownershipStatus = 'verified', stripeAccountId = 'acct_creator123') {
    this.verification = {
      verification_id: VERIFICATION_ID,
      channel_id: 'UC1234567890_sample',
      channel_name: '契約テストチャンネル',
      channel_url: 'https://www.youtube.com/channel/UC1234567890_sample',
      access_token_hash: accessTokenHash,
      confirmation_code: 'SBLV-TEST-CODE',
      ownership_status: ownershipStatus,
      ownership_method: 'oauth',
      stripe_account_id: stripeAccountId,
      stripe_identity_verified: 0,
      stripe_relationship_status: 'pending',
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    this.agreements = [];
  }

  prepare(sql) {
    const db = this;
    const normalized = String(sql).replace(/\s+/g, ' ').trim();
    return {
      bindings: [],
      bind(...bindings) { this.bindings = bindings; return this; },
      async first() {
        if (/FROM live_channel_verifications v/i.test(normalized)) return { ...db.verification };
        if (/FROM live_creator_agreements/i.test(normalized)) {
          return db.agreements.find((item) => item.verification_id === this.bindings[0]
            && item.channel_id === this.bindings[1] && item.stripe_account_id === this.bindings[2]
            && item.terms_version === this.bindings[3] && item.terms_document_sha256 === this.bindings[4]) || null;
        }
        return null;
      },
      async run() {
        if (/INSERT OR IGNORE INTO live_creator_agreements/i.test(normalized)) {
          const [agreement_id, verification_id, channel_id, stripe_account_id, terms_version,
            terms_document_sha256, contracting_name, contact_email, accepted_at, accepted_ip, user_agent, created_at] = this.bindings;
          db.agreements.push({ agreement_id, verification_id, channel_id, stripe_account_id, terms_version,
            terms_document_sha256, contracting_name, contact_email, accepted_at, accepted_ip, user_agent, created_at });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
    };
  }
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
