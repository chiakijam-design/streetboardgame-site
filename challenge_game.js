import QRCode from 'qrcode';
import { mergeChallengeCards, pickChallengeCards } from './src/challenge/data.js';

const COLORS = ['#77bb62', '#3f78bd', '#f5c83b', '#d3313b', '#ef8730'];
const COLOR_NAMES = ['緑', '青', '黄', '赤', '橙'];
const QUESTION_COUNT = 10;
const app = document.getElementById('challenge-app');
const allCards = mergeChallengeCards(window.FRIEND_CARDS, window.FAMILY_CARDS);
const roomCode = new URL(location.href).searchParams.get('room')?.trim().toUpperCase() || '';
const initialManageToken = new URLSearchParams(location.hash.slice(1)).get('manage') || '';
let state = {
  mode: roomCode ? (initialManageToken ? 'manage' : 'join') : 'create',
  roomCode,
  room: null,
  cards: [],
  answers: [],
  questionIndex: 0,
  creatorName: '',
  participantName: '',
  participantToken: roomCode ? sessionStorage.getItem(`watachan-challenge-token:${roomCode}`) || '' : '',
  manageToken: initialManageToken,
  result: null,
  error: '',
  loading: false,
};

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
    ? `<section class="challenge-panel challenge-centered" aria-live="polite"><div class="challenge-loader"></div><p>読み込み中です…</p></section>`
    : state.mode === 'create' ? createStartView()
      : state.mode === 'creator-answer' ? questionView(true)
        : state.mode === 'share' || state.mode === 'manage' ? shareView()
          : state.mode === 'join' ? joinView()
            : state.mode === 'participant-answer' ? questionView(false)
              : state.mode === 'result' ? resultView()
                : errorView();
  app.innerHTML = body;
  bindEvents();
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
  return shell(
    'NEW MODE',
    'みんなに挑戦してもらう',
    '先に自分が10問に回答。できたURLを送ると、最大50人があなたの答え当てに挑戦できます。',
    `<section class="challenge-panel">
      <h2>あなたのクイズを作る</h2>
      <ol class="challenge-steps">
        <li><b>あなた</b>がランダムな10問に回答</li>
        <li>専用URLをLINEやXで共有</li>
        <li>みんなの得点と順位を表示</li>
      </ol>
      <label class="challenge-label" for="creator-name">出題者の名前（12文字まで）</label>
      <input id="creator-name" class="challenge-input" maxlength="12" autocomplete="nickname"
        placeholder="例：ちあき" value="${escapeHtml(state.creatorName)}">
      <button class="challenge-primary" data-action="start-create">10問に答えてクイズを作る <span>▶</span></button>
      <p class="challenge-note">友達版54問と家族版54問を統合し、同じお題14件を除いた94問から出題します。</p>
    </section>`,
  );
}

function questionView(isCreator) {
  const card = state.cards[state.questionIndex];
  const actor = isCreator ? state.creatorName : state.participantName;
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
            <button data-action="answer" data-choice="${index}" class="challenge-choice">
              <i style="background:${COLORS[index]}" aria-hidden="true"></i>
              <span>${escapeHtml(choice)}</span>
              <small>${COLOR_NAMES[index]}</small>
            </button>
          `).join('')}
        </div>
      </article>
    </section>`,
  );
}

function shareView() {
  const room = state.room;
  if (!room) return errorView();
  const shareUrl = `${location.origin}/challenge?room=${room.code}`;
  const manageCopy = state.mode === 'manage'
    ? `<div class="challenge-count" data-testid="participant-count">
        <b>${room.completedParticipants}</b>人回答済み ／ <b>${room.participantCount}</b>人参加 ／ 上限${room.maxParticipants}人
      </div>`
    : '';
  return shell(
    'SHARE',
    'クイズができました',
    `${room.creatorName}さんの答えを、みんなに予想してもらいましょう。`,
    `<section class="challenge-panel">
      ${manageCopy}
      <label class="challenge-label" for="share-url">挑戦用URL</label>
      <input id="share-url" class="challenge-input" readonly value="${escapeHtml(shareUrl)}">
      <button class="challenge-primary" data-action="copy-url">URLをコピー</button>
      <div class="challenge-share-row">
        <a class="challenge-share line" target="_blank" rel="noopener"
          href="https://line.me/R/msg/text/?${encodeURIComponent(shareText(room, shareUrl))}">LINEで送る</a>
        <a class="challenge-share x" target="_blank" rel="noopener"
          href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText(room, shareUrl))}">Xでシェア</a>
      </div>
      <div class="challenge-qr"><canvas id="challenge-qr" width="180" height="180" aria-label="挑戦用URLのQRコード"></canvas></div>
      <p class="challenge-note">このURLは50人に達するまで繰り返し使えます。クイズは作成から30日後に自動削除されます。</p>
      ${state.mode === 'manage' ? '<button class="challenge-secondary" data-action="refresh-manage">回答人数を更新</button>' : ''}
      <a class="challenge-secondary" href="/challenge">別のクイズを作る</a>
    </section>`,
  );
}

