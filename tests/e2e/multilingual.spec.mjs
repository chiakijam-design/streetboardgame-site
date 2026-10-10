import { expect, test } from './test.mjs';
import { PUBLIC_LOCALES } from '../../src/generated/public-locales.js';
import { LOCALE_DETAILS, switchLocalePath } from '../../src/i18n/locales.js';

const ready = PUBLIC_LOCALES.length === 34;
test.describe('completed multilingual release', () => {
  test.skip(!ready, 'All catalogs must pass strict packaging before multilingual runtime checks run.');
  for (const locale of PUBLIC_LOCALES) {
    test(`${locale}: public HTML, navigation, mobile width and both game entries`, async ({ page, request }) => {
      const prefix = LOCALE_DETAILS[locale].prefix;
      for (const path of ['/', '/challenge', '/live-challenge']) {
        const route = switchLocalePath(path, locale);
        const response = await page.goto(route + '?analytics=exclude');
        expect(response?.status()).toBe(200);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        if (locale !== 'ja') await expect(page.locator('html')).toHaveAttribute('dir', LOCALE_DETAILS[locale].direction);
        await expect(page.locator('[data-locale-switcher]')).toBeVisible();
        await expect(page.locator('[data-locale-switcher] option')).toHaveCount(34);
        await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(35);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.streetboardgame.com' + route);
        const geometry = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
        expect(geometry.scroll, route).toBeLessThanOrEqual(geometry.client + 1);
        if (path === '/') {
          const images = page.locator('img[src*="/assets/"]');
          await expect(images.first()).toBeVisible();
          await expect.poll(() => images.evaluateAll((elements) => elements.filter((image) => !image.complete || image.naturalWidth === 0).length)).toBe(0);
          const titleLines = page.locator('[data-testid="top-rules-title-line"]');
          expect(await titleLines.evaluateAll((elements) => elements.every((element) => element.scrollWidth <= element.clientWidth + 1))).toBe(true);
        }
        if (!['ja', 'en'].includes(locale)) {
          expect(await page.evaluate(() => window.analyticsEnabled)).toBe(false);
        }
      }
      for (const path of ['/challenge/library', '/challenge-guide', '/about', '/product', '/terms', '/privacy']) {
        const response = await request.get(prefix + path);
        expect(response.status(), prefix + path).toBe(200);
        const html = await response.text();
        expect(html).toContain(`lang="${locale}"`);
        expect(html).toContain('rel="canonical" href="https://www.streetboardgame.com' + prefix + path + '"');
      }
      await page.goto(prefix + '/challenge?room=TEST_COMPAT#manage=TEST_CAPABILITY');
      const target = locale === 'ja' ? 'ar' : 'ja';
      await page.locator('[data-locale-switcher]').selectOption(target);
      await expect(page).toHaveURL(new RegExp(`${LOCALE_DETAILS[target].prefix}/challenge\\?room=TEST_COMPAT#manage=TEST_CAPABILITY$`));
    });
  }
});
