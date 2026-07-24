import QRCode from 'qrcode';
import { mergeChallengeCards, pickChallengeCards, prepareLoveChallengeCards } from './src/challenge/data.js';
import { LIVE_POLL_INTERVAL_MS } from './src/live/config.js';
import {
  changedQuestionCandidates,
  loadManagedQuestionCards,
  submitQuestionCandidates,
} from './src/questions/catalog.js';

const QUESTION_COUNT = 10;
const app = document.getElementById('live-challenge-app');
let allCards = mergeChallengeCards(
  window.FRIEND_CARDS,
  window.FAMILY_CARDS,
  prepareLoveChallengeCards(window.ALL_CARDS),
);
const url = new URL(location.href);
const initialCode = (url.searchParams.get('room') || '').replace(/\D/g, '').slice(0, 6);
const initialHostToken = new URLSearchParams(location.hash.slice(1)).get('host') || '';
const savedParticipant = initialCode ? readSession(`live-challenge:${initialCode}`) : null;

let state = {
  view: initialHostToken ? 'host' : initialCode ? (savedParticipant?.token ? 'viewer' : 'join') : 'landing',
  code: initialCode,
  hostToken: initialHostToken,
  subjectToken: '',
  participantToken: savedParticipant?.token || '',
  participantName: savedParticipant?.name || '',
  questions: pickChallengeCards(allCards, QUESTION_COUNT).map(toDraftQuestion),
  game: null,
  hostAnswers: {},
  participantAnswers: readSession(`live-challenge:answers:${initialCode}`) || {},
  error: '',
  loading: false,
  pollTimer: null,
  socket: null,
  socketConnected: false,
  reconnectTimer: null,
  questionSubmissionConsent: false,
};

render();
loadManagedQuestionCards(allCards, 'live').then((cards) => {
  allCards = cards;
  if (state.view === 'landing') {
    state.questions = pickChallengeCards(allCards, QUESTION_COUNT).map(toDraftQuestion);
    state.questionSubmissionConsent = false;
    render();
  }
});
if (state.view === 'host' || state.view === 'viewer') {
  loadRoom().then(startLiveUpdates).catch(showError);
}

function render() {
  if (!app) return;
  const content = state.loading
    ? loadingView()
    : state.view === 'landing' ? landingView()
      : state.view === 'create' ? createView()
        : state.view === 'join' ? joinView()
          : state.view === 'host' ? hostView()
            : viewerView();
  app.innerHTML = `${state.error ? `<div class="error" role="alert">${escapeHtml(errorText(state.error))}</div>` : ''}${content}`;
  bindEvents();
  const qr = document.getElementById('live-challenge-qr');
  if (qr) QRCode.toCanvas(qr, joinUrl(), { width: 188, margin: 1, errorCorrectionLevel: 'M' }).catch(() => {});
}

function landingView() {
  return `<div class="entry-grid">
    <section class="panel entry-card">
      <div class="icon">🎙️</div>
      <span class="section-pill">配信者</span>
      <h2>10問LIVEを作る</h2>
      <p>友達・家族・共通のお題から10問を選び、問題文と5択を自由に編集できます。</p>
      <ul class="steps">
        <li><b>1</b><span>10問を選ぶ・ランダム選択</span></li>
        <li><b>2</b><span>URL・QR・6桁コードを配信で案内</span></li>
        <li><b>3</b><span>視聴者と同時回答して進行</span></li>
      </ul>
      <button class="primary" data-action="open-create">LIVEクイズを作る <span>▶</span></button>
    </section>
    <section class="panel entry-card">
      <div class="icon">📱</div>
      <span class="section-pill">視聴者</span>
      <h2>6桁コードで参加</h2>
      <p>配信者から案内された参加URLを開くか、6桁コードを入力してください。</p>
      <div class="field">
        <label for="entry-code">参加コード</label>
        <input id="entry-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456">
      </div>
      <button class="secondary" data-action="go-code">参加する</button>
    </section>
  </div>
  <section class="panel" style="margin-top:16px">
    <h2>小さな配信でも、すぐ遊べます</h2>
    <p>Instagram・YouTubeとのアカウント連携は不要です。配信者1人と視聴者30人ほどの配信を中心に、最大1,000人まで参加できる設計です。</p>
  </section>`;
}

