import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

async function fillQuestion(page, index, { type, text, options, lockedIndex }) {
  let card = page.locator(`[data-question-index="${index}"]`);
  if (type) {
    await card.locator('[data-field="question-type"]').selectOption(type);
    card = page.locator(`[data-question-index="${index}"]`);
  }
  await card.locator('[data-field="question-text"]').fill(text);
  for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
    await card.locator(`[data-editor-option="${optionIndex}"]`).fill(options[optionIndex]);
  }
  if (lockedIndex !== undefined) await card.locator('[data-field="locked-index"]').selectOption(String(lockedIndex));
}

test('入口に手入力とYouTubeの2モードを並べ、どちらも共通編集へ進む', async ({ page }) => {
  await page.goto('/live');
  await expect(page.getByRole('heading', { name: 'わかってるよね？LIVE' })).toBeVisible();
  await expect(page.getByRole('button', { name: /自分で問題を作る/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /YouTubeチャンネルから作る/ })).toBeVisible();
  await expect(page.locator('#entryRoomCode')).toBeVisible();

  await page.getByRole('button', { name: /YouTubeチャンネルから作る/ }).click();
  await expect(page.locator('#channelUrl')).toBeVisible();
  await expect(page.locator('#gameTitle')).toHaveCount(0);
  await page.route('**/api/live/youtube-candidates', async (route) => {
    const questions = Array.from({ length: 30 }, (_, index) => ({
      id: `mock-${index}`,
      type: index < 15 ? 'guess-person' : 'guess-majority',
      text: `候補問題${index + 1}`,
      options: ['選択A', '選択B', '選択C', '選択D'],
      selected: index < 5 || (index >= 15 && index < 20),
      recommended: index < 5 || (index >= 15 && index < 20),
    }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        channelUrl: 'https://www.youtube.com/@sample',
        profile: { channelName: 'サンプルチャンネル', source: 'youtube-public-page' },
        questions,
      }),
    });
  });
  await page.locator('#channelUrl').fill('https://www.youtube.com/@sample');
  await page.locator('#generateYouTube').click();
  await expect(page.getByRole('tab', { name: /本人の答えを予想する 15問/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /視聴者の1位を予想する 15問/ })).toBeVisible();
  await page.locator('[data-candidate-index="0"] [data-field="type"]').selectOption('poll');
  await expect(page.getByRole('tab', { name: /アンケートに変更 1問/ })).toHaveAttribute('aria-selected', 'true');
  await page.locator('[data-candidate-index="0"] [data-field="type"]').selectOption('guess-person');
  await page.locator('[data-candidate-index="1"] [data-action="candidate-up"]').click();
  await expect(page.locator('[data-candidate-index="0"] [data-field="text"]')).toHaveValue('候補問題2');
  await page.locator('[data-candidate-index="0"] [data-action="regenerate"]').click();
  await page.locator('[data-candidate-index="0"] [data-field="text"]').fill('編集した候補問題');
  await page.locator('[data-candidate-index="0"] [data-field="selected"]').uncheck();
  await page.locator('#autoRecommend').click();
  await expect(page.locator('[data-field="selected"]:checked')).toHaveCount(5);
  await page.getByRole('tab', { name: /視聴者の1位を予想する 15問/ }).click();
  await expect(page.locator('[data-field="selected"]:checked')).toHaveCount(5);
  await page.getByRole('tab', { name: /本人の答えを予想する 15問/ }).click();
  await page.locator('[data-candidate-index="0"] [data-field="text"]').fill('編集した候補問題');
  await page.locator('#useCandidates').click();
  await expect(page.getByRole('heading', { name: '問題を編集する' })).toBeVisible();
  await expect(page.locator('#gameTitle')).toHaveValue(/サンプルチャンネル/);
  await expect(page.locator('[data-question-index="0"] [data-field="question-text"]')).toHaveValue('編集した候補問題');
});

test('手入力の問題を追加・並べ替え・削除できる', async ({ page }) => {
  await page.goto('/live');
  await page.getByRole('button', { name: /自分で問題を作る/ }).click();
  await page.locator('[data-question-index="0"] [data-field="question-text"]').fill('最初の問題');
  await page.locator('#addQuestion').click();
  await page.locator('[data-question-index="1"] [data-field="question-text"]').fill('次の問題');
  await page.locator('[data-question-index="1"] [data-action="question-up"]').click();
  await expect(page.locator('[data-question-index="0"] [data-field="question-text"]')).toHaveValue('次の問題');
  await page.locator('[data-question-index="0"] [data-action="question-delete"]').click();
  await expect(page.locator('[data-question-index]')).toHaveCount(1);
  await expect(page.locator('[data-question-index="0"] [data-field="question-text"]')).toHaveValue('最初の問題');
});

