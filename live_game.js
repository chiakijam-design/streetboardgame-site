import { LIVE_QUESTION_TYPES, LIVE_SERIES, LIVE_TYPE_LABELS } from './src/live/config.js';
import { createLiveQuestion, recommendYouTubeCandidates, validateLiveDraft } from './src/live/model.js';

const root = document.getElementById('liveRoot');
const query = new URLSearchParams(location.search);
const initialRoomCode = String(query.get('room') || '').replace(/\D/g, '').slice(0, 6);
const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
const initialHostToken = hashParams.get('host') || '';
const initialSubjectToken = hashParams.get('subject') || '';
if (initialRoomCode && /^[a-f0-9]{20,96}$/i.test(initialHostToken)) {
  sessionStorage.setItem(`live:host:${initialRoomCode}`, initialHostToken);
}
if (initialRoomCode && /^[a-f0-9]{20,96}$/i.test(initialSubjectToken)) {
  sessionStorage.setItem(`live:subject:${initialRoomCode}`, initialSubjectToken);
}
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
  hostToken: initialRoomCode && !initialSubjectToken ? sessionStorage.getItem(`live:host:${initialRoomCode}`) || initialHostToken : '',
  subjectToken: initialRoomCode && !initialHostToken ? sessionStorage.getItem(`live:subject:${initialRoomCode}`) || initialSubjectToken : '',
  participantToken: initialRoomCode ? sessionStorage.getItem(`live:participant:${initialRoomCode}`) || '' : '',
  hostAnswerIndex: null,
  subjectAnswerIndex: null,
  subjectQuestionId: '',
  pollTimer: null,
};

document.title = `${LIVE_SERIES.name} | わたちゃん`;
if (initialRoomCode) initializeRoom();
else render();