function createView() {
  return `<section class="panel">
    <span class="section-pill">配信者用</span>
    <h2 style="margin-top:10px">10問を準備する</h2>
    <p>最初はランダムな10問が入っています。各欄のお題を選び直したあと、問題文・5択を直接編集できます。</p>
    <div class="field">
      <label for="host-name">配信者名（24文字まで）</label>
      <input id="host-name" maxlength="24" autocomplete="nickname" placeholder="例：わたちゃん">
    </div>
    <label class="check">
      <input id="show-counts" type="checkbox">
      <span>配信中、視聴者にも選択肢ごとの回答人数を表示する<br><small>配信開始後もON・OFFを切り替えられます。</small></span>
    </label>
    <button class="secondary" data-action="randomize">🎲 10問をランダムで選び直す</button>
    <div class="editor-list">
      ${state.questions.map((question, index) => editorView(question, index)).join('')}
    </div>
    <label class="check">
      <input id="question-submit-consent" type="checkbox" ${state.questionSubmissionConsent ? 'checked' : ''}>
      <span><b>自作・編集したお題を「掲載候補として運営に送る」</b><br><small>初期状態は未チェックです。チェックした場合だけ、書き換えたお題が審査用に保存されます。同意しなくてもLIVEは作れます。</small></span>
    </label>
    <button class="primary" data-action="create-game">この10問でLIVEを作る <span>▶</span></button>
    <button class="ghost" data-action="back-landing">戻る</button>
  </section>`;
}

function editorView(question, index) {
  return `<article class="editor" data-editor="${index}">
    <div class="editor-head">
      <span class="q-badge">Q${index + 1}</span>
      <select data-library="${index}" aria-label="Q${index + 1}のお題をライブラリから選ぶ">
        <option value="__custom__" ${question.sourceId ? '' : 'selected'}>＋ 自分でお題を作る</option>
        ${allCards.map((card) => `<option value="${escapeHtml(card.id)}" ${card.id === question.sourceId ? 'selected' : ''}>${escapeHtml(card.title)}</option>`).join('')}
      </select>
    </div>
    <textarea data-question="${index}" maxlength="180" aria-label="Q${index + 1}の問題文">${escapeHtml(question.text)}</textarea>
    ${question.options.map((option, optionIndex) => `<label class="option-edit">
      <b>${optionIndex + 1}</b>
      <input data-option="${index}:${optionIndex}" maxlength="60" value="${escapeHtml(option)}" aria-label="Q${index + 1} 選択肢${optionIndex + 1}">
    </label>`).join('')}
  </article>`;
}

function joinView() {
  return `<section class="panel">
    <span class="section-pill">視聴者用</span>
    <h2 style="margin-top:10px">LIVEクイズに参加</h2>
    <div class="room-code">${escapeHtml(state.code)}</div>
    <p>結果カードに表示する名前を入力してください。</p>
    <div class="field">
      <label for="viewer-name">あなたの名前（24文字まで）</label>
      <input id="viewer-name" maxlength="24" autocomplete="nickname" value="${escapeHtml(state.participantName)}" placeholder="例：あき">
    </div>
    <button class="primary" data-action="join-game">参加する <span>▶</span></button>
    <button class="ghost" data-action="back-landing">コードを入れ直す</button>
  </section>`;
}

function hostView() {
  if (!state.game) return loadingView();
  if (state.game.phase === 'lobby') return hostLobbyView();
  if (state.game.phase === 'complete') return hostCompleteView();
  if (state.game.phase === 'voting') return hostQuestionView();
  return `<section class="panel"><h2>ゲームを更新しています</h2><p>少し待ってください。</p></section>`;
}

