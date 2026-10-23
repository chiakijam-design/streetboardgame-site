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
      value: { writeText: async text => { window.__WATACHAN_TEST_COPIED_TEXT__ = text; } },
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
  await page.goto('/challenge?analytics=exclude');
  expect(await page.evaluate(() => localStorage.getItem('watachan:analytics-excluded:v1'))).toBe('1');
  expect(await page.evaluate(() => window.analyticsEnabled)).toBe(false);
  // Capture semantic events locally; this spy never sends analytics requests.
  await captureAnalyticsEvents(page);

  await page.locator('#creator-name').fill('計測確認');
  await page.locator('[data-action="start-create"]').click();
  expect((await capturedEvents(page)).filter(({ name }) => name === 'game_play')).toHaveLength(0);
  for (let index = 0; index < 10; index += 1) {
    await expect(page.locator('[data-action="builder-answer"]')).toHaveCount(10);
    await page.locator('[data-action="builder-answer"]').first().click();
  }

  const shareControls = page.locator('[data-result-share-controls]');
  const copyButton = shareControls.getByRole('button', { name: 'リンクをコピー', exact: true });
  await expect(copyButton).toBeVisible();
  const challengeUrl = await shareControls.locator('[data-result-share-url]').inputValue();
  const invitation = new URL(challengeUrl);
  expect(invitation.pathname).toBe('/challenge');
  expect([...invitation.searchParams.keys()]).toEqual(['room']);
  expect(invitation.searchParams.get('room')).toMatch(/^[A-Z2-9]{8}$/);
  expect(invitation.hash).toBe('');
  await copyButton.click();
  expect(await page.evaluate(() => window.__WATACHAN_TEST_COPIED_TEXT__)).toBe(challengeUrl);
  await expect.poll(async () => (await capturedEvents(page)).map(({ name }) => name)).toContain('share');

  const creatorEvents = await capturedEvents(page);
  expect(creatorEvents.filter(({ name }) => name === 'game_play')).toEqual([{
    name: 'game_play',
    params: { game_type: 'challenge', play_mode: 'async', player_role: 'creator', play_criteria: 'accepted_answer' },
  }]);
  const inviteEvents = creatorEvents.filter(({ name }) => name === 'share');
  expect(inviteEvents).toEqual([{
    name: 'share',
    params: { method: 'copy', content_type: 'challenge_invite', item_id: 'challenge_invite', game_type: 'challenge', play_mode: 'async' },
  }]);
  expect(JSON.stringify(inviteEvents)).not.toContain(invitation.searchParams.get('room'));
  expect(JSON.stringify(inviteEvents)).not.toContain('計測確認');
  const eventCount = creatorEvents.length;
  await page.evaluate(() => { window.analyticsEnabled = false; });
  await copyButton.click();
  expect(await page.evaluate(() => window.__WATACHAN_TEST_COPIED_TEXT__)).toBe(challengeUrl);
  expect(await capturedEvents(page)).toHaveLength(eventCount);
  await page.evaluate(() => {
    window.analyticsEnabled = true;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('blocked'); } } });
    document.execCommand = () => false;
  });
  await copyButton.click();
  await expect(shareControls.locator('[data-result-share-status]')).toContainText('コピーできませんでした');
  expect(await capturedEvents(page)).toHaveLength(eventCount);

  const participantContext = await browser.newContext({ viewport: page.viewportSize() });
  const participant = await participantContext.newPage();
  try {
    await participant.goto(challengeUrl + '&analytics=exclude');
    await captureAnalyticsEvents(participant);
    await participant.locator('#participant-name').fill('回答確認');
    await participant.locator('[data-action="join"]').click();
    await expect(participant.locator('[data-action="answer"]')).toHaveCount(10);
    await expect.poll(async () => (await capturedEvents(participant)).map(({ name }) => name)).toContain('game_start');

    expect((await capturedEvents(participant)).filter(({ name }) => name === 'game_play')).toHaveLength(0);
    await participant.route('**/api/challenge/rooms/*/answer', (route) => route.fulfill({
      status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'test-answer-rejected' }),
    }), { times: 1 });
    await participant.locator('[data-action="answer"]').first().click();
    await expect(participant.getByRole('alert')).toBeVisible();
    expect((await capturedEvents(participant)).filter(({ name }) => name === 'game_play')).toHaveLength(0);

    for (let index = 0; index < 10; index += 1) {
      await expect(participant.locator('[data-action="answer"]')).toHaveCount(10);
      await participant.locator('[data-action="answer"]').first().click();
    }
    await expect(participant.getByTestId('challenge-result-share')).toBeVisible();
    await expect.poll(async () => (await capturedEvents(participant)).map(({ name }) => name)).toContain('game_result');

    const participantEvents = await capturedEvents(participant);
    expect(participantEvents.filter(({ name }) => name === 'game_play')).toEqual([{
      name: 'game_play',
      params: { game_type: 'challenge', play_mode: 'async', player_role: 'participant', play_criteria: 'accepted_answer' },
    }]);
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
