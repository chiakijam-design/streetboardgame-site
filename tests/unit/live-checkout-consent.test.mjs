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
  assert.equal(CHECKOUT_TERMS.version, '1.15');
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
    '180円、480円、980円、1,980円、2,980円',
    '金額に応じた色でLIVEチャットへ表示',
    '配信者からの返答・読み上げ・お礼',
    '決済完了後でもメッセージを事前通知なく非表示',
    '売上の70%は、別途審査・登録・契約を完了した配信者へ',
    '寄付、贈与、募金、クラウドファンディングまたは投資ではなく',
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
    '2026年7月28日',
    '480円、980円、2,980円',
    '180円、480円、980円、1,980円、2,980円',
    '有料応援メッセージ機能は寄付・贈与ではなく',
    '配信者は購入者に対する販売者または役務提供事業者ではありません',
    '選択金額に応じた色でLIVEチャットへ表示',
    '配信者からの返答・読み上げ・お礼',
    '決済が確定した売上の70%は、審査・登録・契約を完了した配信者へ',
    '決済された有料応援メッセージの受付記録が作成されず復旧できない場合',
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
    '2026年7月28日',
    'バージョン：1.4',
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

test('未成年者利用規定は現行の年齢区分・通常版・LIVE版・購入・販売登録条件を表示する', async () => {
  const document = await readFileAsync(new URL('../../minor-policy.html', import.meta.url), 'utf8');
  for (const requiredText of [
    '最終改定日：2026年7月26日',
    'バージョン：1.2',
    '13歳から18歳までの中高生を主な対象',
    '19歳から20歳までの大学生・専門学生を副次的な対象',
    '10歳から12歳までの小学生を制限付きの対象',
    '理解度ボードへの掲載は任意',
    'コメントなしでも掲載できます',
    '通常版とLIVE版に共通するお題ライブラリ',
    '採用後も、問題は通報を受けた時点で一旦非公開',
    '無料LIVEの作成・参加には配信者登録は不要',
    'YouTubeでライブ配信を開始できるのは原則16歳以上',
    '応援機能は寄付・贈与ではなく',
    '法令上認められる未成年者による契約の取消し',
    'Stripe Connectによる本人確認',
    '法定後見人がStripeアカウントの所有者',
    '未成年者が識別できる画像',
  ]) assert.equal(document.includes(requiredText), true, requiredText);
  assert.equal(document.includes('YouTuber・クリエイター登録'), false);
  assert.equal(document.includes('YouTuber登録する際'), false);
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
  sqlite.exec(readFileSync(new URL('../../migrations-purchases/0006_live_support_message.sql', import.meta.url), 'utf8'));
  const columns = sqlite.prepare('PRAGMA table_info(live_checkout_consents)').all().map((column) => column.name);
  const orderColumns = sqlite.prepare('PRAGMA table_info(live_checkout_orders)').all().map((column) => column.name);
  assert.equal(columns.includes('order_id'), true);
  assert.equal(columns.includes('terms_version'), true);
  assert.equal(columns.includes('terms_document_sha256'), true);
  assert.equal(columns.includes('terms_accepted_at'), true);
  assert.equal(orderColumns.includes('support_message'), true);
});