function hostLobbyView() {
  return `<section class="panel">
    <span class="section-pill">配信者画面</span>
    <h2 style="margin-top:10px">視聴者を招待する</h2>
    <div class="room-code">${escapeHtml(state.code)}</div>
    <div class="share-grid">
      <div class="qr"><canvas id="live-challenge-qr" width="188" height="188" aria-label="参加URLのQRコード"></canvas></div>
      <div>
        <h3>配信で案内する3つの方法</h3>
        <p>①QRコード ②参加URL ③6桁コード</p>
        <div class="share-url">${escapeHtml(joinUrl())}</div>
        <button class="secondary" data-action="copy-link">参加URLをコピー</button>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><small>参加中</small><b>${number(state.game.participantCount)}人</b></div>
      <div class="stat"><small>参加上限</small><b>${number(state.game.participantLimit)}人</b></div>
    </div>
    <label class="check">
      <input data-action="toggle-counts" type="checkbox" ${state.game.showVoteCount ? 'checked' : ''}>
      <span>視聴者にも選択肢ごとの人数を表示</span>
    </label>
    <button class="primary" data-action="start-game">10問をスタート <span>▶</span></button>
    <p class="notice">配信者はこの画面から離れないでください。視聴者がそろったら開始できます。</p>
  </section>`;
}

function hostQuestionView() {
  const game = state.game;
  const question = game.question;
  const answer = state.hostAnswers[question.id];
  const answered = question.subjectAnswered;
  return `<article class="question-card">
    ${progressView(game.currentQuestionIndex)}
    <span class="q-label">配信者の秘密回答 ・ Q${game.currentQuestionIndex + 1}/10</span>
    <h2>${escapeHtml(question.text)}</h2>
    <p class="help">${answered ? '回答を確定しました。視聴者の回答を待ってから次へ進んでください。' : '視聴者と同じタイミングで、あなたの答えを1つ選んでください。'}</p>
    <div class="choices">
      ${question.options.map((option, index) => choiceButton(option, index, {
        selected: answer === index,
        disabled: answered,
        count: question.voteCounts?.[index],
        action: 'host-answer',
      })).join('')}
    </div>
    <div class="stats">
      <div class="stat"><small>参加中</small><b>${number(game.participantCount)}人</b></div>
      <div class="stat"><small>回答済み</small><b>${number(question.voteCount)}人</b></div>
    </div>
    <label class="check">
      <input data-action="toggle-counts" type="checkbox" ${game.showVoteCount ? 'checked' : ''}>
      <span>視聴者にも選択肢ごとの人数を表示</span>
    </label>
    <button class="primary" data-action="advance" ${answered ? '' : 'disabled'}>
      ${game.currentQuestionIndex === 9 ? '回答を締め切って結果へ' : `回答を締め切ってQ${game.currentQuestionIndex + 2}へ`} <span>▶</span>
    </button>
  </article>`;
}

function hostCompleteView() {
  return `<section class="panel waiting">
    <span class="section-pill">10問終了</span>
    <h2 style="margin-top:12px">LIVEクイズ終了！</h2>
    <p>視聴者の画面には、それぞれの正解数と10問の結果カードが表示されています。</p>
    <div class="stats">
      <div class="stat"><small>参加者</small><b>${number(state.game.participantCount)}人</b></div>
      <div class="stat"><small>出題数</small><b>10問</b></div>
    </div>
    <a class="primary" href="/live-challenge" style="text-decoration:none">新しいLIVEを作る <span>▶</span></a>
  </section>`;
}

