export function isMobileLike(navigatorRef = globalThis.navigator, windowRef = globalThis.window) {
  const ua = navigatorRef?.userAgent || '';
  const coarse = windowRef?.matchMedia?.('(pointer: coarse)')?.matches;
  return /iPhone|iPad|iPod|Android|Mobile/i.test(ua) || Boolean(coarse);
}

export function shouldUseNativeShare(navigatorRef = globalThis.navigator, windowRef = globalThis.window) {
  return Boolean(navigatorRef?.share) && isMobileLike(navigatorRef, windowRef);
}

export function openLineShare(message, { windowRef = globalThis.window, navigatorRef = globalThis.navigator } = {}) {
  const encoded = encodeURIComponent(message);
  const href = isMobileLike(navigatorRef, windowRef)
    ? `line://msg/text/${encoded}`
    : `https://line.me/R/msg/text/?${encoded}`;
  if (windowRef?.location) windowRef.location.href = href;
  return href;
}

export function openXShare(message, { windowRef = globalThis.window, navigatorRef = globalThis.navigator, documentRef = globalThis.document } = {}) {
  const encoded = encodeURIComponent(message);
  const webUrl = `https://x.com/intent/post?text=${encoded}`;
  const ua = navigatorRef?.userAgent || '';
  const isIos = /iPhone|iPad|iPod/i.test(ua)
    || (navigatorRef?.platform === 'MacIntel' && Number(navigatorRef?.maxTouchPoints || 0) > 1);

  if (isIos && windowRef?.location) {
    let appOpened = false;
    const detectAppOpen = () => {
      if (documentRef?.hidden) appOpened = true;
    };
    documentRef?.addEventListener?.('visibilitychange', detectAppOpen);
    windowRef.location.href = `twitter://post?message=${encoded}`;
    windowRef.setTimeout?.(() => {
      documentRef?.removeEventListener?.('visibilitychange', detectAppOpen);
      if (!appOpened && !documentRef?.hidden) windowRef.location.href = webUrl;
    }, 1400);
    return webUrl;
  }

  if (/Android/i.test(ua) && windowRef?.location) {
    const fallback = encodeURIComponent(webUrl);
    windowRef.location.href = `intent://post?message=${encoded}#Intent;scheme=twitter;package=com.twitter.android;S.browser_fallback_url=${fallback};end`;
    return webUrl;
  }

  windowRef?.open?.(webUrl, '_blank', 'noopener,noreferrer,width=600,height=500');
  return webUrl;
}

export async function copyText(text, { navigatorRef = globalThis.navigator, documentRef = globalThis.document } = {}) {
  if (navigatorRef?.clipboard?.writeText) {
    try {
      await navigatorRef.clipboard.writeText(text);
      return true;
    } catch {}
  }
  if (!documentRef?.createElement) return false;
  const textarea = documentRef.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  documentRef.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = documentRef.execCommand('copy');
  } catch {}
  documentRef.body.removeChild(textarea);
  return copied;
}

export async function shareFiles({ files, title, text, url }, navigatorRef = globalThis.navigator) {
  if (!navigatorRef?.share) return false;
  if (files?.length && navigatorRef.canShare && !navigatorRef.canShare({ files })) return false;
  await navigatorRef.share({ title, text, url, ...(files?.length ? { files } : {}) });
  return true;
}
