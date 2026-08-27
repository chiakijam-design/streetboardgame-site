import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LIVE_RESULT_IMAGE_PRICES, LIVE_RESULT_IMAGE_SERVICE, LIVE_SUPPORT_AMOUNTS, LIVE_SUPPORT_TIERS } from '../../src/live/config.js';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const yenList = (prices) => prices.map((price) => `${price.toLocaleString('ja-JP')}円`).join('、');

test('商品・料金ページの公開価格が実際のLIVE設定と一致する', async () => {
  const html = await read('../../pricing.html');
  assert.equal(html.match(/data-price-list="result-image">([^<]+)/)?.[1], `${yenList(LIVE_RESULT_IMAGE_PRICES)}（税込）`);
  assert.equal(html.match(/data-price-list="support">([^<]+)/)?.[1], `${yenList(LIVE_SUPPORT_AMOUNTS)}（税込）`);
  assert.ok(html.includes(LIVE_RESULT_IMAGE_SERVICE.resolution));
  assert.ok(html.includes(`購入日から${LIVE_RESULT_IMAGE_SERVICE.downloadDays}日間`));
  for (const tier of LIVE_SUPPORT_TIERS) {
    assert.ok(html.includes(`${tier.amount.toLocaleString('ja-JP')}円（税込）</th><td>${tier.colorName}</td>`));
  }
});

test('商品・料金ページは無料範囲・任意購入・販売者と提供条件を初期HTMLに明記する', async () => {
  const html = await read('../../pricing.html');
  for (const text of [
    'STREET BOARD GAME（Streetboardgame）',
    '私のこと、ちゃんと分かってるよね？',
    '無料（0円）',
    '月額料金・自動更新はありません',
    '有料サービスを購入しなくても',
    'SAMPLE表示なし',
    '寄付・贈与ではありません',
    '結果画像の購入も含みません',
    '当サイトのStripe決済では販売していません',
    '販売・役務提供事業者',
    '平川智章',
    'href="/legal"',
    'href="/refund-policy"',
    'href="/terms"',
    'href="/?screen=about&amp;to=contact"',
  ]) assert.ok(html.includes(text), text);
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1);
  assert.ok(html.includes('<link rel="canonical" href="https://www.streetboardgame.com/pricing"'));
  const stripe = await read('../../src/live/stripe.js');
  assert.ok(stripe.includes("mode: 'payment'"), '都度購入の決済モードを維持する');
});

test('商品・料金ページのルート・ビルド・トップ導線を維持する', async () => {
  const worker = await read('../../_worker.js');
  const config = await read('../../wrangler.jsonc');
  const build = await read('../../tools/build-js.mjs');
  assert.ok(worker.includes("'/pricing': '/pricing.html'"));
  assert.ok(config.includes('"/pricing", "/pricing/"'));
  assert.ok(build.includes("'pricing.html':"));
  assert.ok((await read('../../prototype_app.jsx')).includes('data-testid="top-pricing-link" href="/pricing"'));
  assert.ok((await read('../../index.html')).includes('href="/pricing"'));
  assert.ok((await read('../../sitemap.xml')).includes('<loc>https://www.streetboardgame.com/pricing</loc>'));
});
