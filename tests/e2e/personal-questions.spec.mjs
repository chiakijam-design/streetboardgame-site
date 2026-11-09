import { createIsolatedContext } from '../helpers/test-network-guard.mjs';
import {test,expect} from './test.mjs';
const key='watachan:my-questions:v1';
const title='Local-only sample question?';
const choices=['Morning','Afternoon','Evening','Night','Any time'];
test.beforeEach(async({context})=>{
  await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
});
async function start(page,locale='') {await page.goto(`${locale}/challenge?analytics=exclude`);await page.locator('#creator-name').fill('Local author');await page.locator('[data-action="start-create"]').click();}
async function custom(page) {await page.locator('[data-action="custom-question"]').click();await page.locator('[data-question]').fill(title);for(let i=0;i<5;i++)await page.locator('[data-option]').nth(i).fill(choices[i]);}
async function save(page) {await expect(page.locator('[data-action="personal-save-current"]')).toHaveCount(0);await page.locator('[data-action="save-question-edit"]').click();await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k))?.items.length,key)).toBeGreaterThan(0);}
async function finishOne(page) {await page.locator('[data-action="builder-answer"]').first().click();await page.locator('[data-action="finish-early"]').click();await page.locator('[data-action="confirm-finish"]').click();await expect(page.getByTestId('challenge-share-screen')).toBeVisible();return new URL(page.url()).searchParams.get('room');}

for(const locale of ['', '/en','/ar']) test(`${locale||'ja'} personal save, resume, fresh answer, issued copy, edit and delete`,async({page,context,request},testInfo)=>{
  const submissions=[];let created;
  page.on('request',r=>{const path=new URL(r.url()).pathname;if(r.method()==='POST'&&path==='/api/questions/submissions')submissions.push(r.postDataJSON());if(r.method()==='POST'&&path==='/api/challenge/rooms')created=r.postDataJSON();});
  await start(page,locale);await custom(page);await save(page);
  await expect(page.locator('#personal-submit-consent')).not.toBeChecked();
  await expect(page.locator('#question-submit-consent')).not.toBeVisible();
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).items[0],key)).toEqual(expect.objectContaining({title,choices}));
  expect(await page.evaluate(k=>Object.keys(JSON.parse(localStorage.getItem(k)).items[0]).sort(),key)).toEqual(['choices','history','id','title']);
  await page.locator('[data-action="builder-answer"]').first().click();
  await page.locator('[data-action="previous-builder-question"]').click();
  await page.locator('[data-action="personal-library"]').click();
  await expect(page.locator('[data-personal-use]')).toHaveCount(1);
  await page.screenshot({path:testInfo.outputPath(`personal-library${locale.replace('/','-')}.png`),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('[data-personal-use]').focus();await page.keyboard.press('Enter');
  await expect(page.locator('[data-action="builder-answer"]').first()).toBeFocused();
  await expect(page.locator('[data-action="finish-early"]')).toBeDisabled();
  await page.reload();await page.locator('[data-action="resume-create"]').click();
  await expect(page.locator('#personal-submit-consent')).not.toBeChecked();
  const code=await finishOne(page);
  expect(submissions).toHaveLength(0);expect(created.cards).toHaveLength(1);
  expect(created.cards[0]).not.toHaveProperty('personalQuestion');expect(created.cards[0]).not.toHaveProperty('personalSubmissionConsent');
  await start(page,locale);await page.locator('[data-action="personal-library"]').click();
  await page.locator('[data-personal-edit]').click();await page.locator('#personal-question').fill('Edited local template?');
  await page.locator('[data-action="personal-update"]').click();
  await expect(page.locator('.challenge-personal-list h2')).toHaveText('Edited local template?');
  // Issued server snapshot is independent of all later library changes.
  const data=await (await request.get(`/api/challenge/rooms/${code}`)).json();expect(data.room.cards[0].title).toBe(title);expect(data.room.cards[0].choices).toEqual(choices);
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('[data-personal-delete]').click();await expect(page.locator('[data-personal-use]')).toHaveCount(1);
  page.once('dialog',dialog=>dialog.accept());await page.locator('[data-personal-delete]').click();await expect(page.locator('[data-personal-use]')).toHaveCount(0);
  await page.reload();await page.locator('[data-action="resume-create"]').click();await page.locator('[data-action="personal-library"]').click();await expect(page.locator('[data-personal-use]')).toHaveCount(0);
  const final=await (await request.get(`/api/challenge/rooms/${code}`)).json();expect(final.room.cards[0].title).toBe(title);
});

test('explicit personal candidate opt-in survives draft while local library never stores it',async({page})=>{
  const submissions=[];page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/api/questions/submissions')submissions.push(r.postDataJSON());});
  await start(page);await custom(page);await save(page);
  await page.locator('#personal-submit-consent').check();await page.reload();await page.locator('[data-action="resume-create"]').click();
  await expect(page.locator('#personal-submit-consent')).toBeChecked();
  await finishOne(page);await expect.poll(()=>submissions.length).toBe(1);
  expect(submissions[0].questions.map(q=>q.title)).toEqual([title]);
  const raw=await page.evaluate(k=>localStorage.getItem(k),key);expect(raw).not.toContain('Consent');expect(raw).not.toContain('answer');
  await start(page);await page.locator('[data-action="personal-library"]').click();await page.locator('[data-personal-use]').click();await expect(page.locator('#personal-submit-consent')).not.toBeChecked();
});

test('storage denied and invalid templates show failure without server fallback or loss of input',async({page,context})=>{
  await context.addInitScript(k=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===k)throw new DOMException('denied','QuotaExceededError');return original.call(this,key,value);};},key);
  const requests=[];page.on('request',r=>{if(r.method()==='POST')requests.push(new URL(r.url()).pathname);});
  await start(page);await custom(page);await page.locator('[data-action="save-question-edit"]').click();
  await expect(page.locator('#challenge-app [role="alert"]')).toBeVisible();await page.locator('[data-action="edit-question"]').click();await expect(page.locator('[data-question]')).toHaveValue(title);
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBeNull();
  expect(requests.filter(p=>p==='/api/questions/submissions'||p==='/api/challenge/rooms')).toHaveLength(0);
  await page.locator('[data-option]').nth(1).fill(choices[0]);await page.locator('[data-action="save-question-edit"]').click();
  await expect(page.locator('#challenge-app [role="alert"]')).toContainText('80');
});

test('same-browser shared visibility and a different browser context has no templates; 320px remains usable',async({page,context,browser},testInfo)=>{
  await page.setViewportSize({width:320,height:667});await start(page);await custom(page);await save(page);
  await page.locator('[data-action="personal-library"]').click();await page.screenshot({path:testInfo.outputPath('library-320.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator('[data-personal-use]')).toBeVisible();
  const other=await context.newPage();await start(other);await other.locator('[data-action="personal-library"]').click();await expect(other.locator('[data-personal-use]')).toHaveCount(1);await other.close();
  const separate=await createIsolatedContext(browser);await separate.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  const clean=await separate.newPage();await clean.goto(page.url());expect(await clean.evaluate(k=>localStorage.getItem(k),key)).toBeNull();await separate.close();
});
