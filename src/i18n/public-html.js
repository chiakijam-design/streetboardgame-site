import { createCatalogTranslator, requireCompleteCatalog } from './catalog-core.js';
import { LOCALE_DETAILS, TARGET_LOCALES, localeCanonicalPath, localeFromPath, switchLocalePath, stripLocalePrefix } from './locales.js';
import { LOCALE_SHELL_ASSET } from '../generated/locale-assets.js';
import { rootPublicResource, rootPublicSourceSet } from './resource-paths.js';

const origin = 'https://www.streetboardgame.com';
const entityValues = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', ndash: '–', mdash: '—' };
function decode(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (raw, code) => {
    if (code[0] === '#') {
      const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : raw;
    }
    return entityValues[code] ?? raw;
  });
}
function escape(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
export function safeScriptJson(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (char) => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
}

export function injectPublicLocaleShell(html, requestUrl, publicLocales) {
  const locale = localeFromPath(requestUrl.pathname);
  const canonical = origin + localeCanonicalPath(requestUrl.pathname, locale);
  const links = publicLocales.map((language) => `<link rel="alternate" hreflang="${language}" href="${origin}${localeCanonicalPath(requestUrl.pathname, language)}">`).join('');
  const data = { publicLocales, entries: [], aliases: {}, catalog: { locale, messages: {}, provenance: { method: 'original', nativeReview: false } } };
  return html.replace(/<link\b[^>]*\brel=["'](?:canonical|alternate)["'][^>]*>/gi, '')
    .replace(/<\/head>/i, `<link rel="canonical" href="${canonical}">${links}<link rel="alternate" hreflang="x-default" href="${origin}${localeCanonicalPath(requestUrl.pathname, 'ja')}"><script>window.__WATACHAN_I18N__=${safeScriptJson(data)};</script><script defer src="${LOCALE_SHELL_ASSET}"></script></head>`);
}

// Input is the site's own static HTML, never submitted names or answer data.
// Script/style blocks remain byte-for-byte untouched. Translation is escaped
// as text, and query/hash capabilities are excluded from public metadata.
export function localizePublicHtml(html, data, requestUrl, publicLocales = TARGET_LOCALES) {
  const locale = data.catalog.locale;
  requireCompleteCatalog(data.entries, data.catalog, localeFromPath(requestUrl.pathname));
  const translator = createCatalogTranslator(data.entries, data.catalog.messages, { aliases: data.aliases });
  const copy = (value) => escape(translator.translate(decode(value)));
  let output = html.replace(/(<script\b[\s\S]*?<\/script\s*>|<style\b[\s\S]*?<\/style\s*>|<!--[\s\S]*?-->)|(<[^>]+>)|([^<]+)/gi, (whole, protectedBlock, tag, text) => {
    if (protectedBlock) return protectedBlock;
    if (text) return copy(text);
    return tag.replace(/\b(src|srcset)=(['"])([\s\S]*?)\2/gi, (attribute, name, quote, value) => {
      const normalized = name.toLowerCase() === 'srcset' ? rootPublicSourceSet(value) : rootPublicResource(value);
      return normalized === value ? attribute : `${name}=${quote}${normalized}${quote}`;
    }).replace(/\b(aria-label|placeholder|alt|title|content)=(['"])([\s\S]*?)\2/gi,
      (attribute, name, quote, value) => {
        if (/^https?:\/\//.test(value) || !value.trim()) return attribute;
        return `${name}=${quote}${copy(value)}${quote}`;
      }).replace(/\bhref=(['"])(\/(?!\/)[^'"]*)\1/gi, (attribute, quote, href) => {
        try { return `href=${quote}${escape(switchLocalePath(decode(href), locale))}${quote}`; }
        catch { return attribute; }
      });
  });
  const details = LOCALE_DETAILS[locale];
  // New locale traffic must not silently expand the existing analytics tags
  // before regional consent and cookie policy have been reviewed. This flag
  // precedes the legacy synchronous analytics script in the game template.
  if (!['ja', 'en'].includes(locale)) output = output.replace(/<head\b[^>]*>/i, '$&<script>window.__WATACHAN_ANALYTICS_LOCALE_REVIEW_PENDING__=true;</script>');
  output = output.replace(/(<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi, (whole, open, json, close) => {
    try {
      function localizeValue(value, key = '') {
        if (Array.isArray(value)) return value.map((item) => localizeValue(item, key));
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, localizeValue(item, name)]));
        if (key === 'inLanguage') return locale;
        if (typeof value !== 'string') return value;
        if (value.startsWith(origin)) {
          try {
            const url = new URL(value);
            return origin + localeCanonicalPath(url.pathname, locale) + url.hash;
          } catch { return value; }
        }
        return translator.translate(value);
      }
      return open + safeScriptJson(localizeValue(JSON.parse(json))) + close;
    } catch { return whole; }
  });
  output = output.replace(/<html\b[^>]*>/i, `<html lang="${locale}" dir="${details.direction}">`);
  output = output.replace(/(<meta\b[^>]*\bproperty=["']og:locale["'][^>]*\bcontent=)["'][^"']*["']/gi, `$1"${locale.replace('-', '_')}"`);
  const canonical = origin + localeCanonicalPath(requestUrl.pathname, locale);
  output = output.replace(/<link\b[^>]*\brel=["'](?:canonical|alternate)["'][^>]*>/gi, '')
    .replace(/(<meta\b[^>]*\bproperty=["']og:url["'][^>]*\bcontent=)["'][^"']*["']/gi, `$1"${canonical}"`);
  const alternate = publicLocales.map((language) => `<link rel="alternate" hreflang="${language}" href="${origin}${localeCanonicalPath(requestUrl.pathname, language)}">`).join('');
  const publicData = { entries: data.entries, aliases: data.aliases, catalog: data.catalog, publicLocales };
  const additions = `<link rel="canonical" href="${canonical}">${alternate}<link rel="alternate" hreflang="x-default" href="${origin}${localeCanonicalPath(requestUrl.pathname, 'ja')}">`
    + `<style>html[lang="${locale}"] body{font-family:system-ui,sans-serif}html[dir=rtl] input,html[dir=rtl] textarea{direction:rtl}html[dir=rtl] [data-user-copy]{unicode-bidi:plaintext}button,a,p,h1,h2,h3{overflow-wrap:anywhere}html[lang="${locale}"] [data-testid=top-rules-title-line]{white-space:normal!important;overflow-wrap:anywhere}.challenge-result-share-button small span,.challenge-result-share-divider span{white-space:normal}.challenge-result-share-copy{max-width:100%}</style>`
    + `<script>window.__WATACHAN_I18N__=${safeScriptJson(publicData)};</script>`
    + (LOCALE_SHELL_ASSET ? `<script defer src="${LOCALE_SHELL_ASSET}"></script>` : '');
  output = output.replace(/<\/head>/i, additions + '</head>');
  // The canonical URL intentionally omits ?room and all management fragments.
  return output;
}

export function localizedAssetRoute(pathname) {
  const page = stripLocalePrefix(pathname).replace(/\/+$/, '') || '/';
  try { switchLocalePath(page, 'ja'); } catch { return null; }
  if (page === '/') return '/index.html';
  if (page === '/challenge' || page.startsWith('/challenge/')) return '/challenge.html';
  if (page === '/live-challenge') return '/live_challenge.html';
  return page;
}
