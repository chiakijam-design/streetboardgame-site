import { LIVE_QUESTION_TYPES, LIVE_SERIES, LIVE_TYPE_LABELS } from './src/live/config.js';
import { createLiveQuestion, recommendYouTubeCandidates, validateLiveDraft } from './src/live/model.js';

const root = document.getElementById('liveRoot');
const query = new URLSearchParams(location.search);
const initialRoomCode = String(query.get('room') || '').replace(/\D/g, '').slice(0, 6);
const state = {
  view: initialRoomCode ? 'room-loading' : 'entry',
  roomCode: initialRoomCode,
  game: null,
  error: '',
  draft: null,
  candidates: [],
  youtubeQuestionType: '',
  channelUrl: '',
  channelProfile: null,
  hostToken: initialRoomCode ? sessionStorage.getItem(`live:host:${initialRoomCode}`) || '' : '',
  participantToken: initialRoomCode ? sessionStorage.getItem(`live:participant:${initialRoomCode}`) || '' : '',
  pollTimer: null,
};

document.title = `${LIVE_SERIES.name} | わたちゃん`;
if (initialRoomCode) initializeRoom();
else render();

function render() {
  if (state.view === 'room-loading') return setPage('<div class="loading">ルームを読み込んでいます…</div>', false);
  if (state.view === 'entry') return renderEntry();
  if (state.view === 'manual-editor' || state.view === 'youtube-editor') return renderEditor();
  if (state.view === 'youtube-setup') return renderYouTubeSetup();
  if (state.view === 'youtube-candidates') return renderYouTubeCandidates();
  if (state.view === 'join') return renderJoin();
  if (state.view === 'host') return renderHost();
  if (state.view === 'participant') return renderParticipant();
  return setPage('<div class="panel"><h2>画面を表示できませんでした</h2></div>');
}

function renderEntry() {
  setPage(`
    <section class="hero">
      <span class="eyebrow">NEW SERIES</span>
      <h1>${escapeHtml(LIVE_SERIES.name)}</h1>
      <p>${escapeHtml(LIVE_SERIES.entryLead)}</p>
    </section>
    <section class="grid entry-grid" aria-label="ゲームの作り方を選ぶ">
      <button class="entry-card" data-action="manual-entry">
        <span class="entry-icon" aria-hidden="true">✍️</span>
        <strong>${escapeHtml(LIVE_SERIES.manualEntry)}</strong>
        <small>タイトル・主役・問題・選択肢を自由に入力してライブ投票を始めます。</small>
      </button>
      <button class="entry-card" data-action="youtube-entry">
        <span class="entry-icon" aria-hidden="true">▶️</span>
        <strong>${escapeHtml(LIVE_SERIES.youtubeEntry)}</strong>
        <small>2つの遊び方から1つを選び、公開チャンネル情報をもとに作った30問から採用する問題を選べます。</small>
      </button>
    </section>
    <section class="panel" style="margin-top:18px">
      <h2>ルームに参加する</h2>
      <p class="help">司会者から受け取った6桁のコードを入力してください。</p>
      <div class="field"><label for="entryRoomCode">ルームコード</label><input id="entryRoomCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="123456"></div>
      <div class="error" id="entryCodeError" role="alert" hidden>6桁のルームコードを入力してください</div>
      <button class="secondary" id="joinByCode" style="width:100%;margin-top:12px">コードで参加</button>
    </section>
  `);
  bind('[data-action="manual-entry"]', 'click', () => {
    state.draft = createBlankDraft();
    state.view = 'manual-editor';
    render();
  });
  bind('[data-action="youtube-entry"]', 'click', () => {
    state.view = 'youtube-setup';
    state.error = '';
    render();
  });
  bind('#entryRoomCode', 'input', (event) => { event.target.value = event.target.value.replace(/\D/g, '').slice(0, 6); });
  bind('#joinByCode', 'click', () => {
    const code = document.getElementById('entryRoomCode').value;
    if (!/^\d{6}$/.test(code)) {
      document.getElementById('entryRoomCode').setAttribute('aria-invalid', 'true');
      document.getElementById('entryCodeError').hidden = false;
      return;
    }
    location.assign(`/live?room=${code}`);
  });
}

