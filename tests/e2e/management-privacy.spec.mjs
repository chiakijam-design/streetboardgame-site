import { createIsolatedContext } from '../helpers/test-network-guard.mjs';
import { test, expect } from './test.mjs';

test.beforeEach(async ({ context }) => {
  // Includes fonts, GA/GTM, Clarity and SNS. No real outbound analytics.
  await context.route('**/*', route => {
    const host = new URL(route.request().url()).hostname;
    return ['127.0.0.1', 'localhost'].includes(host) ? route.continue() : route.abort();
  });
});

async function createRoom(request, count = 2) {
  const cards = Array.from({ length: count }, (_, n) => ({ id: `Privacy${n}`, category: 'Synthetic test', title: `Question ${n + 1}`, choices: ['A', 'B', 'C', 'D', 'E'] }));
  const response = await request.post('/api/challenge/rooms', { data: { creatorName: 'Synthetic test', cards, answers: Array(count).fill(0) } });
  expect(response.status()).toBe(201);
  return response.json();
}

async function assertNoSecret(page, token) {
  expect(page.url()).not.toContain(token);
  expect(page.url()).not.toContain('manage=');
  const html = await page.content();
  expect(html.includes(token)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const storage of ['normal', 'denied', 'quota']) {
  test(`legacy fragment: reload/back and management survive storage ${storage}`, async ({ page, request }) => {
    const data = await createRoom(request);
    if (storage !== 'normal') await page.addInitScript(kind => {
      for (const name of ['localStorage', 'sessionStorage']) {
        if (kind === 'denied') Object.defineProperty(window, name, { get() { throw new DOMException('Synthetic denied', 'SecurityError'); } });
      }
      if (kind === 'quota') Storage.prototype.setItem = () => { throw new DOMException('Synthetic quota', 'QuotaExceededError'); };
    }, storage);
    const forbidden = [];
    page.on('request', r => { if (r.url().includes(data.manageToken) || (r.postData() || '').includes(data.manageToken)) forbidden.push(r.method()); });
    // The generated token exists only in this isolated MemoryKV; it is never logged.
    await page.goto(`/challenge?room=${data.code}&analytics=exclude#manage=${data.manageToken}`);
    await expect(page.getByTestId('challenge-share-screen')).toBeVisible();
    await assertNoSecret(page, data.manageToken);
    await page.reload();
    await expect(page.getByTestId('challenge-share-screen')).toBeVisible();
    await assertNoSecret(page, data.manageToken);
    await page.goto('/challenge/library');
    await page.goBack();
    await expect(page.getByTestId('challenge-share-screen')).toBeVisible();
    await assertNoSecret(page, data.manageToken);
    expect(forbidden).toEqual([]);
  });
}

test('old localized query link, history menu, and isolated participant answers remain separate', async ({ page, request, browser }) => {
  const data = await createRoom(request, 2);
  await page.goto(`/en/challenge/manage?room=${data.code}&manage=${data.manageToken}&analytics=exclude`);
  await expect(page.getByTestId('challenge-share-screen')).toBeVisible();
  await assertNoSecret(page, data.manageToken);
  await page.goto('/challenge');
  const management = page.locator('a[href*="/challenge/manage?room="]');
  await expect(management).toHaveCount(1);
  expect(await management.getAttribute('href')).not.toContain('manage=');
  await management.click();
  await expect(page.getByTestId('challenge-share-screen')).toBeVisible();
  const guest = await createIsolatedContext(browser);
  await guest.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  const other = await guest.newPage();
  await other.goto(new URL(`/challenge?room=${data.code}&analytics=exclude`, page.url()).href);
  await other.locator('#participant-name').fill('Synthetic guest');
  await other.locator('[data-action="join"]').click();
  for (let i = 0; i < 2; i++) {
    await expect(other.locator('.challenge-q-number')).toHaveText(`Q${i + 1}/2`);
    await other.locator('[data-action="answer"]').first().click();
  }
  await expect(other.locator('.challenge-result')).toHaveCount(2);
  await assertNoSecret(other, data.manageToken);
  await guest.close();
});

for (const count of [1, 10]) test(`new ${count}-question creation contains no key in URL/DOM; guest completes`, async ({ page, browser }, info) => {
  if (count === 1) await page.addInitScript(() => {
    for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, { get() { throw new DOMException('Synthetic denied', 'SecurityError'); } });
  });
  await page.goto('/challenge?analytics=exclude');
  await page.locator('#creator-name').fill('Synthetic creator');
  await page.locator('[data-action="start-create"]').click();
  await page.locator('#question-submit-consent').uncheck();
  await expect(page.locator('[data-action="finish-early"]')).toBeDisabled();
  const created = page.waitForResponse(r => r.url().endsWith('/api/challenge/rooms') && r.request().method() === 'POST');
  for (let i = 0; i < count; i++) {
    await expect(page.locator('.challenge-q-number')).toHaveText(`Q${i + 1}/10`);
    await page.locator('[data-action="builder-answer"]').first().click();
    if (count === 10 && i === 1) {
      await page.reload();
      await page.locator('[data-action="resume-create"]').click();
    }
  }
  if (count < 10) {
    await page.locator('[data-action="finish-early"]').click();
    await page.locator('[data-action="confirm-finish"]').click();
  }
  const data = await (await created).json();
  await expect(page.getByTestId('challenge-share-screen')).toBeVisible();
  await assertNoSecret(page, data.manageToken);
  await page.screenshot({ path: info.outputPath(`synthetic-${count}-share.png`), fullPage: true });
  await page.reload();
  await expect(page.getByTestId('challenge-share-screen')).toBeVisible();
  await assertNoSecret(page, data.manageToken);
  const guest = await createIsolatedContext(browser);
  await guest.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  const other = await guest.newPage();
  await other.goto(new URL(`/challenge?room=${data.code}&analytics=exclude`, page.url()).href);
  await other.locator('#participant-name').fill('Synthetic guest');
  await other.locator('[data-action="join"]').click();
  for (let i = 0; i < count; i++) {
    await expect(other.locator('.challenge-q-number')).toHaveText(`Q${i + 1}/${count}`);
    await other.locator('[data-action="answer"]').first().click();
  }
  await expect(other.locator('.challenge-result')).toHaveCount(count);
  await assertNoSecret(other, data.manageToken);
  await guest.close();
});

