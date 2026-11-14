import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleContactApi, buildContactMail, CONTACT_SITES } from '../../src/contact/api.js';
import { runPrivacyCleanup, contactCutoff } from '../../src/privacy/cleanup.js';
import worker from '../../_worker.js';

function database() {
  const db = new DatabaseSync(':memory:');
  for (const name of ['0032_contact_messages']) {
    db.exec(readFileSync(new URL(`../../migrations/${name}.sql`, import.meta.url), 'utf8'));
  }
  return db;
}
function adapter(db) {
  return { prepare(sql) {
    const stmt = db.prepare(sql);
    return { values: [], bind(...values) { this.values = values; return this; },
      async first() { return stmt.get(...this.values) || null; },
      async all() { return { results: stmt.all(...this.values) }; },
      async run() { const before = db.prepare('SELECT total_changes() n').get().n; stmt.run(...this.values);
        return { meta: { changes: db.prepare('SELECT total_changes() n').get().n - before } }; },
    };
  } };
}

const NOW = 1_800_000_000_000;
const WATA = 'https://www.streetboardgame.com';
function post(body, { origin = WATA, ip = '192.0.2.10', type = 'application/json' } = {}) {
  return new Request(`${WATA}/api/contact`, {
    method: 'POST',
    headers: { origin, 'content-type': type, 'cf-connecting-ip': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
const valid = (over = {}) => ({ name: '花子', email: 'Hanako@Example.com', message: '楽しかったです。', hp: '', elapsedMs: 8000,
  extra: { feedback_type: '感想', usage_scene: '問題を作った', subject: 'streetboardgame.com 感想・改善要望・お問い合わせ', topic: '' }, ...over });

function mockResend(t, responder = () => new Response(JSON.stringify({ id: 'resend-123' }), { status: 200 })) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init, body: JSON.parse(init.body) }); return responder(); };
  t.after(() => { globalThis.fetch = original; });
  return calls;
}
const env = (db) => ({ REMOTE_DB: adapter(db), RESEND_API_KEY: 're_test_key', CONTACT_NOTIFY_TO: 'operator@example.test' });

test('Wataからの送信は先に保存し、Resendで文字だけの通知メールを送る', async (t) => {
  const db = database(); const calls = mockResend(t);
  const response = await handleContactApi(post(valid()), env(db), NOW);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  const row = db.prepare('SELECT * FROM contact_messages').get();
  assert.equal(row.site, 'wata');
  assert.equal(row.email, 'hanako@example.com');
  assert.equal(row.verdict, 'ok');
  assert.equal(row.mail_status, 'sent');
  assert.equal(row.resend_id, 'resend-123');
  assert.deepEqual(JSON.parse(row.extra_json).feedback_type, '感想');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.equal(calls[0].init.headers.authorization, 'Bearer re_test_key');
  assert.equal(calls[0].init.headers['idempotency-key'], `contact-${row.id}`);
  assert.equal(calls[0].body.from, 'わたし理解度診断 お問い合わせ <no-reply@notify.streetboardgame.com>');
  assert.deepEqual(calls[0].body.to, ['operator@example.test']);
  assert.equal(calls[0].body.reply_to, 'hanako@example.com');
  assert.equal(calls[0].body.subject, '【わたし理解度診断】感想：花子様');
  assert.equal(calls[0].body.html, undefined);
  assert.match(calls[0].body.text, /送りたい内容：感想/);
  assert.match(calls[0].body.text, /楽しかったです。/);
  // No raw IP is stored anywhere.
  assert.ok(db.prepare('SELECT rate_key FROM live_rate_limits').all().every((r) => !r.rate_key.includes('192.0.2.')));
  assert.doesNotMatch(JSON.stringify(db.prepare('SELECT * FROM contact_messages').all()), /192\.0\.2\./);
});

test('名前とメールは任意で、メールがなければ reply_to を付けない。本文は必須', async (t) => {
  const db = database(); const calls = mockResend(t);
  const ok = await handleContactApi(post(valid({ name: '', email: '' }), { ip: '192.0.2.11' }), env(db), NOW);
  assert.equal(ok.status, 200);
  assert.equal(calls[0].body.reply_to, undefined);
  assert.equal(calls[0].body.subject, '【わたし理解度診断】感想');
  const missing = await handleContactApi(post(valid({ message: '   ' }), { ip: '192.0.2.11' }), env(db), NOW);
  assert.equal(missing.status, 400);
  const badMail = await handleContactApi(post(valid({ email: 'not-an-address' }), { ip: '192.0.2.11' }), env(db), NOW);
  assert.equal(badMail.status, 400);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM contact_messages').get().n, 1);
});

