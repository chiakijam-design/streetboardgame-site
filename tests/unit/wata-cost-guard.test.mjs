import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { COST_POLICIES, consumeCostBudget, costBudgetResponse, runBudgetedSocialPublishing } from '../../src/cost/guard.js';
import worker from '../../_worker.js';
const start = Date.UTC(2026, 10, 4, 12);
function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../../migrations/0030_wata_cost_budgets.sql', import.meta.url), 'utf8'));
  const calls=[];
  const env={WATA_COST_GUARD_MODE:'enforce',REMOTE_DB:{prepare(sql){const q=db.prepare(sql);let args=[];return{bind(...a){args=a;return this;},async first(){calls.push(sql);return q.get(...args)||null;}};}}};
  return {db,env,calls};
}
test('off preserves deployments without a migration; invalid mode and DB failure stop only guarded reads',async()=>{
  assert.equal((await consumeCostBudget({},'overview-full',start)).allowed,true);
  for(const env of [{WATA_COST_GUARD_MODE:'bad'},{WATA_COST_GUARD_MODE:'enforce'}, {WATA_COST_GUARD_MODE:'enforce',REMOTE_DB:{prepare(){throw Error('offline')}}}]) assert.equal((await consumeCostBudget(env,'overview-full',start)).error,'cost-guard-unavailable');
});
for(const scope of Object.keys(COST_POLICIES)) test(`${scope}: exact interval boundary, no denied-attempt daily/month leakage`,async()=>{
  const x=setup();try{const p=COST_POLICIES[scope];const a=await Promise.all(Array.from({length:p.interval+20},()=>consumeCostBudget(x.env,scope,start)));assert.equal(a.filter(r=>r.allowed).length,p.interval);
  let row=x.db.prepare('SELECT * FROM wata_cost_budgets').get();assert.equal(row.day_count,p.interval);assert.equal(row.month_count,p.interval);
  const r=a.find(r=>!r.allowed);assert.equal(r.status,429);assert.equal(r.retryAfter,p.intervalMs/1000);assert.equal(costBudgetResponse(r).headers.get('retry-after'),String(r.retryAfter));
  assert.equal((await consumeCostBudget(x.env,scope,start+p.intervalMs-1)).allowed,false);
  assert.equal((await consumeCostBudget(x.env,scope,start+p.intervalMs)).allowed,true);
  assert.equal((await consumeCostBudget(x.env,scope,start)).allowed,false); // stale delivery cannot rewind a bucket
  }finally{x.db.close();}
});
for(const limit of ['day','month']) test(`${limit} quota exhaustion survives interval rollover; resets at UTC boundary`,async()=>{
  const x=setup();try{await consumeCostBudget(x.env,'overview-full',start);const p=COST_POLICIES['overview-full'];x.db.prepare(`UPDATE wata_cost_budgets SET ${limit}_count = ?`).run(p[limit]);
  const r=await consumeCostBudget(x.env,'overview-full',start+60000);assert.equal(r.status,429);assert.equal(x.db.prepare(`SELECT ${limit}_count AS n FROM wata_cost_budgets`).get().n,p[limit]);
  const boundary=limit==='day'?Date.UTC(2026,10,5):Date.UTC(2026,11,1);assert.equal((await consumeCostBudget(x.env,'overview-full',boundary-1)).allowed,false);assert.equal((await consumeCostBudget(x.env,'overview-full',boundary)).allowed,true);
  }finally{x.db.close();}
});
test('separate full/pending scopes and emergency pause do not consume counters',async()=>{
  const x=setup();try{x.env.WATA_COST_STOP_OVERVIEW='true';assert.equal((await consumeCostBudget(x.env,'overview-full',start)).error,'cost-guard-paused');assert.equal(x.calls.length,0);delete x.env.WATA_COST_STOP_OVERVIEW;
  await consumeCostBudget(x.env,'overview-full',start);await consumeCostBudget(x.env,'overview-pending',start);assert.equal(x.db.prepare('SELECT count(*) AS n FROM wata_cost_budgets').get().n,2);
  assert.equal((await consumeCostBudget(x.env,'invalid',start)).status,503);
  }finally{x.db.close();}
});
test('social duplicate delivery, external failures and stop remain bounded; disabled social needs no DB',async()=>{
  const x=setup();let attempts=0;const publish=async()=>{attempts++;throw Error('synthetic external failure');};try{x.env.SOCIAL_PUBLISHING_ENABLED='true';await assert.rejects(runBudgetedSocialPublishing(x.env,start,publish));
  assert.equal((await runBudgetedSocialPublishing(x.env,start,publish)).skipped,true);assert.equal(attempts,1);
  x.env.WATA_COST_STOP_SOCIAL='true';assert.equal((await runBudgetedSocialPublishing(x.env,start+3600000,publish)).reason,'cost-guard-paused');assert.equal(attempts,1);
  assert.equal((await runBudgetedSocialPublishing({},start,publish)).enabled,false);
  }finally{x.db.close();}
});

test('actual scheduled entry keeps privacy cleanup active when social is paused',async()=>{
  const calls=[];const db={prepare(sql){calls.push(sql);const stmt={bind(){return stmt;},async all(){return{results:[]};},async first(){return null;},async run(){return{meta:{changes:0}};}};return stmt;}};
  const jobs=[];
  await worker.scheduled({scheduledTime:start},{REMOTE_DB:db,WATA_COST_GUARD_MODE:'enforce',WATA_COST_STOP_SOCIAL:'true',SOCIAL_PUBLISHING_ENABLED:'true'},{waitUntil(job){jobs.push(job);}});
  await Promise.all(jobs);
  assert.ok(calls.some(sql=>/DELETE FROM live_rate_limits/.test(sql)));
  assert.ok(calls.some(sql=>/SELECT code FROM challenge_rooms/.test(sql)));
  assert.equal(calls.some(sql=>/social_posts|wata_cost_budgets/.test(sql)),false);
});
