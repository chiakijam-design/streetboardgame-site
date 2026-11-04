// Only acknowledge canonical server responses; never optimistically publish a decision.
export function withSavedCatalog(overview, question) {
  if (!question || typeof question.id !== 'string' || typeof question.title !== 'string'
    || !Array.isArray(question.choices) || !['approved', 'held', 'disabled', 'quarantined'].includes(question.status)) return null;
  const catalog = [...(overview.catalog || [])];
  const index = catalog.findIndex(item => String(item.id) === question.id);
  if (index < 0) catalog.push(question);
  else catalog[index] = { ...catalog[index], ...question };
  return { ...overview, catalog };
}

export function withReviewedSubmission(overview, result, total, offset = 0) {
  if (!result || !['approved', 'rejected'].includes(result.status)) return null;
  const id = String(result.submissionId || '');
  if (!(overview.submissions || []).some(item => String(item.id) === id && item.status === 'pending')) return null;
  let next = overview;
  if (result.status === 'approved') {
    if (result.question?.id !== result.catalogId) return null;
    next = withSavedCatalog(overview, result.question);
    if (!next) return null;
  }
  return {
    ...next,
    submissions: (next.submissions || []).filter(item => String(item.id) !== id),
    submissionPagination: { offset, limit: 50, total: Math.max(0, Number(total) - 1) },
  };
}