function render() {
  if (state.view === 'room-loading') return setPage('<div class="loading">ルームを読み込んでいます…</div>', false);
  if (state.view === 'entry') return renderEntry();
  if (state.view === 'youtube-editor') return renderEditor();
  if (state.view === 'youtube-candidates') return renderYouTubeCandidates();
  if (state.view === 'join') return renderJoin();
  if (state.view === 'host') return renderHost();
  if (state.view === 'subject') return renderSubject();
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
    <section class="panel" style="margin-top:18px">
      <span class="eyebrow">YOUTUBE MODE</span>
      <h2 style="margin-top:12px">${escapeHtml(LIVE_SERIES.youtubeEntry)}</h2>
      <p class="help">2つの遊び方から1つを選び、公開チャンネル情報をもとに作った30問から採用する問題を選べます。</p>
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
    <section class="panel" style="margin-top:18px">
      <h2>ルームに参加する</h2>
      <p class="help">司会者から受け取った6桁のコードを入力してください。</p>
      <div class="field"><label for="entryRoomCode">ルームコード</label><input id="entryRoomCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="123456"></div>
      <div class="error" id="entryCodeError" role="alert" hidden>6桁のルームコードを入力してください</div>
      <button class="secondary" id="joinByCode" style="width:100%;margin-top:12px">コードで参加</button>
    </section>
  `);
  bind('#channelUrl', 'input', (event) => {
    state.channelUrl = event.target.value;
    document.getElementById('youtubeGenerationChoices').hidden = !state.channelUrl.trim();
  });
  document.querySelectorAll('[data-youtube-type]').forEach((button) => button.addEventListener('click', () => {
    generateYouTubeCandidates(button.dataset.youtubeType);
  }));
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
  bind('#backYoutube', 'click', () => { state.view = 'entry'; state.error = ''; render(); });
  bind('#useCandidates', 'click', () => {
    const selected = state.candidates.filter((question) => question.selected);
    if (!selected.length) { state.error = '使用する問題を1問以上選んでください'; return render(); }
    state.draft = {
      creationMode: 'youtube',
      title: `${state.channelProfile?.channelName || 'YouTube'} ${LIVE_SERIES.name}`,
      subjectName: state.channelProfile?.channelName || '',
      showLiveVoteCounts: false,
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
  setPage(`
    <section class="panel editor-intro-panel">
      <div class="editor-intro-copy">
        <span class="eyebrow">GAME EDITOR</span>
        <h2>問題を編集する</h2>
        <p class="help">選んだ問題を配信用に仕上げます。上から順番に確認すれば、そのまま企画を保存できます。</p>
      </div>
      <div class="editor-flow" aria-label="企画作成の手順">
        <div class="editor-flow-step is-done"><strong>1</strong><span>問題を選ぶ</span><small>完了</small></div>
        <div class="editor-flow-step is-current"><strong>2</strong><span>内容を整える</span><small>いまここ</small></div>
        <div class="editor-flow-step"><strong>3</strong><span>保存してURL発行</span></div>
      </div>
      <div class="editor-settings">
        <div class="editor-settings-title"><span>✎</span>まず、企画の基本情報を確認</div>
        <div class="editor-type-summary"><span>遊び方</span><span class="badge">${escapeHtml(LIVE_TYPE_LABELS[state.youtubeQuestionType] || '')}</span><span>すべての問題で共通です</span></div>
        <div class="field"><label for="gameTitle">ゲームタイトル</label><input id="gameTitle" maxlength="80" value="${escapeAttr(state.draft.title)}"><p class="help">スタッフ用URLや配信画面に表示されます</p></div>
        <div class="field"><label for="subjectName">YouTuber・回答者の名前</label><input id="subjectName" maxlength="40" value="${escapeAttr(state.draft.subjectName)}"><p class="help">視聴者の画面で「本人」として表示されます</p></div>
        <div class="field editor-vote-setting"><span class="field-label">視聴者画面のライブ票数</span><label class="check"><input id="showLiveVoteCounts" type="checkbox" ${state.draft.showLiveVoteCounts ? 'checked' : ''}>全問題で選択肢別の現在票数を表示する</label><p class="help">この設定は企画全体に適用され、配信中は変更できません。</p></div>
      </div>
    </section>
    <section class="panel editor-question-panel">
      <div class="question-head editor-question-heading"><div><h2>次に、問題と5択を確認</h2><p class="help">問題文・選択肢を編集できます。上下ボタンで出題順も変更できます。</p></div><span class="editor-count">${state.draft.questions.length}問</span></div>
      <div class="question-list">
        ${state.draft.questions.map((question, index) => editorQuestionCard(question, index)).join('')}
      </div>
      ${errorHtml()}
      ${!state.error && !validation.valid ? `<div class="notice">入力途中です。開始前にすべての問題を確認します。</div>` : ''}
      <div class="sticky-actions editor-save-bar"><p class="editor-save-guide">すべて確認できたら、スタッフ用URLと視聴者参加URLを発行します</p><button class="primary" id="createGame">確認できたので企画を保存する <span class="accent">▶</span></button></div>
    </section>
  `);
  bind('#gameTitle', 'input', (event) => { state.draft.title = event.target.value; });
  bind('#subjectName', 'input', (event) => { state.draft.subjectName = event.target.value; });
  bind('#showLiveVoteCounts', 'change', (event) => { state.draft.showLiveVoteCounts = event.target.checked; });
  document.querySelectorAll('[data-question-index]').forEach((card) => bindEditorCard(card));
  bind('#createGame', 'click', createGame);
}

function editorQuestionCard(question, index) {
  return `
    <article class="question-card editor-question-card" data-question-index="${index}">
      <div class="editor-question-top">
        <div class="editor-question-number"><span class="badge">Q${index + 1}</span><span>${index + 1}問目</span></div>
        <div class="editor-question-actions">
          <button class="mini" data-action="question-up" ${index === 0 ? 'disabled' : ''} aria-label="Q${index + 1}を上へ">↑ 上へ</button>
          <button class="mini" data-action="question-down" ${index === state.draft.questions.length - 1 ? 'disabled' : ''} aria-label="Q${index + 1}を下へ">↓ 下へ</button>
          <button class="mini delete-question" data-action="question-delete" aria-label="Q${index + 1}を削除">削除</button>
        </div>
      </div>
      <div class="editor-question-body">
        <div class="field"><label class="editor-field-label" data-icon="問">問題文</label><textarea data-field="question-text" maxlength="180">${escapeHtml(question.text)}</textarea></div>
        <div class="field"><label class="editor-field-label" data-icon="型">問題タイプ</label><div class="editor-type-lock">${typeSelect(question.type, 'question-type', true)}<span class="editor-lock-badge">変更なし</span></div></div>
        <div class="field"><span class="editor-field-label" data-icon="択">選択肢（5個固定）</span>
          <div class="editor-options">${question.options.map((option, optionIndex) => `<label class="editor-option-row"><span class="editor-option-number">${optionIndex + 1}</span><input data-editor-option="${optionIndex}" maxlength="60" value="${escapeAttr(option)}" aria-label="Q${index + 1} 選択肢${optionIndex + 1}"></label>`).join('')}</div>
        </div>
        <div class="notice editor-live-note">本人の答えは配信中に入力します。視聴者と同時に回答し、「次の問題へ」で締め切ります。</div>
      </div>
    </article>
  `;
}

function bindEditorCard(card) {
  const index = Number(card.dataset.questionIndex);
  const question = state.draft.questions[index];
  card.querySelector('[data-field="question-text"]').addEventListener('input', (event) => { question.text = event.target.value; });
  card.querySelector('[data-field="question-type"]').addEventListener('change', (event) => { question.type = event.target.value; question.lockedIndex = null; render(); });
  card.querySelectorAll('[data-editor-option]').forEach((input) => input.addEventListener('input', (event) => { question.options[Number(input.dataset.editorOption)] = event.target.value; }));
  card.querySelector('[data-action="question-up"]').addEventListener('click', () => moveQuestion(index, -1));
  card.querySelector('[data-action="question-down"]').addEventListener('click', () => moveQuestion(index, 1));
  card.querySelector('[data-action="question-delete"]').addEventListener('click', () => {
    if (state.draft.questions.length <= 1) { state.error = '問題は1問以上必要です'; return render(); }
    state.draft.questions.splice(index, 1); state.error = ''; render();
  });
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
  button.textContent = '企画を保存しています…';
  try {
    const response = await api('/api/live/games', { method: 'POST', body: JSON.stringify({ draft: validation.draft }) });
    state.roomCode = response.code;
    state.hostToken = response.hostToken;
    state.game = response.game;
    sessionStorage.setItem(`live:host:${state.roomCode}`, state.hostToken);
    history.replaceState({}, '', `/live?room=${state.roomCode}#host=${state.hostToken}`);
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
    state.view = state.hostToken && state.game?.host
      ? 'host'
      : state.subjectToken && state.game?.subject
        ? 'subject'
        : state.participantToken ? 'participant' : 'join';
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
    const managementUrl = `${shareUrl}#host=${state.hostToken}`;
    const subjectUrl = game.subjectToken ? `${shareUrl}#subject=${game.subjectToken}` : '';
    content = `
      <section class="panel">
        <span class="eyebrow">SAVED</span><h2 style="margin-top:12px">企画を保存しました</h2>
        <p class="help">${escapeHtml(game.title)}は${escapeHtml(formatSavedUntil(game.expiresAt))}まで保存されます。配信当日は、このスタッフ用URLから戻ってきてください。</p>
        <div class="field"><label for="managementUrl">スタッフ用URL（視聴者には共有しない）</label><input id="managementUrl" readonly value="${escapeAttr(managementUrl)}"></div>
        <button class="secondary" id="copyManagementUrl" style="width:100%;margin-top:10px">スタッフ用URLをコピー</button>
        ${subjectUrl ? `<div class="field"><label for="subjectUrl">YouTuber本人用URL（本人だけに共有）</label><input id="subjectUrl" readonly value="${escapeAttr(subjectUrl)}"></div><button class="secondary" id="copySubjectUrl" style="width:100%;margin-top:10px">YouTuber本人用URLをコピー</button>` : ''}
      </section>
      <section class="panel">
        <span class="eyebrow">HOST LOBBY</span><h2 style="margin-top:12px">配信当日の参加受付</h2>
        <p class="help">視聴者には6桁のコードか参加URLだけを共有してください。</p>
        <div class="room-code">${escapeHtml(state.roomCode)}</div>
        <div class="field"><label for="shareUrl">参加URL</label><input id="shareUrl" readonly value="${escapeAttr(shareUrl)}"></div>
        <div class="actions"><button class="secondary" id="copyShareUrl">参加URLをコピー</button><button class="primary" id="startLive">ライブを開始する</button></div>
        ${participantHtml(game)}
      </section>
      <section class="panel"><h2>出題予定 ${game.questionCount}問</h2><div class="question-list">${(game.questions || []).map((question, index) => `<div class="question-card"><span class="badge">Q${index + 1}</span><h3 style="margin-top:8px">${escapeHtml(question.text)}</h3><p class="help">${escapeHtml(LIVE_TYPE_LABELS[question.type] || '')}</p></div>`).join('')}</div></section>`;
  } else if (game.phase === 'answering') {
    const personMode = game.question.type === 'guess-person';
    content = `<section class="panel">${liveQuestionHeader(game)}
      <div class="notice">${personMode ? `${escapeHtml(game.subjectName)}本人に、この画面を見せて答えを選んでもらってください。` : `${escapeHtml(game.subjectName)}本人に、視聴者の1位を予想してもらってください。`}確定するまで視聴者は投票できません。</div>
      <h3 style="margin-top:18px">${personMode ? '本人の答え' : 'YouTuberの予想'}を選ぶ</h3>
      <div class="vote-options">${game.question.options.map((option, index) => `<button class="vote-option ${state.hostAnswerIndex === index ? 'selected' : ''}" data-host-answer-index="${index}"><span class="badge">${index + 1}</span> ${escapeHtml(option)}</button>`).join('')}</div>
      <button class="primary" id="confirmHostAnswer" style="margin-top:18px" ${state.hostAnswerIndex === null ? 'disabled' : ''}>回答を確定して視聴者投票を始める <span class="accent">▶</span></button>
      ${participantHtml(game)}
    </section>`;
  } else if (game.phase === 'voting') {
    if (game.flowVersion >= 4) {
      const isLastQuestion = game.currentQuestionIndex + 1 >= game.questionCount;
      content = `<section class="panel">${liveQuestionHeader(game, '出題')}
        <div class="notice">YouTuber本人と視聴者が同時に回答しています。スタッフ画面には本人の選択内容を表示しません。</div>
        <div class="vote-options">${game.question.options.map((option, index) => `<div class="vote-option"><span class="badge">${index + 1}</span><span>${escapeHtml(option)}</span><span class="live-vote-count">${game.question.voteCounts?.[index] || 0}票</span></div>`).join('')}</div>
        <div class="personal-result"><span>YouTuber本人</span><strong>${game.question.subjectAnswered ? '回答済み' : '回答待ち'}</strong></div>
        <div class="notice">視聴者の回答：${game.question.voteCount}票</div>
        <div class="notice">視聴者画面の選択肢別票数：${game.showVoteCount ? '表示する設定' : '表示しない設定'}</div>
        <button class="primary" id="advanceQuestion" style="margin-top:18px" ${game.question.subjectAnswered ? '' : 'disabled'}>${isLastQuestion ? '投票を締め切って答え合わせへ' : '投票を締め切って次の問題へ'} <span class="accent">▶</span></button>
        ${!game.question.subjectAnswered ? '<div class="notice">YouTuber本人が回答すると締め切れるようになります。</div>' : ''}
        ${participantHtml(game)}
      </section>`;
    } else if (game.flowVersion >= 3) {
      const isLastQuestion = game.currentQuestionIndex + 1 >= game.questionCount;
      const personMode = game.question.type === 'guess-person';
      content = `<section class="panel">${liveQuestionHeader(game, '出題')}
        <div class="notice">視聴者も同じ問題に回答中です。${personMode ? `${escapeHtml(game.subjectName)}の答え` : `${escapeHtml(game.subjectName)}の1位予想`}を選んでください。</div>
        <div class="vote-options">${game.question.options.map((option, index) => `<button class="vote-option ${state.hostAnswerIndex === index ? 'selected' : ''}" data-host-answer-index="${index}"><span class="badge">${index + 1}</span> ${escapeHtml(option)}</button>`).join('')}</div>
        <button class="primary" id="advanceQuestion" style="margin-top:18px" ${state.hostAnswerIndex === null ? 'disabled' : ''}>${isLastQuestion ? '投票を締め切って答え合わせへ' : '投票を締め切って次の問題へ'} <span class="accent">▶</span></button>
        <div class="notice">視聴者の回答：${game.question.voteCount}票</div>${participantHtml(game)}
      </section>`;
    } else {
      content = `<section class="panel">${liveQuestionHeader(game)}<div class="notice">投票受付中：${game.question.voteCount}票</div><div class="vote-options">${game.question.options.map((option, index) => `<div class="vote-option"><span class="badge">${index + 1}</span> ${escapeHtml(option)}</div>`).join('')}</div><button class="primary" id="closeVoting" style="margin-top:18px">投票を締め切って結果発表</button>${participantHtml(game)}</section>`;
    }
  } else if (game.phase === 'review-question') {
    content = `<section class="panel"><span class="eyebrow">ANSWER CHECK</span>${liveQuestionHeader(game, '答え合わせ')}<div class="notice">まず問題を振り返ります。準備ができたら本人の答えを発表してください。</div><button class="primary" id="revealAnswer" style="margin-top:18px">答えを発表する <span class="accent">▶</span></button></section>`;
  } else if (game.phase === 'review-answer') {
    content = `<section class="panel"><span class="eyebrow">ANSWER</span>${liveQuestionHeader(game, '答え合わせ')}${resultBlock(game.question.result, game.subjectName, false)}<button class="primary" id="nextQuestion" style="margin-top:18px">${game.currentQuestionIndex + 1 >= game.questionCount ? `${game.questionCount}問の結果発表へ` : '次の答え合わせへ'} <span class="accent">▶</span></button></section>`;
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
  bind('#copyManagementUrl', 'click', async () => {
    await copyText(document.getElementById('managementUrl').value);
    document.getElementById('copyManagementUrl').textContent = 'コピーしました';
  });
  bind('#copySubjectUrl', 'click', async () => {
    await copyText(document.getElementById('subjectUrl').value);
    document.getElementById('copySubjectUrl').textContent = 'コピーしました';
  });
  document.querySelectorAll('[data-host-answer-index]').forEach((button) => button.addEventListener('click', () => {
    state.hostAnswerIndex = Number(button.dataset.hostAnswerIndex);
    render();
  }));
  bind('#startLive', 'click', () => hostAction('start'));
  bind('#confirmHostAnswer', 'click', submitHostAnswer);
  bind('#advanceQuestion', 'click', advanceHostQuestion);
  bind('#closeVoting', 'click', () => hostAction('close'));
  bind('#revealAnswer', 'click', () => hostAction('reveal'));
  bind('#nextQuestion', 'click', () => hostAction('next'));
}

