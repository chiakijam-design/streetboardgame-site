import { expect, test } from '@playwright/test';
import { LIVE_RESERVATION_BUFFER_HOURS, LIVE_VIEWER_LIMIT } from '../../src/live/config.js';

function scheduleForTest(testInfo, slot) {
  const projectOffsetDays = testInfo.project.name === 'mobile-chrome' ? 100 : 0;
  const date = new Date(Date.now() + (projectOffsetDays + slot * 2 + 2) * 24 * 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

async function selectLiveSchedule(page, testInfo, slot) {
  const input = page.locator('#scheduledAt');
  await expect(input).toHaveAttribute('type', 'datetime-local');
  await input.fill(scheduleForTest(testInfo, slot));
  await page.locator('#checkSchedule').click();
  await expect(page.getByText('この日時は予約できます。企画保存時に予約を確定します。')).toBeVisible();
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test('手入力形式の新規作成APIを受け付けない', async ({ request }) => {
  const response = await request.post('/api/live/games', {
    data: {
      draft: {
        creationMode: 'manual',
        title: '手入力LIVE',
        subjectName: '本人',
        questions: [{ type: 'poll', text: '手入力問題', options: ['A', 'B'] }],
      },
    },
  });
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: 'youtube-creation-required' });
});

test('YouTubeの本人回答モードだけ30問を生成し、1問以上を選んで共通編集へ進む', async ({ page }, testInfo) => {
  await page.goto('/live');
  await expect(page.getByRole('heading', { name: 'Youtuber専用　私のこと、ちゃんと分かってるよねLIVE' })).toBeVisible();
  await expect(page.getByRole('button', { name: /自分で問題を作る/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'YouTubeチャンネルから問題を作る' })).toBeVisible();
  await expect(page.locator('#entryRoomCode')).toBeVisible();

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
  await expect(page.locator('.editor-flow-step')).toHaveCount(3);
  await expect(page.locator('.editor-flow-step.is-current')).toContainText('いまここ');
  await expect(page.getByText('まず、企画の基本情報を確認')).toBeVisible();
  await expect(page.getByRole('heading', { name: '次に、問題と5択を確認' })).toBeVisible();
  await expect(page.locator('#gameTitle')).toHaveValue(/サンプルチャンネル/);
  await expect(page.locator('[data-question-index="0"] [data-field="question-text"]')).toHaveValue('編集した候補問題');
  await expect(page.locator('[data-question-index="0"] [data-field="question-type"]')).toBeDisabled();
  await expect(page.locator('[data-question-index="0"] [data-field="question-type"]')).toHaveValue('guess-person');
  await expect(page.locator('[data-question-index="0"] [data-editor-option]')).toHaveCount(5);
  await expect(page.locator('[data-question-index="0"] .editor-option-number')).toHaveText(['1', '2', '3', '4', '5']);
  await expect(page.locator('#showLiveVoteCounts')).not.toBeChecked();
  await expect(page.locator('#scheduledAt')).toHaveValue('');
  await expect(page.getByText(`安全運用上限：視聴者${LIVE_VIEWER_LIMIT}人`)).toBeVisible();
  await expect(page.getByText(`予約時刻の前後${LIVE_RESERVATION_BUFFER_HOURS}時間は、ほかのYouTuberが予約できません。`)).toBeVisible();
  await selectLiveSchedule(page, testInfo, 0);
  await expect(page.getByText('全問題で選択肢別の現在票数を表示する')).toBeVisible();
  await expect(page.locator('.editor-question-card')).toHaveCount(1);
  await expect(page.locator('.editor-question-card').first()).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('#addQuestion')).toHaveCount(0);
  await expect(page.locator('[data-action="add-option"], [data-action="remove-option"]')).toHaveCount(0);
  await expect(page.locator('[data-question-index="0"] [data-field="locked-index"]')).toHaveCount(0);
  await expect(page.getByText(/本人の答えは配信中に入力します/).first()).toBeVisible();
  await page.locator('#createGame').click();
  await expect(page.getByText('HOST LOBBY')).toBeVisible();
  await expect(page.getByRole('heading', { name: '企画を保存しました' })).toBeVisible();
  await expect(page.locator('#managementUrl')).toHaveValue(/#host=[a-f0-9]+$/);
});

test('YouTubeの視聴者1位モードを選ぶと30問すべてを同じタイプに固定する', async ({ page }) => {
  await page.goto('/live');
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

test('動画URLを入力すると投稿元チャンネルを使った30問を表示する', async ({ page }) => {
  const videoUrl = 'https://www.youtube.com/watch?v=HTRGCp7sDpl';
  await page.goto('/live');
  await expect(page.getByLabel('YouTubeチャンネル・動画URL')).toBeVisible();
  await expect(page.getByText(/通常動画・短縮URL・Shorts・ライブのURLにも対応/)).toBeVisible();
  await page.route('**/api/live/youtube-candidates', async (route) => {
    const body = route.request().postDataJSON();
    expect(body.channelUrl).toBe(videoUrl);
    const questions = Array.from({ length: 30 }, (_, index) => ({
      id: `video-source-${index}`,
      type: 'guess-person',
      text: `内輪向け候補${index + 1}`,
      options: ['夏合宿', '幼なじみ王', '罰ゲーム旅行', '未公開トーク', '料理対決'],
      selected: index < 5,
      recommended: index < 5,
    }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        channelUrl: 'https://www.youtube.com/channel/UC1234567890_sample',
        profile: {
          channelName: 'わたちゃんず',
          inputKind: 'video',
          source: 'youtube-video-and-channel',
          videoTitles: Array.from({ length: 15 }, (_, index) => `公開動画${index + 1}`),
          videoDescriptionCount: 15,
        },
        questionType: 'guess-person',
        questions,
      }),
    });
  });
  await page.locator('#channelUrl').fill(videoUrl);
  await page.locator('[data-youtube-type="guess-person"]').click();
  await expect(page.getByRole('heading', { name: 'わたちゃんず' })).toBeVisible();
  await expect(page.getByText(/動画URLから投稿元の「わたちゃんず」を特定/)).toBeVisible();
  await expect(page.getByText(/公開動画 15件のタイトル・公開説明/)).toBeVisible();
  await expect(page.locator('[data-candidate-index]')).toHaveCount(30);
});

test('5問を同時回答した後、一問ずつ答え合わせして個人結果を表示する', async ({ browser, page, request }, testInfo) => {
  await page.goto('/live');
  await page.route('**/api/live/youtube-candidates', async (route) => {
    const questions = Array.from({ length: 30 }, (_, index) => ({
      id: `flow-${index}`,
      type: 'guess-person',
      text: index === 0 ? '本人が選んだ色は？' : `候補問題${index + 1}`,
      options: ['ピンク', 'ブルー', '黄色', '緑', '白'],
      selected: index < 5,
      recommended: index < 5,
    }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        channelUrl: 'https://www.youtube.com/@sample',
        profile: { channelName: 'わたちゃん', source: 'youtube-public-page' },
        questionType: 'guess-person',
        questions,
      }),
    });
  });
  await page.locator('#channelUrl').fill('https://www.youtube.com/@sample');
  await page.locator('[data-youtube-type="guess-person"]').click();
  await page.locator('#useCandidates').click();
  await expect(page.locator('[data-question-index]')).toHaveCount(5);
  await selectLiveSchedule(page, testInfo, 2);
  await page.locator('#creatorImage').setInputFiles({
    name: 'creator.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR42mNkYPj/n4GBgYGJAQoAHgQCAf2uS0sAAAAASUVORK5CYII=', 'base64'),
  });
  await expect(page.locator('.creator-image-preview img')).toBeVisible();
  await page.locator('#showLiveVoteCounts').check();
  await page.locator('#createGame').click();
  await expect(page.getByText('HOST LOBBY')).toBeVisible();
  await expect(page.getByText(`視聴者上限 ${LIVE_VIEWER_LIMIT}人`)).toBeVisible();
  const roomCode = await page.locator('.room-code').first().textContent();
  expect(roomCode).toMatch(/^\d{6}$/);
  const subjectUrl = await page.locator('#subjectUrl').inputValue();
  expect(subjectUrl).toMatch(new RegExp(`/live\\?room=${roomCode}#subject=[a-f0-9]+$`));

  const publicBefore = await request.get(`/api/live/games/${roomCode}`);
  const publicBeforeText = await publicBefore.text();
  expect(publicBeforeText).not.toContain('lockedIndex');
  expect(publicBeforeText).not.toContain('subjectAnswerIndex');
  expect(publicBeforeText).not.toContain('hostToken');
  expect(publicBeforeText).not.toContain('subjectToken');
  expect(publicBeforeText).not.toContain('creatorImageDataUrl');

  const subjectContext = await browser.newContext();
  const subject = await subjectContext.newPage();
  await subject.goto(subjectUrl);
  await expect(subject.getByRole('heading', { name: 'YouTuber本人専用画面' })).toBeVisible();

  const participantContext = await browser.newContext();
  const participant = await participantContext.newPage();
  await participant.goto(`/live?room=${roomCode}`);
  await participant.locator('#participantName').fill('参加者A');
  await participant.locator('#joinGame').click();
  await expect(participant.getByText(/司会者が開始/)).toBeVisible();
  await expect(page.getByText('参加者A')).toBeVisible();

  await page.locator('#startLive').click();
  await expect(subject.getByRole('heading', { name: '本人が選んだ色は？' })).toBeVisible();
  await expect(participant.getByRole('heading', { name: '本人が選んだ色は？' })).toBeVisible();
  await expect(participant.getByText('YouTuberと同時に回答してください。')).toBeVisible();

  for (let index = 0; index < 5; index += 1) {
    const questionText = index === 0 ? '本人が選んだ色は？' : `候補問題${index + 1}`;
    await expect(page.getByRole('heading', { name: questionText })).toBeVisible();
    await expect(subject.getByRole('heading', { name: questionText })).toBeVisible();
    await expect(participant.getByRole('heading', { name: questionText })).toBeVisible();
    await expect(page.locator('#advanceQuestion')).toBeDisabled();
    await expect(page.locator('[data-host-answer-index]')).toHaveCount(0);
    if (index === 0) {
      const forbiddenAnswer = await request.post(`/api/live/games/${roomCode}/subject-answer`, {
        data: { questionId: 'flow-0', optionIndex: 0 },
      });
      expect(forbiddenAnswer.status()).toBe(403);
    }
    await subject.locator('[data-subject-answer-index="0"]').click();
    await subject.locator('#confirmSubjectAnswer').click();
    await expect(subject.getByText('秘密回答を確定しました')).toBeVisible();
    await expect(page.locator('.personal-result').getByText('回答済み')).toBeVisible();
    await expect(page.locator('#advanceQuestion')).toBeEnabled();
    await participant.locator('[data-vote-index="0"]').click();
    await expect(participant.getByText(/回答しました/)).toBeVisible();
    if (index === 0) {
      await expect(participant.getByText('選択肢別の現在票数を表示しています。')).toBeVisible();
      await expect(participant.locator('.live-vote-count').first()).toHaveText('1票');
      await expect(participant.locator('.live-vote-count').nth(1)).toHaveText('0票');
      const publicVoting = await request.get(`/api/live/games/${roomCode}`);
      const publicVotingJson = await publicVoting.json();
      expect(JSON.stringify(publicVotingJson)).not.toContain('lockedIndex');
      expect(JSON.stringify(publicVotingJson)).not.toContain('subjectAnswerIndex');
      expect(JSON.stringify(publicVotingJson)).not.toContain('myAnswerIndex');
      expect(JSON.stringify(publicVotingJson)).not.toContain('subjectToken');
      expect(publicVotingJson.game.question.result).toBeNull();
      expect(publicVotingJson.game.question.voteCount).toBe(1);
      expect(publicVotingJson.game.question.voteCounts).toEqual([1, 0, 0, 0, 0]);
      expect(publicVotingJson.game.results).toEqual([]);
    }
    await page.locator('#advanceQuestion').click();
  }

  await expect(page.getByText('ANSWER CHECK')).toBeVisible();
  await expect(page.getByRole('heading', { name: '本人が選んだ色は？' })).toBeVisible();
  await expect(page.getByText('わたちゃんの答え：ピンク')).toHaveCount(0);
  await expect(participant.getByText('わたちゃんの答え：ピンク')).toHaveCount(0);
  const publicReviewQuestion = await request.get(`/api/live/games/${roomCode}`);
  const publicReviewQuestionJson = await publicReviewQuestion.json();
  expect(publicReviewQuestionJson.game.question.result).toBeNull();
  expect(publicReviewQuestionJson.game.results).toEqual([]);

  for (let index = 0; index < 5; index += 1) {
    const questionText = index === 0 ? '本人が選んだ色は？' : `候補問題${index + 1}`;
    await expect(page.getByRole('heading', { name: questionText })).toBeVisible();
    await page.locator('#revealAnswer').click();
    await expect(page.getByText('わたちゃんの答え：ピンク')).toBeVisible();
    await expect(participant.getByText('あなたの回答：ピンク')).toBeVisible();
    await expect(participant.locator('.personal-result').getByText('正解！')).toBeVisible();
    await expect(page.getByText('みんなの予想は当たり！')).toBeVisible();
    await page.locator('#nextQuestion').click();
  }

  await expect(page.getByRole('heading', { name: '最終結果' })).toBeVisible();
  await expect(page.locator('.result-card')).toHaveCount(5);
  await expect(participant.getByRole('heading', { name: 'あなたの最終結果' })).toBeVisible();
  await expect(participant.getByText('5 / 5問正解')).toBeVisible();
  await expect(participant.locator('.result-card')).toHaveCount(5);
  await expect(participant.getByRole('heading', { name: '購入用結果画像のプレビュー' })).toBeVisible();
  await expect(participant.locator('#resultViewerName')).toHaveValue('参加者A');
  await expect(participant.locator('#liveResultPreview')).toBeVisible();
  await expect(participant.locator('#liveResultPreview')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  expect(await participant.locator('#liveResultPreview').evaluate((image) => ({ width: image.naturalWidth, height: image.naturalHeight }))).toEqual({ width: 540, height: 675 });
  await participant.locator('#resultViewerName').fill('視聴者テスト');
  await expect(participant.locator('#liveResultPreview')).toHaveAttribute('data-viewer-name', '視聴者テスト');
  await expect(subject.getByRole('heading', { name: '最終結果' })).toBeVisible();
  await expect(subject.locator('.result-card')).toHaveCount(5);
  await subjectContext.close();
  await participantContext.close();
});