function viewerView() {
  if (!state.game) return loadingView();
  if (state.game.phase === 'lobby') {
    return `<section class="panel waiting">
      <div class="pulse"></div>
      <span class="section-pill">参加完了</span>
      <h2 style="margin-top:12px">配信者のスタート待ち</h2>
      <p>${escapeHtml(state.participantName)}さん、参加できました。画面は自動で切り替わります。</p>
      <div class="room-code">${escapeHtml(state.code)}</div>
    </section>`;
  }
  if (state.game.phase === 'complete') return viewerResultView();
  if (state.game.phase === 'voting') return viewerQuestionView();
  return `<section class="panel waiting"><div class="pulse"></div><h2>次の問題を待っています</h2></section>`;
}

function viewerQuestionView() {
  const game = state.game;
  const question = game.question;
  const answer = Object.prototype.hasOwnProperty.call(state.participantAnswers, question.id)
    ? Number(state.participantAnswers[question.id])
    : Number.isInteger(game.myVoteIndex) ? game.myVoteIndex : null;
  return `<article class="question-card">
    ${progressView(game.currentQuestionIndex)}
    <span class="q-label">${escapeHtml(game.subjectName)}さんと同じ答えなら1点 ・ Q${game.currentQuestionIndex + 1}/10</span>
    <h2>${escapeHtml(question.text)}</h2>
    <p class="help">${answer === null ? '配信者の答えを予想するのではなく、あなた自身の答えを選んでください。' : '回答を送信しました。配信者が次へ進むまで待ってください。'}</p>
    <div class="choices">
      ${question.options.map((option, index) => choiceButton(option, index, {
        selected: answer === index,
        disabled: answer !== null,
        count: question.voteCounts?.[index],
        action: 'viewer-answer',
      })).join('')}
    </div>
    ${answer !== null ? '<p class="notice">回答済みです。配信画面を見ながら次の問題を待ってください。</p>' : ''}
  </article>`;
}

function viewerResultView() {
  const results = Array.isArray(state.game.results) ? state.game.results : [];
  const correct = results.filter((result) => result.myIsCorrect === true).length;
  return `<section class="result-card" data-testid="live-result-card">
    <div class="result-top">LIVE CHALLENGE RESULT</div>
    <div class="score">
      <small>${escapeHtml(state.participantName)}さんの結果</small>
      <strong>${correct}/10</strong>
      <b>${resultMessage(correct)}</b>
    </div>
    <div class="result-list">
      ${results.map((result, index) => {
        const myAnswer = Number.isInteger(result.myVoteIndex) ? result.options?.[result.myVoteIndex]?.text : '未回答';
        return `<div class="result-row">
          <b>Q${index + 1}</b>
          <span>${escapeHtml(myAnswer || '未回答')}</span>
          <strong class="${result.myIsCorrect ? 'ok' : 'ng'}">${result.myIsCorrect ? '○ 一致' : '× 不一致'}</strong>
        </div>`;
      }).join('')}
    </div>
    <div class="result-actions">
      <button class="primary" data-action="save-result">結果カードを画像で保存 <span>↓</span></button>
      <a class="ghost" href="/live-challenge" style="text-decoration:none">トップへ戻る</a>
    </div>
  </section>`;
}

function progressView(index) {
  return `<div class="progress" aria-label="全10問中${index + 1}問目">${Array.from({ length: 10 }, (_, item) => `<i class="${item <= index ? 'on' : ''}"></i>`).join('')}</div>`;
}

function choiceButton(option, index, config) {
  const count = Number.isFinite(Number(config.count)) ? `<span class="count">${number(config.count)}人</span>` : '';
  return `<button class="choice ${config.selected ? 'selected' : ''}" data-action="${config.action}" data-index="${index}" ${config.disabled ? 'disabled' : ''}>
    <span class="number">${index + 1}</span><span>${escapeHtml(option)}</span>${count}
  </button>`;
}

function loadingView() {
  return '<section class="panel waiting"><div class="pulse"></div><h2>読み込み中</h2><p>少し待ってください。</p></section>';
}

