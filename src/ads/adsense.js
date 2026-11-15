// Google AdSense display units for the four approved scenes
// (docs/ADVERTISING_PLACEMENT_POLICY.md, 2026-11-15).
//
// - Nothing happens unless the Worker injected window.__WATACHAN_ADS__
//   (ADSENSE_ENABLED=true, a Japanese connection and a public game page).
// - The loader script is added only when the first approved scene is shown.
// - One ad host lives after the game root, outside the re-rendered markup, so
//   re-renders never reload an ad. The unit changes only when the scene changes.
import { canDisplayAd } from './placement-policy.js';

const CLIENT_PATTERN = /^ca-pub-\d{10,20}$/;
const SLOT_PATTERN = /^\d{6,20}$/;
const LOADER = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';

export function adConfig(win = globalThis.window) {
  const config = win?.__WATACHAN_ADS__;
  if (!config || config.enabled !== true || !CLIENT_PATTERN.test(String(config.client || ''))) return null;
  return config;
}

export function adSlotFor(placement, config) {
  const slot = String(config?.slots?.[placement] || '');
  return SLOT_PATTERN.test(slot) ? slot : '';
}

// Returns the placement to show now, or '' when no ad may appear.
export function chooseAdPlacement(candidate, config) {
  if (!config || !candidate) return '';
  const { placement, context } = candidate;
  if (!adSlotFor(placement, config)) return '';
  return canDisplayAd({ placement, context }) ? placement : '';
}

let host = null;
let current = '';
let loaderAdded = false;

function addLoader(doc, client) {
  if (loaderAdded) return;
  loaderAdded = true;
  const script = doc.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `${LOADER}?client=${encodeURIComponent(client)}`;
  doc.head.appendChild(script);
}

// candidate: { placement, context } or null. label: localized "広告".
export function updateAdHost(anchor, candidate, label, win = globalThis.window) {
  const config = adConfig(win);
  if (!anchor || !config) return '';
  const placement = chooseAdPlacement(candidate, config);
  if (placement === current) return current;
  current = placement;
  if (!placement) {
    host?.remove();
    host = null;
    return '';
  }
  const doc = anchor.ownerDocument;
  host?.remove();
  host = doc.createElement('aside');
  host.className = 'watachan-ad';
  host.dataset.adPlacement = placement;
  host.setAttribute('aria-label', label);
  host.style.cssText = 'width:min(100% - 32px,640px);margin:24px auto 32px;padding:8px 0 0;border-top:1px solid rgba(0,0,0,.18);text-align:center';
  const tag = doc.createElement('span');
  tag.textContent = label;
  tag.style.cssText = 'display:block;margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.08em;opacity:.7';
  const unit = doc.createElement('ins');
  unit.className = 'adsbygoogle';
  unit.style.display = 'block';
  unit.dataset.adClient = config.client;
  unit.dataset.adSlot = adSlotFor(placement, config);
  unit.dataset.adFormat = 'auto';
  unit.dataset.fullWidthResponsive = 'true';
  host.append(tag, unit);
  anchor.insertAdjacentElement('afterend', host);
  addLoader(doc, config.client);
  try { (win.adsbygoogle = win.adsbygoogle || []).push({}); } catch {}
  return placement;
}

export function resetAdHostForTests() {
  host = null;
  current = '';
  loaderAdded = false;
}