test('予約日時の前後20時間は別のLIVE予約をAPIでも拒否する', async ({ request }, testInfo) => {
  const scheduledAt = new Date(scheduleForTest(testInfo, 10)).getTime();
  const draft = {
    creationMode: 'youtube',
    title: '予約競合テスト',
    subjectName: '本人',
    channelName: '予約テストチャンネル',
    scheduledAt,
    questions: [{ id: 'reservation-q', type: 'guess-person', text: 'どれ？', options: ['A', 'B', 'C', 'D', 'E'] }],
  };
  const first = await request.post('/api/live/games', { data: { draft } });
  expect(first.status()).toBe(201);

  const conflict = await request.post('/api/live/games', {
    data: { draft: { ...draft, title: '競合する予約', scheduledAt: scheduledAt + 60 * 60 * 1000 } },
  });
  expect(conflict.status()).toBe(409);
  expect(await conflict.json()).toEqual({ error: 'live-slot-unavailable' });

  const availability = await request.get(`/api/live/reservations/availability?scheduledAt=${scheduledAt + 2 * 60 * 60 * 1000}`);
  expect(availability.status()).toBe(200);
  expect(await availability.json()).toMatchObject({ available: false, viewerLimit: LIVE_VIEWER_LIMIT, bufferHours: 20 });
});

