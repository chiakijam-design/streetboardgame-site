import { currentLocale, localizeDom } from './runtime.js';
import { LOCALE_DETAILS, switchLocalePath } from './locales.js';

const data = window.__WATACHAN_I18N__;
if (data) {
  const start = () => {
    document.querySelectorAll('.site-language-switch,.site-language-offer').forEach((element) => element.remove());
    const select = document.createElement('select');
    select.setAttribute('aria-label', LOCALE_DETAILS[currentLocale].name);
    select.dataset.localeSwitcher = '';
    select.style.cssText = 'max-width:calc(100% - 16px);min-height:44px;font:inherit;margin:8px;position:relative;z-index:10';
    for (const locale of data.publicLocales) {
      const option = document.createElement('option');
      option.value = locale;
      option.textContent = LOCALE_DETAILS[locale].name;
      option.selected = locale === currentLocale;
      select.append(option);
    }
    select.addEventListener('change', () => {
      const destination = switchLocalePath(location.pathname + location.search + location.hash, select.value);
      try { localStorage.setItem('watachan:language:v1', select.value); } catch {}
      location.assign(destination);
    });
    document.body.prepend(select);
    localizeDom(document);
    if (currentLocale === 'ja') return;
    let pending = false;
    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; localizeDom(document); });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
