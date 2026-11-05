import {test,expect} from './test.mjs';
const key='watachan:my-questions:v1';
const choices=['First','Second','Third','Fourth','Fifth'];
test.beforeEach(async({context})=>{await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());});
async function start(page){await page.goto('/challenge?analytics=exclude');await page.locator('#creator-name').fill('Local autosave');await page.locator('[data-action="start-create"]').click();}
async function fillCustom(page,title){await page.locator('[data-action="custom-question"]').click();await page.locator('[data-question]').fill(title);for(let i=0;i<5;i++)await page.locator('[data-option]').nth(i).fill(choices[i]);}

test('confirming choices-only edits automatically saves one whole set and clears the outdated answer',async({page},testInfo)=>{
  await start(page);await page.locator('[data-action="edit-question"]').click();
  await expect(page.locator('[data-action="personal-save-current"]')).toHaveCount(0);await expect(page.getByTestId('personal-autosave-notice')).toContainText('30');
  const title=await page.locator('[data-question]').inputValue();
  await page.locator('[data-option]').first().fill('Local edited choice');
  await page.screenshot({path:testInfo.outputPath('autosave-editor.png'),fullPage:true});
  await page.locator('[data-action="save-question-edit"]').evaluate(button=>{button.click();button.click();});
  let data=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);expect(data.items).toHaveLength(1);expect(data.items[0].title).toBe(title);expect(data.items[0].choices[0]).toBe('Local edited choice');
  await expect(page.locator('#personal-submit-consent')).not.toBeChecked();await expect(page.locator('#challenge-app [role="alert"]')).toHaveCount(0);
  await page.locator('[data-action="builder-answer"]').first().click();await page.locator('[data-action="previous-builder-question"]').click();await page.locator('[data-action="edit-question"]').click();await page.locator('[data-option]').first().fill('A later edited choice');await page.locator('[data-action="save-question-edit"]').click();
  await expect(page.locator('[data-action="finish-early"]')).toBeDisabled();
  const after=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);expect(after.items).toHaveLength(1);expect(after.items[0].id).toBe(data.items[0].id);expect(after.items[0].history[0].choices[0]).toBe('Local edited choice');expect(after.items[0].history[0].title).toBe(title);
});

test('automatic latest-thirty replacement preserves an issued quiz and shows the newest set first',async({page,context,request})=>{
  const items=Array.from({length:30},(_,i)=>({id:`old${i}`,title:`Saved original ${i}?`,choices,history:[]}));
  await context.addInitScript(({key,items})=>localStorage.setItem(key,JSON.stringify({version:1,items})),{key,items});
  const response=await request.post('/api/challenge/rooms',{data:{creatorName:'Local old copy',cards:[{...items[0],id:'USRoldcopy'}],answers:[0]}});expect(response.status()).toBe(201);const{code}=await response.json();
  await start(page);await fillCustom(page,'A newly confirmed question?');await page.locator('[data-action="save-question-edit"]').click();
  const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).items,key);expect(saved).toHaveLength(30);expect(saved.some(item=>item.id==='old0')).toBe(false);expect(saved.at(-1).title).toBe('A newly confirmed question?');
  const issued=await(await request.get(`/api/challenge/rooms/${code}`)).json();expect(issued.room.cards[0].title).toBe(items[0].title);expect(issued.room.cards[0].choices).toEqual(choices);
  await page.locator('[data-action="personal-library"]').click();await expect(page.locator('.challenge-personal-list h2').first()).toHaveText('A newly confirmed question?');
});

test('a failed automatic local save leaves the quiz playable and never submits for review',async({page,context})=>{
  await context.addInitScript(key=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Denied','QuotaExceededError');return set.call(this,k,v);};},key);
  const submitted=[];let created;
  page.on('request',r=>{if(r.method()==='POST'){const path=new URL(r.url()).pathname;if(path==='/api/questions/submissions')submitted.push(r.postDataJSON());if(path==='/api/challenge/rooms')created=r.postDataJSON();}});
  await start(page);await fillCustom(page,'Local storage failure question?');await page.locator('[data-action="save-question-edit"]').click();await expect(page.locator('#challenge-app [role="alert"]')).toBeVisible();
  await page.locator('[data-action="builder-answer"]').first().click();await page.locator('[data-action="finish-early"]').click();await page.locator('[data-action="confirm-finish"]').click();await expect(page.getByTestId('challenge-share-screen')).toBeVisible();await expect(page.getByTestId('challenge-share-screen').getByRole('alert')).toBeVisible();
  expect(created.cards[0].title).toBe('Local storage failure question?');expect(created.cards[0].choices).toEqual(choices);expect(JSON.stringify(created)).not.toContain('personalSaveError');expect(submitted).toHaveLength(0);expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBeNull();
});

test('cancelling an unconfirmed custom edit does not replace any saved question',async({page,context})=>{
  await start(page);await fillCustom(page,'Cancelled local edit?');await page.locator('[data-action="cancel-question-edit"]').click();expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBeNull();await expect(page.locator('[data-action="builder-answer"]').first()).toBeVisible();
});
