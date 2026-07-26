import { expect, test } from './test.mjs';

const publicRoutes = ['/', '/challenge', '/live-challenge', '/404.html'];
const legalRoutes = [
  '/terms',
  '/privacy',
  '/legal',
  '/creator-terms',
  '/refund-policy',
  '/content-guidelines',
  '/minor-policy',
];

test('公開ゲーム画面は本文14px・補足12px・ボタン16px・タップ領域44px以上を守る', async ({ page }) => {
  for (const route of publicRoutes) {
    await page.goto(route);
    const audit = await page.evaluate(() => {
      const visible = (element) => {
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      };
      const supplementSelector = [
        'small',
        '.help',
        '.note',
        '.meta',
        '.eyebrow',
        '.badge',
        '.pill',
        '.hint',
        '.caption',
        '.disclaimer',
        '.challenge-note',
        '.challenge-builder-help',
        '.challenge-pill',
        '.challenge-q-number',
        '.footer',
      ].join(',');
      const buttonSelector = [
        'button',
        '[role="button"]',
        'input[type="button"]',
        'input[type="submit"]',
        'input[type="reset"]',
        '.button',
        '.btn',
        '.primary',
        '.secondary',
        '.danger',
        '.mini',
        '.tab',
        '.challenge-primary',
        '.challenge-secondary',
        '.challenge-share',
      ].join(',');
      const tapTargetSelector = [
        buttonSelector,
        '.home-link',
        '.back',
        '.challenge-top a',
        '.challenge-feature-nav a',
        'label:has(input[type="checkbox"])',
        'label:has(input[type="radio"])',
      ].join(',');

      const normalCopy = [...document.querySelectorAll('p,li,label,summary,td,th,dd,dt')]
        .filter(visible)
        .filter((element) => !element.matches(supplementSelector)
          && !element.closest(supplementSelector))
        .map((element) => ({
          text: element.textContent.trim().slice(0, 50),
          fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
        }));
      const supplements = [...document.querySelectorAll(supplementSelector)]
        .filter(visible)
        .map((element) => ({
          text: element.textContent.trim().slice(0, 50),
          fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
        }));
      const buttons = [...document.querySelectorAll(buttonSelector)]
        .filter(visible)
        .map((element) => ({
          text: (element.textContent || element.value || '').trim().slice(0, 50),
          fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
          height: element.getBoundingClientRect().height,
        }));
      const tapTargets = [...document.querySelectorAll(tapTargetSelector)]
        .filter(visible)
        .map((element) => ({
          text: (element.textContent || element.value || '').trim().slice(0, 50),
          height: element.getBoundingClientRect().height,
        }));

      return {
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
        normalCopy: normalCopy.filter((item) => item.fontSize < 14),
        supplements: supplements.filter((item) => item.fontSize < 12),
        buttons: buttons.filter((item) => item.fontSize < 15.5),
        tapTargets: tapTargets.filter((item) => item.height < 44),
      };
    });

    expect(audit, route).toEqual({
      horizontalOverflow: false,
      normalCopy: [],
      supplements: [],
      buttons: [],
      tapTargets: [],
    });
  }
});

test('すべての法務ページに子ども向け要約と正式本文優先の注記がある', async ({ page }) => {
  for (const route of legalRoutes) {
    await page.goto(route);
    const summary = page.locator('.kids-summary');
    await expect(summary).toBeVisible();
    await expect(summary.getByRole('heading', { level: 2 })).toHaveText('子ども向け かんたんまとめ');
    expect(await summary.locator('li').count()).toBeGreaterThanOrEqual(3);
    await expect(summary.locator('.kids-summary-note')).toContainText('本文が優先されます');

    const geometry = await summary.evaluate((element) => ({
      fontSize: Number.parseFloat(getComputedStyle(element.querySelector('li')).fontSize),
      noteFontSize: Number.parseFloat(getComputedStyle(element.querySelector('.kids-summary-note')).fontSize),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    }));
    expect(geometry, route).toEqual({
      fontSize: 14,
      noteFontSize: 12,
      horizontalOverflow: false,
    });
  }
});
