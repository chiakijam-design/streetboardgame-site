(function languageSwitch() {
  const KEY = 'watachan:language:v1';
  const path = window.location.pathname;
  const english = /^\/en(?:\/|$)/.test(path);
  const stripEnglish = (value) => value.replace(/^\/en(?=\/|$)/, '') || '/';
  const japanesePath = stripEnglish(path);
  const englishPath = `/en${japanesePath === '/' ? '/' : japanesePath}`;

  function save(language) {
    try { window.localStorage.setItem(KEY, language); } catch (_) {}
  }

  function destination(language) {
    const nextPath = language === 'en' ? englishPath : japanesePath;
    return `${nextPath}${window.location.search}${window.location.hash}`;
  }

  function addStyles() {
    if (document.getElementById('site-language-style')) return;
    const style = document.createElement('style');
    style.id = 'site-language-style';
    style.textContent = `
      .site-language-switch{position:absolute;z-index:2147483000;top:max(8px,env(safe-area-inset-top));right:8px;display:flex;align-items:center;min-height:44px;padding:4px;background:rgba(255,255,255,.96);border:2px solid #191919;border-radius:999px;box-shadow:2px 3px 0 #191919;font:800 13px/1.2 Arial,"Yu Gothic",sans-serif;color:#191919}
      .site-language-switch a{display:grid;min-height:34px;place-items:center;padding:0 10px;border-radius:999px;color:#191919;text-decoration:none;white-space:nowrap}
      .site-language-switch a[aria-current="page"]{background:#ffe36f}
      .site-language-offer{position:fixed;z-index:2147482999;left:50%;top:max(62px,calc(env(safe-area-inset-top) + 54px));width:min(calc(100% - 24px),460px);transform:translateX(-50%);padding:14px;background:#fff;border:3px solid #191919;border-radius:16px;box-shadow:5px 6px 0 #191919;color:#191919;font:700 14px/1.5 Arial,"Yu Gothic",sans-serif;text-align:left}
      .site-language-offer strong{display:block;font-size:17px}.site-language-offer-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.site-language-offer button{min-height:44px;border:2px solid #191919;border-radius:10px;background:#fff;font:800 14px Arial,"Yu Gothic",sans-serif}.site-language-offer button:first-child{background:#ffe36f}
      @media(max-width:420px){.site-language-switch{font-size:12px}.site-language-switch a{padding-inline:8px}}
    `;
    document.head.appendChild(style);
  }

  function mount() {
    addStyles();
    if (!document.querySelector('.site-language-switch')) {
      const nav = document.createElement('nav');
      nav.className = 'site-language-switch';
      nav.setAttribute('aria-label', english ? 'Language' : '言語');
      nav.innerHTML = `<a href="${destination('ja')}" data-site-language="ja" ${english ? '' : 'aria-current="page"'}>日本語</a><span aria-hidden="true">／</span><a href="${destination('en')}" data-site-language="en" ${english ? 'aria-current="page"' : ''}>English</a>`;
      nav.addEventListener('click', (event) => {
        const link = event.target.closest('[data-site-language]');
        if (link) save(link.dataset.siteLanguage);
      });
      document.body.appendChild(nav);
    }

    let saved = '';
    try { saved = window.localStorage.getItem(KEY) || ''; } catch (_) {}
    if (!english && path === '/' && saved === 'en') {
      window.location.replace(destination('en'));
      return;
    }
    if (english || path !== '/' || saved) return;
    const languages = Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages
      : [navigator.language || ''];
    if (!languages.some((language) => /^en(?:-|$)/i.test(language))) return;
    const offer = document.createElement('aside');
    offer.className = 'site-language-offer';
    offer.setAttribute('role', 'dialog');
    offer.setAttribute('aria-label', 'English version available');
    offer.innerHTML = '<strong>English version available</strong><span>Would you like to view this site in English?</span><div class="site-language-offer-actions"><button type="button" data-offer-language="en">View in English</button><button type="button" data-offer-language="ja">日本語のまま</button></div>';
    offer.addEventListener('click', (event) => {
      const button = event.target.closest('[data-offer-language]');
      if (!button) return;
      const language = button.dataset.offerLanguage;
      save(language);
      if (language === 'en') window.location.assign(destination('en'));
      else offer.remove();
    });
    document.body.appendChild(offer);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
