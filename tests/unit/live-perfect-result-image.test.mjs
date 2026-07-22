import assert from 'node:assert/strict';
import test from 'node:test';

import { createFreeResultPreview, createPaidResultAsset } from '../../src/live/media.js';

const GAME = {
  channelName: 'わたちゃんず',
  subjectName: '本人',
  scheduledAt: Date.UTC(2026, 6, 22),
  creatorImage: null,
};

function result(correct) {
  return { type: 'guess-person', myIsCorrect: correct };
}

function assetEnv() {
  return {
    ASSETS: {
      fetch: async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/webp' } }),
    },
  };
}

test('全問正解の無料保存画像だけ金色テーマとチャンネル王の称号を表示する', async () => {
  const perfectResponse = await createFreeResultPreview(
    new Request('https://example.com/api/live/games/123456/result-preview?name=回答者'),
    assetEnv(),
    GAME,
    { participantName: '回答者', questionCount: 3, results: [result(true), result(true), result(true)] },
  );
  const perfectSvg = await perfectResponse.text();
  assert.match(perfectSvg, /data-perfect="true"/);
  assert.match(perfectSvg, /PERFECT RESULT/);
  assert.match(perfectSvg, /【わたちゃんず】王/);
  assert.match(perfectSvg, /全問正解記念/);
  assert.match(perfectSvg, />3\/3</);

  const normalResponse = await createFreeResultPreview(
    new Request('https://example.com/api/live/games/123456/result-preview?name=回答者'),
    assetEnv(),
    GAME,
    { participantName: '回答者', questionCount: 3, results: [result(true), result(false), result(true)] },
  );
  const normalSvg = await normalResponse.text();
  assert.match(normalSvg, /data-perfect="false"/);
  assert.equal(normalSvg.includes('PERFECT RESULT'), false);
  assert.equal(normalSvg.includes('【わたちゃんず】王'), false);
  assert.match(normalSvg, />2\/3</);
});

test('購入済み高画質画像にも全問正解の特別称号を保持する', async () => {
  const stored = new Map();
  const env = {
    ...assetEnv(),
    IMAGES: {},
    LIVE_MEDIA: {
      async put(key, value) { stored.set(key, new Uint8Array(value)); },
    },
  };
  const key = await createPaidResultAsset(
    new Request('https://example.com/api/live/checkout'),
    env,
    GAME,
    { participantName: '回答者', questionCount: 5, results: Array.from({ length: 5 }, () => result(true)) },
    'purchase_perfect01',
    '回答者',
  );
  const svg = new TextDecoder().decode(stored.get(key));
  assert.match(svg, /width="2160" height="2700"/);
  assert.match(svg, /data-perfect="true"/);
  assert.match(svg, /【わたちゃんず】王/);
  assert.equal(svg.includes('>SAMPLE<'), false);
});
