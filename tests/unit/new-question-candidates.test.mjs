import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { scanQuestionSafety } from '../../src/questions/safety.js';
import { questionSimilarity } from '../../src/questions/similarity.js';

const candidateDataUrl = new URL('../../data/question-candidates-20260727.json', import.meta.url);
const expectedSourceCounts = new Map([
  ['100MON', 40],
  ['CSW', 35],
  ['RANK', 25],
]);

test('追加候補100問は5択・出典・安全性の条件を満たす', async () => {
  const data = JSON.parse(await readFile(candidateDataUrl, 'utf8'));
  const candidates = data.candidates;

  assert.equal(candidates.length, 100);
  assert.deepEqual(
    candidates.map((candidate) => candidate.id),
    Array.from({ length: 100 }, (_, index) => `HLD${String(index + 101).padStart(3, '0')}`),
  );
  assert.equal(new Set(candidates.map((candidate) => candidate.title)).size, 100);
  assert.equal(new Set(candidates.map((candidate) => candidate.sourceRef)).size, 100);

  const actualSourceCounts = new Map();
  for (const candidate of candidates) {
    assert.equal(candidate.choices.length, 5, candidate.id);
    assert.equal(new Set(candidate.choices).size, 5, candidate.id);
    assert.deepEqual(scanQuestionSafety(candidate).flags, [], candidate.id);
    const sourceKey = candidate.sourceRef.split('-')[0];
    actualSourceCounts.set(sourceKey, (actualSourceCounts.get(sourceKey) || 0) + 1);
  }
  assert.deepEqual(actualSourceCounts, expectedSourceCounts);
});

test('追加候補100問は既存158問・前回100候補と完全重複しない', async () => {
  globalThis.window = {};
  await import('../../prototype_common_data.js');
  const staticQuestions = globalThis.window.COMMON_QUESTION_CARDS;

  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(await readFile(new URL('../../migrations/0012_question_catalog_moderation.sql', import.meta.url), 'utf8'));
  sqlite.exec(await readFile(new URL('../../migrations/0019_add_held_question_candidates.sql', import.meta.url), 'utf8'));
  const previousCandidates = sqlite.prepare(`
    SELECT question_id AS id, title, choices_json
    FROM question_catalog
    WHERE source_kind = 'candidate'
  `).all().map((row) => ({
    id: row.id,
    title: row.title,
    choices: JSON.parse(row.choices_json),
  }));

  const candidates = JSON.parse(await readFile(candidateDataUrl, 'utf8')).candidates;
  const existing = [...staticQuestions, ...previousCandidates];
  for (const [index, candidate] of candidates.entries()) {
    const exactTitle = existing.find((question) => question.title === candidate.title);
    assert.equal(exactTitle, undefined, `${candidate.id} duplicates the title of ${exactTitle?.id}`);
    const strongest = existing.reduce((best, question) => {
      const score = questionSimilarity(candidate, question);
      return score > best.score ? { score, question } : best;
    }, { score: 0, question: null });
    assert.ok(
      strongest.score < 0.82,
      `${candidate.id} is too similar to ${strongest.question?.id}: ${strongest.score}`,
    );
    for (const otherCandidate of candidates.slice(index + 1)) {
      const score = questionSimilarity(candidate, otherCandidate);
      assert.ok(score < 0.82, `${candidate.id} is too similar to ${otherCandidate.id}: ${score}`);
    }
  }
});

test('追加候補100問はD1へ保留・通常版OFF・LIVE版OFFで入る', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(await readFile(new URL('../../migrations/0012_question_catalog_moderation.sql', import.meta.url), 'utf8'));
  sqlite.exec(await readFile(new URL('../../migrations/0019_add_held_question_candidates.sql', import.meta.url), 'utf8'));
  sqlite.exec(await readFile(new URL('../../migrations/0021_add_more_held_question_candidates.sql', import.meta.url), 'utf8'));

  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM question_catalog WHERE source_kind = 'candidate'").get().count, 200);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM question_catalog WHERE status = 'held'").get().count, 200);
  assert.equal(sqlite.prepare(`
    SELECT COUNT(*) AS count
    FROM question_catalog
    WHERE question_id BETWEEN 'HLD101' AND 'HLD200'
      AND status = 'held'
      AND use_challenge = 0
      AND use_live = 0
  `).get().count, 100);
  assert.deepEqual(
    sqlite.prepare(`
      SELECT substr(source_ref, 1, instr(source_ref, '-') - 1) AS source_group, COUNT(*) AS count
      FROM question_catalog
      WHERE question_id BETWEEN 'HLD101' AND 'HLD200'
      GROUP BY source_group
      ORDER BY source_group
    `).all().map((row) => [row.source_group, row.count]),
    [['100MON', 40], ['CSW', 35], ['RANK', 25]],
  );
});
