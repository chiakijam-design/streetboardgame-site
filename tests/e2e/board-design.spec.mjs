import {test,expect} from './test.mjs';
import fs from 'node:fs/promises';
const phase=process.env.WATA_BOARD_DESIGN_PHASE||'after';
const out=new URL('../../../board-design-previews-20261101/',import.meta.url);
const names=['ミント','ながい名前のテスト例','同点テストA','MWWMWMWWWMWM','テストB','テストC','テストD','テストE'];
const fixtures=n=>Array.from({length:n},(_,i)=>({name:names[i%names.length]+(i>=8?String(i+1):''),score:i<2?8:Math.max(0,8-Math.floor(i/2))}));
async function openBoard({page,context,request},width,locale,n){
 await context.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 await page.setViewportSize({width,height:844});
 const made=await request.post('/api/challenge/rooms',{data:{creatorName:'Synthetic host',cards:Array.from({length:10},(_,i)=>({id:'design'+i,title:'Synthetic '+i,choices:['A','B','C','D','E']})),answers:Array(10).fill(0)}});expect(made.status()).toBe(201);
 const {code}=await made.json();const actual=await (await request.get(`/api/challenge/rooms/${code}/ranking`)).json();let refreshCount=0,fail=false;
 await page.route(`**/api/challenge/rooms/${code}/ranking`,async r=>{refreshCount++;await r.fulfill({status:fail?503:200,json:fail?{error:'temporary-error'}:{...actual,participants:fixtures(n)}});});
 await page.goto(`${locale==='ja'?'':'/'+locale}/challenge/ranking?room=${code}&analytics=exclude`);
 const board=page.getByTestId('understanding-board');await expect(board).toBeVisible();await expect(board.locator('li')).toHaveCount(n);
 return {board,refresh:page.locator('[data-action="refresh-board"]'),count:()=>refreshCount,fail:()=>{fail=true;}};
}
const cases=phase==='before'?[[390,'ja',1],[390,'ja',8]]:[[1200,'ja',1],[390,'ja',1],[320,'ja',1],[390,'ja',8],[320,'ja',8],[1200,'ja',50],[390,'ja',50],[320,'ja',50],[390,'ja',0],[320,'ja',0],[390,'ar',8],[320,'ar',8],[390,'en',8]];
for(const [width,locale,n] of cases)test(`${phase} ${locale} ${width}px ${n} rows`,async ({page,context,request})=>{
 const args={page,context,request};
 const {board,refresh}=await openBoard(args,width,locale,n);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 if(n){expect(await board.locator('li b').allTextContents()).toEqual(fixtures(n).map(p=>p.name));await expect(board.locator('li strong').first()).toHaveText('8/10');}
 if(phase==='after'){
  const rect=await refresh.boundingBox();expect(rect.width).toBeGreaterThanOrEqual(44);expect(rect.height).toBeGreaterThanOrEqual(44);expect(rect.width).toBeLessThanOrEqual(48);
  await expect(refresh).toHaveAccessibleName(locale==='ja'?'理解度ボードを更新':/.+/);
  if(locale!=='ja')expect(await refresh.getAttribute('aria-label')).not.toContain('理解度');
  const bounds=await board.boundingBox();expect(rect.x).toBeGreaterThanOrEqual(bounds.x);expect(rect.x+rect.width).toBeLessThanOrEqual(bounds.x+bounds.width+1);
  if(n){await expect(board.locator('.challenge-board-rank')).toHaveCount(n);expect(await board.locator('li').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1))).toBe(true);}
  if(n){const c=await board.locator('li strong').first().evaluate(e=>({fg:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor}));const lum=v=>{const rgb=v.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};const l=[lum(c.fg),lum(c.bg)].sort((a,b)=>b-a);expect((l[0]+.05)/(l[1]+.05)).toBeGreaterThanOrEqual(4.5);}
  if(locale==='ar')await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 }
 await fs.mkdir(out,{recursive:true});await board.screenshot({path:new URL(`${phase}-${locale}-${width}-${n}.png`,out).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
});
if(phase==='after')test('refresh stays keyboard-accessible and readable after a load error',async ({page,context,request})=>{
 const args={page,context,request};
 const state=await openBoard(args,320,'ja',8);await state.refresh.focus();
 expect(await state.refresh.evaluate(e=>getComputedStyle(e).outlineStyle)).not.toBe('none');
 const count=state.count();await state.refresh.press('Enter');await expect.poll(state.count).toBeGreaterThan(count);await expect(state.board.locator('li')).toHaveCount(8);
 state.fail();await args.page.locator('[data-action="refresh-board"]').click();await expect(args.page.locator('.challenge-error')).toBeVisible();await expect(state.board.locator('li')).toHaveCount(8);
 expect(await args.page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 await state.board.screenshot({path:new URL('after-refresh-error.png',out).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
});
if(phase==='after')test('loading placeholder resolves to the same board without overflow',async ({page,context,request})=>{
 await context.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 await page.setViewportSize({width:320,height:667});
 const made=await request.post('/api/challenge/rooms',{data:{creatorName:'Synthetic host',cards:[{id:'loading',title:'Synthetic',choices:['A','B','C','D','E']}],answers:[0]}});expect(made.status()).toBe(201);const {code}=await made.json();
 const actual=await (await request.get(`/api/challenge/rooms/${code}/ranking`)).json();let release;const gate=new Promise(r=>{release=r;});
 await page.route(`**/api/challenge/rooms/${code}/ranking`,async r=>{await gate;await r.fulfill({json:actual});});
 await page.goto(`/challenge/ranking?room=${code}&analytics=exclude`);await expect(page.locator('.challenge-loader')).toBeVisible();release();await expect(page.getByTestId('understanding-board')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});
