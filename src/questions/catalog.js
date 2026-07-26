export async function loadManagedQuestionCards(baseCards, series, language = 'ja') {
  try {
    const response = await fetch('/api/questions/catalog', {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return baseCards;
    const data = await response.json();
    return applyManagedQuestionCards(baseCards, data.questions, series, language);
  } catch (error) {
    return baseCards;
  }
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
