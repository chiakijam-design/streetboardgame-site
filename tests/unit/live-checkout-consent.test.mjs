import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile as readFileAsync } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

import { assertCheckoutConsent } from '../../src/live/checkout-consent.js';
import { CHECKOUT_TERMS } from '../../src/live/checkout-terms-config.js';

test('視聴者決済の規約バージョンとSHA-256を実際の利用規約全文へ固定する', async () => {
  const document = (await readFileAsync(new URL('../../terms.html', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  assert.equal(CHECKOUT_TERMS.version, '1.3');
  assert.equal(createHash('sha256').update(document).digest('hex'), CHECKOUT_TERMS.documentSha256);
});

test('チェック済みの現行利用規約だけを決済同意として受け付ける', () => {
  assert.deepEqual(assertCheckoutConsent({
    termsAccepted: true,
    termsVersion: CHECKOUT_TERMS.version,
    termsDocumentSha256: CHECKOUT_TERMS.documentSha256,
  }), {
    termsVersion: CHECKOUT_TERMS.version,
    termsDocumentSha256: CHECKOUT_TERMS.documentSha256,
  });
  for (const body of [
    {},
    { termsAccepted: false, termsVersion: CHECKOUT_TERMS.version, termsDocumentSha256: CHECKOUT_TERMS.documentSha256 },
    { termsAccepted: true, termsVersion: '1.0', termsDocumentSha256: CHECKOUT_TERMS.documentSha256 },
    { termsAccepted: true, termsVersion: CHECKOUT_TERMS.version, termsDocumentSha256: 'a'.repeat(64) },
  ]) assert.throws(() => assertCheckoutConsent(body), /checkout-terms-acceptance-required/);
});

test('購入D1マイグレーションは注文別の同意規約・全文ハッシュ・同意日時を保存する', () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../../migrations-purchases/0002_live_checkout_orders.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../../migrations-purchases/0005_live_checkout_consent.sql', import.meta.url), 'utf8'));
  const columns = sqlite.prepare('PRAGMA table_info(live_checkout_consents)').all().map((column) => column.name);
  assert.equal(columns.includes('order_id'), true);
  assert.equal(columns.includes('terms_version'), true);
  assert.equal(columns.includes('terms_document_sha256'), true);
  assert.equal(columns.includes('terms_accepted_at'), true);
});