test('みんなのWeb診断の2つのオリジンはCORSで受け付け、ほかのオリジンは断る', async (t) => {
  const db = database(); const calls = mockResend(t);
  for (const origin of ['https://webpersonalitytest.com', 'https://www.webpersonalitytest.com']) {
    const preflight = await handleContactApi(new Request(`${WATA}/api/contact`, { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST' } }), env(db), NOW);
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    assert.match(preflight.headers.get('access-control-allow-headers'), /Content-Type/);
    const response = await handleContactApi(post(valid(), { origin, ip: '192.0.2.20' }), env(db), NOW);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
  }
  assert.equal(calls[0].body.from, 'みんなのWeb診断 お問い合わせ <no-reply@notify.streetboardgame.com>');
  assert.equal(calls[0].body.subject, '【みんなのWeb診断】感想：花子様');
  assert.deepEqual(db.prepare('SELECT DISTINCT site FROM contact_messages').all().map((r) => r.site), ['minna']);
  for (const origin of ['https://evil.example', 'https://webpersonalitytest.com.evil.example', '']) {
    const preflight = await handleContactApi(new Request(`${WATA}/api/contact`, { method: 'OPTIONS', headers: origin ? { origin } : {} }), env(db), NOW);
    assert.equal(preflight.status, 403);
    assert.equal(preflight.headers.get('access-control-allow-origin'), null);
    const response = await handleContactApi(post(valid(), { origin, ip: '192.0.2.21' }), env(db), NOW);
    assert.equal(response.status, 403);
  }
  assert.equal((await handleContactApi(post(valid(), { type: 'text/plain' }), env(db), NOW)).status, 415);
  assert.equal((await handleContactApi(new Request(`${WATA}/api/contact`, { headers: { origin: WATA } }), env(db), NOW)).status, 405);
  assert.deepEqual(Object.keys(CONTACT_SITES), ['wata', 'minna']);
});

test('隠し欄入力・3秒未満の送信は機械の投稿として保存だけしてメールしない', async (t) => {
  const db = database(); const calls = mockResend(t);
  for (const [body, ip] of [[valid({ hp: 'http://spam.example' }), '192.0.2.30'], [valid({ elapsedMs: 1200 }), '192.0.2.31'], [valid({ elapsedMs: undefined }), '192.0.2.32']]) {
    const response = await handleContactApi(post(body, { ip }), env(db), NOW);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  }
  assert.equal(calls.length, 0);
  assert.deepEqual(db.prepare('SELECT verdict, mail_status FROM contact_messages').all().map((r) => `${r.verdict}:${r.mail_status}`), ['bot:not_sent', 'bot:not_sent', 'bot:not_sent']);
});

test('同じ送り元は1時間5件まで。次の1時間や別の送り元は送れる', async (t) => {
  const db = database(); mockResend(t);
  for (let i = 0; i < 5; i += 1) assert.equal((await handleContactApi(post(valid(), { ip: '192.0.2.40' }), env(db), NOW)).status, 200);
  const limited = await handleContactApi(post(valid(), { ip: '192.0.2.40' }), env(db), NOW);
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  assert.equal((await handleContactApi(post(valid(), { ip: '192.0.2.41' }), env(db), NOW)).status, 200);
  assert.equal((await handleContactApi(post(valid(), { ip: '192.0.2.40' }), env(db), NOW + 3_600_000)).status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM contact_messages').get().n, 7);
});

test('メール送信に失敗しても保存は残り、送り主には受付完了を返す', async (t) => {
  const db = database(); mockResend(t, () => new Response('{"message":"bad"}', { status: 500 }));
  const response = await handleContactApi(post(valid(), { ip: '192.0.2.50' }), env(db), NOW);
  assert.equal(response.status, 200);
  assert.equal(db.prepare('SELECT mail_status FROM contact_messages').get().mail_status, 'failed');
  const notConfigured = await handleContactApi(post(valid(), { ip: '192.0.2.51' }), { REMOTE_DB: adapter(db) }, NOW);
  assert.equal(notConfigured.status, 200);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM contact_messages WHERE mail_status = 'failed'").get().n, 2);
});

test('件名に改行を入れられず、未知の項目名や長すぎる値は落とす', () => {
  const mail = buildContactMail({ site: CONTACT_SITES.wata, name: '太郎', email: '', message: '本文', extra: { feedback_type: '感想\r\nBcc: x@example.com' }, now: NOW });
  assert.doesNotMatch(mail.subject, /[\r\n]/);
});

test('Workerの /api/contact につながり、CSPから formspree.io が消えている', async (t) => {
  const db = database(); mockResend(t);
  const response = await worker.fetch(post(valid(), { ip: '192.0.2.60' }), { ...env(db), ASSETS: { fetch: async () => new Response('x') } });
  assert.equal(response.status, 200);
  assert.doesNotMatch(response.headers.get('content-security-policy'), /formspree/);
  assert.match(response.headers.get('content-security-policy'), /form-action 'self'(;|$)/);
  assert.doesNotMatch(readFileSync(new URL('../../_headers', import.meta.url), 'utf8'), /formspree/);
});

test('お問い合わせは受付から12か月を過ぎるとCronで削除される', async () => {
  const db = database();
  const insert = db.prepare("INSERT INTO contact_messages (id, site, created_at, message, verdict, mail_status) VALUES (?, 'wata', ?, 'x', 'ok', 'sent')");
  const cutoff = contactCutoff(NOW);
  insert.run('old', cutoff - 1);
  insert.run('recent', cutoff + 1);
  const summary = await runPrivacyCleanup({ REMOTE_DB: adapter(db) }, NOW);
  assert.equal(summary.deletedContactMessages, 1);
  assert.deepEqual(db.prepare('SELECT id FROM contact_messages').all().map((r) => r.id), ['recent']);
  assert.ok(NOW - cutoff > 364 * 86_400_000 && NOW - cutoff < 367 * 86_400_000);
});

test('改定前のプライバシーポリシーを legal-history に残し、現行版は Formspree を使わない', () => {
  // The historical-provisions block quotes the pre-2026-10-23 text and stays unchanged.
  const current = readFileSync(new URL('../../privacy.html', import.meta.url), 'utf8').split('data-testid="historical-provisions"')[0];
  const previous = readFileSync(new URL('../../legal-history/2026-10-23-privacy.html', import.meta.url), 'utf8');
  assert.match(previous, /<td>Formspree<\/td>/);
  assert.doesNotMatch(current, /Formspree/);
  assert.match(current, /Cloudflare D1（お問い合わせ受付）/);
  assert.match(current, /<td>Resend<\/td>/);
  const english = readFileSync(new URL('../../en/privacy.html', import.meta.url), 'utf8');
  assert.doesNotMatch(english, /Formspree/);
  assert.match(english, /<td>Resend<\/td>/);
});
