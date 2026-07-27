import { expect, test } from './test.mjs';

const ORIGIN = 'https://www.streetboardgame.com';

test('日本語トップを維持し、英語端末には初回だけ英語版を案内する', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['en-US', 'en'] });
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.getByRole('dialog', { name: 'English version available' })).toBeVisible();
  await page.getByRole('button', { name: 'View in English' }).click();
  await expect(page).toHaveURL(/\/en\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(((await page.getByRole('heading', { level: 1 }).textContent()) || '').replace(/\s+/g, ''))
    .toContain('Howwelldoyouknowme?');
});

test('言語切替はページ上部にだけ表示し、スクロールへ追従しない', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('watachan:language:v1', 'ja'));
  await page.goto('/');
  const switcher = page.locator('.site-language-switch');
  await expect(switcher).toBeVisible();
  await expect(switcher).toHaveCSS('position', 'absolute');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(async () => (await switcher.boundingBox())?.y ?? 0).toBeLessThan(0);
});

test('英語の主要ページは専用SEO・hreflangを持ち、言語切替はトップだけに表示する', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'メタ情報は画面幅に依存しないためPCで1回検証');
  const routes = [
    ['/en/', 'How Well Do You Know Me? | Understanding Quiz', 'How well do you know me?'],
    ['/en/challenge', 'Challenge Your Friends | How well do they know you?', 'How well do you know me?'],
    ['/en/live-challenge', 'Livestream Challenge | Play with Instagram or YouTube viewers', 'How well do you know me?'],
    ['/en/terms', 'Terms of Service | Streetboardgame', 'Terms of Service'],
    ['/en/privacy', 'Privacy Policy | Streetboardgame', 'Privacy Policy'],
  ];
  for (const [path, title, h1] of routes) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle(title);
    expect(((await page.locator('h1').textContent()) || '').replace(/\s+/g, ''), path)
      .toContain(h1.replace(/\s+/g, ''));
    if (path === '/en/') {
      await expect(page.getByRole('navigation', { name: 'Language' })).toBeVisible();
    } else {
      await expect(page.locator('.site-language-switch'), path).toHaveCount(0);
    }
    await expect(page.locator('link[rel="alternate"][hreflang="ja"]')).toHaveCount(1);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
  }
  await page.goto('/en/challenge');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    `${ORIGIN}/assets/ogp-challenge-en.png?v=20260725-en-1`,
  );
  const imageResponse = await request.get('/assets/ogp-challenge-en.png');
  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()['content-type']).toBe('image/png');
  expect((await imageResponse.body()).byteLength).toBeGreaterThan(100_000);
});

test('英語トップから通常版とLIVE版の英語標準お題へ進める', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.getByText('A “Know Me” quiz maker for sharing or livestreaming')).toBeVisible();
  await expect(page.getByText('Try again as many times as it takes to understand each other')).toBeVisible();
  await expect(page.getByText('Standard mode · Send one URL and answer anytime', { exact: true })).toBeVisible();
  await expect(page.getByText('Using it on a livestream?', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: /Your name/ }).fill('Mia');
  await page.getByRole('link', { name: 'Start building 10 questions ▶' }).click();
  await expect(page).toHaveURL(/\/en\/challenge$/);
  await expect(page.getByText('Q1/10')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Choose / }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip this question' })).toBeVisible();

  await page.goto('/en/live-challenge');
  await page.getByRole('button', { name: /Create a LIVE quiz/ }).click();
  await expect(page.getByRole('heading', { name: 'Build your quiz one question at a time' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Use this question \(answer during the stream\)/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip this question' })).toBeVisible();
});

test('英語トップは小さなスマホ幅でも横にはみ出さない', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop-chrome', 'スマホ幅専用のレイアウト検証');
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/en/');
    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(geometry.scrollWidth, `${width}px`).toBeLessThanOrEqual(geometry.clientWidth + 1);
  }
});

test('日本語と英語の下層ページに言語切替を表示しない', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'リンク先は画面幅に依存しないためPCで1回検証');
  for (const path of [
    '/challenge',
    '/live-challenge',
    '/terms',
    '/privacy',
    '/challenge-guide',
    '/about',
    '/product',
    '/en/challenge',
    '/en/live-challenge',
    '/en/terms',
    '/en/privacy',
  ]) {
    await page.goto(path);
    await expect(page.locator('.site-language-switch'), path).toHaveCount(0);
  }
  for (const removedPath of ['/en/challenge-guide', '/en/about', '/en/product']) {
    const response = await request.get(removedPath);
    expect(response.status(), removedPath).toBe(404);
  }
});

