import QRCode from 'qrcode';
import { mergeChallengeCards, pickChallengeCards } from './src/challenge/data.js';

const COLORS = ['#77bb62', '#3f78bd', '#f5c83b', '#d3313b', '#ef8730'];
const COLOR_NAMES = ['緑', '青', '黄', '赤', '橙'];
const QUESTION_COUNT = 10;
const CREATOR_DRAFT_KEY = 'watachan-challenge-creator-draft:v1';
const MANAGE_HISTORY_KEY = 'watachan-challenge-manage-history:v1';
const app = document.getElementById('challenge-app');
const allCards = mergeChallengeCards(window.FRIEND_CARDS, window.FAMILY_CARDS);
const currentUrl = new URL(location.href);
const pagePath = currentUrl.pathname.replace(/\/+$/, '') || '/challenge';
const roomCode = currentUrl.searchParams.get('room')?.trim().toUpperCase() || '';
const preferredCardId = currentUrl.searchParams.get('question')?.trim() || '';
const hashManageToken = new URLSearchParams(location.hash.slice(1)).get('manage') || '';
const savedManageToken = roomCode ? manageHistory().find((item) => item.code === roomCode)?.token || '' : '';
const initialManageToken = hashManageToken || savedManageToken;
document.documentElement.dataset.challengePage = pagePath.split('/').pop() || 'challenge';

if (pagePath === '/challenge' && roomCode && hashManageToken) {
  history.replaceState(null, '', `/challenge/manage?room=${roomCode}#manage=${hashManageToken}`);
}

let state = {
  mode: initialMode(),
  roomCode,
  room: null,
  cards: [],
  answers: [],
  questionIndex: 0,
  creatorName: '',
  participantName: '',
  participantToken: roomCode ? participantToken(roomCode) : '',
  manageToken: initialManageToken,
  participants: [],
  ranking: [],
  library: [],
  result: null,
  error: '',
  loading: false,
};

function initialMode() {
  if (pagePath === '/challenge/library') return 'library';
  if (pagePath === '/challenge/ranking') return 'ranking';
  if (pagePath === '/challenge/manage') return 'manage';
  return roomCode ? (initialManageToken ? 'manage' : 'join') : 'create';
}

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[character]));
}

function render() {
  if (!app) return;
  const body = state.loading
    ? loadingView()
    : state.mode === 'create' ? createStartView()
      : state.mode === 'creator-answer' ? questionView(true)
        : state.mode === 'manage' ? manageView()
          : state.mode === 'join' ? joinView()
            : state.mode === 'participant-answer' ? questionView(false)
              : state.mode === 'result' ? resultView()
                : state.mode === 'ranking' ? rankingView()
                  : state.mode === 'library' ? libraryView()
                    : errorView();
  app.innerHTML = body;
  bindEvents();
}

function loadingView() {
  return '<section class="challenge-panel challenge-centered" aria-live="polite"><div class="challenge-loader"></div><p>読み込み中です…</p></section>';
}

function shell(label, title, description, content) {
  return `
    <section class="challenge-hero">
      <span class="challenge-pill">${escapeHtml(label)}</span>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
    </section>
    ${state.error ? `<p class="challenge-error" role="alert">${escapeHtml(errorMessage(state.error))}</p>` : ''}
    ${content}
  `;
}

