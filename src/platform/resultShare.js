import { copyText } from './share.js';
import { shareCardCopy } from './shareCardCopy.js';
import { dataUrlToBlob, saveImageBlob } from './imageSave.js';

// Outcomes describe a browser action, never a successful SNS post or chosen app.
export function whatsappShareUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function resultSocialUrl(action, text) {
  if (action === 'whatsapp') return whatsappShareUrl(text);
  if (action === 'line') return `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
  if (action === 'x') return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
  throw new Error('unsupported-share-action');
}

export async function shareResult({ src, filename, title, text, url }, {
  navigatorRef = globalThis.navigator, windowRef = globalThis.window, FileRef = globalThis.File,
} = {}) {
  if (!windowRef?.isSecureContext || typeof navigatorRef?.share !== 'function'
    || navigatorRef.userActivation?.isActive === false) return 'unavailable';
  const link = { title, text, url };
  let payload = link;
  try {
    if (src && FileRef && typeof navigatorRef.canShare === 'function') {
      const file = new FileRef([dataUrlToBlob(src)], filename, { type: 'image/png' });
      // Check files specifically, then the combined payload. Keep the URL even
      // when the receiving application ignores text alongside an attachment.
      const combined = { ...link, files: [file] };
      if (navigatorRef.canShare({ files: [file] }) && navigatorRef.canShare(combined)) payload = combined;
    }
  } catch { /* Bad/unavailable image: the existing link remains shareable. */ }
  try {
    // No fetch, board update or font wait before this call: preserve the click.
    await navigatorRef.share(payload);
    return payload.files ? 'handed-off-image' : 'handed-off-link';
  } catch (error) {
    if (error?.name === 'AbortError') return 'cancelled';
    // A second share call may lack user activation; offer explicit copy/save.
    return 'unavailable';
  }
}

const SHARE_ICONS = {
  native: '<circle cx="8" cy="16" r="3"/><circle cx="24" cy="7" r="3"/><circle cx="24" cy="25" r="3"/><path d="m11 14 10-5m-10 9 10 5"/>',
  copy: '<rect x="12" y="5" width="14" height="17" rx="4"/><path d="M9 11H7a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h11a3 3 0 0 0 3-3v-1"/>',
  save: '<path d="M16 4v16m-6-6 6 6 6-6M5 23v5h22v-5"/>',
  x: '<path d="M6 5h6l14 22h-6L6 5Zm1 22L25 5"/>',
  line: '<path d="M27 14c0 6-5 10-11 10h-3l-6 3 1-6c-3-2-4-4-4-7C4 8 9 4 16 4s11 4 11 10Z"/><path d="M9 11v7h3m2-7v7m3-7v7m0-7 4 7v-7m3 0h3m-3 0v7h3m-3-3h2" stroke-width="1.3"/>',
  whatsapp: '<path d="M27 15a12 12 0 0 1-18 10l-6 2 2-6A12 12 0 1 1 27 15Z"/><path d="m10 9 3 4-2 2c2 3 3 4 6 5l2-3 4 2c0 5-4 5-8 3-5-2-9-8-5-13Z"/>',
  instagram: '<rect x="4" y="4" width="24" height="24" rx="7"/><circle cx="16" cy="16" r="6"/><circle cx="23" cy="9" r="1"/>',
};
export function resultShareMarkup({ translate, escape, locale = 'ja', ready = true, saveAction = 'save-result-image', nativeLabel = '結果を共有', saveLabel = '結果画像を保存' }) {
  const t = (text) => escape(translate(text));
  const copy = shareCardCopy(locale);
  const card = (action, label, hint, icon, attributes = '', arrow = false, accessibleLabel = label) => `<button type="button" class="share-card" data-result-share="${action}" aria-label="${t(accessibleLabel)}" aria-describedby="result-share-${action}-hint" ${attributes}>
    <span class="share-card-icon" aria-hidden="true"><svg viewBox="0 0 32 32">${SHARE_ICONS[icon]}</svg></span>
    <span class="share-card-copy"><strong>${t(label)}</strong><small id="result-share-${action}-hint">${t(hint)}</small></span>
    ${arrow ? '<span class="share-card-arrow" aria-hidden="true">›</span>' : ''}
  </button>`;
  return `<div data-result-share-controls data-result-share-locale="${escape(locale)}">
    ${card('native', nativeLabel, '参加URLを友達へ送る', 'native', '', true)}
    <div class="challenge-result-share-buttons" data-result-share-row>
      ${card('copy', 'リンクをコピー', '参加URLをクリップボードへ', 'copy')}
      ${card('save', saveLabel, copy.saveHint, 'save', `data-action="${saveAction}" ${ready ? '' : 'disabled'}`)}
    </div>
    <input type="text" readonly dir="ltr" aria-label="${t('参加URL')}" data-result-share-url>
    <p>${t('共有先によって画像やリンクが届かない場合は、リンクをコピーするか画像を保存してください。')}</p>
    <div class="challenge-result-share-buttons" data-result-share-row data-result-share-social>
      ${card('x', 'X', '参加URLつきで投稿', 'x', 'data-action="share-result-x"')}
      ${card('line', 'LINE', '参加URLを友達へ送る', 'line', 'data-action="share-result-line"')}
      ${card('whatsapp', 'WhatsApp', '参加URLを友達へ送る', 'whatsapp')}
      ${card('instagram-link', 'Instagram', 'リンクをコピーして投稿', 'instagram', '', false, `Instagram: ${translate('リンクをコピー')}`)}
    </div>
    <p>${t('WhatsAppでは本文とリンクを共有します。画像は別途添付してください。')}</p>
    <details><summary>${t(copy.imageSummary)}</summary>
      <p>${t('Instagramには保存した画像を投稿し、コピーした文章を貼り付けてください。')}</p>
      ${card('instagram', 'ストーリー用：文章コピー＋画像保存', copy.saveHint, 'instagram', `data-action="share-result-instagram" ${ready ? '' : 'disabled'}`, true)}
    </details>
    <p role="status" aria-live="polite" data-result-share-status></p>
  </div>`;
}

let busy = null;
let releaseActive = null;
// A restored page must not retain disabled controls from a departed OS sheet.
globalThis.window?.addEventListener('pagehide', () => releaseActive?.());
export function bindResultShare(root, { getPayload, translate, beforeAction = () => true, track = () => {} }) {
  const controls = root.querySelector('[data-result-share-controls]');
  if (!controls) return;
  controls.querySelector('[data-result-share-url]').value = getPayload()?.url || '';
  controls.querySelectorAll('[data-result-share]').forEach((button) => button.addEventListener('click', async () => {
    if (busy) return;
    const action = button.dataset.resultShare;
    // The normal game's optional board preference is applied separately. If it
    // needs a network update, the user clicks again after that update finishes.
    if (!beforeAction()) return;
    const payload = getPayload();
    if (!payload) return;
    const actionToken = {};
    busy = actionToken;
    const buttons = [...controls.querySelectorAll('button')];
    const disabled = buttons.map((item) => item.disabled);
    buttons.forEach((item) => { item.disabled = true; });
    const status = controls.querySelector('[data-result-share-status]');
    const say = (message) => { if (busy === actionToken && controls.isConnected) status.textContent = translate(message); };
    const record = (outcome) => { if (busy === actionToken && controls.isConnected) track(action, outcome); };
    const release = () => {
      if (busy !== actionToken) return;
      busy = null;
      releaseActive = null;
      if (controls.isConnected) buttons.forEach((item, index) => { item.disabled = disabled[index]; });
    };
    releaseActive = release;
    say('');
    record('pressed');
    try {
      if (action === 'native') {
        const outcome = await shareResult(payload);
        record(outcome);
        if (outcome === 'unavailable') say('共有先によって画像やリンクが届かない場合は、リンクをコピーするか画像を保存してください。');
      } else if (action === 'instagram-link') {
        const copied = await copyText(payload.url);
        record(copied ? 'copied' : 'failed');
        say(copied ? shareCardCopy(controls.dataset.resultShareLocale).instagramInstruction
          : 'コピーできませんでした。参加URLを長押ししてコピーしてください。');
      } else if (action === 'copy') {
        const copied = await copyText(payload.url);
        record(copied ? 'copied' : 'failed');
        say(copied ? 'コピーしました' : 'コピーできませんでした。参加URLを長押ししてコピーしてください。');
      } else if (action === 'save' || action === 'instagram') {
        if (action === 'instagram') {
          const copied = await copyText(payload.caption);
          record(copied ? 'copied' : 'failed');
          if (busy !== actionToken || !controls.isConnected) return;
          if (!copied) { say('コピーできませんでした。参加URLを長押ししてコピーしてください。'); return; }
        }
        const outcome = await saveImageBlob(dataUrlToBlob(payload.src), payload.filename, payload.title);
        record(outcome === 'downloaded' ? 'download-requested' : 'handed-off-save');
        if (action === 'instagram') say('Instagramには保存した画像を投稿し、コピーした文章を貼り付けてください。');
      } else {
        // Standard HTTPS destinations; installation and app routing belong to
        // the browser/OS, without visibility timers or guessed app packages.
        window.open(resultSocialUrl(action, payload.text), '_blank', 'noopener,noreferrer');
        record('open-requested');
      }
    } catch (error) {
      record(error?.name === 'AbortError' ? 'cancelled' : 'failed');
      if (error?.name !== 'AbortError') say(action === 'save' || action === 'instagram'
        ? '画像を保存できませんでした。もう一度お試しください。'
        : '共有先によって画像やリンクが届かない場合は、リンクをコピーするか画像を保存してください。');
    } finally {
      release();
    }
  }));
}
