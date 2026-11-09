// Test-only browser-context firewall. Never deploy this as a user tracking rule.
export function isGoogleAnalyticsRequest(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === 'googletagmanager.com' || host.endsWith('.googletagmanager.com')
      || host === 'google-analytics.com' || host.endsWith('.google-analytics.com');
  } catch { return false; }
}

export function blockedTestRequestReason(value) {
  let url;
  try { url = new URL(value); } catch { return ''; }
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) return '';
  const host = url.hostname.toLowerCase();
  if (['streetboardgame.com', 'www.streetboardgame.com'].includes(host)) return 'live-wata';
  if (isGoogleAnalyticsRequest(value)) return 'google-analytics';
  if (host === 'clarity.ms' || host.endsWith('.clarity.ms')
    || (host === 'c.bing.com' && url.pathname === '/c.gif')) return 'clarity';
  if (host === 'cloudflareinsights.com' || host.endsWith('.cloudflareinsights.com')) return 'cloudflare-rum';
  if (host === 'googlesyndication.com' || host.endsWith('.googlesyndication.com')
    || host === 'doubleclick.net' || host.endsWith('.doubleclick.net')
    || host === 'fundingchoicesmessages.google.com') return 'ads-or-cmp';
  return ['127.0.0.1','localhost','[::1]'].includes(host) ? '' : 'external-test-network';
}

export async function installTestNetworkGuard(context) {
  const state = { blockedRequests: 0, blockedWebSockets: 0, reasons: {} };
  function count(reason) { state.reasons[reason] = (state.reasons[reason] || 0) + 1; }
  const handler = async route => {
    const reason = blockedTestRequestReason(route.request().url());
    if (reason) {
      state.blockedRequests++; count(reason);
      return route.abort('blockedbyclient');
    }
    // Preserve other isolation/stub routes rather than bypassing them.
    return route.fallback();
  };
  await context.route('**/*', handler);
  await context.routeWebSocket(value => Boolean(blockedTestRequestReason(String(value))), socket => {
    state.blockedWebSockets++;
    socket.close();
  });
  // Playwright owns/closes this context, including its WebSocket routes.
  return { state, dispose: () => context.unroute('**/*', handler) };
}

// Extra participant/guest contexts do not inherit the standard page fixture.
// Register the firewall before returning any newly created context to a test.
export async function createIsolatedContext(browser, options = {}) {
  const context = await browser.newContext({ ...options, serviceWorkers: 'block' });
  try { await installTestNetworkGuard(context); return context; }
  catch (error) { await context.close(); throw error; }
}