function createStartView() {
  const draft = creatorDraft();
  const preferredCard = allCards.find((card) => card.id === preferredCardId);
  const historyItems = manageHistory();
  return shell(
    'NEW MODE',
    'みんなに挑戦してもらう',
    '先に自分が10問に回答。できたURLを送ると、最大50人があなたの答え当てに挑戦できます。',
    `<nav class="challenge-feature-nav" aria-label="挑戦モードのメニュー">
      <a href="/challenge/library">人気のお題ライブラリ</a>
      ${historyItems[0] ? `<a href="${manageUrl(historyItems[0].code, historyItems[0].token)}">主催者用回答管理</a>` : ''}
    </nav>
    ${draft ? `<section class="challenge-panel challenge-resume" data-testid="creator-resume">
      <span class="challenge-section-label">途中保存あり</span>
      <h2>${escapeHtml(draft.creatorName)}さんのクイズ</h2>
      <p>Q${Math.min(Number(draft.questionIndex) + 1, QUESTION_COUNT)}/10から再開できます。この端末だけに保存されています。</p>
      <div class="challenge-button-row">
        <button class="challenge-primary" data-action="resume-create">途中から再開</button>
        <button class="challenge-secondary" data-action="delete-draft">削除</button>
      </div>
    </section>` : ''}
    <section class="challenge-panel">
      <h2>あなたのクイズを作る</h2>
      <ol class="challenge-steps">
        <li><b>あなた</b>が10問に回答</li>
        <li>専用URL・QRコードを共有</li>
        <li>フレンドランキングと回答詳細を確認</li>
      </ol>
      ${preferredCard ? `<div class="challenge-selected-question">
        <b>選んだお題を必ず入れます</b>
        <span>${escapeHtml(preferredCard.title)}</span>
      </div>` : ''}
      <label class="challenge-label" for="creator-name">出題者の名前（12文字まで）</label>
      <input id="creator-name" class="challenge-input" maxlength="12" autocomplete="nickname"
        placeholder="例：ちあき" value="${escapeHtml(state.creatorName)}">
      <button class="challenge-primary" data-action="start-create">10問に答えてクイズを作る <span>▶</span></button>
      <p class="challenge-note">友達版と家族版を統合した94問から出題します。回答途中はこの端末へ自動保存されます。</p>
    </section>`,
  );
}

function questionView(isCreator) {
  const card = state.cards[state.questionIndex];
  const actor = isCreator ? state.creatorName : state.participantName;
  const selected = state.answers[state.questionIndex];
  return shell(
    isCreator ? 'QUIZ MAKER' : 'CHALLENGE',
    isCreator ? `${actor}さんの答えを登録` : `${state.room.creatorName}さんの答えを予想`,
    isCreator
      ? '選んだ答えは、挑戦者が10問すべて回答するまで公開されません。'
      : '出題者が選んだ答えを予想してください。',
    `<section class="challenge-question-wrap" data-testid="${isCreator ? 'creator-question' : 'participant-question'}">
      <div class="challenge-progress" aria-label="${state.questionIndex + 1}問目、全10問">
        ${Array.from({ length: QUESTION_COUNT }, (_, index) => `<span class="${index <= state.questionIndex ? 'is-active' : ''}"></span>`).join('')}
      </div>
      <article class="challenge-card">
        <div class="challenge-q-number">Q${state.questionIndex + 1}/10</div>
        <h2>${escapeHtml(card.title)}</h2>
        <div class="challenge-choices">
          ${card.choices.map((choice, index) => `
            <button data-action="answer" data-choice="${index}" class="challenge-choice ${selected === index ? 'is-selected' : ''}">
              <i style="background:${COLORS[index]}" aria-hidden="true"></i>
              <span>${escapeHtml(choice)}</span>
              <small>${selected === index ? '選択中' : COLOR_NAMES[index]}</small>
            </button>
          `).join('')}
        </div>
      </article>
      ${state.questionIndex > 0 ? '<button class="challenge-secondary" data-action="previous-question">前の問題へ戻る</button>' : ''}
      <p class="challenge-note challenge-centered">ここまでの回答はこの端末へ自動保存されています。</p>
    </section>`,
  );
}