function renderSubject() {
  const game = state.game;
  if (!game) return setPage('<div class="loading">ルームを読み込んでいます…</div>', false);
  let content = '';
  if (game.phase === 'lobby') {
    content = `<section class="panel"><span class="eyebrow">YOUTUBER</span><h2 style="margin-top:12px">YouTuber本人専用画面</h2><p class="help">このURLは本人の秘密回答に使います。視聴者には共有しないでください。</p><div class="notice">スタッフがライブを開始するまで、この画面でお待ちください。</div></section>`;
  } else if (game.phase === 'voting') {
    const answered = game.question.subjectAnswered;
    const personMode = game.question.type === 'guess-person';
    content = `<section class="panel"><span class="eyebrow">SECRET ANSWER</span>${liveQuestionHeader(game, '本人回答')}
      <div class="notice">視聴者も同じ問題に回答中です。${personMode ? 'あなた自身の答え' : '視聴者投票の1位予想'}を秘密で選んでください。</div>
      <div class="vote-options">${game.question.options.map((option, index) => `<button class="vote-option ${state.subjectAnswerIndex === index ? 'selected' : ''}" data-subject-answer-index="${index}" ${answered ? 'disabled' : ''}><span class="badge">${index + 1}</span><span>${escapeHtml(option)}</span>${answered ? `<span class="live-vote-count">${game.question.voteCounts?.[index] || 0}票</span>` : ''}</button>`).join('')}</div>
      <button class="primary" id="confirmSubjectAnswer" style="margin-top:18px" ${answered || state.subjectAnswerIndex === null ? 'disabled' : ''}>この回答で確定する <span class="accent">▶</span></button>
      ${answered ? '<div class="notice">秘密回答を確定しました。各選択肢の現在票数を確認できます。スタッフが投票を締め切るまでお待ちください。</div>' : '<div class="notice">確定後は変更できません。回答前は視聴者の票数を表示せず、回答内容も正解発表まで視聴者に送信しません。</div>'}
    </section>`;
  } else if (game.phase === 'review-question') {
    content = `<section class="panel"><span class="eyebrow">ANSWER CHECK</span>${liveQuestionHeader(game, '答え合わせ')}<div class="notice">スタッフが答えを発表するまでお待ちください。</div></section>`;
  } else if (game.phase === 'review-answer') {
    content = `<section class="panel"><span class="eyebrow">ANSWER</span>${liveQuestionHeader(game, '答え合わせ')}${resultBlock(game.question.result, game.subjectName, false)}<div class="notice">スタッフが次の答え合わせへ進むまでお待ちください。</div></section>`;
  } else {
    content = `<section class="panel"><span class="eyebrow">FINISH</span><h2 style="margin-top:12px">最終結果</h2><div class="result-list">${game.results.map((result, index) => `<article class="result-card"><span class="badge">Q${index + 1}</span>${resultBlock(result, game.subjectName)}</article>`).join('')}</div></section>`;
  }
  setPage(content);
  document.querySelectorAll('[data-subject-answer-index]').forEach((button) => button.addEventListener('click', () => {
    state.subjectAnswerIndex = Number(button.dataset.subjectAnswerIndex);
    render();
  }));
  bind('#confirmSubjectAnswer', 'click', submitSubjectAnswer);
}

