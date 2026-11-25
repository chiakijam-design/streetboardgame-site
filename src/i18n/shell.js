import { currentLocale, localizeDom } from './runtime.js';
import { LOCALE_DETAILS, switchLocalePath } from './locales.js';

const data = window.__WATACHAN_I18N__;
const LANGUAGE_SWITCH_LABEL = { ja: '言語を切り替える', en: 'Change language', es: 'Cambiar idioma', pt: 'Mudar idioma', fr: 'Changer de langue', de: 'Sprache ändern', it: 'Cambia lingua', ko: '언어 변경', 'zh-Hans': '切换语言', 'zh-Hant': '切換語言', ru: 'Сменить язык', uk: 'Змінити мову', pl: 'Zmień język', nl: 'Taal wijzigen', tr: 'Dili değiştir', id: 'Ganti bahasa', vi: 'Đổi ngôn ngữ', th: 'เปลี่ยนภาษา', ar: 'تغيير اللغة', he: 'החלפת שפה', hi: 'भाषा बदलें' };
if (data) {
  const start = () => {
    document.querySelectorAll('.site-language-switch,.site-language-offer').forEach((element) => element.remove());
    const select = document.createElement('select');
    // 2026-11-22（Gemini 見直し30）：読み上げで、言語を切り替える場所だと分かる名前に
    select.setAttribute('aria-label', LANGUAGE_SWITCH_LABEL[currentLocale] || 'Language');
    select.dataset.localeSwitcher = '';
    select.style.cssText = 'display:block;box-sizing:border-box;max-width:calc(100% - 16px);height:44px;min-height:44px;padding:4px 8px;font:inherit;line-height:1.35;margin:8px;position:relative;z-index:10';
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
    const slot = document.querySelector('[data-locale-switcher-slot]');
    // Existing answer/edit and LIVE sessions use the full viewport. Keep the
    // switcher available after the game instead of consuming their top space.
    const placeSwitcher = () => {
      const { challengeMode = '', liveChallengeView = '' } = document.documentElement.dataset;
      const fullscreen = challengeMode === 'creator-edit' || challengeMode.endsWith('-answer')
        || ['host', 'viewer'].includes(liveChallengeView);
      if (slot) slot.style.display = fullscreen ? 'none' : 'flow-root';
      if (fullscreen && document.body.lastElementChild !== select) document.body.append(select);
      else if (!fullscreen && slot && select.parentElement !== slot) slot.append(select);
      else if (!fullscreen && !slot && document.body.firstElementChild !== select) document.body.prepend(select);
    };
    placeSwitcher();
    new MutationObserver(placeSwitcher).observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-challenge-mode', 'data-live-challenge-view'],
    });
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
