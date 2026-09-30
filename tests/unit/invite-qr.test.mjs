import assert from 'node:assert/strict';
import test from 'node:test';

async function setup(label) {
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  const scripts = [];
  const calls = [];
  const api = { toCanvas: async (...args) => { calls.push(args); } };
  globalThis.window = {};
  globalThis.document = {
    querySelector: () => ({ src: 'https://example.test/dist/qr-code-HASH.js', nonce: 'allowed-nonce' }),
    createElement: () => ({ remove() { this.removed = true; } }),
    head: { appendChild(script) { scripts.push(script); } },
  };
  const { renderLiveInviteQr } = await import(`../../src/live/invite-qr.js?test=${label}`);
  return {
    scripts, calls, renderLiveInviteQr,
    loaded() { window.WatachanLiveQrCode = api; scripts.at(-1).onload(); },
    restore() { globalThis.window = oldWindow; globalThis.document = oldDocument; },
  };
}

test('QRコードは必要時だけ一度取得し、同時描画要求とCSP nonceを保つ', async () => {
  const context = await setup('dedupe');
  try {
    assert.equal(context.scripts.length, 0);
    const canvas = { isConnected: true };
    const first = context.renderLiveInviteQr(canvas, '/live-challenge?room=123456');
    const second = context.renderLiveInviteQr(canvas, '/live-challenge?room=654321');
    assert.equal(context.scripts.length, 1);
    assert.equal(context.scripts[0].nonce, 'allowed-nonce');
    context.loaded();
    await Promise.all([first, second]);
    assert.equal(context.calls.length, 2);
    assert.deepEqual(context.calls[0][2], { width: 188, margin: 1, errorCorrectionLevel: 'M' });
  } finally { context.restore(); }
});

test('QRコードの取得失敗後は次回描画で再試行できる', async () => {
  const context = await setup('retry');
  try {
    const canvas = { isConnected: true };
    const first = context.renderLiveInviteQr(canvas, '/join');
    context.scripts[0].onerror();
    await assert.rejects(first, /qr-code-load-failed/);
    assert.equal(context.scripts[0].removed, true);
    const second = context.renderLiveInviteQr(canvas, '/join');
    assert.equal(context.scripts.length, 2);
    context.loaded();
    await second;
    assert.equal(context.calls.length, 1);
  } finally { context.restore(); }
});

test('取得待ちの間に置換された招待canvasには描画しない', async () => {
  const context = await setup('detached');
  try {
    const canvas = { isConnected: true };
    const ready = context.renderLiveInviteQr(canvas, '/join');
    canvas.isConnected = false;
    context.loaded();
    await ready;
    assert.equal(context.calls.length, 0);
  } finally { context.restore(); }
});