function bindEvents() {
  document.querySelector('[data-action="open-create"]')?.addEventListener('click', () => setState({ view: 'create' }));
  document.querySelectorAll('[data-action="back-landing"]').forEach((button) => button.addEventListener('click', () => {
    history.replaceState(null, '', '/live-challenge');
    setState({ view: 'landing', code: '', error: '' });
  }));
  document.querySelector('[data-action="go-code"]')?.addEventListener('click', goToCode);
  document.getElementById('entry-code')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') goToCode();
  });
  document.querySelector('[data-action="randomize"]')?.addEventListener('click', () => {
    state.questions = pickChallengeCards(allCards, QUESTION_COUNT).map(toDraftQuestion);
    state.questionSubmissionConsent = false;
    render();
  });
  document.querySelectorAll('[data-library]').forEach((select) => select.addEventListener('change', () => {
    captureDraft();
    const index = Number(select.dataset.library);
    const card = allCards.find((item) => item.id === select.value);
    state.questions[index] = card
      ? toDraftQuestion(card)
      : { id: `custom-${Date.now()}-${index}`, sourceId: '', text: '', options: ['', '', '', '', ''] };
    state.questionSubmissionConsent = false;
    render();
  }));
  document.querySelector('[data-action="create-game"]')?.addEventListener('click', createGame);
  document.querySelector('[data-action="join-game"]')?.addEventListener('click', joinGame);
  document.querySelector('[data-action="copy-link"]')?.addEventListener('click', copyJoinLink);
  document.querySelector('[data-action="start-game"]')?.addEventListener('click', () => hostAction('start'));
  document.querySelectorAll('[data-action="host-answer"]').forEach((button) => button.addEventListener('click', () => hostAnswer(Number(button.dataset.index))));
  document.querySelectorAll('[data-action="viewer-answer"]').forEach((button) => button.addEventListener('click', () => viewerAnswer(Number(button.dataset.index))));
  document.querySelector('[data-action="advance"]')?.addEventListener('click', () => hostAction('advance'));
  document.querySelectorAll('[data-action="toggle-counts"]').forEach((input) => input.addEventListener('change', () => toggleCounts(input.checked)));
  document.querySelector('[data-action="save-result"]')?.addEventListener('click', saveResultCard);
}

function goToCode() {
  const code = (document.getElementById('entry-code')?.value || '').replace(/\D/g, '').slice(0, 6);
  if (code.length !== 6) return showError('invalid-code');
  location.href = `/live-challenge?room=${code}`;
}

function captureDraft() {
  state.questionSubmissionConsent = document.getElementById('question-submit-consent')?.checked === true;
  state.questions = state.questions.map((question, index) => ({
    ...question,
    text: document.querySelector(`[data-question="${index}"]`)?.value.trim() || question.text,
    options: question.options.map((option, optionIndex) => (
      document.querySelector(`[data-option="${index}:${optionIndex}"]`)?.value.trim() || option
    )),
  }));
}

async function createGame() {
  captureDraft();
  const submissionCandidates = changedQuestionCandidates(state.questions, allCards);
  const submissionConsent = state.questionSubmissionConsent;
  const subjectName = document.getElementById('host-name')?.value.trim() || '';
  const showLiveVoteCounts = document.getElementById('show-counts')?.checked === true;
  if (!subjectName) return showError('stream-name-required');
  if (state.questions.some((question) => !question.text || question.options.some((option) => !option))) {
    return showError('questions-incomplete');
  }
  setState({ loading: true, error: '' });
  try {
    const response = await api('/api/live/stream-games', {
      method: 'POST',
      body: JSON.stringify({
        subjectName,
        showLiveVoteCounts,
        questions: state.questions.map((question) => ({
          id: question.id,
          type: 'guess-person',
          text: question.text,
          options: question.options,
        })),
      }),
    });
    state.code = response.code;
    state.hostToken = response.hostToken;
    state.subjectToken = response.game.subjectToken || '';
    state.game = response.game;
    history.replaceState(null, '', `/live-challenge?room=${state.code}#host=${state.hostToken}`);
    setState({ view: 'host', loading: false });
    submitQuestionCandidates({
      consent: submissionConsent,
      sourceMode: 'live-challenge',
      questions: submissionCandidates,
    }).catch(() => {});
    startLiveUpdates();
  } catch (error) {
    setState({ loading: false, error: error.message });
  }
}

