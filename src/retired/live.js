// Retired LIVE URLs answer 410 (LIVE ended 2026-10-23; code removed 2026-11-15).
// No LIVE purchase was ever completed, so no purchase recovery is offered.
import { RETIREMENT_COPY } from './live-copy.js';
import { stripLocalePrefix, localeFromPath } from '../i18n/locales.js';
import { removedPageHeading } from '../i18n/removed-page-copy.js';

export function isRetiredLivePage(path, searchParams = new URLSearchParams()) {
  const base = stripLocalePrefix(path).replace(/\/+$/, '') || '/';
  return /^\/(?:live(?:-challenge|-guide|-ops)?|live_(?:challenge|ops)\.html)(?:\/|$)/i.test(base)
    || /^live/i.test(searchParams.get('screen') || '');
}

export function liveRetiredResponse(request, api = false) {
  const headers = { 'content-type': api ? 'application/json; charset=UTF-8' : 'text/html; charset=UTF-8',
    'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow, noarchive' };
  if (api) return new Response(JSON.stringify({ error: 'live-retired' }), { status: 410, headers });
  const locale = localeFromPath(new URL(request.url).pathname);
  const prefix = locale === 'ja' ? '' : '/' + locale;
  const ja = locale === 'ja';
  const copy = RETIREMENT_COPY[locale] || RETIREMENT_COPY.en;
  const title = removedPageHeading(locale);
  return new Response(request.method === 'HEAD' ? null : '<!doctype html><html lang="' + locale + '" dir="' + (['ar', 'he'].includes(locale) ? 'rtl' : 'ltr') + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>' + title + '</title></head><body><main style="max-width:42rem;margin:3rem auto;padding:1.5rem;font-family:sans-serif;line-height:1.8;overflow-wrap:anywhere"><h1>' + title + '</h1><p><a href="' + prefix + '/challenge">' + (ja ? '無料クイズ' : copy.quiz) + '</a> · <a href="' + prefix + '/about?to=contact">' + (ja ? 'お問い合わせ' : copy.contact) + '</a></p></main></body></html>', { status: 410, headers });
}

export function isRemovedRefundPage(path) {
  return /^\/refund-policy(?:\.html)?$/i.test(stripLocalePrefix(path).replace(/\/+$/, ''));
}

// Removed URLs stop before any storage or asset fetch, including old HTML aliases.
export function isRemovedPricingPage(path) {
  return /^\/pricing(?:\.html)?$/i.test(stripLocalePrefix(path).replace(/\/+$/, ''));
}
export function removedPricingResponse(request) {
  const locale=localeFromPath(new URL(request.url).pathname);
  const prefix=locale==='ja'?'':'/'+locale;
  const copy=RETIREMENT_COPY[locale]||RETIREMENT_COPY.en;
  const quiz=locale==='ja'?'無料クイズ':copy.quiz;
  const title=removedPageHeading(locale);
  const html='<!doctype html><html lang="'+locale+'" dir="'+(['ar','he'].includes(locale)?'rtl':'ltr')+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>'+title+'</title></head><body><main style="max-width:42rem;margin:3rem auto;padding:1.5rem;font-family:sans-serif;line-height:1.8"><h1>'+title+'</h1><p><a style="display:inline-block;padding:1rem" href="'+prefix+'/challenge">'+quiz+'</a></p></main></body></html>';
  return new Response(request.method==='HEAD'?null:html,{status:410,headers:{'content-type':'text/html; charset=UTF-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow, noarchive'}});
}
