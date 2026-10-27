import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { handleChallengeApi } from '../../src/challenge/api.js';
import { answeredQuestionCount, completedCreatorQuiz, validQuizLength } from '../../src/challenge/length.js';
import { challengeCopy } from '../../src/i18n/challenge-copy.js';
import { challengeCompletionCopy } from '../../src/i18n/challenge-completion-copy.js';

// Execute the real client flow functions against the real API and a fresh KV.
// DOM layout / browser rendering remain separate E2E checks; no bundler or network here.
const source=readFileSync(new URL('../../challenge_game.js',import.meta.url),'utf8');
function clientFunction(name) {
  const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start>=0,name);
  const tail=source.slice(start),next=tail.slice(1).search(/\n(?:async )?function /);
  return next<0?tail:tail.slice(0,next+1);
}
const code=['answerQuestion','createChallengeRoom','startRoleSwap','toCreatorDraftCard',
  'finishConfirmationView','creatorDraft','resumeCreate','rankingView','numberedCopy'].map(clientFunction).join('\n');
const cards=Array.from({length:10},(_,i)=>({id:`T${i}`,sourceId:`T${i}`,title:`Topic ${i}`,choices:['A','B','C','D','E']}));
function harness() {
  const values=new Map(),kv={async get(key,options={}){const v=values.get(key);return v?options.type==='json'?JSON.parse(v):v:null;},async put(key,v){values.set(key,String(v));}};
  const saved=new Map();let requests=0;
  const context={QUESTION_COUNT:10,CREATOR_DRAFT_KEY:'draft',state:{mode:'creator-edit',cards:structuredClone(cards),answers:[],questionIndex:0,creatorName:'Local creator',finishCount:0,loading:false,questionSubmissionConsent:false},
    allCards:structuredClone(cards),currentLocale:'ja',languagePrefix:'',validQuizLength,answeredQuestionCount,completedCreatorQuiz,challengeCopy,challengeCompletionCopy,
    structuredClone,Date,Number,Array,JSON,Map,Set,console,
    escapeHtml:x=>String(x).replaceAll('<','&lt;'),translateText:x=>x,shell:(...args)=>args,
    captureCreatorConsent(){},trackGamePlay(){},trackDailyResultAction(){},
    changedQuestionCandidates:()=>[],saveManageRoom(){},removeStorage:key=>saved.delete(key),
    readStorage:key=>saved.get(key),saveCreatorDraft:v=>saved.set('draft',structuredClone(v)),
    history:{replaceState(){}},setState:patch=>Object.assign(context.state,patch),
    challengeUrl:code=>`https://local.test/challenge?room=${code}`,
    async fetch(path,options){requests++;return handleChallengeApi(new Request('https://local.test'+path,options),{CHALLENGE_KV:kv},path);},
  };
  vm.createContext(context);vm.runInContext(code,context);
  return {context,saved,requests:()=>requests};
}
for(const count of [1,2,3,9,10]) test(`real creator flow publishes ${count} answered questions, with no unanswered cards`,async()=>{
  const h=harness(),c=h.context;
  for(let i=0;i<count;i++)await c.answerQuestion(0);
  if(count<10){
    assert.equal(c.state.mode,'creator-edit');assert.equal(h.requests(),0);
    c.state.finishCount=count;
    assert.equal(c.finishConfirmationView()[1],`この${count}問でクイズを作成`);
    assert.match(c.finishConfirmationView()[3],new RegExp(`この${count}問でクイズを作成`));
    assert.doesNotMatch(c.finishConfirmationView()[3],new RegExp(`${count}/10`));
    // Two simultaneous publish actions must create exactly one room.
    await Promise.all([c.createChallengeRoom(c.state.answers.slice(0,count)),c.createChallengeRoom(c.state.answers.slice(0,count))]);
  }
  assert.equal(h.requests(),1);assert.equal(c.state.mode,'manage');
  assert.equal(c.state.room.cards.length,count);assert.equal(c.state.cards.length,count);
  assert.equal(c.state.room.answerKey,undefined);assert.equal(c.state.finishCount,0);
});
for(const count of [1,2,9,10])test(`role swap / saved resume retains exactly ${count} questions and no original answers`,async()=>{
  const h=harness(),c=h.context;
  c.state.result={participant:{name:'Local player'},answers:cards.slice(0,count).map(card=>({card,correct:4,selected:2}))};
  c.startRoleSwap();assert.equal(c.state.cards.length,count);assert.equal(c.state.answers.length,0);
  assert.equal(c.state.creatorName,'Local player');assert.equal(h.requests(),0);
  c.state.mode='create';c.resumeCreate();assert.equal(c.state.mode,'creator-edit');
  assert.equal(c.state.cards.length,count);assert.equal(c.state.questionIndex,0);
  for(let index=0;index<count;index++) await c.answerQuestion(0);
  assert.equal(c.state.mode,'manage');assert.equal(c.state.room.cards.length,count);
});
test('zero answers cannot publish; a failed request retains the complete draft for retry',async()=>{
  const h=harness(),c=h.context;await c.createChallengeRoom([]);assert.equal(h.requests(),0);
  await c.answerQuestion(0);c.state.finishCount=1;
  const originalFetch=c.fetch;c.fetch=async()=>{throw new Error('offline-test');};
  await c.createChallengeRoom([0]);assert.equal(c.state.loading,false);assert.equal(c.state.mode,'creator-edit');
  assert.equal(c.state.cards.length,10);assert.equal(c.state.answers.length,1);
  c.fetch=originalFetch;await c.createChallengeRoom([0]);assert.equal(c.state.room.cards.length,1);
});

test('empty board asks for the first friend; an opt-out result is not described as zero answers',()=>{
  const c=harness().context;c.state.room={code:'ABCD23EF',questionCount:2,completedParticipants:0,maxParticipants:50};c.state.ranking=[];
  assert.match(c.rankingView()[3],/board-first-friend-prompt/);
  c.state.room.completedParticipants=1;assert.doesNotMatch(c.rankingView()[3],/board-first-friend-prompt/);
});
