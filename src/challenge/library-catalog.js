// Crawlable, server-rendered Japanese catalog for /challenge/library.
// The interactive library app still renders above it; this section only lists
// the built-in questions and the editorial 10-question packs as plain HTML.
import { LIBRARY_CATALOG } from '../generated/library-catalog.js';
import { questionPacks } from './packs.js';

export const LIBRARY_CATALOG_MARKER = 'data-library-catalog';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function libraryCatalogQuestionCount(catalog = LIBRARY_CATALOG) {
  return catalog.reduce((total, category) => total + category.questions.length, 0);
}

function sortedCategories(catalog) {
  return catalog
    .map((category, index) => ({ ...category, index }))
    .sort((a, b) => b.questions.length - a.questions.length || a.index - b.index);
}

function questionItem(question) {
  return `<li><b>${escapeHtml(question.title)}</b><span>選択肢：${question.choices.map(escapeHtml).join('／')}</span></li>`;
}

function packSection(packs, byId) {
  const items = packs.map((pack) => {
    const included = pack.questionIds.map((id) => byId.get(id)).filter(Boolean);
    const extra = pack.questionIds.length - included.length;
    const list = included.length
      ? `<ul class="library-catalog__titles">${included.map((question) => `<li>${escapeHtml(question.title)}</li>`).join('')}</ul>`
      : '';
    const note = extra > 0 ? `<p class="library-catalog__note">このほか、運営が追加したお題が${extra}問入っています。</p>` : '';
    return `<article class="library-catalog__pack"><h3>${escapeHtml(pack.title)}</h3><p>${escapeHtml(pack.description)}</p>${list}${note}</article>`;
  }).join('');
  return `<h2 id="library-catalog-packs">目的別の10問パック</h2><p>相手との関係や話したいテーマに合わせて選べるパックです。パックを選ぶと、その中から10問でクイズを作れます。</p>${items}`;
}

export function renderLibraryCatalogSection(catalog = LIBRARY_CATALOG, packs = questionPacks(false)) {
  const total = libraryCatalogQuestionCount(catalog);
  const byId = new Map(catalog.flatMap((category) => category.questions.map((question) => [question.id, question])));
  const categories = sortedCategories(catalog);
  const index = categories.map((category, position) => `<li><a href="#library-category-${position + 1}">${escapeHtml(category.name)}（${category.questions.length}問）</a></li>`).join('');
  // Each category is a closed <details>: the questions stay in the HTML for
  // readers and crawlers, but the page stays short on phones.
  const lists = categories.map((category, position) => `<details class="library-catalog__category" id="library-category-${position + 1}"><summary><h3>${escapeHtml(category.name)}（${category.questions.length}問）</h3><span class="library-catalog__open">お題を見る</span></summary><ul class="library-catalog__questions">${category.questions.map(questionItem).join('')}</ul></details>`).join('');
  return `<section class="challenge-panel library-catalog" ${LIBRARY_CATALOG_MARKER} aria-labelledby="library-catalog-title">`
    + '<style>.library-catalog{margin-top:22px;text-align:start;line-height:1.7}.library-catalog h2{font-size:20px;margin:22px 0 8px}.library-catalog h2:first-of-type{margin-top:0}.library-catalog h3{font-size:17px;margin:18px 0 6px}.library-catalog ul{margin:6px 0 0;padding-inline-start:1.2em}.library-catalog li{margin:4px 0}.library-catalog__questions li span{display:block;font-size:13px!important;color:#5b4b52}.library-catalog__index{display:flex;flex-wrap:wrap;gap:6px 12px;list-style:none;padding:0!important}.library-catalog__index a{display:inline-flex;align-items:center;min-height:32px}.library-catalog__pack{margin-top:14px;padding-top:10px;border-top:1px dashed #c6b4bd}.library-catalog__note{font-size:13px!important;color:#5b4b52}.library-catalog__category{margin-top:8px;border-top:1px dashed #c6b4bd}.library-catalog__category summary{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:44px;cursor:pointer;list-style:none}.library-catalog__category summary::-webkit-details-marker{display:none}.library-catalog__category summary h3{margin:8px 0}.library-catalog__open{flex:none;font-size:13px;font-weight:800;text-decoration:underline}.library-catalog__category[open] .library-catalog__open{display:none}.library-catalog__cta{display:inline-flex;align-items:center;min-height:44px;margin-top:18px;font-weight:800}</style>'
    + `<h2 id="library-catalog-title">収録しているお題の一覧（全${total}問）</h2>`
    + '<p>わたし理解度診断で使える共通のお題です。出題者が1問ずつ「自分の答え」を選び、回答する人はその答えを予想します。当てることよりも、答え合わせのあとに「なんでそれを選んだの？」と話が広がるお題を集めています。</p>'
    + '<p>どのお題もクイズ作成画面でそのまま選べます。選択肢を書き換えたり、自分で問題を作ったりすることもできます。</p>'
    + '<h2 id="library-catalog-tips">お題選びのコツ</h2><ul>'
    + '<li>初対面や知り合ったばかりの相手には、「食べ物・飲み物」や「休日・遊び」のように迷わず答えられるお題から始めると予想しやすくなります。</li>'
    + '<li>付き合いの長い相手には、「もしも・妄想」や「性格・価値観」のお題で、まだ知らない一面を当ててもらうと盛り上がります。</li>'
    + '<li>答え合わせのあとは、選んだ理由をひと言ずつ話してみてください。点数より、その会話がこのゲームの本番です。</li>'
    + '</ul>'
    + packSection(packs, byId)
    + `<h2 id="library-catalog-categories">カテゴリ別のお題</h2><p>カテゴリ名を押すと、そのカテゴリのお題と選択肢が開きます。</p><ul class="library-catalog__index">${index}</ul>${lists}`
    + '<a class="library-catalog__cta" href="/challenge">このお題でクイズを作る ▶</a>'
    + '</section>';
}

const RENDERED_SECTION = renderLibraryCatalogSection();

export function injectLibraryCatalog(html) {
  if (!html || html.includes(LIBRARY_CATALOG_MARKER)) return html;
  const index = html.lastIndexOf('</main>');
  if (index < 0) return html;
  return html.slice(0, index) + RENDERED_SECTION + html.slice(index);
}

export function removeLibraryCatalog(html) {
  if (!html) return html;
  return html.replace(/<section class="challenge-panel library-catalog" data-library-catalog[\s\S]*?<\/section><\/main>/, '</main>');
}
