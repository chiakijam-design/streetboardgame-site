import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const analyticsSource = await readFile(new URL('../../analytics.js', import.meta.url), 'utf8');

function runAnalytics({ hostname, search = '', storedValue = null }) {
  const storage = new Map();
  if (storedValue !== null) storage.set('watachan:analytics-excluded:v1', storedValue);
  const appendedScripts = [];
  const historyCalls = [];
  const listeners = new Map();
  const urlHostname = hostname === '::1' ? '[::1]' : hostname;
  const locationUrl = new URL(`https://${urlHostname}/${search ? `?${search}` : ''}`);

  const windowObject = {
    location: {
      href: locationUrl.href,
      hostname,
      origin: locationUrl.origin,
      pathname: locationUrl.pathname,
    },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    history: {
      state: null,
      replaceState: (...args) => historyCalls.push(args),
    },
    addEventListener: (type, listener) => listeners.set(type, listener),
    setTimeout: () => 1,
  };
  const documentObject = {
    head: {
      appendChild: (element) => appendedScripts.push(element),
    },
    body: {
      appendChild: () => {},
    },
    createElement: () => ({
      setAttribute: () => {},
      remove: () => {},
      style: {},
    }),
  };

  vm.runInNewContext(analyticsSource, {
    window: windowObject,
    document: documentObject,
    URL,
    Date,
    encodeURIComponent,
  });

  return { windowObject, storage, appendedScripts, historyCalls, listeners };
}

test('127.0.0.1、::1、プレビュー環境ではGA4スクリプトを読み込まない', () => {
  for (const hostname of ['127.0.0.1', '::1', 'localhost', 'preview.pages.dev']) {
    const result = runAnalytics({ hostname });
    assert.equal(result.windowObject.__WATACHAN_ANALYTICS_DISABLED__, true);
    assert.equal(result.appendedScripts.length, 0);
  }
});

test('本番ドメインだけでGA4スクリプトを読み込む', () => {
  for (const hostname of ['streetboardgame.com', 'www.streetboardgame.com']) {
    const result = runAnalytics({ hostname });
    assert.equal(result.windowObject.__WATACHAN_ANALYTICS_DISABLED__, false);
    assert.equal(result.appendedScripts.length, 1);
    assert.match(result.appendedScripts[0].src, /^https:\/\/www\.googletagmanager\.com\/gtag\/js/);
  }
});

test('計測除外を永続保存し、本番ドメインでもGA4を読み込まない', () => {
  const firstVisit = runAnalytics({
    hostname: 'www.streetboardgame.com',
    search: 'analytics=exclude&room=ABC123',
  });
  assert.equal(firstVisit.storage.get('watachan:analytics-excluded:v1'), '1');
  assert.equal(firstVisit.windowObject.__WATACHAN_ANALYTICS_DISABLED__, true);
  assert.equal(firstVisit.appendedScripts.length, 0);
  assert.equal(firstVisit.historyCalls.length, 1);
  assert.equal(firstVisit.historyCalls[0][2], '/?room=ABC123');

  const nextVisit = runAnalytics({
    hostname: 'www.streetboardgame.com',
    storedValue: '1',
  });
  assert.equal(nextVisit.windowObject.__WATACHAN_ANALYTICS_DISABLED__, true);
  assert.equal(nextVisit.appendedScripts.length, 0);
});