function renderYouTubeSetup() {
  setPage(`
    <section class="panel">
      <span class="eyebrow">YOUTUBE MODE</span>
      <h2 style="margin-top:12px">${escapeHtml(LIVE_SERIES.youtubeEntry)}</h2>
      <div class="field">
        <label for="channelUrl">YouTubeチャンネル・動画URL</label>
        <input id="channelUrl" type="url" inputmode="url" autocomplete="url" placeholder="https://www.youtube.com/@handle または watch?v=..." value="${escapeAttr(state.channelUrl)}">
        <p class="help">チャンネルURLのほか、通常動画・短縮URL・Shorts・ライブのURLにも対応しています。動画URLの場合は投稿元チャンネルを自動で特定します。</p>
      </div>
      ${errorHtml()}
      <div id="youtubeGenerationChoices" class="grid" style="margin-top:16px" ${state.channelUrl.trim() ? '' : 'hidden'}>
        <button class="primary" data-youtube-type="guess-person">${escapeHtml(LIVE_SERIES.youtubePersonGenerateLabel)} <span class="accent">▶</span></button>
        <button class="secondary" data-youtube-type="guess-majority">${escapeHtml(LIVE_SERIES.youtubeMajorityGenerateLabel)} <span class="accent">▶</span></button>
      </div>
    </section>
  `);
  bind('#channelUrl', 'input', (event) => {
    state.channelUrl = event.target.value;
    document.getElementById('youtubeGenerationChoices').hidden = !state.channelUrl.trim();
  });
  document.querySelectorAll('[data-youtube-type]').forEach((button) => button.addEventListener('click', () => {
    generateYouTubeCandidates(button.dataset.youtubeType);
  }));
}

async function generateYouTubeCandidates(questionType) {
  state.error = '';
  state.youtubeQuestionType = questionType;
  document.querySelectorAll('[data-youtube-type]').forEach((button) => {
    button.disabled = true;
    if (button.dataset.youtubeType === questionType) button.textContent = '投稿元チャンネルと動画情報を確認しています…';
  });
  try {
    const response = await api('/api/live/youtube-candidates', {
      method: 'POST',
      body: JSON.stringify({ channelUrl: state.channelUrl, questionType }),
    });
    state.channelUrl = response.channelUrl;
    state.channelProfile = response.profile;
    state.youtubeQuestionType = response.questionType || questionType;
    state.candidates = response.questions.map((question) => createLiveQuestion({
      ...question,
      type: state.youtubeQuestionType,
    }));
    state.view = 'youtube-candidates';
  } catch (error) {
    state.error = humanError(error);
  }
  render();
}

