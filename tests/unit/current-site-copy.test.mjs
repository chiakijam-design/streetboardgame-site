import test from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';
import{PUBLIC_LOCALES}from'../../src/generated/public-locales.js';
test('React-rendered fixed question-count copy stays localized while private text and real ten-question packs stay protected',async()=>{
 const original=globalThis.window;
 try{for(const locale of PUBLIC_LOCALES.filter(l=>l!=='ja')){
  const data=JSON.parse(await readFile('locale-assets/'+locale+'.json','utf8'));
  globalThis.window={location:{pathname:'/'+locale+'/challenge-guide'},__WATACHAN_I18N__:data};
  const runtime=await import('../../src/i18n/runtime.js?pricing-current='+locale);
  const fixed='名前を入力して、出題する1〜10問を選ぶ・作る';
  const translated=runtime.translateText(fixed);
  assert.notEqual(translated,fixed,locale);assert.match(translated,/1–10/,locale);
  const pack=runtime.translateText('10問パック');assert.doesNotMatch(pack,/1–10/,locale+' actual pack');
  runtime.protectUserCopy([fixed]);assert.equal(runtime.translateText(fixed),fixed,locale+' private literal');
  const custom='架空の個人用メモ：1〜10問 xyz';assert.equal(runtime.translateText(custom),custom,locale+' unknown text');
 }}finally{globalThis.window=original;}
});
