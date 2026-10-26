import test from 'node:test';
import assert from 'node:assert/strict';
import { answeredQuestionCount, completedCreatorQuiz, validQuizLength } from '../../src/challenge/length.js';
import { handleChallengeApi } from '../../src/challenge/api.js';
import { getChallengeResultTier, getChallengeResultTierEnglish, getChallengeReviewLines } from '../../src/challenge/result.js';

class MemoryKV {
  values = new Map();
  async get(key, options = {}) { const value = this.values.get(key); return value ? options.type === 'json' ? JSON.parse(value) : value : null; }
  async put(key, value) { this.values.set(key, String(value)); }
}
const cards = Array.from({ length: 11 }, (_, i) => ({ id: `T${i}`, title: `Question ${i}`, choices: ['A','B','C','D','E'] }));
function api(env, path, body, token) {
  return handleChallengeApi(new Request(`https://example.test${path}`, { method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...(token ? {'x-challenge-participant-token':token} : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env, path);
}
test('only the contiguous answered prefix can be completed; zero is forbidden', () => {
  assert.equal(validQuizLength(0), false); assert.equal(validQuizLength(11), false);
  assert.equal(completedCreatorQuiz(cards, []), null);
  assert.equal(answeredQuestionCount(cards, [0, 2, , 1]), 2);
  assert.deepEqual(completedCreatorQuiz(cards, [0, 2]).cards, cards.slice(0,2));
});
for (let count=1; count<=10; count++) test(`${count}-question room: private answers, resume, idempotent submission, result and retry`, async () => {
  const env={ CHALLENGE_KV:new MemoryKV() };
  const created=await api(env,'/api/challenge/rooms',{creatorName:'Creator',cards:cards.slice(0,count),answers:Array(count).fill(0)});
  assert.equal(created.status,201);const room=await created.json();const path=`/api/challenge/rooms/${room.code}`;
  assert.equal(room.room.cards.length,count);assert.equal(room.room.answerKey,undefined);
  const joined=await (await api(env,`${path}/join`,{name:'Player'})).json();const token=joined.participantToken;
  assert.equal((await api(env,`${path}/result`,undefined,token)).status,409);
  for(let i=0;i<count;i++) {
    const response=await (await api(env,`${path}/answer`,{questionIndex:i,choice:0},token)).json();
    assert.equal(response.completed,i===count-1);
    const repeated=await api(env,`${path}/answer`,{questionIndex:i,choice:0},token);assert.equal(repeated.status,200);
    const resumed=await (await api(env,`${path}/join`,{},token)).json();assert.equal(resumed.participant.answerCount,i+1);
  }
  assert.equal((await api(env,`${path}/answer`,{questionIndex:count,choice:0},token)).status,400);
  const result=await (await api(env,`${path}/result`,undefined,token)).json();assert.equal(result.score,count);assert.equal(result.answers.length,count);
  assert.equal((await api(env,`${path}/retry`,{},token)).status,200);
  assert.equal((await api(env,`${path}/submit`,{answers:Array(count).fill(1)},token)).status,200);
  const retried=await (await api(env,`${path}/result`,undefined,token)).json();assert.equal(retried.score,0);
  if(count<10) {
    assert.equal(getChallengeResultTier(count,count).tag,`${count}/${count}`);
    assert.equal(getChallengeResultTierEnglish(0,count).tag,`0/${count}`);
    assert.equal(getChallengeReviewLines(retried)[0],`0/${count}`);
  }
});
test('zero, over-ten and mismatched card/answer payloads are rejected', async () => {
  for(const [c,a] of [[0,0],[11,11],[2,1],[1,2]]) {
    const env={ CHALLENGE_KV:new MemoryKV() };
    assert.equal((await api(env,'/api/challenge/rooms',{cards:cards.slice(0,c),answers:Array(a).fill(0)})).status,400);
  }
});