function renderYouTubeCandidates() {
  const selectedCount = state.candidates.filter((question) => question.selected).length;
  const typeLabel = LIVE_TYPE_LABELS[state.youtubeQuestionType] || '';
  setPage(`
    <section class="panel">
      <span class="eyebrow">30 QUESTIONS</span>
      <h2 style="margin-top:12px">${escapeHtml(state.channelProfile?.channelName || 'YouTubeチャンネル')}</h2>
      <p class="help">「${escapeHtml(typeLabel)}」の30問から、採用する問題を1問以上、好きな数だけ選べます。このゲームではもう一方の種類とは混ざりません。</p>
      ${state.channelProfile?.inputKind === 'video' ? `<div class="notice">動画URLから投稿元の「${escapeHtml(state.channelProfile?.channelName || 'YouTubeチャンネル')}」を特定し、チャンネル内の公開動画をもとに候補を作りました。</div>` : ''}
      ${state.channelProfile?.videoTitles?.length ? `<div class="notice">公開動画 ${state.channelProfile.videoTitles.length}件の${state.channelProfile.videoDescriptionCount ? 'タイトル・公開説明' : 'タイトル'}から、このチャンネル向けのお題を作成しました。</div>` : ''}
      ${state.channelProfile?.source === 'url-fallback' ? '<div class="notice">YouTube側から公開情報を取得できなかったため、チャンネルURLの名前を使った候補を作成しました。</div>' : ''}
      <div class="actions">
        <button class="secondary" id="autoRecommend">おすすめ問題を自動選択</button>
        <button class="mini" id="backYoutube">URLを変更</button>
      </div>
      <div class="notice">選択中：${escapeHtml(typeLabel)}（30問）</div>
      <div class="candidate-list">
        ${state.candidates.map((question, index) => candidateCard(question, index, state.candidates.length)).join('')}
      </div>
      ${errorHtml()}
      <div class="sticky-actions">
        <button class="primary" id="useCandidates" ${selectedCount < 1 ? 'disabled' : ''}>選んだ${selectedCount}問を編集する <span class="accent">▶</span></button>
      </div>
    </section>
  `);
  document.querySelectorAll('[data-candidate-index]').forEach((card) => bindCandidateCard(card));
  bind('#autoRecommend', 'click', () => {
    state.candidates = recommendYouTubeCandidates(state.candidates, 5);
    render();
  });
  bind('#backYoutube', 'click', () => { state.view = 'youtube-setup'; render(); });
  bind('#useCandidates', 'click', () => {
    const selected = state.candidates.filter((question) => question.selected);
    if (!selected.length) { state.error = '使用する問題を1問以上選んでください'; return render(); }
    state.draft = {
      creationMode: 'youtube',
      title: `${state.channelProfile?.channelName || 'YouTube'} ${LIVE_SERIES.name}`,
      subjectName: state.channelProfile?.channelName || '',
      questions: selected.map((question) => createLiveQuestion({ ...question, id: undefined })),
    };
    state.view = 'youtube-editor';
    state.error = '';
    render();
  });
}

function candidateCard(question, index, candidateCount) {
  return `
    <article class="question-card" data-candidate-index="${index}">
      <div class="question-head">
        <label class="check"><input type="checkbox" data-field="selected" ${question.selected ? 'checked' : ''}>使用する</label>
        <div class="order">
          <button class="mini" data-action="candidate-up" ${index === 0 ? 'disabled' : ''} aria-label="上へ移動">↑</button>
          <button class="mini" data-action="candidate-down" ${index === candidateCount - 1 ? 'disabled' : ''} aria-label="下へ移動">↓</button>
        </div>
      </div>
      <div class="field"><label>問題文</label><textarea data-field="text">${escapeHtml(question.text)}</textarea></div>
      <div class="field"><span class="field-label">問題タイプ</span><span class="badge">${escapeHtml(LIVE_TYPE_LABELS[question.type] || '')}</span></div>
      <div class="field"><span class="field-label">選択肢</span>
        ${question.options.map((option, optionIndex) => `<input data-option-index="${optionIndex}" value="${escapeAttr(option)}" aria-label="選択肢${optionIndex + 1}">`).join('')}
      </div>
      <button class="mini" data-action="regenerate" style="margin-top:12px">この問題だけ再生成</button>
    </article>
  `;
}

function bindCandidateCard(card) {
  const index = Number(card.dataset.candidateIndex);
  const question = state.candidates[index];
  card.querySelector('[data-field="selected"]').addEventListener('change', (event) => { question.selected = event.target.checked; render(); });
  card.querySelector('[data-field="text"]').addEventListener('input', (event) => { question.text = event.target.value; });
  card.querySelectorAll('[data-option-index]').forEach((input) => input.addEventListener('input', (event) => {
    question.options[Number(input.dataset.optionIndex)] = event.target.value;
  }));
  card.querySelector('[data-action="candidate-up"]').addEventListener('click', () => moveCandidate(index, -1));
  card.querySelector('[data-action="candidate-down"]').addEventListener('click', () => moveCandidate(index, 1));
  card.querySelector('[data-action="regenerate"]').addEventListener('click', () => regenerateCandidate(index));
}

function moveCandidate(index, direction) {
  const otherIndex = index + direction;
  if (otherIndex < 0 || otherIndex >= state.candidates.length) return;
  [state.candidates[index], state.candidates[otherIndex]] = [state.candidates[otherIndex], state.candidates[index]];
  render();
}

