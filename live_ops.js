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
document.getElementById('createPayoutBatches').addEventListener('click', createPayoutBatches);
document.getElementById('purchaseSearch').addEventListener('input', () => { renderCheckouts(); renderEntitlements(); });

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
  renderMetrics(); renderCreatorInvites(); renderChannelVerifications(); renderSessions(); renderRevenue(); renderCheckouts(); renderEntitlements(); renderEvents();
}

function renderCreatorInvites() {
  const rows = overview.creatorInvites || [];
  document.getElementById('creatorInvites').innerHTML = rows.length ? rows.map((item) => `<article class="card"><strong>${escapeHtml(item.channel_name || item.channel_id)} <span class="pill ${item.status === 'active' ? 'info' : 'warning'}">${escapeHtml(item.status)}</span></strong><div class="meta">Channel ID: <code>${escapeHtml(item.channel_id)}</code><br>期限: ${formatDate(item.expires_at)} / 最終利用: ${item.last_used_at ? formatDate(item.last_used_at) : '未使用'}</div><div class="actions"><button class="button danger" data-revoke-invite="${escapeAttr(item.invite_id)}" ${item.status !== 'active' ? 'disabled' : ''}>招待を失効</button></div></article>`).join('') : empty('発行済み招待はありません。');
  document.querySelectorAll('[data-revoke-invite]').forEach((button) => button.addEventListener('click', () => revokeCreatorInvite(button.dataset.revokeInvite)));
}

function renderChannelVerifications() {
  const rows = overview.channelVerifications || [];
  document.getElementById('channelVerifications').innerHTML = rows.length ? rows.map((item) => `
    <article class="card" data-verification-card="${escapeAttr(item.verificationId)}" data-agreement-accepted="${item.creatorAgreementAccepted ? 'true' : 'false'}">
      <strong>${escapeHtml(item.channelName)} <span class="pill ${item.canSellPaid ? 'info' : item.ownershipStatus === 'rejected' ? 'critical' : 'warning'}">${item.canSellPaid ? '有料販売可' : '審査中・販売不可'}</span></strong>
      <div class="meta"><a href="${escapeAttr(item.channelUrl)}" target="_blank" rel="noopener noreferrer">チャンネルを確認</a><br>Channel ID: <code>${escapeHtml(item.channelId)}</code><br>所有確認方式: ${escapeHtml(verificationMethodLabel(item.ownershipMethod))} / 更新: ${formatDate(item.updatedAt)}<br>収益分配契約: ${item.creatorAgreementAccepted ? `規約${escapeHtml(item.creatorAgreementTermsVersion)}へ同意済み（${formatDate(item.creatorAgreementAcceptedAt)}） / 契約者：${escapeHtml(item.creatorAgreementContractingName)}` : '未同意'}</div>
      <div class="grid two">
        <div class="field"><label>チャンネル所有</label><select data-review-field="ownershipStatus"><option value="manual_pending" ${selected(item.ownershipStatus, 'manual_pending')}>手動審査待ち</option><option value="verified" ${selected(item.ownershipStatus, 'verified')}>確認済み</option><option value="rejected" ${selected(item.ownershipStatus, 'rejected')}>却下</option></select></div>
        <div class="field"><label>Stripe ConnectアカウントID</label><input data-review-field="stripeAccountId" value="${escapeAttr(item.stripeAccountId || '')}" placeholder="acct_..."></div>
        <label class="field"><span>Stripe本人確認</span><span><input data-review-field="stripeIdentityVerified" type="checkbox" style="width:auto;min-height:auto" ${item.stripeIdentityVerified ? 'checked' : ''}> Stripeで本人確認済み</span></label>
        <div class="field"><label>名義とチャンネル運営者の関係</label><select data-review-field="stripeRelationshipStatus"><option value="pending" ${selected(item.stripeRelationshipStatus, 'pending')}>審査待ち</option><option value="verified" ${selected(item.stripeRelationshipStatus, 'verified')}>関係確認済み</option><option value="rejected" ${selected(item.stripeRelationshipStatus, 'rejected')}>確認できない</option></select></div>
      </div>
      <div class="actions"><button class="button good" data-save-verification="${escapeAttr(item.verificationId)}">審査結果を保存</button></div>
    </article>
  `).join('') : empty('所有確認の申請はありません。');
  document.querySelectorAll('[data-save-verification]').forEach((button) => button.addEventListener('click', () => saveChannelVerificationReview(button.dataset.saveVerification)));
}

