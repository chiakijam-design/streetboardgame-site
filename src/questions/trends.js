const schemaReadyByDatabase = new WeakMap();
const QUESTION_ID_PATTERN = /^[A-Za-z0-9_-]{2,80}$/;
const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;

export function startOfJstWeek(now = Date.now()) {
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const date = new Date(Number(now) + jstOffsetMs);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime() - jstOffsetMs;
}

export async function recordQuestionSelections(env, cards, mode, now = Date.now()) {
  if (!await ensureQuestionTrendSchema(env)) return false;
  const questionIds = [...new Set((cards || [])
    .map((card) => String(card?.sourceId || card?.id || ''))
    .filter((id) => QUESTION_ID_PATTERN.test(id)))];
  if (!questionIds.length) return false;
  const normalizedMode = mode === 'live' ? 'live' : 'challenge';
  const weekStart = startOfJstWeek(now);
  await env.REMOTE_DB.batch(questionIds.map((questionId) => env.REMOTE_DB.prepare(`
    INSERT INTO question_weekly_activity
      (question_id, week_start, mode, selected_count, updated_at)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(question_id, week_start, mode) DO UPDATE SET
      selected_count = question_weekly_activity.selected_count + 1,
      updated_at = excluded.updated_at
  `).bind(questionId, weekStart, normalizedMode, Number(now))));
  return true;
}

export async function recordLiveAnswerDistribution(env, question, result, now = Date.now()) {
  if (!await ensureQuestionTrendSchema(env)) return false;
  const questionId = String(question?.sourceId || '');
  if (!QUESTION_ID_PATTERN.test(questionId)) return false;
  const counts = Array.isArray(result?.options)
    ? result.options.slice(0, 5).map((option) => Math.max(0, Number(option?.count) || 0))
    : [];
  if (!counts.some((count) => count > 0)) return false;
  const weekStart = startOfJstWeek(now);
  const statements = counts.flatMap((count, optionIndex) => count > 0 ? [env.REMOTE_DB.prepare(`
    INSERT INTO question_live_option_weekly
      (question_id, week_start, option_index, answer_count, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(question_id, week_start, option_index) DO UPDATE SET
      answer_count = question_live_option_weekly.answer_count + excluded.answer_count,
      updated_at = excluded.updated_at
  `).bind(questionId, weekStart, optionIndex, count, Number(now))] : []);
  if (!statements.length) return false;
  await env.REMOTE_DB.batch(statements);
  return true;
}

export async function getQuestionTrendMetrics(env, language = 'ja', now = Date.now()) {
  if (!await ensureQuestionTrendSchema(env)) {
    return { weeklySelections: [], recentApprovals: [], liveResponses: [] };
  }
  const weekStart = startOfJstWeek(now);
  const liveWindowStart = weekStart - FOUR_WEEKS_MS;
  const english = language === 'en';
  const [weeklyResult, recentResult, liveResult] = await Promise.all([
    env.REMOTE_DB.prepare(`
      SELECT question_id, SUM(selected_count) AS selected_count
      FROM question_weekly_activity
      WHERE week_start = ?
      GROUP BY question_id
      ORDER BY selected_count DESC, MAX(updated_at) DESC
      LIMIT 30
    `).bind(weekStart).all(),
    env.REMOTE_DB.prepare(`
      SELECT question_id, updated_at AS added_at
      FROM question_catalog
      WHERE status = 'approved'
        AND (
          (? = 1 AND (question_id LIKE 'CUSEN%' OR question_id LIKE 'EN%'))
          OR (? = 0 AND question_id NOT LIKE 'CUSEN%' AND question_id NOT LIKE 'EN%')
        )
      ORDER BY updated_at DESC, question_id ASC
      LIMIT 30
    `).bind(english ? 1 : 0, english ? 1 : 0).all(),
    env.REMOTE_DB.prepare(`
      SELECT question_id, option_index, SUM(answer_count) AS answer_count
      FROM question_live_option_weekly
      WHERE week_start >= ?
      GROUP BY question_id, option_index
      ORDER BY question_id ASC, option_index ASC
    `).bind(liveWindowStart).all(),
  ]);
  return {
    weeklySelections: (weeklyResult?.results || []).map((row) => ({
      questionId: String(row.question_id),
      selectedCount: Math.max(0, Number(row.selected_count) || 0),
    })),
    recentApprovals: (recentResult?.results || []).map((row) => ({
      questionId: String(row.question_id),
      addedAt: Math.max(0, Number(row.added_at) || 0),
    })),
    liveResponses: groupLiveResponseRows(liveResult?.results || []),
  };
}