function renderParticipant() {
  const game = state.game;
  if (!game) return setPage('<div class="loading">ルームを読み込んでいます…</div>', false);
  let content = '';
  if (game.phase === 'lobby') {
    content = `<section class="panel"><span class="eyebrow">WAITING</span><h2 style="margin-top:12px">${escapeHtml(game.title)}</h2><div class="notice">参加しました。司会者が開始するまでこの画面でお待ちください。</div>${participantHtml(game)}</section>`;
  } else if (game.phase === 'answering') {
    content = `<section class="panel">${liveQuestionHeader(game)}<div class="notice">${escapeHtml(game.subjectName)}本人が回答中です。回答が確定すると投票できるようになります。</div></section>`;
  } else if (game.phase === 'voting') {
    const waitingMessage = game.flowVersion >= 4 ? '回答しました。スタッフが次の問題へ進むまでお待ちください。' : '回答しました。YouTuberが次の問題へ進むまでお待ちください。';
    content = `<section class="panel">${liveQuestionHeader(game, '出題')}<div class="vote-options">${game.question.options.map((option, index) => `<button class="vote-option ${game.myVoteIndex === index ? 'selected' : ''}" data-vote-index="${index}" ${game.myVoteIndex !== null ? 'disabled' : ''}><span class="badge">${index + 1}</span><span>${escapeHtml(option)}</span>${game.showVoteCount ? `<span class="live-vote-count">${game.question.voteCounts?.[index] || 0}票</span>` : ''}</button>`).join('')}</div>${game.showVoteCount ? '<div class="notice">選択肢別の現在票数を表示しています。</div>' : ''}${game.myVoteIndex !== null ? `<div class="notice">${waitingMessage}</div>` : '<div class="notice">YouTuberと同時に回答してください。</div>'}</section>`;
  } else if (game.phase === 'review-question') {
    content = `<section class="panel"><span class="eyebrow">ANSWER CHECK</span>${liveQuestionHeader(game, '答え合わせ')}<div class="notice">スタッフが答えを発表するまでお待ちください。</div></section>`;
  } else if (game.phase === 'review-answer') {
    content = `<section class="panel"><span class="eyebrow">ANSWER</span>${liveQuestionHeader(game, '答え合わせ')}${personalResultBlock(game.question.result)}${resultBlock(game.question.result, game.subjectName, false)}<div class="notice">スタッフが次の答え合わせへ進むまでお待ちください。</div></section>`;
  } else if (game.phase === 'reveal') {
    content = `<section class="panel">${liveQuestionHeader(game)}${personalResultBlock(game.question.result)}${resultBlock(game.question.result, game.subjectName)}<div class="notice">司会者が次の問題へ進むまでお待ちください。</div></section>`;
  } else {
    content = `<section class="panel"><span class="eyebrow">FINISH</span><h2 style="margin-top:12px">あなたの最終結果</h2>${personalSummary(game.results)}<div class="result-list">${game.results.map((result, index) => `<article class="result-card"><span class="badge">Q${index + 1}</span>${personalResultBlock(result)}${resultBlock(result, game.subjectName)}</article>`).join('')}</div></section>`;
  }
  setPage(content);
  document.querySelectorAll('[data-vote-index]').forEach((button) => button.addEventListener('click', () => vote(Number(button.dataset.voteIndex))));
}

