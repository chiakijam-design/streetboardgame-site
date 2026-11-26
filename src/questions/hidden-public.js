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
  return recountLibraryCatalog(html.replace(/<li data-qid="([^"]+)"[^>]*>[\s\S]*?<\/li>/g, (item, id) => (ids.has(id) ? '' : item)));
}

// 2026-11-27（Codex 見直し 11/26 ①-8）：非公開のお題を消したあとも、お題一覧の「全N問」・分類ごとの「（N問）」・
// 目次の数は組み立てたときのままだった（全158問と書いて119問だけ並ぶ）。残った行から数え直し、空の分類は目次ごと外す。
export function recountLibraryCatalog(html) {
  if (!html.includes('library-catalog__category')) return html;
  const counts = new Map();
  let out = html.replace(/<details class="library-catalog__category" id="(library-category-\d+)">([\s\S]*?)<\/details>/g, (block, id, inner) => {
    const count = (inner.match(/<li data-qid=/g) || []).length;
    counts.set(id, count);
    if (!count) return '';
    return block.replace(/(<summary><h3>[^<]*?（)\d+(問）<\/h3>)/, `$1${count}$2`);
  });
  out = out.replace(/<li><a href="#(library-category-\d+)">([^<]*?（)\d+(問）)<\/a><\/li>/g, (item, id, head, tail) => {
    if (!counts.has(id)) return item;
    return counts.get(id) ? `<li><a href="#${id}">${head}${counts.get(id)}${tail}</a></li>` : '';
  });
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return counts.size ? out.replace(/(収録しているお題の一覧（全)\d+(問）)/, `$1${total}$2`) : out;
}

// 2026-11-27（①-11）：10問パックのページは予備のお題まで並べて組み立てる。非公開を除いたあと、先頭の count 問だけを残す
// 予備も足りず count 問に届かないときは、いま載っている数と、作成のときはほかのお題でそろえることを書く。
const PACK_SHORT_NOTE = {
  ja: (n) => `いまは${n}問を載せています（一部のお題を見直し中です）。クイズを作るときは、ほかのお題を足して10問にそろえます。`,
  en: (n) => `${n} questions are listed right now (some are under review). When you make the quiz, other questions fill it up to 10.`,
  es: (n) => `Ahora se muestran ${n} preguntas (algunas están en revisión). Al crear el quiz, otras preguntas completan las 10.`,
  pt: (n) => `No momento, ${n} perguntas estão listadas (algumas estão em revisão). Ao criar o quiz, outras perguntas completam as 10.`,
};
export function trimPackQuestions(html, count = 10) {
  if (!html || !html.includes('data-pack-page=')) return html;
  const locale = (html.match(/<html\b[^>]*\blang="([a-z]{2})/i)?.[1] || 'ja').toLowerCase();
  return html.replace(/(<ol class="wata-guide__questions">)([\s\S]*?)(<\/ol>)/, (all, open, items, close) => {
    let kept = 0;
    const list = open + items.replace(/<li\b[\s\S]*?<\/li>/g, (item) => (kept++ < count ? item : '')) + close;
    const shown = Math.min(kept, count);
    return shown < count ? `${list}<p class="pack-short-note" data-testid="pack-short-note">${(PACK_SHORT_NOTE[locale] || PACK_SHORT_NOTE.en)(shown)}</p>` : list;
  });
}

export function resetHiddenQuestionCache() { cached = { at: 0, ids: null }; }
