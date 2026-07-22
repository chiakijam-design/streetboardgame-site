const tokenInput = document.getElementById('adminToken');
const otpInput = document.getElementById('adminOtp');
const dashboard = document.getElementById('dashboard');
const authStatus = document.getElementById('authStatus');
let overview = null;

tokenInput.value = sessionStorage.getItem('live:admin-token') || '';
document.getElementById('loadOps').addEventListener('click', loadOverview);
document.getElementById('forgetToken').addEventListener('click', () => {
  sessionStorage.removeItem('live:admin-token'); sessionStorage.removeItem('live:admin-session');
  tokenInput.value = ''; otpInput.value = ''; dashboard.hidden = true; showStatus('管理トークンと管理セッションを消しました。');
});
document.getElementById('saveStatus').addEventListener('click', saveStatus);
document.getElementById('issueInvite').addEventListener('click', issueCreatorInvite);
document.getElementById('purchaseSearch').addEventListener('input', renderEntitlements);

async function loadOverview() {
  try {
    sessionStorage.setItem('live:admin-token', tokenInput.value.trim());
    if (!sessionStorage.getItem('live:admin-session') || otpInput.value.trim()) await createAdminSession();
    overview = await adminApi('/api/live/admin/overview');
    dashboard.hidden = false; renderAll();
  } catch (error) { dashboard.hidden = true; showStatus(humanError(error), true); }
}

async function createAdminSession() {
  const response = await fetch('/api/live/admin/session', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-live-admin-token': tokenInput.value.trim(),
      'x-live-admin-otp': otpInput.value.trim(),
    },
    body: '{}',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'request-failed');
    error.status = response.status;
    throw error;
  }
  sessionStorage.setItem('live:admin-session', data.sessionToken);
  otpInput.value = '';
  showStatus(`二要素認証に成功しました。管理セッション有効期限：${formatDate(data.expiresAt)}`);
}

function renderAll() {
  const status = overview.status || {};
  document.getElementById('statusMode').value = status.mode || 'normal';
  document.getElementById('statusTitle').value = status.title || '';
  document.getElementById('statusMessage').value = status.message || '';
  renderMetrics(); renderCreatorInvites(); renderSessions(); renderEntitlements(); renderEvents();
}

function renderCreatorInvites() {
  const rows = overview.creatorInvites || [];
  document.getElementById('creatorInvites').innerHTML = rows.length ? rows.map((item) => `<article class="card"><strong>${escapeHtml(item.channel_name || item.channel_id)} <span class="pill ${item.status === 'active' ? 'info' : 'warning'}">${escapeHtml(item.status)}</span></strong><div class="meta">Channel ID: <code>${escapeHtml(item.channel_id)}</code><br>期限: ${formatDate(item.expires_at)} / 最終利用: ${item.last_used_at ? formatDate(item.last_used_at) : '未使用'}</div><div class="actions"><button class="button danger" data-revoke-invite="${escapeAttr(item.invite_id)}" ${item.status !== 'active' ? 'disabled' : ''}>招待を失効</button></div></article>`).join('') : empty('発行済み招待はありません。');
  document.querySelectorAll('[data-revoke-invite]').forEach((button) => button.addEventListener('click', () => revokeCreatorInvite(button.dataset.revokeInvite)));
}

function renderMetrics() {
  const counts = overview.recentEventCounts || [];
  const critical = counts.filter((x) => x.severity === 'critical').reduce((n, x) => n + Number(x.event_count || 0), 0);
  const stripe = counts.filter((x) => x.category === 'stripe').reduce((n, x) => n + Number(x.event_count || 0), 0);
  const ws = overview.realtime || [];
  const unexpected = ws.reduce((n, x) => n + Number(x.unexpectedDisconnects || 0), 0);
  const disconnected = ws.reduce((n, x) => n + Number(x.disconnected || 0), 0);
  const wsRate = disconnected ? Math.round(unexpected / disconnected * 1000) / 10 : 0;
  const infra = overview.infrastructure || {};
  document.getElementById('metrics').innerHTML = [
    metric('重大APIエラー', critical, '直近15分'), metric('Stripe関連イベント', stripe, '直近15分'),
    metric('WebSocket予期せぬ切断率', `${wsRate}%`, `${unexpected}/${disconnected}切断`),
    metric('監視設定', [infra.d1Configured && 'ゲームD1', infra.purchaseD1Configured && '購入D1', infra.durableObjectsConfigured && 'DO', infra.alertWebhookConfigured && '通知Webhook', infra.stripeWebhookConfigured && 'Stripe Webhook'].filter(Boolean).join(' / ') || '未設定', 'コードから確認できる範囲'),
  ].join('');
}

