import { safetyFlagLabels } from './src/questions/safety.js';
import { findSimilarQuestions, sortQuestionsForOperations } from './src/questions/similarity.js';
import { downloadQuestionBackup } from './src/questions/export.js';

const tokenInput = document.getElementById('adminToken');
const otpInput = document.getElementById('adminOtp');
const dashboard = document.getElementById('dashboard');
const authStatus = document.getElementById('authStatus');
const staticQuestions = buildStaticQuestions();
const dirtyQuestionIds = new Set();
let overview = { catalog: [], submissions: [] };
let allQuestions = [];
let similarityMatches = new Map();

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
document.getElementById('saveAllQuestions').addEventListener('click', saveAllQuestions);
document.getElementById('exportQuestionsCsv').addEventListener('click', exportQuestionsCsv);

async function loadOverview() {
  try {
    if (!sessionStorage.getItem('live:admin-session') || otpInput.value.trim()) await createAdminSession();
    overview = await adminApi('/api/questions/admin/overview');
    allQuestions = sortQuestionsForOperations(mergeQuestionOverview(staticQuestions, overview.catalog));
    similarityMatches = findSimilarQuestions([
      ...allQuestions,
      ...(overview.submissions || []).filter((item) => item.status === 'pending'),
    ]);
    dirtyQuestionIds.clear();
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
  target.innerHTML = pending.length ? `
    <div class="table-wrap pending-table">
      <table class="question-table">
        <thead><tr>
          <th class="question-col">問題文</th>
          ${choiceHeaders()}
          <th class="similar-col">類似候補</th>
          <th class="action-col">審査</th>
        </tr></thead>
        <tbody>${pending.map(pendingRow).join('')}</tbody>
      </table>
    </div>
  ` : '<div class="empty">審査待ちのお題はありません。</div>';
  target.querySelectorAll('[data-approve]').forEach((button) => button.addEventListener('click', () => review(button.dataset.approve, 'approved')));
  target.querySelectorAll('[data-reject]').forEach((button) => button.addEventListener('click', () => review(button.dataset.reject, 'rejected')));
  bindComparisonButtons(target);
  bindComparisonEditors(target);
}

function pendingRow(item) {
  const matches = topMatches(item.id);
  return `
    <tr data-submission="${attr(item.id)}">
      <td>
        <textarea class="sheet-input sheet-title" data-field="title" maxlength="180">${html(item.title)}</textarea>
        <div class="meta">
          <span class="pill warning">審査待ち</span>
          <span class="pill">${item.sourceMode === 'live-challenge' ? 'LIVE版から' : '通常版から'}</span>
          ${(item.safetyFlags || []).length ? `<span class="pill critical">重点審査：${html(safetyFlagLabels(item.safetyFlags).join('・'))}</span>` : ''}
          <br>送信：${formatDate(item.submittedAt)}
        </div>
        <input data-field="reviewNote" maxlength="300" placeholder="審査メモ（非公開）">
      </td>
      ${choiceCells(item)}
      <td>${similarityCell(item.id, matches)}</td>
      <td>
        <div class="row-actions">
          <button class="button compact good" data-approve="${attr(item.id)}">採用</button>
          <button class="button compact danger" data-reject="${attr(item.id)}">却下</button>
        </div>
      </td>
    </tr>
    ${comparisonRow(item.id, item, matches)}
  `;
}

function renderAllQuestions() {
  const query = normalizeSearch(document.getElementById('questionSearch').value);
  const filter = document.getElementById('questionFilter').value;
  const filtered = allQuestions.filter((item) => {
    const searchable = normalizeSearch(`${item.id} ${item.title} ${(item.choices || []).join(' ')}`);
    const textMatches = !query || searchable.includes(query);
    const matches = similarityMatches.get(String(item.id)) || [];
    const filterMatches = filter === 'all'
      || filter === item.status
      || filter === 'similar' && matches.length
      || filter === 'custom' && item.sourceKind === 'custom' && item.status === 'approved';
    return textMatches && filterMatches;
  });
  const approvedCount = allQuestions.filter((item) => item.status === 'approved').length;
  const heldCount = allQuestions.filter((item) => item.status === 'held').length;
  const disabledCount = allQuestions.filter((item) => item.status === 'disabled').length;
  const similarCount = allQuestions.filter((item) => (similarityMatches.get(String(item.id)) || []).length).length;
  document.getElementById('questionCount').textContent = `${filtered.length}問を表示（採用${approvedCount}問／保留${heldCount}問／無効化${disabledCount}問／全${allQuestions.length}問）`;
  document.getElementById('similaritySummary').textContent = `類似候補：${similarCount}問`;
  const target = document.getElementById('allQuestions');
  target.innerHTML = filtered.length ? `
    <div class="table-wrap">
      <table class="question-table">
        <thead><tr>
          <th class="status-col">採用</th>
          <th class="status-col">保留</th>
          <th class="status-col">無効化</th>
          <th class="question-col">問題文</th>
          ${choiceHeaders()}
          <th class="similar-col">類似候補</th>
          <th class="action-col">保存</th>
        </tr></thead>
        <tbody>${filtered.map(questionRow).join('')}</tbody>
      </table>
    </div>
  ` : '<div class="empty">条件に一致するお題はありません。</div>';
  target.querySelectorAll('[data-save]').forEach((button) => button.addEventListener('click', () => saveQuestion(button.dataset.save)));
  target.querySelectorAll('input,textarea').forEach((control) => control.addEventListener('input', () => markDirty(control.closest('[data-catalog]'))));
  target.querySelectorAll('[data-status]').forEach((control) => control.addEventListener('change', () => {
    const row = control.closest('[data-catalog]');
    row.dataset.statusRow = control.value;
    markDirty(row);
  }));
  bindComparisonButtons(target);
  bindComparisonEditors(target);
  updateBulkButton();
}

function questionRow(item) {
  const id = String(item.id);
  const status = normalizeCatalogStatus(item.status);
  const matches = topMatches(id);
  return `
    <tr data-catalog="${attr(id)}" data-status-row="${status}">
      <td class="status-col"><label class="status-choice"><input type="radio" name="status-${attr(id)}" data-status value="approved" ${status === 'approved' ? 'checked' : ''}><span>採用</span></label></td>
      <td class="status-col"><label class="status-choice held"><input type="radio" name="status-${attr(id)}" data-status value="held" ${status === 'held' ? 'checked' : ''}><span>保留</span></label></td>
      <td class="status-col"><label class="status-choice disabled"><input type="radio" name="status-${attr(id)}" data-status value="disabled" ${status === 'disabled' ? 'checked' : ''}><span>無効</span></label></td>
      <td>
        <textarea class="sheet-input sheet-title" data-field="title" maxlength="180">${html(item.title)}</textarea>
        <div class="meta">
          <span class="pill ${item.sourceKind === 'custom' ? 'info' : item.sourceKind === 'candidate' ? 'warning' : ''}">${sourceKindLabel(item.sourceKind)}</span>
          <span class="pill">${html(id)}</span>
          ${item.reportCount ? `<span class="pill critical">通報${item.reportCount}件・即時非公開</span>` : ''}
        </div>
      </td>
      ${choiceCells(item)}
      <td>${similarityCell(id, matches)}</td>
      <td>
        <div class="row-actions">
          <button class="button compact" data-save="${attr(id)}">この行を保存</button>
          <span class="dirty-mark">未保存</span>
        </div>
      </td>
    </tr>
    ${comparisonRow(id, item, matches)}
  `;
}

function choiceHeaders() {
  return [1, 2, 3, 4, 5].map((number) => `<th class="choice-col">選択肢${number}</th>`).join('');
}

function choiceCells(item) {
  return (item.choices || []).slice(0, 5).map((choice, index) => `
    <td><input class="sheet-input" data-choice="${index}" maxlength="60" value="${attr(choice)}"></td>
  `).join('');
}

function similarityCell(id, matches) {
  if (!matches.length) return '<span class="meta">なし</span>';
  const first = matches[0];
  return `
    <span class="pill similar">類似候補 ${Math.round(first.score * 100)}%</span>
    <div class="meta">${html(first.title)}</div>
    <button class="button compact secondary" data-compare="${attr(id)}">並べて比較</button>
  `;
}

function comparisonRow(id, item, matches) {
  if (!matches.length) return '';
  return `
    <tr class="compare-row" data-comparison="${attr(id)}" hidden>
      <td colspan="11">
        <div class="comparison-grid">
          ${comparisonCard('この問題', item, id)}
          ${matches.map((match, index) => comparisonCard(`類似候補${index + 1}（${Math.round(match.score * 100)}%）`, match, id)).join('')}
        </div>
      </td>
    </tr>
  `;
}

function comparisonCard(label, item, comparisonId) {
  const catalogItem = allQuestions.find((question) => String(question.id) === String(item.id));
  if (!catalogItem) return readOnlyComparisonCard(label, item);
  const status = normalizeCatalogStatus(catalogItem.status);
  const radioName = `compare-status-${comparisonId}-${catalogItem.id}`;
  return `
    <div class="comparison-card" data-compare-catalog="${attr(catalogItem.id)}" data-status-row="${status}">
      <div class="comparison-card-head">
        <span class="pill similar">${label}</span>
        <span class="pill">${html(catalogItem.id)}</span>
      </div>
      <div class="comparison-status" role="group" aria-label="${attr(catalogItem.title)}の掲載状態">
        <label class="status-choice"><input type="radio" name="${attr(radioName)}" data-compare-status value="approved" ${status === 'approved' ? 'checked' : ''}><span>採用</span></label>
        <label class="status-choice held"><input type="radio" name="${attr(radioName)}" data-compare-status value="held" ${status === 'held' ? 'checked' : ''}><span>保留</span></label>
        <label class="status-choice disabled"><input type="radio" name="${attr(radioName)}" data-compare-status value="disabled" ${status === 'disabled' ? 'checked' : ''}><span>無効</span></label>
      </div>
      <label class="comparison-field">
        <span>問題文</span>
        <textarea class="sheet-input sheet-title" data-field="title" maxlength="180">${html(catalogItem.title)}</textarea>
      </label>
      <div class="comparison-choices">
        ${(catalogItem.choices || []).slice(0, 5).map((choice, index) => `
          <label class="comparison-field">
            <span>選択肢${index + 1}</span>
            <input class="sheet-input" data-choice="${index}" maxlength="60" value="${attr(choice)}">
          </label>
        `).join('')}
      </div>
      <div class="comparison-actions">
        <button class="button compact" data-compare-save="${attr(catalogItem.id)}">この問題を保存</button>
        <span class="dirty-mark">未保存</span>
      </div>
    </div>
  `;
}

function readOnlyComparisonCard(label, item) {
  return `
    <div class="comparison-card comparison-card-readonly">
      <span class="pill similar">${label}</span>
      <strong>${html(item.title)}</strong>
      <ol>${(item.choices || []).map((choice) => `<li>${html(choice)}</li>`).join('')}</ol>
      <span class="meta">審査待ちのお題は上の審査欄で編集してください。</span>
    </div>
  `;
}

function bindComparisonButtons(container) {
  container.querySelectorAll('[data-compare]').forEach((button) => button.addEventListener('click', () => {
    const comparison = container.querySelector(`[data-comparison="${CSS.escape(button.dataset.compare)}"]`);
    if (!comparison) return;
    comparison.hidden = !comparison.hidden;
    button.textContent = comparison.hidden ? '並べて比較' : '比較を閉じる';
  }));
}

function bindComparisonEditors(container) {
  container.querySelectorAll('[data-compare-catalog]').forEach((card) => {
    card.querySelectorAll('input,textarea').forEach((control) => control.addEventListener('input', () => {
      card.classList.add('dirty');
    }));
    card.querySelectorAll('[data-compare-status]').forEach((control) => control.addEventListener('change', () => {
      card.dataset.statusRow = control.value;
      card.classList.add('dirty');
    }));
  });
  container.querySelectorAll('[data-compare-save]').forEach((button) => button.addEventListener('click', () => {
    saveComparisonQuestion(button.closest('[data-compare-catalog]'));
  }));
}

function topMatches(id) {
  return (similarityMatches.get(String(id)) || []).slice(0, 3);
}

async function review(id, decision) {
  const row = document.querySelector(`[data-submission="${CSS.escape(id)}"]`);
  if (!row) return;
  if (decision === 'rejected' && !confirm('この掲載候補を却下しますか？')) return;
  if (decision === 'approved' && !confirm('編集内容を確認し、通常版・LIVE版の共通お題として採用しますか？')) return;
  try {
    const body = decision === 'approved' ? readQuestionRow(row) : {
      decision,
      reviewNote: row.querySelector('[data-field="reviewNote"]').value.trim(),
    };
    body.decision = decision;
    await adminApi(`/api/questions/admin/submissions/${id}/review`, { method: 'POST', body: JSON.stringify(body) });
    await loadOverview();
  } catch (error) {
    alert(humanError(error));
  }
}

async function saveQuestion(id, { reload = true } = {}) {
  const row = document.querySelector(`[data-catalog="${CSS.escape(id)}"]`);
  const current = allQuestions.find((item) => String(item.id) === String(id));
  if (!row || !current) return;
  const body = {
    ...readQuestionRow(row),
    sourceKind: current.sourceKind,
    sourceRef: current.sourceRef || current.id,
    status: normalizeCatalogStatus(row.querySelector('[data-status]:checked')?.value),
  };
  await adminApi(`/api/questions/admin/catalog/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) });
  dirtyQuestionIds.delete(String(id));
  if (reload) {
    showStatus(`「${body.title}」を${statusLabel(body.status)}として保存しました。`);
    await loadOverview();
  }
}

async function saveComparisonQuestion(card) {
  if (!card) return;
  const id = String(card.dataset.compareCatalog || '');
  const current = allQuestions.find((item) => String(item.id) === id);
  if (!current) return;
  const button = card.querySelector('[data-compare-save]');
  const body = {
    ...readQuestionRow(card),
    sourceKind: current.sourceKind,
    sourceRef: current.sourceRef || current.id,
    status: normalizeCatalogStatus(card.querySelector('[data-compare-status]:checked')?.value),
  };
  button.disabled = true;
  button.textContent = '保存中';
  try {
    await adminApi(`/api/questions/admin/catalog/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    showStatus(`比較欄の「${body.title}」を${statusLabel(body.status)}として保存しました。`);
    await loadOverview();
  } catch (error) {
    button.disabled = false;
    button.textContent = 'この問題を保存';
    showStatus(humanError(error), true);
  }
}

async function saveAllQuestions() {
  const ids = [...dirtyQuestionIds];
  if (!ids.length) return;
  const button = document.getElementById('saveAllQuestions');
  button.disabled = true;
  button.textContent = `保存中 0/${ids.length}`;
  try {
    for (let index = 0; index < ids.length; index += 1) {
      await saveQuestion(ids[index], { reload: false });
      button.textContent = `保存中 ${index + 1}/${ids.length}`;
    }
    showStatus(`${ids.length}問の変更を保存しました。`);
    await loadOverview();
  } catch (error) {
    showStatus(humanError(error), true);
    updateBulkButton();
  }
}

function exportQuestionsCsv() {
  if (!allQuestions.length) return;
  if (dirtyQuestionIds.size && !confirm('未保存の変更はバックアップに含まれません。保存済みの内容で続けますか？')) return;
  try {
    const result = downloadQuestionBackup(allQuestions);
    showStatus(`採用・保留・無効化を含む全${result.count}問をスプレッドシート用CSVに保存しました。`);
  } catch (error) {
    showStatus('CSVを保存できませんでした。ブラウザのダウンロード設定を確認してください。', true);
  }
}

function readQuestionRow(row) {
  return {
    title: row.querySelector('[data-field="title"]').value.trim(),
    choices: Array.from(row.querySelectorAll('[data-choice]')).map((input) => input.value.trim()),
    category: 'みんなのお題',
    reviewNote: row.querySelector('[data-field="reviewNote"]')?.value.trim() || '',
  };
}

function markDirty(row) {
  if (!row) return;
  dirtyQuestionIds.add(String(row.dataset.catalog));
  row.classList.add('dirty');
  updateBulkButton();
}

function updateBulkButton() {
  const button = document.getElementById('saveAllQuestions');
  button.disabled = dirtyQuestionIds.size === 0;
  button.textContent = dirtyQuestionIds.size ? `変更をまとめて保存（${dirtyQuestionIds.size}問）` : '変更をまとめて保存';
}

function buildStaticQuestions() {
  const common = [...(window.COMMON_QUESTION_CARDS || [])];
  const seen = new Set();
  return common.flatMap((item) => {
    const id = String(item.id);
    if (!id || seen.has(id)) return [];
    seen.add(id);
    return [{
      ...item,
      id,
      category: 'みんなのお題',
      sourceKind: 'static',
      sourceRef: id,
      sourceLabel: '標準のお題',
      status: 'approved',
    }];
  });
}

function mergeQuestionOverview(base, catalog) {
  const overrides = new Map((catalog || []).map((item) => [String(item.id), item]));
  const result = base.map((item) => {
    const override = overrides.get(String(item.id));
    return override ? { ...item, ...override, sourceLabel: '標準のお題' } : item;
  });
  const baseIds = new Set(base.map((item) => String(item.id)));
  for (const item of catalog || []) {
    if (!baseIds.has(String(item.id))) result.push({
      ...item,
      sourceLabel: item.sourceKind === 'candidate' ? '新規候補' : '採用した自作',
    });
  }
  return result;
}

function normalizeCatalogStatus(value) {
  return value === 'held' ? 'held' : value === 'disabled' ? 'disabled' : 'approved';
}

function statusLabel(value) {
  return value === 'held' ? '保留' : value === 'disabled' ? '無効化' : '採用';
}

function sourceKindLabel(value) {
  return value === 'custom' ? '採用した自作' : value === 'candidate' ? '新規100問候補' : '標準のお題';
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
    'admin-2fa-not-configured': '本番の管理者二要素認証が未設定です。',
    'question-invalid': '問題文と5つの選択肢をすべて入力してください。',
    'question-personal-information-detected': '本名・学校名・SNS ID・電話番号・住所らしい内容が含まれています。',
    'submission-already-reviewed': 'このお題はすでに審査済みです。',
  };
  return messages[error?.message] || '処理に失敗しました。入力と通信状態を確認してください。';
}

function apiError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeSearch(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('ja').trim();
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
