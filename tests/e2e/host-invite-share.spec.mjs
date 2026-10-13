import { expect, test } from './test.mjs';
import { TARGET_LOCALES, LOCALE_DETAILS } from '../../src/i18n/locales.js';
import { INVITE_SHARE_LABELS } from '../../src/platform/inviteShare.js';

const code = 'QADEMO88';
const manageToken = 'synthetic-management-fixture';
const cards = Array.from({ length: 10 }, (_, i) => ({ id: `fixture-${i}`, title: `Fixture ${i}`, category: 'Fixture', choices: ['One', 'Two', 'Three', 'Four', 'Five'] }));
async function hostFixture(page) {
  await page.addInitScript(() => {
    localStorage.setItem('watachan:analytics-excluded:v1', '1');
    window.__SHARE_MODE__ = 'success';
    window.__SHARE_CALLS__ = 0;
    window.__SOCIAL_REQUESTS__ = [];
    window.open = (...args) => { window.__SOCIAL_REQUESTS__.push(args); return null; };
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async payload => {
      window.__SHARE_CALLS__++;
      window.__INVITE_PAYLOAD__ = { ...payload, files: undefined, filenames: payload.files?.map(file => file.name) };
      if (window.__SHARE_MODE__ === 'pending') return new Promise((resolve, reject) => { window.__SHARE_REJECT__ = reject; });
      if (window.__SHARE_MODE__ === 'error') throw new DOMException('Unavailable', 'NotAllowedError');
    } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__SHARE_COPIED__ = value; } } });
  });
  await page.route(`**/api/challenge/rooms/${code}/manage`, async route => {
    expect(route.request().headers()['x-challenge-manage-token']).toBe(manageToken);
    await route.fulfill({ json: { room: { code, creatorName: 'Public creator', cards, completedParticipants: 0, participantCount: 1, maxParticipants: 50, answers: ['PRIVATE_ANSWER'] }, participants: [{ name: 'PRIVATE_PARTICIPANT', submitted: false }] } });
  });
}

test.describe('host invitation panel in all locales', () => {
  for (const locale of TARGET_LOCALES) test(`${locale}: localized invitation, safe sharing and preserved management`, async ({ page }) => {
    await hostFixture(page);
    const prefix = LOCALE_DETAILS[locale].prefix;
    await page.goto(`${prefix}/challenge/manage?room=${code}&analytics=exclude#manage=${manageToken}`);
    const controls = page.locator('[data-result-share-controls]');
    await expect(controls.locator('[data-result-share=save]')).toBeEnabled({ timeout: 30000 });
    await expect(controls.locator('[data-result-share=native] .share-card-copy strong')).toHaveText(INVITE_SHARE_LABELS[locale][0]);
    await expect(controls.locator('[data-result-share=save] .share-card-copy strong')).toHaveText(INVITE_SHARE_LABELS[locale][1]);
    const publicUrl = new URL(page.url()).origin + `${prefix}/challenge?room=${code}`;
    await expect(controls.locator('[data-result-share-url]')).toHaveValue(publicUrl);
    await controls.locator('[data-result-share=native]').click();
    const payload = await page.evaluate(() => window.__INVITE_PAYLOAD__);
    expect(payload.url).toBe(publicUrl);
    expect(payload.filenames).toEqual(['watachan-challenge-invitation.png']);
    expect(JSON.stringify(payload)).not.toMatch(/PRIVATE_|synthetic-management|\/manage|score|participant/i);
    for (const action of ['x', 'line', 'whatsapp']) await controls.locator(`[data-result-share=${action}]`).click();
    const destinations = await page.evaluate(() => window.__SOCIAL_REQUESTS__);
    expect(destinations).toHaveLength(3);
    for (const [href, target, options] of destinations) {
      expect(decodeURIComponent(href)).toContain(publicUrl);
      expect(decodeURIComponent(href)).not.toMatch(/PRIVATE_|synthetic-management|\/manage/);
      expect(target).toBe('_blank'); expect(options).toBe('noopener,noreferrer');
    }
    await controls.locator('[data-result-share=copy]').click();
    expect(await page.evaluate(() => window.__SHARE_COPIED__)).toBe(publicUrl);
    await expect(page.locator('a.challenge-share-action.board')).toHaveAttribute('href', `${prefix}/challenge/ranking?room=${code}`);
    await expect(page.getByTestId('host-answer-management')).toContainText('PRIVATE_PARTICIPANT');
    await page.locator('[data-action=save-recent-challenge]').click();
    await expect(page.getByTestId('recent-challenge-save-message')).not.toBeEmpty();
    const history = await page.evaluate(() => JSON.parse(localStorage.getItem('watachan-challenge-manage-history:v1')));
    expect(history.some(item => item.code === code && item.token === manageToken)).toBe(true);
    const geometry = await controls.evaluate(node => ({ panel: node.getBoundingClientRect().toJSON(), viewport: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth + 1, buttons: [...node.querySelectorAll('button')].filter(b => b.getClientRects().length).map(b => ({ client: b.clientWidth, scroll: b.scrollWidth })) }));
    expect(geometry.overflow).toBe(false);expect(geometry.panel.left).toBeGreaterThanOrEqual(0);expect(geometry.panel.right).toBeLessThanOrEqual(geometry.viewport);
    for (const b of geometry.buttons) expect(b.scroll).toBeLessThanOrEqual(b.client + 1);
  });
});

