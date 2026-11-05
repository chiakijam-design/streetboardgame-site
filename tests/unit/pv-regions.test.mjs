import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pvRegionMode, PV_NOTICE_COUNTRIES, PV_NOTICE_START_UTC} from '../../src/analytics/pv-regions.js';
import {PV_NOTICE_COPY,PV_STOP_COPY,PV_NOTICE_DETAILS,PV_NOTICE_REUSE,PV_RENEWAL_COPY,PV_CHANGE_COPY} from '../../src/analytics/pv-notice-copy.js';
import {injectPVChoice} from '../../src/analytics/pv-policy.js';
import {PV_COPY} from '../../src/analytics/pv-copy.js';
import {PUBLIC_LOCALES} from '../../src/generated/public-locales.js';
import worker from '../../_worker.js';
const origin='https://www.streetboardgame.com';
const template='<html><head></head><body><article class="legal-card"><h1>Fixture</h1></article></body></html>';
const data=html=>JSON.parse(html.match(/id="wata-pv-config">([\s\S]*?)<\/script>/)[1]);
test('only the reviewed edge country use notice; unknown and protected regions require consent',()=>{
 assert.deepEqual(PV_NOTICE_COUNTRIES,['JP']);
 for(const country of PV_NOTICE_COUNTRIES)assert.equal(pvRegionMode({country},Date.parse(PV_NOTICE_START_UTC)+1),'notice');
 for(const country of ['AU','NZ','GB','FR','DE','NO','IS','LI','CH','US','CA','CN','XX','T1','','jp',' AU ',null,undefined,42])assert.equal(pvRegionMode({country}),'consent');
 assert.equal(pvRegionMode(null),'consent');assert.equal(pvRegionMode(undefined),'consent');
});
test('notice and stop translations are complete for34 languages; inherited consent copy stays unchanged',()=>{
 assert.deepEqual(Object.keys(PV_NOTICE_COPY).sort(),[...PUBLIC_LOCALES].sort());assert.deepEqual(Object.keys(PV_STOP_COPY).sort(),[...PUBLIC_LOCALES].sort());
 for(const locale of PUBLIC_LOCALES){const row=PV_NOTICE_COPY[locale];assert.equal(row.length,3,locale);row.forEach(x=>assert.ok(typeof x==='string'&&x.trim().length>5,locale));assert.match(row[0],/Cloudflare/);assert.match(row[1],/Cloudflare/);assert.match(PV_NOTICE_DETAILS[locale],/Cloudflare, Inc\./);assert.match(PV_NOTICE_DETAILS[locale],/IP/);assert.ok(PV_STOP_COPY[locale].length>2,locale);
 const url=new URL(origin+(locale==='ja'?'':'/'+locale)+'/privacy?country=JP&name=FAKE_NAME#FAKE_KEY');
 const notice=data(injectPVChoice(template,url,locale,PUBLIC_LOCALES,'notice')),consent=data(injectPVChoice(template,url,locale,PUBLIC_LOCALES));
 assert.equal(notice.mode,'notice');assert.equal(notice.notice,row[0]);assert.equal(notice.copy[1],row[1]+' '+PV_NOTICE_DETAILS[locale]+' '+PV_NOTICE_REUSE[locale]);assert.equal(notice.copy[3],PV_STOP_COPY[locale]);assert.equal(notice.copy[7],row[2]+' '+PV_RENEWAL_COPY[locale]);assert.equal(notice.copy[9],PV_COPY[locale][9]);
 assert.deepEqual(consent.copy,PV_COPY[locale]);assert.equal(consent.mode,'consent');assert.equal(consent.notice,null);assert.doesNotMatch(JSON.stringify(notice),/FAKE_NAME|FAKE_KEY|country=JP/);
 }
});
test('invalid injected mode falls back to consent',()=>assert.equal(data(injectPVChoice(template,new URL(origin), 'ja',PUBLIC_LOCALES,'all-countries')).mode,'consent'));
test('Worker captures trusted country before cloning and does not trust headers/query or UI language',async()=>{
 const env={ASSETS:{async fetch(){return new Response(template,{headers:{'content-type':'text/html','etag':'"same-template"'}});}}};
 for(const country of ['JP','AU','NZ','FR',undefined,'XX']){
 const req=new Request(origin+'/?country=JP',{headers:{'cf-ipcountry':'JP','if-none-match':'"same-template"'}});
 if(country!==undefined)Object.defineProperty(req,'cf',{value:{country}});
 const r=await worker.fetch(req,env),config=data(await r.text());assert.equal(config.mode,pvRegionMode({country}),String(country));assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('cdn-cache-control'),'no-store');assert.equal(r.headers.get('cloudflare-cdn-cache-control'),'no-store');assert.equal(r.headers.get('etag'),null);assert.ok(!Object.hasOwn(config,'country'));}
});
test('shared template stays intact across JP to FR to AU to unknown requests',async()=>{
 let calls=0;const env={ASSETS:{async fetch(){calls++;return new Response(template,{headers:{'content-type':'text/html'}});}}};const rows=[];
 for(const country of ['JP','FR','AU',undefined]){let req=new Request(origin);if(country)Object.defineProperty(req,'cf',{value:{country}});const r=await worker.fetch(req,env);rows.push(data(await r.text()).mode);assert.match(r.headers.get('cache-control'),/no-store/);}
 assert.deepEqual(rows,[pvRegionMode({country:'JP'}),'consent','consent','consent']);assert.equal(calls,4);
});
test('HEAD is also non-cacheable; static assets retain their old cache policy',async()=>{
 const env={ASSETS:{async fetch(req){return new Response(req.method==='HEAD'?null:template,{headers:{'content-type':'text/html'}});}}};const r=await worker.fetch(new Request(origin+'/',{method:'HEAD'}),env);assert.equal(r.headers.get('cache-control'),'private, no-store');
 const staticEnv={ASSETS:{async fetch(){return new Response('void 0',{headers:{'content-type':'application/javascript'}});}}};const asset=await worker.fetch(new Request(origin+'/global-pv.js'),staticEnv);assert.doesNotMatch(asset.headers.get('cache-control')||'',/private/);
});
test('candidate never enables legacy Google/Microsoft collection or modifies their runtime',()=>{
 const bytes=readFileSync('analytics.js');
 const gitBlob=createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
 assert.equal(gitBlob,'84a75b1b717636e956f5f809313463b3338eb7ec');
 const script=readFileSync('global-pv.js','utf8');assert.doesNotMatch(script,/__WATACHAN_ANALYTICS_LOCALE_REVIEW_PENDING__\s*=|googletagmanager\.com|clarity\.ms/);
 assert.match(script,/choice:'deny'/);assert.doesNotMatch(script,/choice:'allow'/);assert.match(script,/cf_pv/);
});

test('effective date announces in advance and never auto-enables an unreviewed country',()=>{const at=Date.parse(PV_NOTICE_START_UTC);assert.equal(pvRegionMode({country:'JP'},at-1),'pending-notice');assert.equal(pvRegionMode({country:'JP'},at),'notice');assert.equal(pvRegionMode({country:'JP'},NaN),'consent');for(const country of ['AU','NZ','GB','FR',undefined])for(const now of [at-1,at,at+1])assert.equal(pvRegionMode({country},now),'consent');for(const l of PUBLIC_LOCALES){assert.match(PV_RENEWAL_COPY[l],/180/);assert.ok(PV_NOTICE_REUSE[l].length>10);assert.match(PV_CHANGE_COPY[l],/\{date\}/);const pending=data(injectPVChoice(template,new URL(origin+'/privacy'),l,PUBLIC_LOCALES,'pending-notice'));assert.equal(pending.mode,'pending-notice');assert.match(pending.changeNotice,/2026-11-07 00:00 JST/);assert.match(pending.renewalNotice,/180/);}});
