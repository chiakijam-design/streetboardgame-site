import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {pvPublicPath,GUIDE_PATHS} from '../../src/analytics/pv-policy.js';import {PUBLIC_LOCALES} from '../../src/generated/public-locales.js';import {GUIDE_LINKS_JA} from '../../src/content/search-copy.js';
// 2026-11-26 (Codex review 11/26, owner: "fix all")
test('#2-4 every Japanese reading page (/guide/) is inside the measured public scope',()=>{
 for(const [path] of GUIDE_LINKS_JA){assert.ok(GUIDE_PATHS.includes(path),path);assert.equal(pvPublicPath(path,PUBLIC_LOCALES),path);}
 assert.equal(pvPublicPath('/guide/',PUBLIC_LOCALES),'/guide');
 assert.equal(pvPublicPath('/guide/unknown-article',PUBLIC_LOCALES),null);
 for(const file of fs.readdirSync('guide').filter(f=>f.endsWith('.html')&&f!=='index.html'))assert.ok(GUIDE_PATHS.includes('/guide/'+file.replace(/\.html$/,'')),file);
});
test('#1-1 swapping roles does not overwrite an unfinished creator draft',()=>{
 const js=fs.readFileSync('challenge_game.js','utf8'),fn=js.slice(js.indexOf('function startRoleSwap()'),js.indexOf('function beginRoleSwap('));
 assert.ok(fn.includes('if (creatorDraft()) {')&&fn.includes('pendingRoleSwap = next;')&&fn.includes("mode: 'create'"),'shows the resume / delete choice first');
 assert.ok(!fn.includes('saveCreatorDraft(next)'),'does not save over the draft before the choice');
 assert.ok(js.includes('if (pendingRoleSwap) return beginRoleSwap(pendingRoleSwap);'),'deleting the old draft continues the swap');
 assert.ok(js.includes('function resumeCreate() {\n  pendingRoleSwap = null;'),'resuming the old draft drops the pending swap');
});
test('#2-4 the reading pages go through the Worker first (measurement, AdSense account tag, CSP)',()=>{
 const s=fs.readFileSync('wrangler.jsonc','utf8'),b=s.match(/"run_worker_first"\s*:\s*\[([\s\S]*?)\]/)[1],rules=JSON.parse('['+b.replace(/\/\/[^\n]*/g,'')+']');
 for(const r of ['/guide','/guide/*','/live*'])assert.ok(rules.includes(r),r);
 assert.ok(rules.length<=100,'Cloudflare limit');
});
// 2026-11-27 (Codex review 11/26, the remaining bugs; owner: "Claude does it all")
import vm from 'node:vm';
import {aggregateAnswerStats} from '../../src/challenge/api.js';
import {recountLibraryCatalog,stripHiddenQuestions,trimPackQuestions} from '../../src/questions/hidden-public.js';
import {renderLibraryCatalogSection} from '../../src/challenge/library-catalog.js';
import {renderPackPage} from '../../src/content/search-copy.js';
import {pickChallengeCards} from '../../src/challenge/data.js';
const game=fs.readFileSync('challenge_game.js','utf8'),worker=fs.readFileSync('_worker.js','utf8');
const fnSrc=(name)=>{const s=game.indexOf(`function ${name}(`);const t=game.slice(s);const n=t.slice(1).search(/\n(?:async )?function /);return n<0?t:t.slice(0,n+1);};
test('#1-9 a draft question hidden after saving is swapped out on resume / publish, and the server refuses it',()=>{
 const toCard=(c)=>({...c,sourceId:c.id,choices:c.choices.slice(0,5)});
 const cat=Array.from({length:14},(_,i)=>({id:`Q${i}`,title:`T${i}`,choices:['a','b','c','d','e']}));
 const ctx={questionCatalogReady:true,allCards:cat.filter(c=>c.id!=='Q3'),hiddenQuestionIdSet:()=>new Set(['Q3']),pickChallengeCards,toCreatorDraftCard:toCard,String,Set,Boolean,Array};
 vm.createContext(ctx);vm.runInContext(fnSrc('replaceUnavailableDraftCards'),ctx);
 const draft=cat.slice(0,10).map(toCard),r=ctx.replaceUnavailableDraftCards(draft,[0,1,2,3,4,0,1,2,3,4]);
 assert.equal(r.replaced,1);assert.equal(r.firstIndex,3);assert.equal(r.answers[3],null);assert.equal(r.answers[4],4);
 assert.ok(!r.cards.some(c=>c.sourceId==='Q3'));assert.equal(new Set(r.cards.map(c=>c.sourceId)).size,10,'no duplicate');
 assert.equal(ctx.replaceUnavailableDraftCards(draft.filter(c=>c.id!=='Q3'),[]).replaced,0,'available cards stay');
 const swapped=[...draft.filter(c=>c.id!=='Q3'),{id:'USR1',sourceId:'USR1',title:'from the other quiz',choices:['a','b','c','d','e']}];
 assert.equal(ctx.replaceUnavailableDraftCards(swapped,[]).replaced,0,'a role-swap card that is not in the catalog but not hidden stays');
 assert.ok(fnSrc('resumeCreate').includes('replaceUnavailableDraftCards(draft.cards, draft.answers)'));
 assert.ok(fnSrc('createChallengeRoom').includes('replaceUnavailableDraftCards(state.cards, answers)'));
 const api=fs.readFileSync('src/challenge/api.js','utf8');assert.ok(api.includes("throw apiError('question-hidden', 409);"));
});
test('#1-4 choice counts move only in groups of three, so one person cannot be read from the difference',()=>{
 const cards=[{choices:['a','b','c','d','e']}],p=(c,at)=>({completedAt:at,answers:[c]});
 const three=aggregateAnswerStats(cards,[p(0,1),p(1,2),p(1,3)]),four=aggregateAnswerStats(cards,[p(0,1),p(1,2),p(1,3),p(4,4)]);
 assert.deepEqual(four.questions,three.questions);assert.equal(four.completed,4);assert.equal(four.counted,3);
 assert.equal(aggregateAnswerStats(cards,[p(0,1),p(1,2),p(1,3),p(4,4),p(4,5),p(4,6)]).questions[0].counts[4],3);
});
test('#1-8 the library recounts the total and each category after hidden questions are removed',()=>{
 const html=renderLibraryCatalogSection(),total=Number(html.match(/全(\d+)問/)[1]);
 const block=html.match(/<details class="library-catalog__category" id="library-category-2">[\s\S]*?<\/details>/)[0];
 const ids=[...block.matchAll(/data-qid="([^"]+)"/g)].map(m=>m[1]);
 const out=stripHiddenQuestions(html,new Set(ids));
 assert.equal(Number(out.match(/全(\d+)問/)[1]),total-ids.length);
 assert.ok(!out.includes('id="library-category-2"')&&!out.includes('href="#library-category-2"'),'an empty category leaves the index too');
 assert.equal(recountLibraryCatalog(html),html,'nothing hidden, nothing changes');
});
test('#1-11 a pack page shows the first ten public questions, and says so when fewer remain',()=>{
 const html=renderPackPage('food-preferences','es'),id=html.match(/data-qid="([^"]+)"/)[1];
 const short=trimPackQuestions(stripHiddenQuestions(html,new Set([id])));
 assert.equal(short.match(/<ol class="wata-guide__questions">[\s\S]*?<\/ol>/)[0].match(/<li\b/g).length,9);
 assert.match(short,/data-testid="pack-short-note">Ahora se muestran 9 preguntas/);
 const full=trimPackQuestions(renderPackPage('easy-first-meeting','ja'));
 assert.equal(full.match(/<ol class="wata-guide__questions">[\s\S]*?<\/ol>/)[0].match(/<li\b/g).length,10);assert.ok(!full.includes('pack-short-note'));
 assert.ok(worker.includes('trimPackQuestions(stripHiddenQuestions(renderPackPage('));
});
test('#1-2 #1-3 #1-5 #1-6 #1-7 #1-10 smaller fixes stay in place',()=>{
 assert.ok(game.includes('<span>共有文にも点数を入れる（画像には点数が入ります）</span>'),'1-2 the checkbox says the image always has the score');
 assert.ok(fnSrc('answerParticipantQuestion').includes('if (await syncParticipantProgress(questionIndex).catch(() => false)) return;'),'1-3');
 assert.ok(fnSrc('syncParticipantProgress').includes('if (answerCount <= failedIndex) return false;'),'1-3 an unsaved answer still shows the error');
 assert.ok(fnSrc('render').includes("heading.focus({ preventScroll: true })"),'1-5');
 assert.ok(worker.includes("baseHtml = setLibraryHeading(removeLibraryCatalog(applyChallengeLibraryMeta(baseHtml)), 'ja')"),'1-6');
 assert.ok(game.includes('<p class="challenge-note" data-testid="retry-clears-answers">'),'1-7 (not the retry-note class, which tests read as the board rule)');
 assert.ok(/legal-history[\s\S]{0,2500}noindex, nofollow, noarchive"'\)/.test(worker),'1-10');
});
