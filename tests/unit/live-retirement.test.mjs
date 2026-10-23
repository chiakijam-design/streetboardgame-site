import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import worker from '../../_worker.js';
import { PUBLIC_LOCALES } from '../../src/generated/public-locales.js';
import { isLiveHistoryRequest } from '../../src/live/retirement.js';
import { publicQuestionExamples } from '../../src/challenge/examples.js';
import { purchaseDownloadHref } from '../../src/live/purchase-recovery-ui.js';

test('every locale retires LIVE aliases and invitation queries before any storage access', async () => {
  const env = new Proxy({}, { get() { throw new Error('retired request must not access bindings'); } });
  for (const locale of PUBLIC_LOCALES) {
    const prefix = locale === 'ja' ? '' : '/' + locale;
    for (const path of ['/live-challenge?pack=live-party', '/live-challenge/?room=123456', '/live_challenge.html', '/?screen=live']) {
      const response = await worker.fetch(new Request('https://www.streetboardgame.com' + prefix + path), env);
      assert.equal(response.status, 410, prefix + path);
      assert.match(response.headers.get('x-robots-tag'), /noindex/);
      const html = await response.text();
      assert.doesNotMatch(html, /adsbygoogle|googlesyndication|live_challenge-/);
    }
  }
});

test('LIVE creation, play, new payments and registration stop before storage or Stripe', async () => {
  const env = new Proxy({}, { get() { throw new Error('new LIVE operation must not access bindings'); } });
  for (const path of ['/games', '/stream-games', '/games/123456/join', '/games/123456/socket', '/games/123456/checkout', '/channel-verifications', '/youtube-candidates', '/admin/creator-invites']) {
    const response = await worker.fetch(new Request('https://www.streetboardgame.com/api/live' + path, { method: 'POST' }), env);
    assert.equal(response.status, 410, path);
    assert.deepEqual(await response.json(), { error: 'live-retired' });
  }
});

test('existing signed purchase downloads, recovery, webhook and authenticated history remain routable', () => {
  for (const [path, method] of [['/checkouts/cs_live_previous', 'GET'], ['/downloads/signed-token', 'GET'], ['/purchases/recover', 'POST'], ['/stripe/webhook', 'POST'], ['/admin/overview', 'GET'], ['/admin/result-entitlements', 'POST'], ['/admin/purchases/old/refund', 'POST'], ['/games/123456/cancel', 'POST']]) {
    assert.equal(isLiveHistoryRequest('/api/live' + path, method), true, path);
  }
  assert.equal(isLiveHistoryRequest('/api/live/downloads/token', 'POST'), false);
  assert.equal(isLiveHistoryRequest('/api/live/games/123456/checkout', 'POST'), false);
});

test('public examples reuse two real five-choice cards without mutating the catalog', async () => {
  for (const english of [false, true]) {
    const context = { window: {} };
    vm.runInNewContext(await readFile(english ? 'prototype_english_common_data.js' : 'prototype_common_data.js', 'utf8'), context);
    const cards = context.window[english ? 'ENGLISH_COMMON_QUESTION_CARDS' : 'COMMON_QUESTION_CARDS'];
    const before = JSON.stringify(cards);
    const examples = publicQuestionExamples(cards, english);
    assert.equal(examples.length, 2);
    for (const card of examples) { assert.ok(cards.includes(card)); assert.equal(card.choices.length, 5); }
    assert.equal(JSON.stringify(cards), before);
  }
});

test('historical legal documents are marked as past terms while the signed source remains intact', async () => {
  const original = await readFile('legal-history/terms.html', 'utf8');
  const env = { ASSETS: { fetch: async () => new Response(original, { headers: { 'content-type': 'text/html' } }) } };
  const response = await worker.fetch(new Request('https://www.streetboardgame.com/legal-history/terms.html'), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('x-robots-tag'), /noindex/);
  assert.match(await response.text(), /LIVE版は終了しました/);
  assert.equal(await readFile('legal-history/terms.html', 'utf8'), original);
});

test('purchase recovery only accepts signed-download routes on the same site', () => {
  const origin = 'https://www.streetboardgame.com';
  assert.equal(purchaseDownloadHref('/api/live/downloads/old_purchase?expires=1&signature=test', origin), origin + '/api/live/downloads/old_purchase?expires=1&signature=test');
  for (const value of ['https://other.example/api/live/downloads/old_purchase', 'javascript:alert(1)', '/api/live/games', 'https://user@www.streetboardgame.com/api/live/downloads/old_purchase']) {
    assert.equal(purchaseDownloadHref(value, origin), '');
  }
});
