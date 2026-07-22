import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateLiveResult,
  createLiveQuestion,
  recommendYouTubeCandidates,
  validateLiveDraft,
} from '../../src/live/model.js';
import {
  extractYouTubeFeedVideos,
  extractYouTubeTopics,
  extractYouTubeVideoSource,
  generateYouTubeQuestions,
  handleLiveApi,
  normalizeYouTubeChannelUrl,
  normalizeYouTubeInputUrl,
  publicLiveGame,
} from '../../src/live/api.js';
import {
  LIVE_POLL_INTERVAL_MS,
  LIVE_FALLBACK_VIEWER_LIMIT,
  LIVE_REALTIME_SHARD_CAPACITY,
  LIVE_REALTIME_SHARD_COUNT,
  LIVE_VIEWER_LIMIT,
} from '../../src/live/config.js';
import { LiveRoomCoordinator, LiveVoteShard, liveShardIndexForToken, liveViewerLimit, personalizeLiveRealtimeGame } from '../../src/live/realtime.js';

test('LIVE問題は1問以上で、10問を超えても固定上限で切り捨てない', () => {
  const questions = Array.from({ length: 12 }, (_, index) => createLiveQuestion({
    id: `q-${index}`,
    type: 'poll',
    text: `問題${index + 1}`,
    options: ['A', 'B'],
  }));
  const result = validateLiveDraft({ title: 'テストLIVE', subjectName: '主役', questions });
  assert.equal(result.valid, true);
  assert.equal(result.draft.questions.length, 12);
});

test('旧形式データ互換では非公開回答が必要で、選択肢を安全に正規化する', () => {
  const invalid = validateLiveDraft({
    title: 'テストLIVE', subjectName: '主役',
    questions: [{ id: 'q-1', type: 'guess-person', text: 'どれ？', options: ['A', 'B'], lockedIndex: null }],
  });
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join('\n'), /非公開回答/);
  const valid = validateLiveDraft({
    title: 'テストLIVE', subjectName: '主役',
    questions: [{ id: 'q-1', type: 'guess-person', text: 'どれ？', options: ['A', 'B', 'C', 'D', 'E'], lockedIndex: 1 }],
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.draft.questions[0].options, ['A', 'B', 'C', 'D']);
});

test('YouTubeモードは30問以内・同一タイプ・各5択に固定する', () => {
  const now = 1_800_000_000_000;
  const scheduledAt = now + 60 * 60 * 1000;
  const baseQuestion = {
    type: 'guess-person', text: '本人はどれ？', options: ['A', 'B', 'C', 'D', 'E'], lockedIndex: null,
  };
  const questions = Array.from({ length: 30 }, (_, index) => ({ ...baseQuestion, id: `yt-${index}` }));
  const valid = validateLiveDraft({
    creationMode: 'youtube', title: 'YouTube LIVE', subjectName: '本人', scheduledAt, showLiveVoteCounts: true, questions,
  }, { now });
  assert.equal(valid.valid, true);
  assert.equal(valid.draft.showLiveVoteCounts, true);
  assert.equal(valid.draft.questions.length, 30);
  assert.equal(valid.draft.questions.every((question) => question.options.length === 5), true);
  assert.equal(valid.draft.questions.every((question) => question.lockedIndex === null), true);
  const fifthOptionResult = calculateLiveResult({ ...baseQuestion, id: 'result-5', lockedIndex: 4 }, { participant: 4 });
  assert.equal(fifthOptionResult.options.length, 5);
  assert.equal(fifthOptionResult.options[4].count, 1);
  assert.equal(fifthOptionResult.isCorrect, true);

  const tooMany = validateLiveDraft({
    creationMode: 'youtube', title: 'YouTube LIVE', subjectName: '本人', scheduledAt,
    questions: [...questions, { ...baseQuestion, id: 'yt-30' }],
  }, { now });
  assert.match(tooMany.errors.join('\n'), /30問以内/);
  const fourOptions = validateLiveDraft({
    creationMode: 'youtube', title: 'YouTube LIVE', subjectName: '本人', scheduledAt,
    questions: [{ ...baseQuestion, options: ['A', 'B', 'C', 'D'] }],
  }, { now });
  assert.match(fourOptions.errors.join('\n'), /選択肢を5個/);
  const mixedTypes = validateLiveDraft({
    creationMode: 'youtube', title: 'YouTube LIVE', subjectName: '本人', scheduledAt,
    questions: [baseQuestion, { ...baseQuestion, type: 'guess-majority' }],
  }, { now });
  assert.match(mixedTypes.errors.join('\n'), /問題タイプを統一/);
});