function manageView() {
  const room = state.room;
  if (!room) return errorView();
  const shareUrl = challengeUrl(room.code);
  const rankingUrl = `${location.origin}/challenge/ranking?room=${room.code}`;
  return shell(
    'HOST DASHBOARD',
    '主催者用回答管理',
    `${room.creatorName}さんのクイズを共有し、参加状況と一人ずつの回答を確認できます。`,
    `<section class="challenge-panel">
      <div class="challenge-count" data-testid="participant-count">
        <b>${room.completedParticipants}</b>人回答済み ／ <b>${room.participantCount}</b>人参加 ／ 上限${room.maxParticipants}人
      </div>
      <label class="challenge-label" for="share-url">挑戦用URL</label>
      <input id="share-url" class="challenge-input" readonly value="${escapeHtml(shareUrl)}">
      <button class="challenge-primary" data-action="copy-url" data-copy-value="${escapeHtml(shareUrl)}">挑戦用URLをコピー</button>
      <div class="challenge-share-row">
        <a class="challenge-share line" target="_blank" rel="noopener"
          href="https://line.me/R/msg/text/?${encodeURIComponent(shareText(room, shareUrl))}">LINEで送る</a>
        <a class="challenge-share x" target="_blank" rel="noopener"
          href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText(room, shareUrl))}">Xでシェア</a>
      </div>
      <div class="challenge-qr"><canvas id="challenge-qr" width="180" height="180" aria-label="挑戦用URLのQRコード"></canvas></div>
      <div class="challenge-button-row">
        <a class="challenge-secondary" href="/challenge/ranking?room=${room.code}">フレンドランキング</a>
        <button class="challenge-secondary" data-action="copy-ranking" data-copy-value="${escapeHtml(rankingUrl)}">ランキングURLをコピー</button>
      </div>
      <button class="challenge-secondary" data-action="refresh-manage">回答状況を更新</button>
      <p class="challenge-note">主催者用URLは回答内容を見られる秘密URLです。この端末へ保存され、30日後に無効になります。第三者へ送らないでください。</p>
    </section>
    <section class="challenge-panel" data-testid="host-answer-management">
      <h2>参加者の回答</h2>
      ${state.participants.length ? `
        <div class="challenge-participant-list">
          ${state.participants.map((participant) => participantDetail(participant, room.cards)).join('')}
        </div>
      ` : '<p class="challenge-empty">まだ参加者はいません。挑戦用URLを送って待ちましょう。</p>'}
    </section>`,
  );
}

function participantDetail(participant, cards) {
  return `<details class="challenge-participant">
    <summary>
      <span>${escapeHtml(participant.name)}</span>
      <b>${participant.submitted ? `${participant.score}/10問` : '回答中'}</b>
    </summary>
    ${participant.submitted ? `<ol>
      ${participant.answers.map((answer, index) => `
        <li class="${answer.match ? 'is-correct' : ''}">
          <span>Q${index + 1} ${escapeHtml(cards[index].title)}</span>
          <b>${escapeHtml(cards[index].choices[answer.selected])}</b>
          <small>${answer.match ? '正解' : `正解：${escapeHtml(cards[index].choices[answer.correct])}`}</small>
        </li>
      `).join('')}
    </ol>` : '<p>まだ10問の回答を終えていません。</p>'}
  </details>`;
}

function joinView() {
  if (!state.room) return errorView();
  const room = state.room;
  if (room.full && !state.participantToken) {
    return shell(
      'FULL',
      '参加受付は終了しました',
      `このクイズは上限の${room.maxParticipants}人に達しました。`,
      '<section class="challenge-panel"><a class="challenge-primary" href="/challenge">自分も作る</a></section>',
    );
  }
  return shell(
    'CHALLENGE',
    `${room.creatorName}さんからの挑戦`,
    '10問に答えて、出題者のことをどれだけ分かっているか確かめよう。',
    `<section class="challenge-panel">
      <div class="challenge-count"><b>${room.completedParticipants}</b>人が回答済み ／ 上限${room.maxParticipants}人</div>
      <label class="challenge-label" for="participant-name">ランキング表示名（12文字まで）</label>
      <input id="participant-name" class="challenge-input" maxlength="12" autocomplete="nickname"
        placeholder="例：ゆう（本名は避けてください）" value="${escapeHtml(state.participantName)}">
      <label class="challenge-consent">
        <input id="ranking-consent" type="checkbox">
        <span>表示名・得点・順位がフレンドランキングに公開され、回答内容が主催者に表示されることに同意します</span>
      </label>
      <button class="challenge-primary" data-action="join">10問の答え当てに挑戦する <span>▶</span></button>
      <a class="challenge-secondary" href="/challenge/ranking?room=${room.code}">フレンドランキングを見る</a>
      <p class="challenge-note">本名・学校名など個人が特定できる名前は入力しないでください。回答途中はこの端末へ自動保存されます。</p>
    </section>`,
  );
}

