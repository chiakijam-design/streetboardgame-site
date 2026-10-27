import assert from 'node:assert/strict';
import test from 'node:test';
import { challengeInvitePayload, INVITE_SHARE_LABELS } from '../../src/platform/inviteShare.js';
import { resultShareMarkup, shareResult, resultSocialUrl } from '../../src/platform/resultShare.js';
import { TARGET_LOCALES, LOCALE_DETAILS } from '../../src/i18n/locales.js';

const room = { code: 'QADEMO88', creatorName: 'Public name', manageToken: 'PRIVATE_MANAGEMENT', answers: ['PRIVATE_ANSWER'], participants: [{ name: 'PRIVATE_PARTICIPANT' }], score: 'PRIVATE_SCORE' };
test('every invitation locale exposes only the public participation URL and invitation copy', async () => {
  for (const locale of TARGET_LOCALES) {
    const payload = challengeInvitePayload({ origin: 'https://www.streetboardgame.com/challenge/manage?secret=PRIVATE_QUERY#manage=PRIVATE_HASH', locale, room, src: 'data:image/png;base64,aW52aXRl' });
    assert.equal(payload.url, `https://www.streetboardgame.com${LOCALE_DETAILS[locale].prefix}/challenge?room=QADEMO88`);
    assert.equal(new URL(payload.url).hash, '');
    assert.equal(payload.filename, 'watachan-challenge-invitation.png');
    assert.ok(payload.caption.includes(payload.url));
    assert.doesNotMatch(JSON.stringify(payload), /PRIVATE_|\/manage|score|participant/i);
    const labels = INVITE_SHARE_LABELS[locale];
    assert.equal(labels.length, 3);
    assert.ok(labels.every(value => value.trim()));
    if (locale !== 'ja') assert.doesNotMatch(labels.join(''), /[ぁ-んァ-ン]/);
    const html = resultShareMarkup({ locale, translate: value => value, escape: value => value, nativeLabel: labels[0], nativeHint: labels[2], showNativeHint: true, saveLabel: labels[1] });
    assert.ok(html.includes(labels[0]) && html.includes(labels[1]));
    assert.ok(html.includes(labels[2]) && html.includes('data-native-hint-visible'));
    assert.ok(html.includes(`aria-label="${labels[0]}"`));
    const resultHtml=resultShareMarkup({locale,translate:value=>value,escape:value=>value});
    assert.ok(resultHtml.includes('結果を共有') && !resultHtml.includes(labels[0]) && !resultHtml.includes(labels[2]) && !resultHtml.includes('data-native-hint-visible'));
    assert.ok(!html.includes('結果を共有') && !html.includes('結果画像を保存'));
    for (const action of ['native', 'copy', 'save', 'x', 'line', 'whatsapp', 'instagram-link', 'instagram']) assert.ok(html.includes(`data-result-share="${action}"`));
    for (const action of ['x', 'line', 'whatsapp']) assert.doesNotMatch(decodeURIComponent(resultSocialUrl(action, payload.text)), /PRIVATE_|\/manage/);
    let received;
    assert.equal(await shareResult(payload, { navigatorRef: { canShare: () => true, share: async value => { received = value; } }, windowRef: { isSecureContext: true }, FileRef: File }), 'handed-off-image');
    assert.equal(received.url, payload.url);
    assert.equal(await received.files[0].text(), 'invite');
  }
});
test('invitation construction rejects unrecognized locale, injected code and unsafe origin', () => {
  for (const overrides of [{ locale: '../manage' }, { room: { ...room, code: 'QADEMO88#manage=PRIVATE' } }, { origin: 'javascript:PRIVATE' }]) {
    assert.throws(() => challengeInvitePayload({ origin: 'https://example.com', locale: 'ja', room, ...overrides }));
  }
  const safeRoom = { code: room.code, creatorName: room.creatorName };
  Object.defineProperties(safeRoom, { answers: { get() { throw new Error('Must not read answers'); } }, participants: { get() { throw new Error('Must not read participants'); } }, manageToken: { get() { throw new Error('Must not read management token'); } } });
  assert.ok(challengeInvitePayload({ origin: 'https://example.com', locale: 'ja', room: safeRoom }).url);
});
