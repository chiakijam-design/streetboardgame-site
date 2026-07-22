import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPaidResultAsset,
  createFreeResultPreview,
  createSignedDownloadUrl,
  storePrivateCreatorImage,
  streamPrivateResult,
  verifySignedDownload,
} from '../../src/live/media.js';

function pngBytes() {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
}

function mediaEnv({ width = 1200, height = 1200 } = {}) {
  const objects = new Map();
  const deleted = [];
  return {
    objects,
    deleted,
    env: {
      IMAGES: {
        async info() { return { width, height, format: 'image/png' }; },
        input() {
          return {
            transform() { return this; },
            async output() {
              return { response: () => new Response(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])) };
            },
          };
        },
      },
      LIVE_MEDIA: {
        async put(key, value, options) { objects.set(key, { value: new Uint8Array(value), options }); },
        async get(key) { return objects.get(key)?.object || null; },
        async delete(keys) {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            deleted.push(key);
            objects.delete(key);
          }
        },
      },
      ASSETS: { fetch: async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/webp' } }) },
    },
  };
}

test('YouTuber元画像と変換画像を非公開R2メタデータ・SHA-256付きで保存する', async () => {
  const state = mediaEnv();
  const previous = {
    originalKey: `live/123456/creator/${'a'.repeat(32)}/original`,
    previewKey: `live/123456/creator/${'a'.repeat(32)}/preview.webp`,
    paidKey: `live/123456/creator/${'a'.repeat(32)}/paid.webp`,
  };
  const stored = await storePrivateCreatorImage(new Blob([pngBytes()], { type: 'image/png' }), state.env, '123456', previous);

  assert.match(stored.originalKey, /^live\/123456\/creator\/[a-f0-9]{32}\/original$/);
  assert.equal('url' in stored, false);
  assert.equal(state.objects.size, 3);
  for (const [key, object] of state.objects) {
    assert.equal(object.options.httpMetadata.cacheControl, 'private, no-store');
    assert.equal(object.options.customMetadata.schema, 'live-private-media-v1');
    assert.match(object.options.customMetadata.sha256, /^[a-f0-9]{64}$/);
    assert.ok(object.options.sha256 instanceof ArrayBuffer);
    if (key.endsWith('.webp')) assert.equal(object.options.httpMetadata.contentType, 'image/webp');
  }
  assert.deepEqual(state.deleted.sort(), Object.values(previous).sort());
});

test('拡張子や申告MIMEではなく実バイトを検証して偽装画像を拒否する', async () => {
  const state = mediaEnv();
  await assert.rejects(
    storePrivateCreatorImage(new Blob([new TextEncoder().encode('<script>alert(1)</script>')], { type: 'image/png' }), state.env, '123456'),
    (error) => error.message === 'invalid-creator-image' && error.status === 400,
  );
  assert.equal(state.objects.size, 0);
});

test('Cloudflare Images上限を超える画素寸法をR2保存前に拒否する', async () => {
  const state = mediaEnv({ width: 12_001, height: 100 });
  await assert.rejects(
    storePrivateCreatorImage(new Blob([pngBytes()], { type: 'image/png' }), state.env, '123456'),
    (error) => error.message === 'creator-image-dimensions-too-large' && error.status === 413,
  );
  assert.equal(state.objects.size, 0);
});

test('有料結果画像も公開URLを作らず非公開R2へ保存し、任意キーの読出しを拒否する', async () => {
  const state = mediaEnv();
  const assetKey = await createPaidResultAsset(
    new Request('https://example.com/api/live/checkout'),
    state.env,
    { channelName: '公式チャンネル', scheduledAt: Date.UTC(2026, 6, 22), creatorImage: null },
    { participantName: '視聴者', questionCount: 1, results: [{ type: 'guess-person', myIsCorrect: true }] },
    'purchase_12345678',
    '視聴者',
  );
  const stored = state.objects.get(assetKey);
  assert.equal(assetKey, 'live/results/purchase_12345678.svg');
  assert.equal(stored.options.httpMetadata.cacheControl, 'private, no-store');
  assert.equal(stored.options.customMetadata.assetType, 'paid-result');
  const svg = new TextDecoder().decode(stored.value);
  assert.match(svg, /width="2160" height="2700"/);
  assert.equal(svg.includes('>SAMPLE<'), false);
  await assert.rejects(
    streamPrivateResult(state.env, '../creator/original', 'result.svg'),
    (error) => error.message === 'invalid-private-media-key' && error.status === 500,
  );
});

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