function resultView() {
  const result = state.result;
  if (!result) return errorView();
  return shell(
    'RESULT',
    `${result.score}/10問 正解`,
    `${result.participant.name}さんは、回答済み${result.completedParticipants}人中 ${result.rank}位です。`,
    `<section class="challenge-panel">
      <h2>答え合わせ</h2>
      <div class="challenge-results">
        ${result.answers.map((answer, index) => `
          <article class="challenge-result ${answer.match ? 'is-correct' : ''}">
            <header><b>Q${index + 1} ${escapeHtml(answer.card.title)}</b><span>${answer.match ? '当たり' : 'ハズレ'}</span></header>
            <p>あなた：<i style="background:${COLORS[answer.selected]}"></i>${escapeHtml(answer.card.choices[answer.selected])}</p>
            <p>正解：<i style="background:${COLORS[answer.correct]}"></i>${escapeHtml(answer.card.choices[answer.correct])}</p>
          </article>
        `).join('')}
      </div>
      <a class="challenge-primary" href="/challenge">自分も作る</a>
      <a class="challenge-secondary" href="/challenge/ranking?room=${result.code}">フレンドランキングを見る</a>
      <button class="challenge-secondary" data-action="share-result">結果をシェア</button>
      <a class="challenge-secondary" href="/">トップへ戻る</a>
    </section>`,
  );
}

function rankingView() {
  if (!state.room) return errorView();
  const room = state.room;
  return shell(
    'FRIEND RANKING',
    'フレンドランキング',
    `${room.creatorName}さんのことを一番分かっているのは誰？`,
    `<section class="challenge-panel" data-testid="friend-ranking">
      <div class="challenge-count"><b>${room.completedParticipants}</b>人が回答済み ／ 上限${room.maxParticipants}人</div>
      ${state.ranking.length ? `<ol class="challenge-ranking-list">
        ${state.ranking.map((participant) => `
          <li class="${participant.rank === 1 ? 'is-winner' : ''}">
            <span class="challenge-rank">${participant.rank}位</span>
            <b>${escapeHtml(participant.name)}</b>
            <strong>${participant.score}/10</strong>
          </li>
        `).join('')}
      </ol>` : '<p class="challenge-empty">まだ回答済みの参加者はいません。</p>'}
      <button class="challenge-primary" data-action="refresh-ranking">ランキングを更新</button>
      <a class="challenge-secondary" href="/challenge?room=${room.code}">このクイズに挑戦する</a>
      <button class="challenge-secondary" data-action="copy-url" data-copy-value="${escapeHtml(challengeUrl(room.code))}">挑戦用URLをコピー</button>
      <a class="challenge-secondary" href="/challenge">自分も作る</a>
      <p class="challenge-note">同点は同じ順位です。表示名と得点だけを公開し、問題ごとの回答は主催者だけが確認できます。</p>
    </section>`,
  );
}

