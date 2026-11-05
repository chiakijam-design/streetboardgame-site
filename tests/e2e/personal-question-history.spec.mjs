import {test,expect} from './test.mjs';
const key='watachan:my-questions:v1';
const oldTitle='Original private question?',newTitle='New saved question?',currentTitle='Keep this current question?';
const oldChoices=['Dawn','Morning','Noon','Evening','Night'];
const newChoices=['Tea','Water','Coffee','Juice','Milk'];
test.beforeEach(async({context})=>{await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());});
async function fill(page,title,choices) {await page.locator('[data-question]').fill(title);for(let i=0;i<5;i++)await page.locator('[data-option]').nth(i).fill(choices[i]);}
async function begin(page,locale='') {await page.goto(`${locale}/challenge?analytics=exclude`);await page.locator('#creator-name').fill('Local history');await page.locator('[data-action="start-create"]').click();await page.locator('[data-action="custom-question"]').click();await fill(page,oldTitle,oldChoices);await page.locator('[data-action="personal-save-current"]').click();await expect(page.locator('#challenge-app [role="status"]')).toBeVisible();await page.locator('[data-action="save-question-edit"]').click();}
for(const locale of ['', '/en', '/ar']) test(`${locale||'ja'} full and choices-only history restore preserves separate question text and fresh consent`,async({page},testInfo)=>{
  const submissions=[];page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/api/questions/submissions')submissions.push(r.postDataJSON());});
  await begin(page,locale);await page.locator('[data-action="edit-question"]').click();await fill(page,newTitle,newChoices);
  await page.locator('[data-action="personal-save-current"]').click();
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).items[0].history.length,key)).toBe(1);
  await page.locator('[data-action="save-question-edit"]').click();
  await page.locator('[data-action="edit-question"]').click();await page.locator('[data-question]').fill(currentTitle);
  await page.locator('[data-action="personal-library"]').click();await page.locator('[data-personal-history]').click();
  await expect(page.getByTestId('personal-history').locator('h3')).toHaveText(oldTitle);
  await page.screenshot({path:testInfo.outputPath(`history${locale.replace('/','-')}.png`),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('[data-personal-restore-choices]').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#personal-submit-consent')).not.toBeChecked();await expect(page.locator('[data-action="finish-early"]')).toBeDisabled();
  await page.locator('[data-action="edit-question"]').click();await expect(page.locator('[data-question]')).toHaveValue(currentTitle);for(let i=0;i<5;i++)await expect(page.locator('[data-option]').nth(i)).toHaveValue(oldChoices[i]);
  await page.locator('[data-action="personal-library"]').click();await page.locator('[data-personal-history]').click();await page.locator('[data-personal-restore-all]').click();
  await page.locator('[data-action="edit-question"]').click();await expect(page.locator('[data-question]')).toHaveValue(oldTitle);for(let i=0;i<5;i++)await expect(page.locator('[data-option]').nth(i)).toHaveValue(oldChoices[i]);
  // Merely restoring into a quiz is not an edit of the saved current template.
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).items[0].title,key)).toBe(newTitle);
  await page.locator('[data-action="save-question-edit"]').click();await page.locator('[data-action="builder-answer"]').nth(2).click();await page.locator('[data-action="finish-early"]').click();await page.locator('[data-action="confirm-finish"]').click();await expect(page.getByTestId('challenge-share-screen')).toBeVisible();expect(submissions).toHaveLength(0);
});

test('a mixed quiz sends only the ordinary opted-in question, and role swap of private copies defaults off',async({page,request})=>{
  const sent=[];let code;
  page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/api/questions/submissions')sent.push(r.postDataJSON());});
  await begin(page);await page.locator('[data-action="builder-answer"]').first().click();
  await page.locator('[data-action="custom-question"]').click();await fill(page,'A separate review candidate?',newChoices);await page.locator('[data-action="save-question-edit"]').click();await page.locator('[data-action="builder-answer"]').first().click();await page.locator('[data-action="finish-early"]').click();await page.locator('[data-action="confirm-finish"]').click();await expect(page.getByTestId('challenge-share-screen')).toBeVisible();
  await expect.poll(()=>sent.length).toBe(1);expect(sent[0].questions.map(q=>q.title)).toEqual(['A separate review candidate?']);
  code=new URL(page.url()).searchParams.get('room');await page.evaluate(()=>localStorage.removeItem('watachan-challenge-manage-history:v1'));await page.goto(`/challenge?room=${code}&analytics=exclude`);await page.locator('#participant-name').fill('Local answer');await page.locator('[data-action="join"]').click();for(let i=0;i<2;i++)await page.locator('[data-action="answer"]').first().click();await expect(page.locator('#challenge-result-score-title')).toBeVisible();await page.locator('[data-action="swap-roles"]').click();await expect(page.locator('#personal-submit-consent')).not.toBeChecked();await expect(page.locator('[data-action="finish-early"]')).toBeDisabled();
});
