import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source={ga:fs.readFileSync(new URL('../../analytics.js',import.meta.url),'utf8'),cf:fs.readFileSync(new URL('../../global-pv.js',import.meta.url),'utf8')};
const marker='watachan:analytics-excluded:v1',choice='watachan:cf-pv-consent:v1';
function run({url='https://www.streetboardgame.com/challenge',values=new Map(),storage='normal',gpc=false,dnt=false,root=true,onlyCF=false}={}){
 let current=new URL(url);const scripts=[],attributes={},events={};
 const ls={getItem(k){if(storage==='throw'||(storage==='marker-throw'&&k===marker))throw Error('fixture storage inaccessible');return storage==='silent'?null:values.get(k)??null;},setItem(k,v){if(storage==='throw')throw Error('fixture storage inaccessible');if(storage!=='silent')values.set(k,String(v));},removeItem(k){if(storage==='throw')throw Error('fixture storage inaccessible');values.delete(k);}};
 const location={get href(){return current.href;},get origin(){return current.origin;},get hostname(){return current.hostname;},get pathname(){return current.pathname;},get protocol(){return current.protocol;},reload(){}};
 const w={location,localStorage:ls,navigator:{webdriver:false,globalPrivacyControl:gpc,doNotTrack:dnt?'1':undefined},__WATACHAN_GOOGLE_ANALYTICS_POLICY__:'jp-basic',history:{state:null,replaceState(state,_,u){this.state=state;current=new URL(u,current);},pushState(state,_,u){this.state=state;current=new URL(u,current);}},addEventListener(k,f){(events[k]??=[]).push(f);},setTimeout:f=>f()};
 const config={v:1,policy:'passive',mode:'notice',token:'f'.repeat(32),locales:['ja','en'],publicPaths:['/','/challenge','/about','/privacy']};
 const d={documentElement:root?{setAttribute(k,v){attributes[k]=v;}}:undefined,readyState:'complete',referrer:'',getElementById(){return{textContent:JSON.stringify(config)};},querySelector(){return scripts.find(x=>String(x.src).includes('cloudflareinsights.com'))??null;},createElement(){return{dataset:{},setAttribute(){},addEventListener(){}};},head:{appendChild(s){scripts.push(s);}},addEventListener(){}};
 const context=vm.createContext({window:w,document:d,URL,Date,encodeURIComponent});
 // No network or SDK API exists in the VM. Execute the actual candidate files.
 if(!onlyCF)vm.runInContext(source.ga,context);vm.runInContext(source.cf,context);
 return{attributes,scripts,values,w};
}
const attr=(r,kind,name)=>r.attributes[`data-wata-${kind}-exclusion-${name}`];
test('explicit operator exclusion reports actual saved state, with enum-only DOM and no SDK append',()=>{
 const r=run({url:'https://www.streetboardgame.com/?analytics=include&analytics=exclude'});
 assert.equal(r.values.get(marker),'1');assert.equal(r.scripts.length,0);
 for(const kind of ['ga','cf']){assert.equal(attr(r,kind,'initialized'),'1');assert.equal(attr(r,kind,'storage'),'stored');assert.equal(attr(r,kind,'reason'),'operator');}
 assert.deepEqual(Object.values(r.attributes).sort(),['1','1','operator','operator','stored','stored']);
});
test('clean ordinary URL in same origin storage reports the persisted exclusion',()=>{
 const initial=run({url:'https://www.streetboardgame.com/?analytics=exclude'});
 const later=run({url:'https://www.streetboardgame.com/about',values:initial.values});
 for(const kind of ['ga','cf'])assert.equal(attr(later,kind,'storage'),'stored');assert.equal(later.scripts.length,0);
});
test('normal visitor retains both SDK loader paths and gains no observation attributes',()=>{
 const r=run();assert.deepEqual(r.attributes,{});assert.equal(r.w.analyticsEnabled,true);assert.equal(r.scripts.length,2);
});
test('single include retains restoration behavior without creating an operator success marker',()=>{
 const r=run({url:'https://www.streetboardgame.com/?analytics=include',values:new Map([[marker,'1']])});
 assert.deepEqual(r.attributes,{});assert.equal(r.values.has(marker),false);assert.equal(r.scripts.length,2);
});
for(const [name,option]of [['GPC',{gpc:true}],['DNT',{dnt:true}]])test(name+' stops collectors without falsely attributing operator exclusion',()=>{
 const r=run(option);assert.deepEqual(r.attributes,{});assert.equal(r.scripts.length,0);
});
test('separate existing refusal is retained and unexecuted CF predicate is not called initialized',()=>{
 const r=run({url:'https://www.streetboardgame.com/?analytics=exclude',values:new Map([[choice,JSON.stringify({v:1,choice:'deny',at:Date.now()})]])});
 assert.equal(attr(r,'ga','storage'),'stored');assert.equal(attr(r,'cf','initialized'),undefined);assert.equal(r.scripts.length,0);assert.match(r.values.get(choice),/deny/);
});
test('storage exceptions report unavailable, never saved, on explicit operator URL',()=>{
 const r=run({url:'https://www.streetboardgame.com/?analytics=exclude',storage:'throw'});
 assert.equal(attr(r,'ga','storage'),'unavailable');
 // CF stops at the pre-existing invalid-choice guard before checking operator exclusion.
 assert.equal(attr(r,'cf','initialized'),undefined);assert.equal(r.scripts.length,0);assert.equal(r.values.has(marker),false);
});
test('unreadable saved storage without an operator URL cannot claim a known operator predicate',()=>{
 const r=run({storage:'throw'});assert.deepEqual(r.attributes,{});assert.equal(r.scripts.length,0);
});
test('silent storage failure cannot be labelled stored or initialized by an untrue GA predicate',()=>{
 const r=run({url:'https://www.streetboardgame.com/?analytics=exclude',storage:'silent'});
 // GA has cleaned the preference URL but could not save it; CF then stops on
 // its storage-availability guard. Neither can claim a stored operator marker.
 assert.equal(attr(r,'ga','initialized'),undefined);assert.equal(attr(r,'cf','initialized'),undefined);assert.equal(r.scripts.length,0);assert.equal(r.values.has(marker),false);
});
for(const [storage,expected]of [['silent','absent'],['marker-throw','unavailable']])test('standalone CF operator predicate records '+expected+' without claiming persistence',()=>{
 const r=run({url:'https://www.streetboardgame.com/?analytics=exclude',storage,onlyCF:true});assert.equal(attr(r,'cf','initialized'),'1');assert.equal(attr(r,'cf','storage'),expected);assert.equal(attr(r,'cf','reason'),'operator');assert.equal(r.scripts.length,0);
});
test('unavailable DOM observation target does not alter the existing exclusion decision',()=>{
 const r=run({url:'https://www.streetboardgame.com/?analytics=exclude',root:false});assert.deepEqual(r.attributes,{});assert.equal(r.w.analyticsEnabled,false);assert.equal(r.scripts.length,0);
});
test('non-marker strings are never copied into diagnostic DOM',()=>{
 const r=run({values:new Map([[marker,'PRIVATE_SENTINEL_NOT_A_MARKER']])});assert.deepEqual(r.attributes,{});assert.equal(JSON.stringify(r.attributes).includes('PRIVATE_SENTINEL'),false);
});
