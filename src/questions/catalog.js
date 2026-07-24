export async function loadManagedQuestionCards(baseCards, series) {
  try {
    const response = await fetch('/api/questions/catalog', {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return baseCards;
    const data = await response.json();
    return applyManagedQuestionCards(baseCards, data.questions, series);
  } catch (error) {
    return baseCards;
  }
}

export function applyManagedQuestionCards(baseCards, managedQuestions, series) {
  const enabledKey = series === 'live' ? 'useLive' : 'useChallenge';
  const rows = Array.isArray(managedQuestions) ? managedQuestions : [];
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  const cards = [];

  for (const base of baseCards || []) {
    const row = byId.get(String(base.id));
    if (row && row[enabledKey] !== true) continue;
    cards.push(row ? {
      ...base,
      title: row.title,
      category: row.category || base.category,
      choices: row.choices.slice(0, 5),
    } : base);
  }

  const baseIds = new Set((baseCards || []).map((card) => String(card.id)));
  for (const row of rows) {
    if (row.sourceKind !== 'custom' || row[enabledKey] !== true || baseIds.has(String(row.id))) continue;
    if (!row.title || !Array.isArray(row.choices) || row.choices.length !== 5) continue;
    cards.push({
      id: row.id,
      category: row.category || 'みんなのお題',
      title: row.title,
      choices: row.choices.slice(0, 5),
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
  if (!response.ok) throw new Error(data.error || 'question-submission-failed');
  return data;
}
