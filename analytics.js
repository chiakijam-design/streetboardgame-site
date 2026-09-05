(function initializeAnalytics(windowObject, documentObject) {
  'use strict';

  var containerId = 'GTM-5VMKFTGP';
  var exclusionKey = 'watachan:analytics-excluded:v1';
  var productionHosts = ['streetboardgame.com', 'www.streetboardgame.com'];
  var preferenceParameter = 'analytics';
  var preference = '';
  var isExcluded = false;
  var currentUrl;

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
  var analyticsEnabled = isProductionHost && !isExcluded;

  windowObject.__WATACHAN_ANALYTICS_DISABLED__ = !analyticsEnabled;
  windowObject.__WATACHAN_GTM_CONTAINER_ID__ = containerId;
  windowObject.analyticsEnabled = analyticsEnabled;

  if (analyticsEnabled) {
    windowObject.dataLayer = windowObject.dataLayer || [];
    windowObject.gtag = windowObject.gtag || function gtag() {
      windowObject.dataLayer.push(arguments);
    };
    windowObject.gtag('set', {
      page_location: windowObject.location.origin + windowObject.location.pathname,
      page_path: windowObject.location.pathname
    });
    windowObject.trackEvent = function trackEvent(name, params) {
      windowObject.gtag('event', name, params || {});
    };

    windowObject.dataLayer.push({
      'gtm.start': new Date().getTime(),
      event: 'gtm.js'
    });

    var analyticsScript = documentObject.createElement('script');
    analyticsScript.async = true;
    analyticsScript.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(containerId);
    documentObject.head.appendChild(analyticsScript);
  } else {
    windowObject.gtag = function disabledGtag() {};
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
        'font:700 14px/1.5 "Noto Serif JP",serif',
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
