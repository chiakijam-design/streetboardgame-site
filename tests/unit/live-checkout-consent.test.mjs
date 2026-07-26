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
  assert.equal(CHECKOUT_TERMS.version, '1.11');
  assert.equal(createHash('sha256').update(document).digest('hex'), CHECKOUT_TERMS.documentSha256);
});

test('利用規約は現在の対象年齢・理解度ボード・投稿審査・販売条件を明記する', async () => {
  const document = await readFileAsync(new URL('../../terms.html', import.meta.url), 'utf8');
  for (const requiredText of [
    '18歳未満の利用者',
    '10歳から12歳までの利用者',
    '理解度ボード掲載は任意',
    '10問の回答完了順で表示',
    '再挑戦すると現在の回答と結果は上書き',
    '答え合わせレポートは、10問の一致・不一致と回答内容に基づき',
    '配信者が各問の回答を締め切ったあとに配信者の答えを公開',
    '掲載候補として送信しない問題',
    '本サービスの提供と無関係な生成AIの学習へ無期限に利用',
    '個人情報らしい文字列の自動検知',
    '通報を受けた場合は確認が終わるまで直ちに非公開',
    '無料の結果カード保存機能',
    '変換前の元画像を用いる',
    '480円、980円、2,980円',
    '180円、480円、980円、2,980円',
  ]) assert.equal(document.includes(requiredText), true, requiredText);
});

test('特商法表記は個人の住所・電話番号を公開せず、請求時の開示方法を案内する', async () => {
  const document = await readFileAsync(new URL('../../legal.html', import.meta.url), 'utf8');
  const incidentDocument = await readFileAsync(new URL('../../docs/PRIVACY_INCIDENT_RESPONSE.md', import.meta.url), 'utf8');
  assert.equal(/〒\d{3}-\d{4}/.test(document), false);
  assert.equal(document.includes('販売・役務提供事業者'), true);
  assert.equal(document.includes('特定商取引法第11条ただし書に基づき'), true);
  assert.equal(document.includes('所在地の開示'), true);
  assert.equal(/0\d{1,4}-\d{1,4}-\d{3,4}/.test(document), false);
  assert.equal(document.includes('href="tel:'), false);
  assert.equal(/0\d{1,4}-\d{1,4}-\d{3,4}/.test(incidentDocument), false);
  assert.equal(document.includes('申込みの意思決定に先立って十分な時間的余裕を確保できるよう、遅滞なく電子メール等で提供します'), true);
  assert.equal(document.includes('topic=commerce-disclosure'), true);
});

test('特商法表記は現行LIVE版の料金・提供・キャンセル条件を表示する', async () => {
  const document = await readFileAsync(new URL('../../legal.html', import.meta.url), 'utf8');
  for (const requiredText of [
    '2026年7月26日',
    '480円、980円、2,980円',
    '180円、480円、980円、2,980円',
    '応援機能は寄付・贈与ではなく',
    'Stripeを利用したクレジットカード決済',
    '2,160×2,700px',
    '購入日から30日間',
    '変換前の元画像を用いて生成',
    '通信販売にはクーリング・オフ制度は適用されません',
    '未成年者は、購入前に法定代理人（保護者等）の同意を得てください',
  ]) assert.equal(document.includes(requiredText), true, requiredText);
});

test('返金ポリシーは現行LIVE版の提供完了・代替提供・返金申請条件を表示する', async () => {
  const document = await readFileAsync(new URL('../../refund-policy.html', import.meta.url), 'utf8');
  for (const requiredText of [
    '2026年7月26日',
    'バージョン：1.3',
    '通信販売にクーリング・オフ制度は適用されず',
    '決済完了時に応援受付が完了',
    '応援受付の不具合',
    '変換前の元画像を用いて高画質結果画像を生成',
    '購入時の注文番号とメールアドレスによる購入権限の回復',
    'topic=refund-request',
    '配信者への分配は保留・取消し・相殺',
    '未成年者による取消し',
  ]) assert.equal(document.includes(requiredText), true, requiredText);
  assert.equal(document.includes('関連するYouTuberへの分配'), false);
});

test('コンテンツ・肖像権ガイドラインは現行2モード・投稿審査・画像利用条件を表示する', async () => {
  const document = await readFileAsync(new URL('../../content-guidelines.html', import.meta.url), 'utf8');
  for (const requiredText of [
    '最終改定日：2026年7月26日',
    'バージョン：1.2',
    '「みんなに挑戦してもらう」通常版',
    '「ライブ配信でみんなに挑戦してもらう」LIVE版',
    '問題文、5個の選択肢',
    'OFFにした場合も自分のクイズは作れます',
    '通常版とLIVE版に共通するお題ライブラリ',
    '本サービスの提供と無関係な生成AIの学習へ無期限に利用',
    '本名、学校名、SNS ID、電話番号、住所らしい文字列を自動検知',
    '性的内容、いじめ、容姿攻撃または差別表現',
    '通報されたお題は確認が終わるまで直ちに非公開',
    '登録画像・プレビューは対象LIVE終了後24時間以内',
    '有料結果画像は購入後30日',
    '画像そのものの再販売',
  ]) assert.equal(document.includes(requiredText), true, requiredText);
  assert.equal(document.includes('YouTuber・クリエイターは'), false);
  assert.equal(document.includes('YouTubeチャンネル情報から自動生成された問題候補'), false);
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