function renderSessions() {
  const activeCodes = new Set((overview.activeSessions || []).map((x) => x.code));
  const all = [...(overview.activeSessions || []), ...(overview.reservations || []).filter((x) => !activeCodes.has(x.code))];
  document.getElementById('sessions').innerHTML = all.length ? all.map((item) => `<article class="card"><strong>${escapeHtml(item.title || item.channelName || 'タイトル未取得')} <span class="pill">${escapeHtml(item.code)}</span></strong><div class="meta">状態: ${escapeHtml(item.phase)} / ${activeCodes.has(item.code) ? '稼働中' : '予約'}<br>配信予定: ${formatDate(item.scheduledAt)} / 参加上限: ${Number(item.participantLimit || 0).toLocaleString('ja-JP')}人<br>画像審査: ${escapeHtml(item.creatorImageModerationStatus || 'none')}</div><div class="actions"><button class="button danger" data-terminate="${item.code}">強制終了</button><button class="button secondary" data-rotate="${item.code}" data-target="host">スタッフURL失効・再発行</button><button class="button secondary" data-rotate="${item.code}" data-target="subject">本人URL失効・再発行</button>${item.creatorImageModerationStatus === 'pending' ? `<button class="button good" data-image-review="${item.code}" data-decision="approved">画像を承認</button><button class="button danger" data-image-review="${item.code}" data-decision="rejected">画像を却下・削除</button>` : ''}</div></article>`).join('') : empty('稼働中・予約中のLIVEはありません。');
  document.querySelectorAll('[data-terminate]').forEach((button) => button.addEventListener('click', () => terminateGame(button.dataset.terminate)));
  document.querySelectorAll('[data-rotate]').forEach((button) => button.addEventListener('click', () => rotateLinks(button.dataset.rotate, button.dataset.target)));
  document.querySelectorAll('[data-image-review]').forEach((button) => button.addEventListener('click', () => reviewCreatorImage(button.dataset.imageReview, button.dataset.decision)));
}

async function issueCreatorInvite() {
  const channelUrl = document.getElementById('inviteChannelUrl').value.trim();
  const reviewed = document.getElementById('inviteReviewed').checked;
  if (!reviewed || !channelUrl) return alert('チャンネルURLを入力し、手動審査済みにチェックしてください。');
  if (!confirm('このチャンネルは招待条件を手動確認済みですか？')) return;
  try {
    const data = await adminApi('/api/live/admin/creator-invites', { method: 'POST', body: JSON.stringify({ channelUrl, reviewed }) });
    document.getElementById('inviteOutput').innerHTML = `<div class="secret-output"><strong>招待コード（今回だけ表示）</strong><br><code>${escapeHtml(data.invite.inviteToken)}</code><div class="actions"><button class="button" id="copyInviteToken">コピー</button></div><p class="help">安全な連絡手段で審査対象のスタッフだけに渡してください。</p></div>`;
    document.getElementById('copyInviteToken').addEventListener('click', () => navigator.clipboard.writeText(data.invite.inviteToken));
    document.getElementById('inviteReviewed').checked = false;
    await loadOverview();
  } catch (error) { alert(humanError(error)); }
}

async function revokeCreatorInvite(inviteId) {
  if (!confirm('この招待を直ちに失効しますか？対象企画のスタッフ操作も停止します。')) return;
  try { await adminApi(`/api/live/admin/creator-invites/${inviteId}/revoke`, { method: 'POST', body: '{}' }); await loadOverview(); } catch (error) { alert(humanError(error)); }
}