test('internal enabled-tag fixture: stub GA/GTM/Clarity see clean URL/DOM/event data; same-origin state remains readable', async ({ page, baseURL }) => {
  // The production hostname is simulated entirely by route.fulfill. The browser
  // proxy and context blocker prohibit fallback to any real service.
  const fixture = await createRoom(page.request, 1);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { configurable: true, get: () => false });
    window.__TAG_OBSERVATIONS__ = [];
  });
  const stub = kind => `(() => {
    const keyPattern = /\\b[a-f0-9]{48}\\b/i;
    const capture = (stage, extra = '') => window.__TAG_OBSERVATIONS__.push({
      kind: ${JSON.stringify(kind)}, stage,
      urlDOMOrEventHasKey: keyPattern.test(location.href + document.referrer + document.documentElement.outerHTML + extra),
      historyStateReadable: keyPattern.test(JSON.stringify(history.state))
    });
    capture('initialization');
    if (${JSON.stringify(kind)} === 'clarity') {
      new MutationObserver(() => capture('DOM update')).observe(document.documentElement, { subtree:true, childList:true, attributes:true });
      const replace = history.replaceState.bind(history);
      history.replaceState = (...args) => { capture('history hook', JSON.stringify(args)); return replace(...args); };
    }
    if (${JSON.stringify(kind)} === 'gtm') {
      const script = document.createElement('script'); script.src = 'https://www.clarity.ms/tag/y40ha6gkld'; document.head.appendChild(script);
    }
  })();`;
  const cloudflareRequests = [];
  await page.route('https://static.cloudflareinsights.com/**', route => {
    cloudflareRequests.push(route.request().url());
    return route.fulfill({ contentType: 'text/javascript', body: '' });
  });
  await page.route('https://www.googletagmanager.com/**', route => route.fulfill({ contentType: 'text/javascript', body: stub(route.request().url().includes('/gtm.js') ? 'gtm' : 'ga') }));
  await page.route('https://www.clarity.ms/**', route => route.fulfill({ contentType: 'text/javascript', body: stub('clarity') }));
  await page.route('https://www.streetboardgame.com/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const headers = request.headers(), allowed = {};
    for (const name of ['content-type','x-challenge-manage-token','x-challenge-participant-token']) if (headers[name]) allowed[name] = headers[name];
    const response = await page.request.fetch(new URL(url.pathname + url.search, baseURL).href, {
      method: request.method(), headers: allowed, data: request.postDataBuffer() || undefined, maxRedirects: 0,
    });
    // Exercise the preserved secret guard independently of the current policy,
    // which disables both Google paths. Never enable tags on the live site.
    if (request.isNavigationRequest()) {
      const body = (await response.text()).replace('__WATACHAN_GOOGLE_ANALYTICS_POLICY__="off"', '__WATACHAN_GOOGLE_ANALYTICS_POLICY__="notice"');
      await route.fulfill({ response, body });
    } else await route.fulfill({ response });
  });
  await page.goto(`https://www.streetboardgame.com/challenge?room=${fixture.code}#manage=${fixture.manageToken}`);
  await expect(page.getByTestId('challenge-share-screen')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__TAG_OBSERVATIONS__.some(x => x.kind === 'clarity'))).toBe(true);
  await assertNoSecret(page, fixture.manageToken);
  const legacy = await page.evaluate(() => window.__TAG_OBSERVATIONS__);
  expect(legacy.some(x => x.historyStateReadable)).toBe(true); // Explicit limitation, not script isolation.
  expect(legacy.every(x => !x.urlDOMOrEventHasKey)).toBe(true);

  await page.goto('https://www.streetboardgame.com/challenge');
  await expect(page.locator('#wata-pv-choice')).toHaveCount(0);
  expect(cloudflareRequests).toEqual([]);
  await expect(page.locator('script[data-wata-cf-pv]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__TAG_OBSERVATIONS__.some(x => x.kind === 'clarity'))).toBe(true);
  await page.locator('#creator-name').fill('Synthetic tags');
  await page.locator('[data-action=start-create]').click();
  await page.locator('#question-submit-consent').uncheck();
  await page.locator('[data-action=builder-answer]').first().click();
  await page.locator('[data-action=finish-early]').click();
  await page.locator('[data-action=confirm-finish]').click();
  await expect(page.getByTestId('challenge-share-screen')).toBeVisible();
  const result = await page.evaluate(() => {
    const key = history.state.wataChallengeManage.token;
    window.trackEvent('share', { method: 'copy', manageToken: key, page_referrer: location.href + '#manage=' + key });
    return {
      observations: window.__TAG_OBSERVATIONS__,
      queueHasKey: JSON.stringify([window.dataLayer, window.ga4EventLayer]).includes(key),
      urlOrDOMHasKey: (location.href + document.documentElement.outerHTML).includes(key),
    };
  });
  expect(result.queueHasKey).toBe(false);
  expect(result.urlOrDOMHasKey).toBe(false);
  expect(result.observations.every(x => !x.urlDOMOrEventHasKey)).toBe(true);
  expect(cloudflareRequests).toEqual([]);
});



