import { expect, test } from './test.mjs';

test('LIVE polling keeps unchanged controls and preserves chat focus on updates', async ({ page }) => {
  let count = 1; let polls = 0;
  await page.addInitScript(() => sessionStorage.setItem('live-challenge:123456', JSON.stringify({ token: 'a'.repeat(48), name: 'Viewer' })));
  await page.route('**/api/live/games/123456', route => {
    polls++;
    return route.fulfill({ json: { code: '123456', game: { mode: 'stream-challenge', phase: 'voting', participantName: 'Viewer', participantCount: count,
      currentQuestionIndex: 0, questionCount: 10, realtime: false, chatEnabled: true, chatMessages: [],
      question: { id: 'q1', text: 'Question', options: ['A','B','C','D','E'], voteCount: 0 }, results: [], } } });
  });
  await page.goto('/live-challenge?room=123456');
  const chat = page.locator('#live-chat-input'); await expect(chat).toBeVisible();
  await chat.fill('Draft');
  await chat.evaluate(e => { window.testChatNode = e; });
  await expect.poll(() => polls).toBeGreaterThan(1);
  expect(await chat.evaluate(e => e === window.testChatNode)).toBe(true);
  await expect(chat).toHaveValue('Draft');
  count = 2;
  await expect.poll(() => polls).toBeGreaterThan(2);
  await expect(chat).toHaveValue('Draft'); await expect(chat).toBeFocused();
});

test('LIVE automatic lobby/voting/reveal transitions keep the session frame stable', async ({ page }) => {
  let phase = 'lobby';
  await page.addInitScript(() => {
    sessionStorage.setItem('live-challenge:123456', JSON.stringify({ token: 'a'.repeat(48), name: 'Viewer' }));
    window.testShifts = [];
    if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) new PerformanceObserver(list => {
      window.testShifts.push(...list.getEntries().filter(e => !e.hadRecentInput).map(e => e.value));
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.route('**/api/live/games/123456', route => route.fulfill({ json: { code: '123456', game: {
    mode: 'stream-challenge', phase, participantName: 'Viewer', participantCount: 1,
    currentQuestionIndex: 0, questionCount: 10, realtime: false, chatEnabled: true, chatMessages: [],
    question: { id: 'q1', text: 'Question', options: ['A','B','C','D','E'], voteCount: 0,
      result: phase === 'reveal' ? { questionId: 'q1', subjectAnswerIndex: 0, options: ['A','B','C','D','E'].map(text=>({text,count:0})) } : null }, results: [],
  } } }));
  await page.goto('/live-challenge?room=123456');
  const frame = page.locator('.live-session-main'); await expect(frame).toBeVisible();
  const initial = await frame.boundingBox();
  await page.evaluate(() => { window.testShifts = []; });
  phase = 'voting';
  await expect(page.locator('html')).toHaveAttribute('data-live-challenge-phase', 'voting');
  const voting = await frame.boundingBox(); expect(voting.y).toBe(initial.y); expect(voting.width).toBe(initial.width);
  phase = 'reveal';
  await expect(page.locator('html')).toHaveAttribute('data-live-challenge-phase', 'reveal');
  const reveal = await frame.boundingBox(); expect(reveal.y).toBe(initial.y); expect(reveal.width).toBe(initial.width);
  const shifts = await page.evaluate(() => window.testShifts);
  expect(shifts.reduce((a,b)=>a+b,0)).toBeLessThan(0.1);
});

test('LIVE builder advances only the question DOM and keeps settings/name intact', async ({ page }) => {
  await page.goto('/live-challenge');
  await page.locator('[data-action="open-create"]').click();
  await page.locator('#host-name').fill('Host');
  await expect(page.locator('[data-testid="live-sales-settings"]')).toBeVisible();
  await page.locator('#host-name').evaluate(e=>{ window.testHostNode = e; });
  await page.locator('[data-action="use-live-question"]').click();
  await expect(page.locator('.notebook-card-counter')).toHaveText('Q2/10');
  expect(await page.locator('#host-name').evaluate(e=>e === window.testHostNode)).toBe(true);
  await expect(page.locator('#host-name')).toHaveValue('Host');
  await page.locator('[data-action="previous-live-question"]').click();
  await expect(page.locator('.notebook-card-counter')).toHaveText('Q1/10');
});

test('initial library image and secondary page fonts are discoverable without JS font downloads', async ({ page, request }) => {
  const library = await (await request.get('/challenge/library')).text();
  expect(library).toContain('rel="preload" as="image" href="/assets/question-packs/easy-first-meeting.svg"');
  await page.goto('/challenge/library');
  const images = page.getByTestId('question-library').locator('img');
  await expect(images.first()).toHaveAttribute('loading', 'eager');
  await expect(images.nth(1)).toHaveAttribute('loading', 'lazy');
  const product = await (await request.get('/product')).text();
  expect(product).toContain('data-page-subset="true"');
  expect(product).toContain('as="image" href="/assets/product/board-game-package-photo.webp"');
  const english = await (await request.get('/en/')).text();
  expect(english).toMatch(/data-build-font="english" href="\/dist\/english-font-/);
  expect(english).not.toContain('family=Noto+Sans+JP');
});

test('completed normal play delivers image, report and role-swap actions without identity in the body', async ({ page, request }) => {
  // Simulate the OS accepting a file share; this is not a physical-device save test.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {} });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
  });
  const actions = [];
  await page.route('**/api/challenge/rooms/*/actions', async route => {
    actions.push(route.request().postDataJSON());
    await route.continue();
  });
  await page.goto('/challenge');
  const cards = await page.evaluate(() => window.COMMON_QUESTION_CARDS.slice(0, 10));
  const created = await request.post('/api/challenge/rooms', { data: { creatorName: 'Host', cards, answers: Array(10).fill(0) } });
  const { code } = await created.json();
  await page.goto(`/challenge?room=${code}`);
  await page.locator('#participant-name').fill('Player');
  await page.locator('[data-action="join"]').click();
  for (let i=0;i<10;i++) {
    await expect(page.locator('.challenge-q-number')).toHaveText(`Q${i+1}/10`);
    await page.locator('[data-action="answer"]').first().click();
  }
  await expect.poll(() => actions.map(a=>a.metric)).toContain('result_image_ready');
  await page.getByTestId('challenge-ai-review').scrollIntoViewIfNeeded();
  await expect.poll(() => actions.map(a=>a.metric)).toContain('answer_report_viewed');
  await page.locator('[data-action="save-result-image"]').click();
  await expect.poll(() => actions.map(a=>a.metric)).toContain('result_image_save_requested');
  await page.locator('[data-action="swap-roles"]').click();
  await expect.poll(() => actions.map(a=>a.metric)).toContain('role_swap_started');
  expect(actions.every(a=>Object.keys(a).length===1 && typeof a.metric==='string')).toBe(true);
  expect(actions.length).toBe(4);
});