async function regenerateCandidate(index) {
  const current = state.candidates[index];
  state.error = '';
  try {
    const response = await api('/api/live/youtube-candidates', {
      method: 'POST',
      body: JSON.stringify({ channelUrl: state.channelUrl, questionType: state.youtubeQuestionType, seed: Date.now() }),
    });
    const replacement = response.questions.find((question) => question.type === state.youtubeQuestionType && question.text !== current.text);
    if (!replacement) throw new Error('regenerate-failed');
    state.candidates[index] = createLiveQuestion({ ...replacement, type: state.youtubeQuestionType, selected: current.selected });
  } catch (error) {
    state.error = humanError(error);
  }
  render();
}

function renderEditor() {
  const validation = state.error ? null : validateLiveDraft(state.draft);
  const isYouTubeEditor = state.view === 'youtube-editor';
  setPage(`
    <section class="panel">
      <span class="eyebrow">GAME EDITOR</span>
      <h2 style="margin-top:12px">問題を編集する</h2>
      <p class="help">${isYouTubeEditor ? '30問の候補から選んだ問題だけを使います。各問題の選択肢は5個固定です。' : escapeHtml(LIVE_SERIES.recommendedQuestionCount)}</p>
      ${isYouTubeEditor ? `<div class="notice">このゲームの問題タイプは「${escapeHtml(LIVE_TYPE_LABELS[state.youtubeQuestionType] || '')}」で統一されます。</div>` : ''}
      <div class="field"><label for="gameTitle">ゲームタイトル</label><input id="gameTitle" maxlength="80" value="${escapeAttr(state.draft.title)}"></div>
      <div class="field"><label for="subjectName">主役または回答者の名前</label><input id="subjectName" maxlength="40" value="${escapeAttr(state.draft.subjectName)}"></div>
    </section>
    <section class="panel">
      <div class="question-head"><div><h2>問題</h2><p class="help">現在 ${state.draft.questions.length}問${isYouTubeEditor ? '（30問から選択）' : ''}</p></div>${isYouTubeEditor ? '' : '<button class="secondary" id="addQuestion">＋ 問題を追加</button>'}</div>
      <div class="question-list">
        ${state.draft.questions.map((question, index) => editorQuestionCard(question, index)).join('')}
      </div>
      ${errorHtml()}
      ${!state.error && !validation.valid ? `<div class="notice">入力途中です。開始前にすべての問題を確認します。</div>` : ''}
      <div class="sticky-actions"><button class="primary" id="createGame">ライブゲームを作成する <span class="accent">▶</span></button></div>
    </section>
  `);
  bind('#gameTitle', 'input', (event) => { state.draft.title = event.target.value; });
  bind('#subjectName', 'input', (event) => { state.draft.subjectName = event.target.value; });
  bind('#addQuestion', 'click', () => {
    state.draft.questions.push(createLiveQuestion());
    render();
  });
  document.querySelectorAll('[data-question-index]').forEach((card) => bindEditorCard(card));
  bind('#createGame', 'click', createGame);
}