test('別のLIVEが進行中は開始を拒否し、完了後に全体ロックを解放する', async ({ request }, testInfo) => {
  const createGame = async (slot, title, questionId) => {
    const response = await request.post('/api/live/games', {
      data: {
        draft: {
          creationMode: 'youtube', title, subjectName: '本人', channelName: `${title}チャンネル`,
          scheduledAt: new Date(scheduleForTest(testInfo, slot)).getTime(),
          questions: [{ id: questionId, type: 'guess-person', text: 'どれ？', options: ['A', 'B', 'C', 'D', 'E'] }],
        },
      },
    });
    expect(response.status()).toBe(201);
    return response.json();
  };
  const first = await createGame(30, '進行ロック1', 'active-q-1');
  const second = await createGame(31, '進行ロック2', 'active-q-2');
  const hostHeaders = (token) => ({ 'x-live-host-token': token });

  expect((await request.post(`/api/live/games/${first.code}/start`, { headers: hostHeaders(first.hostToken), data: {} })).status()).toBe(200);
  const blocked = await request.post(`/api/live/games/${second.code}/start`, { headers: hostHeaders(second.hostToken), data: {} });
  expect(blocked.status()).toBe(409);
  expect(await blocked.json()).toEqual({ error: 'another-live-active' });

  expect((await request.post(`/api/live/games/${first.code}/subject-answer`, {
    headers: { 'x-live-subject-token': first.game.subjectToken },
    data: { questionId: 'active-q-1', optionIndex: 0 },
  })).status()).toBe(200);
  for (const action of ['advance', 'reveal', 'next']) {
    expect((await request.post(`/api/live/games/${first.code}/${action}`, { headers: hostHeaders(first.hostToken), data: {} })).status()).toBe(200);
  }
  expect((await request.post(`/api/live/games/${second.code}/start`, { headers: hostHeaders(second.hostToken), data: {} })).status()).toBe(200);
  expect((await request.post(`/api/live/games/${second.code}/subject-answer`, {
    headers: { 'x-live-subject-token': second.game.subjectToken },
    data: { questionId: 'active-q-2', optionIndex: 0 },
  })).status()).toBe(200);
  for (const action of ['advance', 'reveal', 'next']) {
    expect((await request.post(`/api/live/games/${second.code}/${action}`, { headers: hostHeaders(second.hostToken), data: {} })).status()).toBe(200);
  }
});

