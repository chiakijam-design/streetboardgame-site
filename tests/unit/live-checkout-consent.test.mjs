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
  assert.equal(CHECKOUT_TERMS.version, '1.7');
  assert.equal(createHash('sha256').update(document).digest('hex'), CHECKOUT_TERMS.documentSha256);
});

test('利用規約は現在の対象年齢・ランキング・投稿審査・販売条件を明記する', async () => {
  const document = await readFileAsync(new URL('../../terms.html', import.meta.url), 'utf8');
  for (const requiredText of [
    '18歳未満の利用者',
    '10歳から12歳までの利用者',
    'ランキング参加は任意',
    '掲載候補として送信しない問題',
    '個人情報らしい文字列の自動検知',
    '通報を受けた場合は確認が終わるまで直ちに非公開',
    '480円、980円、2,980円',
    '180円、480円、980円、2,980円',
  ]) assert.equal(document.includes(requiredText), true, requiredText);
});

test('特商法表記は個人の住所・電話番号を公開せず、請求時の開示方法を案内する', async () => {
  const document = await readFileAsync(new URL('../../legal.html', import.meta.url), 'utf8');
  const incidentDocument = await readFileAsync(new URL('../../docs/PRIVACY_INCIDENT_RESPONSE.md', import.meta.url), 'utf8');
  assert.equal(/〒\d{3}-\d{4}/.test(document), false);
  assert.equal(document.includes('所在地の開示'), true);
  assert.equal(document.includes('所在地は、消費者から請求があった場合'), true);
  assert.equal(/0\d{1,4}-\d{1,4}-\d{3,4}/.test(document), false);
  assert.equal(document.includes('href="tel:'), false);
  assert.equal(/0\d{1,4}-\d{1,4}-\d{3,4}/.test(incidentDocument), false);
  assert.equal(document.includes('申込みの意思決定に先立って遅滞なく電子メール等で提供します'), true);
  assert.equal(document.includes('<a href="/contact">お問い合わせフォーム</a>'), true);
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