for (const storage of ['normal','denied','quota']) test(`management language switch preserves capability with ${storage} storage`,async({page,request})=>{
  const response=await request.post('/api/challenge/rooms',{data:{creatorName:'Synthetic locale',cards:[{id:'LocalePrivacy',category:'Test',title:'Synthetic question',choices:['A','B','C','D','E']}],answers:[0]}});
  expect(response.status()).toBe(201);
  const created=await response.json();
  if(storage!=='normal')await page.addInitScript(kind=>{
    if(kind==='denied')for(const name of ['localStorage','sessionStorage'])Object.defineProperty(window,name,{get(){throw new DOMException('Synthetic denied','SecurityError');}});
    else Storage.prototype.setItem=()=>{throw new DOMException('Synthetic quota','QuotaExceededError');};
  },storage);
  await page.goto(`/challenge?room=${created.code}&analytics=exclude#manage=${created.manageToken}`);
  await expect(page.getByTestId('challenge-share-screen')).toBeVisible();
  await page.locator('[data-locale-switcher]').selectOption('en');
  await expect(page).toHaveURL(new RegExp(`/en/challenge/manage\\?room=${created.code}$`));
  await expect(page.getByTestId('challenge-share-screen')).toBeVisible();
  expect(await page.evaluate(()=>history.state?.wataChallengeManage?.token)).toBe(created.manageToken);
  expect(page.url()).not.toContain(created.manageToken);
  expect(await page.content()).not.toContain(created.manageToken);
  await page.reload();
  await expect(page.getByTestId('challenge-share-screen')).toBeVisible();
});
