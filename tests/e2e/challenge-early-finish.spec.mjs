import { test, expect } from './test.mjs';
import { challengeCopy } from '../../src/i18n/challenge-copy.js';
import { challengeCompletionCopy } from '../../src/i18n/challenge-completion-copy.js';

for (const [locale, count] of [['',1],['',2],['',3],['',9],['',10],['/en',2],['/ar',2]]) {
  test(`${locale || 'ja'}: ${count} answers, saved draft, confirmation, sharing and role swap`, async ({page, context},testInfo) => {
    // Everything is isolated behind the project's local test-server and MemoryKV.
    const outbound=[];
    await context.addInitScript(() => {
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{}}});
      Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{}});
    });
    await context.route('**/*', async route => {
      const url=new URL(route.request().url());
      if(!['127.0.0.1','localhost'].includes(url.hostname)) { outbound.push(url.hostname); return route.abort(); }
      return route.continue();
    });
    let creations=0;
    page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/api/challenge/rooms') creations++;});
    await page.goto(`${locale}/challenge?analytics=exclude`);
    await page.locator('#creator-name').fill('Local test');
    await page.locator('[data-action="start-create"]').click();
    await page.locator('#question-submit-consent').uncheck();
    await expect(page.locator('[data-action="finish-early"]')).toBeDisabled();
    for(let i=0;i<count;i++) {
      await expect(page.locator('.challenge-q-number')).toHaveText(`Q${i+1}/10`);
      await page.locator('[data-action="builder-answer"]').first().click();
    }
    if(count===2) {
      await page.locator('[data-action="previous-builder-question"]').click();
      await expect(page.locator('.challenge-q-number')).toHaveText('Q2/10');
      await page.locator('[data-action="builder-answer"]').first().click();
      await expect(page.locator('.challenge-q-number')).toHaveText('Q3/10');
    }
    if(count<10) {
      await page.reload();
      await page.locator('[data-action="resume-create"]').click();
      await page.locator('[data-action="finish-early"]').click();
      const completion = challengeCompletionCopy(locale.slice(1) || 'ja', count);
      await expect(page.locator('[data-action="confirm-finish"]')).toHaveText(completion.label);
      await expect(page.getByTestId('finish-quiz-confirmation')).toContainText(completion.help);
      await expect(page.getByTestId('finish-quiz-confirmation')).not.toContainText(`${count}/10`);
      await page.locator('[data-action="cancel-finish"]').click();
      await expect(page.locator('.challenge-q-number')).toHaveText(`Q${count+1}/10`);
      await page.locator('[data-action="finish-early"]').click();
      await page.locator('[data-action="confirm-finish"]').evaluate(button=>{button.click();button.click();});
    }
    await expect(page.getByTestId('challenge-share-screen')).toBeVisible();
    await expect(page.getByTestId('first-friend-prompt')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath('share-screen.png'),fullPage:true});
    await page.screenshot({path:testInfo.outputPath('share-viewport.png')});
    expect(creations).toBe(1);
    const url=new URL(page.url()),code=url.searchParams.get('room');
    // The creator's stored management capability must not turn this join into manage mode.
    await page.evaluate(()=>localStorage.removeItem('watachan-challenge-manage-history:v1'));
    await page.goto(`${locale}/challenge/ranking?room=${code}&analytics=exclude`);
    await expect(page.getByTestId('board-first-friend-prompt')).toBeVisible();
    await page.goto(`${locale}/challenge?room=${code}`);
    await page.locator('#participant-name').fill('Local guess');
    await page.locator('[data-action="join"]').click();
    for(let i=0;i<count;i++) {
      await expect(page.locator('.challenge-q-number')).toHaveText(`Q${i+1}/${count}`);
      await page.locator('[data-action="answer"]').nth(count===2&&i===1?1:0).click();
    }
    await expect(page.locator('.challenge-result')).toHaveCount(count);
    await expect(page.locator('#challenge-result-score-title')).toContainText(`/${count}`);
    if (count < 10) await expect(page.getByTestId('challenge-ai-review')).toContainText(challengeCopy(locale.slice(1) || 'ja', 'talk'));
    await expect(page.getByTestId('challenge-result-image')).toBeVisible();
    await page.screenshot({path:testInfo.outputPath('result-screen.png'),fullPage:true});
    await page.screenshot({path:testInfo.outputPath('result-viewport.png')});
    await page.locator('[data-action="swap-roles"]').click();
    await expect(page.locator('.challenge-q-number')).toHaveText(`Q1/${count}`);
    await expect(page.locator('[data-action="finish-early"]')).toBeDisabled();
    await page.reload();
    await page.locator('[data-action="resume-create"]').click();
    await expect(page.locator('.challenge-q-number')).toHaveText(`Q1/${count}`);
    // No native share / clipboard / SNS destination is invoked by this test.
    expect(outbound.every(host=>!host.includes('streetboardgame.com'))).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  });
}

test('builder ignores a duplicate pointer click on the previous question',async({page})=>{
  await page.goto('/challenge');await page.locator('#creator-name').fill('Local duplicate');
  await page.locator('[data-action="start-create"]').click();
  await page.locator('[data-action="builder-answer"]').first().dblclick();
  await expect(page.locator('.challenge-q-number')).toHaveText('Q2/10');
});

for(const locale of ['', '/en'])test(`${locale||'ja'}: weekly themes use available approved packs`,async({page,context},testInfo)=>{
  await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  await page.goto(`${locale}/challenge/library?analytics=exclude`);
  const weekly=page.getByTestId('weekly-question-packs');
  await expect(weekly).toBeVisible();
  await expect(weekly.locator('article')).toHaveCount(3);
  await expect(weekly.locator('time')).toHaveAttribute('datetime',/^\d{4}-\d{2}-\d{2}$/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('weekly-themes.png'),fullPage:true});
  await weekly.locator('a').first().click();
  await page.locator('#creator-name').fill('Local weekly');
  await page.locator('[data-action="start-create"]').click();
  await expect(page.locator('.challenge-q-number')).toHaveText('Q1/10');
});

test('participant double click answers only one question, even with a fast local API', async ({page,request}) => {
  const cards=Array.from({length:3},(_,i)=>({id:`DBL${i}`,category:'Local test',title:`Question ${i+1}`,choices:['One','Two','Three','Four','Five']}));
  const response=await request.post('/api/challenge/rooms',{data:{creatorName:'Local double',cards,answers:[0,0,0]}});
  expect(response.status()).toBe(201);
  const {code}=await response.json();
  let answerRequests=0;
  page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/answer'))answerRequests+=1;});
  await page.goto(`/challenge?room=${code}&analytics=exclude`);
  await page.locator('#participant-name').fill('Local guest');
  await page.locator('[data-action="join"]').click();
  await expect(page.locator('.challenge-q-number')).toHaveText('Q1/3');
  await page.locator('[data-action="answer"]').first().dblclick({ delay: 150 });
  await expect(page.locator('.challenge-q-number')).toHaveText('Q2/3');
  expect(answerRequests).toBe(1);
  await page.reload();
  await expect(page.locator('.challenge-q-number')).toHaveText('Q2/3');
  await page.locator('[data-action="answer"]').first().click();
  await expect(page.locator('.challenge-q-number')).toHaveText('Q3/3');
  await page.locator('[data-action="answer"]').first().click();
  await expect(page.getByRole('heading',{name:'3/3問 正解',exact:true})).toBeVisible();
  expect(answerRequests).toBe(3);
});
