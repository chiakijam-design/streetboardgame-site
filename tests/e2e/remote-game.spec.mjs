import { devices, expect, test } from '@playwright/test';
import { stat } from 'node:fs/promises';

async function answerFive(page, choices, expectHandoff = true) {
  for (let index = 0; index < 5; index += 1) {
    const button = page.locator(`[data-choice="${choices[index]}"]`);
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    await button.click();
    if (index < 4) {
      await expect(page.locator('#turnTitle')).toContainText(`Q${index + 2}/5`);
    }
  }
  if (expectHandoff) await expect(page.locator('#handoff')).toBeVisible();
}

async function answerRange(page, choices, startIndex, endIndex) {
  for (let index = startIndex; index < endIndex; index += 1) {
    const button = page.locator(`[data-choice="${choices[index]}"]`);
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    await button.click();
    if (index < 4) {
      await expect(page.locator('#turnTitle')).toContainText(`Q${index + 2}/5`);
    }
  }
}

async function copyNextUrl(page) {
  await page.locator('#copyTurnUrl').click();
  await expect(page.locator('#copyTurnUrl')).toHaveText('コピーしました');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  const match = text.match(/https?:\/\/\S+/);
  expect(match, '引き継ぎURLがコピー文に含まれる').not.toBeNull();
  return match[0];
}

