import { expect, test } from './test.mjs';

async function captureAnalyticsEvents(page) {
  await page.evaluate(() => {
    window.analyticsEnabled = true;
    window.__WATACHAN_TEST_ANALYTICS_EVENTS__ = [];
    window.trackEvent = (name, params = {}) => {
      window.__WATACHAN_TEST_ANALYTICS_EVENTS__.push({ name, params });
    };
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => undefined },
    });
  });
}

async function capturedEvents(page) {
  return page.evaluate(() => window.__WATACHAN_TEST_ANALYTICS_EVENTS__ || []);
}

test.beforeEach(async ({ request }) => {
  await request.post('/__test/reset');
});

test('通常版の実プレイ操作で game_start、game_result、share が発火する', async ({ browser, page }) => {
  await page.goto('/challenge');
  await captureAnalyticsEvents(page);

  await page.locator('#creator-name').fill('計測確認');
  await page.locator('[data-action="start-create"]').click();
  for (let index = 0; index < 10; index += 1) {
    await expect(page.locator('[data-action="builder-answer"]')).toHaveCount(5);
    await page.locator('[data-action="builder-answer"]').first().click();
  }

  const copyButton = page.locator('[data-action="copy-url"]').first();
  await expect(copyButton).toBeVisible();
  const challengeUrl = await copyButton.getAttribute('data-copy-value');
  expect(challengeUrl).toMatch(/\/challenge\?room=[A-Z2-9]{8}/);
  await copyButton.click();
  await expect.poll(async () => (await capturedEvents(page)).map(({ name }) => name)).toContain('share');

  const creatorEvents = await capturedEvents(page);
  expect(creatorEvents.find(({ name }) => name === 'share')).toMatchObject({
    name: 'share',
    params: { method: 'copy', content_type: 'challenge_invite' },
  });

  const participantContext = await browser.newContext({ viewport: page.viewportSize() });
  const participant = await participantContext.newPage();
  try {
    await participant.goto(challengeUrl);
    await captureAnalyticsEvents(participant);
    await participant.locator('#participant-name').fill('回答確認');
    await participant.locator('[data-action="join"]').click();
    await expect(participant.locator('[data-action="answer"]')).toHaveCount(5);
    await expect.poll(async () => (await capturedEvents(participant)).map(({ name }) => name)).toContain('game_start');

    for (let index = 0; index < 10; index += 1) {
      await expect(participant.locator('[data-action="answer"]')).toHaveCount(5);
      await participant.locator('[data-action="answer"]').first().click();
    }
    await expect(participant.getByTestId('challenge-result-share')).toBeVisible();
    await expect.poll(async () => (await capturedEvents(participant)).map(({ name }) => name)).toContain('game_result');

    const participantEvents = await capturedEvents(participant);
    expect(participantEvents.find(({ name }) => name === 'game_start')).toMatchObject({
      params: {
        game_type: 'challenge',
        play_mode: 'async',
        player_role: 'participant',
        question_count: 10,
        replay: false,
      },
    });
    expect(participantEvents.find(({ name }) => name === 'game_result')).toMatchObject({
      params: {
        game_type: 'challenge',
        play_mode: 'async',
        player_role: 'participant',
        question_count: 10,
        score: 10,
      },
    });
  } finally {
    await participantContext.close();
  }
});