function editorQuestionCard(question, index) {
  const typeInfo = LIVE_QUESTION_TYPES.find((item) => item.value === question.type);
  const isYouTubeEditor = state.view === 'youtube-editor';
  return `
    <article class="question-card" data-question-index="${index}">
      <div class="question-head">
        <div><span class="badge">Q${index + 1}</span></div>
        <div class="order">
          <button class="mini" data-action="question-up" ${index === 0 ? 'disabled' : ''} aria-label="Q${index + 1}を上へ">↑</button>
          <button class="mini" data-action="question-down" ${index === state.draft.questions.length - 1 ? 'disabled' : ''} aria-label="Q${index + 1}を下へ">↓</button>
          <button class="mini" data-action="question-delete" aria-label="Q${index + 1}を削除">削除</button>
        </div>
      </div>
      <div class="field"><label>問題文</label><textarea data-field="question-text" maxlength="180">${escapeHtml(question.text)}</textarea></div>
      <div class="field"><label>問題タイプ</label>${typeSelect(question.type, 'question-type', state.view === 'youtube-editor')}</div>
      <div class="field"><span class="field-label">${isYouTubeEditor ? '選択肢（5個固定）' : '選択肢（2〜4個）'}</span>
        ${question.options.map((option, optionIndex) => isYouTubeEditor
          ? `<input data-editor-option="${optionIndex}" maxlength="60" value="${escapeAttr(option)}" aria-label="Q${index + 1} 選択肢${optionIndex + 1}">`
          : `<div class="option-row"><input data-editor-option="${optionIndex}" maxlength="60" value="${escapeAttr(option)}" aria-label="Q${index + 1} 選択肢${optionIndex + 1}">
          <button data-action="remove-option" data-option="${optionIndex}" ${question.options.length <= 2 ? 'disabled' : ''} aria-label="選択肢${optionIndex + 1}を削除">−</button></div>`).join('')}
        ${!isYouTubeEditor && question.options.length < 4 ? '<button class="mini" data-action="add-option" style="margin-top:8px">＋ 選択肢を追加</button>' : ''}
      </div>
      ${question.type !== 'poll' ? `
        <div class="field"><label>${escapeHtml(typeInfo?.predictionLabel || '非公開回答')}</label>
          <select data-field="locked-index"><option value="">選んでください</option>${question.options.map((option, optionIndex) => `<option value="${optionIndex}" ${question.lockedIndex === optionIndex ? 'selected' : ''}>${escapeHtml(option || `選択肢${optionIndex + 1}`)}</option>`).join('')}</select>
          <p class="help">この内容は投票締切まで参加者側へ送信しません。</p>
        </div>` : ''}
    </article>
  `;
}

function bindEditorCard(card) {
  const index = Number(card.dataset.questionIndex);
  const question = state.draft.questions[index];
  card.querySelector('[data-field="question-text"]').addEventListener('input', (event) => { question.text = event.target.value; });
  card.querySelector('[data-field="question-type"]').addEventListener('change', (event) => { question.type = event.target.value; question.lockedIndex = null; render(); });
  card.querySelectorAll('[data-editor-option]').forEach((input) => input.addEventListener('input', (event) => { question.options[Number(input.dataset.editorOption)] = event.target.value; }));
  const locked = card.querySelector('[data-field="locked-index"]');
  if (locked) locked.addEventListener('change', (event) => { question.lockedIndex = event.target.value === '' ? null : Number(event.target.value); });
  card.querySelector('[data-action="question-up"]').addEventListener('click', () => moveQuestion(index, -1));
  card.querySelector('[data-action="question-down"]').addEventListener('click', () => moveQuestion(index, 1));
  card.querySelector('[data-action="question-delete"]').addEventListener('click', () => {
    if (state.draft.questions.length <= 1) { state.error = '問題は1問以上必要です'; return render(); }
    state.draft.questions.splice(index, 1); state.error = ''; render();
  });
  const addOption = card.querySelector('[data-action="add-option"]');
  if (addOption) addOption.addEventListener('click', () => { question.options.push(''); render(); });
  card.querySelectorAll('[data-action="remove-option"]').forEach((button) => button.addEventListener('click', () => {
    question.options.splice(Number(button.dataset.option), 1); question.lockedIndex = null; render();
  }));
}

function moveQuestion(index, direction) {
  const next = index + direction;
  if (next < 0 || next >= state.draft.questions.length) return;
  [state.draft.questions[index], state.draft.questions[next]] = [state.draft.questions[next], state.draft.questions[index]];
  render();
}

async function createGame() {
  const validation = validateLiveDraft(state.draft);
  if (!validation.valid) { state.error = validation.errors.join('\n'); return render(); }
  state.error = '';
  const button = document.getElementById('createGame');
  button.disabled = true;
  button.textContent = 'ルームを作成しています…';
  try {
    const response = await api('/api/live/games', { method: 'POST', body: JSON.stringify({ draft: validation.draft }) });
    state.roomCode = response.code;
    state.hostToken = response.hostToken;
    state.game = response.game;
    sessionStorage.setItem(`live:host:${state.roomCode}`, state.hostToken);
    history.replaceState({}, '', `/live?room=${state.roomCode}`);
    state.view = 'host';
    startPolling();
  } catch (error) {
    state.error = humanError(error);
  }
  render();
}