async function saveChannelVerificationReview(verificationId) {
  const card = document.querySelector(`[data-verification-card="${verificationId}"]`);
  const body = {
    ownershipStatus: card.querySelector('[data-review-field="ownershipStatus"]').value,
    stripeAccountId: card.querySelector('[data-review-field="stripeAccountId"]').value.trim(),
    stripeIdentityVerified: card.querySelector('[data-review-field="stripeIdentityVerified"]').checked,
    stripeRelationshipStatus: card.querySelector('[data-review-field="stripeRelationshipStatus"]').value,
  };
  const permitsPaid = card.dataset.agreementAccepted === 'true' && body.ownershipStatus === 'verified' && body.stripeIdentityVerified
    && body.stripeRelationshipStatus === 'verified' && /^acct_[A-Za-z0-9]+$/.test(body.stripeAccountId);
  const prompt = permitsPaid
    ? 'チャンネルとの関係資料とStripe本人確認を確認し、有料販売を許可しますか？'
    : '入力した審査途中の状態を保存しますか？';
  if (!confirm(prompt)) return;
  try {
    const result = await adminApi(`/api/live/admin/channel-verifications/${verificationId}/review`, { method: 'POST', body: JSON.stringify(body) });
    document.getElementById('verificationReviewOutput').innerHTML = `<div class="status">${escapeHtml(result.channelName)}：${result.canSellPaid ? '有料販売を許可しました。' : '審査状態を保存しました。有料販売は引き続き停止中です。'}</div>`;
    await loadOverview();
  } catch (error) { alert(humanError(error)); }
}

function verificationMethodLabel(value) {
  return { oauth: 'YouTube OAuth', description: '概要欄コード', manual: '手動審査' }[value] || '未確認';
}

function selected(value, expected) { return value === expected ? 'selected' : ''; }

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
    metric('監視設定', [infra.d1Configured && 'ゲームD1', infra.purchaseD1Configured && '購入D1', infra.durableObjectsConfigured && 'DO', infra.alertWebhookConfigured && '通知Webhook', infra.stripeCheckoutConfigured && 'Stripe Checkout', infra.stripeWebhookConfigured && 'Stripe Webhook'].filter(Boolean).join(' / ') || '未設定', 'コードから確認できる範囲'),
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

function renderRevenue() {
  const revenue = overview.revenue || { policy: {}, balances: [], batches: [], ledger: [] };
  const periodInput = document.getElementById('payoutPeriod');
  if (!periodInput.value && revenue.policy.defaultPeriod) periodInput.value = revenue.policy.defaultPeriod;
  const channelByAccount = new Map((overview.channelVerifications || [])
    .filter((item) => item.stripeAccountId)
    .map((item) => [item.stripeAccountId, item.channelName]));
  document.getElementById('revenueBalances').innerHTML = revenue.balances?.length ? revenue.balances.map((item) => {
    const channelName = channelByAccount.get(item.stripe_account_id) || 'チャンネル名未取得';
    const eligibility = item.review_amount > 0 ? '返金・不正審査中' : item.payout_eligible ? '月次送金対象' : '5,000円未満・翌月繰越';
    return `<article class="card"><strong>${escapeHtml(channelName)} <span class="pill ${item.payout_eligible ? 'info' : 'warning'}">${escapeHtml(eligibility)}</span></strong><div class="meta">Connect: <code>${escapeHtml(item.stripe_account_id)}</code><br>送金可能: ${yen(item.payable_amount)} / 14日保留中: ${yen(item.holding_amount)} / 返金相殺: ${yen(item.offset_amount)}<br>審査・返金確認中: ${yen(item.review_amount)} / 累計送金済み売上分: ${yen(item.transferred_amount)} / 台帳${Number(item.entry_count)}件</div></article>`;
  }).join('') : empty('売上台帳はまだありません。');
  document.getElementById('payoutBatches').innerHTML = revenue.batches?.length ? revenue.batches.map((item) => {
    const canTransfer = ['draft', 'transfer_failed'].includes(item.status);
    return `<article class="card"><strong>${escapeHtml(item.period_key)} ${yen(item.transfer_amount)} <span class="pill ${item.status === 'transferred' ? 'info' : item.status === 'transfer_failed' || item.status === 'reversed' ? 'critical' : 'warning'}">${escapeHtml(item.status)}</span></strong><div class="meta">バッチ: <code>${escapeHtml(item.batch_id)}</code><br>Connect: <code>${escapeHtml(item.stripe_account_id)}</code><br>対象売上: ${yen(item.gross_sales_amount)} / YouTuber70%: ${yen(item.creator_sales_amount)} / 返金等の相殺: ${yen(item.offset_amount)} / ${Number(item.order_count)}件${item.stripe_transfer_id ? `<br>Transfer: <code>${escapeHtml(item.stripe_transfer_id)}</code>` : ''}${item.failure_code ? `<br>失敗理由: ${escapeHtml(item.failure_code)}` : ''}</div><div class="actions"><button class="button good" data-payout-transfer="${escapeAttr(item.batch_id)}" ${canTransfer ? '' : 'disabled'}>Stripe Connectへ送金</button></div></article>`;
  }).join('') : empty('月次送金バッチはまだありません。');
  document.querySelectorAll('[data-payout-transfer]').forEach((button) => button.addEventListener('click', () => transferPayoutBatch(button.dataset.payoutTransfer)));
  document.getElementById('revenueLedger').innerHTML = revenue.ledger?.length ? revenue.ledger.map((item) => `<article class="card"><strong>${yen(item.gross_amount)} <span class="pill ${['available','transferred'].includes(item.status) ? 'info' : ['refunded','offset_due','payout_reversed'].includes(item.status) ? 'critical' : 'warning'}">${escapeHtml(item.status)}</span></strong><div class="meta">注文: <code>${escapeHtml(item.order_id)}</code> / Connect: <code>${escapeHtml(item.stripe_account_id)}</code><br>YouTuber70%: ${yen(item.creator_amount)} / 運営名目分: ${yen(item.platform_amount)} / Stripe実手数料: ${item.stripe_fee_amount === null || item.stripe_fee_amount === undefined ? '未取得' : yen(item.stripe_fee_amount)}<br>運営実残額: ${item.platform_net_amount === null || item.platform_net_amount === undefined ? '未確定' : yen(item.platform_net_amount)} / 売上確定: ${formatDate(item.paid_at)} / 保留解除: ${formatDate(item.available_at)}</div></article>`).join('') : empty('注文別売上はまだありません。');
}

