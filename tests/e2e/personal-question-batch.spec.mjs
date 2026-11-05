import {test,expect} from './test.mjs';
const key='watachan:my-questions:v1';
const items=Array.from({length:30},(_,i)=>({id:`saved${i}`,title:`Saved question ${i+1}?`,choices:['Tea','Coffee','Water','Juice','Milk'],history:[]}));
test.beforeEach(async({context})=>{
  await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  await context.addInitScript(({key,items})=>localStorage.setItem(key,JSON.stringify({version:1,items})),{key,items});
});
for(const locale of ['', '/en','/ar'])test(`${locale||'ja'} choose three from thirty, answer consecutively, no automatic moderation`,async({page},testInfo)=>{
  const sent=[];let creation;
  page.on('request',r=>{if(r.method()==='POST'){const path=new URL(r.url()).pathname;if(path==='/api/questions/submissions')sent.push(r.postDataJSON());if(path==='/api/challenge/rooms')creation=r.postDataJSON();}});
  await page.goto(`${locale}/challenge?analytics=exclude`);await page.locator('#creator-name').fill('Local batch');await page.locator('[data-action="start-create"]').click();
  const before=await page.locator('[data-action="custom-question"]').boundingBox(),after=await page.locator('[data-action="personal-library"]').boundingBox();expect(after.y).toBeGreaterThanOrEqual(before.y+before.height);
  if(!locale) {await expect(page.locator('[data-action="personal-library"]')).toHaveText('過去に作った問題を使う');await expect(page.locator('[data-action="finish-early"]')).toHaveText('クイズを完成');}
  await page.locator('[data-action="personal-library"]').click();await expect(page.locator('[data-personal-select]')).toHaveCount(30);await expect(page.locator('[data-action="personal-use-batch"]')).toBeDisabled();
  for(let i=0;i<3;i++)await page.locator('[data-personal-select]').nth(i).check();
  await page.screenshot({path:testInfo.outputPath(`batch${locale.replace('/','-')}.png`)});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('[data-action="personal-use-batch"]').click();await expect(page.locator('.challenge-q-number')).toHaveText('Q1/3');await expect(page.locator('#personal-submit-consent')).not.toBeChecked();
  for(let i=0;i<3;i++){await expect(page.locator('.challenge-q-number')).toHaveText(`Q${i+1}/3`);await page.locator('[data-action="builder-answer"]').nth(i).click();}
  await expect(page.getByTestId('challenge-share-screen')).toBeVisible();expect(creation.cards.map(c=>c.title)).toEqual(items.slice(-3).reverse().map(i=>i.title));expect(creation.answers).toEqual([0,1,2]);expect(sent).toHaveLength(0);expect(JSON.stringify(creation)).not.toContain('personalTemplateId');
});
test('answered prefix survives a batch, remaining limit is enforced, and thirty-first replaces oldest',async({page})=>{
  await page.setViewportSize({width:320,height:667});await page.goto('/challenge?analytics=exclude');await page.locator('#creator-name').fill('Local limit');await page.locator('[data-action="start-create"]').click();
  for(let i=0;i<8;i++)await page.locator('[data-action="builder-answer"]').first().click();
  await page.locator('[data-action="personal-library"]').click();await page.locator('[data-personal-select]').nth(0).check();await page.locator('[data-personal-select]').nth(1).check();await expect(page.locator('[data-personal-select]').nth(2)).toBeDisabled();
  await page.locator('[data-action="personal-use-batch"]').click();await expect(page.locator('.challenge-q-number')).toHaveText('Q9/10');
  await page.locator('[data-action="custom-question"]').click();await page.locator('[data-question]').fill('The thirty-first question?');for(let i=0;i<5;i++)await page.locator('[data-option]').nth(i).fill(`Option ${i+1}`);await page.locator('[data-action="save-question-edit"]').click();await expect(page.locator('#challenge-app [role="alert"]')).toHaveCount(0);
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).items.length,key)).toBe(30);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).items.some(item=>item.id==='saved0'),key)).toBe(false);
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).items.at(-1).title,key)).toBe('The thirty-first question?');
});

for(const locale of ['', '/en','/ar'])test(`${locale||'ja'} compact library focuses the first saved question and keeps keyboard controls usable at 320px`,async({page},testInfo)=>{
  await page.setViewportSize({width:320,height:667});await page.goto(`${locale}/challenge?analytics=exclude`);await page.locator('#creator-name').fill('Local keyboard');await page.locator('[data-action="start-create"]').click();
  await page.locator('[data-action="custom-question"]').focus();await page.keyboard.press('Tab');await expect(page.locator('[data-action="personal-library"]')).toBeFocused();
  await page.keyboard.press('Enter');await expect(page.getByTestId('personal-library')).toBeFocused();
  await expect(page.locator('[data-personal-select]').first()).toBeInViewport();
  await expect(page.locator('#challenge-app')).toHaveAttribute('data-clarity-mask','true');
  const options=page.locator('[data-personal-options]').first();await options.locator('summary').focus();await page.keyboard.press('Enter');await expect(options).toHaveAttribute('open','');await page.keyboard.press('Enter');await expect(options).not.toHaveAttribute('open','');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByTestId('personal-library').focus();await page.screenshot({path:testInfo.outputPath(`library-320${locale.replace('/','-')}-viewport.png`)});
});
