import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import {
  buildRecentQuestionGroups,
  getQuestionTrendMetrics,
  liveSplitDetails,
  recordLiveAnswerDistribution,
  recordQuestionSelections,
  startOfJstWeek,
} from '../../src/questions/trends.js';

function d1Adapter(sqlite) {
  return {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return {
        bindings: [],
        bind(...bindings) {
          this.bindings = bindings;
          return this;
        },
        async first() {
          return statement.get(...this.bindings) || null;
        },
        async all() {
          return { results: statement.all(...this.bindings) };
        },
        async run() {
          const result = statement.run(...this.bindings);
          return { meta: { changes: Number(result.changes) } };
        },
      };
    },
    async batch(statements) {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    },
  };
}

test('今週は日本時間の月曜0時から始まる', () => {
  assert.equal(
    new Date(startOfJstWeek(Date.parse('2026-07-27T08:00:00+09:00'))).toISOString(),
    '2026-07-26T15:00:00.000Z',
  );
  assert.equal(
    new Date(startOfJstWeek(Date.parse('2026-08-02T23:59:59+09:00'))).toISOString(),
    '2026-07-26T15:00:00.000Z',
  );
});

test('採用済みカードだけから4分類を作り、無効IDは結果へ混ぜない', () => {
  const cards = [
    {
      id: 'Q1', title: '今週のお題', choices: ['1', '2', '3', '4', '5'],
      selectionShownCount: 20, selectionSkipCount: 1,
    },
    {
      id: 'Q2', title: '新しいお題', choices: ['1', '2', '3', '4', '5'],
      selectionShownCount: 10, selectionSkipCount: 2,
    },
  ];
  const groups = buildRecentQuestionGroups(cards, {
    weeklySelections: [
      { questionId: 'DISABLED', selectedCount: 100 },
      { questionId: 'Q2', selectedCount: 3 },
      { questionId: 'Q1', selectedCount: 8 },
    ],
    recentApprovals: [
      { questionId: 'DISABLED', addedAt: 999 },
      { questionId: 'Q2', addedAt: 200 },
      { questionId: 'Q1', addedAt: 100 },
    ],
    liveResponses: [
      { questionId: 'Q1', optionCounts: [2, 2, 2, 2, 2] },
      { questionId: 'Q2', optionCounts: [9, 1, 0, 0, 0] },
      { questionId: 'DISABLED', optionCounts: [2, 2, 2, 2, 2] },
    ],
  });
  assert.deepEqual(groups.weekly.map(({ card }) => card.id), ['Q1', 'Q2']);
  assert.deepEqual(groups.lowSkip.map(({ card }) => card.id), ['Q1', 'Q2']);
  assert.deepEqual(groups.recent.map(({ card }) => card.id), ['Q2', 'Q1']);
  assert.deepEqual(groups.liveSplit.map(({ card }) => card.id), ['Q1', 'Q2']);
  assert.equal(Object.values(groups).flat().some(({ card }) => card.id === 'DISABLED'), false);
  assert.deepEqual(liveSplitDetails([2, 2, 2, 2, 2]), {
    optionCounts: [2, 2, 2, 2, 2],
    totalAnswers: 10,
    activeChoices: 5,
    diversity: 0.7999999999999999,
  });
});

test('作成回数とLIVE回答分散を週単位で保存し、最近の採用だけを返す', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE question_catalog (
      question_id TEXT PRIMARY KEY, source_kind TEXT NOT NULL, source_ref TEXT,
      title TEXT NOT NULL, category TEXT NOT NULL, choices_json TEXT NOT NULL,
      status TEXT NOT NULL, use_challenge INTEGER NOT NULL, use_live INTEGER NOT NULL,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )
  `);
  const insert = sqlite.prepare(`
    INSERT INTO question_catalog VALUES (?, 'candidate', ?, ?, 'テスト', '["1","2","3","4","5"]', ?, 1, 1, ?, ?)
  `);
  insert.run('Q1', 'Q1', '採用中', 'approved', 100, 300);
  insert.run('Q2', 'Q2', '無効', 'disabled', 200, 400);
  const env = { REMOTE_DB: d1Adapter(sqlite) };
  const now = Date.parse('2026-07-27T12:00:00+09:00');

  await recordQuestionSelections(env, [{ id: 'Q1' }, { id: 'Q2' }], 'challenge', now);
  await recordQuestionSelections(env, [{ id: 'Q1' }], 'live', now);
  await recordLiveAnswerDistribution(env, { sourceId: 'Q1' }, {
    options: [{ count: 2 }, { count: 1 }, { count: 1 }, { count: 0 }, { count: 0 }],
  }, now);

  const metrics = await getQuestionTrendMetrics(env, 'ja', now);
  assert.deepEqual(metrics.weeklySelections, [
    { questionId: 'Q1', selectedCount: 2 },
    { questionId: 'Q2', selectedCount: 1 },
  ]);
  assert.deepEqual(metrics.recentApprovals, [{ questionId: 'Q1', addedAt: 300 }]);
  assert.deepEqual(metrics.liveResponses, [{
    questionId: 'Q1',
    optionCounts: [2, 1, 1, 0, 0],
  }]);
});
