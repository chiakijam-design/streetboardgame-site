export function navigateTo(url, windowRef = globalThis.window) {
  if (!windowRef?.location) return false;
  windowRef.location.href = url;
  return true;
}

export function replaceWith(url, windowRef = globalThis.window) {
  if (!windowRef?.location?.replace) return false;
  windowRef.location.replace(url);
  return true;
}

export function scrollToTop(windowRef = globalThis.window, behavior = 'auto') {
  windowRef?.scrollTo?.({ top: 0, left: 0, behavior });
}

export function currentUrl(windowRef = globalThis.window) {
  return windowRef?.location?.href || '';
}
