import { expect,test } from './test.mjs';
test('removed pricing is not advertised and old URLs offer the current quiz',async({page,request},testInfo)=>{
 for(const width of [1280,390,320]){
  await page.setViewportSize({width,height:760});
  await page.goto('/?analytics=exclude');
  await expect(page.getByTestId('top-free-notice')).toContainText('無料');
  await expect(page.locator('a[href$="/pricing"]')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'わたし理解度診断を作る',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('home-'+width+'.png'),fullPage:true});
 }
 for(const locale of ['', '/en','/ar']){
  const response=await page.goto(locale+'/pricing?analytics=exclude');
  expect(response.status()).toBe(410);
  await expect(page.locator('h1')).not.toBeEmpty();
  await expect(page.locator('h1')).not.toHaveText('410');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const link=page.locator('a[href="'+locale+'/challenge"]');
  await expect(link).toBeVisible();
  // Desktop tab order; touch browsers expose link focus through their accessibility UI.
  if(testInfo.project.name==='desktop-chrome')await page.keyboard.press('Tab');
  else await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.challenge-hero h1')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const old=await request.head(locale+'/pricing.html');
  expect(old.status()).toBe(410);expect(old.headers()['x-robots-tag']).toContain('noindex');
 }
});
test('current policies stay readable in Japanese English and RTL without retirement banners',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:667});
 for(const locale of ['', '/en','/ar'])for(const name of ['terms','privacy','creator-terms']){
  await page.goto(locale+'/'+name+'?analytics=exclude');
  await expect(page.getByTestId('live-retirement-notice')).toHaveCount(0);
  await expect(page.getByTestId('historical-provisions')).not.toHaveAttribute('open','');
  await expect(page.locator('a[href$="/pricing"]')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  if(name==='privacy')await expect(page.getByTestId('personal-question-storage-policy')).toBeVisible();
  // Long policy documents exceed WebKit's bitmap limit; capture the current header/notice viewport.
  await page.screenshot({path:testInfo.outputPath((locale.slice(1)||'ja')+'-'+name+'.png'),fullPage:false});
 }
});
test('guide and about describe current flexible length and highest-score board',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:667});
 for(const locale of ['', '/en','/ar']){
  await page.goto(locale+'/challenge-guide?analytics=exclude');
  await expect(page.locator('main')).toContainText(locale===''?'1〜10問':'1–10');
  await expect(page.locator('a[href$="/pricing"]')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:testInfo.outputPath((locale.slice(1)||'ja')+'-guide.png')});
  await page.goto(locale+'/about?analytics=exclude');
  await expect(page.locator('main')).toContainText(locale===''?'1〜10問':'1–10');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
});
