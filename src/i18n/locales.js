// Target list read from minna-web-shindan/content/build-locales.json on 2026-10-10.
// A target is not a claim of translated or production-ready content.
export const TARGET_LOCALES = Object.freeze([
  'ja', 'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'uk', 'pl', 'nl', 'sv',
  'da', 'no', 'fi', 'cs', 'el', 'ro', 'hu', 'bg', 'hr', 'sk', 'tr', 'ar',
  'he', 'hi', 'bn', 'id', 'ms', 'th', 'vi', 'ko', 'zh-Hans', 'zh-Hant',
]);

// Keep this separate from TARGET_LOCALES until every release check passes.
export const CURRENT_PUBLIC_LOCALES = Object.freeze(['ja', 'en']);

const nativeNames = [
  '日本語', 'English', 'Español', 'Français', 'Deutsch', 'Italiano',
  'Português', 'Русский', 'Українська', 'Polski', 'Nederlands', 'Svenska',
  'Dansk', 'Norsk', 'Suomi', 'Čeština', 'Ελληνικά', 'Română', 'Magyar',
  'Български', 'Hrvatski', 'Slovenčina', 'Türkçe', 'العربية', 'עברית',
  'हिन्दी', 'বাংলা', 'Bahasa Indonesia', 'Bahasa Melayu', 'ไทย',
  'Tiếng Việt', '한국어', '简体中文', '繁體中文',
];

export const LOCALE_DETAILS = Object.freeze(Object.fromEntries(TARGET_LOCALES.map((locale, index) => [
  locale,
  Object.freeze({
    name: nativeNames[index],
    direction: ['ar', 'he'].includes(locale) ? 'rtl' : 'ltr',
    prefix: locale === 'ja' ? '' : `/${locale}`,
    translationStatus: ['ja', 'en'].includes(locale) ? 'existing-unverified-coverage' : 'not-translated',
    nativeReview: 'not-verified',
  }),
])));

const localeByLowercase = new Map(TARGET_LOCALES.map((locale) => [locale.toLowerCase(), locale]));
const internalOrigin = 'https://www.streetboardgame.com';
const gamePages = new Set([
  '/', '/challenge', '/challenge/manage', '/challenge/ranking', '/challenge/library',
  '/live-challenge', '/challenge-guide', '/about', '/product', '/pricing',
  '/terms', '/privacy', '/legal', '/creator-terms', '/refund-policy',
  '/content-guidelines', '/minor-policy',
]);

export function normalizeLocale(value) {
  return localeByLowercase.get(String(value || '').toLowerCase()) || null;
}

export function localeFromPath(pathname) {
  return normalizeLocale(String(pathname || '').split('/')[1]) || 'ja';
}

export function stripLocalePrefix(pathname) {
  const path = String(pathname || '/');
  const first = path.split('/')[1];
  return normalizeLocale(first) ? path.slice(first.length + 1) || '/' : path;
}

// Query and fragment preserve existing invite, host and management capabilities.
// Callers must not use this output in public SEO/analytics metadata.
export function switchLocalePath(value, targetLocale) {
  const locale = normalizeLocale(targetLocale);
  if (!locale) throw new RangeError('Unknown locale');
  const url = new URL(value, internalOrigin);
  if (url.origin !== internalOrigin) throw new RangeError('External URL');
  const page = stripLocalePrefix(url.pathname).replace(/\/+$/, '') || '/';
  if (!gamePages.has(page)) throw new RangeError('Not a localizable public page');
  const prefix = LOCALE_DETAILS[locale].prefix;
  url.pathname = prefix + (page === '/' ? '/' : page);
  return url.pathname + url.search + url.hash;
}

// Index only stable public entries. Room IDs and all capability tokens are dropped.
export function localeCanonicalPath(value, locale) {
  const url = new URL(switchLocalePath(value, locale), internalOrigin);
  const page = stripLocalePrefix(url.pathname);
  if (['/challenge/manage', '/challenge/ranking'].includes(page)) {
    url.pathname = LOCALE_DETAILS[normalizeLocale(locale)].prefix + '/challenge';
  }
  return url.pathname;
}