async function createPayoutBatches() {
  const periodKey = document.getElementById('payoutPeriod').value;
  if (!periodKey) return alert('売上対象月を選択してください。');
  if (!confirm(`${periodKey}までの売上を締め、5,000円以上のアカウントについて分配台帳を作成しますか？この操作だけでは送金されません。`)) return;
  try {
    const result = await adminApi('/api/live/admin/revenue/monthly-close', { method: 'POST', body: JSON.stringify({ periodKey }) });
    document.getElementById('payoutOutput').innerHTML = `<div class="status">作成: ${result.created.length}件 / 繰越・保留: ${result.skipped.length}件。内容確認後に各バッチの送金ボタンを押してください。</div>`;
    await loadOverview();
  } catch (error) { alert(humanError(error)); }
}

async function transferPayoutBatch(batchId) {
  const batch = (overview.revenue?.batches || []).find((item) => item.batch_id === batchId);
  if (!batch || !confirm(`${batch.period_key}分 ${yen(batch.transfer_amount)}を${batch.stripe_account_id}へ送金しますか？Stripe上の資金移動が発生します。`)) return;
  try {
    await adminApi(`/api/live/admin/revenue/payouts/${batchId}/transfer`, { method: 'POST', body: '{}' });
    await loadOverview();
  } catch (error) { alert(humanError(error)); }
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
  document.getElementById('entitlements').innerHTML = rows.length ? rows.map((item) => `<article class="card"><strong>${escapeHtml(item.participant_name)} <span class="pill ${item.status === 'active' ? 'info' : 'warning'}">${escapeHtml(item.status)}</span></strong><div class="meta">購入ID: <code>${escapeHtml(item.purchase_id)}</code><br>Stripe: <code>${escapeHtml(item.stripe_payment_intent_id)}</code> / ルーム: ${escapeHtml(item.code)}<br>期限: ${formatDate(item.available_until)}</div><div class="actions"><button class="button good" data-reissue="${escapeAttr(item.purchase_id)}" ${item.status !== 'active' ? 'disabled' : ''}>購入権限を再発行</button></div></article>`).join('') : empty('該当する購入権限はありません。');
  document.querySelectorAll('[data-reissue]').forEach((button) => button.addEventListener('click', () => reissueEntitlement(button.dataset.reissue)));
}

