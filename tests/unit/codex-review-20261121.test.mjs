// 2026-11-21: fixes for the Codex review (items 10, 11 and 16).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadManagedQuestionCards } from '../../src/questions/catalog.js';
import { buildChallengeInviteText } from '../../src/platform/share.js';

test('#10 the 10-question invite says names and scores are listed, not that publishing is optional', () => {
  const text = buildChallengeInviteText({ creatorName: 'ゆう', url: 'https://example.test/challenge?room=ABCDEFGH' });
  assert.match(text, /全問答えると、表示名と点数が理解度ボードに載ります。/);
  assert.doesNotMatch(text, /公開するかは自分で選べ/);
});

test('#16 a failed review lookup never returns the bundled (possibly hidden) questions in strict mode', async () => {
  const saved = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
    await assert.rejects(loadManagedQuestionCards([{ id: 'Q1', title: 'x', choices: [] }], 'challenge', 'ja', { strict: true }));
    globalThis.fetch = async () => { throw new TypeError('offline'); };
    await assert.rejects(loadManagedQuestionCards([{ id: 'Q1', title: 'x', choices: [] }], 'challenge', 'ja', { strict: true }));
  } finally { globalThis.fetch = saved; }
});

test('#11 invitation, board and management screens start before the question catalog arrives', () => {
  const src = readFileSync(new URL('../../challenge_game.js', import.meta.url), 'utf8');
  const boot = src.slice(src.indexOf('async function bootChallenge'), src.indexOf('function startChallengeMode'));
  assert.ok(boot.indexOf("['join', 'ranking', 'manage'].includes(state.mode)") < boot.indexOf('await catalogLoad'));
  assert.match(boot, /setState\(\{ error: 'question-catalog-unavailable' \}\)/);
});

test('#15 a hidden question disappears from the pack page HTML as well as the interactive list', async () => {
  const { resetHiddenQuestionCache } = await import('../../src/questions/hidden-public.js');
  const { PACK_QUESTIONS } = await import('../../src/generated/pack-questions.js');
  const worker = (await import('../../_worker.js')).default;
  const target = PACK_QUESTIONS['easy-first-meeting'].ja.find((q) => q.title === 'コンビニでつい買うなら');
  assert.ok(target?.id, 'pack data carries question IDs');
  const env = { REMOTE_DB: { prepare: () => ({ all: async () => ({ results: [{ question_id: target.id }] }) }) } };
  resetHiddenQuestionCache();
  const hiddenPage = await (await worker.fetch(new Request('https://www.streetboardgame.com/challenge/library/easy-first-meeting'), env)).text();
  assert.doesNotMatch(hiddenPage, /コンビニでつい買うなら/);
  assert.match(hiddenPage, /昔好きだった教科は/);
  resetHiddenQuestionCache();
  const openEnv = { REMOTE_DB: { prepare: () => ({ all: async () => ({ results: [] }) }) } };
  const openPage = await (await worker.fetch(new Request('https://www.streetboardgame.com/challenge/library/easy-first-meeting'), openEnv)).text();
  assert.match(openPage, /コンビニでつい買うなら/);
  resetHiddenQuestionCache();
});

test('#2 two rooms get different og:url values (public join URL only)', async () => {
  const { applyRoomShareMeta } = await import('../../src/challenge/share-meta.js');
  const html = '<head><title>x</title><meta property="og:url" content="https://www.streetboardgame.com/es/challenge"></head>';
  const a = applyRoomShareMeta(html, 'es', { name: 'Ana', count: 10 }, 'https://www.streetboardgame.com/es/challenge?room=AAAAAAAA');
  const b = applyRoomShareMeta(html, 'es', { name: 'Bea', count: 10 }, 'https://www.streetboardgame.com/es/challenge?room=BBBBBBBB');
  assert.match(a, /og:url" content="https:\/\/www\.streetboardgame\.com\/es\/challenge\?room=AAAAAAAA"/);
  assert.notEqual(a.match(/og:url" content="([^"]+)"/)[1], b.match(/og:url" content="([^"]+)"/)[1]);
  assert.doesNotMatch(a, /manage/);
});

test('#7 #8 #12 #18 source checks', () => {
  const src = readFileSync(new URL('../../challenge_game.js', import.meta.url), 'utf8');
  assert.match(src, /const saved = saveManageRoom\(/);
  assert.match(src, /return writeStorage\(MANAGE_HISTORY_KEY, next\);/);
  assert.match(src, /input\.id = 'share-url-fallback';/);
  assert.match(src, /document\.getElementById\('builder-question'\)\?\.focus\(\);/);
  for (const file of ['privacy.html', 'terms.html', 'content-guidelines.html']) {
    const page = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(page, /href="\/contact"/, file);
  }
});

test('#5 #6 #17 source checks', () => {
  const src = readFileSync(new URL('../../challenge_game.js', import.meta.url), 'utf8');
  assert.match(src, /await QRCode\.toCanvas\(qr, joinUrl/);
  assert.match(src, /caption: resultShareText\(\),/);
  assert.match(src, /quickStart && !quickStartHasDraft\) return 'creator-edit'/);
  assert.match(src, /data-testid="manage-history"/);
});

test('#3 #9 #13 #19 #20 #21 #22 #23 #24 checks', async () => {
  const { renderPackPage } = await import('../../src/content/search-copy.js');
  const es = renderPackPage('easy-first-meeting', 'es');
  // 2026-11-27 (Codex review 11/26 #2-2): pack pages use their own pack share image.
  assert.match(es, /og:image" content="[^"]*\/assets\/pack-share\/es-easy-first-meeting\.jpg/);
  assert.match(es, /class="pack-send"/);
  assert.match(es, /line\.me\/R\/msg\/text\/\?/);
  assert.match(es, /utm_source%3Dline%26utm_medium%3Dsocial%26utm_campaign%3Dpack_easy-first-meeting/);
  const searchCopy = readFileSync(new URL('../../src/content/search-copy.js', import.meta.url), 'utf8');
  assert.doesNotMatch(searchCopy, /\.pack-(?:top|langs|footer)(?: a)?\{[^}]*color:#fff/);
  const publicHtml = readFileSync(new URL('../../src/i18n/public-html.js', import.meta.url), 'utf8');
  assert.match(publicHtml, /locale === 'en' \? `\$\{origin\}\/assets\/ogp-challenge-en-v2\.jpg/);
  assert.match(publicHtml, /#\(\?:webpage\|breadcrumb\|faq\)\$/);
  const src = readFileSync(new URL('../../challenge_game.js', import.meta.url), 'utf8');
  assert.match(src, /the same 1 questions/);
  assert.match(src, /id="result-share-include-score"/);
  assert.match(src, /data-testid="jump-to-result-share"/);
  assert.match(src, /resultDetailsOpen: true \}\);/);
  const perfect = readFileSync(new URL('../../src/challenge/perfect.js', import.meta.url), 'utf8');
  assert.match(perfect, /if \(focus\) share\.focus/);
  const tool = readFileSync(new URL('../../tools/build-public-locale-pages.mjs', import.meta.url), 'utf8');
  assert.ok(tool.includes(`html.indexOf('<script data-build-entry="prototype_common_data"')`));
});

test('#16 a site without question storage keeps the bundled cards (no review data exists)', async () => {
  const saved = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({ error: 'question-storage-not-configured' }) });
    const cards = await loadManagedQuestionCards([{ id: 'Q1', title: 'x', choices: [] }], 'challenge', 'ja', { strict: true });
    assert.equal(cards.length, 1);
  } finally { globalThis.fetch = saved; }
});