function libraryView() {
  const played = new Map(state.library.map((question) => [question.id, question]));
  const sourceOrder = new Map(allCards.map((card, index) => [card.id, index]));
  const cards = allCards.slice().sort((left, right) => {
    const leftStats = played.get(left.id);
    const rightStats = played.get(right.id);
    return Number(rightStats?.playCount || 0) - Number(leftStats?.playCount || 0)
      || Number(rightStats?.lastPlayedAt || 0) - Number(leftStats?.lastPlayedAt || 0)
      || Number(sourceOrder.get(left.id)) - Number(sourceOrder.get(right.id));
  }).slice(0, 30);
  const hasStats = state.library.some((question) => Number(question.playCount) > 0);
  return shell(
    'QUESTION LIBRARY',
    '人気のお題ライブラリ',
    'みんなが実際に遊んだ回数をもとに、人気のお題を見つけられます。',
    `<section class="challenge-panel">
      <p class="challenge-library-status">${hasStats
        ? '回答完了回数が多い順に表示しています。'
        : 'まだ集計がないため、おすすめのお題を表示しています。'}</p>
      <div class="challenge-library" data-testid="question-library">
        ${cards.map((card, index) => {
          const stats = played.get(card.id);
          return `<article class="challenge-library-card">
            <div><span>${index + 1}</span><small>${escapeHtml(card.category)}</small></div>
            <h2>${escapeHtml(card.title)}</h2>
            <p>${card.choices.map(escapeHtml).join(' ／ ')}</p>
            <strong>${hasStats ? `${Number(stats?.playCount || 0)}回プレイ` : 'おすすめ'}</strong>
            <a class="challenge-secondary" href="/challenge?question=${encodeURIComponent(card.id)}">このお題を入れて作る</a>
          </article>`;
        }).join('')}
      </div>
      <a class="challenge-primary" href="/challenge">ランダム10問で作る</a>
    </section>`,
  );
}

function errorView() {
  return shell(
    'ERROR',
    'クイズを開けませんでした',
    'URLの期限が切れているか、通信に失敗した可能性があります。',
    '<section class="challenge-panel"><a class="challenge-primary" href="/challenge">新しいクイズを作る</a></section>',
  );
}

function bindEvents() {
  document.querySelector('[data-action="start-create"]')?.addEventListener('click', startCreate);
  document.querySelector('[data-action="resume-create"]')?.addEventListener('click', resumeCreate);
  document.querySelector('[data-action="delete-draft"]')?.addEventListener('click', deleteCreatorDraft);
  document.querySelector('[data-action="previous-question"]')?.addEventListener('click', previousQuestion);
  document.querySelectorAll('[data-action="answer"]').forEach((button) => {
    button.addEventListener('click', () => answerQuestion(Number(button.dataset.choice)));
  });
  document.querySelectorAll('[data-action="copy-url"], [data-action="copy-ranking"]').forEach((button) => {
    button.addEventListener('click', () => copyValue(button));
  });
  document.querySelector('[data-action="refresh-manage"]')?.addEventListener('click', loadManageRoom);
  document.querySelector('[data-action="refresh-ranking"]')?.addEventListener('click', loadRanking);
  document.querySelector('[data-action="join"]')?.addEventListener('click', joinRoom);
  document.querySelector('[data-action="share-result"]')?.addEventListener('click', shareResult);
  if (document.getElementById('challenge-qr') && state.room) {
    QRCode.toCanvas(
      document.getElementById('challenge-qr'),
      challengeUrl(state.room.code),
      { width: 180, margin: 1, color: { dark: '#1b1b1b', light: '#ffffff' } },
    ).catch(() => {});
  }
}

function startCreate() {
  const name = document.getElementById('creator-name')?.value.trim().slice(0, 12) || '';
  if (!name) return setState({ error: 'name-required', creatorName: '' });
  if (allCards.length < QUESTION_COUNT) return setState({ error: 'questions-unavailable' });
  const preferredCard = allCards.find((card) => card.id === preferredCardId);
  const pool = preferredCard ? allCards.filter((card) => card.id !== preferredCard.id) : allCards;
  const cards = preferredCard
    ? [preferredCard, ...pickChallengeCards(pool, QUESTION_COUNT - 1)]
    : pickChallengeCards(pool, QUESTION_COUNT);
  const next = {
    creatorName: name,
    cards,
    answers: [],
    questionIndex: 0,
    error: '',
    mode: 'creator-answer',
  };
  saveCreatorDraft(next);
  setState(next);
}

