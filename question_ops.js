const tokenInput = document.getElementById('adminToken');
const otpInput = document.getElementById('adminOtp');
const dashboard = document.getElementById('dashboard');
const authStatus = document.getElementById('authStatus');
const staticQuestions = buildStaticQuestions();
let overview = { catalog: [], submissions: [] };
let allQuestions = [];

sessionStorage.removeItem('live:admin-token');
tokenInput.value = '';
document.getElementById('loadQuestions').addEventListener('click', loadOverview);
document.getElementById('forgetSession').addEventListener('click', () => {
  sessionStorage.removeItem('live:admin-session');
  tokenInput.value = '';
  otpInput.value = '';
  dashboard.hidden = true;
  showStatus('管理セッションを消しました。');
});
document.getElementById('questionSearch').addEventListener('input', renderAllQuestions);
document.getElementById('questionFilter').addEventListener('change', renderAllQuestions);

async function loadOverview() {
  try {
    if (!sessionStorage.getItem('live:admin-session') || otpInput.value.trim()) await createAdminSession();
    overview = await adminApi('/api/questions/admin/overview');
    allQuestions = mergeQuestionOverview(staticQuestions, overview.catalog);
    dashboard.hidden = false;
    renderPending();
    renderAllQuestions();
  } catch (error) {
    dashboard.hidden = true;
    showStatus(humanError(error), true);
  }
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
  if (!response.ok) throw apiError(data.error || 'request-failed', response.status);
  sessionStorage.setItem('live:admin-session', data.sessionToken);
  tokenInput.value = '';
  otpInput.value = '';
  showStatus(`二要素認証に成功しました。管理セッション有効期限：${formatDate(data.expiresAt)}`);
}

function renderPending() {
  const pending = (overview.submissions || []).filter((item) => item.status === 'pending');
  const target = document.getElementById('pendingSubmissions');
  target.innerHTML = pending.length ? pending.map((item) => `
    <article class="card pending" data-submission="${attr(item.id)}">
      <span class="pill warning">審査待ち</span><span class="pill">${item.sourceMode === 'live-challenge' ? 'ライブ配信から' : 'みんなに挑戦から'}</span>
      <div class="meta">送信：${formatDate(item.submittedAt)}${item.sourceQuestionId ? ` / 編集元：${html(item.sourceQuestionId)}` : ' / 完全な自作'}</div>
      ${questionFields(item)}
      <div class="checks">
        ${check('useChallenge', 'みんなに挑戦', true)}
        ${check('useLive', 'ライブ配信', true)}
        ${check('targetFriend', '友達向け', true)}
        ${check('targetFamily', '家族向け', true)}
      </div>
      <div class="field"><label>カテゴリ</label><input data-field="category" maxlength="60" value="みんなのお題"></div>
      <div class="field"><label>審査メモ（利用者には非公開）</label><input data-field="reviewNote" maxlength="300"></div>
      <div class="actions"><button class="button good" data-approve="${attr(item.id)}">編集内容で承認</button><button class="button danger" data-reject="${attr(item.id)}">却下</button></div>
    </article>
  `).join('') : '<div class="empty">審査待ちのお題はありません。</div>';
  target.querySelectorAll('[data-approve]').forEach((button) => button.addEventListener('click', () => review(button.dataset.approve, 'approved')));
  target.querySelectorAll('[data-reject]').forEach((button) => button.addEventListener('click', () => review(button.dataset.reject, 'rejected')));
}

function renderAllQuestions() {
  const query = document.getElementById('questionSearch').value.normalize('NFKC').toLowerCase().trim();
  const filter = document.getElementById('questionFilter').value;
  const filtered = allQuestions.filter((item) => {
    const textMatches = !query || `${item.id} ${item.title} ${item.category}`.normalize('NFKC').toLowerCase().includes(query);
    const filterMatches = filter === 'all'
      || filter === 'challenge' && item.useChallenge
      || filter === 'live' && item.useLive
      || filter === 'friend' && item.targetFriend
      || filter === 'family' && item.targetFamily
      || filter === 'custom' && item.sourceKind === 'custom';
    return textMatches && filterMatches;
  });
  document.getElementById('questionCount').textContent = `${filtered.length}問を表示（全${allQuestions.length}問）`;
  const target = document.getElementById('allQuestions');
  target.innerHTML = filtered.length ? filtered.map((item) => `
    <article class="card" data-catalog="${attr(item.id)}">
      <span class="pill ${item.sourceKind === 'custom' ? 'info' : ''}">${item.sourceKind === 'custom' ? '承認済み自作' : html(item.sourceLabel)}</span>
      <span class="pill">${html(item.id)}</span>
      ${questionFields(item)}
      <div class="field"><label>カテゴリ</label><input data-field="category" maxlength="60" value="${attr(item.category)}"></div>
      <div class="checks">
        ${check('useChallenge', 'みんなに挑戦', item.useChallenge)}
        ${check('useLive', 'ライブ配信', item.useLive)}
        ${check('targetFriend', '友達向け', item.targetFriend)}
        ${check('targetFamily', '家族向け', item.targetFamily)}
        ${check('disabled', '無効化', item.status === 'disabled')}
      </div>
      <div class="actions"><button class="button" data-save="${attr(item.id)}">編集・掲載先を保存</button></div>
    </article>
  `).join('') : '<div class="empty">条件に一致するお題はありません。</div>';
  target.querySelectorAll('[data-save]').forEach((button) => button.addEventListener('click', () => saveQuestion(button.dataset.save)));
}

function questionFields(item) {
  return `
    <div class="field"><label>問題文</label><textarea data-field="title" maxlength="180">${html(item.title)}</textarea></div>
    <div class="choices-edit">${item.choices.map((choice, index) => `<div class="field"><label>選択肢${index + 1}</label><input data-choice="${index}" maxlength="60" value="${attr(choice)}"></div>`).join('')}</div>
  `;
}