test('YouTube LIVEは未来の予約日時を必須にし、安全運用上限を公開する', () => {
  const now = 1_800_000_000_000;
  const question = { type: 'guess-person', text: '本人はどれ？', options: ['A', 'B', 'C', 'D', 'E'] };
  const missing = validateLiveDraft({
    creationMode: 'youtube', title: '予約LIVE', subjectName: '本人', questions: [question],
  }, { now });
  assert.match(missing.errors.join('\n'), /予約日時/);
  const past = validateLiveDraft({
    creationMode: 'youtube', title: '予約LIVE', subjectName: '本人', scheduledAt: now - 1, questions: [question],
  }, { now });
  assert.match(past.errors.join('\n'), /現在より後/);

  const publicState = publicLiveGame({
    version: 4, title: '予約LIVE', subjectName: '本人', channelName: '公式チャンネル',
    scheduledAt: now + 60_000, phase: 'lobby', currentQuestionIndex: 0,
    questions: [{ ...question, id: 'q-1', lockedIndex: null }], participants: [], votes: {}, results: [],
    realtime: true, participantLimit: LIVE_VIEWER_LIMIT,
  });
  assert.equal(publicState.participantLimit, LIVE_VIEWER_LIMIT);
  assert.equal(publicState.scheduledAt, now + 60_000);
  assert.equal(publicState.channelName, '公式チャンネル');
  assert.equal(LIVE_POLL_INTERVAL_MS, 3_000);
});

test('LIVEリアルタイム設計は1万人を32分割し、各分割に余裕を確保する', () => {
  assert.equal(LIVE_VIEWER_LIMIT, 10_000);
  assert.equal(LIVE_REALTIME_SHARD_COUNT, 32);
  assert.equal(LIVE_REALTIME_SHARD_COUNT * LIVE_REALTIME_SHARD_CAPACITY >= LIVE_VIEWER_LIMIT, true);
  let seed = 0x12345678;
  const shardCounts = Array(LIVE_REALTIME_SHARD_COUNT).fill(0);
  for (let index = 0; index < LIVE_VIEWER_LIMIT; index += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const token = seed.toString(16).padStart(8, '0').repeat(3);
    shardCounts[liveShardIndexForToken(token)] += 1;
  }
  assert.equal(shardCounts.every((count) => count > 0), true);
  assert.equal(Math.max(...shardCounts) < LIVE_REALTIME_SHARD_CAPACITY, true);
});

test('本番運用上限は未設定なら50人、設定しても設計上限1万人を超えない', () => {
  const bindings = { LIVE_ROOM_COORDINATOR: {}, LIVE_VOTE_SHARD: {} };
  assert.equal(liveViewerLimit(bindings), LIVE_FALLBACK_VIEWER_LIMIT);
  assert.equal(liveViewerLimit({ ...bindings, LIVE_OPERATIONAL_VIEWER_LIMIT: '1000' }), 1_000);
  assert.equal(liveViewerLimit({ ...bindings, LIVE_OPERATIONAL_VIEWER_LIMIT: '20000' }), LIVE_VIEWER_LIMIT);
});

