import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import worker from '../../_worker.js';
import {PUBLIC_LOCALE_PAGES} from '../../src/generated/public-locale-pages.js';

// Production CPU-limit failures on 2026-10-28 JST. These routes must use assets,
// rather than parsing and translating the complete catalog on every request.
for(const route of ['/zh-Hans/refund-policy','/ko/legal','/zh-Hant/terms','/bn/refund-policy','/fr/refund-policy','/el/refund-policy','/vi/refund-policy']){
  test(`${route}: deployed HTML serves directly, preserves CSP and supports HEAD`,async()=>{
    const asset=PUBLIC_LOCALE_PAGES[route];
    const bytes=await readFile(new URL('../..'+asset,import.meta.url));
    assert.ok(asset.endsWith('-'+createHash('sha256').update(bytes).digest('hex').slice(0,12)+'.html'));
    const reads=[];
    const env={ASSETS:{async fetch(request){
      const path=new URL(request.url).pathname;reads.push(path);
      assert.equal(path,asset,'No request-time catalog or template work');
      return new Response(bytes,{headers:{'content-type':'text/html; charset=UTF-8'}});
    }}};
    const response=await worker.fetch(new Request('https://www.streetboardgame.com'+route),env);
    assert.equal(response.status,200);
    const html=await response.text();
    assert.match(html,/data-watachan-locale-catalog/);
    assert.doesNotMatch(html,/window\.__WATACHAN_I18N__=/);
    assert.match(response.headers.get('cache-control'),/must-revalidate/);
    const csp=response.headers.get('content-security-policy');
    assert.match(csp,/'nonce-/);
    const head=await worker.fetch(new Request('https://www.streetboardgame.com'+route,{method:'HEAD'}),env);
    assert.equal(head.status,200);assert.equal(await head.text(),'');
    assert.notEqual(head.headers.get('content-security-policy'),csp);
    assert.equal(reads.length,2);
  });
}