function check(field, label, checked) {
  return `<label class="check"><input type="checkbox" data-field="${field}" ${checked ? 'checked' : ''}><span>${label}</span></label>`;
}

async function review(id, decision) {
  const card = document.querySelector(`[data-submission="${CSS.escape(id)}"]`);
  if (!card) return;
  if (decision === 'rejected' && !confirm('この掲載候補を却下しますか？')) return;
  if (decision === 'approved' && !confirm('編集内容と掲載先を確認し、共通お題ライブラリへ追加しますか？')) return;
  try {
    const body = decision === 'approved' ? readCard(card) : {
      decision,
      reviewNote: card.querySelector('[data-field="reviewNote"]').value.trim(),
    };
    body.decision = decision;
    await adminApi(`/api/questions/admin/submissions/${id}/review`, { method: 'POST', body: JSON.stringify(body) });
    await loadOverview();
  } catch (error) {
    alert(humanError(error));
  }
}

async function saveQuestion(id) {
  const card = document.querySelector(`[data-catalog="${CSS.escape(id)}"]`);
  const current = allQuestions.find((item) => String(item.id) === String(id));
  if (!card || !current) return;
  try {
    const body = {
      ...readCard(card),
      sourceKind: current.sourceKind,
      sourceRef: current.sourceRef || current.id,
      status: card.querySelector('[data-field="disabled"]').checked ? 'disabled' : 'approved',
    };
    await adminApi(`/api/questions/admin/catalog/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) });
    showStatus(`「${body.title}」の編集内容と掲載先を保存しました。`);
    await loadOverview();
  } catch (error) {
    alert(humanError(error));
  }
}

function readCard(card) {
  return {
    title: card.querySelector('[data-field="title"]').value.trim(),
    choices: Array.from(card.querySelectorAll('[data-choice]')).map((input) => input.value.trim()),
    category: card.querySelector('[data-field="category"]')?.value.trim() || 'みんなのお題',
    reviewNote: card.querySelector('[data-field="reviewNote"]')?.value.trim() || '',
    useChallenge: card.querySelector('[data-field="useChallenge"]')?.checked === true,
    useLive: card.querySelector('[data-field="useLive"]')?.checked === true,
    targetFriend: card.querySelector('[data-field="targetFriend"]')?.checked === true,
    targetFamily: card.querySelector('[data-field="targetFamily"]')?.checked === true,
  };
}

function buildStaticQuestions() {
  const love = (window.ALL_CARDS || []).map((item) => ({
    ...item,
    id: `LOVE${item.id}`,
    category: '共通のお題',
    sourceKind: 'static',
    sourceRef: `LOVE${item.id}`,
    sourceLabel: '共通のお題',
    useChallenge: true,
    useLive: true,
    targetFriend: false,
    targetFamily: false,
    status: 'approved',
  }));
  const friend = (window.FRIEND_CARDS || []).map((item) => ({
    ...item, sourceKind: 'static', sourceRef: item.id, sourceLabel: '友達向け',
    useChallenge: true, useLive: true, targetFriend: true, targetFamily: false, status: 'approved',
  }));
  const family = (window.FAMILY_CARDS || []).map((item) => ({
    ...item, sourceKind: 'static', sourceRef: item.id, sourceLabel: '家族向け',
    useChallenge: true, useLive: true, targetFriend: false, targetFamily: true, status: 'approved',
  }));
  return [...love, ...friend, ...family];
}

function mergeQuestionOverview(base, catalog) {
  const overrides = new Map((catalog || []).map((item) => [String(item.id), item]));
  const result = base.map((item) => {
    const override = overrides.get(String(item.id));
    return override ? { ...item, ...override, sourceLabel: item.sourceLabel } : item;
  });
  const baseIds = new Set(base.map((item) => String(item.id)));
  for (const item of catalog || []) {
    if (!baseIds.has(String(item.id))) result.push({ ...item, sourceLabel: '承認済み自作' });
  }
  return result;
}

async function adminApi(path, options = {}) {
  const session = sessionStorage.getItem('live:admin-session') || '';
  const headers = new Headers(options.headers || {});
  headers.set('x-live-admin-session', session);
  if (options.body) headers.set('content-type', 'application/json');
  const response = await fetch(path, { ...options, headers, cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw apiError(data.error || 'request-failed', response.status);
  return data;
}

function showStatus(message, isError = false) {
  authStatus.hidden = false;
  authStatus.textContent = message;
  authStatus.classList.toggle('error', isError);
}

function humanError(error) {
  const messages = {
    'admin-forbidden': '管理トークンが違います。',
    'admin-otp-invalid': '6桁の認証コードが違うか、有効時間を過ぎています。',
    'admin-session-required': '管理者認証を行ってください。',
    'admin-session-expired': '15分の管理セッションが切れました。もう一度認証してください。',
    'admin-2fa-not-configured': '本番の管理者二要素認証が未設定です。CloudflareへLIVE_ADMIN_TOKEN・LIVE_ADMIN_TOTP_SECRET・LIVE_ADMIN_SESSION_SECRETを設定してください。',
    'question-invalid': '問題文と5つの選択肢をすべて入力してください。',
    'submission-already-reviewed': 'このお題はすでに審査済みです。',
  };
  return messages[error?.message] || '処理に失敗しました。入力と通信状態を確認してください。';
}

function apiError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function formatDate(value) {
  return value ? new Date(Number(value)).toLocaleString('ja-JP') : '未設定';
}

function html(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[character]));
}

function attr(value) {
  return html(value);
}