function renderCheckouts() {
  if (!overview) return;
  const query = document.getElementById('purchaseSearch').value.trim().toLowerCase();
  const rows = (overview.checkouts || []).filter((item) => !query || [item.order_id, item.purchase_id, item.stripe_payment_intent_id, item.code]
    .some((value) => String(value || '').toLowerCase().includes(query)));
  document.getElementById('checkouts').innerHTML = rows.length ? rows.map((item) => {
    const canRequest = ['paid', 'fraud_review', 'refund_failed'].includes(item.status);
    const canExecute = ['refund_pending', 'refund_processing', 'refund_failed'].includes(item.status);
    const product = item.product_type === 'result_image' ? '高画質結果画像' : '応援金';
    return `<article class="card"><strong>${escapeHtml(product)} ${Number(item.amount).toLocaleString('ja-JP')}円 <span class="pill ${item.status === 'paid' ? 'info' : item.status === 'refund_failed' ? 'critical' : 'warning'}">${escapeHtml(item.status)}</span></strong><div class="meta">注文ID: <code>${escapeHtml(item.order_id)}</code><br>購入者: ${escapeHtml(item.participant_name)} / ルーム: ${escapeHtml(item.code)}<br>PaymentIntent: <code>${escapeHtml(item.stripe_payment_intent_id || '未確定')}</code><br>YouTuber分配予定: ${Number(item.creator_amount).toLocaleString('ja-JP')}円 / 運営名目分: ${Number(item.platform_amount).toLocaleString('ja-JP')}円${item.stripe_refund_id ? `<br>Refund: <code>${escapeHtml(item.stripe_refund_id)}</code>` : ''}</div><div class="actions"><button class="button danger" data-checkout-refund="${escapeAttr(item.order_id)}" data-execute="false" ${canRequest ? '' : 'disabled'}>権限停止・返金待ち</button><button class="button secondary" data-checkout-refund="${escapeAttr(item.order_id)}" data-execute="true" ${canExecute ? '' : 'disabled'}>Stripeへ全額返金</button></div></article>`;
  }).join('') : empty('該当するCheckout注文はありません。');
  document.querySelectorAll('[data-checkout-refund]').forEach((button) => button.addEventListener('click', () => refundCheckout(button.dataset.checkoutRefund, button.dataset.execute === 'true')));
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

async function refundCheckout(orderId, execute) {
  if (!confirm(execute ? 'Stripe APIでこの注文を全額返金しますか？元の支払方法へ返金されます。' : '購入権限を即時停止し、YouTuber分配を保留して返金待ちにしますか？')) return;
  try { await adminApi(`/api/live/admin/checkouts/${orderId}/refund`, { method: 'POST', body: JSON.stringify({ execute }) }); await loadOverview(); } catch (error) { alert(humanError(error)); }
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
function formatDate(value) { if (value === null || value === undefined || value === '' || Number(value) <= 0) return '未設定'; const date = new Date(Number(value)); return Number.isNaN(date.getTime()) ? '未設定' : date.toLocaleString('ja-JP'); }
function yen(value) { return `${Number(value || 0).toLocaleString('ja-JP')}円`; }
function showStatus(text, error = false) { authStatus.hidden = false; authStatus.className = `status${error ? ' error' : ''}`; authStatus.textContent = text; }
function humanError(error) {
  const messages = {
    'admin-forbidden': '管理トークンが正しくありません。',
    'admin-otp-invalid': '6桁の認証コードが正しくないか、有効時間を過ぎています。認証アプリの最新コードを入力してください。',
    'admin-2fa-not-configured': '本番の管理者二要素認証secretが未設定です。運用手順書に従って3つのsecretを設定してください。',
    'admin-session-required': '管理セッションがありません。管理トークンと認証コードでログインしてください。',
    'admin-session-invalid': '管理セッションを確認できません。もう一度二要素認証してください。',
    'admin-session-expired': '15分間の管理セッションが終了しました。最新の認証コードでもう一度ログインしてください。',
    'stripe-account-required': 'Stripe本人確認・名義関係を確認済みにする場合は、acct_から始まるConnectアカウントIDが必要です。',
    'invalid-ownership-status': 'チャンネル所有の審査状態が不正です。',
    'invalid-stripe-relationship-status': 'Stripe名義関係の審査状態が不正です。',
    'checkout-not-found': '対象のCheckout注文が見つかりません。',
    'checkout-not-refundable': 'この注文は返金待ちへ変更できる状態ではありません。',
    'refund-request-required': '先に権限停止・返金待ちへ変更してください。',
    'stripe-payment-intent-missing': 'Stripe PaymentIntentが未確定のため返金できません。',
    'stripe-secret-key-not-configured': 'STRIPE_SECRET_KEYが未設定です。',
    'stripe-api-request-failed': 'Stripe APIで返金処理に失敗しました。Stripe DashboardとWorker Logsを確認してください。',
    'invalid-payout-period': '売上対象月を選び直してください。',
    'payout-period-still-on-hold': 'この対象月はまだ14日間の返金保留期間を終えていません。翌月15日以降に締めてください。',
    'payout-batch-not-found': '月次分配バッチが見つかりません。',
    'payout-batch-not-transferable': 'このバッチは送金できる状態ではありません。画面を再読み込みしてください。',
    'payout-batch-ledger-mismatch': '分配明細の合計と送金額が一致しません。送金せず、売上台帳を確認してください。',
    'payout-below-threshold': '分配額が5,000円未満のため送金できません。',
    'stripe-transfer-destination-invalid': 'Stripe ConnectアカウントIDを確認してください。',
    'stripe-transfer-response-invalid': 'Stripeから送金結果を確認できませんでした。Stripe Dashboardを確認してください。',
  };
  return messages[error?.message] || error?.message || '処理に失敗しました。';
}
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function escapeAttr(value) { return escapeHtml(value); }