test('リアルタイム配信状態は視聴者本人の回答と最終正誤だけを付与する', () => {
  const game = {
    phase: 'complete',
    question: { id: 'q-1', options: ['A', 'B'], result: null },
    results: [{
      questionId: 'q-1', type: 'guess-person', subjectAnswerIndex: 1,
      popularIndices: [1], options: [{ text: 'A' }, { text: 'B' }],
    }],
  };
  const personalized = personalizeLiveRealtimeGame(game, { 'q-1': 1 }, '視聴者');
  assert.equal(personalized.myVoteIndex, 1);
  assert.equal(personalized.participantName, '視聴者');
  assert.equal(personalized.results[0].myVoteIndex, 1);
  assert.equal(personalized.results[0].myIsCorrect, true);
  assert.equal('myVoteIndex' in game.results[0], false);
});

test('リアルタイム入場制御は1万人目を受け入れ、1万1人目を拒否する', async () => {
  const values = new Map([['participantCount', LIVE_VIEWER_LIMIT - 1], ['shard:0:count', 0]]);
  const storage = {
    async get(key) { return values.get(key); },
    async put(key, value) {
      if (typeof key === 'object') Object.entries(key).forEach(([name, item]) => values.set(name, item));
      else values.set(key, value);
    },
    async transaction(callback) { return callback(this); },
  };
  const coordinator = new LiveRoomCoordinator({ storage }, {});
  const reserve = () => coordinator.fetch(new Request('https://live.internal/reserve', {
    method: 'POST', body: JSON.stringify({ code: '123456', shardIndex: 0, viewerLimit: LIVE_VIEWER_LIMIT }),
  }));
  assert.equal((await reserve()).status, 200);
  assert.equal((await reserve()).status, 409);
  assert.equal(values.get('participantCount'), LIVE_VIEWER_LIMIT);
});

test('分散投票は参加者ごとに一度だけ保存し、問題スナップショットへ集計する', async () => {
  const values = new Map();
  let alarm = null;
  const storage = {
    async get(key) { return values.get(key); },
    async put(key, value) {
      if (typeof key === 'object') Object.entries(key).forEach(([name, item]) => values.set(name, item));
      else values.set(key, value);
    },
    async list({ prefix }) { return new Map([...values].filter(([key]) => key.startsWith(prefix))); },
    async transaction(callback) { return callback(this); },
    async getAlarm() { return alarm; },
    async setAlarm(value) { alarm = value; },
  };
  const shard = new LiveVoteShard({ storage, getWebSockets: () => [] }, {});
  const voteRequest = () => new Request('https://live.internal/vote', {
    method: 'POST',
    body: JSON.stringify({
      code: '123456', shardIndex: 0, participantId: 'p-1', questionId: 'q-1', optionIndex: 2, optionCount: 5,
    }),
  });
  assert.equal((await shard.fetch(voteRequest())).status, 200);
  assert.equal((await shard.fetch(voteRequest())).status, 409);
  const snapshot = await shard.fetch(new Request('https://live.internal/snapshot', {
    method: 'POST', body: JSON.stringify({ questionId: 'q-1', optionCount: 5 }),
  }));
  assert.deepEqual(await snapshot.json(), { votes: { 'p-1': 2 }, voteCounts: [0, 0, 1, 0, 0] });
  const personal = await shard.fetch(new Request('https://live.internal/participant-votes', {
    method: 'POST', body: JSON.stringify({ participantId: 'p-1' }),
  }));
  assert.deepEqual(await personal.json(), { votes: { 'q-1': 2 } });
});