async function createRemoteRoom(page, creatorRole, path = '/remote') {
  await page.goto(path);
  await page.locator('#selfName').fill('テストA');
  await page.locator('#otherName').fill('テストB');
  await page.locator('#creatorRole').selectOption(creatorRole);
  await page.locator('#createRoom').click();
  await expect(page.locator('#roomCode')).toHaveText(/^\d{6}$/);
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

for (const creatorRole of ['target', 'guesser']) {
  test(`遠隔版 ${creatorRole}先行: 0〜5点・2端末・役割交代`, async ({ browser, page }) => {
    for (let score = 0; score <= 5; score += 1) {
      await createRemoteRoom(page, creatorRole);
      const guessAnswers = Array.from({ length: 5 }, (_, index) => index < score ? 0 : 1);
      const creatorAnswers = creatorRole === 'target' ? [0, 0, 0, 0, 0] : guessAnswers;
      await answerFive(page, creatorAnswers);
      const nextUrl = await copyNextUrl(page);
      if (score === 0) {
        const normalInviteText = await page.evaluate(() => navigator.clipboard.readText());
        expect(normalInviteText).not.toContain('ボドゲ');
      }

      const secondContext = await browser.newContext();
      await secondContext.grantPermissions(['clipboard-read', 'clipboard-write']);
      const second = await secondContext.newPage();
      await second.goto(nextUrl);
      const secondAnswers = creatorRole === 'target' ? guessAnswers : [0, 0, 0, 0, 0];
      await answerFive(second, secondAnswers, false);

      await expect(second.locator('#score')).toHaveText(`${score}/5`);
      await expect(second.locator('#answerDetails .answer-row')).toHaveCount(5);
      await expect(second.locator('#resultReview')).toBeVisible();
      await expect(second.locator('#shareResultLine')).toBeVisible();
      if (score === 0) {
        const productCard = second.getByTestId('amazon-product-card');
        await expect(productCard).toBeVisible();
        await expect(productCard).toHaveAttribute('href', 'https://www.amazon.co.jp/dp/B0G87M4ZYK');
        await expect(productCard).toHaveAttribute('target', '_blank');
        await expect(productCard).toHaveAttribute('rel', /sponsored/);
        await expect(productCard).toContainText('Amazonアフィリエイトを利用しています');
      }

      const answerLayout = await second.locator('#answerDetails .answer-pick').evaluateAll((picks) => picks.map((pick) => {
        const name = pick.querySelector('.answer-name').getBoundingClientRect();
        const choice = pick.querySelector('.answer-choice').getBoundingClientRect();
        const dot = pick.querySelector('.answer-mini-dot').getBoundingClientRect();
        return {
          nameBeforeChoice: name.bottom <= choice.top + 1,
          dotCenterOffset: Math.abs((dot.top + dot.height / 2) - (choice.top + choice.height / 2)),
        };
      }));
      expect(answerLayout.every(({ nameBeforeChoice, dotCenterOffset }) => nameBeforeChoice && dotCenterOffset <= 1)).toBe(true);

      if (score === 3) {
        await second.locator('#replaySwapRoles').click();
        await expect(second.locator('#score')).toBeHidden();
        await expect(second.locator('#turnTitle')).toContainText('Q1/5');
      }
      await secondContext.close();
    }
  });

  test(`遠隔版 ${creatorRole}先行: 中断後に同じ問題から再開できる`, async ({ browser, context, page }) => {
    await createRemoteRoom(page, creatorRole);
    const targetAnswers = [0, 1, 2, 3, 4];
    const guessAnswers = [0, 1, 0, 3, 0];
    const creatorAnswers = creatorRole === 'target' ? targetAnswers : guessAnswers;

    await answerRange(page, creatorAnswers, 0, 2);
    const creatorResumeUrl = page.url();
    await page.close();

    const resumedCreator = await context.newPage();
    await resumedCreator.goto(creatorResumeUrl);
    await expect(resumedCreator.locator('#turnTitle')).toContainText('Q3/5');
    await expect(resumedCreator.locator(`[data-choice="${creatorAnswers[2]}"]`)).toBeEnabled();
    await answerRange(resumedCreator, creatorAnswers, 2, 5);
    await expect(resumedCreator.locator('#handoff')).toBeVisible();
    const nextUrl = await copyNextUrl(resumedCreator);

    const secondContext = await browser.newContext();
    await secondContext.grantPermissions(['clipboard-read', 'clipboard-write']);
    let second = await secondContext.newPage();
    await second.goto(nextUrl);
    const secondAnswers = creatorRole === 'target' ? guessAnswers : targetAnswers;
    await answerRange(second, secondAnswers, 0, 2);
    const secondResumeUrl = second.url();
    await second.close();

    second = await secondContext.newPage();
    await second.goto(secondResumeUrl);
    await expect(second.locator('#turnTitle')).toContainText('Q3/5');
    await expect(second.locator(`[data-choice="${secondAnswers[2]}"]`)).toBeEnabled();
    await answerRange(second, secondAnswers, 2, 5);
    await expect(second.locator('#score')).toHaveText('3/5');
    await expect(second.locator('#answerDetails .answer-row')).toHaveCount(5);

    const resultUrl = second.url();
    await second.close();
    second = await secondContext.newPage();
    await second.goto(resultUrl);
    await expect(second.locator('#score')).toHaveText('3/5');
    await expect(second.locator('#answerDetails .answer-row')).toHaveCount(5);
    await expect(second.locator('#resultReview')).toBeVisible();
    await secondContext.close();
  });
}

for (const creatorRole of ['target', 'guesser']) {
  test(`ボドゲ仲間の遠隔版 ${creatorRole}先行: 2端末で回答・結果・再プレイ`, async ({ browser, page }, testInfo) => {
    await createRemoteRoom(page, creatorRole, '/remote-boardgame');
    const questionCard = page.locator('.boardgame-question-card');
    await expect(questionCard).toBeVisible();
    await expect(questionCard.locator('.boardgame-question-title')).not.toBeEmpty();
    await expect(questionCard.locator('.boardgame-card-choice')).toHaveCount(5);
    await expect(page.locator('[data-choice]')).toHaveCount(5);
    await expect(page.locator('[data-choice]').first()).toHaveText('緑');
    const answerLayout = await page.evaluate(() => {
      const card = document.querySelector('.boardgame-question-card').getBoundingClientRect();
      return {
        aspectRatio: card.width / card.height,
        cardWidth: card.width,
        titleFont: getComputedStyle(document.querySelector('.boardgame-question-title')).fontFamily,
        choiceFont: getComputedStyle(document.querySelector('.boardgame-card-choice')).fontFamily,
        titleWeight: getComputedStyle(document.querySelector('.boardgame-question-title')).fontWeight,
        choiceWeight: getComputedStyle(document.querySelector('.boardgame-card-choice')).fontWeight,
        svgViewBox: document.querySelector('.boardgame-question-card svg').getAttribute('viewBox'),
        localFontLoaded: document.fonts.check('400 16px "HuiFontP29"'),
      };
    });
    expect(Math.abs(answerLayout.aspectRatio - (756 / 1122))).toBeLessThan(0.02);
    expect(answerLayout.cardWidth).toBeLessThanOrEqual(300);
    expect(answerLayout.titleFont).toContain('HuiFontP29');
    expect(answerLayout.choiceFont).toContain('HuiFontP29');
    expect(answerLayout.titleWeight).toBe('400');
    expect(answerLayout.choiceWeight).toBe('400');
    expect(answerLayout.svgViewBox).toBe('0 0 756 1122');
    expect(answerLayout.localFontLoaded).toBe(true);
    await expect.poll(() => page.evaluate(() => {
      const card = document.querySelector('.boardgame-question-card').getBoundingClientRect();
      const controls = document.querySelector('#choices').getBoundingClientRect();
      return card.bottom <= controls.top;
    })).toBe(true);

    await answerFive(page, [0, 1, 2, 3, 4]);
    const nextUrl = await copyNextUrl(page);
    const boardgameInviteText = await page.evaluate(() => navigator.clipboard.readText());
    expect(boardgameInviteText).toContain('ボドゲ');
    expect(boardgameInviteText).toContain('5問');
    expect(boardgameInviteText).toContain(creatorRole === 'target' ? 'ボドゲ仲間の絆判定' : 'ボドゲの好み');
    expect(new URL(nextUrl).pathname).toBe('/remote-boardgame');

    const secondContext = await browser.newContext();
    await secondContext.grantPermissions(['clipboard-read', 'clipboard-write']);
    const second = await secondContext.newPage();
    await second.goto(nextUrl);
    await expect(second.locator('h1')).toContainText('ボドゲ仲間の絆判定');
    await answerFive(second, [0, 1, 2, 3, 4], false);

    await expect(second.locator('#score')).toHaveText('5/5');
    await expect(second.locator('#resultGameTitle')).toHaveText('ボドゲ仲間の絆判定');
    await expect(second.locator('#resultTitle')).toHaveText('公認・ボドゲ仲間マスター');
    await expect(second.locator('#answerDetails .answer-row')).toHaveCount(5);

    if (testInfo.project.name !== 'mobile-chrome') {
      await second.evaluate(() => {
        window.open = (url) => {
          window.__boardgameXShareUrl = String(url);
          return null;
        };
      });
      await second.locator('#shareResultX').click();
      const xShareUrl = await second.evaluate(() => window.__boardgameXShareUrl);
      const xShareText = new URL(xShareUrl).searchParams.get('text');
      expect(xShareText).toContain('/remote-boardgame?room=');
      expect(xShareText).toContain('&result=1&share=result-20260724-1');
    }

    await second.locator('#replaySameRoom').click();
    await expect(second.locator('#score')).toBeHidden();
    await expect(second.locator('.boardgame-question-card')).toBeVisible();
    await secondContext.close();
  });
}

test('遠隔プレイの結果画像はPC・スマホで保存できる', async ({ browser, page }, testInfo) => {
  await createRemoteRoom(page, 'target');
  await answerFive(page, [0, 0, 0, 0, 0]);
  const nextUrl = await copyNextUrl(page);
  const isMobile = testInfo.project.name === 'mobile-chrome';
  const secondContext = await browser.newContext(isMobile ? devices['Pixel 7'] : {});
  if (isMobile) {
    await secondContext.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', {
        configurable: true,
        value: () => true,
      });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async ({ files, title }) => {
          window.__sharedResultImage = {
            title,
            files: files?.map(({ name, size, type }) => ({ name, size, type })),
          };
        },
      });
    });
  }
  const second = await secondContext.newPage();
  await second.goto(nextUrl);
  await answerFive(second, [0, 0, 0, 1, 1], false);
  await expect(second.locator('#score')).toHaveText('3/5');
  const saveButton = second.locator('#saveResultImage');
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeEnabled();

  if (isMobile) {
    await saveButton.click();
    await expect.poll(() => second.evaluate(() => window.__sharedResultImage)).toMatchObject({
      files: [{
        name: 'watachan-love-result-3-5.png',
        type: 'image/png',
      }],
    });
    expect(await second.evaluate(() => window.__sharedResultImage.files[0].size)).toBeGreaterThan(1_000);
  } else {
    const [download] = await Promise.all([
      second.waitForEvent('download'),
      saveButton.click(),
    ]);
    expect(download.suggestedFilename()).toBe('watachan-love-result-3-5.png');
    expect((await stat(await download.path())).size).toBeGreaterThan(1_000);
  }

  await secondContext.close();
});

