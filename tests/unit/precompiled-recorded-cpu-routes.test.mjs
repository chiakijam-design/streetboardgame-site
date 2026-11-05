import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import worker from '../../_worker.js';
import {PUBLIC_LOCALE_PAGES} from '../../src/generated/public-locale-pages.js';

// Recorded CPU failures, October28 JST. The deployed package must contain
// every referenced prepared page, so a request does not translate a catalog.
for(const route of [
  "/tr/legal",
  "/pl/legal",
  "/zh-Hans/privacy",
  "/sk/minor-policy",
  "/sv/minor-policy",
  "/bg/minor-policy",
  "/en/minor-policy",
  "/zh-Hans/content-guidelines",
  "/pt/minor-policy",
  "/es/minor-policy",
  "/ar/minor-policy",
  "/sk/refund-policy",
  "/sv/refund-policy",
  "/ro/minor-policy",
  "/bg/refund-policy",
  "/en/refund-policy",
  "/ko/minor-policy",
  "/tr/minor-policy",
  "/pl/minor-policy",
  "/ms/minor-policy",
  "/de/minor-policy",
  "/th/minor-policy"
]){
  test(route+': packaged static HTML, GET/HEAD and CSP',async()=>{
    if(route.endsWith('/refund-policy')){
      assert.equal(PUBLIC_LOCALE_PAGES[route],undefined,'Removed route must not retain a public asset');
      let reads=0;const noAssets={ASSETS:{async fetch(){reads++;throw Error('No asset work for removed policy');}}};
      for(const method of ['GET','HEAD']){const gone=await worker.fetch(new Request('https://www.streetboardgame.com'+route,{method}),noAssets);assert.equal(gone.status,410);assert.match(gone.headers.get('x-robots-tag'),/noindex/);if(method==='HEAD')assert.equal(await gone.text(),'');}
      assert.equal(reads,0);return;
    }
    const asset=PUBLIC_LOCALE_PAGES[route];
    assert.ok(asset,'Recorded public route must have a prepared page');
    const bytes=await readFile(new URL('../..'+asset,import.meta.url));
    assert.ok(asset.endsWith('-'+createHash('sha256').update(bytes).digest('hex').slice(0,12)+'.html'));
    const reads=[];
    const env={ASSETS:{async fetch(request){
      const path=new URL(request.url).pathname; reads.push(path);
      assert.equal(path,asset,'No dictionary/template work on a request');
      return new Response(bytes,{headers:{'content-type':'text/html; charset=UTF-8'}});
    }}};
    const request=new Request('https://www.streetboardgame.com'+route);
    const response=await worker.fetch(request,env);
    assert.equal(response.status,200);
    const html=await response.text();
    assert.match(html,/data-watachan-locale-catalog/);
    assert.doesNotMatch(html,/window\.__WATACHAN_I18N__=/);
    assert.match(response.headers.get('cache-control'),/must-revalidate/);
    const csp=response.headers.get('content-security-policy');
    assert.match(csp,/'nonce-/);
    const head=await worker.fetch(new Request(request.url,{method:'HEAD'}),env);
    assert.equal(head.status,200); assert.equal(await head.text(),'');
    assert.notEqual(head.headers.get('content-security-policy'),csp);
    assert.deepEqual(reads,[asset,asset]);
  });
}
