// 2026-11-27 (Codex review 11/26 #2-13): follow a visitor who opened a shared quiz link
// (utm_source / utm_medium=qr set by src/platform/resultShare.js) through join, finish and making
// their own quiz. Only {step, channel, locale} is sent; the room code stays in this browser tab
// (sessionStorage) to send each step once per room.
import { FUNNEL_CHANNELS, FUNNEL_STEPS } from './share-funnel.js';

const VIA_KEY = 'watachan-share-via';
const session = () => { try { return globalThis.sessionStorage || null; } catch { return null; } };

export function rememberShareArrival(search = globalThis.location?.search || '', storage = session()) {
  try {
    const params = new URLSearchParams(search);
    if (!params.get('room')) return '';
    const source = params.get('utm_source') || '';
    const via = params.get('utm_medium') === 'qr' ? 'qr' : (FUNNEL_CHANNELS.includes(source) ? source : '');
    if (via) storage?.setItem(VIA_KEY, via);
    return via;
  } catch { return ''; }
}

export function shareVia(storage = session()) {
  try {
    const via = storage?.getItem(VIA_KEY) || '';
    return FUNNEL_CHANNELS.includes(via) ? via : '';
  } catch { return ''; }
}

// Someone who chose "stop all access analytics" (analytics.js, ?analytics=exclude) is not counted either.
function excluded(local) {
  try { return local?.getItem('watachan:analytics-excluded:v1') === '1'; } catch { return false; }
}
const localStore = () => { try { return globalThis.localStorage || null; } catch { return null; } };

export function sendShareFunnel(step, locale, roomCode = '', { storage = session(), local = localStore(), fetchImpl = globalThis.fetch } = {}) {
  const via = shareVia(storage);
  if (excluded(local)) return false;
  if (!via || !FUNNEL_STEPS.includes(step) || typeof fetchImpl !== 'function') return false;
  const once = `watachan-funnel:${step}:${roomCode}`;
  try {
    if (storage?.getItem(once)) return false;
    storage?.setItem(once, '1');
  } catch {}
  void Promise.resolve().then(() => fetchImpl('/api/challenge/funnel', {
    method: 'POST', keepalive: true,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ step, channel: via, locale }),
  })).catch(() => {});
  return true;
}
