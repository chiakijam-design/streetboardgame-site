import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from './test.mjs';
import { challengeCompletionCopy } from '../../src/i18n/challenge-completion-copy.js';

const evidenceRoot = path.resolve('..', 'WATA-BUTTON-ORDER-EVIDENCE');
const baseline = process.env.ACTION_ORDER_BASELINE === '1';
const compareBaseline = process.env.ACTION_ORDER_COMPARE === '1';

for (const locale of ['ja', 'en', 'ar']) {
  test(`${locale}: finish and custom question retain appearance and follow keyboard/visual order`, async ({ page, request }, testInfo) => {
    await request.post('/__test/reset');
    await page.goto('/challenge?analytics=exclude');
    // The preference persists; navigate without its one-time notice obscuring controls.
    await page.goto(`${locale === 'ja' ? '' : '/' + locale}/challenge`);
    await page.locator('#creator-name').fill('Order Test');
    await page.locator('[data-action="start-create"]').click();
    const finish = page.locator('[data-action="finish-early"]');
    const custom = page.locator('[data-action="custom-question"]');
    await expect(finish).toBeDisabled();
    await page.locator('[data-action="builder-answer"]').first().click();
    await expect(page.locator('.challenge-q-number')).toHaveText('Q2/10');
    await expect(finish).toBeEnabled();
    const completion = challengeCompletionCopy(locale, 1);
    await expect(finish).toHaveText(completion.label);
    await expect(finish).not.toContainText('1/10');
    await expect(finish).toHaveAttribute('aria-describedby', 'challenge-finish-help');
    await expect(page.getByTestId('challenge-finish-help')).toHaveText(completion.help);
    const appearance = await page.locator('[data-action="skip-question"], [data-action="edit-question"], [data-action="custom-question"], [data-action="finish-early"]').evaluateAll(elements => Object.fromEntries(elements.map(el => {
      const style = getComputedStyle(el), rect = el.getBoundingClientRect();
      return [el.dataset.action, {text: el.textContent.trim(), width: rect.width, height: rect.height, color: style.color, background: style.backgroundColor, border: style.border, radius: style.borderRadius, font: style.font, padding: style.padding, minHeight: style.minHeight}];
    })));
    await fs.mkdir(evidenceRoot, {recursive: true});
    const key = `${testInfo.project.name}-${locale}`;
    const appearancePath = path.join(evidenceRoot, `${key}-baseline.json`);
    if (baseline) {
      await fs.writeFile(appearancePath, JSON.stringify(appearance, null, 2));
    } else {
      if (compareBaseline) {
        const before = JSON.parse(await fs.readFile(appearancePath, 'utf8'));
        // Wording may wrap; verify that the actual button styling is unchanged.
        for (const action of Object.keys(appearance)) {
          const {text, height, ...style} = appearance[action];
          const {text: oldText, height: oldHeight, ...oldStyle} = before[action];
          expect(style).toEqual(oldStyle);
          expect(height).toBeGreaterThanOrEqual(44);
        }
      }
      const sequence = await page.locator('[data-action="skip-question"], [data-action="edit-question"], [data-action="finish-early"], [data-action="custom-question"]').evaluateAll(elements => elements.map(el => el.dataset.action));
      expect(sequence).toEqual(['skip-question', 'edit-question', 'finish-early', 'custom-question']);
      const finishBox = await finish.boundingBox(), customBox = await custom.boundingBox();
      expect(finishBox.y + finishBox.height).toBeLessThanOrEqual(customBox.y);
      await finish.focus();
      await page.keyboard.press('Tab');
      await expect(custom).toBeFocused();
      await custom.click();
      await expect(page.getByTestId('challenge-question-edit-form')).toBeVisible();
      await page.locator('[data-action="cancel-question-edit"]').click();
      await finish.click();
      await expect(page.locator('[data-action="confirm-finish"]')).toHaveText(completion.label);
      await expect(page.getByTestId('finish-quiz-confirmation')).not.toContainText('1/10');
      await page.locator('[data-action="cancel-finish"]').click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({path: baseline || compareBaseline
      ? path.join(evidenceRoot, `${key}-${baseline ? 'before' : 'after'}.png`)
      : testInfo.outputPath('action-order.png'), fullPage: true});
  });
}
