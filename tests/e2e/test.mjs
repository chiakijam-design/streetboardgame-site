import { expect, test as base } from '@playwright/test';

export function isGoogleAnalyticsRequest(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === 'www.googletagmanager.com'
      || hostname === 'googletagmanager.com'
      || hostname === 'www.google-analytics.com'
      || hostname === 'google-analytics.com'
      || hostname.endsWith('.google-analytics.com');
  } catch {
    return false;
  }
}

export const test = base.extend({
  analyticsBlocker: [async ({ context }, use) => {
    const state = { blockedRequests: 0 };
    const routeHandler = async (route) => {
      if (isGoogleAnalyticsRequest(route.request().url())) {
        state.blockedRequests += 1;
        await route.abort('blockedbyclient');
        return;
      }
      await route.continue();
    };

    await context.route('**/*', routeHandler);
    await use(state);
    await context.unroute('**/*', routeHandler);
  }, { auto: true }],
});

export { expect };