test('安全運用上限を超える視聴者は参加APIで拒否する', async ({ request }, testInfo) => {
  const scheduledAt = new Date(scheduleForTest(testInfo, 20)).getTime();
  const created = await request.post('/api/live/games', {
    data: {
      draft: {
        creationMode: 'youtube', title: '人数上限テスト', subjectName: '本人', channelName: '上限テストチャンネル', scheduledAt,
        questions: [{ id: 'capacity-q', type: 'guess-person', text: 'どれ？', options: ['A', 'B', 'C', 'D', 'E'] }],
      },
    },
  });
  expect(created.status()).toBe(201);
  const { code } = await created.json();
  for (let index = 0; index < LIVE_VIEWER_LIMIT; index += 1) {
    const joined = await request.post(`/api/live/games/${code}/join`, { data: { name: `参加者${index + 1}` } });
    expect(joined.status(), `参加者${index + 1}`).toBe(201);
  }
  const rejected = await request.post(`/api/live/games/${code}/join`, { data: { name: '参加者51' } });
  expect(rejected.status()).toBe(409);
  expect(await rejected.json()).toEqual({ error: 'participant-limit-reached' });
});

test('トップの家族ボタン直下からLIVEを開始し、紹介カードから説明ページへ移動できる', async ({ page }) => {
  await page.goto('/');
  const familyButton = page.getByRole('button', { name: '家族の絆を判定する' });
  const playLink = page.getByRole('link', { name: 'Youtuber専用LIVEを作って遊ぶ', exact: true });
  await expect(playLink).toHaveAttribute('href', '/live');
  const familyBox = await familyButton.boundingBox();
  const playBox = await playLink.boundingBox();
  expect(familyBox).not.toBeNull();
  expect(playBox).not.toBeNull();
  expect(playBox.y).toBeGreaterThanOrEqual(familyBox.y + familyBox.height);

  const guideLink = page.getByRole('link', { name: /私のこと、ちゃんと分かってるよねLIVE/ });
  await expect(guideLink).toHaveAttribute('href', '/live-guide');
  await guideLink.click();
  await expect(page).toHaveURL('/live-guide');
  await expect(page.getByRole('heading', { name: 'Youtuber専用　私のこと、ちゃんと分かってるよねLIVE' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'YouTubeライブの企画ネタが、チャンネルURLだけで作れる' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Youtuber専用LIVEを作って遊ぶ' })).toHaveAttribute('href', '/live');

  await page.goto('/');
  await page.getByRole('link', { name: 'Youtuber専用LIVEを作って遊ぶ', exact: true }).click();
  await expect(page).toHaveURL('/live');
  await expect(page.getByRole('heading', { name: 'Youtuber専用　私のこと、ちゃんと分かってるよねLIVE' })).toBeVisible();
});

test('末尾スラッシュを参加コード付きの正規URLへ転送する', async ({ request }) => {
  const response = await request.get('/live/?room=123456', { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe('http://127.0.0.1:4173/live?room=123456');
});
