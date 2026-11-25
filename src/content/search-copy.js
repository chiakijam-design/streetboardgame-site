// Server-rendered reading copy for the search languages (2026-11-16).
// Each language has its own original text (src/content/copy-*.js); nothing
// here goes through the machine-translation catalog. The copy is added below
// the playable part of the page, so the first screen (name field and the
// create button) stays exactly as it was:
// - top page: cards after the existing page (below its footer links), outside
//   the first screen's container so that container and its decoration keep
//   exactly the same size and look
// - /challenge: a panel under the game, shown only on the first (name) screen
// - /challenge/library/<pack>: one page per 10-question pack
// `data-native-copy` keeps the browser-side translator away from this text.
import { PACK_QUESTIONS } from '../generated/pack-questions.js';
import { questionPacks } from '../challenge/packs.js';
import { resultSocialUrl, tagShareUrl } from '../platform/resultShare.js';
import JA from './copy-ja.js';
import EN from './copy-en.js';
import ES from './copy-es.js';
import PT from './copy-pt.js';

const ORIGIN = 'https://www.streetboardgame.com';
export const SEARCH_COPY = Object.freeze({ ja: JA, en: EN, es: ES, pt: PT });
export const SEARCH_COPY_LOCALES = Object.freeze(Object.keys(SEARCH_COPY));
export const PACK_SLUGS = Object.freeze(questionPacks(false).map((pack) => pack.slug));
// Related packs, chosen by theme (same in every language).
export const RELATED_PACKS = Object.freeze({
  'easy-first-meeting': ['food-preferences', 'holiday-outings', 'school-after-school'],
  'school-after-school': ['memories-past', 'easy-first-meeting', 'smartphone-social-fandom'],
  'food-preferences': ['easy-first-meeting', 'holiday-outings', 'my-manual'],
  'my-manual': ['unexpected-side', 'values-future', 'food-preferences'],
  'unexpected-side': ['my-manual', 'values-future', 'memories-past'],
  'holiday-outings': ['food-preferences', 'smartphone-social-fandom', 'easy-first-meeting'],
  'smartphone-social-fandom': ['holiday-outings', 'unexpected-side', 'school-after-school'],
  'values-future': ['my-manual', 'memories-past', 'unexpected-side'],
  'memories-past': ['school-after-school', 'values-future', 'unexpected-side'],
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
// Copy strings may contain [label](/path) links to the site's own pages.
function inline(value) {
  return escapeHtml(value).replace(/\[([^\]]+)\]\((\/[^)\s]*|#[a-z-]+)\)/g, (whole, label, href) => `<a href="${href}">${label}</a>`);
}
const prefix = (locale) => (locale === 'ja' ? '' : '/' + locale);
export const packPagePath = (slug, locale) => `${prefix(locale)}/challenge/library/${slug}`;
export const packPageUrl = (slug, locale) => ORIGIN + packPagePath(slug, locale);

export function matchPackPage(path) {
  const match = /^(?:\/([a-z]{2}(?:-[A-Za-z]{2,4})?))?\/challenge\/library\/([a-z0-9-]+)$/.exec(path);
  if (!match || !PACK_SLUGS.includes(match[2])) return null;
  return { locale: match[1] || 'ja', slug: match[2] };
}

function packTitle(slug, locale) {
  return SEARCH_COPY[locale].packs[slug].title;
}

function questionList(questions, copy) {
  return `<ol class="wata-guide__questions">${questions.map((question) => `<li${question.id ? ` data-qid="${escapeHtml(question.id)}"` : ''}><b>${escapeHtml(question.title)}</b><span>${escapeHtml(copy.ui.choices)}${question.choices.map(escapeHtml).join(copy.ui.choiceSeparator)}</span></li>`).join('')}</ol>`;
}

function packLinks(locale, slugs = PACK_SLUGS) {
  const copy = SEARCH_COPY[locale];
  return `<ul class="wata-guide__packs">${slugs.map((slug) => `<li><a href="${packPagePath(slug, locale)}">${escapeHtml(packTitle(slug, locale))}</a><span>${escapeHtml(copy.packs[slug].summary)}</span></li>`).join('')}</ul>`;
}

function section(part, locale) {
  const copy = SEARCH_COPY[locale];
  let html = `<h2>${escapeHtml(part.h)}</h2>`;
  for (const text of part.p || []) html += `<p>${inline(text)}</p>`;
  if (part.ul) html += `<ul>${part.ul.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`;
  if (part.ol) html += `<ol class="wata-guide__steps">${part.ol.map((item) => `<li>${inline(item)}</li>`).join('')}</ol>`;
  if (part.examples) html += questionList(part.examples.map(([slug, index]) => PACK_QUESTIONS[slug][locale][index]), copy);
  if (part.packs) html += packLinks(locale);
  if (part.faq) html += `<dl class="wata-guide__faq">${part.faq.map(([question, answer]) => `<dt>${inline(question)}</dt><dd>${inline(answer)}</dd>`).join('')}</dl>`;
  for (const text of part.after || []) html += `<p>${inline(text)}</p>`;
  if (part.cta) html += `<p class="wata-guide__cta"><a href="${escapeHtml(part.cta[1])}">${escapeHtml(part.cta[0])}</a></p>`;
  return html;
}

const SHARED_STYLE = '.wata-guide{text-align:start;font-family:inherit;font-weight:500;line-height:1.8;color:#1A1A1A}'
  + '.wata-guide h2{margin:0 0 10px;font-size:19px;line-height:1.45;font-weight:900}'
  + '.wata-guide p{margin:0 0 10px;font-size:14px}.wata-guide ul,.wata-guide ol{margin:0 0 10px;padding-inline-start:1.3em;font-size:14px}.wata-guide li{margin:5px 0}'
  + '.wata-guide a{color:#B81745;font-weight:800;text-underline-offset:3px}'
  + '.wata-guide__questions li b{display:block}.wata-guide__questions li span{display:block;font-size:13px;color:#5b4b52}'
  + '.wata-guide__packs{list-style:none;padding:0!important}.wata-guide__packs li{padding:8px 0;border-top:1px dashed #c6b4bd}.wata-guide__packs a{display:inline-flex;align-items:center;min-height:32px}.wata-guide__packs span{display:block;font-size:13px;color:#5b4b52}'
  + '.wata-guide__faq{margin:0}.wata-guide__faq dt{margin-top:12px;font-size:14px;font-weight:900}.wata-guide__faq dd{margin:4px 0 0;font-size:14px}'
  + '.wata-guide__cta a{display:inline-flex;align-items:center;min-height:44px}';

// Top page: one card per section, styled like the name form above it, on a
// strip with the same width and color as the page above.
export function renderHomeCopy(locale) {
  const copy = SEARCH_COPY[locale];
  if (!copy) return '';
  const style = '<style>' + SHARED_STYLE
    + '.wata-guide--home{box-sizing:border-box;display:grid;gap:14px;width:100%;max-width:600px;margin:0 auto;padding:8px 24px 32px;background:#EC4F88;font-family:"Noto Sans JP",sans-serif}html[lang]:not([lang="ja"]) .wata-guide--home{font-family:system-ui,sans-serif}'
    + '.wata-guide--home .wata-guide__card{padding:16px 16px 8px;background:#FFFFFF;border:3px solid #1A1A1A;border-radius:18px;box-shadow:5px 5px 0 #D63A75}'
    + '</style>';
  return `<div class="wata-guide wata-guide--home" data-native-copy data-wata-guide="home" lang="${locale}">${style}`
    + copy.home.map((part) => `<section class="wata-guide__card">${section(part, locale)}</section>`).join('')
    + '</div>';
}

// /challenge: one panel under the game. While someone is writing or answering
// questions (any mode other than the first screen) it is hidden.
export function renderChallengeCopy(locale) {
  const copy = SEARCH_COPY[locale];
  if (!copy) return '';
  const style = '<style>' + SHARED_STYLE
    + 'html[data-challenge-mode]:not([data-challenge-mode="create"]) .wata-guide--challenge{display:none}'
    + '.wata-guide--challenge h2{margin-top:22px}.wata-guide--challenge h2:first-of-type{margin-top:0}'
    + '</style>';
  return `<section class="challenge-panel wata-guide wata-guide--challenge" data-native-copy data-wata-guide="challenge" lang="${locale}">${style}`
    + copy.challenge.map((part) => section(part, locale)).join('')
    + '</section>';
}

// /<locale>/challenge/library: crawlable links to the pack pages.
export function renderLibraryPackLinks(locale) {
  const copy = SEARCH_COPY[locale];
  if (!copy) return '';
  return `<section class="challenge-panel wata-guide" data-native-copy data-wata-guide="library" lang="${locale}"><style>${SHARED_STYLE}</style>`
    + `<h2>${escapeHtml(copy.ui.packListTitle)}</h2><p>${inline(copy.ui.packListLead)}</p>${packLinks(locale)}</section>`;
}

export function injectHomeCopy(html, locale) {
  if (!html || !SEARCH_COPY[locale] || html.includes('data-wata-guide="home"')) return html;
  const end = html.indexOf('<!-- /home-prerender -->');
  if (end < 0) return html;
  const mainEnd = html.lastIndexOf('</main>', end);
  const at = mainEnd > 0 ? mainEnd + '</main>'.length : end;
  return html.slice(0, at) + renderHomeCopy(locale) + html.slice(at);
}

function beforeMainEnd(html, addition) {
  const at = html.lastIndexOf('</main>');
  return at < 0 ? html : html.slice(0, at) + addition + html.slice(at);
}
export function injectChallengeCopy(html, locale) {
  if (!html || !SEARCH_COPY[locale] || html.includes('data-wata-guide="challenge"')) return html;
  return beforeMainEnd(html, renderChallengeCopy(locale));
}
// お題ライブラリの見出しは /challenge と同じ文にせず「10問パック」にする（2026-11-16）。
export function setLibraryHeading(html, locale) {
  if (!html || !SEARCH_COPY[locale]) return html;
  return html.replace(/(<div class="challenge-app-placeholder__hero"><h1>)[\s\S]*?(<\/h1>)/, `$1${escapeHtml(SEARCH_COPY[locale].ui.packListTitle)}$2`);
}
export function injectLibraryPackLinks(html, locale) {
  if (!html || !SEARCH_COPY[locale] || html.includes('data-wata-guide="library"')) return setLibraryHeading(html, locale);
  return setLibraryHeading(beforeMainEnd(html, renderLibraryPackLinks(locale)), locale);
}
// Localized pages (en/es/pt) after translation: page is the path without the locale.
export function injectSearchCopy(html, locale, page) {
  if (page === '/') return injectHomeCopy(html, locale);
  if (page === '/challenge') return injectChallengeCopy(html, locale);
  if (page === '/challenge/library') return injectLibraryPackLinks(html, locale);
  return html;
}

const PAGE_STYLE = `*{box-sizing:border-box}body{margin:0;background:#EC4F88;color:#1A1A1A;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif}`
  + '.pack-page{width:min(100%,640px);margin:0 auto;padding:14px 14px 40px}'
  + '.pack-top{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#1A1A1A;font-weight:900;font-size:14px}.pack-page .pack-top a{color:#1A1A1A;display:inline-flex;align-items:center;min-height:44px}'
  + '.pack-hero{margin:8px 0 16px;padding:20px 18px;background:#FFEAF1;border:3px solid #1A1A1A;border-radius:18px;box-shadow:5px 5px 0 #D63A75}'
  + '.pack-hero p.eyebrow{margin:0 0 6px;font-size:12px;font-weight:900;letter-spacing:.08em}.pack-hero h1{margin:0 0 10px;font-size:clamp(22px,6vw,28px);line-height:1.35}.pack-hero p{margin:0;font-size:15px;line-height:1.75}'
  + '.pack-create{display:flex;align-items:center;justify-content:center;width:100%;min-height:56px;margin-top:14px;padding:12px 16px;border:2.5px solid #1A1A1A;border-radius:14px;background:#1A1A1A;color:#fff!important;box-shadow:4px 4px 0 #5BD4E8;font-size:16px;font-weight:900;text-decoration:none;text-align:center}'
  + '.pack-card{margin-top:14px;padding:16px 16px 8px;background:#fff;border:3px solid #1A1A1A;border-radius:18px}'
  + '.pack-langs{margin:14px 0 0;color:#1A1A1A;font-size:13px}.pack-page .pack-langs a{color:#1A1A1A;font-weight:800;margin-inline-end:12px;display:inline-flex;min-height:32px;align-items:center}'
  + '.pack-send{display:flex;flex-wrap:wrap;gap:10px;margin:4px 0 10px}.pack-page .pack-send a,.pack-send button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:88px;padding:8px 16px;border:2.5px solid #1A1A1A;border-radius:999px;background:#fff;color:#1A1A1A;font:inherit;font-size:15px;font-weight:900;text-decoration:none;cursor:pointer}.pack-send button[hidden]{display:none}'
  + '.pack-footer{margin-top:22px;color:#1A1A1A;font-size:12px;line-height:1.8}.pack-page .pack-footer a{color:#1A1A1A;margin-inline-end:12px;display:inline-flex;min-height:32px;align-items:center}';

// 2026-11-21 (Codex review #23): a pack page can be sent to a friend without making a quiz first.
const PACK_SEND_COPY = Object.freeze({
  ja: 'この10問を友だちに送る',
  en: 'Send these 10 questions to a friend',
  es: 'Envía estas 10 preguntas a un amigo',
  pt: 'Envie estas 10 perguntas a um amigo',
});
// 2026-11-22（Gemini 見直し19）：Instagram やメッセージに貼れるよう、リンクのコピーも置く
const PACK_COPY_LINK = Object.freeze({
  ja: ['リンクをコピー', 'コピーしました'],
  en: ['Copy link', 'Copied'],
  es: ['Copiar enlace', 'Enlace copiado'],
  pt: ['Copiar link', 'Link copiado'],
});

function packSendLinks(title, url, slug, locale) {
  const [copyLabel, copiedLabel] = PACK_COPY_LINK[locale] || PACK_COPY_LINK.en;
  const tagged = (method) => tagShareUrl(url, method, `pack_${slug}`);
  const copyUrl = escapeHtml(tagged('copy'));
  const socialUrl = (method) => escapeHtml(resultSocialUrl(method, `${title}\n${tagged(method)}`));
  return '<p class="pack-send">'
    + `<a href="${socialUrl('line')}" target="_blank" rel="noopener noreferrer">LINE</a> `
    + `<a href="${socialUrl('x')}" target="_blank" rel="noopener noreferrer">X</a> `
    + `<a href="${socialUrl('whatsapp')}" target="_blank" rel="noopener noreferrer">WhatsApp</a> `
    + `<button type="button" data-pack-copy="${copyUrl}" data-copied="${escapeHtml(copiedLabel)}" hidden>${escapeHtml(copyLabel)}</button>`
    + `</p><input type="text" data-pack-copy-fallback dir="ltr" aria-label="${escapeHtml(copyLabel)}" value="${copyUrl}" style="max-width:100%" readonly hidden><script defer src="/pack-send.js?v=20261125"></script>`;
}

const PACK_OG_LOCALE = Object.freeze({ ja: 'ja_JP', en: 'en_US', es: 'es_ES', pt: 'pt_BR' });

export function renderPackPage(slug, locale) {
  const copy = SEARCH_COPY[locale];
  const pack = copy.packs[slug];
  const ui = copy.ui;
  const title = pack.title + ui.titleSuffix;
  const url = packPageUrl(slug, locale);
  const image = ORIGIN + (locale === 'ja' ? '/assets/ogp-challenge-v4.jpg?v=20261115-jpg' : locale === 'en' ? '/assets/ogp-challenge-en-v2.jpg?v=20261115-jpg' : `/assets/locale-share/${locale}.png?v=20261010-i18n-1`);
  const libraryPath = prefix(locale) + '/challenge/library';
  const createPath = `${prefix(locale)}/challenge?pack=${encodeURIComponent(slug)}`;
  const alternates = SEARCH_COPY_LOCALES.map((language) => `<link rel="alternate" hreflang="${language}" href="${packPageUrl(slug, language)}">`).join('')
    + `<link rel="alternate" hreflang="x-default" href="${packPageUrl(slug, 'ja')}">`;
  const structured = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': url + '#webpage', url, name: title, description: pack.description, inLanguage: locale,
        isPartOf: { '@type': 'WebSite', name: ui.siteName, url: ORIGIN + (prefix(locale) || '') + '/' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: ui.siteName, item: ORIGIN + prefix(locale) + '/' },
        { '@type': 'ListItem', position: 2, name: ui.libraryName, item: ORIGIN + libraryPath },
        { '@type': 'ListItem', position: 3, name: pack.title, item: url },
      ] },
    ],
  }).replace(/[<>&\u2028\u2029]/g, (char) => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
  const card = (heading, body) => `<section class="pack-card"><h2>${escapeHtml(heading)}</h2>${body}</section>`;
  const list = (items) => `<ul>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`;
  const languages = SEARCH_COPY_LOCALES.filter((language) => language !== locale)
    .map((language) => `<a href="${packPagePath(slug, language)}" hreflang="${language}" lang="${language}">${escapeHtml(SEARCH_COPY[language].ui.languageName)}</a>`).join('');
  return '<!doctype html>\n'
    + `<html lang="${locale}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
    + `<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(pack.description)}"><meta name="robots" content="index, follow">`
    + `<link rel="canonical" href="${url}">${alternates}`
    + `<meta property="og:type" content="article"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(pack.description)}"><meta property="og:url" content="${url}"><meta property="og:site_name" content="${escapeHtml(ui.siteName)}">`
    // 2026-11-21 (Codex review #3): Spanish and Portuguese pack pages use the same language image as their library page.
    // 2026-11-22（Gemini 見直し12）：言語・画像の種類と大きさ・説明、X 用の題・説明・画像も出す
    + `<meta property="og:locale" content="${PACK_OG_LOCALE[locale] || 'en_US'}">`
    + `<meta property="og:image" content="${image}"><meta property="og:image:secure_url" content="${image}"><meta property="og:image:type" content="${image.includes('.png') ? 'image/png' : 'image/jpeg'}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${escapeHtml(title)}">`
    + `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(pack.description)}"><meta name="twitter:image" content="${image}"><meta name="twitter:image:alt" content="${escapeHtml(title)}">`
    + '<link rel="icon" href="/favicon.ico">'
    + `<script type="application/ld+json">${structured}</script>`
    + (['ja', 'en'].includes(locale) ? '' : '<script>window.__WATACHAN_ANALYTICS_LOCALE_REVIEW_PENDING__=true;</script>')
    + '<script defer src="/analytics.js"></script>'
    + `<style>${PAGE_STYLE}${SHARED_STYLE}.pack-card h2{font-size:18px}</style></head>`
    + `<body><main class="pack-page wata-guide" data-native-copy data-pack-page="${slug}">`
    + `<header class="pack-top"><a href="${prefix(locale)}/">${escapeHtml(ui.siteName)}</a><a href="${libraryPath}">${escapeHtml(ui.libraryName)}</a></header>`
    + `<section class="pack-hero"><p class="eyebrow">${escapeHtml(ui.packEyebrow)}</p><h1>${escapeHtml(pack.title)}</h1><p>${inline(pack.lead)}</p>`
    + `<a class="pack-create" href="${createPath}">${escapeHtml(ui.create)} ▶</a></section>`
    + card(ui.about, pack.body.map((text) => `<p>${inline(text)}</p>`).join(''))
    + card(ui.questions, `<p>${inline(ui.questionsLead)}</p>${questionList(PACK_QUESTIONS[slug][locale], copy)}`)
    + card(ui.scenes, list(pack.scenes))
    + card(ui.tips, list(pack.tips))
    + card(ui.talk, `<p>${inline(ui.talkLead)}</p>${list(pack.talk)}`)
    + card(ui.steps, `<ol class="wata-guide__steps">${ui.stepsList.map((item) => `<li>${inline(item)}</li>`).join('')}</ol><p class="wata-guide__cta"><a href="${createPath}">${escapeHtml(ui.create)} ▶</a></p>`)
    + card(PACK_SEND_COPY[locale] || PACK_SEND_COPY.en, packSendLinks(pack.title, url, slug, locale))
    + card(ui.related, packLinks(locale, RELATED_PACKS[slug]) + `<p><a href="${libraryPath}">${escapeHtml(ui.allPacks)}</a></p>`)
    + `<p class="pack-langs">${escapeHtml(ui.otherLanguages)}: ${languages}</p>`
    + `<footer class="pack-footer">${ui.footer.map(([href, label]) => `<a href="${href}">${escapeHtml(label)}</a>`).join('')}<p>${escapeHtml(ui.footnote)}</p></footer>`
    + '</main></body></html>\n';
}
