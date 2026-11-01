import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleChallengeApi,AUTOMATIC_BOARD_POLICY} from '../../src/challenge/api.js';
import {BOARD_COPY} from '../../src/i18n/challenge-board-copy.js';
import {TARGET_LOCALES} from '../../src/i18n/locales.js';
import {PUBLIC_LOCALE_PAGES} from '../../src/generated/public-locale-pages.js';
test('automatic board notices cover every supported locale',()=>{
  assert.equal(BOARD_COPY.ja.notice,'回答を完了すると、表示名と点数が理解度ボードに自動で載ります。');
  assert.equal(BOARD_COPY.en.notice,'Finishing adds your display name and score to the board automatically.');
  assert.deepEqual(Object.keys(BOARD_COPY).sort(),[...TARGET_LOCALES].sort());
  for(const copy of Object.values(BOARD_COPY)) for(const key of ['notice','rule','legacy','scope','data']) assert.ok(copy[key]?.length>10);
});
test('public policy pages preserve the new notice and legacy privacy in every locale',()=>{
 for(const locale of TARGET_LOCALES) for(const page of ['terms','privacy','minor-policy']){
   const asset=locale==='ja'?'/'+page+'.html':PUBLIC_LOCALE_PAGES['/'+locale+'/'+page];
   const html=readFileSync(new URL('../../'+asset.slice(1),import.meta.url),'utf8');
   assert.ok(html.includes(BOARD_COPY[locale].notice),locale+'/'+page+' notice');
   assert.ok(html.includes(BOARD_COPY[locale].legacy),locale+'/'+page+' legacy privacy');
   assert.ok(html.includes(BOARD_COPY[locale].scope),locale+'/'+page+' access scope');
   if(page==='privacy') assert.ok(html.includes(BOARD_COPY[locale].data),locale+' data inventory');
 }
});
test('localized challenge structured descriptions match the automatic-publication notice',()=>{
 for(const locale of TARGET_LOCALES.filter(l=>l!=='ja')){
   const html=readFileSync(new URL('../../'+PUBLIC_LOCALE_PAGES['/'+locale+'/challenge'].slice(1),import.meta.url),'utf8');
   const blocks=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
   const page=blocks.flatMap(b=>b['@graph']||[b]).find(b=>b['@type']==='WebPage');
   assert.equal(page.description,BOARD_COPY[locale].notice,locale);
 }
});

