import test from 'node:test';
import assert from 'node:assert/strict';
import {TARGET_LOCALES} from '../../src/i18n/locales.js';
import {CHALLENGE_RESULT_COPY,challengeResultCopy} from '../../src/i18n/challenge-result-copy.js';
test('result actions and both disclosure states have fixed copy for every public language',()=>{
 assert.deepEqual(Object.keys(CHALLENGE_RESULT_COPY),[...TARGET_LOCALES]);
 for(const locale of TARGET_LOCALES){
  for(const key of ['heading','same','fresh','details','close']){
   const text=challengeResultCopy(locale,key);assert.equal(typeof text,'string');assert.ok(text.trim().length>0);assert.doesNotMatch(text,/[<>]|\{(?:count|max)\}/);
  }
  assert.notEqual(challengeResultCopy(locale,'same'),challengeResultCopy(locale,'fresh'));
  assert.notEqual(challengeResultCopy(locale,'details'),challengeResultCopy(locale,'close'));
 }
});
test('Japanese requested labels and unsupported locale fallback remain explicit',()=>{
 assert.equal(challengeResultCopy('ja','heading'),'次は私が出題する');
 assert.equal(challengeResultCopy('ja','same'),'同じ問題で作る');assert.equal(challengeResultCopy('ja','fresh'),'新しい問題で作る');
 assert.equal(challengeResultCopy('ja','details'),'詳しく見る');assert.equal(challengeResultCopy('unknown','details'),'View details');
});
