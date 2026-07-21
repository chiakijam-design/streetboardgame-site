export function triggerHaptic(pattern = 15, navigatorRef = globalThis.navigator) {
  try {
    if (typeof navigatorRef?.vibrate === 'function') return navigatorRef.vibrate(pattern);
  } catch {}
  return false;
}