function resumeCreate() {
  const draft = creatorDraft();
  if (!draft) return setState({ error: 'draft-not-found' });
  setState({
    mode: 'creator-answer',
    creatorName: draft.creatorName,
    cards: draft.cards,
    answers: draft.answers,
    questionIndex: Math.min(Math.max(Number(draft.questionIndex) || 0, 0), QUESTION_COUNT - 1),
    error: '',
  });
}

function deleteCreatorDraft() {
  localStorage.removeItem(CREATOR_DRAFT_KEY);
  setState({ error: '' });
}

function previousQuestion() {
  if (state.questionIndex <= 0) return;
  const questionIndex = state.questionIndex - 1;
  setState({ questionIndex });
  saveCurrentProgress({ questionIndex });
}

async function answerQuestion(choice) {
  const answers = state.answers.slice();
  answers[state.questionIndex] = choice;
  if (state.questionIndex < QUESTION_COUNT - 1) {
    const questionIndex = state.questionIndex + 1;
    saveCurrentProgress({ answers, questionIndex });
    return setState({ answers, questionIndex });
  }
  if (answers.length !== QUESTION_COUNT || answers.some((answer) => !Number.isInteger(answer))) return;

  if (state.mode === 'creator-answer') {
    setState({ loading: true, error: '' });
    try {
      const response = await fetch('/api/challenge/rooms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ creatorName: state.creatorName, cards: state.cards, answers }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'create-failed');
      saveManageRoom(data.code, data.manageToken, data.room.creatorName);
      localStorage.removeItem(CREATOR_DRAFT_KEY);
      history.replaceState(null, '', `/challenge/manage?room=${data.code}#manage=${data.manageToken}`);
      setState({
        loading: false,
        roomCode: data.code,
        room: data.room,
        manageToken: data.manageToken,
        participants: [],
        mode: 'manage',
        answers,
      });
    } catch (error) {
      setState({ loading: false, mode: 'creator-answer', error: error.message });
    }
    return;
  }

  setState({ loading: true, answers, error: '' });
  saveParticipantDraft({ answers, questionIndex: state.questionIndex });
  try {
    const response = await fetch(`/api/challenge/rooms/${state.roomCode}/submit`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-challenge-participant-token': state.participantToken,
      },
      body: JSON.stringify({ answers }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'submit-failed');
    localStorage.removeItem(participantDraftKey(state.roomCode));
    await loadResult();
  } catch (error) {
    setState({ loading: false, mode: 'participant-answer', error: error.message });
  }
}

async function copyValue(button) {
  const value = button.dataset.copyValue || document.getElementById('share-url')?.value || '';
  try {
    await navigator.clipboard.writeText(value);
    button.textContent = 'コピーしました';
  } catch (error) {
    const input = document.getElementById('share-url');
    input?.select();
    setState({ error: 'copy-failed' });
  }
}

async function joinRoom() {
  const name = document.getElementById('participant-name')?.value.trim().slice(0, 12) || '';
  if (!name) return setState({ error: 'name-required' });
  if (!document.getElementById('ranking-consent')?.checked) {
    return setState({ error: 'ranking-consent-required', participantName: name });
  }
  setState({ loading: true, participantName: name, error: '' });
  try {
    const headers = { 'content-type': 'application/json' };
    if (state.participantToken) headers['x-challenge-participant-token'] = state.participantToken;
    const response = await fetch(`/api/challenge/rooms/${state.roomCode}/join`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, rankingConsent: true }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'join-failed');
    saveParticipantToken(state.roomCode, data.participantToken);
    if (data.participant.submitted) {
      setState({ participantToken: data.participantToken });
      await loadResult(data.participantToken);
      return;
    }
    const next = {
      loading: false,
      participantToken: data.participantToken,
      participantName: data.participant.name,
      cards: state.room.cards,
      answers: [],
      questionIndex: 0,
      mode: 'participant-answer',
    };
    setState(next);
    saveParticipantDraft(next);
  } catch (error) {
    setState({ loading: false, mode: 'join', error: error.message });
  }
}

