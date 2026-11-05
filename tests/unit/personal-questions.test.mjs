import test from 'node:test';
import assert from 'node:assert/strict';
import { PERSONAL_QUESTIONS_KEY, PERSONAL_QUESTIONS_LIMIT, PERSONAL_HISTORY_LIMIT, loadPersonalQuestions, changePersonalQuestions, personalQuestionCard, personalQuestionBatch, restorePersonalQuestion, submissionEligibleCards, publicQuizCards } from '../../src/questions/personal-library.js';
import { PERSONAL_QUESTION_COPY } from '../../src/i18n/personal-question-copy.js';
import { PERSONAL_HISTORY_COPY, personalCompactCopy } from '../../src/i18n/personal-question-history-copy.js';
import { PERSONAL_BATCH_COPY } from '../../src/i18n/personal-question-batch-copy.js';
const question = { title:'Local question?', choices:['One','Two','Three','Four','Five'], answer:4, name:'Never store', manageToken:'not-a-real-key' };
function memory() { const values = new Map(); return { getItem:key=>values.get(key) ?? null, setItem:(key,value)=>values.set(key,value) }; }

test('save and reload only question text, choices and local row ID',()=>{
  const store=memory(); const saved=changePersonalQuestions(store,{type:'save',question});
  assert.equal(saved.ok,true); assert.equal(loadPersonalQuestions(store).items.length,1);
  const raw=JSON.parse(store.getItem(PERSONAL_QUESTIONS_KEY));
  assert.deepEqual(Object.keys(raw.items[0]).sort(),['choices','history','id','title']);
  assert.equal(raw.items[0].answer,undefined); assert.equal(raw.items[0].manageToken,undefined);
  assert.equal(changePersonalQuestions(store,{type:'save',question}).id,saved.id);
});
test('editing or deleting a saved template cannot mutate an issued snapshot or retain a correct answer',()=>{
  const store=memory(); const first=changePersonalQuestions(store,{type:'save',question});
  const card=personalQuestionCard(first.items[0],'USRexample');
  const issued=publicQuizCards([card]);
  assert.equal(card.answer,undefined); assert.equal(card.personalSubmissionConsent,false);
  changePersonalQuestions(store,{type:'save',id:first.id,question:{...question,title:'Changed?'}});
  changePersonalQuestions(store,{type:'delete',id:first.id});
  assert.equal(loadPersonalQuestions(store).items.length,0); assert.equal(issued[0].title,'Local question?');
  card.choices[0]='Changed'; assert.equal(issued[0].choices[0],'One');
  assert.deepEqual(Object.keys(issued[0]).sort(),['category','choices','id','sourceId','title']);
});
test('personal submission requires its own explicit opt-in even when general consent is on',()=>{
  const ordinary={id:'normal'}, personal=personalQuestionCard(question,'USRtest');
  assert.deepEqual(submissionEligibleCards([ordinary,personal],true),[ordinary]);
  assert.deepEqual(submissionEligibleCards([ordinary,{...personal,personalSubmissionConsent:true}],false).map(c=>c.id),['USRtest']);
  for(const value of [undefined,null,'true',1,false]) assert.equal(submissionEligibleCards([{...personal,personalSubmissionConsent:value}],true).length,0);
});
for(const kind of ['read-denied','write-denied','silent-write','readback-denied','malformed','future-version']) test(`storage failure ${kind} is visible and does not create server fallback`,()=>{
  const store=memory();
  if(kind==='malformed') store.setItem(PERSONAL_QUESTIONS_KEY,'{broken');
  if(kind==='future-version') store.setItem(PERSONAL_QUESTIONS_KEY,JSON.stringify({version:2,items:[]}));
  if(kind==='read-denied') store.getItem=()=>{throw Error('SecurityError');};
  if(kind==='write-denied') store.setItem=()=>{throw Error('QuotaExceededError');};
  if(kind==='silent-write') store.setItem=()=>{};
  if(kind==='readback-denied') {const get=store.getItem;let reads=0;store.getItem=key=>{if(++reads>1)throw Error('readback');return get(key);};}
  assert.equal(changePersonalQuestions(store,{type:'save',question}).ok,false);
});
for(const invalid of [{...question,title:''},{...question,title:'x'.repeat(81)},{...question,choices:['a','a','c','d','e']},{...question,choices:['a','b']},{...question,choices:['x'.repeat(41),'b','c','d','e']}]) test('invalid template is not silently truncated',()=>{
  const store=memory(); assert.equal(changePersonalQuestions(store,{type:'save',question:invalid}).error,'invalid');
  assert.equal(store.getItem(PERSONAL_QUESTIONS_KEY),null);
});
test('bounded library and missing IDs cannot overwrite unrelated templates',()=>{
  const store=memory(); const items=Array.from({length:PERSONAL_QUESTIONS_LIMIT},(_,i)=>({id:`row${i}`,title:`Question ${i}`,choices:question.choices}));
  store.setItem(PERSONAL_QUESTIONS_KEY,JSON.stringify({version:1,items}));
  assert.equal(changePersonalQuestions(store,{type:'save',question}).error,'limit');
  assert.equal(changePersonalQuestions(store,{type:'save',id:'gone',question}).error,'missing');
  assert.equal(loadPersonalQuestions(store).items.length,PERSONAL_QUESTIONS_LIMIT);
});
test('all 34 supported languages have complete feature and privacy copy',()=>{
  assert.equal(Object.keys(PERSONAL_QUESTION_COPY).length,34);
  for(const copy of Object.values(PERSONAL_QUESTION_COPY)) assert.equal(Object.keys(copy).filter(k=>typeof copy[k]==='string'&&copy[k].length).length,16);
  assert.deepEqual(Object.keys(PERSONAL_HISTORY_COPY).sort(),Object.keys(PERSONAL_QUESTION_COPY).sort());
  assert.deepEqual(Object.keys(PERSONAL_BATCH_COPY).sort(),Object.keys(PERSONAL_QUESTION_COPY).sort());
  for(const locale of Object.keys(PERSONAL_QUESTION_COPY))for(const key of ['history','choices']) assert.ok(personalCompactCopy(locale,key));
});

