import { expect, test } from './test.mjs';
import { homeEntryCopy } from '../../src/i18n/home-entry-copy.js';

for(const locale of ['ja','en','ar']) for(const width of [390,1280]) {
 test(`home ${locale}/${width}: short quiz copy, keyboard start and no horizontal overflow`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:667});
  await page.addInitScript(()=>localStorage.setItem('watachan:analytics-excluded:v1','1'));
  await page.goto(locale==='ja'?'/':`/${locale}/`);
  const copy=homeEntryCopy(locale);
  await expect(page.getByTestId('top-common-rule-step').first()).toContainText(copy.step);
  const start=page.getByRole('button',{name:copy.start,exact:true});
  await expect(start).toBeVisible();
  await expect(page.getByText(copy.note,{exact:true})).toBeVisible();
  await page.locator('#top-creator-name').fill('Fixture');
  await page.keyboard.press('Tab'); await expect(start).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.evaluate(()=>document.activeElement?.blur());
  await page.getByTestId('top-common-rules').screenshot({path:testInfo.outputPath('home-rules.png'),animations:'disabled'});
  await page.locator('nav[aria-label]').filter({has:page.getByText(copy.note,{exact:true})}).screenshot({path:testInfo.outputPath('home-card.png'),animations:'disabled'});
  await start.focus(); await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/challenge(?:\?|$)/);
  await expect(page.locator('[data-action=builder-answer]').first()).toBeVisible();
 });
}
