import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Instagramフィード画像は横切れしない4:5の1080×1350で用意する', async () => {
  const image = await readFile(new URL('../../assets/social/watachan-instagram-feed.png', import.meta.url));

  assert.equal(image.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(image.readUInt32BE(16), 1080);
  assert.equal(image.readUInt32BE(20), 1350);
});
