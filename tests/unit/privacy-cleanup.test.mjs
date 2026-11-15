import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { PRIVACY_RETENTION, runPrivacyCleanup, contactCutoff } from '../../src/privacy/cleanup.js';

test('プライバシーポリシーは現在の公開範囲・子ども・第三者提供・統計情報を明記する', async () => {
  const document = await readFile(new URL('../../privacy.html', import.meta.url), 'utf8');
  for (const requiredText of [
    '2026-11-15',
    '表示名と点数が理解度ボードに自動で載ります',
    '以前の非掲載結果は公開しません',
    '掲載候補として送信しない問題は、この目的では公開しません',
    '個人情報または個人を識別できないよう加工した統計情報を販売・ライセンスしません',
    '現在、答え合わせレポートの生成のために回答内容を外部のAIサービスへ送信しません',
    'Microsoft Clarity',
    'Cookieは無効化し、すべての画面テキストを厳密にマスクします',
    'セッション再現データ30日',
    '10歳から12歳までの利用者',
    'これらの事業者が国外でデータを取り扱う場合',
  ]) assert.equal(document.includes(requiredText), true, requiredText);
  assert.equal(document.includes('任意に選択または入力したコメント'), false);
  // LIVE was removed on 2026-11-15; its provisions live only in /legal-history/.
  for (const liveText of ['LIVE', '購入者メールHMAC', 'Cloudflare Images', 'Stripe']) {
    assert.equal(document.includes(liveText), false, liveText);
  }
  assert.equal(document.includes('href="/legal-history/2026-11-14-privacy.html"'), true);
  for (const retiredText of ['YouTuber登録', 'YouTuberとの契約', 'YouTuber元画像', '遠隔ゲーム']) {
    assert.equal(document.includes(retiredText), false, retiredText);
  }
  const englishDocument = await readFile(new URL('../../en/privacy.html', import.meta.url), 'utf8');
  assert.equal(englishDocument.includes('Version 1.10'), true);
  assert.equal(englishDocument.includes('optional selected or self-written comment'), false);
  assert.equal(englishDocument.includes('Answer content is not currently sent to an external AI service'), true);
  assert.equal(englishDocument.includes('Cloudflare Images'), true);
  assert.equal(englishDocument.includes('Microsoft Clarity'), true);
});

test('Cron は期限切れの部屋・回数制限・管理ログイン・12か月を過ぎたお問い合わせだけを削除する（LIVE は 2026-11-15 に削除）', async () => {
  assert.deepEqual(PRIVACY_RETENTION, { challengeGameDays: 30, ga4Months: 14, contactMonths: 12 });
  const now = 1_800_000_000_000;
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE challenge_rooms (code TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
    CREATE TABLE challenge_participants (room_code TEXT NOT NULL, participant_id TEXT NOT NULL);
    CREATE TABLE rate_limits (rate_key TEXT PRIMARY KEY, window_start INTEGER, request_count INTEGER, expires_at INTEGER NOT NULL);
    CREATE TABLE admin_sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
    CREATE TABLE contact_messages (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
  `);
  sqlite.prepare('INSERT INTO challenge_rooms VALUES (?, ?)').run('OLD', now - 1);
  sqlite.prepare('INSERT INTO challenge_rooms VALUES (?, ?)').run('NEW', now + 1);
  sqlite.prepare("INSERT INTO challenge_participants VALUES ('OLD', 'a'), ('NEW', 'b')").run();
  sqlite.prepare("INSERT INTO rate_limits VALUES ('x', 0, 1, ?), ('y', 0, 1, ?)").run(now - 1, now + 1);
  sqlite.prepare("INSERT INTO admin_sessions VALUES ('s1', ?), ('s2', ?)").run(now - 1, now + 1);
  sqlite.prepare("INSERT INTO contact_messages VALUES ('c-old', ?), ('c-new', ?)").run(contactCutoff(now) - 1, contactCutoff(now) + 1);
  const db = { prepare(sql) { const stmt = sqlite.prepare(sql); return { bind(...args) { return {
    async all() { return { results: stmt.all(...args) }; },
    async run() { return { meta: { changes: Number(stmt.run(...args).changes) } }; },
  }; } }; } };
  const summary = await runPrivacyCleanup({ REMOTE_DB: db }, now);
  assert.deepEqual(summary, { expiredChallengeRooms: 1, deletedContactMessages: 1 });
  assert.deepEqual(sqlite.prepare('SELECT code FROM challenge_rooms').all().map((r) => r.code), ['NEW']);
  assert.deepEqual(sqlite.prepare('SELECT room_code FROM challenge_participants').all().map((r) => r.room_code), ['NEW']);
  assert.deepEqual(sqlite.prepare('SELECT rate_key FROM rate_limits').all().map((r) => r.rate_key), ['y']);
  assert.deepEqual(sqlite.prepare('SELECT token_hash FROM admin_sessions').all().map((r) => r.token_hash), ['s2']);
  assert.deepEqual(sqlite.prepare('SELECT id FROM contact_messages').all().map((r) => r.id), ['c-new']);
  // Missing tables (e.g. a fresh database) are skipped, never fatal.
  assert.deepEqual(await runPrivacyCleanup({ REMOTE_DB: { prepare() { return { bind() { return {
    async all() { throw new Error('no such table: challenge_rooms'); },
    async run() { throw new Error('no such table: rate_limits'); },
  }; } }; } } }, now), { expiredChallengeRooms: 0, deletedContactMessages: 0 });
});