function liveQuestionHeader(game, stage = '') {
  return `<div class="progress">${stage ? `${escapeHtml(stage)} · ` : ''}Q${game.currentQuestionIndex + 1} / ${game.questionCount} · ${escapeHtml(LIVE_TYPE_LABELS[game.question.type] || '')}</div><h2>${escapeHtml(game.question.text)}</h2>`;
}

function participantHtml(game) {
  return `<h3 style="margin-top:18px">参加者 ${game.participantCount}人</h3><div class="participant-chips">${game.participants.map((participant) => `<span>${escapeHtml(participant.name)}</span>`).join('') || '<span>参加待ち</span>'}</div>`;
}

function resultBlock(result, subjectName, showQuestion = true) {
  if (!result) return '<div class="notice">結果を集計しています…</div>';
  const popular = result.popularIndices.length
    ? result.popularIndices.map((index) => result.options[index]?.text).filter(Boolean).join('／')
    : '投票なし';
  let answer = '';
  let verdict = '';
  if (result.type === 'guess-person') {
    answer = `<div class="verdict">${escapeHtml(subjectName)}の答え：${escapeHtml(result.options[result.subjectAnswerIndex]?.text || '未設定')}</div>`;
    verdict = `<div class="notice">みんなの予想は${result.isCorrect ? '当たり！' : 'ハズレ'}</div>`;
  } else if (result.type === 'guess-majority') {
    answer = `<div class="verdict">${escapeHtml(subjectName)}の予想：${escapeHtml(result.options[result.predictionIndex]?.text || '未設定')}</div>`;
    verdict = `<div class="notice">${result.isCorrect ? '予想的中！' : '予想はハズレ'}</div>`;
  }
  const questionHeading = showQuestion ? `<h3 style="margin-top:12px">${escapeHtml(result.text)}</h3>` : '';
  return `${questionHeading}${answer}${result.options.map((option) => `<div class="bar-row"><div class="bar-label"><span>${escapeHtml(option.text)}</span><span>${option.count}票・${option.percentage}%</span></div><div class="bar"><span style="width:${Math.max(0, Math.min(100, option.percentage))}%"></span></div></div>`).join('')}<div class="notice">参加者の最多回答：${escapeHtml(popular)}</div>${verdict}`;
}

