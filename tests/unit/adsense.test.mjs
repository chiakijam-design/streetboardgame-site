import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../../_worker.js';
import { adsenseConfigFor, injectAdsenseConfig, ADSENSE_CLIENT } from '../../src/ads/adsense-config.js';
import { adConfig, chooseAdPlacement } from '../../src/ads/adsense.js';
import { AD_PLACEMENTS, canDisplayAd } from '../../src/ads/placement-policy.js';

const ON = { ADSENSE_ENABLED: 'true', ADSENSE_SLOT_RESULT: '1234567890', ADSENSE_SLOT_BOARD: '2345678901' };
const JP = { country: 'JP' };

test('AdSense stays off unless enabled, Japanese, a game page and a configured unit', () => {
  assert.equal(adsenseConfigFor({}, '/challenge', JP), null);
  assert.equal(adsenseConfigFor({ ...ON, ADSENSE_ENABLED: 'false' }, '/challenge', JP), null);
  assert.equal(adsenseConfigFor(ON, '/challenge', null), null);
  assert.equal(adsenseConfigFor(ON, '/challenge', { country: 'FR' }), null);
  for (const path of ['/', '/about', '/privacy', '/question-ops', '/live-ops', '/challenge/manage', '/api/challenge/rooms']) {
    assert.equal(adsenseConfigFor(ON, path, JP), null, path);
  }
  assert.equal(adsenseConfigFor({ ADSENSE_ENABLED: 'true', ADSENSE_SLOT_RESULT: 'abc' }, '/challenge', JP), null);
  for (const path of ['/challenge', '/challenge/', '/challenge/library', '/challenge/ranking', '/en/challenge', '/zh-Hans/challenge/library']) {
    assert.deepEqual(adsenseConfigFor(ON, path, JP), {
      enabled: true, client: ADSENSE_CLIENT,
      slots: { [AD_PLACEMENTS.RESULT_AFTER_DISPLAY]: '1234567890', [AD_PLACEMENTS.AFTER_UNDERSTANDING_BOARD]: '2345678901' },
    }, path);
  }
});

test('config injection is escaped and happens once', () => {
  const html = injectAdsenseConfig('<html><head></head></html>', { enabled: true, client: ADSENSE_CLIENT, slots: { x: '</script>' } });
  assert.match(html, /window\.__WATACHAN_ADS__=/);
  assert.ok(!html.includes('</script>"'));
  assert.equal(injectAdsenseConfig(html, { enabled: true }), html);
  assert.equal(injectAdsenseConfig('<head></head>', null), '<head></head>');
});

async function fetchChallenge(env, cf) {
  const request = new Request('https://www.streetboardgame.com/challenge');
  if (cf) Object.defineProperty(request, 'cf', { value: cf });
  return worker.fetch(request, { ...env, ASSETS: { fetch: async () => new Response('<html><head></head><body><script>void 0;</script></body></html>', { headers: { 'content-type': 'text/html' } }) } });
}
const directives = (response) => new Map(response.headers.get('content-security-policy').split('; ').map((part) => {
  const [name, ...sources] = part.split(' ');
  return [name, sources];
}));

test('Worker opens the CSP for AdSense only when ads are served', async () => {
  const off = await fetchChallenge({}, JP);
  assert.deepEqual(directives(off).get('frame-src'), ["'none'"]);
  assert.ok(!(await off.text()).includes('__WATACHAN_ADS__'));

  const abroad = await fetchChallenge(ON, { country: 'US' });
  assert.deepEqual(directives(abroad).get('frame-src'), ["'none'"]);

  const on = await fetchChallenge(ON, JP);
  const csp = directives(on);
  assert.ok(csp.get('frame-src').includes('https://*.googlesyndication.com'));
  assert.ok(csp.get('frame-src').includes('https://*.doubleclick.net'));
  assert.ok(csp.get('script-src').includes('https://pagead2.googlesyndication.com'));
  assert.ok(csp.get('script-src').includes("'strict-dynamic'"));
  assert.ok(csp.get('connect-src').includes('https://*.googlesyndication.com'));
  assert.equal(on.headers.get('cache-control'), 'private, no-store');
  const body = await on.text();
  const nonce = csp.get('script-src').find((source) => source.startsWith("'nonce-")).slice(7, -1);
  assert.ok(body.includes(`<script nonce="${nonce}">window.__WATACHAN_ADS__=`));
  // The page never loads the AdSense loader itself; the game adds it in an approved scene.
  assert.ok(!body.includes('adsbygoogle.js'));
});

test('browser side: only approved scenes with a configured unit show an ad', () => {
  const config = adConfig({ __WATACHAN_ADS__: { enabled: true, client: ADSENSE_CLIENT, slots: { [AD_PLACEMENTS.RESULT_AFTER_DISPLAY]: '1234567890' } } });
  assert.ok(config);
  assert.equal(adConfig({}), null);
  assert.equal(adConfig({ __WATACHAN_ADS__: { enabled: true, client: 'pub-1' } }), null);
  const result = (answered, total, displayed = true) => ({ placement: AD_PLACEMENTS.RESULT_AFTER_DISPLAY,
    context: { resultDisplayed: displayed, answeredQuestionCount: answered, totalQuestionCount: total } });
  assert.equal(chooseAdPlacement(result(3, 3), config), AD_PLACEMENTS.RESULT_AFTER_DISPLAY);
  assert.equal(chooseAdPlacement(result(2, 3), config), '');
  assert.equal(chooseAdPlacement(result(3, 3, false), config), '');
  assert.equal(chooseAdPlacement({ ...result(3, 3), context: { ...result(3, 3).context, isAnsweringQuestions: true } }, config), '');
  // No unit configured for the board yet.
  assert.equal(chooseAdPlacement({ placement: AD_PLACEMENTS.AFTER_UNDERSTANDING_BOARD, context: { understandingBoardViewed: true } }, config), '');
  assert.equal(chooseAdPlacement(null, config), '');
});

test('result scene accepts every quiz length from 1 to 10 questions once all are answered', () => {
  for (const count of [1, 3, 10]) {
    assert.equal(canDisplayAd({ placement: AD_PLACEMENTS.RESULT_AFTER_DISPLAY, context: { resultDisplayed: true, answeredQuestionCount: count, totalQuestionCount: count } }), true, String(count));
  }
  assert.equal(canDisplayAd({ placement: AD_PLACEMENTS.RESULT_AFTER_DISPLAY, context: { resultDisplayed: true, answeredQuestionCount: 0 } }), false);
});