test('D1ポーリングは現在問の選択肢別集計と本人回答だけを取得する', async () => {
  const participantToken = 'a'.repeat(20);
  const question = { id: 'q-1', type: 'guess-person', text: 'どれ？', options: ['A', 'B'], lockedIndex: 1 };
  const secondQuestion = { id: 'q-2', type: 'guess-person', text: '次は？', options: ['C', 'D'], lockedIndex: 0 };
  let storedGame = {
    version: 4, title: '軽量取得テスト', subjectName: '本人', phase: 'voting', currentQuestionIndex: 0,
    showVoteCount: true, questions: [question, secondQuestion], results: [], expiresAt: Date.now() + 60_000,
  };
  const statements = [];
  const db = {
    prepare(sql) {
      const text = String(sql).replace(/\s+/g, ' ').trim();
      statements.push(text);
      return {
        bind() { return this; },
        async run() { return { meta: { changes: 1 } }; },
        async first() {
          if (text.startsWith('SELECT payload, expires_at FROM live_games')) {
            return { payload: JSON.stringify(storedGame), expires_at: storedGame.expiresAt };
          }
          return null;
        },
        async all() {
          if (text.includes('FROM live_participants WHERE code')) {
            return { results: [{ participant_id: 'p-1', participant_token: participantToken, name: '参加者', joined_at: 1 }] };
          }
          if (text.includes('GROUP BY v.option_index')) {
            return { results: [
              { option_index: 0, vote_count: 2, my_vote_index: null },
              { option_index: 1, vote_count: 1, my_vote_index: 1 },
            ] };
          }
          if (text.includes('INNER JOIN live_participants')) {
            return { results: [
              { question_id: 'q-1', option_index: 1, participant_id: 'p-1' },
              { question_id: 'q-2', option_index: 0, participant_id: 'p-1' },
            ] };
          }
          return { results: [] };
        },
      };
    },
  };
  const fetchGame = () => handleLiveApi(new Request('https://example.com/api/live/games/123456', {
    headers: { 'x-live-participant-token': participantToken },
  }), { REMOTE_DB: db }, '/api/live/games/123456');

  let response = await fetchGame();
  assert.equal(response.status, 200);
  let body = await response.json();
  assert.deepEqual(body.game.question.voteCounts, [2, 1]);
  assert.equal(body.game.myVoteIndex, 1);
  assert.equal(statements.some((sql) => sql.includes('GROUP BY v.option_index')), true);
  assert.equal(statements.some((sql) => sql.includes('FROM live_votes WHERE code = ?')), false);

  statements.length = 0;
  storedGame = {
    ...storedGame,
    phase: 'complete',
    results: [
      calculateLiveResult(question, { 'p-1': 1, 'p-2': 0, 'p-3': 0 }),
      calculateLiveResult(secondQuestion, { 'p-1': 0 }),
    ],
  };
  response = await fetchGame();
  body = await response.json();
  assert.equal(body.game.results[0].myVoteIndex, 1);
  assert.equal(body.game.results[1].myVoteIndex, 0);
  assert.equal(statements.some((sql) => sql.includes('INNER JOIN live_participants')), true);
  assert.equal(statements.some((sql) => sql.includes('GROUP BY v.option_index')), false);
});

test('3タイプの票数・割合・最多回答・当たり判定を生成する', () => {
  const person = calculateLiveResult({ id: 'a', type: 'guess-person', text: '本人は？', options: ['A', 'B'], lockedIndex: 0 }, { p1: 0, p2: 0, p3: 1 });
  assert.deepEqual(person.options.map(({ count, percentage }) => ({ count, percentage })), [
    { count: 2, percentage: 66.7 }, { count: 1, percentage: 33.3 },
  ]);
  assert.deepEqual(person.popularIndices, [0]);
  assert.equal(person.isCorrect, true);
  assert.equal(person.subjectAnswerIndex, 0);

  const majority = calculateLiveResult({ id: 'b', type: 'guess-majority', text: '1位は？', options: ['A', 'B'], lockedIndex: 1 }, { p1: 1, p2: 1 });
  assert.equal(majority.isCorrect, true);
  assert.equal(majority.predictionIndex, 1);

  const poll = calculateLiveResult({ id: 'c', type: 'poll', text: '投票', options: ['A', 'B'], lockedIndex: null }, {});
  assert.equal(poll.totalVotes, 0);
  assert.deepEqual(poll.popularIndices, []);
  assert.equal('isCorrect' in poll, false);
});