function personalResultBlock(result) {
  if (!result) return '';
  const answer = result.myVoteIndex === null || result.myVoteIndex === undefined
    ? '未回答'
    : result.options[result.myVoteIndex]?.text || '未回答';
  if (result.type === 'guess-person') {
    const verdict = result.myIsCorrect === null ? '未回答' : result.myIsCorrect ? '正解！' : 'ハズレ';
    return `<div class="personal-result"><span>あなたの回答：${escapeHtml(answer)}</span><strong>${verdict}</strong></div>`;
  }
  if (result.type === 'guess-majority') {
    const verdict = result.myVoteWasPopular === null ? '未回答' : result.myVoteWasPopular ? 'みんなの1位！' : 'みんなの1位ではありません';
    return `<div class="personal-result"><span>あなたの回答：${escapeHtml(answer)}</span><strong>${verdict}</strong></div>`;
  }
  return `<div class="personal-result"><span>あなたの回答：${escapeHtml(answer)}</span></div>`;
}

function personalSummary(results) {
  const personResults = results.filter((result) => result.type === 'guess-person');
  if (personResults.length === results.length) {
    const correct = personResults.filter((result) => result.myIsCorrect).length;
    return `<div class="personal-summary"><strong>${correct} / ${results.length}問正解</strong><span>あなたの回答を1問ずつ振り返れます</span></div>`;
  }
  return `<div class="personal-summary"><strong>${results.length}問の回答結果</strong><span>あなたの回答と視聴者全体の結果を振り返れます</span></div>`;
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
    if (action === 'start' || action === 'next' || action === 'reveal') state.hostAnswerIndex = null;
    state.error = '';
  } catch (error) { state.error = humanError(error); }
  render();
}

