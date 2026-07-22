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

test('YouTubeの本人回答モードだけ30問を生成し、1問以上を選んで共通編集へ進む', async ({ page }) => {
  await page.goto('/live');
  await expect(page.getByRole('heading', { name: '私のこと、ちゃんとわかってるよね？LIVE' })).toBeVisible();
  await expect(page.getByRole('button', { name: /自分で問題を作る/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /YouTubeチャンネルから作る/ })).toBeVisible();
  await expect(page.locator('#entryRoomCode')).toBeVisible();

  await page.getByRole('button', { name: /YouTubeチャンネルから作る/ }).click();
  await expect(page.locator('#channelUrl')).toBeVisible();
  await expect(page.locator('#gameTitle')).toHaveCount(0);
  const personModeButton = page.locator('[data-youtube-type="guess-person"]');
  const majorityModeButton = page.locator('[data-youtube-type="guess-majority"]');
  await expect(personModeButton).toBeHidden();
  await expect(majorityModeButton).toBeHidden();
  await page.route('**/api/live/youtube-candidates', async (route) => {
    const body = route.request().postDataJSON();
    expect(body.questionType).toBe('guess-person');
    const label = body.questionType === 'guess-majority' ? '1位' : '本人';
    const regenerated = body.seed ? '再生成' : '';
    const questions = Array.from({ length: 30 }, (_, index) => ({
      id: `mock-${index}`,
      type: body.questionType,
      text: `${label}${regenerated}候補問題${index + 1}`,
      options: ['選択A', '選択B', '選択C', '選択D', '選択E'],
      selected: index < 5,
      recommended: index < 5,
    }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        channelUrl: 'https://www.youtube.com/@sample',
        profile: { channelName: 'サンプルチャンネル', source: 'youtube-public-page' },
        questionType: body.questionType,
        questions,
      }),
    });
  });
  await page.locator('#channelUrl').fill('https://www.youtube.com/@sample');
  await expect(personModeButton).toBeVisible();
  await expect(majorityModeButton).toBeVisible();
  await expect(personModeButton).toContainText('YouTuberの答えを視聴者が予想する（30問生成し、採用する問題を選ぶ）');
  await expect(majorityModeButton).toContainText('YouTuberが視聴者投票の1位を予想する（30問生成し、採用する問題を選ぶ）');
  await personModeButton.click();
  await expect(page.locator('[data-candidate-index]')).toHaveCount(30);
  await expect(page.locator('[data-candidate-index="0"] [data-option-index]')).toHaveCount(5);
  await expect(page.getByText('選択中：本人の答えを当てる（30問）')).toBeVisible();
  await expect(page.locator('[data-candidate-index] [data-field="type"]')).toHaveCount(0);
  await page.locator('[data-candidate-index="1"] [data-action="candidate-up"]').click();
  await expect(page.locator('[data-candidate-index="0"] [data-field="text"]')).toHaveValue('本人候補問題2');
  await page.locator('[data-candidate-index="0"] [data-action="regenerate"]').click();
  await expect(page.locator('[data-candidate-index="0"] [data-field="text"]')).toHaveValue(/本人再生成候補問題/);
  await page.locator('[data-candidate-index="0"] [data-field="text"]').fill('編集した候補問題');
  await page.locator('#autoRecommend').click();
  await expect(page.locator('[data-field="selected"]:checked')).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) {
    await page.locator(`[data-candidate-index="${index}"] [data-field="selected"]`).uncheck();
  }
  await expect(page.locator('#useCandidates')).toBeDisabled();
  await page.locator('[data-candidate-index="0"] [data-field="selected"]').check();
  await expect(page.locator('#useCandidates')).toBeEnabled();
  await page.locator('#useCandidates').click();
  await expect(page.getByRole('heading', { name: '問題を編集する' })).toBeVisible();
  await expect(page.locator('#gameTitle')).toHaveValue(/サンプルチャンネル/);
  await expect(page.locator('[data-question-index="0"] [data-field="question-text"]')).toHaveValue('編集した候補問題');
  await expect(page.locator('[data-question-index="0"] [data-field="question-type"]')).toBeDisabled();
  await expect(page.locator('[data-question-index="0"] [data-field="question-type"]')).toHaveValue('guess-person');
  await expect(page.locator('[data-question-index="0"] [data-editor-option]')).toHaveCount(5);
  await expect(page.locator('#addQuestion')).toHaveCount(0);
  await expect(page.locator('[data-action="add-option"], [data-action="remove-option"]')).toHaveCount(0);
  await page.locator('[data-question-index="0"] [data-field="locked-index"]').selectOption('4');
  await page.locator('#createGame').click();
  await expect(page.getByText('HOST LOBBY')).toBeVisible();
});

test('YouTubeの視聴者1位モードを選ぶと30問すべてを同じタイプに固定する', async ({ page }) => {
  await page.goto('/live');
  await page.getByRole('button', { name: /YouTubeチャンネルから作る/ }).click();
  await page.route('**/api/live/youtube-candidates', async (route) => {
    const body = route.request().postDataJSON();
    expect(body.questionType).toBe('guess-majority');
    const questions = Array.from({ length: 30 }, (_, index) => ({
      id: `majority-${index}`,
      type: 'guess-majority',
      text: `視聴者1位候補${index + 1}`,
      options: ['選択A', '選択B', '選択C', '選択D', '選択E'],
      selected: true,
      recommended: index < 5,
    }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        channelUrl: 'https://www.youtube.com/@sample',
        profile: { channelName: 'サンプルチャンネル', source: 'youtube-public-page' },
        questionType: body.questionType,
        questions,
      }),
    });
  });
  await page.locator('#channelUrl').fill('https://www.youtube.com/@sample');
  await page.locator('[data-youtube-type="guess-majority"]').click();
  await expect(page.locator('[data-candidate-index]')).toHaveCount(30);
  await expect(page.getByText('選択中：みんなの1位を当てる（30問）')).toBeVisible();
  await expect(page.locator('[data-candidate-index] .badge')).toHaveCount(30);
  await expect(page.locator('[data-candidate-index] .badge').first()).toHaveText('みんなの1位を当てる');
  await expect(page.locator('#useCandidates')).toContainText('選んだ30問を編集する');
  await page.locator('#useCandidates').click();
  await expect(page.locator('[data-question-index]')).toHaveCount(30);
  await expect(page.locator('[data-field="question-type"]:not(:disabled)')).toHaveCount(0);
  expect(await page.locator('[data-field="question-type"]').evaluateAll((selects) => selects.every((select) => select.value === 'guess-majority'))).toBe(true);
  await expect(page.locator('[data-editor-option]')).toHaveCount(150);
  await expect(page.locator('#addQuestion')).toHaveCount(0);
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
  const link = page.getByRole('link', { name: /私のこと、ちゃんとわかってるよね？LIVE/ });
  await expect(link).toHaveAttribute('href', '/live');
  await link.click();
  await expect(page).toHaveURL('/live');
  await expect(page.getByRole('heading', { name: '私のこと、ちゃんとわかってるよね？LIVE' })).toBeVisible();
});

test('末尾スラッシュを参加コード付きの正規URLへ転送する', async ({ request }) => {
  const response = await request.get('/live/?room=123456', { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe('http://127.0.0.1:4173/live?room=123456');
});
