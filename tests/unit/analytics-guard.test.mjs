import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const analyticsSource = await readFile(new URL('../../analytics.js', import.meta.url), 'utf8');

function runAnalytics({ hostname, search = '', storedValue = null, readyState = 'complete', requestAnimationFrame, webdriver = false }) {
  const storage = new Map();
  if (storedValue !== null) storage.set('watachan:analytics-excluded:v1', storedValue);
  const appendedScripts = [];
  const historyCalls = [];
  const listeners = new Map();
  const urlHostname = hostname === '::1' ? '[::1]' : hostname;
  const locationUrl = new URL(`https://${urlHostname}/${search ? `?${search}` : ''}`);

  const windowObject = {
    navigator: { webdriver },
    requestAnimationFrame,
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
    readyState,
    head: {
      appendChild: (element) => appendedScripts.push(element),
    },
    body: {
      appendChild: () => {},
    },
    createElement: () => {
      const elementListeners = new Map();
      return {
        setAttribute: () => {},
        addEventListener: (type, listener) => elementListeners.set(type, listener),
        remove: () => {},
        style: {},
        listeners: elementListeners,
      };
    },
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

test('127.0.0.1、::1、プレビュー環境ではGTMスクリプトを読み込まない', () => {
  for (const hostname of ['127.0.0.1', '::1', 'localhost', 'preview.pages.dev']) {
    const result = runAnalytics({ hostname });
    assert.equal(result.windowObject.__WATACHAN_ANALYTICS_DISABLED__, true);
    assert.equal(result.appendedScripts.length, 0);
  }
});

test('自動ブラウザーの本番テストはinclude指定でもGA4とGTMへ送信しない', () => {
  const result = runAnalytics({ hostname: 'www.streetboardgame.com', search: 'analytics=include', webdriver: true });
  assert.equal(result.windowObject.analyticsEnabled, false);
  result.windowObject.trackEvent('game_play', { game_type: 'challenge' });
  assert.equal(result.appendedScripts.length, 0);
  assert.equal(result.windowObject.ga4EventLayer, undefined);
  assert.equal(result.windowObject.dataLayer, undefined);
});

test('本番ドメインだけでGA4イベント送信とGTMを読み込み、URLのクエリを渡さない', () => {
  for (const hostname of ['streetboardgame.com', 'www.streetboardgame.com']) {
    const result = runAnalytics({ hostname });
    assert.equal(result.windowObject.__WATACHAN_ANALYTICS_DISABLED__, false);
    assert.equal(result.windowObject.__WATACHAN_GTM_CONTAINER_ID__, 'GTM-5VMKFTGP');
    assert.equal(result.windowObject.__WATACHAN_GA4_MEASUREMENT_ID__, 'G-X07PVDQWYX');
    assert.equal(result.appendedScripts.length, 1);
    assert.equal(
      result.appendedScripts[0].src,
      'https://www.googletagmanager.com/gtag/js?id=G-X07PVDQWYX&l=ga4EventLayer',
    );
    assert.equal(result.windowObject.dataLayer[0][0], 'set');
    assert.equal(result.windowObject.dataLayer[0][1].page_location, `https://${hostname}/`);
    assert.equal(result.windowObject.dataLayer[0][1].page_path, '/');
    assert.equal(result.windowObject.ga4EventLayer[0][0], 'js');
    assert.equal(result.windowObject.ga4EventLayer[1][0], 'set');
    assert.equal(result.windowObject.ga4EventLayer[1][1].page_location, `https://${hostname}/`);
    assert.equal(result.windowObject.ga4EventLayer[2][0], 'config');
    assert.equal(result.windowObject.ga4EventLayer[2][1], 'G-X07PVDQWYX');

    result.appendedScripts[0].listeners.get('load')();
    assert.equal(result.appendedScripts.length, 2);
    assert.equal(
      result.appendedScripts[1].src,
      'https://www.googletagmanager.com/gtm.js?id=GTM-5VMKFTGP',
    );
    assert.equal(result.windowObject.dataLayer[1].event, 'gtm.js');
  }
});

test('ゲームイベントはGTM用dataLayerと専用GA4レイヤーの両方へ送る', () => {
  const result = runAnalytics({ hostname: 'www.streetboardgame.com' });
  result.windowObject.trackEvent('game_start', { game_type: 'challenge' });
  assert.equal(result.windowObject.dataLayer.length, 2);
  assert.equal(result.windowObject.dataLayer[1].event, 'game_start');
  assert.equal(result.windowObject.dataLayer[1].game_type, 'challenge');
  assert.equal(result.windowObject.ga4EventLayer[3][0], 'event');
  assert.equal(result.windowObject.ga4EventLayer[3][1], 'game_start');
  assert.equal(result.windowObject.ga4EventLayer[3][2].game_type, 'challenge');
});

test('初期描画中は外部タグを待機し、最初のイベントを失わず一度だけ起動する', () => {
  const result = runAnalytics({ hostname: 'www.streetboardgame.com', readyState: 'loading' });
  assert.equal(result.appendedScripts.length, 0);
  result.windowObject.trackEvent('game_start', { game_type: 'challenge' });
  assert.equal(result.appendedScripts.length, 1);
  assert.equal(result.windowObject.ga4EventLayer[3][1], 'game_start');
  result.listeners.get('load')();
  result.listeners.get('pointerdown')();
  assert.equal(result.appendedScripts.length, 1);
});

test('操作がなくてもページ読込完了後に計測を開始する', () => {
  const result = runAnalytics({ hostname: 'www.streetboardgame.com', readyState: 'loading' });
  result.listeners.get('load')();
  assert.equal(result.appendedScripts.length, 1);
});

test('外部タグは最初の描画機会を挟んで読み込み、先行操作があっても重複しない', () => {
  for (const earlyInteraction of [false, true]) {
    const frames = [];
    const result = runAnalytics({
      hostname: 'www.streetboardgame.com',
      requestAnimationFrame: (callback) => frames.push(callback),
    });
    assert.equal(result.appendedScripts.length, 0);
    frames.shift()();
    assert.equal(result.appendedScripts.length, 0);
    if (earlyInteraction) result.listeners.get('pointerdown')();
    frames.shift()();
    assert.equal(result.appendedScripts.length, 1);
    assert.equal(result.windowObject.ga4EventLayer[2][0], 'config');
  }
});

test('計測除外を永続保存し、本番ドメインでもGTMを読み込まない', () => {
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

test('主要HTMLはGTMローダーを読み込み、運用・法務画面は読み込まない', async () => {
  const publicPages = [
    'index.html',
    'challenge.html',
    'live_challenge.html',
    'en/index.html',
  ];
  for (const page of publicPages) {
    const html = await readFile(new URL(`../../${page}`, import.meta.url), 'utf8');
    assert.match(html, /<script(?: defer)? src="\/analytics\.js"><\/script>/, page);
  }

  const excludedPages = [
    'live_ops.html',
    'question_ops.html',
    'terms.html',
    'privacy.html',
    'legal.html',
    'creator-terms.html',
    'refund-policy.html',
    'content-guidelines.html',
    'minor-policy.html',
    'en/terms.html',
    'en/privacy.html',
  ];
  for (const page of excludedPages) {
    const html = await readFile(new URL(`../../${page}`, import.meta.url), 'utf8');
    assert.doesNotMatch(html, /<script src="\/analytics\.js"><\/script>/, page);
  }
});

test('GA4が必要とする画像・計測送信先をCSPで許可する', async () => {
  const worker = await readFile(new URL('../../_worker.js', import.meta.url), 'utf8');
  assert.match(worker, /img-src[^\n]+https:\/\/www\.google-analytics\.com[^\n]+https:\/\/region1\.google-analytics\.com[^\n]+https:\/\/www\.googletagmanager\.com/);
  assert.match(worker, /connect-src[^\n]+https:\/\/www\.google-analytics\.com[^\n]+https:\/\/region1\.google-analytics\.com[^\n]+https:\/\/www\.googletagmanager\.com/);
});
