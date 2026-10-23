import { RETIREMENT_COPY } from './retirement-copy.js';
import { purchaseRecoveryScript } from './purchase-recovery-ui.js';
import { stripLocalePrefix, localeFromPath } from '../i18n/locales.js';

export function isRetiredLivePage(path, searchParams = new URLSearchParams()) {
  const base = stripLocalePrefix(path).replace(/\/+$/, '') || '/';
  return /^\/(?:live(?:-challenge|-guide)?|live_challenge\.html)(?:\/|$)/i.test(base)
    || /^live/i.test(searchParams.get('screen') || '');
}

export function isLiveHistoryRequest(path, method) {
  if (/^\/api\/live\/admin(?:\/|$)/.test(path)) {
    // Historical order/refund/accounting administration stays authenticated.
    return !/\/(?:creator-invites|channel-verifications)(?:\/|$)/.test(path)
      || method === 'GET';
  }
  if (path === '/api/live/stripe/webhook') return method === 'POST';
  if (path === '/api/live/security/csp-report') return method === 'POST';
  if (/^\/api\/live\/(?:health|status)$/.test(path)) return method === 'GET';
  if (/^\/api\/live\/(?:checkouts|downloads|result-entitlements)\/[^/]+$/.test(path)) return method === 'GET';
  if (path === '/api/live/purchases/recover') return method === 'POST';
  return /^\/api\/live\/games\/[0-9]{6}\/cancel$/.test(path) && method === 'POST';
}

export function liveRetiredResponse(request, api = false) {
  const headers = { 'content-type': api ? 'application/json; charset=UTF-8' : 'text/html; charset=UTF-8',
    'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow, noarchive' };
  if (api) return new Response(JSON.stringify({ error: 'live-retired' }), { status: 410, headers });
  const locale = localeFromPath(new URL(request.url).pathname);
  const prefix = locale === 'ja' ? '' : '/' + locale;
  const ja = locale === 'ja';
  const copy = RETIREMENT_COPY[locale] || RETIREMENT_COPY.en;
  const title = ja ? 'LIVE版は終了しました' : 'LIVE';
  const body = ja ? 'LIVE版は終了しました。新規の有料販売・配信者登録は受け付けていません。過去の購入・返金の権利と既存データの保存条件は変わりません。' : copy.body;
  const formCopy = ja ? { email: 'メールアドレス', submit: '送信', save: '画像を保存', contact: 'お問い合わせフォーム' } : copy;
  const recovery = '<details style="margin-top:2rem"><summary>' + (ja ? '過去の購入・受取' : copy.history) + '</summary><form id="purchase-recovery" style="display:grid;gap:1rem;margin:1rem 0"><label>Order ID <input name="orderId" required pattern="ord_[a-fA-F0-9]{32}" placeholder="ord_…" autocomplete="off" style="box-sizing:border-box;width:100%;min-height:44px;font:inherit"></label><label>' + formCopy.email + '<input name="email" type="email" required maxlength="320" autocomplete="off" style="box-sizing:border-box;width:100%;min-height:44px;font:inherit"></label><button type="submit" style="min-height:44px;font:inherit">' + formCopy.submit + '</button></form><p id="purchase-recovery-status" role="status"></p><a id="purchase-recovery-download" hidden download>' + formCopy.save + '</a></details><script>' + purchaseRecoveryScript(formCopy) + '</script>';
  return new Response(request.method === 'HEAD' ? null : '<!doctype html><html lang="' + locale + '" dir="' + (['ar', 'he'].includes(locale) ? 'rtl' : 'ltr') + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>' + title + '</title></head><body><main style="max-width:42rem;margin:3rem auto;padding:1.5rem;font-family:sans-serif;line-height:1.8"><h1>' + title + '</h1><p>' + body + '</p><p><a href="' + prefix + '/challenge">' + (ja ? '無料クイズ' : copy.quiz) + '</a> · <a href="' + prefix + '/about?to=contact">' + (ja ? 'お問い合わせ' : copy.contact) + '</a> · <a href="' + prefix + '/refund-policy">' + (ja ? '過去の購入・返金' : copy.history) + '</a></p>' + recovery + '</main></body></html>', { status: 410, headers });
}