async function initializeRoom() {
  try {
    await loadRoom();
    state.view = state.hostToken && state.game?.host ? 'host' : state.participantToken ? 'participant' : 'join';
    startPolling();
  } catch (error) {
    state.error = humanError(error);
    state.view = 'join';
  }
  render();
}

function renderJoin() {
  setPage(`
    <section class="panel">
      <span class="eyebrow">JOIN LIVE</span>
      <h2 style="margin-top:12px">${escapeHtml(state.game?.title || LIVE_SERIES.name)}</h2>
      <div class="room-code" aria-label="ルームコード ${escapeAttr(state.roomCode)}">${escapeHtml(state.roomCode)}</div>
      <div class="field"><label for="participantName">あなたの名前</label><input id="participantName" maxlength="24" autocomplete="nickname" placeholder="名前を入力"></div>
      ${errorHtml()}
      <button class="primary" id="joinGame" style="margin-top:16px">参加する <span class="accent">▶</span></button>
    </section>
  `);
  bind('#joinGame', 'click', joinGame);
}

async function joinGame() {
  const name = document.getElementById('participantName').value.trim();
  if (!name) { state.error = '名前を入力してください'; return render(); }
  try {
    const response = await api(`/api/live/games/${state.roomCode}/join`, { method: 'POST', body: JSON.stringify({ name }) });
    state.participantToken = response.participantToken;
    state.game = response.game;
    sessionStorage.setItem(`live:participant:${state.roomCode}`, state.participantToken);
    state.view = 'participant';
    state.error = '';
    startPolling();
  } catch (error) { state.error = humanError(error); }
  render();
}

function renderHost() {
  const game = state.game;
  if (!game) return setPage('<div class="loading">ルームを読み込んでいます…</div>', false);
  let content = '';
  if (game.phase === 'lobby') {
    const shareUrl = `${location.origin}/live?room=${state.roomCode}`;
    content = `
      <section class="panel">
        <span class="eyebrow">HOST LOBBY</span><h2 style="margin-top:12px">${escapeHtml(game.title)}</h2>
        <p class="help">参加者にコードか参加URLを共有してください。</p>
        <div class="room-code">${escapeHtml(state.roomCode)}</div>
        <div class="field"><label for="shareUrl">参加URL</label><input id="shareUrl" readonly value="${escapeAttr(shareUrl)}"></div>
        <div class="actions"><button class="secondary" id="copyShareUrl">参加URLをコピー</button><button class="primary" id="startLive">ライブを開始する</button></div>
        ${participantHtml(game)}
      </section>
      <section class="panel"><h2>出題予定 ${game.questionCount}問</h2><div class="question-list">${(game.questions || []).map((question, index) => `<div class="question-card"><span class="badge">Q${index + 1}</span><h3 style="margin-top:8px">${escapeHtml(question.text)}</h3><p class="help">${escapeHtml(LIVE_TYPE_LABELS[question.type] || '')}</p></div>`).join('')}</div></section>`;
  } else if (game.phase === 'voting') {
    content = `<section class="panel">${liveQuestionHeader(game)}<div class="notice">投票受付中：${game.question.voteCount}票</div><div class="vote-options">${game.question.options.map((option, index) => `<div class="vote-option"><span class="badge">${index + 1}</span> ${escapeHtml(option)}</div>`).join('')}</div><button class="primary" id="closeVoting" style="margin-top:18px">投票を締め切って結果発表</button>${participantHtml(game)}</section>`;
  } else if (game.phase === 'reveal') {
    content = `<section class="panel">${liveQuestionHeader(game)}${resultBlock(game.question.result, game.subjectName)}<button class="primary" id="nextQuestion" style="margin-top:18px">${game.currentQuestionIndex + 1 >= game.questionCount ? '最終結果を見る' : '次の問題へ'} <span class="accent">▶</span></button></section>`;
  } else {
    content = `<section class="panel"><span class="eyebrow">FINISH</span><h2 style="margin-top:12px">最終結果</h2><div class="result-list">${game.results.map((result, index) => `<article class="result-card"><span class="badge">Q${index + 1}</span>${resultBlock(result, game.subjectName)}</article>`).join('')}</div><a class="primary" href="/live" style="display:block;margin-top:18px;text-align:center;text-decoration:none">新しいLIVEを作る</a></section>`;
  }
  setPage(content);
  bind('#copyShareUrl', 'click', async () => {
    await copyText(document.getElementById('shareUrl').value);
    document.getElementById('copyShareUrl').textContent = 'コピーしました';
  });
  bind('#startLive', 'click', () => hostAction('start'));
  bind('#closeVoting', 'click', () => hostAction('close'));
  bind('#nextQuestion', 'click', () => hostAction('next'));
}

