import { createIsolatedContext } from '../helpers/test-network-guard.mjs';
import {test,expect} from './test.mjs';
const choices=['A','B','C','D','E'];
async function isolate(context){await context.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());}
async function play(browser,code,name,choice){
 const context=await createIsolatedContext(browser);await isolate(context);const page=await context.newPage();
 await page.goto(`/challenge?room=${code}&analytics=exclude`);
 await page.locator('#participant-name').fill(name);
 await page.locator('[data-action="join"]').evaluate(b=>b.click());
 for(let i=0;i<2;i++){await expect(page.locator('.challenge-q-number')).toHaveText(`Q${i+1}/2`);await page.locator('[data-action="answer"]').nth(choice).click();}
 await expect(page.getByTestId('challenge-result-image')).toBeVisible();
 return {context,page};
}
test('respondents see everyone\'s answers only after three people finish, as shares without names',async({browser,request})=>{
 const made=await request.post('/api/challenge/rooms',{data:{creatorName:'Synthetic host',cards:[0,1].map(i=>({id:'crowd'+i,title:'Synthetic crowd '+i,choices})),answers:[0,0]}});
 expect(made.status()).toBe(201);const {code}=await made.json();
 const first=await play(browser,code,'CrowdOne',1);
 await expect(first.page.getByTestId('challenge-result-details')).toHaveAttribute('open','');
 await expect(first.page.getByTestId('challenge-result-crowd-wait')).toBeVisible();
 await expect(first.page.getByTestId('challenge-result-crowd')).toHaveCount(0);
 const second=await play(browser,code,'CrowdTwo',1);
 const third=await play(browser,code,'CrowdThree',0);
 await expect(third.page.getByTestId('challenge-result-details')).toHaveAttribute('open','');
 const crowd=third.page.getByTestId('challenge-result-crowd');
 await expect(crowd).toHaveCount(2);
 await expect(crowd.first()).toContainText('67%');
 await expect(crowd.first()).toContainText('33%');
 await expect(crowd.first()).not.toContainText('CrowdOne');
 await expect(third.page.getByTestId('challenge-result-crowd-wait')).toHaveCount(0);
 expect(await third.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 for(const p of [first,second,third])await p.context.close();
});
