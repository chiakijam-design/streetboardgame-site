import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import worker from '../../_worker.js';import {PUBLIC_LOCALES} from '../../src/generated/public-locales.js';import {PUBLIC_LOCALE_PAGES} from '../../src/generated/public-locale-pages.js';
import {FREE_QUIZ_COPY} from '../../src/i18n/commerce-copy.js';
const root=path.resolve('.');
function assets(){return{ASSETS:{async fetch(request){const p=new URL(request.url).pathname;const file=path.resolve(root,p==='/'?'index.html':p.slice(1));assert.ok(file.startsWith(root+path.sep));try{return new Response(fs.readFileSync(file),{headers:{'content-type':file.endsWith('.json')?'application/json':'text/html; charset=UTF-8'}});}catch{return new Response('Not Found',{status:404});}}}};}
test('all locales remove obsolete LIVE refunds before asset/database work, including old aliases',async()=>{
 let assetReads=0;const env={ASSETS:{async fetch(){assetReads++;throw Error('Unexpected asset access');}}};
 for(const locale of PUBLIC_LOCALES){const prefix=locale==='ja'?'':'/'+locale;for(const suffix of ['/refund-policy','/refund-policy/','/refund-policy.html'])for(const method of ['GET','HEAD']){
  const r=await worker.fetch(new Request('https://www.streetboardgame.com'+prefix+suffix+'?analytics=exclude',{method}),env);assert.equal(r.status,410);assert.match(r.headers.get('x-robots-tag'),/noindex/);assert.equal(r.headers.get('cache-control'),'no-store');if(method==='HEAD')assert.equal(await r.text(),'');
 }}assert.equal(assetReads,0);assert.ok(!Object.keys(PUBLIC_LOCALE_PAGES).some(p=>p.endsWith('/refund-policy')));
});
test('commerce information distinguishes free quiz from verified physical product seller and preserves contact',async()=>{
 const before=globalThis.fetch;globalThis.fetch=()=>{throw Error('External network forbidden');};
 try{for(const locale of PUBLIC_LOCALES){const prefix=locale==='ja'?'':'/'+locale,r=await worker.fetch(new Request('https://www.streetboardgame.com'+prefix+'/legal?analytics=exclude'),assets());assert.equal(r.status,200);const html=await r.text();
  assert.match(html,/data-testid="free-quiz-information"/);assert.match(html,/data-testid="physical-product-commerce-information"/);
  assert.ok(html.includes(FREE_QUIZ_COPY[locale]),locale+' exact fixed free-service fact');
  assert.match(html,/Chiaki Hirakawa/);assert.match(html,/StreetBoardGame/);assert.match(html,/href="https:\/\/www\.amazon\.co\.jp\/sp\?seller=A3QW758BCMIP1P"/);
  assert.match(html,/nodeId=GKM69DUUYKQWKWX7/);assert.match(html,/https:\/\/www\.amazon\.co\.jp\/dp\/B0G87M4ZYK/);
  assert.doesNotMatch(html,/LIVEチャット|2,160×2,700px|480円|href="(?:\/[a-zA-Z-]+)?\/refund-policy"/);
  assert.match(html,/to=contact/);assert.match(html,new RegExp('rel="canonical" href="https://www.streetboardgame.com'+prefix+'/legal"'));
 }}finally{globalThis.fetch=before;}
});

test('current policies use a live archival destination for preserved historical refund references',async()=>{
 const savedFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('External network forbidden');};
 try{for(const locale of PUBLIC_LOCALES){const prefix=locale==='ja'?'':'/'+locale;for(const page of ['terms','minor-policy']){
  const r=await worker.fetch(new Request('https://www.streetboardgame.com'+prefix+'/'+page+'?analytics=exclude'),assets());assert.equal(r.status,200);const html=await r.text();
  assert.doesNotMatch(html,/href="(?:\/[a-zA-Z-]+)?\/refund-policy"/);assert.match(html,/href="\/legal-history\/2026-10-23-refund-policy.html"/);
 }}const r=await worker.fetch(new Request('https://www.streetboardgame.com/legal-history/2026-10-23-refund-policy.html?analytics=exclude'),assets());assert.equal(r.status,200);assert.match(r.headers.get('x-robots-tag'),/noindex/);assert.match(await r.text(),/返金/);
 }finally{globalThis.fetch=savedFetch;}
});
