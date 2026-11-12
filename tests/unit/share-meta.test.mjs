import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRoomShareMeta, personalizeRoomPage, readRoomShareInfo, roomCodeFromUrl } from '../../src/challenge/share-meta.js';

const HTML = `<html><head><title>通常版｜わたし理解度診断</title>
<meta property="og:title" content="わたし理解度診断">
<meta property="og:description" content="汎用">
<meta name="twitter:title" content="わたし理解度診断">
<meta name="twitter:description" content="汎用">
</head><body></body></html>`;

function kvWith(rooms) {
  return { async get(key) { return rooms[key] ?? null; } };
}

function d1With(row) {
  return { prepare() { return { bind() { return { async first() { return row; } }; } }; } };
}

const future = Date.now() + 86400000;

test('room code must be 8 characters from the room alphabet', () => {
  assert.equal(roomCodeFromUrl(new URL('https://x/challenge?room=abcdefgh')), 'ABCDEFGH');
  assert.equal(roomCodeFromUrl(new URL('https://x/challenge?room=ABC')), '');
  assert.equal(roomCodeFromUrl(new URL('https://x/challenge?room=ABCDEFG1')), '');
});

test('Japanese preview names the creator and the question count', async () => {
  const env = { REMOTE_DB: d1With({ creator_name: 'たろう', card_count: 10, expires_at: future }) };
  const { html, personalized } = await personalizeRoomPage(HTML, env, new URL('https://x/challenge?room=ABCDEFGH'), 'ja');
  assert.equal(personalized, true);
  assert.match(html, /<title>たろうさんからの挑戦｜/);
  assert.match(html, /og:title" content="たろうさんからの挑戦｜/);
  assert.match(html, /og:description" content="たろうさんのこと、どれだけ分かってる？10問の答えを当てよう。/);
  assert.match(html, /twitter:title" content="たろうさんからの挑戦｜/);
  assert.match(html, /twitter:description" content="たろうさんのこと/);
});

test('expired or missing rooms keep the generic preview', async () => {
  const expired = { REMOTE_DB: d1With({ creator_name: 'たろう', card_count: 10, expires_at: Date.now() - 1 }) };
  const url = new URL('https://x/challenge?room=ABCDEFGH');
  assert.deepEqual(await personalizeRoomPage(HTML, expired, url, 'ja'), { html: HTML, personalized: false });
  const missing = { REMOTE_DB: d1With(null) };
  assert.deepEqual(await personalizeRoomPage(HTML, missing, url, 'ja'), { html: HTML, personalized: false });
  const broken = { REMOTE_DB: { prepare() { throw new Error('db down'); } } };
  assert.deepEqual(await personalizeRoomPage(HTML, broken, url, 'ja'), { html: HTML, personalized: false });
});

test('display names are escaped in every tag', () => {
  const html = applyRoomShareMeta(HTML, 'ja', { name: '<b>"x"&y', count: 3 });
  assert.doesNotMatch(html, /<b>"x"/);
  assert.match(html, /&lt;b&gt;&quot;x&quot;&amp;yさんからの挑戦/);
});

test('Portuguese, Spanish and English copies; other locales fall back to English', async () => {
  const env = { CHALLENGE_KV: kvWith({ 'challenge:ABCDEFGH': { creatorName: 'Ana', cards: [1], expiresAt: future } }) };
  const url = new URL('https://x/pt/challenge?room=ABCDEFGH');
  assert.match((await personalizeRoomPage(HTML, env, url, 'pt')).html, /Desafio de Ana .*1 pergunta\b|Desafio de Ana/);
  assert.match(applyRoomShareMeta(HTML, 'pt', { name: 'Ana', count: 1 }), /respostas de 1 pergunta\./);
  assert.match(applyRoomShareMeta(HTML, 'es', { name: 'Ana', count: 10 }), /El reto de Ana/);
  assert.match(applyRoomShareMeta(HTML, 'fr', { name: 'Ana', count: 10 }), /Ana&#39;s challenge/);
});

test('control characters are stripped and names capped at 12 characters', async () => {
  const env = { REMOTE_DB: d1With({ creator_name: 'abc\u0007defghijklmnopq', card_count: 2, expires_at: future }) };
  const info = await readRoomShareInfo(env, 'ABCDEFGH');
  assert.equal(info.name, 'abcdefghijkl');
  assert.equal(info.count, 2);
});
