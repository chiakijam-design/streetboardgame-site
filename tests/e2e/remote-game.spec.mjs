import { expect, test } from '@playwright/test';

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

async function createRemoteRoom(page, creatorRole) {
  await page.goto('/remote');
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
