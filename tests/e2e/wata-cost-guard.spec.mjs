import {test,expect} from './test.mjs';
const id='11111111-1111-4111-8111-111111111111';
const submission={id,sourceMode:'challenge',title:'合成テストで休憩するなら？',choices:['散歩','読書','音楽','ゲーム','昼寝'],status:'pending',reviewNote:''};
for(const status of [429,503])test(`read ${status} preserves edits, allows one review, no automatic retry`,async({page,context},info)=>{
  await context.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  let reads=0,writes=0;
  const second={...submission,id:'22222222-2222-4222-8222-222222222222'};
  await page.route('**/api/live/admin/session',r=>r.fulfill({json:{csrfToken:'synthetic-only',trusted:true,expiresAt:Date.now()+900000}}));
  await page.route('**/api/questions/admin/overview*',r=>{reads++;return reads===1?r.fulfill({json:{catalog:[],reports:[],selectionStats:[],submissions:[submission,second],submissionPagination:{offset:0,limit:50,total:2}}}):r.fulfill({status,headers:{'retry-after':'60'},json:{error:status===429?'cost-guard-limit':'cost-guard-unavailable',retryAfter:60}});});
  await page.route('**/api/questions/admin/submissions/*/review',r=>{writes++;return r.fulfill({json:writes===1?{submissionId:id,status:'approved',catalogId:'LEGACY-ACK'}:{submissionId:second.id,status:'rejected',catalogId:null,question:null}});});
  await page.goto('/question-ops?analytics=exclude');
  const row=page.locator(`[data-submission="${second.id}"]`);
  await expect(row).toBeVisible();
  await row.locator('[data-field=reviewNote]').fill('合成の未保存メモ');
  page.on('dialog',d=>d.accept());
  // A legacy/noncanonical acknowledgement requires a real full resync.
  // The login-only load button is hidden after authentication.
  await page.locator(`[data-submission="${id}"] [data-approve]`).click();
  await expect(page.locator('#authStatus')).toContainText(status===429?'取得上限':'確認できない');
  await expect(page.locator('#dashboard')).toBeVisible();
  await expect(row.locator('[data-field=reviewNote]')).toHaveValue('合成の未保存メモ');
  await expect(row.locator('[data-reject]')).toBeEnabled();
  await row.locator('[data-field=reviewNote]').focus();
  await page.keyboard.press('Tab');
  await row.locator('[data-reject]').click();
  await expect(row).toHaveCount(0);expect(writes).toBe(2);expect(reads).toBe(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath('budget-ui.png'),fullPage:false});
});
test('first read denied does not expose an empty authenticated dashboard',async({page,context})=>{
  await context.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await page.route('**/api/live/admin/session',r=>r.fulfill({json:{csrfToken:'synthetic-only',trusted:true,expiresAt:Date.now()+900000}}));
  await page.route('**/api/questions/admin/overview*',r=>r.fulfill({status:503,json:{error:'cost-guard-unavailable'}}));
  await page.goto('/question-ops?analytics=exclude');await expect(page.locator('#authStatus')).toContainText('確認できない');await expect(page.locator('#dashboard')).toBeHidden();
});
