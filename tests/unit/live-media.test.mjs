import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createFreeResultPreview,
  createSignedDownloadUrl,
  verifySignedDownload,
} from '../../src/live/media.js';

test('無料結果画像はサーバー側で540×675・SAMPLE入りSVGを生成する', async () => {
  const fakeImage = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
  const env = {
    ASSETS: { fetch: async () => new Response(fakeImage, { headers: { 'content-type': 'image/webp' } }) },
  };
  const response = await createFreeResultPreview(
    new Request('https://example.com/api/live/games/123456/result-preview?name=視聴者A'),
    env,
    { channelName: '公式チャンネル', subjectName: '本人', scheduledAt: Date.UTC(2026, 6, 22), creatorImage: null },
    {
      participantName: '参加者', questionCount: 1,
      results: [{ type: 'guess-person', myIsCorrect: true }],
    },
  );
  const svg = await response.text();
  assert.match(response.headers.get('content-type'), /^image\/svg\+xml/);
  assert.match(response.headers.get('cache-control'), /private/);
  assert.match(svg, /width="540" height="675"/);
  assert.match(svg, />SAMPLE</);
  assert.match(svg, /視聴者A/);
  assert.match(svg, /公式チャンネル/);
  assert.equal(svg.includes('creatorImageDataUrl'), false);
});

test('購入画像の署名URLは期限と改ざんを検証する', async () => {
  const env = { LIVE_DOWNLOAD_SIGNING_SECRET: 'a'.repeat(32) };
  const expiresAt = Date.now() + 60_000;
  const url = new URL(await createSignedDownloadUrl(
    new Request('https://example.com/api/live/result-entitlements/purchase01'),
    env,
    'purchase01',
    expiresAt,
  ));
  assert.equal(await verifySignedDownload(
    env,
    'purchase01',
    url.searchParams.get('expires'),
    url.searchParams.get('signature'),
  ), true);
  assert.equal(await verifySignedDownload(
    env,
    'purchase02',
    url.searchParams.get('expires'),
    url.searchParams.get('signature'),
  ), false);
});
