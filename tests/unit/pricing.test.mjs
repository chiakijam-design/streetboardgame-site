import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import worker from '../../_worker.js';
import { PUBLIC_LOCALES } from '../../src/generated/public-locales.js';
import { PUBLIC_LOCALE_PAGES } from '../../src/generated/public-locale-pages.js';
import { PERSONAL_QUESTION_COPY } from '../../src/i18n/personal-question-copy.js';
import { PERSONAL_AUTOSAVE_COPY } from '../../src/i18n/personal-question-autosave-copy.js';
import { BOARD_COPY } from '../../src/i18n/challenge-board-copy.js';
import { REMOVED_PAGE_COPY } from '../../src/i18n/removed-page-copy.js';

test('all pricing URL aliases are gone before assets, database or analytics access',async()=>{
 assert.deepEqual(Object.keys(REMOVED_PAGE_COPY).sort(),[...PUBLIC_LOCALES].sort());
 const env=new Proxy({},{get(){throw Error('removed pricing must not access bindings');}});
 for(const locale of PUBLIC_LOCALES){
  const prefix=locale==='ja'?'':'/'+locale;
  for(const alias of ['/pricing','/pricing/','/pricing.html','/pricing.html/'])for(const method of ['GET','HEAD']){
   const response=await worker.fetch(new Request('https://www.streetboardgame.com'+prefix+alias+'?analytics=exclude',{method}),env);
   assert.equal(response.status,410,prefix+alias);
   assert.match(response.headers.get('x-robots-tag'),/noindex/);
   assert.equal(response.headers.get('cache-control'),'no-store');
   const html=await response.text();
   if(method==='HEAD'){assert.equal(html,'');continue;}
   assert.ok(html.includes('href="'+prefix+'/challenge"'));
   assert.ok(html.includes('lang="'+locale+'"'));
   assert.ok(html.includes('<h1>'+REMOVED_PAGE_COPY[locale]+'</h1>'));
   assert.doesNotMatch(html,/LIVE|終了|<script|adsbygoogle|googletagmanager/);
  }
 }
});
test('removed pricing has no source HTML, sitemap entry or compiled locale route',async()=>{
 await assert.rejects(access('pricing.html'),{code:'ENOENT'});
 assert.doesNotMatch(await readFile('sitemap.xml','utf8'),/\/pricing/);
 assert.ok(!Object.keys(PUBLIC_LOCALE_PAGES).some(p=>p.endsWith('/pricing')));
 assert.equal(Object.keys(PUBLIC_LOCALE_PAGES).length,462);
 const source=await readFile('prototype_app.jsx','utf8');
 assert.doesNotMatch(source,/href="\/pricing"|'\/pricing'/);
 assert.match(source,/top-free-notice/);
});
test('historical contracts remain byte-identical and reachable without current sales promotion',async()=>{
 const hashes={
  "terms": "08ba431f7b52b9b3dbe2d2440dcb7602a2f06871cb545416d01d10accb49bead",
  "privacy": "4a363e0d1fde9b4946cf16e710dd128d592a98e2710d77ed22fcd1f608e3441c",
  "legal": "298efa300b0605add97b726f90100d47838942d785182d75219b9e26450ce38c",
  "creator-terms": "e31addc7feb2c442d50199fede89601088247ff907219ce8b9500f326de765ce",
  "refund-policy": "6f794c8fbdacf47089adb6704b0e20eb935e280d35086e76e61b19d5f18f08b6",
  "content-guidelines": "3e450243eaa0f161c227722eea2fde97fbef52f46d53bd2642189659becba1f1",
  "minor-policy": "bdc428cb0e6bbd30e714d78e6fb54c385407ed46918d6f7152cf930eab3fcef8"
};
 for(const [page,expected] of Object.entries(hashes)){
  assert.equal(createHash('sha256').update(await readFile('legal-history/'+page+'.html')).digest('hex'),expected,page);
  if(page==='refund-policy'){await assert.rejects(readFile(page+'.html'),{code:'ENOENT'});continue;}
  const current=await readFile(page+'.html','utf8');
  if(page==='legal'){assert.match(current,/data-testid="physical-product-commerce-information"/);assert.doesNotMatch(current,/LIVEチャット/);continue;}
  assert.match(current,/data-testid="historical-provisions"/);
  assert.match(current,new RegExp('href="/legal-history/'+page+'\\.html"'));
  assert.doesNotMatch(current,/data-testid="live-retirement-notice"|LIVE版は終了しました|href="\/pricing"/);
 }
});
test('localized current terms and local-storage notices match the 1–10 question product',async()=>{
 for(const locale of PUBLIC_LOCALES){
  const termPath=locale==='ja'?'terms.html':PUBLIC_LOCALE_PAGES['/'+locale+'/terms'].slice(1);
  const privacyPath=locale==='ja'?'privacy.html':PUBLIC_LOCALE_PAGES['/'+locale+'/privacy'].slice(1);
  const terms=await readFile(termPath,'utf8');
  assert.match(terms,locale==='ja'?/1〜10問/:/1–10/,locale);
  const privacy=await readFile(privacyPath,'utf8');
  assert.match(privacy,/data-testid="personal-question-storage-policy"/,locale);
  const unescape=s=>s.replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"');
  assert.ok(unescape(privacy).includes(PERSONAL_QUESTION_COPY[locale].server),locale+' server disclosure');
  assert.ok(unescape(privacy).includes(PERSONAL_AUTOSAVE_COPY[locale].notice),locale+' latest30');
 }
});
test('all locale guides describe flexible quiz length and automatic board instead of optional publication',async()=>{
 const cache=new Map();
 const env={ASSETS:{async fetch(request){const path=new URL(request.url).pathname;const file=path==='/index.html'?'index.html':path.slice(1);if(!cache.has(file))cache.set(file,await readFile(file,'utf8'));return new Response(cache.get(file),{headers:{'content-type':'text/html'}});}}};
 for(const locale of PUBLIC_LOCALES){
  const prefix=locale==='ja'?'':'/'+locale;
  const guide=await(await worker.fetch(new Request('https://www.streetboardgame.com'+prefix+'/challenge-guide'),env)).text();
  const about=await(await worker.fetch(new Request('https://www.streetboardgame.com'+prefix+'/about'),env)).text();
  const decode=s=>s.replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"');
  assert.ok(decode(guide).includes(BOARD_COPY[locale].notice),locale+' automatic board');
  assert.ok(decode(about).includes(BOARD_COPY[locale].rule),locale+' highest score');
  assert.match(guide,locale==='ja'?/1〜10問/:/1–10/,locale+' flexible length');
  assert.doesNotMatch(guide,/任意の理解度ボード|optional understanding board/);
 }
});
