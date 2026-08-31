import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const SECURITY_TXT_URL = 'https://www.streetboardgame.com/.well-known/security.txt';

test('security.txtはRFC 9116の必須項目と公開連絡先を持つ', async () => {
  const securityTxt = await readFile(new URL('../../.well-known/security.txt', import.meta.url), 'utf8');
  const headers = await readFile(new URL('../../_headers', import.meta.url), 'utf8');

  assert.match(securityTxt, /^Contact: https:\/\/www\.streetboardgame\.com\/contact$/m);
  assert.match(securityTxt, /^Preferred-Languages: ja, en$/m);
  assert.match(securityTxt, new RegExp(`^Canonical: ${SECURITY_TXT_URL.replaceAll('.', '\\.')}$`, 'm'));

  const expiresValue = securityTxt.match(/^Expires: (.+)$/m)?.[1];
  assert.ok(expiresValue, 'Expiresが必要です');
  const expiresAt = Date.parse(expiresValue);
  assert.ok(Number.isFinite(expiresAt), 'Expiresは有効な日時である必要があります');
  assert.ok(expiresAt > Date.now(), 'Expiresを更新してください');
  assert.ok(expiresAt - Date.now() < 366 * 24 * 60 * 60 * 1000, 'Expiresは1年未満にしてください');

  assert.match(
    headers,
    /\/\.well-known\/security\.txt[\s\S]*?Content-Type: text\/plain; charset=utf-8[\s\S]*?Cache-Control: public, max-age=3600, must-revalidate/,
  );
});