test('英語参加者は10問へ回答し、英語結果カード・称号・総評を確認できる', async ({ request, page }) => {
  const cards = Array.from({ length: 10 }, (_, index) => ({
    id: `ENTEST${index + 1}`,
    category: 'Test',
    title: `English test question ${index + 1}?`,
    choices: ['One', 'Two', 'Three', 'Four', 'Five'],
  }));
  const createdResponse = await request.post('/api/challenge/rooms', {
    data: { creatorName: 'Mia', cards, answers: Array(10).fill(0) },
  });
  expect(createdResponse.status()).toBe(201);
  const created = await createdResponse.json();
  await page.goto(`/en/challenge?room=${created.code}&share=challenge-20260725-2`);
  await page.getByRole('textbox', { name: /Display name/ }).fill('Alex');
  await page.getByRole('button', { name: /Start the 10-question challenge/ }).click();
  for (let index = 0; index < 10; index += 1) {
    await page.getByRole('button', { name: /^Guess One$/ }).click();
  }
  await expect(page.getByRole('heading', { name: '10/10 correct' })).toHaveCount(1);
  await expect(page.locator('.challenge-hero')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Which answers matched?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Answer Review Report' })).toBeVisible();
  await expect(page.getByTestId('challenge-ai-review').locator(':scope > div > p')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Score result card' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Title only/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /With score/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Guess the answers again' })).toBeVisible();
  await expect(page.getByTestId('challenge-score-actions')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add to Understanding Board (optional)' })).toHaveCount(0);
  await expect(page.locator('input[name="board-comment"]')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: /comment/i })).toHaveCount(0);
  await expect(page.getByTestId('challenge-ai-review')).toContainText('Overall understanding');
  await expect(page.getByTestId('challenge-ai-review')).toContainText('A fun topic for next time');
  await expect(page.getByTestId('challenge-result-image')).toBeVisible();
  await expect(page.getByTestId('challenge-result-image')).toHaveAttribute('alt', /You in 100% Focus/);
  const roleSwap = page.getByTestId('challenge-role-swap');
  await expect(roleSwap).toContainText('RECOMMENDED');
  await expect(roleSwap.getByRole('button', {
    name: 'Use the same 10 questions — now I’ll be the creator',
  })).toBeVisible();
  const resultShare = page.getByTestId('challenge-result-share');
  await expect(resultShare.getByRole('heading', { name: 'Share this result with friends' })).toBeVisible();
  const boardCheckbox = resultShare.getByRole('checkbox', { name: /Add to Understanding Board/ });
  await expect(boardCheckbox).not.toBeChecked();
  await expect(boardCheckbox).toBeEnabled();
  await expect(resultShare.getByText('You can still save, share, and retry without adding your result.')).toBeVisible();
  await expect(resultShare.getByRole('button', { name: 'Add only to Understanding Board' })).toBeEnabled();
  await expect(resultShare.getByRole('button', { name: /For Instagram/ })).toBeEnabled();
  await expect(resultShare.getByRole('button', { name: 'Share on LINE' })).toBeVisible();
  await expect(resultShare.getByRole('button', { name: 'Post result on X' })).toBeVisible();
  await expect(resultShare.getByRole('button', { name: 'Save image only' })).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Create with new questions' })).toBeVisible();
  expect(await page.evaluate(() => {
    const review = document.querySelector('[data-testid="challenge-ai-review"]');
    const swap = document.querySelector('[data-action="swap-roles"]');
    const share = document.querySelector('[data-testid="challenge-result-share"]');
    const retry = document.querySelector('[data-action="retry-challenge"]');
    const create = Array.from(document.querySelectorAll('a'))
      .find((link) => link.textContent.trim() === 'Create with new questions');
    return Boolean(review && swap && share && retry && create
      && (review.compareDocumentPosition(swap) & Node.DOCUMENT_POSITION_FOLLOWING)
      && (swap.compareDocumentPosition(share) & Node.DOCUMENT_POSITION_FOLLOWING)
      && (share.compareDocumentPosition(retry) & Node.DOCUMENT_POSITION_FOLLOWING)
      && (retry.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING));
  })).toBe(true);
  await expect(page.getByRole('button', { name: 'Copy text only' })).toHaveCount(0);
  await resultShare.getByRole('button', { name: 'Add only to Understanding Board' }).click();
  await page.getByRole('link', { name: 'View the Understanding Board' }).click();
  await expect(page.getByTestId('understanding-board')).toContainText('Answer reviewed');
  await expect(page.getByTestId('understanding-board')).toContainText('10/10 matched');
  await expect(page.getByTestId('understanding-board')).not.toContainText('#1');
});

test('英語の作成完了画面も共有と保存の導線を英語で表示する', async ({ request, page }) => {
  const cards = Array.from({ length: 10 }, (_, index) => ({
    id: `ENHOST${index + 1}`,
    category: 'Test',
    title: `Host test question ${index + 1}?`,
    choices: ['One', 'Two', 'Three', 'Four', 'Five'],
  }));
  const createdResponse = await request.post('/api/challenge/rooms', {
    data: { creatorName: 'Mia', cards, answers: Array(10).fill(0) },
  });
  expect(createdResponse.status()).toBe(201);
  const created = await createdResponse.json();
  await page.goto(`/en/challenge/manage?room=${created.code}#manage=${created.manageToken}`);
  const shareScreen = page.getByTestId('challenge-share-screen');
  await expect(shareScreen.getByRole('heading', { name: 'Your quiz is ready' })).toBeVisible();
  await expect(shareScreen.getByRole('button', { name: 'Share on LINE' })).toBeVisible();
  await expect(shareScreen.getByRole('button', { name: 'Copy URL' })).toBeVisible();
  await expect(shareScreen.getByRole('group', { name: 'Instagram & X' })).toBeVisible();
  await expect(shareScreen.getByRole('link', { name: 'View the Understanding Board' })).toBeVisible();
  await expect(shareScreen.getByRole('button', { name: 'Save to recent quizzes' })).toBeVisible();
});

test('英語の参加・LIVEエラーは日本語を残さない', async ({ page }) => {
  await page.goto('/en/challenge?room=NOEXIST1');
  await expect(page.getByRole('heading', { name: 'This quiz could not be opened' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(/not found|expired|request failed/i);
  await page.goto('/en/live-challenge?room=000000');
  await expect(page.getByRole('heading', { name: 'Join the LIVE quiz' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Your name/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enter a different code' })).toBeVisible();
});
