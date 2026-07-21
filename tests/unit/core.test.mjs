import test from 'node:test';
import assert from 'node:assert/strict';

import {
  countMatches,
  countPlayerMatches,
  createScoreboard,
  isCorrectAnswer,
} from '../../src/core/scoring.js';
import { pickRandomItems } from '../../src/core/random.js';
import { createReplayPlan } from '../../src/core/roles.js';
import {
  getPlayersWithTarget,
  normalizePlayerNames,
  sanitizePlayerName,
} from '../../src/core/players.js';
import { createReviewContext } from '../../src/core/review.js';
import { createResultModel } from '../../src/core/result.js';
import { LOVE_RESULT_TIERS, getLoveResultTier } from '../../src/core/loveResults.js';

test('質問抽選は元配列を変更せず、指定件数だけ返す', () => {
  const source = [1, 2, 3, 4, 5, 6];
  const picked = pickRandomItems(source, 3, () => 0);
  assert.deepEqual(source, [1, 2, 3, 4, 5, 6]);
  assert.equal(picked.length, 3);
  assert.equal(new Set(picked).size, 3);
});

test('通常版と複数人版の正誤を同じ窓口で判定する', () => {
  assert.equal(isCorrectAnswer({ match: true }), true);
  assert.equal(isCorrectAnswer({ matches: [false, true] }), true);
  assert.equal(isCorrectAnswer({ matches: [false, false] }), false);
  assert.equal(countMatches([{ match: true }, { match: false }]), 1);
  assert.equal(countPlayerMatches([{ matches: [true, false] }, { matches: [true, true] }], 0), 2);
});

test('友達・家族の個別得点表を純粋に生成する', () => {
  const answers = [{ matches: [true, false] }, { matches: [false, true] }];
  const scoreboard = createScoreboard(answers, [{ name: 'A' }, { name: 'B' }]);
  assert.deepEqual(scoreboard.map(({ name, score, total }) => ({ name, score, total })), [
    { name: 'A', score: 1, total: 2 },
    { name: 'B', score: 1, total: 2 },
  ]);
});

test('名前の制限と当てられる人の並び替えをブラウザなしで扱う', () => {
  assert.equal(sanitizePlayerName('123456789', '本人'), '123456');
  const names = normalizePlayerNames({ friend: ['本人', 'ゆう', 'はるや', 'ふみや'] });
  const players = getPlayersWithTarget('friend', 4, names, 2);
  assert.deepEqual(players.map((player) => player.name), ['はるや', '本人', 'ゆう', 'ふみや']);
});

test('役割交代は名前や画面状態に依存せず反転する', () => {
  assert.deepEqual(
    createReplayPlan({ role: 'target', loveMode: 'girlTarget', swapRoles: true }),
    { role: 'guesser', loveMode: 'boyTarget' },
  );
});

test('結果・称号・総評コンテキストを同じ入力から生成する', () => {
  const answers = [{ match: true }, { match: false }];
  const cards = [{ title: '好きな食べ物' }, { title: 'もし願いがかなうなら' }];
  const result = createResultModel({ answers, cards, tiers: LOVE_RESULT_TIERS });
  assert.equal(result.score, 1);
  assert.equal(result.tier, LOVE_RESULT_TIERS[1]);
  assert.equal(result.review.hitCount, 1);
  assert.equal(result.review.missCount, 1);
  assert.equal(getLoveResultTier(99), LOVE_RESULT_TIERS[5]);
});

test('複数人回答でも総評の正誤集計が崩れない', () => {
  const context = createReviewContext(
    [{ matches: [false, true] }, { matches: [false, false] }],
    [{ title: '好きな食べ物' }, { title: 'もし願いがかなうなら' }],
  );
  assert.equal(context.score, 1);
  assert.equal(context.hitCount, 1);
  assert.equal(context.missCount, 1);
});