test('saved full edits and choice-only edits each retain exact previous versions, bounded at ten',()=>{
  const store=memory();let result=changePersonalQuestions(store,{type:'save',question});const id=result.id;
  result=changePersonalQuestions(store,{type:'save',id,question:{...question,title:'New title?'}});
  assert.deepEqual(result.items[0].history,[{title:question.title,choices:question.choices}]);
  const changed={title:'New title?',choices:['Apple','Pear','Peach','Kiwi','Grape']};
  result=changePersonalQuestions(store,{type:'save',id,question:changed});
  assert.equal(result.items[0].history[0].title,'New title?');assert.deepEqual(result.items[0].history[0].choices,question.choices);
  const current={title:'Keep my current title?',choices:changed.choices};
  const optionsOnly=restorePersonalQuestion(current,result.items[0].history[1],'choices','USRchoices');
  assert.equal(optionsOnly.title,current.title);assert.deepEqual(optionsOnly.choices,question.choices);assert.equal(optionsOnly.personalSubmissionConsent,false);
  const whole=restorePersonalQuestion(current,result.items[0].history[1],'all','USRall');
  assert.equal(whole.title,question.title);assert.deepEqual(whole.choices,question.choices);assert.equal(whole.answer,undefined);
  for(let i=0;i<15;i++)result=changePersonalQuestions(store,{type:'save',id,question:{...changed,title:`Revision ${i}?`,answer:i}});
  assert.equal(result.items[0].history.length,PERSONAL_HISTORY_LIMIT);
  assert.equal(JSON.stringify(result.items[0].history).includes('answer'),false);
  assert.equal(result.items[0].history[0].title,'Revision 13?');
});

test('failed history write preserves the last successfully saved question and versions',()=>{
  const store=memory();const first=changePersonalQuestions(store,{type:'save',question});
  const before=store.getItem(PERSONAL_QUESTIONS_KEY);store.setItem=()=>{throw Error('QuotaExceededError');};
  assert.equal(changePersonalQuestions(store,{type:'save',id:first.id,question:{...question,title:'Not saved'}}).ok,false);
  assert.equal(store.getItem(PERSONAL_QUESTIONS_KEY),before);
});

test('case-only text edits are preserved as real historical versions',()=>{
  const store=memory();const first=changePersonalQuestions(store,{type:'save',question});
  const next=changePersonalQuestions(store,{type:'save',id:first.id,question:{...question,title:question.title.toUpperCase()}});
  assert.equal(next.items[0].history[0].title,question.title);
});

for(const count of [1,2,3,9,10])test(`batch ${count} resets all chosen answers/consents and creates only selected questions`,()=>{
  const cards=Array.from({length:10},(_,i)=>({...question,id:`old${i}`}));
  const templates=Array.from({length:count},(_,i)=>({...question,id:`saved${i}`,personalSubmissionConsent:true,answer:4}));
  const batch=personalQuestionBatch(cards,[4,4,4],0,templates,'USRbatch');
  assert.equal(batch.cards.length,count);assert.deepEqual(batch.answers,[]);
  assert.equal(batch.cards.every(c=>c.personalSubmissionConsent===false && c.answer===undefined),true);
  assert.equal(batch.cards[0].personalTemplateId,'saved0');
  assert.equal(JSON.stringify(publicQuizCards(batch.cards)).includes('personalTemplateId'),false);
});
test('batch preserves answered prefix, respects remaining slots, rejects zero and never exceeds ten',()=>{
  const cards=Array.from({length:10},(_,i)=>({...question,id:`old${i}`}));
  const batch=personalQuestionBatch(cards,[0,1,2,3],2,[question,question],'USRprefix');
  assert.deepEqual(batch.cards.slice(0,2),cards.slice(0,2));assert.deepEqual(batch.answers,[0,1]);assert.equal(batch.cards.length,4);
  assert.throws(()=>personalQuestionBatch(cards,[],0,[],'USRzero'));
  assert.throws(()=>personalQuestionBatch(cards,[],9,[question,question],'USRover'));
  assert.equal(PERSONAL_QUESTIONS_LIMIT,30);
});
