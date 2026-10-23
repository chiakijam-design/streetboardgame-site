import { expect, test } from './test.mjs';
test('historical purchase management remains noindex and authenticated', async ({ request }) => {
  const page = await request.get('/live-ops');
  expect(page.status()).toBe(200);
  expect(page.headers()['x-robots-tag']).toContain('noindex');
  expect(page.headers()['cache-control']).toBe('no-store');
  const history = await request.get('/api/live/admin/overview');
  expect([401, 403, 503]).toContain(history.status());
  expect(history.status()).not.toBe(410);
});