test('手入力した3タイプを同じライブ投票で進行し、秘密回答を締切前に公開しない', async ({ browser, page, request }) => {
  await page.goto('/live');
  await page.getByRole('button', { name: /自分で問題を作る/ }).click();
  await page.locator('#gameTitle').fill('3タイプ確認LIVE');
  await page.locator('#subjectName').fill('わたちゃん');

  await fillQuestion(page, 0, { type: 'guess-person', text: '本人が選んだ色は？', options: ['ピンク', 'ブルー'], lockedIndex: 0 });
  await page.locator('#addQuestion').click();
  await fillQuestion(page, 1, { type: 'guess-majority', text: 'みんなの1位は？', options: ['海', '山'], lockedIndex: 1 });
  await page.locator('#addQuestion').click();
  await fillQuestion(page, 2, { type: 'poll', text: '普通のアンケート', options: ['朝', '夜'] });

  await page.locator('[data-question-index="2"] [data-action="add-option"]').click();
  await expect(page.locator('[data-question-index="2"] [data-editor-option]')).toHaveCount(3);
  await page.locator('[data-question-index="2"] [data-action="remove-option"]').last().click();
  await expect(page.locator('[data-question-index="2"] [data-editor-option]')).toHaveCount(2);

  await page.locator('#createGame').click();
  await expect(page.getByText('HOST LOBBY')).toBeVisible();
  const roomCode = await page.locator('.room-code').first().textContent();
  expect(roomCode).toMatch(/^\d{6}$/);

  const publicBefore = await request.get(`/api/live/games/${roomCode}`);
  const publicBeforeText = await publicBefore.text();
  expect(publicBeforeText).not.toContain('lockedIndex');
  expect(publicBeforeText).not.toContain('subjectAnswerIndex');
  expect(publicBeforeText).not.toContain('hostToken');

  const participantContext = await browser.newContext();
  const participant = await participantContext.newPage();
  await participant.goto(`/live?room=${roomCode}`);
  await participant.locator('#participantName').fill('参加者A');
  await participant.locator('#joinGame').click();
  await expect(participant.getByText(/司会者が開始/)).toBeVisible();
  await expect(page.getByText('参加者A')).toBeVisible();

  await page.locator('#startLive').click();
  await expect(participant.getByRole('heading', { name: '本人が選んだ色は？' })).toBeVisible();
  await participant.locator('[data-vote-index="0"]').click();
  await expect(page.getByText('投票受付中：1票')).toBeVisible();

  const publicVoting = await request.get(`/api/live/games/${roomCode}`);
  const publicVotingJson = await publicVoting.json();
  expect(JSON.stringify(publicVotingJson)).not.toContain('lockedIndex');
  expect(publicVotingJson.game.question.result).toBeNull();

  await page.locator('#closeVoting').click();
  await expect(page.getByText('当たり！')).toBeVisible();
  await expect(page.getByText('わたちゃんの答え：ピンク')).toBeVisible();
  await page.locator('#nextQuestion').click();

  await expect(participant.getByRole('heading', { name: 'みんなの1位は？' })).toBeVisible();
  await participant.locator('[data-vote-index="1"]').click();
  await expect(page.getByText('投票受付中：1票')).toBeVisible();
  await page.locator('#closeVoting').click();
  await expect(page.getByText('予想的中！')).toBeVisible();
  await expect(page.getByText('作成者の事前予想：山')).toBeVisible();
  await page.locator('#nextQuestion').click();

  await expect(participant.getByRole('heading', { name: '普通のアンケート' })).toBeVisible();
  await participant.locator('[data-vote-index="0"]').click();
  await expect(page.getByText('投票受付中：1票')).toBeVisible();
  await page.locator('#closeVoting').click();
  await expect(page.getByText('朝').last()).toBeVisible();
  await page.locator('#nextQuestion').click();

  await expect(page.getByRole('heading', { name: '最終結果' })).toBeVisible();
  await expect(page.locator('.result-card')).toHaveCount(3);
  await expect(participant.getByRole('heading', { name: /3タイプ確認LIVE 最終結果/ })).toBeVisible();
  await participantContext.close();
});

test('既存トップから新シリーズへ実URLで移動できる', async ({ page }) => {
  await page.goto('/');
  const link = page.getByRole('link', { name: /わかってるよね？LIVE/ });
  await expect(link).toHaveAttribute('href', '/live');
  await link.click();
  await expect(page).toHaveURL('/live');
  await expect(page.getByRole('heading', { name: 'わかってるよね？LIVE' })).toBeVisible();
});

test('末尾スラッシュを参加コード付きの正規URLへ転送する', async ({ request }) => {
  const response = await request.get('/live/?room=123456', { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe('http://127.0.0.1:4173/live?room=123456');
});