async function loadRoom() {
  setState({ loading: true, error: '' });
  try {
    const response = await fetch(`/api/challenge/rooms/${roomCode}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'room-not-found');
    setState({ loading: false, room: data.room, cards: data.room.cards, mode: 'join' });
    if (!state.participantToken) return;
    const resultResponse = await fetch(`/api/challenge/rooms/${roomCode}/result`, {
      headers: { 'x-challenge-participant-token': state.participantToken },
    });
    if (resultResponse.ok) {
      setState({ result: await resultResponse.json(), mode: 'result' });
      return;
    }
    const resumeResponse = await fetch(`/api/challenge/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-challenge-participant-token': state.participantToken,
      },
      body: '{}',
    });
    if (!resumeResponse.ok) return;
    const resumeData = await resumeResponse.json();
    const draft = participantDraft(roomCode);
    setState({
      participantName: resumeData.participant.name,
      answers: draft?.answers || [],
      questionIndex: Math.min(Math.max(Number(draft?.questionIndex) || 0, 0), QUESTION_COUNT - 1),
      mode: 'participant-answer',
    });
  } catch (error) {
    setState({ loading: false, mode: 'error', error: error.message });
  }
}

async function loadManageRoom() {
  if (!state.roomCode || !state.manageToken) {
    return setState({ loading: false, mode: 'error', error: 'manage-forbidden' });
  }
  setState({ loading: true, error: '' });
  try {
    const response = await fetch(`/api/challenge/rooms/${state.roomCode}/manage`, {
      headers: { 'x-challenge-manage-token': state.manageToken },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'manage-forbidden');
    saveManageRoom(state.roomCode, state.manageToken, data.room.creatorName);
    setState({
      loading: false,
      room: data.room,
      cards: data.room.cards,
      participants: data.participants || [],
      mode: 'manage',
    });
  } catch (error) {
    setState({ loading: false, mode: 'error', error: error.message });
  }
}

async function loadRanking() {
  if (!state.roomCode) return setState({ loading: false, mode: 'error', error: 'room-not-found' });
  setState({ loading: true, error: '' });
  try {
    const response = await fetch(`/api/challenge/rooms/${state.roomCode}/ranking`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'room-not-found');
    setState({
      loading: false,
      room: data.room,
      ranking: data.participants || [],
      mode: 'ranking',
    });
  } catch (error) {
    setState({ loading: false, mode: 'error', error: error.message });
  }
}

async function loadLibrary() {
  setState({ loading: true, error: '' });
  try {
    const response = await fetch('/api/challenge/library');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'library-failed');
    setState({ loading: false, library: data.questions || [], mode: 'library' });
  } catch (error) {
    setState({ loading: false, library: [], mode: 'library', error: error.message });
  }
}

