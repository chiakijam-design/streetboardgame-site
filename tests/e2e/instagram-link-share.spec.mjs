import { expect, test } from './test.mjs';
import { shareCardCopy } from '../../src/platform/shareCardCopy.js';

const cards=Array.from({length:10},(_,i)=>({id:'fixture-'+i,sourceKind:'custom',title:'Fixture '+i,category:'Fixture',choices:['One','Two','Three','Four','Five']}));
async function fixture(page,scene,locale){
 await page.addInitScript(()=>{
  localStorage.setItem('watachan:analytics-excluded:v1','1');
  sessionStorage.setItem('watachan-challenge-token:QADEMO88','synthetic-participant');
  sessionStorage.setItem('live-challenge:123456',JSON.stringify({token:'synthetic-live-participant',name:'Fixture'}));
  window.__COPY_CALLS__=0;window.__OPEN_CALLS__=0;
  window.open=()=>{window.__OPEN_CALLS__++;return null;};
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__COPY_CALLS__++;window.__COPIED__=text;}}});
 });
 await page.route('**/api/**',async route=>{
  const pathname=new URL(route.request().url()).pathname;
  const room={code:'QADEMO88',creatorName:'Fixture',cards,completedParticipants:1,participantCount:1,maxParticipants:50,answers:['PRIVATE_ANSWER']};
  let body={};
  if(pathname==='/api/challenge/rooms/QADEMO88')body={room};
  if(pathname==='/api/challenge/rooms/QADEMO88/manage')body={room,participants:[{name:'PRIVATE_PARTICIPANT',submitted:false}]};
  if(pathname==='/api/challenge/rooms/QADEMO88/result')body={code:room.code,creatorName:room.creatorName,score:8,participant:{name:'Fixture',rankingParticipating:false},answers:cards.map((card,i)=>({card,selected:0,correct:i<8?0:1,match:i<8}))};
  if(pathname==='/api/live/games/123456')body={code:'123456',game:{mode:'stream-challenge',phase:'complete',subjectName:'Fixture',participantName:'Fixture',questionCount:10,resultImageSalesEnabled:false,supportPaymentsEnabled:false,results:cards.map(card=>({questionId:card.id,type:'guess-person',options:card.choices.map(text=>({text})),subjectAnswerIndex:0,myVoteIndex:0,myIsCorrect:true}))}};
  await route.fulfill({json:body});
 });
 const prefix=locale==='ja'?'':'/'+locale;
 const entry=scene==='live'?'/live-challenge':scene==='host'?'/challenge/manage':'/challenge';
 const code=scene==='live'?'123456':'QADEMO88';
 await page.goto(`${prefix}${entry}?room=${code}${scene==='host'?'#manage=synthetic-management':''}`);
 await expect(page.locator('[data-result-share=save]')).toBeEnabled({timeout:30000});
 return new URL(page.url()).origin+`${prefix}${scene==='live'?'/live-challenge':'/challenge'}?room=${code}`;
}
for(const scene of ['host','result'])for(const locale of ['ja','en','ar'])for(const width of [320,360,390,1365]){
 test(`${scene}/${locale}/${width}: Instagram copies the public link, preserves image flow and card accessibility`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});const publicUrl=await fixture(page,scene,locale);
  const controls=page.locator('[data-result-share-controls]');const social=controls.locator('[data-result-share-social]');const instagram=social.locator('[data-result-share=instagram-link]');
  await expect(social.locator('button')).toHaveCount(4);
  expect(await social.locator('button').evaluateAll(buttons=>buttons.map(b=>b.dataset.resultShare))).toEqual(['x','line','whatsapp','instagram-link']);
  const positions=await social.locator('button').evaluateAll(buttons=>buttons.map(b=>b.getBoundingClientRect().toJSON()));
  expect(positions[3].x).toBeGreaterThan(positions[2].x);expect(positions[3].y).toBeGreaterThan(positions[1].y);
  await instagram.focus();await expect(instagram).toBeFocused();await expect(instagram).toHaveCSS('outline-style','solid');await instagram.press('Enter');
  expect(await page.evaluate(()=>window.__COPIED__)).toBe(publicUrl);
  expect(await page.evaluate(()=>window.__COPY_CALLS__)).toBe(1);expect(await page.evaluate(()=>window.__OPEN_CALLS__)).toBe(0);
  await expect(controls.locator('[data-result-share-status]')).toHaveText(shareCardCopy(locale).instagramInstruction);
  expect(publicUrl).not.toMatch(/manage|PRIVATE_|synthetic-|#/);
  await expect(controls.locator('summary')).toHaveText(shareCardCopy(locale).imageSummary);
  await controls.locator('summary').click();await expect(controls.locator('[data-result-share=instagram]')).toBeVisible();
  const geometry=await controls.locator('button').evaluateAll(buttons=>buttons.filter(b=>b.getClientRects().length).map(b=>{const r=b.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right,client:b.clientWidth,scroll:b.scrollWidth,described:!!document.getElementById(b.getAttribute('aria-describedby')),icons:[...b.querySelectorAll('svg')].every(i=>i.closest('[aria-hidden="true"]'))};}));
  for(const g of geometry){expect(g.height).toBeGreaterThanOrEqual(44);expect(g.width).toBeGreaterThanOrEqual(44);expect(g.left).toBeGreaterThanOrEqual(0);expect(g.right).toBeLessThanOrEqual(width);expect(g.scroll).toBeLessThanOrEqual(g.client+1);expect(g.described).toBe(true);expect(g.icons).toBe(true);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  // Only synthetic fixtures are captured; never the user's reference/account UI.
  if(testInfo.project.name==='desktop-chrome'){
   await page.evaluate(()=>{for(const n of document.querySelectorAll('body > [role=status]'))if(n.style.zIndex==='2147483647')n.remove();});
   await controls.screenshot({path:`build/instagram-share-qa/${scene}-${locale}-${width}.png`});
  }
 });
}
for(const scene of ['host','result'])test(`${scene}: clipboard denial, fallback, rapid clicks and returning do not post or leak`,async({page})=>{
 const publicUrl=await fixture(page,scene,'ja');const controls=page.locator('[data-result-share-controls]');const button=controls.locator('[data-result-share=instagram-link]');
 await page.evaluate(()=>{
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__COPY_CALLS__++;window.__COPIED__=text;return new Promise(resolve=>{window.__COPY_RESOLVE__=resolve;});}}});
 });
 await button.click();await expect(button).toBeDisabled();await button.evaluate(b=>b.dispatchEvent(new MouseEvent('click',{bubbles:true})));
 expect(await page.evaluate(()=>window.__COPY_CALLS__)).toBe(1);
 await page.evaluate(()=>{window.__OLD_RESOLVE__=window.__COPY_RESOLVE__;window.dispatchEvent(new Event('pagehide'));});await expect(button).toBeEnabled();
 await button.click();await page.evaluate(()=>window.__OLD_RESOLVE__());await expect(button).toBeDisabled();await page.evaluate(()=>window.__COPY_RESOLVE__());await expect(button).toBeEnabled();
 await expect(controls.locator('[data-result-share-status]')).toHaveText(shareCardCopy('ja').instagramInstruction);expect(await page.evaluate(()=>window.__COPIED__)).toBe(publicUrl);
 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new DOMException('Denied','NotAllowedError');}}});document.execCommand=()=>false;});
 await button.click();await expect(controls.locator('[data-result-share-status]')).toContainText('コピーできませんでした');await expect(controls.locator('[data-result-share-url]')).toHaveValue(publicUrl);
 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});document.execCommand=()=>{const selected=document.querySelector('textarea[readonly]');window.__FALLBACK_COPIED__=selected?.value;window.__FALLBACK_SELECTION__=[selected?.selectionStart,selected?.selectionEnd];return true;};});
 await button.click();expect(await page.evaluate(()=>window.__FALLBACK_COPIED__)).toBe(publicUrl);expect(await page.evaluate(()=>window.__FALLBACK_SELECTION__)).toEqual([0,publicUrl.length]);expect(await page.evaluate(()=>window.__OPEN_CALLS__)).toBe(0);
 await page.reload();await expect(page.locator('[data-result-share=instagram-link]')).toBeEnabled();await expect(page.locator('[data-result-share-url]')).toHaveValue(publicUrl);
});
