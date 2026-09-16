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

for (const transport of ['http', 'websocket']) {
  test(`LIVE ${transport}: accepted answers, not entry or rejected votes, count as play`, async ({ page }) => {
    const token = 'a'.repeat(48);
    const game = {
      mode: 'stream-challenge', phase: 'voting', subjectName: 'Host', participantName: 'Viewer',
      currentQuestionIndex: 0, questionCount: 10, participantCount: 1, participantLimit: 1000,
      realtime: transport === 'websocket', showVoteCount: false,
      question: { id: 'question-1', text: 'Question 1', options: ['A', 'B', 'C', 'D', 'E'],
        subjectAnswered: false, voteCount: 0, voteCounts: [0, 0, 0, 0, 0], result: null },
      results: [],
    };
    await page.addInitScript(({ token }) => {
      sessionStorage.setItem('live-challenge:123456', JSON.stringify({ token, name: 'Viewer' }));
    }, { token });
    await page.route('**/api/live/games/123456', route => route.fulfill({
      json: { code: '123456', game },
    }));
    let answerCount = 0;
    let socketRoute;
    if (transport === 'websocket') {
      await page.routeWebSocket('**/api/live/games/123456/socket', socket => {
        socketRoute = socket;
        socket.onMessage(raw => {
          const message = JSON.parse(String(raw));
          if (message.type !== 'vote') return;
          answerCount += 1;
          socket.send(JSON.stringify(answerCount === 1
            ? { type: 'vote-rejected', error: 'test-vote-rejected' }
            : { type: 'vote-accepted', questionId: message.questionId, optionIndex: message.optionIndex }));
        });
      });
    } else {
      await page.route('**/api/live/games/123456/vote', route => {
        answerCount += 1;
        return route.fulfill(answerCount === 1
          ? { status: 500, json: { error: 'test-vote-rejected' } }
          : { json: { accepted: true, game } });
      });
    }
    await page.goto('/live-challenge?room=123456');
    const answer = page.locator('[data-action="viewer-answer"]').first();
    await expect(answer).toBeVisible();
    if (transport === 'websocket') await expect.poll(() => !!socketRoute).toBe(true);
    await captureAnalyticsEvents(page);
    expect((await capturedEvents(page)).filter(({ name }) => name === 'game_play')).toHaveLength(0);
    await answer.click();
    await expect.poll(() => answerCount).toBe(1);
    await expect(page.getByRole('alert')).toHaveText('通信に失敗しました。少し待ってから試してください。');
    expect((await capturedEvents(page)).filter(({ name }) => name === 'game_play')).toHaveLength(0);
    await answer.click();
    await expect.poll(async () => (await capturedEvents(page)).filter(({ name }) => name === 'game_play')).toEqual([{
      name: 'game_play',
      params: { game_type: 'live_challenge', play_mode: 'live', player_role: 'viewer', play_criteria: 'accepted_answer' },
    }]);
    if (socketRoute) {
      socketRoute.send(JSON.stringify({ type: 'vote-accepted', questionId: 'question-1', optionIndex: 0 }));
      await expect(answer).toBeDisabled();
      expect((await capturedEvents(page)).filter(({ name }) => name === 'game_play')).toHaveLength(1);
    }
  });
}

test('LIVE host accepted answer counts as play without counting room entry', async ({ page }) => {
  const token = 'b'.repeat(48);
  let answered = false;
  const game = () => ({
    mode: 'stream-challenge', phase: 'voting', subjectName: 'Host', host: true,
    currentQuestionIndex: 0, questionCount: 10, participantCount: 1, participantLimit: 1000,
    realtime: false, showVoteCount: false,
    question: { id: 'question-1', text: 'Question 1', options: ['A', 'B', 'C', 'D', 'E'],
      subjectAnswered: answered, voteCount: 0, voteCounts: [0, 0, 0, 0, 0], result: null }, results: [],
  });
  await page.route('**/api/live/games/123456', route => route.fulfill({ json: { code: '123456', game: game() } }));
  await page.route('**/api/live/games/123456/subject-answer', route => {
    answered = true;
    return route.fulfill({ json: { accepted: true, game: game() } });
  });
  await page.goto(`/live-challenge?room=123456#host=${token}`);
  await captureAnalyticsEvents(page);
  expect((await capturedEvents(page)).filter(({ name }) => name === 'game_play')).toHaveLength(0);
  await page.locator('[data-action="host-answer"]').first().click();
  await expect.poll(async () => (await capturedEvents(page)).filter(({ name }) => name === 'game_play')).toEqual([{
    name: 'game_play',
    params: { game_type: 'live_challenge', play_mode: 'live', player_role: 'host', play_criteria: 'accepted_answer' },
  }]);
});

test('通常版の実プレイ操作で game_start、game_result、share が発火する', async ({ browser, page }) => {
  await page.goto('/challenge');
  await captureAnalyticsEvents(page);

  await page.locator('#creator-name').fill('計測確認');
  await page.locator('[data-action="start-create"]').click();
  expect((await capturedEvents(page)).filter(({ name }) => name === 'game_play')).toHaveLength(0);
  for (let index = 0; index < 10; index += 1) {
    await expect(page.locator('[data-action="builder-answer"]')).toHaveCount(10);
    await page.locator('[data-action="builder-answer"]').first().click();
  }

  const copyButton = page.locator('[data-action="copy-url"]').first();
  await expect(copyButton).toBeVisible();
  const challengeUrl = await copyButton.getAttribute('data-copy-value');
  expect(challengeUrl).toMatch(/\/challenge\?room=[A-Z2-9]{8}/);
  await copyButton.click();
  await expect.poll(async () => (await capturedEvents(page)).map(({ name }) => name)).toContain('share');

  const creatorEvents = await capturedEvents(page);
  expect(creatorEvents.filter(({ name }) => name === 'game_play')).toEqual([{
    name: 'game_play',
    params: { game_type: 'challenge', play_mode: 'async', player_role: 'creator', play_criteria: 'accepted_answer' },
  }]);
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