test('投票締切前の公開状態から正解・トークン・投票内訳を除外する', () => {
  const game = {
    title: '秘密テスト', subjectName: '本人', phase: 'voting', currentQuestionIndex: 0,
    hostToken: 'secret-host',
    questions: [{ id: 'q-1', type: 'guess-person', text: '本人の答え', options: ['秘密A', '秘密B'], lockedIndex: 1 }],
    participants: [{ id: 'p-1', token: 'secret-participant', name: '参加者' }],
    votes: { 'q-1': { 'p-1': 0 } }, results: [],
  };
  const publicState = publicLiveGame(game);
  const serialized = JSON.stringify(publicState);
  assert.equal(serialized.includes('lockedIndex'), false);
  assert.equal(serialized.includes('secret-host'), false);
  assert.equal(serialized.includes('secret-participant'), false);
  assert.equal(serialized.includes('subjectAnswerIndex'), false);
  assert.equal(publicState.question.voteCount, 1);
});

test('新しいLIVEではスタッフと本人だけに必要な権限情報を返す', () => {
  const game = {
    version: 4, title: '3端末テスト', subjectName: '本人', phase: 'voting', currentQuestionIndex: 0,
    hostToken: 'secret-host', subjectToken: 'secret-subject', showVoteCount: false,
    creatorImageDataUrl: 'data:image/webp;base64,QUJD', channelName: '本人チャンネル',
    questions: [{ id: 'q-1', type: 'guess-person', text: '本人の答え', options: ['A', 'B'], lockedIndex: 1 }],
    participants: [{ id: 'p-1', token: 'secret-participant', name: '参加者' }],
    votes: { 'q-1': { 'p-1': 0 } }, results: [], expiresAt: Date.now() + 1000,
  };
  const publicState = publicLiveGame(game);
  assert.equal(publicState.question.subjectAnswered, true);
  assert.equal('voteCount' in publicState.question, false);
  assert.equal('voteCounts' in publicState.question, false);
  assert.equal('myAnswerIndex' in publicState.question, false);
  assert.equal('subjectToken' in publicState, false);
  assert.equal('creatorImageDataUrl' in publicState, false);

  const hostState = publicLiveGame(game, { host: true });
  assert.equal(hostState.host, true);
  assert.equal(hostState.subjectToken, 'secret-subject');
  assert.equal('creatorImageDataUrl' in hostState, false);
  assert.equal(hostState.question.voteCount, 1);
  assert.deepEqual(hostState.question.voteCounts, [1, 0]);
  assert.equal('myAnswerIndex' in hostState.question, false);

  const subjectState = publicLiveGame(game, { subject: true });
  assert.equal(subjectState.subject, true);
  assert.equal(subjectState.question.myAnswerIndex, 1);
  assert.equal(subjectState.question.voteCount, 1);
  assert.deepEqual(subjectState.question.voteCounts, [1, 0]);
  assert.equal('subjectToken' in subjectState, false);
  assert.equal('creatorImageDataUrl' in subjectState, false);

  const visibleState = publicLiveGame({ ...game, showVoteCount: true });
  assert.equal(visibleState.question.voteCount, 1);
  assert.deepEqual(visibleState.question.voteCounts, [1, 0]);
});

