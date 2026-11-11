import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import worker from '../../_worker.js';
import { GUIDE_DETAILS_MARKER, injectGuideDetails, removeGuideDetails } from '../../src/challenge/guide-details.js';

const env = { ASSETS: { async fetch(request) {
  const path = new URL(request.url).pathname;
  try { return new Response(await readFile(new URL('../..' + path, import.meta.url)), { headers: { 'content-type': 'text/html' } }); }
  catch { return new Response('Not Found', { status: 404 }); }
} } };

test('Japanese guide adds the detailed sections after the React root and keeps one footer visible', async () => {
  const response = await worker.fetch(new Request('https://www.streetboardgame.com/challenge-guide'), env);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.equal(html.split('<div ' + GUIDE_DETAILS_MARKER + ' ').length, 2);
  assert.ok(html.indexOf('<!-- /home-prerender -->') < html.indexOf(GUIDE_DETAILS_MARKER), 'outside #root so React rendering keeps it');
  for (const heading of ['出題する人：クイズの作り方', '参加URLの送り方', '回答する人：答えの予想と結果', '答え合わせのあと：主催者用の画面', '安心して遊ぶために']) assert.ok(html.includes(heading), heading);
  assert.match(html, /\[data-testid="challenge-guide-page"\]>footer\{display:none!important\}/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.equal(injectGuideDetails(html), html);
  assert.ok(!removeGuideDetails(html).includes(GUIDE_DETAILS_MARKER));
});

test('translated guides do not receive the Japanese-only details', async () => {
  for (const path of ['/en/challenge-guide', '/fr/challenge-guide', '/ar/challenge-guide']) {
    const response = await worker.fetch(new Request('https://www.streetboardgame.com' + path), env);
    assert.equal(response.status, 200, path);
    assert.doesNotMatch(await response.text(), new RegExp(GUIDE_DETAILS_MARKER), path);
  }
});
