import { localeFromPath, LOCALE_DETAILS, switchLocalePath } from './locales.js';
import { createCatalogTranslator, requireCompleteCatalog } from './catalog-core.js';
import { translateLegacyEnglish } from './legacy-copy.js';
import { rootPublicResource, rootPublicSourceSet } from './resource-paths.js';

export const SITE_LANGUAGE_KEY = 'watachan:language:v1';
export const currentLocale = localeFromPath(window.location.pathname);
export const languagePrefix = LOCALE_DETAILS[currentLocale].prefix;
export const isEnglish = currentLocale !== 'ja'; // Existing English question IDs are the international source library.
let translator = null;
if (currentLocale !== 'ja' && window.__WATACHAN_I18N__) {
  const data = window.__WATACHAN_I18N__;
  requireCompleteCatalog(data.entries, data.catalog, currentLocale);
  translator = createCatalogTranslator(data.entries, data.catalog.messages, { aliases: data.aliases });
}

const ATTRIBUTE_NAMES = ['aria-label', 'placeholder', 'title', 'alt'];

export function localizedPath(path = window.location.pathname) {
  try { return switchLocalePath(path, currentLocale); }
  catch { return path; }
}

export function protectUserCopy(values) {
  translator?.protect(values);
}

export function localizedAlert(message) { window.alert(translateText(message)); }
export function localizedConfirm(message) { return window.confirm(translateText(message)); }

export function translateText(value) {
  const raw = String(value ?? '');
  if (!isEnglish) return raw;
  if (!translator) return translateLegacyEnglish(raw);
  if (translator.isProtected(raw)) return raw;
  const direct = translator.translate(raw);
  return direct !== raw ? direct : translator.translate(translateLegacyEnglish(raw));
}


export function localizeDom(root = document) {
  if (!isEnglish || !root) return;
  document.documentElement.lang = currentLocale;
  document.documentElement.dir = LOCALE_DETAILS[currentLocale].direction;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    if (node.parentElement?.closest('script,style,[data-user-copy]')) return;
    const translated = translateText(node.nodeValue);
    if (translated !== node.nodeValue) node.nodeValue = translated;
  });
  root.querySelectorAll?.('*').forEach((element) => {
    for (const name of ['src', 'srcset']) {
      const value = element.getAttribute(name);
      if (!value) continue;
      const normalized = name === 'srcset' ? rootPublicSourceSet(value) : rootPublicResource(value);
      if (normalized !== value) element.setAttribute(name, normalized);
    }
    ATTRIBUTE_NAMES.forEach((name) => {
      if (element.hasAttribute(name)) {
        const value = element.getAttribute(name);
        const translated = translateText(value);
        if (translated !== value) element.setAttribute(name, translated);
      }
    });
  });
  root.querySelectorAll?.('a[href^="/"]').forEach((link) => {
    const href = link.getAttribute('href');
    if (!href || /^\/(?:api(?:\/|$)|assets(?:\/|$)|dist(?:\/|$))/.test(href)) return;
    const destination = localizedPath(href);
    if (destination !== href) link.setAttribute('href', destination);
  });
}

export function rememberCurrentLanguage() {
  try {
    window.localStorage.setItem(SITE_LANGUAGE_KEY, currentLocale);
  } catch (_) {
    // Storage can be blocked in private browsing; the URL still determines the language.
  }
}