async function loadResult(token = state.participantToken) {
  const response = await fetch(`/api/challenge/rooms/${state.roomCode}/result`, {
    headers: { 'x-challenge-participant-token': token },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'result-failed');
  setState({ loading: false, result: data, mode: 'result' });
}

async function shareResult() {
  const text = `${state.result.creatorName}さんの答え当てに挑戦して${state.result.score}/10問正解、${state.result.completedParticipants}人中${state.result.rank}位！\n#わたちゃん\n${location.origin}/challenge/ranking?room=${state.result.code}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'みんなに挑戦してもらう', text });
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

function saveCurrentProgress(patch) {
  if (state.mode === 'creator-answer') {
    saveCreatorDraft({ ...state, ...patch });
  } else if (state.mode === 'participant-answer') {
    saveParticipantDraft({ ...state, ...patch });
  }
}

function saveCreatorDraft(value) {
  writeStorage(CREATOR_DRAFT_KEY, {
    creatorName: value.creatorName,
    cards: value.cards,
    answers: value.answers,
    questionIndex: value.questionIndex,
    updatedAt: Date.now(),
  });
}

function creatorDraft() {
  const draft = readStorage(CREATOR_DRAFT_KEY);
  return draft && typeof draft.creatorName === 'string'
    && Array.isArray(draft.cards) && draft.cards.length === QUESTION_COUNT
    && Array.isArray(draft.answers)
    ? draft
    : null;
}

function saveParticipantDraft(value) {
  if (!state.roomCode) return;
  writeStorage(participantDraftKey(state.roomCode), {
    participantName: value.participantName || state.participantName,
    answers: value.answers || [],
    questionIndex: Number(value.questionIndex) || 0,
    updatedAt: Date.now(),
  });
}

function participantDraft(code) {
  const draft = readStorage(participantDraftKey(code));
  return draft && Array.isArray(draft.answers) ? draft : null;
}

function participantDraftKey(code) {
  return `watachan-challenge-participant-draft:${code}:v1`;
}

function participantToken(code) {
  return localStorage.getItem(`watachan-challenge-token:${code}`)
    || sessionStorage.getItem(`watachan-challenge-token:${code}`)
    || '';
}

function saveParticipantToken(code, token) {
  localStorage.setItem(`watachan-challenge-token:${code}`, token);
  sessionStorage.setItem(`watachan-challenge-token:${code}`, token);
}

function saveManageRoom(code, token, creatorName) {
  const next = [
    { code, token, creatorName, updatedAt: Date.now() },
    ...manageHistory().filter((item) => item.code !== code),
  ].slice(0, 5);
  writeStorage(MANAGE_HISTORY_KEY, next);
}

function manageHistory() {
  const value = readStorage(MANAGE_HISTORY_KEY);
  return Array.isArray(value)
    ? value.filter((item) => /^[A-Z2-9]{8}$/.test(item.code) && /^[a-f0-9]{48}$/i.test(item.token))
    : [];
}

function readStorage(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch (error) {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // 保存容量不足でもゲーム進行は継続する。
  }
}

function challengeUrl(code) {
  return `${location.origin}/challenge?room=${code}`;
}

function manageUrl(code, token) {
  return `/challenge/manage?room=${code}#manage=${token}`;
}

function shareText(room, url) {
  return `${room.creatorName}さんから「私のこと、ちゃんと分かってるよね？」の挑戦！\n10問の答えを予想してね👇\n${url}`;
}

function errorMessage(code) {
  return ({
    'name-required': '名前を入力してください。',
    'room-full': 'このクイズは上限の50人に達しました。',
    'room-not-found': 'クイズが見つからないか、有効期限が切れています。',
    'questions-unavailable': '問題データを読み込めませんでした。',
    'participant-forbidden': '参加情報を確認できません。もう一度URLを開いてください。',
    'answers-already-submitted': 'この参加者の回答はすでに確定しています。',
    'manage-forbidden': '主催者用URLを確認できません。',
    'ranking-consent-required': 'ランキングと主催者への表示内容を確認し、同意欄にチェックしてください。',
    'draft-not-found': '途中保存データが見つかりません。',
    'copy-failed': '自動コピーできませんでした。URL欄を長押ししてコピーしてください。',
    'library-failed': '人気のお題を読み込めませんでした。',
  })[code] || '通信に失敗しました。時間をおいてもう一度お試しください。';
}

if (state.mode === 'library') {
  document.title = '人気のお題ライブラリ｜私のこと、ちゃんと分かってるよね？';
  loadLibrary();
} else if (state.mode === 'ranking') {
  document.title = 'フレンドランキング｜私のこと、ちゃんと分かってるよね？';
  loadRanking();
} else if (state.mode === 'manage') {
  document.title = '主催者用回答管理｜私のこと、ちゃんと分かってるよね？';
  loadManageRoom();
} else if (state.mode === 'join') {
  loadRoom();
} else {
  render();
}
