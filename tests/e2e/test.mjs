import { expect, test as base } from '@playwright/test';
import { installTestNetworkGuard, isGoogleAnalyticsRequest } from '../helpers/test-network-guard.mjs';
export { isGoogleAnalyticsRequest };

export const test = base.extend({
  // A service worker must not bypass the context's route interception.
  serviceWorkers: 'block',
  analyticsBlocker: [async ({ context }, use) => {
    const guard = await installTestNetworkGuard(context);
    try { await use(guard.state); } finally { await guard.dispose(); }
  }, { auto: true }],
});
export { expect };
