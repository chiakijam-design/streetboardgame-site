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
 for(const r of ['/guide','/guide/','/guide/*','/live*'])assert.ok(rules.includes(r),r);
 assert.ok(rules.length<=100,'Cloudflare limit');
});
