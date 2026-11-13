import {test,expect} from './test.mjs';
import fs from 'node:fs/promises';
import {challengeResultCopy as copy} from '../../src/i18n/challenge-result-copy.js';
const before=process.env.WATA_RESULT_LAYOUT_PHASE==='before';
const out=new URL('../../../result-layout-previews-20261102/',import.meta.url);
async function result({page,context,request},locale,count,width){
 await context.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 await page.setViewportSize({width,height:844});
 const made=await request.post('/api/challenge/rooms',{data:{creatorName:'Synthetic host',cards:Array.from({length:count},(_,i)=>({id:'layout'+i,title:'Synthetic question '+(i+1),choices:['A','B','C','D','E']})),answers:Array(count).fill(0)}});expect(made.status()).toBe(201);
 const {code}=await made.json(),prefix=locale==='ja'?'':'/'+locale;
 await page.goto(`${prefix}/challenge?room=${code}&analytics=exclude`);
 await page.locator('#participant-name').fill('Synthetic player');await page.locator('[data-action="join"]').click();
 for(let i=0;i<count;i++){await expect(page.locator('.challenge-q-number')).toHaveText(`Q${i+1}/${count}`);await page.locator('[data-action="answer"]').first().click();}
 await expect(page.getByTestId('challenge-result-image')).toBeVisible();
 return {code,prefix};
}
const cases=before?[[390,'ja',10]]:[[1200,'ja',10],[390,'ja',1],[390,'ja',10],[320,'ja',10],[390,'en',2],[320,'ar',10],[390,'he',3]];
for(const [width,locale,count] of cases)test(`${before?'before':'after'} ${locale} ${width}px ${count} questions`,async({page,context,request},info)=>{
 const {code,prefix}=await result({page,context,request},locale,count,width);
 const board=page.getByTestId('understanding-board');await expect(board).toBeVisible();await expect(board.locator('li')).toHaveCount(1);
 if(!before){
  const next=page.getByTestId('challenge-role-swap'),details=page.getByTestId('challenge-result-details'),summary=details.locator('summary');
  await expect(next).toHaveAccessibleName(copy(locale,'heading'));
  await expect(next.getByRole('button')).toHaveText(copy(locale,'same'));
  await expect(next.getByRole('link')).toHaveText(copy(locale,'fresh'));
  await expect(next.getByRole('link')).toHaveAttribute('href',`${prefix}/challenge`);
  expect(await page.locator('[data-action="swap-roles"]').count()).toBe(1);
  expect(await page.locator('.challenge-result-image-section').evaluate(e=>e.nextElementSibling?.matches('[data-testid="challenge-role-swap"]'))).toBe(true);
  expect(await next.evaluate(e=>!!(e.compareDocumentPosition(document.querySelector('[data-testid="understanding-board"]'))&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  // Question-by-question results start open (11/13 request) and can still be closed.
  await expect(details).toHaveAttribute('open','');await expect(page.locator('.challenge-results')).toBeVisible();await expect(page.locator('.challenge-result[data-result-answer]')).toHaveCount(count);await expect(summary).toHaveAccessibleName(copy(locale,'close'));
  for(let i=0;i<2;i++){await summary.press('Enter');await expect(details).not.toHaveAttribute('open','');await expect(page.locator('.challenge-results')).not.toBeVisible();await expect(summary).toHaveAccessibleName(copy(locale,'details'));await summary.press('Space');await expect(details).toHaveAttribute('open','');await expect(page.locator('.challenge-result[data-result-answer]')).toHaveCount(count);}
  await summary.click();await page.locator('[data-action="refresh-board"]').click();await expect(details).not.toHaveAttribute('open','');
  await expect(page.getByTestId('challenge-result-share')).toBeVisible();expect(await page.getByTestId('challenge-result-share').evaluate(e=>!!e.closest('details'))).toBe(false);
  await summary.click();
  if(['ar','he'].includes(locale))await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  expect(await next.getByRole('button').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await page.goto(`${prefix}/challenge/library?analytics=exclude`);await page.goBack();await expect(page.getByTestId('challenge-role-swap')).toBeVisible();await expect(board.locator('li')).toHaveCount(1);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 await fs.mkdir(out,{recursive:true});
 await page.evaluate(()=>{const e=document.querySelector('.challenge-result-image-section');window.scrollTo(0,e.offsetTop+e.offsetHeight-100);});
 await page.screenshot({path:new URL(`${before?'before':'after'}-${locale}-${width}-${count}-${info.project.name}.png`,out).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 if(!before&&locale==='ja'&&width===390){await page.locator('[data-action="swap-roles"]').click();const paper=page.getByTestId('challenge-builder-paper-card');await expect(paper.getByRole('button')).toHaveCount(5);await expect(page.locator('[data-action="builder-answer"].is-selected')).toHaveCount(0);await expect(paper).toContainText('Synthetic question 1');}
});
