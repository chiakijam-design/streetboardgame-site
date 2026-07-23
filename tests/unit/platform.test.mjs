import test from 'node:test';
import assert from 'node:assert/strict';

import { createStorageAdapter, readExpiringMap } from '../../src/platform/storage.js';
import { openLineShare, openXShare } from '../../src/platform/share.js';
import { fetchImageBlob, sharePreparedImage } from '../../src/platform/imageSave.js';
import { createRemoteClient } from '../../src/api/remoteClient.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('storage窓口はJSONと期限切れデータを安全に扱う', () => {
  const adapter = createStorageAdapter(memoryStorage());
  adapter.setJson('rooms', {
    old: { expiresAt: 10 },
    active: { expiresAt: 30 },
  });
  assert.deepEqual(readExpiringMap(adapter, 'rooms', 20), { active: { expiresAt: 30 } });
});

test('LINE共有は端末に応じたURLを返す', () => {
  const mobileWindow = { location: { href: '' }, matchMedia: () => ({ matches: true }) };
  const href = openLineShare('結果です', {
    windowRef: mobileWindow,
    navigatorRef: { userAgent: 'iPhone' },
  });
  assert.match(href, /^line:\/\/msg\/text\//);
  assert.equal(mobileWindow.location.href, href);
});

test('X共有はPCで投稿画面を別タブに開く', () => {
  let opened = '';
  const href = openXShare('結果です', {
    windowRef: { open: (url) => { opened = url; } },
    navigatorRef: { userAgent: 'Desktop' },
    documentRef: {},
  });
  assert.equal(opened, href);
  assert.match(href, /^https:\/\/x\.com\/intent\/post/);
});

test('画像ファイル共有不可のスマホでは本文共有後に画像を保存する', async () => {
  let shared = false;
  let clicked = false;
  const blob = new Blob(['image'], { type: 'image/png' });
  const result = await sharePreparedImage({
    src: '/result.png',
    filename: 'result.png',
    title: '結果',
    text: '結果です',
    url: 'https://example.com',
  }, {
    fetchRef: async () => ({ ok: true, blob: async () => blob }),
    navigatorRef: {
      userAgent: 'iPhone',
      share: async () => { shared = true; },
      canShare: () => false,
    },
    windowRef: { matchMedia: () => ({ matches: true }) },
    FileRef: class MockFile {},
    documentRef: {
      body: { appendChild() {}, removeChild() {} },
      createElement: () => ({ click: () => { clicked = true; } }),
    },
    urlRef: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
  });
  assert.equal(result, 'shared-download');
  assert.equal(shared, true);
  assert.equal(clicked, true);
});

test('data URLの結果画像はCSP対象のfetchを使わずBlobへ変換する', async () => {
  let fetched = false;
  const blob = await fetchImageBlob('data:image/png;base64,aW1hZ2U=', async () => {
    fetched = true;
    throw new Error('CSPで遮断されるため呼ばない');
  });
  assert.equal(fetched, false);
  assert.equal(blob.type, 'image/png');
  assert.equal(await blob.text(), 'image');
});

test('スマホの共有APIが失敗しても結果画像の保存へフォールバックする', async () => {
  let clicked = false;
  const result = await sharePreparedImage({
    src: 'data:image/png;base64,aW1hZ2U=',
    filename: 'result.png',
    title: '結果',
    text: '結果です',
    url: 'https://example.com',
  }, {
    navigatorRef: {
      userAgent: 'iPhone',
      share: async () => { throw new TypeError('share-failed'); },
      canShare: () => false,
    },
    windowRef: { matchMedia: () => ({ matches: true }) },
    FileRef: class MockFile {},
    documentRef: {
      body: { appendChild() {}, removeChild() {} },
      createElement: () => ({ click: () => { clicked = true; } }),
    },
    urlRef: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
  });
  assert.equal(result, 'downloaded');
  assert.equal(clicked, true);
});

test('遠隔API窓口はエンドポイントとJSON処理を集約する', async () => {
  const calls = [];
  const client = createRemoteClient({
    baseUrl: '/api/remote',
    fetchRef: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ room: '123456' }) };
    },
  });
  const result = await client.createRoom({ name: 'A' });
  assert.equal(result.room, '123456');
  assert.equal(calls[0].url, '/api/remote/rooms');
  assert.equal(calls[0].options.method, 'POST');
});