async function reviewCreatorImage(code, decision) {
  if (!confirm(decision === 'approved' ? '画像の権利・内容を確認し、公開利用を承認しますか？' : '画像を却下し、非公開ストレージから削除しますか？')) return;
  try { await adminApi(`/api/live/admin/games/${code}/creator-image-review`, { method: 'POST', body: JSON.stringify({ decision }) }); await loadOverview(); } catch (error) { alert(humanError(error)); }
}

function renderEntitlements() {
  if (!overview) return;
  const query = document.getElementById('purchaseSearch').value.trim().toLowerCase();
  const rows = (overview.entitlements || []).filter((x) => !query || [x.purchase_id, x.stripe_payment_intent_id, x.code].some((v) => String(v).toLowerCase().includes(query)));
  document.getElementById('entitlements').innerHTML = rows.length ? rows.map((item) => `<article class="card"><strong>${escapeHtml(item.participant_name)} <span class="pill ${item.status === 'active' ? 'info' : 'warning'}">${escapeHtml(item.status)}</span></strong><div class="meta">購入ID: <code>${escapeHtml(item.purchase_id)}</code><br>Stripe: <code>${escapeHtml(item.stripe_payment_intent_id)}</code> / ルーム: ${escapeHtml(item.code)}<br>期限: ${formatDate(item.available_until)}</div><div class="actions"><button class="button good" data-reissue="${escapeAttr(item.purchase_id)}" ${['refund_pending','refunded'].includes(item.status) ? 'disabled' : ''}>購入権限を再発行</button><button class="button danger" data-refund="${escapeAttr(item.purchase_id)}" data-confirmed="false" ${item.status === 'refunded' ? 'disabled' : ''}>権限停止・返金待ち</button><button class="button secondary" data-refund="${escapeAttr(item.purchase_id)}" data-confirmed="true">Stripe返金完了</button></div></article>`).join('') : empty('該当する購入権限はありません。');
  document.querySelectorAll('[data-reissue]').forEach((button) => button.addEventListener('click', () => reissueEntitlement(button.dataset.reissue)));
  document.querySelectorAll('[data-refund]').forEach((button) => button.addEventListener('click', () => refundEntitlement(button.dataset.refund, button.dataset.confirmed === 'true')));
}

function renderEvents() {
  const events = overview.events || [];
  document.getElementById('events').innerHTML = events.length ? events.map((item) => `<article class="card"><strong><span class="pill ${escapeAttr(item.severity)}">${escapeHtml(item.severity)}</span>${escapeHtml(item.event_type)}</strong><div class="meta">${formatDate(item.created_at)} / ${escapeHtml(item.category)} ${item.code ? `/ room ${escapeHtml(item.code)}` : ''}<br>${escapeHtml(item.message)}</div>${item.acknowledged_at ? `<span class="pill info">確認済み ${formatDate(item.acknowledged_at)}</span>` : `<div class="actions"><button class="button secondary" data-ack="${escapeAttr(item.event_id)}">確認済みにする</button></div>`}</article>`).join('') : empty('監視イベントはありません。');
  document.querySelectorAll('[data-ack]').forEach((button) => button.addEventListener('click', () => acknowledgeEvent(button.dataset.ack)));
}

async function saveStatus() {
  try {
    const status = await adminApi('/api/live/admin/status', { method: 'POST', body: JSON.stringify({ mode: document.getElementById('statusMode').value, title: document.getElementById('statusTitle').value, message: document.getElementById('statusMessage').value }) });
    overview.status = status.status; await loadOverview();
  } catch (error) { alert(humanError(error)); }
}

async function terminateGame(code) {
  const message = prompt('利用者に表示する終了理由を入力してください。', '運営上の理由により、このLIVEは終了しました。');
  if (message === null || !confirm(`ルーム ${code} を強制終了します。元に戻せません。`)) return;
  try { await adminApi(`/api/live/admin/games/${code}/terminate`, { method: 'POST', body: JSON.stringify({ message }) }); await loadOverview(); } catch (error) { alert(humanError(error)); }
}

