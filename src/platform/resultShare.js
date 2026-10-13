import { copyText } from './share.js';
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

export function resultShareMarkup({ translate, escape, ready = true, saveAction = 'save-result-image', nativeLabel = '結果を共有', saveLabel = '結果画像を保存' }) {
  const t = (text) => escape(translate(text));
  return `<div data-result-share-controls>
    <button type="button" class="challenge-primary primary" data-result-share="native">${t(nativeLabel)}</button>
    <div class="challenge-result-share-buttons" data-result-share-row>
      <button type="button" class="challenge-secondary ghost" data-result-share="copy">${t('リンクをコピー')}</button>
      <button type="button" class="challenge-secondary ghost" data-result-share="save" data-action="${saveAction}" ${ready ? '' : 'disabled'}>${t(saveLabel)}</button>
    </div>
    <input type="text" readonly dir="ltr" aria-label="${t('参加URL')}" data-result-share-url>
    <p>${t('共有先によって画像やリンクが届かない場合は、リンクをコピーするか画像を保存してください。')}</p>
    <div class="challenge-result-share-buttons" data-result-share-row>
      <button type="button" class="challenge-secondary ghost" data-result-share="x" data-action="share-result-x">X</button>
      <button type="button" class="challenge-secondary ghost" data-result-share="line" data-action="share-result-line">LINE</button>
      <button type="button" class="challenge-secondary ghost" data-result-share="whatsapp">WhatsApp</button>
    </div>
    <p>${t('WhatsAppでは本文とリンクを共有します。画像は別途添付してください。')}</p>
    <details><summary>Instagram</summary>
      <p>${t('Instagramには保存した画像を投稿し、コピーした文章を貼り付けてください。')}</p>
      <button type="button" class="challenge-secondary ghost" data-result-share="instagram" data-action="share-result-instagram" ${ready ? '' : 'disabled'}>${t('ストーリー用：文章コピー＋画像保存')}</button>
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
