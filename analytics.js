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
  var japanBasic = windowObject.__WATACHAN_GOOGLE_ANALYTICS_POLICY__ === 'jp-basic';
  var analyticsEnabled = isProductionHost && !isExcluded && !isAutomatedBrowser && !localeReviewPending && urlPrivacyReady && (windowObject.__WATACHAN_GOOGLE_ANALYTICS_POLICY__ === 'notice' || japanBasic) && windowObject.navigator.globalPrivacyControl !== true && windowObject.navigator.doNotTrack !== '1';

  windowObject.__WATACHAN_ANALYTICS_DISABLED__ = !analyticsEnabled;
  windowObject.__WATACHAN_GTM_CONTAINER_ID__ = containerId;
  windowObject.__WATACHAN_GA4_MEASUREMENT_ID__ = measurementId;
  windowObject.analyticsEnabled = analyticsEnabled;

  function jpBasicPreferenceReady() {
    try {
      var raw = windowObject.localStorage.getItem('watachan:cf-pv-consent:v1');
      if (raw !== null) {
        var record = JSON.parse(raw);
        if (!record || record.v !== 1 || record.choice !== 'allow' || !Number.isFinite(record.at)
          || record.at > Date.now() + 300000 || Date.now() - record.at >= 180 * 86400000) return false;
      }
      if (windowObject.localStorage.getItem(exclusionKey) === '1') return false;
      var probe = 'watachan:analytics-preference-available';
      windowObject.localStorage.setItem(probe, '1');
      var usable = windowObject.localStorage.getItem(probe) === '1';
      windowObject.localStorage.removeItem(probe);
      return usable;
    } catch (_) { return false; }
  }

  function startJapanBasic() {
    // Conditional candidate only: the server policy stays off until the actual
    // account, stream and disclosure conditions have been reviewed as satisfied.
    var u = new URL(windowObject.location.href), publicRoutes = ['/', '/challenge', '/challenge/library', '/challenge/ranking', '/challenge-guide', '/about', '/product', '/terms', '/privacy', '/legal', '/content-guidelines', '/minor-policy', '/creator-terms'];
    var route = u.pathname === '/en' ? '/' : u.pathname.replace(/^\/(?:en)\//, '/').replace(/\/$/, '') || '/';
    var safeQuery = true;
    u.searchParams.forEach(function (value, key) {
      if (key === 'room') { if (!/^[A-Z2-9]{8}$/.test(value)) safeQuery = false; }
      else if (key === 'analytics') { if (!/^(?:include|exclude)$/.test(value)) safeQuery = false; }
      else if (key === 'utm_source') { if (!/^(?:instagram|line|x|twitter|facebook|copy|direct)$/.test(value)) safeQuery = false; }
      else if (key === 'utm_medium') { if (!/^(?:social|referral|organic|email|qr)$/.test(value)) safeQuery = false; }
      else safeQuery = false;
    });
    if (publicRoutes.indexOf(route) === -1 || !safeQuery || u.hash || !jpBasicPreferenceReady()
      || windowObject['ga-disable-' + measurementId] === true) {
      windowObject.analyticsEnabled = false; windowObject.__WATACHAN_ANALYTICS_DISABLED__ = true;
      windowObject.gtag = windowObject.ga4Event = windowObject.trackEvent = function () {};
      return;
    }
    var stopped = false, loaded = false;
    windowObject[eventLayerName] = windowObject[eventLayerName] || [];
    function queue() { if (!stopped) windowObject[eventLayerName].push(arguments); }
    windowObject.ga4Event = windowObject.gtag = queue;
    // Deny advertising uses; no positive user-consent state is manufactured.
    queue('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    queue('js', new Date());
    var referrer = '';
    try { if (documentObject.referrer) { var ref = new URL(documentObject.referrer); referrer = ref.origin + '/'; } } catch (_) {}
    var pageContext = { page_location: u.origin + u.pathname, page_referrer: referrer, page_title: 'Streetboardgame' };
    var privacy = { allow_google_signals: false, allow_ad_personalization_signals: false, ads_data_redaction: true, url_passthrough: false };
    queue('set', Object.assign({}, privacy, pageContext));
    var config = Object.assign({ send_page_view: false }, privacy, pageContext);
    if (u.searchParams.has('utm_source')) config.campaign_source = u.searchParams.get('utm_source');
    if (u.searchParams.has('utm_medium')) config.campaign_medium = u.searchParams.get('utm_medium');
    queue('config', measurementId, config);
    queue('event', 'page_view', Object.assign({ send_to: measurementId }, pageContext));
    var values = {
      game_type: ['challenge'], play_mode: ['async'], player_role: ['creator', 'participant'], play_criteria: ['accepted_answer'],
      method: ['copy', 'native', 'line', 'x', 'twitter', 'facebook', 'instagram', 'image', 'download'],
      content_type: ['challenge_invite', 'challenge_result'], item_id: ['challenge_invite', 'challenge_result']
    };
    function stop() {
      stopped = true; windowObject['ga-disable-' + measurementId] = true;
      windowObject.analyticsEnabled = false; windowObject.__WATACHAN_ANALYTICS_DISABLED__ = true;
      windowObject.gtag = windowObject.ga4Event = windowObject.trackEvent = function () {};
    }
    function load() {
      if (loaded || stopped) return;
      if (!jpBasicPreferenceReady() || windowObject.navigator.globalPrivacyControl === true || windowObject.navigator.doNotTrack === '1') { stop(); return; }
      loaded = true;
      var script = documentObject.createElement('script'); script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId) + '&l=' + encodeURIComponent(eventLayerName);
      script.referrerPolicy = 'no-referrer'; documentObject.head.appendChild(script);
    }
    windowObject.trackEvent = function (name, params) {
      if (stopped || ['game_start', 'game_play', 'game_result', 'share'].indexOf(name) === -1) return;
      if (!jpBasicPreferenceReady()) { stop(); return; }
      var clean = {};
      Object.keys(values).forEach(function (key) { if (values[key].indexOf(params && params[key]) !== -1) clean[key] = params[key]; });
      queue('event', name, Object.assign({ send_to: measurementId }, pageContext, clean)); load();
    };
    windowObject.addEventListener('storage', function () {
      if (!jpBasicPreferenceReady()) { stop(); if (typeof windowObject.location.reload === 'function') windowObject.location.reload(); }
    });
    documentObject.addEventListener('click', function (event) {
      var link = event.target && typeof event.target.closest === 'function' ? event.target.closest('a[href]') : null;
      if (!link) return;
      try { if (new URL(link.href, u.origin).searchParams.get('analytics') === 'exclude') stop(); } catch (_) {}
    }, true);
    function afterPaint() {
      if (typeof windowObject.requestAnimationFrame !== 'function') return load();
      windowObject.requestAnimationFrame(function () { windowObject.requestAnimationFrame(load); });
    }
    if (documentObject.readyState === 'complete') afterPaint(); else windowObject.addEventListener('load', afterPaint, { once: true });
    windowObject.addEventListener('pointerdown', load, { once: true, passive: true });
    windowObject.addEventListener('keydown', load, { once: true });
  }

  if (analyticsEnabled && japanBasic) {
    startJapanBasic();
  } else if (analyticsEnabled) {
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

  }
})(window, document);
