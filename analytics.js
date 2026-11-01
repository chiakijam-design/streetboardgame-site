(function initializeAnalytics(windowObject, documentObject) {
  'use strict';

  var containerId = 'GTM-5VMKFTGP';
  var measurementId = 'G-X07PVDQWYX';
  var eventLayerName = 'ga4EventLayer';
  var exclusionKey = 'watachan:analytics-excluded:v1';
  var productionHosts = ['streetboardgame.com', 'www.streetboardgame.com'];
  var preferenceParameter = 'analytics';
  var preference = '';
  var isExcluded = false;
  var currentUrl;
  var urlPrivacyReady = true;
  var manageStateKey = 'wataChallengeManage';
  var secretParameter = /^(?:manage|manage_token|token|secret|password)$/i;
  var privateReplaceState = windowObject.history.replaceState.bind(windowObject.history);
  var privatePushState = typeof windowObject.history.pushState === 'function'
    ? windowObject.history.pushState.bind(windowObject.history) : null;

  // Capture the browser method before tags install History API observers.
  // Passing the capability through an analytics-wrapped replaceState would
  // otherwise expose the state argument even though the URL itself is clean.
  windowObject.__WATACHAN_REPLACE_MANAGE_URL__ = function (code, token, path, mode) {
    if (!/^[A-Z2-9]{8}$/.test(code) || !/^[a-f0-9]{48}$/i.test(token)) return false;
    var destination = new URL(path, windowObject.location.origin);
    if (destination.origin !== windowObject.location.origin
      || !/^\/(?:[a-zA-Z-]+\/)?challenge\/manage$/.test(destination.pathname)) return false;
    if (mode === 'push' && !privatePushState) return false;
    var prior = windowObject.history.state;
    var next = prior && typeof prior === 'object' ? Object.assign({}, prior) : {};
    next[manageStateKey] = { code: code, token: token };
    (mode === 'push' ? privatePushState : privateReplaceState)(next, '', destination.pathname + '?room=' + encodeURIComponent(code));
    return true;
  };

  // Run synchronously, before either external tag can observe the address.
  // history.state keeps reload/back working even when Web Storage is denied.
  try {
    var entryUrl = new URL(windowObject.location.href);
    var entryFragment = new URL('https://privacy.invalid/?' + entryUrl.hash.slice(1)).searchParams;
    var entryToken = entryFragment.get('manage') || entryUrl.searchParams.get('manage') || '';
    var entryCode = (entryUrl.searchParams.get('room') || '').trim().toUpperCase();
    var entryState = windowObject.history.state;
    var nextState = entryState && typeof entryState === 'object' ? Object.assign({}, entryState) : {};
    var hasSecret = false;
    Array.from(entryUrl.searchParams.keys()).forEach(function removeSecret(key) {
      if (secretParameter.test(key)) { entryUrl.searchParams.delete(key); hasSecret = true; }
    });
    Array.from(entryFragment.keys()).forEach(function removeFragmentSecret(key) {
      if (secretParameter.test(key)) { entryFragment.delete(key); hasSecret = true; }
    });
    var isChallengeEntry = /^\/(?:[a-zA-Z-]+\/)?challenge(?:\/|$)/.test(entryUrl.pathname);
    if (isChallengeEntry
      && /^[A-Z2-9]{8}$/.test(entryCode) && /^[a-f0-9]{48}$/i.test(entryToken)) {
      nextState[manageStateKey] = { code: entryCode, token: entryToken };
    }
    if (hasSecret) {
      if (isChallengeEntry) {
        entryUrl.hash = entryFragment.toString();
        privateReplaceState(nextState, '', entryUrl.pathname + entryUrl.search + entryUrl.hash);
      } else {
        // Other first-party flows may legitimately need their token. Preserve
        // their address and suppress this document's collectors instead.
        urlPrivacyReady = false;
      }
    }
  } catch (error) {
    // Do not load collectors if removal failed. Gameplay remains independent.
    urlPrivacyReady = false;
  }

  // Capture before the locale shell's location.assign handler. A new document
  // from assign loses private history state when both storages are blocked.
  // Push a clean same-origin entry, then reload that entry to preserve the key.
  if (typeof documentObject.addEventListener === 'function') {
    documentObject.addEventListener('change', function preserveManagedLocale(event) {
      var select = event.target;
      if (!select || typeof select.matches !== 'function' || !select.matches('select[data-locale-switcher]')) return;
      var here = new URL(windowObject.location.href);
      if (!/^\/(?:[a-zA-Z-]+\/)?challenge(?:\/manage)?\/?$/.test(here.pathname)) return;
      var record = windowObject.history.state && windowObject.history.state[manageStateKey];
      if (!record || record.code !== (here.searchParams.get('room') || '').trim().toUpperCase()) return;
      var locale = String(select.value || '');
      if (!/^[a-zA-Z-]+$/.test(locale)) return;
      var destination = (locale === 'ja' ? '' : '/' + locale) + '/challenge/manage';
      if (!windowObject.__WATACHAN_REPLACE_MANAGE_URL__(record.code, record.token, destination, 'push')) return;
      event.stopImmediatePropagation();
      try { windowObject.localStorage.setItem('watachan:language:v1', locale); } catch (error) {}
      windowObject.location.reload();
    }, true);
  }

  function safePageUrl(value) {
    if (!value) return '';
    try {
      var url = new URL(value, windowObject.location.origin);
      return /^https?:$/.test(url.protocol) ? url.origin + url.pathname : '';
    } catch (error) { return ''; }
  }

  function safeEventValue(value, depth) {
    if (depth > 6) return undefined;
    if (typeof value === 'string') {
      if (/(?:^|[^a-f0-9])[a-f0-9]{48}(?:$|[^a-f0-9])/i.test(value)) return undefined;
      if (/^(?:https?:\/\/|\/)/i.test(value)) return safePageUrl(value);
      if (/(?:[?#&]|%26|%3f)(?:manage|manage_token|token|secret|password)(?:=|%3d)/i.test(value)) return undefined;
      return value;
    }
    if (Array.isArray(value)) return value.map(function (item) { return safeEventValue(item, depth + 1); }).filter(function (item) { return item !== undefined; });
    if (value && typeof value === 'object') {
      var clean = {};
      Object.keys(value).forEach(function (key) {
        if (/(?:manage|token|secret|password|answer|creator_name|participant_name)/i.test(key)) return;
        var item = safeEventValue(value[key], depth + 1);
        if (item !== undefined) clean[key] = item;
      });
      return clean;
    }
    return value;
  }

  // A legacy secret in document.referrer cannot be rewritten. Fail closed for
  // that document rather than exposing it to GTM's independently configured tags.
  try {
    if (documentObject.referrer) {
      var sourceUrl = new URL(documentObject.referrer);
      sourceUrl.searchParams.forEach(function (_, key) { if (secretParameter.test(key)) urlPrivacyReady = false; });
      if (/(?:^|[^a-f0-9])[a-f0-9]{48}(?:$|[^a-f0-9])/i.test(documentObject.referrer)) urlPrivacyReady = false;
    }
  } catch (error) { urlPrivacyReady = false; }

  try {
    currentUrl = new URL(windowObject.location.href);
    preference = currentUrl.searchParams.get(preferenceParameter) || '';
  } catch (error) {
    currentUrl = null;
  }

  try {
    if (preference === 'exclude') {
      windowObject.localStorage.setItem(exclusionKey, '1');
    } else if (preference === 'include') {
      windowObject.localStorage.removeItem(exclusionKey);
    }
    isExcluded = windowObject.localStorage.getItem(exclusionKey) === '1';
  } catch (error) {
    isExcluded = preference === 'exclude';
  }

  var hostname = String(windowObject.location.hostname || '').toLowerCase();
  var isProductionHost = productionHosts.indexOf(hostname) !== -1;
  var isAutomatedBrowser = windowObject.navigator && windowObject.navigator.webdriver === true;
  var localeReviewPending = windowObject.__WATACHAN_ANALYTICS_LOCALE_REVIEW_PENDING__ === true;
  var analyticsEnabled = isProductionHost && !isExcluded && !isAutomatedBrowser && !localeReviewPending && urlPrivacyReady;

  windowObject.__WATACHAN_ANALYTICS_DISABLED__ = !analyticsEnabled;
  windowObject.__WATACHAN_GTM_CONTAINER_ID__ = containerId;
  windowObject.__WATACHAN_GA4_MEASUREMENT_ID__ = measurementId;
  windowObject.analyticsEnabled = analyticsEnabled;

  if (analyticsEnabled) {
    windowObject.dataLayer = windowObject.dataLayer || [];
    windowObject.gtag = windowObject.gtag || function gtag() {
      windowObject.dataLayer.push(arguments);
    };
    var pageContext = {
      page_location: windowObject.location.origin + windowObject.location.pathname,
      page_path: windowObject.location.pathname,
      page_referrer: safePageUrl(documentObject.referrer || '')
    };
    windowObject.gtag('set', pageContext);
    windowObject[eventLayerName] = windowObject[eventLayerName] || [];
    windowObject.ga4Event = windowObject.ga4Event || function ga4Event() {
      windowObject[eventLayerName].push(arguments);
    };
    windowObject.ga4Event('js', new Date());
    windowObject.ga4Event('set', pageContext);
    windowObject.ga4Event('config', measurementId);
    windowObject.trackEvent = function trackEvent(name, params) {
      if (!/^[a-z][a-z0-9_]{0,39}$/i.test(name)) return;
      var eventParams;
      try { eventParams = safeEventValue(params || {}, 0); }
      catch (error) { return; }
      var gtmEvent = { event: name };
      Object.keys(eventParams).forEach(function copyEventParameter(key) {
        gtmEvent[key] = eventParams[key];
      });
      windowObject.dataLayer.push(gtmEvent);
      windowObject.ga4Event('event', name, eventParams);
      loadAnalytics();
    };

    var gtmLoaded = false;
    function loadGtm() {
      if (gtmLoaded) return;
      gtmLoaded = true;
      windowObject.dataLayer.push({
        'gtm.start': new Date().getTime(),
        event: 'gtm.js'
      });
      var gtmScript = documentObject.createElement('script');
      gtmScript.async = true;
      gtmScript.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(containerId);
      documentObject.head.appendChild(gtmScript);
    }

    var analyticsLoaded = false;
    function loadAnalytics() {
      if (analyticsLoaded) return;
      analyticsLoaded = true;
      var eventScript = documentObject.createElement('script');
      eventScript.async = true;
      eventScript.src = 'https://www.googletagmanager.com/gtag/js?id='
        + encodeURIComponent(measurementId)
        + '&l=' + encodeURIComponent(eventLayerName);
      eventScript.addEventListener('load', loadGtm, { once: true });
      eventScript.addEventListener('error', loadGtm, { once: true });
      documentObject.head.appendChild(eventScript);
    }
    // Keep event queues ready immediately, but give page content the network
    // first. Any interaction or explicit event starts delivery sooner.
    function loadAfterPaint() {
      if (typeof windowObject.requestAnimationFrame !== 'function') return loadAnalytics();
      windowObject.requestAnimationFrame(function afterLayout() {
        windowObject.requestAnimationFrame(loadAnalytics);
      });
    }
    if (documentObject.readyState === 'complete') loadAfterPaint();
    else windowObject.addEventListener('load', loadAfterPaint, { once: true });
    windowObject.addEventListener('pointerdown', loadAnalytics, { once: true, passive: true });
    windowObject.addEventListener('keydown', loadAnalytics, { once: true });
  } else {
    windowObject.gtag = function disabledGtag() {};
    windowObject.ga4Event = function disabledGa4Event() {};
    windowObject.trackEvent = function disabledTrackEvent() {};
  }

  if ((preference === 'exclude' || preference === 'include') && currentUrl) {
    currentUrl.searchParams.delete(preferenceParameter);
    windowObject.history.replaceState(
      windowObject.history.state,
      '',
      currentUrl.pathname + currentUrl.search + currentUrl.hash
    );

    windowObject.addEventListener('DOMContentLoaded', function showAnalyticsPreferenceNotice() {
      var notice = documentObject.createElement('div');
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      notice.textContent = preference === 'exclude'
        ? 'このブラウザをアクセス解析の対象外に設定しました。'
        : 'このブラウザのアクセス解析除外を解除しました。';
      notice.style.cssText = [
        'position:fixed',
        'z-index:2147483647',
        'left:50%',
        'bottom:max(20px,env(safe-area-inset-bottom))',
        'transform:translateX(-50%)',
        'width:min(calc(100% - 32px),560px)',
        'box-sizing:border-box',
        'padding:14px 18px',
        'border:2px solid #1a1a1a',
        'border-radius:14px',
        'background:#fff7c7',
        'color:#1a1a1a',
        'font:700 14px/1.5 "Noto Sans JP",sans-serif',
        'text-align:center',
        'box-shadow:4px 4px 0 #1a1a1a'
      ].join(';');
      documentObject.body.appendChild(notice);
      windowObject.setTimeout(function removeAnalyticsPreferenceNotice() {
        notice.remove();
      }, 12000);
    }, { once: true });
  }
})(window, document);
