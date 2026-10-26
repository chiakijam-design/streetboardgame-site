import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {LOCALE_DETAILS,TARGET_LOCALES} from '../../src/i18n/locales.js';
import {challengeCopy} from '../../src/i18n/challenge-copy.js';
import {buildChallengeInviteText} from '../../src/platform/share.js';
const source=readFileSync(new URL('../../src/platform/inviteShare.js',import.meta.url),'utf8');
const body=source.slice(source.indexOf('export function challengeInvitePayload'),source.indexOf('export async function createChallengeInviteCanvas')).replace('export ','');
const context={URL,LOCALE_DETAILS,challengeCopy,buildChallengeInviteText};vm.createContext(context);vm.runInContext(body,context);
test('all locale invitation captions keep the actual count and preserve public URL/name without private data',()=>{
  for(const locale of TARGET_LOCALES)for(const count of [1,2,9,10]){
    const room={code:'ABCD10EF',creatorName:'Name10',cards:Array(count).fill({}),manageToken:'PRIVATE_MANAGE_TOKEN',answerKey:['PRIVATE_ANSWER']};
    const payload=context.challengeInvitePayload({origin:'https://example.test',locale,room});
    assert.equal(payload.url,`https://example.test${LOCALE_DETAILS[locale].prefix}/challenge?room=ABCD10EF`);
    assert.ok(payload.text.includes('Name10'));
    assert.doesNotMatch(JSON.stringify(payload),/PRIVATE_MANAGE_TOKEN|PRIVATE_ANSWER|#manage=/);
    if(count<10){assert.ok(payload.text.includes(`(${count})`));assert.doesNotMatch(payload.text,/10 questions|10問/);}
  }
});

test('real invitation image preparation passes short and legacy counts to caption and canvas',async()=>{
  const ui=readFileSync(new URL('../../challenge_game.js',import.meta.url),'utf8');
  const fn=ui.slice(ui.indexOf('async function prepareInvitationImage'),ui.indexOf('async function joinRoom'));
  for(const count of [1,2,9,10]){
    let canvasCount,caption;
    const c={state:{mode:'manage',room:{code:'ABCD10EF',creatorName:'Local10',cards:Array(count).fill({})}},
      invitationKey:()=>String(count),document:{fonts:{ready:Promise.resolve()}},
      location:{origin:'https://example.test'},currentLocale:'en',translateText:x=>x,
      RESULT_GIRL_IMAGE_SRC:'/local.webp',loadResultImage:async()=>({}),
      challengeInvitePayload:args=>{const payload=context.challengeInvitePayload(args);caption=payload.text;return payload;},
      createChallengeInviteCanvas:async args=>{canvasCount=args.questionCount;return {toDataURL:()=> 'data:image/png;base64,LOCAL'};},render(){}};
    vm.createContext(c);vm.runInContext(fn,c);await c.prepareInvitationImage();
    assert.equal(c.invitationImage.error,false);assert.equal(c.invitationImage.busy,false);
    assert.equal(canvasCount,count);if(count<10)assert.ok(caption.includes(`(${count})`));
  }
});