async function rotateLinks(code, target) {
  if (!confirm(`ルーム ${code} の${target === 'host' ? 'スタッフ' : '本人'}URLを直ちに失効します。`)) return;
  try {
    const data = await adminApi(`/api/live/admin/games/${code}/rotate-links`, { method: 'POST', body: JSON.stringify({ host: target === 'host', subject: target === 'subject' }) });
    const url = target === 'host' ? data.hostUrl : data.subjectUrl;
    document.getElementById('privateLinkOutput').innerHTML = `<div class="secret-output"><strong>新しい${target === 'host' ? 'スタッフ' : '本人'}URL（今回だけ表示）</strong><br><a href="${escapeAttr(url)}">${escapeHtml(url)}</a><div class="actions"><button class="button" id="copyPrivateUrl">コピー</button></div></div>`;
    document.getElementById('copyPrivateUrl').addEventListener('click', () => navigator.clipboard.writeText(url));
    await loadOverview();
  } catch (error) { alert(humanError(error)); }
}

async function refundEntitlement(purchaseId, confirmed) {
  if (!confirm(confirmed ? 'Stripe Dashboardで返金済みであることを確認しましたか？' : '購入権限を即時停止して返金待ちにしますか？')) return;
  try { await adminApi(`/api/live/admin/result-entitlements/${purchaseId}/refund`, { method: 'POST', body: JSON.stringify({ confirmed }) }); await loadOverview(); } catch (error) { alert(humanError(error)); }
}

async function reissueEntitlement(purchaseId) {
  if (!confirm('旧ダウンロードURLを失効し、新しい30日間の権限を発行しますか？')) return;
  try {
    const data = await adminApi(`/api/live/admin/result-entitlements/${purchaseId}/reissue`, { method: 'POST', body: '{}' });
    document.getElementById('entitlementOutput').innerHTML = `<div class="secret-output"><strong>再発行URL（今回だけ表示）</strong><br><a href="${escapeAttr(data.entitlementUrl)}">${escapeHtml(data.entitlementUrl)}</a><div class="actions"><button class="button" id="copyEntitlementUrl">コピー</button></div></div>`;
    document.getElementById('copyEntitlementUrl').addEventListener('click', () => navigator.clipboard.writeText(data.entitlementUrl));
    await loadOverview();
  } catch (error) { alert(humanError(error)); }
}

async function acknowledgeEvent(eventId) { try { await adminApi(`/api/live/admin/ops-events/${eventId}/acknowledge`, { method: 'POST', body: '{}' }); await loadOverview(); } catch (error) { alert(humanError(error)); } }
async function adminApi(path, options = {}) { const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', 'x-live-admin-session': sessionStorage.getItem('live:admin-session') || '', ...(options.headers || {}) } }); const data = await response.json().catch(() => ({})); if (!response.ok) { const error = new Error(data.error || 'request-failed'); error.status = response.status; throw error; } return data; }
function metric(label, value, note) { return `<div class="metric"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b><small>${escapeHtml(note)}</small></div>`; }
function empty(text) { return `<div class="empty">${escapeHtml(text)}</div>`; }
function formatDate(value) { const date = new Date(Number(value)); return Number.isNaN(date.getTime()) ? '未設定' : date.toLocaleString('ja-JP'); }
function showStatus(text, error = false) { authStatus.hidden = false; authStatus.className = `status${error ? ' error' : ''}`; authStatus.textContent = text; }
function humanError(error) {
  const messages = {
    'admin-forbidden': '管理トークンが正しくありません。',
    'admin-otp-invalid': '6桁の認証コードが正しくないか、有効時間を過ぎています。認証アプリの最新コードを入力してください。',
    'admin-2fa-not-configured': '本番の管理者二要素認証secretが未設定です。運用手順書に従って3つのsecretを設定してください。',
    'admin-session-required': '管理セッションがありません。管理トークンと認証コードでログインしてください。',
    'admin-session-invalid': '管理セッションを確認できません。もう一度二要素認証してください。',
    'admin-session-expired': '15分間の管理セッションが終了しました。最新の認証コードでもう一度ログインしてください。',
  };
  return messages[error?.message] || error?.message || '処理に失敗しました。';
}
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function escapeAttr(value) { return escapeHtml(value); }
