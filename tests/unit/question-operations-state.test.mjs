import assert from 'node:assert/strict';
import test from 'node:test';
import { withSavedCatalog, withReviewedSubmission } from '../../src/questions/operations-state.js';

const question = { id:'CUSNEW',title:'一緒に遊ぶなら？',choices:['散歩','工作','音楽','ゲーム','読書'],status:'approved' };
const overview = () => ({catalog:[{...question,id:'CUSOLD'}],submissions:[{id:'a',status:'pending'},{id:'b',status:'pending'}],selectionStats:[{questionId:'CUSOLD',shownCount:10}],reports:[{questionId:'CUSOLD'}]});
test('採用はサーバー確定した問題だけを1件追加し、元データと他の審査を変更しない',()=>{
 const before=overview(), frozen=JSON.stringify(before),next=withReviewedSubmission(before,{submissionId:'a',status:'approved',catalogId:'CUSNEW',question},20,50);
 assert.equal(JSON.stringify(before),frozen);assert.equal(next.catalog.length,2);assert.equal(next.catalog[1],question);assert.deepEqual(next.submissions,[{id:'b',status:'pending'}]);assert.deepEqual(next.submissionPagination,{offset:50,limit:50,total:19});assert.equal(next.selectionStats,before.selectionStats);assert.equal(next.reports,before.reports);
});
test('却下はカタログを追加せず、残数と対象行だけを更新する',()=>{
 const before=overview(),next=withReviewedSubmission(before,{submissionId:'b',status:'rejected',catalogId:null},2);
 assert.equal(next.catalog,before.catalog);assert.deepEqual(next.submissions,[{id:'a',status:'pending'}]);assert.equal(next.submissionPagination.total,1);
});
test('旧形式・壊れた応答・別ID・重複ACKは再読取へ戻し、推測採用しない',()=>{
 const before=overview();for(const response of [null,{submissionId:'a',status:'approved',catalogId:'CUSNEW'},{submissionId:'a',status:'approved',catalogId:'OTHER',question},{submissionId:'missing',status:'rejected'},{submissionId:'a',status:'pending'}])assert.equal(withReviewedSubmission(before,response,2),null);
 const next=withReviewedSubmission(before,{submissionId:'a',status:'rejected'},2);assert.equal(withReviewedSubmission(next,{submissionId:'a',status:'rejected'},1),null);
});
test('保存済み1行の正規化・公開不可状態・通報情報を保ち、他の行を変更しない',()=>{
 const before=overview();const saved={...question,id:'CUSOLD',status:'quarantined',reportCount:2,quarantineReason:'test'};const next=withSavedCatalog(before,saved);assert.equal(next.catalog.length,1);assert.equal(next.catalog[0].reportCount,2);assert.equal(next.catalog[0].status,'quarantined');assert.equal(before.catalog[0].status,'approved');assert.equal(withSavedCatalog(before,{}),null);
});