test('ボドゲ仲間の遠隔結果画像はPC・スマホで保存できる', async ({ browser, page }, testInfo) => {
  await createRemoteRoom(page, 'target', '/remote-boardgame');
  await answerFive(page, [0, 0, 0, 0, 0]);
  const nextUrl = await copyNextUrl(page);
  const isMobile = testInfo.project.name === 'mobile-chrome';
  const secondContext = await browser.newContext(isMobile ? devices['Pixel 7'] : {});
  if (isMobile) {
    await secondContext.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async ({ files, title }) => {
          window.__sharedResultImage = {
            title,
            files: files?.map(({ name, size, type }) => ({ name, size, type })),
          };
        },
      });
    });
  }
  const second = await secondContext.newPage();
  await second.goto(nextUrl);
  await answerFive(second, [0, 0, 0, 1, 1], false);
  const saveButton = second.locator('#saveResultImage');
  if (isMobile) {
    await saveButton.click();
    await expect.poll(() => second.evaluate(() => window.__sharedResultImage)).toMatchObject({
      files: [{ name: 'watachan-boardgame-remote-result-3-5.png', type: 'image/png' }],
    });
  } else {
    const [download] = await Promise.all([second.waitForEvent('download'), saveButton.click()]);
    expect(download.suggestedFilename()).toBe('watachan-boardgame-remote-result-3-5.png');
    expect((await stat(await download.path())).size).toBeGreaterThan(1_000);
  }
  await secondContext.close();
});
