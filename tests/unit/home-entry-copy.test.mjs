import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { homeEntryCopy, translateHomeEntryCopy } from '../../src/i18n/home-entry-copy.js';
import { TARGET_LOCALES } from '../../src/i18n/locales.js';
import { PUBLIC_LOCALE_PAGES } from '../../src/generated/public-locale-pages.js';
import { localizePublicHtml } from '../../src/i18n/public-html.js';

for(const locale of TARGET_LOCALES) test(`home entry ${locale}: built public text and accessible name allow short quizzes`, async()=>{
 const copy=homeEntryCopy(locale);
 for(const key of ['step','start','note']) {
  assert.ok(copy[key]);
  if(locale!=='ja') assert.notEqual(copy[key],homeEntryCopy('ja')[key]);
 }
 assert.match(copy.step,/1[–~〜～]10/); assert.match(copy.note,/50/);
 const path=locale==='ja'?'/index.html':PUBLIC_LOCALE_PAGES[`/${locale}`];
 const html=await readFile(new URL('../..'+path,import.meta.url),'utf8');
 for(const text of Object.values(copy)) assert.ok(html.includes(text),`${locale}: ${text}`);
 assert.ok(html.includes(`aria-label="${copy.start}"`));
 assert.ok(!html.includes('aria-label="10問を作り始める"'));
});
test('home copy translator is restricted to exact public labels, preserving other text and routes',()=>{
 assert.equal(translateHomeEntryCopy('  '+homeEntryCopy().step+'\n','en'),'  '+homeEntryCopy('en').step+'\n');
 assert.equal(translateHomeEntryCopy('10問・最大50人','en'),undefined);
 assert.equal(translateHomeEntryCopy('User: '+homeEntryCopy().step,'en'),undefined);
 const data={entries:[],aliases:{},catalog:{locale:'en',messages:{},provenance:{method:'machine-generated',nativeReview:false}}};
 const html='<html><head></head><body>'+homeEntryCopy().step+'</body></html>';
 assert.ok(localizePublicHtml(html,data,new URL('https://www.streetboardgame.com/en/challenge')).includes(homeEntryCopy().step));
});
