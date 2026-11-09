import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {blockedTestRequestReason,isGoogleAnalyticsRequest,installTestNetworkGuard,createIsolatedContext} from '../helpers/test-network-guard.mjs';
test('known GA/GTM, Clarity/Bing, Cloudflare, ad/CMP and live site destinations are blocked',()=>{
  for(const url of ['https://www.googletagmanager.com/gtag/js','https://region1.google-analytics.com/g/collect','https://a.clarity.ms/collect','https://www.clarity.ms/tag/FAKE','https://c.bing.com/c.gif','https://static.cloudflareinsights.com/beacon.min.js','https://cloudflareinsights.com/cdn-cgi/rum','https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js','https://fundingchoicesmessages.google.com/i/FAKE','https://x.doubleclick.net/a','https://www.streetboardgame.com/challenge','https://streetboardgame.com/api/challenge/rooms','wss://www.streetboardgame.com/api/FAKE'])assert.ok(blockedTestRequestReason(url),url);
  assert.equal(isGoogleAnalyticsRequest('https://region1.google-analytics.com/g/collect'),true);
});
test('only loopback can pass through; unrelated external hosts are blocked without being classified as Wata',()=>{
  for(const url of ['http://127.0.0.1:4173/api/challenge/rooms','http://localhost:4173/analytics.js','http://[::1]/','data:text/plain,synthetic','invalid'])assert.equal(blockedTestRequestReason(url),'',url);
  for(const url of ['https://streetboardgame.com.example.test/','https://notclarity.ms/','https://cloudflare.com/','https://fonts.googleapis.com/css2','https://future-collector.example/'])assert.equal(blockedTestRequestReason(url),'external-test-network',url);
});
test('context firewall installs before use, aborts request before continuation and keeps other stubs via fallback',async()=>{
  const calls=[],routes=[],sockets=[];const context={async route(pattern,fn){calls.push('registered');routes.push(fn);},async routeWebSocket(match,fn){sockets.push({match,fn});},async unroute(_,fn){assert.equal(fn,routes[0]);calls.push('removed');}};
  const guard=await installTestNetworkGuard(context);assert.deepEqual(calls,['registered']);
  for(const url of ['https://www.streetboardgame.com/api/questions','https://cloudflareinsights.com/cdn-cgi/rum']){const seen=[];await routes[0]({request:()=>({url:()=>url}),abort:async reason=>seen.push(reason),fallback:async()=>seen.push('fallback')});assert.deepEqual(seen,['blockedbyclient']);}
  let forwarded=0;await routes[0]({request:()=>({url:()=> 'http://127.0.0.1:4173/'}),abort:async()=>assert.fail('local aborted'),fallback:async()=>forwarded++});assert.equal(forwarded,1);assert.equal(guard.state.blockedRequests,2);
  assert.equal(sockets[0].match(new URL('wss://www.streetboardgame.com/api/FAKE')),true);assert.equal(sockets[0].match(new URL('ws://127.0.0.1:4173/')),false);let closed=false;sockets[0].fn({close(){closed=true;}});assert.equal(closed,true);assert.equal(guard.state.blockedWebSockets,1);
  await guard.dispose();assert.deepEqual(calls,['registered','removed']);
});
test('all39 standard E2E entrypoints use the shared fixture; service workers blocked',()=>{
  const base=path.resolve('jp-ga4-candidate-20261106/tests/e2e'),candidate=path.resolve('measurement-exclusion-candidate-20261106/tests/e2e');let n=0;
  for(const name of fs.readdirSync(base).filter(x=>x.endsWith('.spec.mjs'))){const p=fs.existsSync(path.join(candidate,name))?path.join(candidate,name):path.join(base,name),s=fs.readFileSync(p,'utf8');assert.match(s,/\bfrom\s*['"]\.\/test\.mjs['"]/,name);assert.doesNotMatch(s,/\bfrom\s*['"]@playwright\/test['"]/,name);n++;}
  assert.equal(n,39);const fixture=fs.readFileSync(path.join(candidate,'test.mjs'),'utf8');assert.match(fixture,/serviceWorkers: 'block'/);assert.match(fixture,/auto: true/);
});
test('extra participant context is blocked before returned to a test and closes if guard setup fails',async()=>{
  const calls=[],context={async route(){calls.push('http-guard');},async routeWebSocket(){calls.push('socket-guard');},async close(){calls.push('close');}};
  const browser={async newContext(options){calls.push(options);return context;}};
  assert.equal(await createIsolatedContext(browser,{viewport:{width:390,height:844},serviceWorkers:'allow'}),context);
  assert.deepEqual(calls,[{viewport:{width:390,height:844},serviceWorkers:'block'},'http-guard','socket-guard']);
  context.route=async()=>{throw Error('Synthetic setup failure');};await assert.rejects(createIsolatedContext(browser),/Synthetic setup failure/);assert.equal(calls.at(-1),'close');
});
test('every raw guest-context call in standard specs is replaced; dedicated measurement helper remains fully intercepted',()=>{
  const base=path.resolve('jp-ga4-candidate-20261106/tests/e2e'),candidate=path.resolve('measurement-exclusion-candidate-20261106/tests/e2e');
  for(const name of fs.readdirSync(base).filter(x=>x.endsWith('.spec.mjs'))){const p=fs.existsSync(path.join(candidate,name))?path.join(candidate,name):path.join(base,name),s=fs.readFileSync(p,'utf8');assert.doesNotMatch(s,/\.newContext\(/,name);}
  const isolated=fs.readFileSync('jp-ga4-candidate-20261106/tests/helpers/passive-measurement.mjs','utf8');assert.match(isolated,/serviceWorkers:'block'/);assert.match(isolated,/context\.route\('\*\*\/\*'/);assert.match(isolated,/context\.routeWebSocket\('\*\*\/\*'/);
});