test('host cancellation, rapid clicks, returning, copy failure and invitation PNG', async ({ page }) => {
  await hostFixture(page);
  await page.goto(`/challenge/manage?room=${code}&analytics=exclude#manage=${manageToken}`);
  const controls = page.locator('[data-result-share-controls]');const native = controls.locator('[data-result-share=native]');
  await expect(controls.locator('[data-result-share=save]')).toBeEnabled({ timeout: 30000 });
  await page.evaluate(() => { window.__SHARE_MODE__ = 'pending'; });await native.click();
  await native.evaluate(button => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(await page.evaluate(() => window.__SHARE_CALLS__)).toBe(1);
  await page.evaluate(() => window.__SHARE_REJECT__(new DOMException('Cancelled', 'AbortError')));await expect(native).toBeEnabled();
  await expect(controls.locator('[data-result-share-status]')).toBeEmpty();
  await native.click();await page.evaluate(() => { window.__OLD_REJECT__ = window.__SHARE_REJECT__;window.dispatchEvent(new Event('pagehide')); });await expect(native).toBeEnabled();
  await native.click();await page.evaluate(() => window.__OLD_REJECT__(new DOMException('Departed','AbortError')));await expect(native).toBeDisabled();
  await page.evaluate(() => window.__SHARE_REJECT__(new DOMException('Cancelled','AbortError')));await expect(native).toBeEnabled();
  await page.evaluate(() => { window.__SHARE_MODE__ = 'error'; });await native.click();await expect(controls.locator('[data-result-share-status]')).toContainText('リンクをコピー');
  await page.evaluate(() => { Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('blocked');}}});document.execCommand=()=>false; });
  await controls.locator('[data-result-share=copy]').click();await expect(controls.locator('[data-result-share-status]')).toContainText('コピーできませんでした');
  await page.evaluate(() => { Object.defineProperty(navigator,'share',{configurable:true,value:undefined}); });
  const download = page.waitForEvent('download');await controls.locator('[data-result-share=save]').click();const file=await download;
  expect(file.suggestedFilename()).toBe('watachan-challenge-invitation.png');
  await file.saveAs('/tmp/wata-host-invitation-'+test.info().project.name+'.png');
  await page.locator('a.challenge-share-action.board').click();await page.goBack();await expect(page.locator('[data-result-share=native]')).toBeEnabled();
  await expect(page.locator('[data-result-share-url]')).toHaveValue(new URL(page.url()).origin+`/challenge?room=${code}`);
});