function renderParticipant() {
  const game = state.game;
  if (!game) return setPage('<div class="loading">ルームを読み込んでいます…</div>', false);
  let content = '';
  if (game.phase === 'lobby') {
    content = `<section class="panel"><span class="eyebrow">WAITING</span><h2 style="margin-top:12px">${escapeHtml(game.title)}</h2><div class="notice">参加しました。司会者が開始するまでこの画面でお待ちください。</div>${participantHtml(game)}</section>`;
  } else if (game.phase === 'voting') {
    content = `<section class="panel">${liveQuestionHeader(game)}<div class="vote-options">${game.question.options.map((option, index) => `<button class="vote-option ${game.myVoteIndex === index ? 'selected' : ''}" data-vote-index="${index}" ${game.myVoteIndex !== null ? 'disabled' : ''}><span class="badge">${index + 1}</span> ${escapeHtml(option)}</button>`).join('')}</div>${game.myVoteIndex !== null ? '<div class="notice">投票しました。結果発表をお待ちください。</div>' : ''}</section>`;
  } else if (game.phase === 'reveal') {
    content = `<section class="panel">${liveQuestionHeader(game)}${resultBlock(game.question.result, game.subjectName)}<div class="notice">司会者が次の問題へ進むまでお待ちください。</div></section>`;
  } else {
    content = `<section class="panel"><span class="eyebrow">FINISH</span><h2 style="margin-top:12px">${escapeHtml(game.title)} 最終結果</h2><div class="result-list">${game.results.map((result, index) => `<article class="result-card"><span class="badge">Q${index + 1}</span>${resultBlock(result, game.subjectName)}</article>`).join('')}</div></section>`;
  }
  setPage(content);
  document.querySelectorAll('[data-vote-index]').forEach((button) => button.addEventListener('click', () => vote(Number(button.dataset.voteIndex))));
}

function liveQuestionHeader(game) {
  return `<div class="progress">Q${game.currentQuestionIndex + 1} / ${game.questionCount} · ${escapeHtml(LIVE_TYPE_LABELS[game.question.type] || '')}</div><h2>${escapeHtml(game.question.text)}</h2>`;
}

function participantHtml(game) {
  return `<h3 style="margin-top:18px">参加者 ${game.participantCount}人</h3><div class="participant-chips">${game.participants.map((participant) => `<span>${escapeHtml(participant.name)}</span>`).join('') || '<span>参加待ち</span>'}</div>`;
}

function resultBlock(result, subjectName) {
  if (!result) return '<div class="notice">結果を集計しています…</div>';
  const popular = result.popularIndices.length
    ? result.popularIndices.map((index) => result.options[index]?.text).filter(Boolean).join('／')
    : '投票なし';
  let summary = `<div class="notice">参加者の最多回答：${escapeHtml(popular)}</div>`;
  if (result.type === 'guess-person') {
    summary += `<div class="notice">${escapeHtml(subjectName)}の答え：${escapeHtml(result.options[result.subjectAnswerIndex]?.text || '未設定')}</div><div class="verdict">${result.isCorrect ? '当たり！' : 'ハズレ'}</div>`;
  } else if (result.type === 'guess-majority') {
    summary += `<div class="notice">作成者の事前予想：${escapeHtml(result.options[result.predictionIndex]?.text || '未設定')}</div><div class="verdict">${result.isCorrect ? '予想的中！' : '予想はハズレ'}</div>`;
  }
  return `<h3 style="margin-top:12px">${escapeHtml(result.text)}</h3>${result.options.map((option) => `<div class="bar-row"><div class="bar-label"><span>${escapeHtml(option.text)}</span><span>${option.count}票・${option.percentage}%</span></div><div class="bar"><span style="width:${Math.max(0, Math.min(100, option.percentage))}%"></span></div></div>`).join('')}${summary}`;
}

