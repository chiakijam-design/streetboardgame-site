import { expect, test } from './test.mjs';
import { PUBLIC_LOCALES } from '../../src/generated/public-locales.js';
import { LOCALE_DETAILS, switchLocalePath } from '../../src/i18n/locales.js';
import { readFileSync } from 'node:fs';
const oldJapaneseCards = JSON.parse(readFileSync(new URL('../../data/i18n-source-inventory.json', import.meta.url), 'utf8')).questions.japanese.slice(0, 9);

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
          const images = page.locator('img[src*="assets/"]');
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
      await expect(page).toHaveURL(/#manage=TEST_CAPABILITY$/);
      const beforeSwitch = new URL(page.url());
      const expectedPath = switchLocalePath(beforeSwitch.pathname + beforeSwitch.search + beforeSwitch.hash, target);
      await page.locator('[data-locale-switcher]').selectOption(target);
      await expect(page).toHaveURL(beforeSwitch.origin + expectedPath);
    });
    test(`${locale}: old Japanese invitation, private copy, ten answers and result PNG`, async ({ page, request }) => {
      const cards = [...oldJapaneseCards, { id: 'custom-i18n-fixture', sourceKind: 'custom', category: 'Fixture', title: 'Fixture private question', choices: ['Home', 'Next', 'Three', 'Four', 'Five'] }];
      const created = await request.post('/api/challenge/rooms', { data: { creatorName: 'Home', cards, answers: Array(10).fill(0) } });
      expect(created.status()).toBe(201);
      const { code } = await created.json();
      await page.goto(switchLocalePath('/challenge', locale) + `?room=${code}&analytics=exclude`);
      await page.locator('#participant-name').fill('Next');
      await page.locator('[data-action="join"]').click();
      for (let index = 0; index < 10; index++) {
        await expect(page.locator('.challenge-q-number')).toHaveText(`Q${index + 1}/10`);
        await expect(page.locator('[data-testid="challenge-answer-pad"]')).toBeVisible();
        if (index === 9) {
          await expect(page.locator('[data-testid="challenge-answer-pad"] [data-action="answer"]').first()).toHaveAttribute('aria-label', /Home/);
          await expect(page.locator('body')).toContainText('Fixture private question');
        }
        await page.locator('[data-testid="challenge-answer-pad"] [data-action="answer"]').first().click();
      }
      const resultImage = page.locator('[data-testid="challenge-result-image"]');
      await expect(resultImage).toBeVisible();
      await expect.poll(() => resultImage.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
      await expect(page.locator('[data-testid="challenge-result-share"]')).toBeVisible();
      await expect(page.locator('body')).toContainText('Next');
      const geometry = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      expect(geometry.scroll).toBeLessThanOrEqual(geometry.client + 1);
      const download = page.waitForEvent('download');
      await page.locator('[data-action="save-result-image"]').click();
      expect((await download).suggestedFilename()).toMatch(/\.png$/);
    });
  }
});