async function submitHostAnswer() {
  if (state.hostAnswerIndex === null) return;
  try {
    const response = await api(`/api/live/games/${state.roomCode}/answer`, {
      method: 'POST', headers: hostHeaders(), body: JSON.stringify({ optionIndex: state.hostAnswerIndex }),
    });
    state.game = response.game;
    state.hostAnswerIndex = null;
    state.error = '';
  } catch (error) { state.error = humanError(error); }
  render();
}

async function submitSubjectAnswer() {
  if (state.subjectAnswerIndex === null || !state.game?.question) return;
  try {
    const response = await api(`/api/live/games/${state.roomCode}/subject-answer`, {
      method: 'POST', headers: subjectHeaders(),
      body: JSON.stringify({ questionId: state.game.question.id, optionIndex: state.subjectAnswerIndex }),
    });
    state.game = response.game;
    syncSubjectAnswer(response.game);
    state.error = '';
  } catch (error) { state.error = humanError(error); }
  render();
}

async function advanceHostQuestion() {
  if (state.game?.flowVersion < 4 && state.hostAnswerIndex === null) return;
  try {
    const response = await api(`/api/live/games/${state.roomCode}/advance`, {
      method: 'POST', headers: hostHeaders(),
      body: state.game?.flowVersion >= 4 ? '{}' : JSON.stringify({ optionIndex: state.hostAnswerIndex }),
    });
    state.game = response.game;
    state.hostAnswerIndex = null;
    state.error = '';
  } catch (error) { state.error = humanError(error); }
  render();
}