async function vote(optionIndex) {
  try {
    const response = await api(`/api/live/games/${state.roomCode}/vote`, {
      method: 'POST', headers: participantHeaders(),
      body: JSON.stringify({ questionId: state.game.question.id, optionIndex }),
    });
    state.game = response.game;
  } catch (error) { state.error = humanError(error); }
  render();
}

async function hostAction(action) {
  try {
    const response = await api(`/api/live/games/${state.roomCode}/${action}`, { method: 'POST', headers: hostHeaders(), body: '{}' });
    state.game = response.game;
    state.error = '';
  } catch (error) { state.error = humanError(error); }
  render();
}

async function loadRoom() {
  const headers = state.hostToken ? hostHeaders() : state.participantToken ? participantHeaders() : {};
  const response = await api(`/api/live/games/${state.roomCode}`, { headers });
  state.game = response.game;
}

function startPolling() {
  clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    if (!['host', 'participant'].includes(state.view)) return;
    try { await loadRoom(); render(); } catch (error) { /* 次のポーリングで再試行 */ }
  }, 1200);
}

function setPage(content, withTopbar = true) {
  root.innerHTML = `<div class="shell">${withTopbar ? `<header class="topbar"><a class="brand" href="/live">${escapeHtml(LIVE_SERIES.name)}</a><a class="back" href="/">トップへ</a></header>` : ''}${content}</div>`;
}

function createBlankDraft() {
  return { creationMode: 'manual', title: LIVE_SERIES.defaultGameTitle, subjectName: '', questions: [createLiveQuestion()] };
}

function typeSelect(value, field, disabled = false) {
  return `<select data-field="${field}" ${disabled ? 'disabled' : ''}>${LIVE_QUESTION_TYPES.map((type) => `<option value="${type.value}" ${value === type.value ? 'selected' : ''}>${escapeHtml(type.label)}</option>`).join('')}</select>`;
}

function hostHeaders() { return { 'x-live-host-token': state.hostToken }; }
function participantHeaders() { return { 'x-live-participant-token': state.participantToken }; }

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(json.error || 'request-failed');
    error.status = response.status;
    throw error;
  }
  return json;
}

function humanError(error) {
  const messages = {
    'invalid-youtube-channel-url': 'YouTubeチャンネルURLまたは動画URLを確認してください',
    'invalid-youtube-url': 'YouTubeチャンネルURLまたは動画URLを確認してください',
    'youtube-video-channel-not-found': 'この動画から投稿元チャンネルを確認できませんでした。公開中の動画URLかチャンネルURLを入力してください',
    'room-not-found': 'ルームが見つかりません。コードを確認してください',
    'name-required': '名前を入力してください',
    'game-finished': 'このゲームは終了しています',
    'voting-closed': '投票は締め切られました',
    'question-changed': '次の問題へ進みました。画面を更新します',
    'already-voted': 'この問題には投票済みです',
    'host-forbidden': 'この端末には司会者権限がありません',
    'live-storage-not-configured': 'ライブゲームの保存先が設定されていません',
  };
  return messages[error?.message] || '処理に失敗しました。もう一度お試しください';
}

function errorHtml() {
  return state.error ? `<div class="error" role="alert">${escapeHtml(state.error).replace(/\n/g, '<br>')}</div>` : '';
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const input = document.createElement('textarea');
  input.value = text; document.body.appendChild(input); input.select(); document.execCommand('copy'); input.remove();
}

function bind(selector, event, handler) {
  const element = document.querySelector(selector);
  if (element) element.addEventListener(event, handler);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function escapeAttr(value) { return escapeHtml(value); }