test('参加者だけに各問題の自分の回答と正誤を返す', () => {
  const game = {
    title: '個人結果テスト', subjectName: '本人', phase: 'complete', currentQuestionIndex: 0,
    hostToken: 'secret-host', expiresAt: Date.now() + 1000,
    creatorImageDataUrl: 'data:image/webp;base64,QUJD', channelName: '本人チャンネル', scheduledAt: Date.now() + 1000,
    questions: [{ id: 'q-1', type: 'guess-person', text: '本人の答え', options: ['A', 'B'], lockedIndex: 1 }],
    participants: [{ id: 'p-1', token: 'secret-participant', name: '参加者' }],
    votes: { 'q-1': { 'p-1': 1 } },
    results: [calculateLiveResult({ id: 'q-1', type: 'guess-person', text: '本人の答え', options: ['A', 'B'], lockedIndex: 1 }, { 'p-1': 1 })],
  };
  const publicResult = publicLiveGame(game);
  assert.equal('myVoteIndex' in publicResult.results[0], false);
  assert.equal('creatorImageDataUrl' in publicResult, false);
  const participantResult = publicLiveGame(game, { participantToken: 'secret-participant' });
  assert.equal(participantResult.results[0].myVoteIndex, 1);
  assert.equal(participantResult.results[0].myIsCorrect, true);
  assert.equal(participantResult.participantName, '参加者');
  assert.equal(participantResult.creatorImageDataUrl, 'data:image/webp;base64,QUJD');
});

test('全問出題後の答え合わせでは発表ボタンを押すまで正解を返さない', () => {
  const result = calculateLiveResult(
    { id: 'q-1', type: 'guess-person', text: '本人の答え', options: ['A', 'B'], lockedIndex: 1 },
    { 'p-1': 1 },
  );
  const game = {
    version: 3, title: '答え合わせテスト', subjectName: '本人', phase: 'review-question', currentQuestionIndex: 0,
    hostToken: 'secret-host', expiresAt: Date.now() + 1000,
    questions: [{ id: 'q-1', type: 'guess-person', text: '本人の答え', options: ['A', 'B'], lockedIndex: 1 }],
    participants: [{ id: 'p-1', token: 'secret-participant', name: '参加者' }],
    votes: { 'q-1': { 'p-1': 1 } }, results: [result],
  };
  const beforeReveal = publicLiveGame(game, { participantToken: 'secret-participant' });
  assert.equal(beforeReveal.question.result, null);
  assert.equal(beforeReveal.results.length, 0);
  assert.equal(JSON.stringify(beforeReveal).includes('subjectAnswerIndex'), false);
  const afterReveal = publicLiveGame({ ...game, phase: 'review-answer' }, { participantToken: 'secret-participant' });
  assert.equal(afterReveal.question.result.subjectAnswerIndex, 1);
  assert.equal(afterReveal.question.result.myIsCorrect, true);
});

test('YouTubeの一般的なチャンネルURLを正規化し、選んだ1種類だけ30問を作る', () => {
  assert.equal(normalizeYouTubeChannelUrl('https://www.youtube.com/@sample/videos'), 'https://www.youtube.com/@sample');
  assert.equal(normalizeYouTubeChannelUrl('youtube.com/channel/UC1234567890'), 'https://www.youtube.com/channel/UC1234567890');
  assert.equal(normalizeYouTubeChannelUrl('https://example.com/@sample'), '');
  const profile = { channelName: 'サンプル', videoTitles: ['動画Aです', '動画Bです', '動画Cです', '動画Dです'] };
  const personQuestions = generateYouTubeQuestions(profile, 0, 'guess-person');
  const majorityQuestions = generateYouTubeQuestions(profile, 0, 'guess-majority');
  assert.equal(personQuestions.length, 30);
  assert.equal(personQuestions.every(({ type }) => type === 'guess-person'), true);
  assert.equal(personQuestions.every(({ options }) => options.length === 5), true);
  assert.equal(new Set(personQuestions.map(({ text }) => text)).size, 30);
  assert.equal(majorityQuestions.length, 30);
  assert.equal(majorityQuestions.every(({ type }) => type === 'guess-majority'), true);
  assert.equal(majorityQuestions.every(({ options }) => options.length === 5), true);
  assert.equal(new Set(majorityQuestions.map(({ text }) => text)).size, 30);
  assert.equal(recommendYouTubeCandidates(personQuestions).filter(({ selected }) => selected).length, 5);
});