async function joinGame() {
  const name = document.getElementById('viewer-name')?.value.trim() || '';
  if (!name) return showError('name-required');
  setState({ loading: true, error: '' });
  try {
    const response = await api(`/api/live/games/${state.code}/join`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    state.participantToken = response.participantToken;
    state.participantName = name;
    state.game = response.game;
    writeSession(`live-challenge:${state.code}`, { token: state.participantToken, name });
    setState({ view: 'viewer', loading: false });
    startLiveUpdates();
  } catch (error) {
    setState({ loading: false, error: error.message });
  }
}

async function loadRoom() {
  const headers = {};
  if (state.view === 'host') headers['x-live-host-token'] = state.hostToken;
  if (state.view === 'viewer') headers['x-live-participant-token'] = state.participantToken;
  const response = await api(`/api/live/games/${state.code}`, { headers });
  state.game = state.view === 'viewer' ? personalizeGame(response.game) : response.game;
  if (state.view === 'host') state.subjectToken = response.game.subjectToken || state.subjectToken;
  render();
}

async function hostAction(action) {
  setState({ loading: true, error: '' });
  try {
    const response = await api(`/api/live/games/${state.code}/${action}`, {
      method: 'POST',
      headers: { 'x-live-host-token': state.hostToken },
      body: '{}',
    });
    state.game = response.game;
    state.subjectToken = response.game.subjectToken || state.subjectToken;
    setState({ loading: false });
    if (state.game.phase === 'complete') stopLiveUpdates();
  } catch (error) {
    setState({ loading: false, error: error.message });
  }
}

async function hostAnswer(optionIndex) {
  const question = state.game?.question;
  if (!question || !state.subjectToken) return;
  state.hostAnswers = { ...state.hostAnswers, [question.id]: optionIndex };
  setState({ loading: true, error: '' });
  try {
    await api(`/api/live/games/${state.code}/subject-answer`, {
      method: 'POST',
      headers: { 'x-live-subject-token': state.subjectToken },
      body: JSON.stringify({ questionId: question.id, optionIndex }),
    });
    await loadRoom();
    setState({ loading: false });
  } catch (error) {
    setState({ loading: false, error: error.message });
  }
}

async function toggleCounts(show) {
  try {
    const response = await api(`/api/live/games/${state.code}/vote-counts`, {
      method: 'POST',
      headers: { 'x-live-host-token': state.hostToken },
      body: JSON.stringify({ show }),
    });
    state.game = response.game;
    state.subjectToken = response.game.subjectToken || state.subjectToken;
    render();
  } catch (error) {
    showError(error.message);
  }
}

async function viewerAnswer(optionIndex) {
  const question = state.game?.question;
  if (!question || Object.prototype.hasOwnProperty.call(state.participantAnswers, question.id)) return;
  if (state.socketConnected && state.socket?.readyState === WebSocket.OPEN) {
    state.socket.send(JSON.stringify({ type: 'vote', questionId: question.id, optionIndex }));
    return;
  }
  try {
    const response = await api(`/api/live/games/${state.code}/vote`, {
      method: 'POST',
      headers: { 'x-live-participant-token': state.participantToken },
      body: JSON.stringify({ questionId: question.id, optionIndex }),
    });
    rememberAnswer(question.id, optionIndex);
    state.game = personalizeGame(response.game);
    render();
  } catch (error) {
    showError(error.message);
  }
}

function startLiveUpdates() {
  clearInterval(state.pollTimer);
  if (state.view === 'viewer' && state.game?.realtime) connectSocket();
  state.pollTimer = setInterval(() => {
    if (state.view === 'viewer' && state.socketConnected) return;
    loadRoom().catch(() => {});
  }, state.view === 'host' ? 2000 : LIVE_POLL_INTERVAL_MS);
}

function stopLiveUpdates() {
  clearInterval(state.pollTimer);
  state.pollTimer = null;
  clearTimeout(state.reconnectTimer);
  if (state.socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(state.socket.readyState)) {
    state.socket.close(1000, 'complete');
  }
  state.socket = null;
  state.socketConnected = false;
}

function connectSocket() {
  if (!state.participantToken || ['complete', 'cancelled', 'terminated'].includes(state.game?.phase)) return;
  if ([WebSocket.OPEN, WebSocket.CONNECTING].includes(state.socket?.readyState)) return;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${location.host}/api/live/games/${state.code}/socket`, ['live-v1', state.participantToken]);
  state.socket = socket;
  socket.addEventListener('open', () => {
    if (state.socket === socket) state.socketConnected = true;
  });
  socket.addEventListener('message', (event) => {
    if (state.socket !== socket) return;
    let message;
    try { message = JSON.parse(event.data); } catch (error) { return; }
    if ((message.type === 'ready' || message.type === 'state') && message.game) {
      if (message.answers && typeof message.answers === 'object') {
        state.participantAnswers = { ...state.participantAnswers, ...message.answers };
        saveAnswers();
      }
      state.game = personalizeGame(message.game);
      if (message.participantName) state.participantName = message.participantName;
      if (state.game.phase === 'complete') stopLiveUpdates();
      render();
    } else if (message.type === 'vote-accepted') {
      rememberAnswer(message.questionId, Number(message.optionIndex));
      render();
    } else if (message.type === 'vote-rejected') {
      showError(message.error || 'live-vote-error');
    }
  });
  socket.addEventListener('close', () => {
    if (state.socket !== socket) return;
    state.socket = null;
    state.socketConnected = false;
    if (!['complete', 'cancelled', 'terminated'].includes(state.game?.phase)) {
      state.reconnectTimer = setTimeout(connectSocket, 1000 + Math.floor(Math.random() * 1800));
    }
  });
  socket.addEventListener('error', () => socket.close());
}

function personalizeGame(game) {
  if (!game) return game;
  const questionId = game.question?.id;
  const myVoteIndex = questionId && Object.prototype.hasOwnProperty.call(state.participantAnswers, questionId)
    ? Number(state.participantAnswers[questionId])
    : game.myVoteIndex;
  return {
    ...game,
    myVoteIndex,
    results: Array.isArray(game.results) ? game.results.map((result) => {
      const hasAnswer = Object.prototype.hasOwnProperty.call(state.participantAnswers, result.questionId);
      const answer = hasAnswer ? Number(state.participantAnswers[result.questionId]) : result.myVoteIndex;
      return {
        ...result,
        myVoteIndex: Number.isInteger(answer) ? answer : null,
        myIsCorrect: Number.isInteger(answer) ? answer === result.subjectAnswerIndex : null,
      };
    }) : [],
  };
}

function rememberAnswer(questionId, optionIndex) {
  state.participantAnswers = { ...state.participantAnswers, [questionId]: optionIndex };
  saveAnswers();
  if (state.game?.question?.id === questionId) state.game = { ...state.game, myVoteIndex: optionIndex };
}

function saveAnswers() {
  writeSession(`live-challenge:answers:${state.code}`, state.participantAnswers);
}

async function copyJoinLink() {
  try {
    await navigator.clipboard.writeText(joinUrl());
    const button = document.querySelector('[data-action="copy-link"]');
    if (button) button.textContent = 'コピーしました';
  } catch (error) {
    showError('copy-failed');
  }
}

function saveResultCard() {
  const results = Array.isArray(state.game?.results) ? state.game.results : [];
  const correct = results.filter((result) => result.myIsCorrect === true).length;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext('2d');
  context.fillStyle = '#EC4F88';
  context.fillRect(0, 0, canvas.width, canvas.height);
  roundedRect(context, 55, 55, 970, 1240, 42, '#191919');
  roundedRect(context, 75, 75, 930, 1200, 34, '#FFF8F1');
  context.fillStyle = '#191919';
  context.fillRect(75, 75, 930, 180);
  centerText(context, 'LIVE CHALLENGE RESULT', 165, '900 48px sans-serif', '#FFFFFF');
  centerText(context, `${state.participantName}さんの結果`, 345, '900 44px sans-serif', '#191919');
  centerText(context, `${correct}/10`, 560, '900 164px sans-serif', '#EC4F88');
  centerText(context, resultMessage(correct), 680, '900 42px sans-serif', '#191919');
  roundedRect(context, 145, 760, 790, 270, 30, '#FFE26B');
  centerText(context, '配信者と同じ答えなら1点', 850, '900 40px sans-serif', '#191919');
  centerText(context, `10問中 ${correct}問 一致！`, 940, '900 58px sans-serif', '#191919');
  centerText(context, 'Instagram LIVE / YouTube LIVE', 1125, '800 30px sans-serif', '#6F6267');
  centerText(context, 'streetboardgame.com', 1200, '900 30px sans-serif', '#191919');
  const link = document.createElement('a');
  link.download = `live-challenge-${state.code}-${correct}of10.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function roundedRect(context, x, y, width, height, radius, fill) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
}

function centerText(context, text, y, font, fill) {
  context.font = font;
  context.fillStyle = fill;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 540, y);
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body) headers.set('content-type', 'application/json');
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'request-failed');
  return data;
}

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