export function buildRecentQuestionGroups(cards, metrics = {}, limit = 4) {
  const safeLimit = Math.max(1, Number(limit) || 4);
  const cardById = new Map((cards || []).map((card) => [String(card?.id || ''), card]));
  const takeCards = (rows) => rows
    .map((row) => ({ ...row, card: cardById.get(String(row.questionId)) }))
    .filter((item) => item.card)
    .slice(0, safeLimit);

  const weekly = takeCards((metrics.weeklySelections || [])
    .filter((row) => Number(row?.selectedCount) > 0)
    .sort((left, right) => Number(right.selectedCount) - Number(left.selectedCount)));

  const lowSkip = (cards || [])
    .map((card) => {
      const shownCount = Math.max(0, Number(card?.selectionShownCount) || 0);
      const skipCount = Math.min(shownCount, Math.max(0, Number(card?.selectionSkipCount) || 0));
      return { card, shownCount, skipCount, skipRate: shownCount ? skipCount / shownCount : 1 };
    })
    .filter((item) => item.shownCount >= 3)
    .sort((left, right) => left.skipRate - right.skipRate
      || right.shownCount - left.shownCount
      || String(left.card.title).localeCompare(String(right.card.title), 'ja'))
    .slice(0, safeLimit);

  const recent = takeCards((metrics.recentApprovals || [])
    .sort((left, right) => Number(right.addedAt) - Number(left.addedAt)));

  const liveSplit = takeCards((metrics.liveResponses || [])
    .map((row) => ({ ...row, ...liveSplitDetails(row.optionCounts) }))
    .filter((row) => row.totalAnswers >= 3 && row.activeChoices >= 2)
    .sort((left, right) => right.diversity - left.diversity
      || right.totalAnswers - left.totalAnswers));

  return { weekly, lowSkip, recent, liveSplit };
}

export function liveSplitDetails(optionCounts) {
  const counts = Array.from({ length: 5 }, (_, index) => (
    Math.max(0, Number(optionCounts?.[index]) || 0)
  ));
  const totalAnswers = counts.reduce((sum, count) => sum + count, 0);
  const activeChoices = counts.filter((count) => count > 0).length;
  const diversity = totalAnswers
    ? 1 - counts.reduce((sum, count) => sum + (count / totalAnswers) ** 2, 0)
    : 0;
  return { optionCounts: counts, totalAnswers, activeChoices, diversity };
}

export async function ensureQuestionTrendSchema(env) {
  const database = env?.REMOTE_DB;
  if (!database) return false;
  if (!schemaReadyByDatabase.has(database)) {
    const ready = (async () => {
      await database.prepare(`
        CREATE TABLE IF NOT EXISTS question_weekly_activity (
          question_id TEXT NOT NULL,
          week_start INTEGER NOT NULL,
          mode TEXT NOT NULL,
          selected_count INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (question_id, week_start, mode)
        )
      `).run();
      await database.prepare(`
        CREATE INDEX IF NOT EXISTS idx_question_weekly_activity_recent
        ON question_weekly_activity (week_start, selected_count DESC)
      `).run();
      await database.prepare(`
        CREATE TABLE IF NOT EXISTS question_live_option_weekly (
          question_id TEXT NOT NULL,
          week_start INTEGER NOT NULL,
          option_index INTEGER NOT NULL,
          answer_count INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (question_id, week_start, option_index)
        )
      `).run();
      await database.prepare(`
        CREATE INDEX IF NOT EXISTS idx_question_live_option_recent
        ON question_live_option_weekly (week_start, question_id)
      `).run();
    })();
    schemaReadyByDatabase.set(database, ready);
  }
  await schemaReadyByDatabase.get(database);
  return true;
}

function groupLiveResponseRows(rows) {
  const grouped = new Map();
  for (const row of rows || []) {
    const questionId = String(row.question_id || '');
    const optionIndex = Number(row.option_index);
    if (!QUESTION_ID_PATTERN.test(questionId)
      || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= 5) continue;
    const current = grouped.get(questionId) || Array(5).fill(0);
    current[optionIndex] += Math.max(0, Number(row.answer_count) || 0);
    grouped.set(questionId, current);
  }
  return [...grouped.entries()].map(([questionId, optionCounts]) => ({ questionId, optionCounts }));
}