test('通常動画・短縮URL・Shorts・Live・Embedを同じ動画URLへ正規化する', () => {
  const canonical = 'https://www.youtube.com/watch?v=HTRGCp7sDpl';
  assert.equal(normalizeYouTubeInputUrl('https://www.youtube.com/watch?v=HTRGCp7sDpl&t=12s'), canonical);
  assert.equal(normalizeYouTubeInputUrl('https://youtu.be/HTRGCp7sDpl?si=sample'), canonical);
  assert.equal(normalizeYouTubeInputUrl('https://www.youtube.com/shorts/HTRGCp7sDpl'), canonical);
  assert.equal(normalizeYouTubeInputUrl('https://www.youtube.com/live/HTRGCp7sDpl'), canonical);
  assert.equal(normalizeYouTubeInputUrl('https://www.youtube.com/embed/HTRGCp7sDpl'), canonical);
  assert.equal(normalizeYouTubeInputUrl('youtube.com/legacyChannelName'), 'https://www.youtube.com/legacyChannelName');
  assert.equal(normalizeYouTubeChannelUrl(canonical), '');
});

test('動画ページから投稿元チャンネルを特定し、RSSから動画の説明を読み取る', () => {
  const source = extractYouTubeVideoSource(`
    <meta property="og:title" content="夏合宿ドッキリの舞台裏">
    <meta property="og:description" content="幼なじみ4人で夏合宿へ行った時の裏話です">
    <script>{"videoDetails":{"keywords":["夏合宿","幼なじみ"],"author":"わたちゃんず","channelId":"UC1234567890_sample"}}</script>
  `);
  assert.equal(source.channelUrl, 'https://www.youtube.com/channel/UC1234567890_sample');
  assert.equal(source.channelName, 'わたちゃんず');
  assert.deepEqual(source.keywords, ['夏合宿', '幼なじみ']);

  const feed = extractYouTubeFeedVideos(`
    <feed>
      <entry><yt:videoId>video001abc</yt:videoId><media:title>幼なじみ王決定戦</media:title><media:description><![CDATA[罰ゲームをかけて昔の思い出クイズに挑戦]]></media:description></entry>
      <entry><yt:videoId>video002abc</yt:videoId><media:title>夏合宿の未公開集</media:title><media:description>4人だけが知る事件を公開</media:description></entry>
    </feed>
  `);
  assert.equal(feed.length, 2);
  assert.equal(feed[0].description, '罰ゲームをかけて昔の思い出クイズに挑戦');
});

test('動画タイトル・説明の固有情報をチャンネル別のお題へ反映する', () => {
  const profile = {
    channelName: 'わたちゃんず',
    description: '幼なじみ4人の思い出と罰ゲーム企画',
    sourceVideo: { title: '夏合宿ドッキリ', description: '秘密の罰ゲームを決行', keywords: ['幼なじみ', '夏合宿'] },
    videoTitles: ['夏合宿ドッキリ', '幼なじみ王決定戦', '罰ゲーム旅行', '未公開トーク', '4人で料理対決', '昔の写真クイズ'],
    videoSummaries: [
      { title: '夏合宿ドッキリ', description: '秘密の罰ゲームを決行', keywords: ['夏合宿'] },
      { title: '幼なじみ王決定戦', description: '昔の思い出クイズ', keywords: ['幼なじみ'] },
    ],
  };
  const topics = extractYouTubeTopics(profile);
  assert.equal(topics.includes('幼なじみ'), true);
  assert.equal(topics.includes('夏合宿'), true);
  const questions = generateYouTubeQuestions(profile, 0, 'guess-person');
  assert.equal(questions.length, 30);
  assert.equal(questions.slice(0, 12).some(({ text }) => text.includes('夏合宿ドッキリ')), true);
  assert.equal(questions.slice(0, 5).some(({ options }) => options.includes('幼なじみ王決定戦')), true);
  assert.equal(questions.every(({ options }) => options.length === 5), true);
});
