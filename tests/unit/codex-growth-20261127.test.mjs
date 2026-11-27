// 2026-11-27 (Codex review 11/26, growth ideas #2-1, #2-2, #2-5, #2-7, #2-8, #2-9, #2-12)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { renderIntlGuide, intlGuidePaths, matchIntlGuide, PACK_SLUGS, SEARCH_COPY_LOCALES } from '../../src/content/search-copy.js';
import { INTL_GUIDES, INTL_GUIDE_KEYS } from '../../src/content/intl-guides.js';
import { pvPublicPath } from '../../src/analytics/pv-policy.js';

const root = new URL('../../', import.meta.url);

test('#2-1 en/es/pt guides render with real pack questions, short descriptions and are listed and measured', async () => {
  const sitemap = await readFile(new URL('sitemap.xml', root), 'utf8');
  const llms = await readFile(new URL('llms.txt', root), 'utf8');
  for (const path of intlGuidePaths()) {
    const found = matchIntlGuide(path);
    assert.ok(found, path);
    const html = renderIntlGuide(found.locale, found.key);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://www\\.streetboardgame\\.com${path.replace(/[/.]/g, '\\$&')}">`));
    assert.doesNotMatch(html.slice(html.indexOf('<main')), /undefined|\*/, path);
    const description = html.match(/<meta name="description" content="([^"]*)"/)[1];
    assert.ok(description.length <= 160, path);
    assert.ok(sitemap.includes(`<loc>https://www.streetboardgame.com${path}</loc>`), path);
    assert.ok(llms.includes(`https://www.streetboardgame.com${path}`), path);
    assert.ok(pvPublicPath(path.replace(/\/$/, ''), ['en', 'es', 'pt']), path);
  }
  for (const [locale, guide] of Object.entries(INTL_GUIDES)) {
    for (const key of INTL_GUIDE_KEYS) {
      const html = renderIntlGuide(locale, key);
      // the question article promises 40 questions in its title; the other one has about 5 per group
      const count = (html.match(/data-qid=/g) || []).length;
      if (key === 'questions') assert.equal(count, 40, `${locale} ${key} examples`);
      else assert.ok(count >= 25, `${locale} ${key} examples`);
      assert.ok(html.includes(guide.articles[key].title));
    }
  }
});

test('#2-2 every pack page has its own share image file', async () => {
  for (const locale of SEARCH_COPY_LOCALES) {
    for (const slug of PACK_SLUGS) await access(new URL(`assets/pack-share/${locale}-${slug}.jpg`, root));
  }
});

test('#2-7 #2-8 expired/full screens keep a way to play; Stories button copies the join link', async () => {
  const game = await readFile(new URL('challenge_game.js', root), 'utf8');
  assert.match(game, /data-testid="challenge-error-choices"/);
  assert.match(game, /data-testid="challenge-full-choices"/);
  assert.match(game, /data-action="reload-page"/);
  const share = await readFile(new URL('src/platform/resultShare.js', root), 'utf8');
  assert.match(share, /action === 'instagram' \? copyText\(payload\.url\)/);
});

test('#2-12 hashed translation scripts are cached for a year', async () => {
  const worker = await readFile(new URL('_worker.js', root), 'utf8');
  const pattern = new RegExp(worker.match(/const HASHED_BUILD_ASSET_PATH = \/(.*)\/i;/)[1], 'i');
  assert.ok(pattern.test('/locale-assets/es-9735f088cdbf.js'));
  assert.ok(pattern.test('/locale-assets/zh-Hans-c15f41a39f96.js'));
  assert.ok(!pattern.test('/locale-assets/es.json'));
});

test('#2-13 share funnel sends only step, channel and locale, once per room, and respects the opt-out', async () => {
  const { rememberShareArrival, sendShareFunnel } = await import('../../src/analytics/client-share-funnel.js');
  const { validShareFunnel, recordShareFunnel } = await import('../../src/analytics/share-funnel.js');
  const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
  const storage = store();
  const sent = [];
  const fetchImpl = async (url, init) => { sent.push([url, JSON.parse(init.body)]); return { ok: true }; };
  assert.equal(rememberShareArrival('?room=ABCD2345&utm_source=line&utm_medium=social', storage), 'line');
  assert.equal(sendShareFunnel('arrived', 'es', 'ABCD2345', { storage, local: store(), fetchImpl }), true);
  assert.equal(sendShareFunnel('arrived', 'es', 'ABCD2345', { storage, local: store(), fetchImpl }), false);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(sent, [['/api/challenge/funnel', { step: 'arrived', channel: 'line', locale: 'es' }]]);
  const excluded = store(); excluded.setItem('watachan:analytics-excluded:v1', '1');
  assert.equal(sendShareFunnel('joined', 'es', 'ABCD2345', { storage, local: excluded, fetchImpl }), false);
  assert.equal(rememberShareArrival('?room=ABCD2345&utm_source=share&utm_medium=qr', storage), 'qr');
  assert.equal(rememberShareArrival('?utm_source=line', store()), '');
  assert.equal(validShareFunnel('arrived', 'line', 'ja'), true);
  assert.equal(validShareFunnel('arrived', 'evil', 'ja'), false);
  assert.equal(validShareFunnel('paid', 'line', 'ja'), false);
  let bound;
  const env = { REMOTE_DB: { prepare: (sql) => ({ bind: (...args) => { bound = { sql, args }; return { run: async () => ({}) }; } }) } };
  assert.equal(await recordShareFunnel(env, 'completed', 'x', 'pt', Date.UTC(2026, 10, 27, 0, 0)), true);
  assert.deepEqual(bound.args, ['2026-11-27', 'pt', 'x', 'completed']);
  assert.doesNotMatch(bound.sql, /room|token|name/i);
});