function showError(error) {
  state.error = error?.message || String(error || 'request-failed');
  state.loading = false;
  render();
}

function toDraftQuestion(card) {
  return {
    id: `${card.id}-${Math.random().toString(36).slice(2, 9)}`,
    sourceId: card.id,
    text: card.title,
    options: card.choices.slice(0, 5),
  };
}

function joinUrl() {
  return `${location.origin}/live-challenge?room=${state.code}`;
}

function resultMessage(score) {
  if (score === 10) return '全問一致！最高のシンクロ率';
  if (score >= 8) return 'かなり気が合っています';
  if (score >= 5) return '半分以上一致しました';
  return '答えの違いもトークのネタ！';
}

function errorText(code) {
  const messages = {
    'invalid-code': '6桁の参加コードを入力してください。',
    'stream-name-required': '配信者名を入力してください。',
    'name-required': '結果カードに表示する名前を入力してください。',
    'questions-incomplete': '10問すべての問題文と5つの選択肢を入力してください。',
    'ten-questions-required': '問題は10問必要です。',
    'five-options-required': '各問題に5つの選択肢が必要です。',
    'participant-limit-reached': 'このLIVEは参加上限に達しました。',
    'participant-forbidden': '参加情報を確認できません。参加URLから入り直してください。',
    'host-forbidden': '配信者用URLを確認できません。',
    'game-finished': 'このLIVEは終了しています。',
    'voting-closed': 'この問題の回答は締め切られました。',
    'already-voted': 'この問題には回答済みです。',
    'question-changed': '次の問題へ進みました。画面を更新します。',
    'live-storage-not-configured': 'LIVE機能の保存先が設定されていません。',
    'live-realtime-unavailable': 'リアルタイム接続を利用できません。',
    'copy-failed': 'コピーできませんでした。参加URLを長押ししてコピーしてください。',
    'rate-limit-exceeded': '操作が集中しています。少し待ってから試してください。',
    'request-failed': '通信に失敗しました。接続を確認してください。',
  };
  return messages[code] || '通信に失敗しました。少し待ってから試してください。';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[character]));
}

function number(value) {
  return Math.max(0, Number(value) || 0).toLocaleString('ja-JP');
}

function readSession(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key) || 'null');
  } catch (error) {
    return null;
  }
}

function writeSession(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Private browsing may reject storage; the current page can still continue.
  }
}