function fixture(engine){
  if(engine==='KV'){const values=new Map();return {env:{CHALLENGE_KV:{async get(k,o){const v=values.get(k);return v?(o?.type==='json'?JSON.parse(v):v):null;},async put(k,v){values.set(k,v);}}},close(){}};}
  const db=new DatabaseSync(':memory:');
  for(const name of ['0010_challenge_rooms.sql','0011_challenge_ranking_library.sql','0018_challenge_board_comments.sql','0029_challenge_auto_board.sql'])db.exec(readFileSync(new URL('../../migrations/'+name,import.meta.url),'utf8'));
  return {db,env:{REMOTE_DB:{prepare(sql){const stmt=db.prepare(sql);return {bind(...args){return {async run(){return {meta:{changes:Number(stmt.run(...args).changes)}};},async first(){return stmt.get(...args)||null;},async all(){return {results:stmt.all(...args)};}};}};} }},close(){db.close();}};
}
async function setup(engine,count){const f=fixture(engine);const api=async(path,body,token,method)=>{const options={method:method||(body===undefined?'GET':'POST'),headers:{'content-type':'application/json',...(token?{'x-challenge-participant-token':token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})};const r=await handleChallengeApi(new Request('https://example.com'+path,options),f.env,path);return {status:r.status,body:await r.json()};};
  const cards=Array.from({length:count},(_,i)=>({id:'AUTO'+i,title:'Synthetic '+i,choices:['A','B','C','D','E']}));
  const created=await api('/api/challenge/rooms',{creatorName:'Synthetic host',cards,answers:Array(count).fill(0)});assert.equal(created.status,201);
  return {...f,api,path:'/api/challenge/rooms/'+created.body.code,room:created.body};}
for(const engine of ['KV','D1'])for(const count of [1,2,3,9,10])test(`${engine} ${count}: automatic completion, stable best score, retry and room isolation`,async()=>{
  const f=await setup(engine,count);try{const {api,path}=f;
    const joined=await api(path+'/join',{name:'SyntheticA',boardPolicy:AUTOMATIC_BOARD_POLICY});assert.equal(joined.status,201);const token=joined.body.participantToken;
    assert.equal((await api(path+'/ranking')).body.participants.length,0,'incomplete answers are not listed');
    for(let i=0;i<count;i++){const r=await api(path+'/answer',{questionIndex:i,choice:i===0?0:1},token);assert.equal(r.status,200);if(i<count-1)assert.equal((await api(path+'/ranking')).body.participants.length,0);}
    assert.equal((await api(path+'/answer',{questionIndex:count-1,choice:count===1?0:1},token)).status,200,'duplicate final answer is idempotent');
    let board=(await api(path+'/ranking')).body.participants;assert.deepEqual(board,[{name:'SyntheticA',score:1}]);
    assert.equal((await api(path+'/retry',{boardPolicy:AUTOMATIC_BOARD_POLICY},token)).status,200);
    assert.equal((await api(path+'/retry',{boardPolicy:AUTOMATIC_BOARD_POLICY},token)).status,409);
    assert.deepEqual((await api(path+'/ranking')).body.participants,board,'retry does not hide a completed best');
    assert.equal((await api(path+'/submit',{answers:Array(count).fill(1)},token)).status,200);
    assert.equal((await api(path+'/result',undefined,token)).body.score,0,'result retains actual low score');
    assert.equal((await api(path+'/ranking')).body.participants[0].score,1,'low retry never lowers board score');
    await api(path+'/retry',{boardPolicy:AUTOMATIC_BOARD_POLICY},token);
    await api(path+'/submit',{answers:Array(count).fill(0)},token);
    assert.deepEqual((await api(path+'/ranking')).body.participants,[{name:'SyntheticA',score:count}]);
    const sameName=await api(path+'/join',{name:'SyntheticA',boardPolicy:AUTOMATIC_BOARD_POLICY});await api(path+'/submit',{answers:Array(count).fill(1)},sameName.body.participantToken);
    assert.equal((await api(path+'/ranking')).body.participants.length,2,'same display name is not identity');
    assert.equal((await api(path+'/result',undefined,sameName.body.participantToken)).body.score,0);
    assert.equal((await api(path+'/ranking',undefined,token,'DELETE')).status,409,'new automatic policy cannot be silently changed by old optional UI');
    const second=await api('/api/challenge/rooms',{creatorName:'Other synthetic host',cards:f.room.body?.room?.cards||f.room.room.cards,answers:Array(count).fill(0)});
    const other='/api/challenge/rooms/'+second.body.code;
    assert.equal((await api(other+'/retry',{boardPolicy:AUTOMATIC_BOARD_POLICY},token)).status,403);
    assert.equal((await api(other+'/result',undefined,token)).status,403);
    const noManage=await api(path+'/manage');assert.equal(noManage.status,403);
  }finally{f.close();}
});
for(const engine of ['KV','D1'])test(`${engine}: legacy private results stay private, prospective retry only`,async()=>{
  const f=await setup(engine,2);try{const {api,path}=f;const old=await api(path+'/join',{name:'LegacyA'});const token=old.body.participantToken;
    await api(path+'/submit',{answers:[0,0]},token);assert.equal((await api(path+'/ranking')).body.participants.length,0);
    assert.equal((await api(path+'/result',undefined,token)).body.participant.rankingParticipating,false);
    await api(path+'/retry',{boardPolicy:AUTOMATIC_BOARD_POLICY},token);assert.equal((await api(path+'/ranking')).body.participants.length,0,'old private high score never becomes a best');
    await api(path+'/submit',{answers:[1,1]},token);assert.deepEqual((await api(path+'/ranking')).body.participants,[{name:'LegacyA',score:0}]);
  }finally{f.close();}
});
for(const engine of ['KV','D1'])test(`${engine}: explicit legacy draft resume, ordering and ties`,async()=>{
 const f=await setup(engine,2); try { const {api,path}=f;
   const a=await api(path+'/join',{name:'First'}); const ta=a.body.participantToken;
   await api(path+'/answer',{questionIndex:0,choice:0},ta);
   assert.equal((await api(path+'/join',{},ta)).body.participant.boardAutomatic,false,'background resume cannot enroll');
   assert.equal((await api(path+'/join',{boardPolicy:AUTOMATIC_BOARD_POLICY},ta)).body.participant.boardAutomatic,true);
   await api(path+'/answer',{questionIndex:1,choice:1},ta);
   await new Promise(resolve=>setTimeout(resolve,2));
   const b=await api(path+'/join',{name:'Second',boardPolicy:AUTOMATIC_BOARD_POLICY});const tb=b.body.participantToken;
   await api(path+'/submit',{answers:[0,0]},tb);
   assert.deepEqual((await api(path+'/ranking')).body.participants.map(p=>p.name),['Second','First']);
   await api(path+'/retry',{boardPolicy:AUTOMATIC_BOARD_POLICY},ta);await api(path+'/submit',{answers:[0,0]},ta);
   assert.deepEqual((await api(path+'/ranking')).body.participants.map(p=>p.name),['First','Second'],'tie uses first publication, not latest retry');
   assert.equal((await api(path+'/result',undefined,ta)).body.board.length,2);
   assert.equal((await api(path+'/join',{},ta)).body.participantToken,ta,'reload retains identity');
 } finally { f.close(); }
});
