import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';import crypto from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url));
const source={ga:fs.readFileSync(path.join(root,'analytics.js'),'utf8'),cf:fs.readFileSync(path.join(root,'global-pv.js'),'utf8')};
const exclusion='watachan:analytics-excluded:v1',consent='watachan:cf-pv-consent:v1';

function documentRun({url='https://www.streetboardgame.com/challenge',storage=new Map(),denied=false,webdriver=false,gpc=false,dnt=false}={}){
  let current=new URL(url);
  const scripts=[],events={},config={v:1,policy:'passive',mode:'notice',token:'f'.repeat(32),locales:['ja','en','fr','ar'],publicPaths:['/','/challenge','/privacy']};
  const location={get href(){return current.href;},get origin(){return current.origin;},get hostname(){return current.hostname;},get pathname(){return current.pathname;},get protocol(){return current.protocol;},reload(){}};
  const ls={getItem(k){if(denied)throw Error('Synthetic storage denial');return storage.get(k)??null;},setItem(k,v){if(denied)throw Error('Synthetic storage denial');storage.set(k,String(v));},removeItem(k){if(denied)throw Error('Synthetic storage denial');storage.delete(k);}};
  const w={location,localStorage:ls,navigator:{webdriver,globalPrivacyControl:gpc,doNotTrack:dnt?'1':undefined},__WATACHAN_GOOGLE_ANALYTICS_POLICY__:'jp-basic',history:{state:null,replaceState(state,_,next){this.state=state;current=new URL(next,current);},pushState(state,_,next){this.state=state;current=new URL(next,current);}},addEventListener(k,f){(events[k]??=[]).push(f);},setTimeout:f=>f()};
  const d={readyState:'complete',referrer:'',getElementById(){return{textContent:JSON.stringify(config)};},querySelector(){return scripts.find(s=>String(s.src).includes('cloudflareinsights.com'))??null;},createElement(){return{dataset:{},setAttribute(){},addEventListener(){}};},head:{appendChild(s){scripts.push(s);}},addEventListener(){}};
  const context=vm.createContext({window:w,document:d,URL,Date,encodeURIComponent});
  // No fetch, XMLHttpRequest or external SDK exists in this VM.
  vm.runInContext(source.ga,context);vm.runInContext(source.cf,context);
  return{w,scripts,storage,events};
}

for(const query of ['analytics=include&analytics=exclude','analytics=exclude&analytics=include'])test('explicit exclusion wins repeated preference: '+query,()=>{
  const r=documentRun({url:'https://www.streetboardgame.com/challenge?'+query});
  assert.equal(r.storage.get(exclusion),'1');assert.equal(r.w.analyticsEnabled,false);assert.equal(r.scripts.length,0);
});
test('single explicit include retains normal-user restoration compatibility, without overriding CF refusal',()=>{
  const r=documentRun({url:'https://www.streetboardgame.com/challenge?analytics=include',storage:new Map([[exclusion,'1']])});
  assert.equal(r.storage.has(exclusion),false);assert.equal(r.w.analyticsEnabled,true);assert.equal(r.scripts.length,2);
  const stopped=documentRun({url:'https://www.streetboardgame.com/challenge?analytics=include',storage:new Map([[exclusion,'1'],[consent,JSON.stringify({v:1,choice:'deny',at:1})]])});
  assert.equal(stopped.scripts.length,0);assert.equal(JSON.parse(stopped.storage.get(consent)).choice,'deny');
});
test('explicit excluded profile survives reload, new document/tab, redirect losing query, locales and SPA updates',()=>{
  const store=new Map();const first=documentRun({url:'https://www.streetboardgame.com/challenge?analytics=exclude',storage:store});assert.equal(first.scripts.length,0);
  for(const p of ['/challenge','/en/challenge','/fr/challenge','/ar/privacy','/challenge/manage','/challenge?room=FAKE2345']){
    const r=documentRun({url:'https://www.streetboardgame.com'+p,storage:store});assert.equal(r.scripts.length,0,p);r.w.history.pushState({},'','/challenge');r.w.trackEvent('game_play',{game_type:'challenge'});assert.equal(r.scripts.length,0,p);
  }
});
test('local, preview and lookalike hosts never load either collector',()=>{
  for(const h of ['localhost','127.0.0.1','[::1]','preview.example.test','streetboardgame-site.workers.dev','www.streetboardgame.com.example.test'])assert.equal(documentRun({url:'https://'+h+'/challenge'}).scripts.length,0,h);
});
test('webdriver, GPC, DNT, failed storage and previous refusal suppress both collectors',()=>{
  for(const opts of [{webdriver:true},{gpc:true},{dnt:true},{denied:true},{denied:true,url:'https://www.streetboardgame.com/challenge?analytics=exclude'},{storage:new Map([[consent,JSON.stringify({v:1,choice:'deny',at:1})]])}])assert.equal(documentRun(opts).scripts.length,0,JSON.stringify(opts));
});
test('ordinary eligible control emits only one initial PV and no GTM/Clarity; repeated actions are not PV',()=>{
  const r=documentRun();assert.equal(r.scripts.length,2);assert.ok(r.scripts.some(s=>s.src.includes('/gtag/js')));assert.ok(r.scripts.some(s=>s.src.includes('/beacon.min.js')));assert.equal(r.w.dataLayer,undefined);
  for(let i=0;i<3;i++)r.w.trackEvent('game_play',{game_type:'challenge'});
  assert.equal(r.w.ga4EventLayer.filter(v=>v[0]==='event'&&v[1]==='page_view').length,1);assert.equal(r.scripts.length,2);
});
test('private and unknown routes never initialize collectors',()=>{
  for(const p of ['/challenge/manage','/question-ops','/api/questions','/unknown'])assert.equal(documentRun({url:'https://www.streetboardgame.com'+p}).scripts.length,0,p);
});
test('legacy secret parameters are removed before a public document collector is initialized',()=>{
  const r=documentRun({url:'https://www.streetboardgame.com/challenge?secret=FAKE_SECRET'});
  assert.doesNotMatch(r.w.location.href,/secret|FAKE_SECRET/);assert.doesNotMatch(JSON.stringify(r.w.ga4EventLayer),/FAKE_SECRET/);assert.equal(r.scripts.length,2);
});
test('candidate standalone scripts have new cache keys and the reviewed runtime pin matches its contents',()=>{
  assert.match(fs.readFileSync(path.join(root,'src/analytics/passive-policy.js'),'utf8'),/20261109-jp-operator-observation-1/);
  assert.match(fs.readFileSync(path.join(root,'src/analytics/pv-policy.js'),'utf8'),/20261109-operator-observation-1/);
  const bytes=fs.readFileSync(path.join(root,'analytics.js')),hash=crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
  assert.match(fs.readFileSync(path.join(root,'tests/unit/global-pv.test.mjs'),'utf8'),new RegExp("assert.equal\\(sha,'"+hash+"'\\)"));
});
