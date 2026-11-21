// 2026-11-21 (Codex review #15): public pages that print question text and choices
// (library catalog, pack pages, guide examples) are built ahead of time. Each
// question carries data-qid; at request time the Worker removes the ones that are
// hidden in the review catalog, so a hidden question disappears everywhere.
const CACHE_MS = 60 * 1000;
let cached = { at: 0, ids: null };

export async function hiddenQuestionIds(env, now = Date.now()) {
  if (cached.ids && now - cached.at < CACHE_MS) return cached.ids;
  try {
    const result = await env?.REMOTE_DB?.prepare("SELECT question_id FROM question_catalog WHERE status <> 'approved'").all();
    if (!result) return cached.ids;
    cached = { at: now, ids: new Set((result.results || []).map((row) => String(row.question_id))) };
  } catch {
    // Keep the last known list; the pages themselves only hold reviewed built-in questions.
  }
  return cached.ids;
}

export function stripHiddenQuestions(html, ids) {
  if (!html || !ids || !ids.size || !html.includes('data-qid=')) return html;
  return html.replace(/<li data-qid="([^"]+)"[^>]*>[\s\S]*?<\/li>/g, (item, id) => (ids.has(id) ? '' : item));
}

export function resetHiddenQuestionCache() { cached = { at: 0, ids: null }; }
