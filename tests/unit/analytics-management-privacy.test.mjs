import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../../analytics.js', import.meta.url), 'utf8');
// All keys/rooms in this test are synthetic, not production capabilities.
const key = 'abcdef'.repeat(8);
const room = 'ABCDEFGH';

function boot({ url = `https://www.streetboardgame.com/challenge?room=${room}#manage=${key}`, state = null, storageDenied = false, replaceDenied = false, referrer = '' } = {}) {
  const current = new URL(url);
  const sends = [];
  const storage = new Map();
  const window = {
    location: current, navigator: { webdriver: false },
    localStorage: {
      getItem(k) { if (storageDenied) throw Error('denied'); return storage.get(k) ?? null; },
      setItem(k, v) { if (storageDenied) throw Error('denied'); storage.set(k, v); },
      removeItem(k) { if (storageDenied) throw Error('denied'); storage.delete(k); },
    },
    history: { state, replaceState(next, _, url) {
      if (replaceDenied) throw Error('denied');
      this.state = next;
      current.href = new URL(url, current.origin).href;
    }, pushState(next, _, url) { this.state = next; current.href = new URL(url, current.origin).href; } },
    addEventListener() {}, setTimeout() {},
  };
  const document = {
    referrer, readyState: 'complete',
    head: { appendChild(script) { sends.push({ src: script.src, observedLocation: current.href }); } },
    body: { appendChild() {} },
    createElement() { return { addEventListener() {}, setAttribute() {}, style: {} }; },
  };
  vm.runInNewContext(source, { window, document, URL, Date, encodeURIComponent });
  return { window, sends };
}

test('legacy fragment is consumed before tags observe the address; history preserves capability', () => {
  const { window, sends } = boot();
  assert.equal(window.location.hash, '');
  assert.equal(window.history.state.wataChallengeManage.token, key);
  assert.equal(window.history.state.wataChallengeManage.code, room);
  assert.equal(sends.length, 1);
  assert.ok(sends.every(x => !JSON.stringify(x).includes(key)));
});

test('legacy query key and localized route work; public room parameter is retained', () => {
  const { window } = boot({ url: `https://www.streetboardgame.com/en/challenge/manage?room=${room}&manage=${key}&analytics=exclude` });
  assert.equal(window.location.pathname, '/en/challenge/manage');
  assert.equal(window.location.search, `?room=${room}`);
  assert.equal(window.history.state.wataChallengeManage.token, key);
  assert.equal(window.analyticsEnabled, false);
});

test('reload without Web Storage retains the key in same-entry history state', () => {
  const first = boot({ storageDenied: true, state: { unrelated: 'preserved' } });
  const second = boot({ url: first.window.location.href, state: first.window.history.state, storageDenied: true });
  assert.equal(second.window.history.state.wataChallengeManage.token, key);
  assert.equal(second.window.history.state.unrelated, 'preserved');
  assert.ok(!second.window.location.href.includes(key));
});

test('failed URL removal blocks external tag loading instead of leaking', () => {
  const { window, sends } = boot({ replaceDenied: true });
  assert.equal(window.analyticsEnabled, false);
  assert.equal(sends.length, 0);
});

test('creation after tags load does not pass private state through tag History API hooks', () => {
  const { window } = boot({ url: 'https://www.streetboardgame.com/challenge' });
  const observed = [];
  window.history.replaceState = (...args) => observed.push(args);
  assert.equal(window.__WATACHAN_REPLACE_MANAGE_URL__(room, key, `/challenge/manage?room=${room}`), true);
  assert.equal(observed.length, 0);
  assert.equal(window.location.pathname, '/challenge/manage');
  assert.equal(window.history.state.wataChallengeManage.token, key);
  assert.ok(!window.location.href.includes(key));
  assert.equal(window.__WATACHAN_REPLACE_MANAGE_URL__(room, key, 'https://unrelated.invalid/challenge/manage'), false);
});

test('invalid capability is scrubbed, never promoted into management authority', () => {
  const { window } = boot({ url: `https://www.streetboardgame.com/challenge?room=${room}#manage=invalid` });
  assert.equal(window.location.hash, '');
  assert.equal(window.history.state.wataChallengeManage, undefined);
});

test('locale navigation preserves capability without passing it through tag pushState hooks', () => {
  const { window } = boot();
  const observed = [];
  window.history.pushState = (...args) => observed.push(args);
  assert.equal(window.__WATACHAN_REPLACE_MANAGE_URL__(room, key, '/en/challenge/manage', 'push'), true);
  assert.equal(observed.length, 0);
  assert.equal(window.history.state.wataChallengeManage.token, key);
  assert.equal(window.location.pathname, '/en/challenge/manage');
  assert.ok(!window.location.href.includes(key));
});

test('unrelated token-bearing first-party addresses are preserved with collectors disabled', () => {
  const url = `https://www.streetboardgame.com/account?token=${key}`;
  const { window, sends } = boot({ url });
  assert.equal(window.location.href, url);
  assert.equal(window.analyticsEnabled, false);
  assert.equal(sends.length, 0);
});

test('public participant URL is unchanged and does not acquire a key', () => {
  const url = `https://www.streetboardgame.com/challenge?room=${room}`;
  const { window } = boot({ url });
  assert.equal(window.location.href, url);
  assert.equal(window.history.state, null);
});

test('page referrer drops query/fragment; legacy secret referrer fails closed', () => {
  const good = boot({ referrer: 'https://l.instagram.com/?tracking=value#section' });
  assert.equal(good.window.ga4EventLayer[1][1].page_referrer, 'https://l.instagram.com/');
  const bad = boot({ referrer: `https://www.streetboardgame.com/challenge?manage=${key}` });
  assert.equal(bad.window.analyticsEnabled, false);
  assert.equal(bad.sends.length, 0);
});

test('nested event data removes secrets and answer fields while preserving aggregate events', () => {
  const { window } = boot();
  window.trackEvent('share', { method: 'copy', question_count: 2, manageToken: key, participant_name: 'synthetic', answers: [1, 2],
    page_location: `https://www.streetboardgame.com/challenge?room=${room}#manage=${key}`,
    page_referrer: 'https://l.instagram.com/?tracking=value', nested: { value: key, safe: true },
    items: [{ item_id: 'quiz', token: key, quantity: 1 }] });
  const event = window.ga4EventLayer.at(-1);
  const serialized = JSON.stringify(event);
  assert.ok(!serialized.includes(key));
  assert.ok(!serialized.includes('synthetic'));
  assert.ok(!serialized.includes('answers'));
  assert.equal(event[2].method, 'copy');
  assert.equal(event[2].question_count, 2);
  assert.equal(event[2].page_referrer, 'https://l.instagram.com/');
  assert.equal(event[2].items[0].quantity, 1);
});

test('a cyclic or invalid event cannot interrupt gameplay or trigger delivery', () => {
  const { window } = boot();
  const cyclic = {}; cyclic.nested = cyclic;
  assert.doesNotThrow(() => window.trackEvent('share', cyclic));
  const before = window.ga4EventLayer.length;
  window.trackEvent(key, { method: 'copy' });
  assert.equal(window.ga4EventLayer.length, before);
});