function joinView() {
  if (!state.room) return errorView();
  const room = state.room;
  if (room.full && !state.participantToken) {
    return shell(
      'FULL',
      '参加受付は終了しました',
      `このクイズは上限の${room.maxParticipants}人に達しました。`,
      '<section class="challenge-panel"><a class="challenge-primary" href="/challenge">自分のクイズを作る</a></section>',
    );
  }
  return shell(
    'CHALLENGE',
    `${room.creatorName}さんからの挑戦`,
    '10問に答えて、出題者のことをどれだけ分かっているか確かめよう。',
    `<section class="challenge-panel">
      <div class="challenge-count"><b>${room.completedParticipants}</b>人が回答済み ／ 上限${room.maxParticipants}人</div>
      <label class="challenge-label" for="participant-name">あなたの名前（12文字まで）</label>
      <input id="participant-name" class="challenge-input" maxlength="12" autocomplete="nickname"
        placeholder="例：ゆう" value="${escapeHtml(state.participantName)}">
      <button class="challenge-primary" data-action="join">10問の答え当てに挑戦する <span>▶</span></button>
      <p class="challenge-note">名前は出題者を含む他の参加者には公開されません。結果には自分の順位だけを表示します。</p>
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
      <button class="challenge-primary" data-action="share-result">結果をシェア</button>
      <a class="challenge-secondary" href="/challenge">自分もクイズを作る</a>
      <a class="challenge-secondary" href="/">トップへ戻る</a>
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
  document.querySelectorAll('[data-action="answer"]').forEach((button) => {
    button.addEventListener('click', () => answerQuestion(Number(button.dataset.choice)));
  });
  document.querySelector('[data-action="copy-url"]')?.addEventListener('click', copyUrl);
  document.querySelector('[data-action="refresh-manage"]')?.addEventListener('click', loadManageRoom);
  document.querySelector('[data-action="join"]')?.addEventListener('click', joinRoom);
  document.querySelector('[data-action="share-result"]')?.addEventListener('click', shareResult);
  if (document.getElementById('challenge-qr') && state.room) {
    QRCode.toCanvas(
      document.getElementById('challenge-qr'),
      `${location.origin}/challenge?room=${state.room.code}`,
      { width: 180, margin: 1, color: { dark: '#1b1b1b', light: '#ffffff' } },
    ).catch(() => {});
  }
}

function startCreate() {
  const name = document.getElementById('creator-name')?.value.trim().slice(0, 12) || '';
  if (!name) return setState({ error: 'name-required', creatorName: '' });
  if (allCards.length < QUESTION_COUNT) return setState({ error: 'questions-unavailable' });
  setState({
    creatorName: name,
    cards: pickChallengeCards(allCards),
    answers: [],
    questionIndex: 0,
    error: '',
    mode: 'creator-answer',
  });
}

async function answerQuestion(choice) {
  const answers = [...state.answers, choice];
  if (state.questionIndex < QUESTION_COUNT - 1) {
    return setState({ answers, questionIndex: state.questionIndex + 1 });
  }
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
      history.replaceState(null, '', `/challenge?room=${data.code}#manage=${data.manageToken}`);
      setState({
        loading: false,
        roomCode: data.code,
        room: data.room,
        manageToken: data.manageToken,
        mode: 'manage',
        answers,
      });
    } catch (error) {
      setState({ loading: false, mode: 'create', error: error.message });
    }
    return;
  }

  setState({ loading: true, answers, error: '' });
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
    await loadResult();
  } catch (error) {
    setState({ loading: false, mode: 'join', error: error.message });
  }
}

async function copyUrl() {
  const shareUrl = `${location.origin}/challenge?room=${state.room.code}`;
  try {
    await navigator.clipboard.writeText(shareUrl);
    const button = document.querySelector('[data-action="copy-url"]');
    if (button) button.textContent = 'コピーしました';
  } catch (error) {
    document.getElementById('share-url')?.select();
  }
}

async function joinRoom() {
  const name = document.getElementById('participant-name')?.value.trim().slice(0, 12) || '';
  if (!name) return setState({ error: 'name-required' });
  setState({ loading: true, participantName: name, error: '' });
  try {
    const headers = { 'content-type': 'application/json' };
    if (state.participantToken) headers['x-challenge-participant-token'] = state.participantToken;
    const response = await fetch(`/api/challenge/rooms/${state.roomCode}/join`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'join-failed');
    sessionStorage.setItem(`watachan-challenge-token:${state.roomCode}`, data.participantToken);
    if (data.participant.submitted) {
      setState({ participantToken: data.participantToken });
      await loadResult(data.participantToken);
      return;
    }
    setState({
      loading: false,
      participantToken: data.participantToken,
      cards: state.room.cards,
      answers: [],
      questionIndex: 0,
      mode: 'participant-answer',
    });
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
    const next = { loading: false, room: data.room, cards: data.room.cards, mode: 'join' };
    setState(next);
    if (state.participantToken) {
      const resultResponse = await fetch(`/api/challenge/rooms/${roomCode}/result`, {
        headers: { 'x-challenge-participant-token': state.participantToken },
      });
      if (resultResponse.ok) {
        setState({ result: await resultResponse.json(), mode: 'result' });
      }
    }
  } catch (error) {
    setState({ loading: false, mode: 'error', error: error.message });
  }
}

async function loadManageRoom() {
  setState({ loading: true, error: '' });
  try {
    const response = await fetch(`/api/challenge/rooms/${state.roomCode}/manage`, {
      headers: { 'x-challenge-manage-token': state.manageToken },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'manage-forbidden');
    setState({ loading: false, room: data.room, mode: 'manage' });
  } catch (error) {
    setState({ loading: false, mode: 'error', error: error.message });
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
  const text = `${state.room.creatorName}さんの答え当てに挑戦して${state.result.score}/10問正解、${state.result.completedParticipants}人中${state.result.rank}位！\n#わたちゃん\n${location.origin}/challenge`;
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
    'manage-forbidden': '出題者用リンクを確認できません。',
  })[code] || '通信に失敗しました。時間をおいてもう一度お試しください。';
}

if (!roomCode) {
  render();
} else if (initialManageToken) {
  loadManageRoom();
} else {
  loadRoom();
}
