// Worker side of Google AdSense (2026-11-15). Ads stay off until the owner's
// AdSense review passes and ADSENSE_ENABLED is set to "true" together with the
// display ad unit IDs (ADSENSE_SLOT_*). Only Japanese connections receive ads:
// other regions (e.g. the EEA/UK) would need a certified consent banner first.
import { AD_PLACEMENTS } from './placement-policy.js';

export const ADSENSE_CLIENT = 'ca-pub-8959934584200203';

// Pages where one of the four approved scenes can appear (any locale prefix).
const AD_PAGE = /^\/(?:[a-zA-Z]{2}(?:-[a-zA-Z]{2,4})?\/)?challenge(?:\/(?:library|ranking))?\/?$/;

const SLOT_ENV = Object.freeze({
  [AD_PLACEMENTS.RESULT_AFTER_DISPLAY]: 'ADSENSE_SLOT_RESULT',
  [AD_PLACEMENTS.LIBRARY_AFTER_LONG_BROWSE]: 'ADSENSE_SLOT_LIBRARY',
  [AD_PLACEMENTS.BEFORE_NEW_DIAGNOSIS]: 'ADSENSE_SLOT_BEFORE_CREATE',
  [AD_PLACEMENTS.AFTER_UNDERSTANDING_BOARD]: 'ADSENSE_SLOT_BOARD',
});

// Hosts from Google's AdSense content-security-policy guidance. With a nonce
// and 'strict-dynamic', CSP3 browsers trust the loader the page itself adds;
// the host list covers older browsers.
export const ADSENSE_CSP = Object.freeze({
  script: 'https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://*.googlesyndication.com https://www.googletagservices.com https://*.google.com https://*.doubleclick.net https://*.adtrafficquality.google https://fundingchoicesmessages.google.com',
  frame: 'https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://www.google.com https://*.adtrafficquality.google https://fundingchoicesmessages.google.com',
  connect: 'https://*.googlesyndication.com https://*.google.com https://*.doubleclick.net https://*.adtrafficquality.google https://*.googleadservices.com https://fundingchoicesmessages.google.com',
  img: 'https:',
});

export function adsenseConfigFor(env, pathname, googleRegion) {
  if (String(env?.ADSENSE_ENABLED || '').toLowerCase() !== 'true') return null;
  if (googleRegion?.country !== 'JP' || !AD_PAGE.test(pathname)) return null;
  const slots = {};
  for (const [placement, key] of Object.entries(SLOT_ENV)) {
    const value = String(env?.[key] || '').trim();
    if (/^\d{6,20}$/.test(value)) slots[placement] = value;
  }
  if (!Object.keys(slots).length) return null;
  return { enabled: true, client: ADSENSE_CLIENT, slots };
}

export function injectAdsenseConfig(html, config) {
  if (!config || html.includes('window.__WATACHAN_ADS__=')) return html;
  const json = JSON.stringify(config).replace(/[<>&\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  return html.replace(/<\/head>/i, `<script>window.__WATACHAN_ADS__=${json};</script></head>`);
}
