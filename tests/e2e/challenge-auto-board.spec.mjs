import { createIsolatedContext } from '../helpers/test-network-guard.mjs';
import {test,expect} from './test.mjs';
import {boardCopy} from '../../src/i18n/challenge-board-copy.js';
const choices=['A','B','C','D','E'];
async function room(request,count){const r=await request.post('/api/challenge/rooms',{data:{creatorName:'LocalHost',cards:Array.from({length:count},(_,i)=>({id:'local'+i,title:'Synthetic '+i,choices})),answers:Array(count).fill(0)}});expect(r.status()).toBe(201);return r.json();}
async function isolate(context){await context.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());}
async function answer(page,count,choice){for(let i=0;i<count;i++){await expect(page.locator('.challenge-q-number')).toHaveText(`Q${i+1}/${count}`);await page.locator('[data-action="answer"]').nth(choice).click();}await expect(page.getByTestId('challenge-result-image')).toBeVisible();}
for(const [locale,count] of [['ja',1],['ja',2],['ja',3],['ja',9],['ja',10],['en',2],['ar',2]])test(`${locale} ${count}: automatic board and best-score round trip`,async({page,context,request},info)=>{
 await isolate(context);const data=await room(request,count),prefix=locale==='ja'?'':'/'+locale;
 await page.goto(`${prefix}/challenge?room=${data.code}&analytics=exclude`);
 await expect(page.getByTestId('automatic-board-notice')).toHaveText(boardCopy(locale,'notice'));
 await page.locator('#participant-name').fill('LocalA');
 await page.locator('[data-action="join"]').evaluate(b=>{b.click();b.click();});
 await answer(page,count,1);
 const board=page.getByTestId('understanding-board');
 await expect(board).toBeVisible();await expect(board.locator('li')).toHaveCount(1);await expect(board).toContainText(`0/${count}`);
 await expect(page.locator('[data-action="toggle-ranking"], [data-action="publish-board-only"]')).toHaveCount(0);
 await page.reload();await expect(board.locator('li')).toHaveCount(1);
 await page.locator('[data-action="retry-challenge"]').evaluate(b=>{b.click();b.click();});
 await expect(page.locator('.challenge-q-number')).toHaveText(`Q1/${count}`);
 if(count>1){await page.locator('[data-action="answer"]').first().click();await page.reload();await expect(page.locator('.challenge-q-number')).toHaveText(`Q2/${count}`);for(let i=1;i<count;i++){await expect(page.locator('.challenge-q-number')).toHaveText(`Q${i+1}/${count}`);await page.locator('[data-action="answer"]').first().click();}await expect(page.getByTestId('challenge-result-image')).toBeVisible();}else await answer(page,count,0);
 await expect(board.locator('li')).toHaveCount(1);await expect(board).toContainText(`${count}/${count}`);
 await page.locator('[data-action="retry-challenge"]').click();await answer(page,count,1);
 await expect(page.locator('#challenge-result-score-title')).toContainText(`0/${count}`);await expect(board).toContainText(`${count}/${count}`);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('automatic-best-score.png'),fullPage:true});
 // A separate guest context with the same name must remain a separate person.
 const guest=await createIsolatedContext(context.browser());await isolate(guest);const second=await guest.newPage();
 await second.goto(`${info.project.use.baseURL||'http://127.0.0.1:4187'}${prefix}/challenge?room=${data.code}&analytics=exclude`);
 await second.locator('#participant-name').fill('LocalA');await second.locator('[data-action="join"]').click();await answer(second,count,1);
 await expect(second.getByTestId('understanding-board').locator('li')).toHaveCount(2);await guest.close();
 await page.goto(`${prefix}/challenge/manage?room=${data.code}#manage=${data.manageToken}`);
 await expect(page.getByTestId('understanding-board').locator('li')).toHaveCount(2);
 await page.screenshot({path:info.outputPath('creator-always-visible.png'),fullPage:true});
});
test('legacy private completion stays private until a disclosed new attempt',async({page,context,request})=>{
 await isolate(context);const data=await room(request,1),path=`/api/challenge/rooms/${data.code}`;
 const joined=await (await request.post(path+'/join',{data:{name:'Legacy'}})).json();
 await request.post(path+'/submit',{headers:{'x-challenge-participant-token':joined.participantToken},data:{answers:[0]}});
 await page.addInitScript(({code,token})=>localStorage.setItem(`watachan-challenge-token:${code}`,token),{code:data.code,token:joined.participantToken});
 // Use the ordinary start flow to reuse the token under the existing storage key.
 await page.goto(`/challenge?room=${data.code}&analytics=exclude`);
 await expect(page.getByTestId('challenge-result-image')).toBeVisible();
 await expect(page.locator('.challenge-result-retry-note')).toHaveText(boardCopy('ja','legacy'));
 expect((await (await request.get(path+'/ranking')).json()).participants).toHaveLength(0);
 await page.locator('[data-action="retry-challenge"]').click();await answer(page,1,1);
 await expect(page.getByTestId('understanding-board').locator('li')).toHaveCount(1);
 await expect(page.getByTestId('understanding-board')).toContainText('0/1');
});
test('keyboard refresh, browser back and role swap never copy another quiz board',async({page,context,request},info)=>{
 await isolate(context);const data=await room(request,1);
 await page.goto(`/challenge?room=${data.code}&analytics=exclude`);
 await page.locator('#participant-name').fill('LocalNav');await page.locator('[data-action="join"]').click();await answer(page,1,0);
 await page.locator('[data-action="refresh-board"]').press('Enter');
 await expect(page.getByTestId('understanding-board').locator('li')).toHaveCount(1);
 await page.goto('/challenge/library?analytics=exclude');await page.goBack();
 await expect(page.getByTestId('understanding-board').locator('li')).toHaveCount(1);
 await page.getByTestId('understanding-board').screenshot({path:info.outputPath('final-board-layout.png')});
 await page.locator('[data-action="swap-roles"]').click();await page.locator('#question-submit-consent').uncheck();
 await page.locator('[data-action="builder-answer"]').first().click();
 await expect(page.getByTestId('challenge-share-screen')).toBeVisible();
 await expect(page.getByTestId('understanding-board').locator('li')).toHaveCount(0);
 await expect(page.getByTestId('board-first-friend-prompt')).toBeVisible();
});