function formatSavedUntil(value) {
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return '保存期限内';
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

async function loadRoom() {
  const headers = state.hostToken ? hostHeaders() : state.subjectToken ? subjectHeaders() : state.participantToken ? participantHeaders() : {};
  const response = await api(`/api/live/games/${state.roomCode}`, { headers });
  state.game = response.game;
  if (state.subjectToken) syncSubjectAnswer(response.game);
}

function syncSubjectAnswer(game) {
  const questionId = game?.question?.id || '';
  if (state.subjectQuestionId !== questionId) {
    state.subjectQuestionId = questionId;
    state.subjectAnswerIndex = Number.isInteger(game?.question?.myAnswerIndex) ? game.question.myAnswerIndex : null;
  } else if (Number.isInteger(game?.question?.myAnswerIndex)) {
    state.subjectAnswerIndex = game.question.myAnswerIndex;
  }
}

function startPolling() {
  clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    if (!['host', 'subject', 'participant'].includes(state.view)) return;
    try { await loadRoom(); render(); } catch (error) { /* 次のポーリングで再試行 */ }
  }, 1200);
}

function setPage(content, withTopbar = true) {
  root.innerHTML = `<div class="shell">${withTopbar ? `<header class="topbar"><a class="brand" href="/live">${escapeHtml(LIVE_SERIES.name)}</a><a class="back" href="/">トップへ</a></header>` : ''}${content}</div>`;
}

function typeSelect(value, field, disabled = false) {
  return `<select data-field="${field}" ${disabled ? 'disabled' : ''}>${LIVE_QUESTION_TYPES.map((type) => `<option value="${type.value}" ${value === type.value ? 'selected' : ''}>${escapeHtml(type.label)}</option>`).join('')}</select>`;
}

function hostHeaders() { return { 'x-live-host-token': state.hostToken }; }
function subjectHeaders() { return { 'x-live-subject-token': state.subjectToken }; }
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
    'youtube-creation-required': 'LIVEゲームはYouTubeチャンネルから作成してください',
    'room-not-found': 'ルームが見つかりません。コードを確認してください',
    'name-required': '名前を入力してください',
    'game-finished': 'このゲームは終了しています',
    'voting-closed': '投票は締め切られました',
    'question-changed': '次の問題へ進みました。画面を更新します',
    'already-voted': 'この問題には投票済みです',
    'already-answered': 'この問題には回答済みです',
    'answer-not-open': '本人回答の受付画面ではありません',
    'answer-required': '本人の回答を確定してから投票を締め切ってください',
    'invalid-option': '選択肢を確認してください',
    'host-forbidden': 'この端末には司会者権限がありません',
    'subject-forbidden': 'この端末にはYouTuber本人の回答権限がありません',
    'subject-not-supported': 'この企画はYouTuber専用端末に対応していません',
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
