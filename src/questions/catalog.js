export const QUESTION_VIEW_HISTORY_KEY = 'watachan:question-view-history:v1';
const MAX_QUESTION_VIEW_HISTORY = 500;

export async function loadManagedQuestionCards(baseCards, series, language = 'ja') {
  try {
    const response = await fetch('/api/questions/catalog', {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return applyQuestionViewHistory(baseCards);
    const data = await response.json();
    const cards = applyManagedQuestionCards(baseCards, data.questions, series, language);
    return applyQuestionViewHistory(applyQuestionSelectionStats(cards, data.selectionStats, series));
  } catch (error) {
    return applyQuestionViewHistory(baseCards);
  }
}

export async function loadQuestionTrendMetrics(language = 'ja') {
  try {
    const response = await fetch(`/api/questions/trends?lang=${language === 'en' ? 'en' : 'ja'}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return { weeklySelections: [], recentApprovals: [], liveResponses: [] };
    return await response.json();
  } catch (error) {
    return { weeklySelections: [], recentApprovals: [], liveResponses: [] };
  }
}

let selectionEventQueue = Promise.resolve();

export function recordQuestionSelectionEvent(questionId, mode, event) {
  const payload = {
    questionId: String(questionId || ''),
    mode: mode === 'live' ? 'live' : 'challenge',
    event: event === 'skipped' ? 'skipped' : 'shown',
  };
  if (!/^[A-Za-z0-9_-]{2,80}$/.test(payload.questionId)) return Promise.resolve(false);
  if (payload.event === 'shown') recordQuestionViewHistory(payload.questionId);
  selectionEventQueue = selectionEventQueue
    .catch(() => false)
    .then(async () => {
      const response = await fetch('/api/questions/selection-events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      return response.ok;
    })
    .catch(() => false);
  return selectionEventQueue;
}

export function applyQuestionViewHistory(cards, storage = availableLocalStorage()) {
  const history = readQuestionViewHistory(storage);
  return (cards || []).map((card) => ({
    ...card,
    personalSeenCount: Math.max(0, Number(history[String(card.id)]) || 0),
  }));
}

export function recordQuestionViewHistory(questionId, storage = availableLocalStorage()) {
  const id = String(questionId || '');
  if (!/^[A-Za-z0-9_-]{2,80}$/.test(id) || !storage) return false;
  const history = readQuestionViewHistory(storage);
  history[id] = Math.min(1000, Math.max(0, Number(history[id]) || 0) + 1);
  const ids = Object.keys(history);
  while (ids.length > MAX_QUESTION_VIEW_HISTORY) {
    delete history[ids.shift()];
  }
  try {
    storage.setItem(QUESTION_VIEW_HISTORY_KEY, JSON.stringify(history));
    return true;
  } catch (error) {
    return false;
  }
}

function readQuestionViewHistory(storage) {
  if (!storage) return {};
  try {
    const parsed = JSON.parse(storage.getItem(QUESTION_VIEW_HISTORY_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function availableLocalStorage() {
  try {
    return globalThis.localStorage || null;
  } catch (error) {
    return null;
  }
}

export function applyQuestionSelectionStats(cards, selectionStats, mode) {
  const normalizedMode = mode === 'live' ? 'live' : 'challenge';
  const stats = new Map((Array.isArray(selectionStats) ? selectionStats : [])
    .filter((row) => row?.mode === normalizedMode)
    .map((row) => [String(row.questionId), row]));
  return (cards || []).map((card) => {
    const row = stats.get(String(card.id));
    return {
      ...card,
      selectionShownCount: Math.max(0, Number(row?.shownCount) || 0),
      selectionSkipCount: Math.max(0, Number(row?.skipCount) || 0),
    };
  });
}

export function applyManagedQuestionCards(baseCards, managedQuestions, series, language = 'ja') {
  const rows = Array.isArray(managedQuestions) ? managedQuestions : [];
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  const cards = [];

  for (const base of baseCards || []) {
    const row = byId.get(String(base.id));
    if (row && row.status !== 'approved') continue;
    cards.push(row ? {
      ...base,
      title: row.title,
      category: row.category || base.category,
      choices: row.choices.slice(0, 5),
      managedQuestionId: row.id,
      reportable: row.sourceKind === 'custom',
    } : base);
  }

  const baseIds = new Set((baseCards || []).map((card) => String(card.id)));
  for (const row of rows) {
    if (!['custom', 'candidate'].includes(row.sourceKind) || row.status !== 'approved'
      || (row.language || 'ja') !== language
      || baseIds.has(String(row.id))) continue;
    if (!row.title || !Array.isArray(row.choices) || row.choices.length !== 5) continue;
    cards.push({
      id: row.id,
      category: row.category || 'みんなのお題',
      title: row.title,
      choices: row.choices.slice(0, 5),
      sourceKind: row.sourceKind,
      managedQuestionId: row.id,
      reportable: row.sourceKind === 'custom',
    });
  }
  return cards;
}

export function changedQuestionCandidates(drafts, sourceCards) {
  const sourceById = new Map((sourceCards || []).map((card) => [String(card.id), card]));
  return (drafts || []).flatMap((draft) => {
    const title = String(draft.title || draft.text || '').trim();
    const choices = (draft.choices || draft.options || []).map((choice) => String(choice || '').trim());
    if (!title || choices.length !== 5 || choices.some((choice) => !choice)) return [];
    const source = sourceById.get(String(draft.sourceId || ''));
    const unchanged = source
      && title === String(source.title || '').trim()
      && choices.every((choice, index) => choice === String(source.choices?.[index] || '').trim());
    return unchanged ? [] : [{
      sourceQuestionId: source ? String(source.id) : null,
      title,
      choices,
    }];
  });
}

export async function submitQuestionCandidates({ consent, sourceMode, questions }) {
  if (consent !== true || !Array.isArray(questions) || !questions.length) {
    return { submitted: 0, skipped: true };
  }
  const response = await fetch('/api/questions/submissions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ consent: true, sourceMode, questions }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'question-submission-failed');
    error.flags = Array.isArray(data.flags) ? data.flags : [];
    throw error;
  }
  return data;
}

export async function reportManagedQuestion(questionId, reason, detail = '') {
  const response = await fetch(`/api/questions/catalog/${encodeURIComponent(questionId)}/report`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason, detail }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'question-report-failed');
  return data;
}
