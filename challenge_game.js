import QRCode from 'qrcode';
import { mergeChallengeCards, pickChallengeCards } from './src/challenge/data.js';
import { questionPackBySlug, questionPackCards, questionPacks } from './src/challenge/packs.js';
import {
  changedQuestionCandidates,
  loadManagedQuestionCards,
  recordQuestionSelectionEvent,
  reportManagedQuestion,
  submitQuestionCandidates,
} from './src/questions/catalog.js';
import { QUESTION_PUBLICATION_NOTICE, QUESTION_REVIEW_CRITERIA } from './src/questions/safety.js';
import {
  buildChallengeInviteText,
  copyText,
  openLineShare,
  openXShare,
} from './src/platform/share.js';
import { dataUrlToBlob, saveImageBlob } from './src/platform/imageSave.js';
import { createQuizFeedbackSoundPlayer } from './src/platform/quizFeedbackSound.js';
import { renderNotebookQuestionCard } from './src/challenge/question-card.js';
import {
  getChallengeResultTier,
  getChallengeResultTierEnglish,
  getChallengeReviewLines,
  getChallengeReviewLinesEnglish,
} from './src/challenge/result.js';
import { isEnglish, localizeDom } from './src/i18n/runtime.js';

const COLORS = ['#77bb62', '#3f78bd', '#f5c83b', '#d3313b', '#ef8730'];
const COLOR_NAMES = ['緑', '青', '黄', '赤', '橙'];
const QUESTION_COUNT = 10;
const CHALLENGE_SHARE_VERSION = 'challenge-20260726-1';
const CREATOR_DRAFT_KEY = 'watachan-challenge-creator-draft:v1';
const MANAGE_HISTORY_KEY = 'watachan-challenge-manage-history:v1';
const BOARD_OPT_IN_KEY_PREFIX = 'watachan-challenge-board-opt-in:';
const RESULT_GIRL_IMAGE_SRC = '/assets/character/girl-default.webp';
const RESULT_QR_IMAGE_SRC = '/assets/qr-site.png?v=20260710-qr-1';
const quizFeedbackSoundPlayer = createQuizFeedbackSoundPlayer();
window.addEventListener('pointerdown', () => quizFeedbackSoundPlayer.prime(), { once: true, passive: true });
const app = document.getElementById('challenge-app');
let allCards = isEnglish
  ? mergeChallengeCards(window.ENGLISH_COMMON_QUESTION_CARDS)
  : mergeChallengeCards(window.COMMON_QUESTION_CARDS);
const currentUrl = new URL(location.href);
const pagePath = currentUrl.pathname.replace(/^\/en(?=\/|$)/, '').replace(/\/+$/, '') || '/challenge';
const languagePrefix = isEnglish ? '/en' : '';
const roomCode = currentUrl.searchParams.get('room')?.trim().toUpperCase() || '';
const preferredCardId = currentUrl.searchParams.get('question')?.trim() || '';
const preferredPackSlug = currentUrl.searchParams.get('pack')?.trim() || '';
const quickStart = readCreatorQuickStart('challenge');
const hashManageToken = new URLSearchParams(location.hash.slice(1)).get('manage') || '';
const savedManageToken = roomCode ? manageHistory().find((item) => item.code === roomCode)?.token || '' : '';
const initialManageToken = hashManageToken || savedManageToken;
document.documentElement.dataset.challengePage = pagePath.split('/').pop() || 'challenge';

if (pagePath === '/challenge' && roomCode && hashManageToken) {
  history.replaceState(null, '', `${languagePrefix}/challenge/manage?room=${roomCode}#manage=${hashManageToken}`);
}

let state = {
  mode: initialMode(),
  roomCode,
  room: null,
  cards: quickStart ? pickChallengeCards(allCards, QUESTION_COUNT).map(toCreatorDraftCard) : [],
  answers: [],
  questionIndex: 0,
  creatorName: quickStart?.name || '',
  participantName: '',
  participantToken: roomCode ? participantToken(roomCode) : '',
  manageToken: initialManageToken,
  participants: [],
  ranking: [],
  library: [],
  result: null,
  resultImageUrl: '',
  resultImageBusy: false,
  resultImageError: '',
  boardOptIn: readBoardOptIn(roomCode),
  boardPreferenceBusy: false,
  boardActionMessage: '',
  error: '',
  loading: false,
  answerPending: false,
  questionSubmissionConsent: true,
  questionSubmissionStatus: '',
  questionSubmissionCount: 0,
  questionSubmissionCandidates: [],
  editingQuestion: false,
  editingOriginalCard: null,
};
let lastQuestionViewportKey = '';
let questionCatalogReady = false;
const trackedCreatorQuestions = new WeakSet();
let resultFeedbackKey = '';
let resultFeedbackObserver = null;
let resultFeedbackTimer = 0;
let resultFeedbackQueue = [];
let resultFeedbackBusy = false;

function initialMode() {
  if (pagePath === '/challenge/library') return 'library';
  if (pagePath === '/challenge/ranking') return 'ranking';
  if (pagePath === '/challenge/manage') return 'manage';
  if (pagePath === '/challenge' && !roomCode && quickStart) return 'creator-edit';
  return roomCode ? (initialManageToken ? 'manage' : 'join') : 'create';
}

function readCreatorQuickStart(expectedMode) {
  try {
    const raw = sessionStorage.getItem('watachan:creator-quick-start:v1');
    if (!raw) return null;
    sessionStorage.removeItem('watachan:creator-quick-start:v1');
    const value = JSON.parse(raw);
    const name = String(value?.name || '').trim().slice(0, 12);
    const age = Date.now() - Number(value?.createdAt || 0);
    if (value?.mode !== expectedMode || !name || age < 0 || age > 10 * 60 * 1000) return null;
    return { name };
  } catch (error) {
    return null;
  }
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
  document.documentElement.dataset.challengeMode = state.mode;
  const questionViewportKey = !state.editingQuestion
    && ['creator-edit', 'creator-answer', 'participant-answer'].includes(state.mode)
    ? `${state.mode}:${state.questionIndex}`
    : '';
  const body = state.loading
    ? loadingView()
    : state.mode === 'create' ? createStartView()
      : state.mode === 'creator-edit' ? creatorEditView()
        : state.mode === 'creator-answer' ? questionView(true)
        : state.mode === 'manage' ? manageView()
          : state.mode === 'join' ? joinView()
            : state.mode === 'participant-answer' ? questionView(false)
              : state.mode === 'result' ? resultView()
                : state.mode === 'ranking' ? rankingView()
                  : state.mode === 'library' ? libraryView()
                    : errorView();
  app.innerHTML = body;
  localizeDom(app);
  bindEvents();
  trackCurrentCreatorQuestionShown();
  if (state.mode === 'result' && state.result && !state.resultImageUrl
    && !state.resultImageBusy && !state.resultImageError) {
    prepareResultImage();
  }
  if (state.mode === 'result' && state.result && (state.resultImageUrl || state.resultImageError)) {
    requestAnimationFrame(startResultFeedbackSequence);
  } else if (state.mode !== 'result') {
    stopResultFeedbackSequence();
  }
  if (questionViewportKey && questionViewportKey !== lastQuestionViewportKey) {
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
  }
  lastQuestionViewportKey = questionViewportKey;
}

function trackCurrentCreatorQuestionShown() {
  if (!questionCatalogReady || state.mode !== 'creator-edit' || state.editingQuestion) return;
  const card = state.cards[state.questionIndex];
  if (!card || trackedCreatorQuestions.has(card)) return;
  const questionId = String(card.sourceId || '');
  if (!questionId) return;
  trackedCreatorQuestions.add(card);
  recordQuestionSelectionEvent(questionId, 'challenge', 'shown');
}

function creatorEditView() {
  const card = state.cards[state.questionIndex];
  if (!card) return errorView();
  if (state.editingQuestion) return creatorQuestionEditView(card);
  const selected = state.answers[state.questionIndex];
  return shell(
    'QUIZ MAKER',
    `${state.creatorName}さんのクイズを作成`,
    '自分の答えを1つ選ぶと、その問題がクイズに追加されて次へ進みます。',
    `<section class="challenge-question-wrap challenge-builder" data-testid="challenge-question-editor">
      <div class="challenge-progress" aria-label="${state.questionIndex + 1}問目、全10問">
        ${Array.from({ length: QUESTION_COUNT }, (_, index) => `<span class="${index <= state.questionIndex ? 'is-active' : ''}"></span>`).join('')}
      </div>
      <article class="challenge-card challenge-builder-card notebook-question-card" data-testid="challenge-builder-paper-card">
        <div class="challenge-q-number notebook-card-counter">Q${state.questionIndex + 1}/10</div>
        <h2 class="notebook-card-accessible-title">${escapeHtml(card.title)}</h2>
        ${renderNotebookQuestionCard(card)}
      </article>
      <div class="challenge-answer-pad challenge-builder-answer-pad" data-testid="challenge-builder-answer-pad">
        <div class="challenge-answer-pad-heading">
          <span>自分の正解</span>
          <small>タップでドットの色を選択</small>
        </div>
        <div class="challenge-color-choices">
          ${card.choices.map((choice, index) => `
            <button
              type="button"
              data-action="builder-answer"
              data-choice="${index}"
              class="challenge-color-choice ${selected === index ? 'is-selected' : ''}"
              aria-label="${escapeHtml(choice)}を正解に選ぶ"
            >
              <i style="background:${COLORS[index]}" aria-hidden="true"></i>
              <span>${COLOR_NAMES[index]}</span>
            </button>
          `).join('')}
        </div>
        <p>ドットの色は、お題カード左側の5色と対応しています</p>
      </div>
      <p class="challenge-builder-help">色ボタンを押すと、この1問が完成します。</p>
      <div class="challenge-builder-actions">
        <button class="challenge-secondary" data-action="skip-question">この問題をスキップ</button>
        <button class="challenge-secondary" data-action="edit-question">✎ 問題・選択肢を編集する</button>
        <button class="challenge-secondary" data-action="custom-question">＋ 自分で問題を作る</button>
      </div>
      ${questionReportControls(card)}
      <label class="challenge-consent">
        <input id="question-submit-consent" type="checkbox" ${state.questionSubmissionConsent ? 'checked' : ''}
          aria-label="このクイズを友達や他の人も使えるようにする">
        <span><b>このクイズを友達や他の人も使えるようにする</b><br>
        <small>初期状態はONです。ONのままなら、自作・編集した問題を掲載候補として運営へ送ります。外してもクイズは作れます。<br>${QUESTION_PUBLICATION_NOTICE}<br>${QUESTION_REVIEW_CRITERIA}</small></span>
      </label>
      <div class="challenge-builder-footer">
        ${state.questionIndex > 0 ? '<button class="challenge-secondary" data-action="previous-builder-question">← 前の問題へ戻る</button>' : ''}
        <button class="challenge-secondary" data-action="back-create">名前入力に戻る</button>
      </div>
    </section>`,
  );
}

function creatorQuestionEditView(card) {
  const index = state.questionIndex;
  return shell(
    'EDIT QUESTION',
    `Q${index + 1}を編集する`,
    '問題文と5つの選択肢を編集してから、答えを選んでください。',
    `<section class="challenge-panel challenge-single-editor" data-testid="challenge-question-edit-form">
      <label class="challenge-label" for="builder-question">問題文</label>
      <textarea id="builder-question" data-question="${index}" maxlength="180"
        aria-label="Q${index + 1}の問題文">${escapeHtml(card.title)}</textarea>
      ${card.choices.map((choice, choiceIndex) => `<label class="challenge-option-edit">
        <b>${choiceIndex + 1}</b>
        <input data-option="${index}:${choiceIndex}" maxlength="60" value="${escapeHtml(choice)}"
          aria-label="Q${index + 1} 選択肢${choiceIndex + 1}">
      </label>`).join('')}
      <label class="challenge-consent">
        <input id="question-submit-consent" type="checkbox" ${state.questionSubmissionConsent ? 'checked' : ''}
          aria-label="このクイズを友達や他の人も使えるようにする">
        <span><b>このクイズを友達や他の人も使えるようにする</b><br>
        <small>ONのままなら、この自作・編集した問題を掲載候補として運営へ送ります。<br>${QUESTION_PUBLICATION_NOTICE}<br>${QUESTION_REVIEW_CRITERIA}</small></span>
      </label>
      <button class="challenge-primary" data-action="save-question-edit">この内容で問題に戻る <span>▶</span></button>
      <button class="challenge-secondary" data-action="cancel-question-edit">キャンセル</button>
    </section>`,
  );
}

function questionReportControls(card) {
  if (!card?.reportable || !card.managedQuestionId) return '';
  return `<div class="challenge-question-report" data-report-box>
    <label for="challenge-report-reason">不適切なお題を通報</label>
    <select id="challenge-report-reason" data-report-reason>
      <option value="personal-information">個人情報</option>
      <option value="sexual-content">性的内容</option>
      <option value="bullying">いじめ</option>
      <option value="appearance-attack">容姿攻撃</option>
      <option value="discrimination">差別表現</option>
      <option value="other">その他</option>
    </select>
    <button class="challenge-secondary" data-action="report-question" data-question-id="${escapeHtml(card.managedQuestionId)}">このお題を通報する</button>
    <small>通報すると、このお題は確認が終わるまで公開ライブラリから非公開になります。</small>
  </div>`;
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
  const preferredPack = questionPackBySlug(preferredPackSlug, isEnglish);
  const preferredPackQuestions = questionPackCards(allCards, preferredPackSlug, isEnglish, QUESTION_COUNT);
  const historyItems = manageHistory();
  return shell(
    'わたし理解度診断｜通常版',
    '私のこと、ちゃんと分かってるよね？',
    '当てるより、話すための10問。先に自分が回答し、できたURLを送ると最大50人が挑戦できます。',
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
        <li>答え合わせを確認。希望者だけ理解度ボードへ掲載</li>
      </ol>
      ${preferredCard ? `<div class="challenge-selected-question">
        <b>選んだお題を必ず入れます</b>
        <span>${escapeHtml(preferredCard.title)}</span>
      </div>` : ''}
      ${preferredPack ? `<div class="challenge-selected-question" data-testid="selected-question-pack">
        <b>選んだ10問パック</b>
        <span>${escapeHtml(preferredPack.title)}</span>
        <small>${preferredPackQuestions.length === QUESTION_COUNT
          ? 'このパックの10問を順番に使います。問題・選択肢はあとから編集できます。'
          : '現在使える問題が10問に満たないため、このパックは利用できません。'}</small>
      </div>` : ''}
      <label class="challenge-label" for="creator-name">出題者の名前（12文字まで）</label>
      <input id="creator-name" class="challenge-input" maxlength="12" autocomplete="nickname"
        placeholder="例：ちあき" value="${escapeHtml(state.creatorName)}">
      <button class="challenge-primary" data-action="start-create">10問に答えてクイズを作る <span>▶</span></button>
      <p class="challenge-note">共通のお題ライブラリから出題します。回答途中はこの端末へ自動保存されます。</p>
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
    `<section class="challenge-question-wrap challenge-answer-screen ${isCreator ? 'is-creator' : 'is-participant'}" data-testid="${isCreator ? 'creator-question' : 'participant-question'}">
      <div class="challenge-progress" aria-label="${state.questionIndex + 1}問目、全10問">
        ${Array.from({ length: QUESTION_COUNT }, (_, index) => `<span class="${index <= state.questionIndex ? 'is-active' : ''}"></span>`).join('')}
      </div>
      <article class="challenge-card notebook-question-card" data-testid="challenge-paper-card">
        <div class="challenge-q-number notebook-card-counter">Q${state.questionIndex + 1}/10</div>
        <h2 class="notebook-card-accessible-title">${escapeHtml(card.title)}</h2>
        ${renderNotebookQuestionCard(card)}
      </article>
      <div class="challenge-answer-pad" data-testid="challenge-answer-pad">
        <div class="challenge-answer-pad-heading">
          <span>${isCreator ? '本人の番' : '予想する番'}</span>
          <small>タップでドットの色を選択</small>
        </div>
        <div class="challenge-color-choices">
          ${card.choices.map((choice, index) => `
            <button
              type="button"
              data-action="answer"
              data-choice="${index}"
              class="challenge-color-choice ${selected === index ? 'is-selected' : ''}"
              ${!isCreator && state.answerPending ? 'disabled aria-busy="true"' : ''}
              aria-label="${escapeHtml(choice)}を選ぶ"
            >
              <i style="background:${COLORS[index]}" aria-hidden="true"></i>
              <span>${COLOR_NAMES[index]}</span>
            </button>
          `).join('')}
        </div>
        <p>ドットの色は、お題カード左側の5色と対応しています</p>
      </div>
      ${isCreator && state.questionIndex > 0 ? '<button class="challenge-secondary" data-action="previous-question">前の問題へ戻る</button>' : ''}
      <p class="challenge-note challenge-centered">ここまでの回答はこの端末へ自動保存されています。</p>
    </section>`,
  );
}

function manageView() {
  const room = state.room;
  if (!room) return errorView();
  const shareUrl = challengeUrl(room.code);
  const rankingUrl = `${location.origin}${languagePrefix}/challenge/ranking?room=${room.code}`;
  return shell(
    'HOST DASHBOARD',
    '主催者用回答管理',
    `${room.creatorName}さんのクイズを共有し、参加状況と一人ずつの回答を確認できます。`,
    `<section class="challenge-panel challenge-share-screen" data-testid="challenge-share-screen">
      <div class="challenge-created-heading">
        <span aria-hidden="true">🏆</span>
        <h2>${escapeHtml(room.creatorName)}の「わたし理解度診断」ができました！</h2>
        <span aria-hidden="true">🏆</span>
      </div>
      <p class="challenge-share-lead">参加URLを友達に送りましょう！</p>
      <div class="challenge-share-card">
        <label class="challenge-label" for="share-url">挑戦用URL</label>
        <input id="share-url" class="challenge-input challenge-share-url" readonly value="${escapeHtml(shareUrl)}">
        <button class="challenge-primary challenge-copy-link" data-action="copy-url" data-copy-value="${escapeHtml(shareUrl)}">リンクをコピーする</button>
        <div class="challenge-social-row" role="group" aria-label="参加URLをシェア">
          <button type="button" class="challenge-social-button instagram" data-action="share-instagram" aria-label="Instagramでシェア">
            <span class="challenge-social-mark" aria-hidden="true"><i></i></span>
            <span>Instagram</span>
          </button>
          <button type="button" class="challenge-social-button x" data-action="share-x" aria-label="Xでシェア">
            <span class="challenge-social-mark" aria-hidden="true">X</span>
            <span>X</span>
          </button>
          <button type="button" class="challenge-social-button line" data-action="share-line" aria-label="LINEで送る">
            <span class="challenge-social-mark" aria-hidden="true">LINE</span>
            <span>LINE</span>
          </button>
          <button type="button" class="challenge-social-button sms" data-action="share-native" aria-label="SMS・その他で送る">
            <span class="challenge-social-mark" aria-hidden="true">SMS</span>
            <span>SMS・その他</span>
          </button>
        </div>
        <p class="challenge-instagram-note">Instagramはリンクをコピーして、ストーリーズなどに貼り付けてください。</p>
      </div>
      <details class="challenge-qr-details">
        <summary>QRコードで送る</summary>
        <div class="challenge-qr"><canvas id="challenge-qr" width="180" height="180" aria-label="挑戦用URLのQRコード"></canvas></div>
      </details>
      <div class="challenge-count" data-testid="participant-count">
        <b>${room.completedParticipants}</b>人回答済み ／ <b>${room.participantCount}</b>人参加 ／ 上限${room.maxParticipants}人
      </div>
      ${questionSubmissionNotice()}
      <div class="challenge-button-row">
        <a class="challenge-secondary" href="/challenge/ranking?room=${room.code}">理解度ボードを見る</a>
        <button class="challenge-secondary" data-action="copy-ranking" data-copy-value="${escapeHtml(rankingUrl)}">理解度ボードのURLをコピー</button>
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

function questionSubmissionNotice() {
  if (!state.questionSubmissionStatus) return '';
  const messages = {
    sending: '掲載候補のお題を運営へ送信しています。',
    sent: `掲載候補として${state.questionSubmissionCount}問を運営へ送信しました。承認されるまで公開ライブラリには追加されません。`,
    empty: '掲載候補の送信に同意しましたが、自作・編集したお題がないため送信対象はありませんでした。',
    failed: 'クイズは作成できましたが、掲載候補のお題は通信エラーで送信できませんでした。',
    blocked: 'クイズは作成できましたが、掲載候補に個人情報らしい内容を検知したため運営へ送信しませんでした。',
  };
  const retry = state.questionSubmissionStatus === 'failed'
    ? '<button class="challenge-secondary" data-action="retry-question-submit">お題候補の送信を再試行</button>'
    : '';
  return `<div class="challenge-note" role="status" data-testid="question-submission-status">
    ${escapeHtml(messages[state.questionSubmissionStatus] || '')}${retry}
  </div>`;
}

function participantDetail(participant, cards) {
  return `<details class="challenge-participant">
    <summary>
      <span>${escapeHtml(participant.name)}<small>${participant.rankingParticipating ? '理解度ボード掲載' : '理解度ボード非掲載'}</small></span>
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
      <p class="challenge-brand-promise">相手を理解できるまで、何度でも挑戦できる</p>
      <div class="challenge-count"><b>${room.completedParticipants}</b>人が回答済み ／ 上限${room.maxParticipants}人</div>
      <label class="challenge-label" for="participant-name">表示名（12文字まで）</label>
      <input id="participant-name" class="challenge-input" maxlength="12" autocomplete="nickname"
        placeholder="例：ゆう（本名は避けてください）" value="${escapeHtml(state.participantName)}">
      <button class="challenge-primary" data-action="join">10問の答え当てに挑戦する <span>▶</span></button>
      <a class="challenge-secondary" href="/challenge/ranking?room=${room.code}">理解度ボードを見る</a>
      <p class="challenge-note">回答後に、理解度ボードへ載せるかを結果画面で選べます。同じ10問へもう一度挑戦することもできます。</p>
      <p class="challenge-note">回答内容は答え合わせと主催者の回答確認に使用されます。本名・学校名など個人が特定できる名前は入力しないでください。回答途中はこの端末へ自動保存されます。</p>
    </section>`,
  );
}

function resultView() {
  const result = state.result;
  if (!result) return errorView();
  const tier = isEnglish ? getChallengeResultTierEnglish(result.score) : getChallengeResultTier(result.score);
  const reviewLines = isEnglish ? getChallengeReviewLinesEnglish(result) : getChallengeReviewLines(result);
  return `
    <section class="challenge-result-image-section" aria-labelledby="challenge-result-score-title">
      <h1 id="challenge-result-score-title" class="challenge-result-visually-hidden">${result.score}/10問 正解</h1>
      ${state.resultImageUrl
        ? `<img class="challenge-result-image" data-testid="challenge-result-image"
            src="${state.resultImageUrl}" width="1080" height="1350"
            alt="${escapeHtml(result.participant.name)}さんの${escapeHtml(result.creatorName)}さん理解度、${result.score}/10問正解、称号は${escapeHtml(tier.title)}">`
        : `<div class="challenge-result-image-loading" role="status">
            ${state.resultImageError ? escapeHtml(state.resultImageError) : '名前と称号入りの結果画像を準備しています…'}
          </div>`}
      <p class="challenge-note">画像はこの端末内で作成します。入力した名前や回答画像をサーバーへ追加保存しません。</p>
    </section>
    ${state.error ? `<p class="challenge-error" role="alert">${escapeHtml(errorMessage(state.error))}</p>` : ''}
    <section class="challenge-panel">
      <span class="challenge-section-label">ANSWER CHECK</span>
      <h2>どこが当たった？</h2>
      <div class="challenge-results" data-result-feedback-sequence>
        ${result.answers.map((answer, index) => `
          <article class="challenge-result ${answer.match ? 'is-correct' : ''}"
            data-result-answer="${index}" data-result-feedback="${answer.match ? 'correct' : 'incorrect'}">
            <header><b>Q${index + 1} ${escapeHtml(answer.card.title)}</b><span>${answer.match ? '当たり' : 'ハズレ'}</span></header>
            <p>あなた：<i style="background:${COLORS[answer.selected]}"></i>${escapeHtml(answer.card.choices[answer.selected])}</p>
            <p>正解：<i style="background:${COLORS[answer.correct]}"></i>${escapeHtml(answer.card.choices[answer.correct])}</p>
          </article>
        `).join('')}
      </div>
      <section class="challenge-ai-review" data-testid="challenge-ai-review" aria-labelledby="challenge-ai-review-title">
        <span class="challenge-section-label">REVIEW</span>
        <h2 id="challenge-ai-review-title">答え合わせレポート</h2>
        <p class="challenge-ai-review-lead">10問の一致・すれ違いから作成</p>
        <div>
          ${reviewLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
        </div>
        <small>回答内容をもとに用意された文章から総評を作成しています。</small>
      </section>
      <div class="challenge-result-share-wrap">
        <section class="challenge-result-share" data-testid="challenge-result-share"
          aria-labelledby="challenge-result-share-title">
          <span class="challenge-section-label">SHARE YOUR RESULT</span>
          <h2 id="challenge-result-share-title">この結果、友達に伝えよう</h2>
          <p>理解度ボードだけに載せるか、結果の送り方・保存方法を選べます。</p>
          <button type="button" class="challenge-result-board-only" data-action="publish-board-only"
            ${state.boardPreferenceBusy || state.result.participant?.rankingParticipating ? 'disabled' : ''}>
            <span aria-hidden="true">📒</span>
            ${state.boardPreferenceBusy
              ? '理解度ボードを更新中…'
              : state.result.participant?.rankingParticipating
                ? '理解度ボードに掲載済み'
                : '理解度ボードだけに載せる'}
          </button>
          <div class="challenge-result-share-divider"><span>共有・保存する場合</span></div>
          <label class="challenge-result-board-toggle">
            <input type="checkbox" data-action="toggle-ranking"
              ${state.boardOptIn ? 'checked' : ''} ${state.boardPreferenceBusy ? 'disabled' : ''}>
            <span>
              <strong>理解度ボードに載せる（共有・保存と同時）</strong>
              <small>初期設定はオンです。チェックを外すと、理解度ボードへ載せずに共有・保存します。</small>
            </span>
          </label>
          ${state.boardActionMessage
            ? `<p class="challenge-result-board-message" role="status">${escapeHtml(state.boardActionMessage)}</p>`
            : ''}
          <div class="challenge-result-share-buttons">
            <button type="button" class="challenge-result-share-button instagram"
              data-action="share-result-instagram"
              ${state.resultImageUrl && !state.boardPreferenceBusy ? '' : 'disabled'}>
              <strong>Instagram用</strong>
              <small>ストーリー用：文章コピー＋画像保存</small>
            </button>
            <button type="button" class="challenge-result-share-button line" data-action="share-result-line"
              ${state.boardPreferenceBusy ? 'disabled' : ''}>
              <strong>LINEで送る</strong>
            </button>
            <button type="button" class="challenge-result-share-button x" data-action="share-result-x"
              ${state.boardPreferenceBusy ? 'disabled' : ''}>
              <strong>Xで結果を投稿</strong>
            </button>
            <button type="button" class="challenge-result-share-button image" data-action="save-result-image"
              ${state.resultImageUrl && !state.boardPreferenceBusy ? '' : 'disabled'}>
              <strong>${state.resultImageUrl ? '画像だけ保存' : '画像を準備中…'}</strong>
            </button>
          </div>
        </section>
      </div>
      <button class="challenge-primary" data-action="retry-challenge">もう一度、答えを予想する</button>
      <p class="challenge-result-retry-note">もう一度予想すると今回の回答は上書きされます。掲載済みの場合は、現在の理解度ボードからいったん外れます。</p>
      <section class="challenge-role-swap" data-testid="challenge-role-swap">
        <span class="challenge-section-label">ROLE CHANGE</span>
        <h2>今度は役割交代</h2>
        <p>同じ10問を使って、次はあなたが出題者になれます。元の出題者の正解は引き継がれません。</p>
        <button class="challenge-primary" data-action="swap-roles">役割交代して、次は自分が出題する</button>
      </section>
      <a class="challenge-secondary" href="/challenge">別の10問で自分も作る</a>
      <a class="challenge-secondary" href="/challenge/ranking?room=${result.code}">理解度ボードを見る</a>
      <a class="challenge-secondary" href="/">トップへ戻る</a>
    </section>
  `;
}

function resultFeedbackSequenceKey() {
  if (!state.result) return '';
  const answerKey = state.result.answers
    .map((answer) => `${answer.selected}:${answer.correct}`)
    .join(',');
  return `${state.result.code}:${state.result.participant?.name || ''}:${answerKey}`;
}

function stopResultFeedbackSequence() {
  resultFeedbackObserver?.disconnect();
  resultFeedbackObserver = null;
  if (resultFeedbackTimer) window.clearTimeout(resultFeedbackTimer);
  resultFeedbackTimer = 0;
  resultFeedbackQueue = [];
  resultFeedbackBusy = false;
  resultFeedbackKey = '';
}

function revealNextResultFeedback() {
  if (resultFeedbackBusy || !resultFeedbackQueue.length) return;
  resultFeedbackBusy = true;
  const card = resultFeedbackQueue.shift();
  card?.classList.add('is-feedback-revealed');
  resultFeedbackTimer = window.setTimeout(() => {
    resultFeedbackBusy = false;
    resultFeedbackTimer = 0;
    revealNextResultFeedback();
  }, 560);
}

function queueResultFeedbackCard(card) {
  if (!card || card.classList.contains('is-feedback-revealed')
    || resultFeedbackQueue.includes(card)) return;
  resultFeedbackObserver?.unobserve(card);
  resultFeedbackQueue.push(card);
  revealNextResultFeedback();
}

function startResultFeedbackSequence() {
  const key = resultFeedbackSequenceKey();
  if (!key) return;
  const cards = Array.from(app.querySelectorAll('[data-result-answer]'));
  if (!cards.length) return;
  if (key === resultFeedbackKey) {
    cards.forEach((card) => card.classList.add('is-feedback-revealed'));
    return;
  }

  stopResultFeedbackSequence();
  resultFeedbackKey = key;
  cards.forEach((card) => card.classList.add('is-feedback-awaiting'));

  if (typeof IntersectionObserver !== 'function') {
    cards.forEach((card) => queueResultFeedbackCard(card));
    return;
  }

  resultFeedbackObserver = new IntersectionObserver((entries) => {
    entries
      .filter((entry) => entry.isIntersecting)
      .sort((left, right) => Number(left.target.dataset.resultAnswer)
        - Number(right.target.dataset.resultAnswer))
      .forEach((entry) => queueResultFeedbackCard(entry.target));
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.25 });
  cards.forEach((card) => resultFeedbackObserver.observe(card));
}

function rankingView() {
  if (!state.room) return errorView();
  const room = state.room;
  return shell(
    'UNDERSTANDING BOARD',
    '理解度ボード',
    '載せるかは自分で選べます。掲載された回答は、10問を回答し終えた順に表示します。',
    `<section class="challenge-panel" data-testid="understanding-board">
      <div class="challenge-count"><b>${room.completedParticipants}</b>人が回答済み ／ 上限${room.maxParticipants}人</div>
      ${state.ranking.length ? `<ul class="challenge-ranking-list">
        ${state.ranking.map((participant) => `
          <li>
            <span class="challenge-board-status">答え合わせ済み</span>
            <b>${escapeHtml(participant.name)}</b>
            <strong>${participant.score}/10問一致</strong>
          </li>
        `).join('')}
      </ul>` : '<p class="challenge-empty">理解度ボードに載せた回答者はまだいません。</p>'}
      <button class="challenge-primary" data-action="refresh-ranking">理解度ボードを更新</button>
      <a class="challenge-secondary" href="/challenge?room=${room.code}">このクイズに挑戦する</a>
      <button class="challenge-secondary" data-action="copy-url" data-copy-value="${escapeHtml(challengeUrl(room.code))}">挑戦用URLをコピー</button>
      <a class="challenge-secondary" href="/challenge">自分も作る</a>
      <p class="challenge-note">回答順で表示します。順位や点数順の並び替えはありません。掲載は任意で、表示名と一致した問題数だけを公開します。問題ごとの回答は主催者だけが確認できます。</p>
    </section>`,
  );
}

function libraryView() {
  const packs = questionPacks(isEnglish);
  return shell(
    '10 QUESTION PACKS',
    '人気のお題ライブラリ',
    'テーマを選ぶだけで、10問をまとめてクイズにできます。',
    `<section class="challenge-panel">
      <p class="challenge-library-status">気分や相手に合うパックを選んでください。どのパックも通常版・LIVE版の両方で使えます。</p>
      <div class="challenge-library challenge-pack-library" data-testid="question-library">
        ${packs.map((pack) => {
          const cards = questionPackCards(allCards, pack.slug, isEnglish, QUESTION_COUNT);
          return `<article class="challenge-library-card challenge-pack-card" data-pack="${escapeHtml(pack.slug)}">
              <img src="${escapeHtml(pack.image)}" width="640" height="360" loading="lazy" decoding="async"
                alt="${escapeHtml(pack.title)}${isEnglish ? ' illustration' : 'のイメージ画像'}">
            <div class="challenge-pack-copy">
              <span class="challenge-pack-count">${pack.featured ? '主力・10問パック' : '10問パック'}</span>
              <h2>${escapeHtml(pack.title)}</h2>
              <p>${escapeHtml(pack.description)}</p>
              <details>
                <summary>入っている10問を見る</summary>
                <ol>${cards.map((card) => `<li>${escapeHtml(card.title)}</li>`).join('')}</ol>
              </details>
            </div>
            <div class="challenge-pack-actions">
              <a href="${languagePrefix}/challenge?pack=${encodeURIComponent(pack.slug)}">通常版で作る</a>
              <a href="${languagePrefix}/live-challenge?pack=${encodeURIComponent(pack.slug)}">LIVE版で作る</a>
            </div>
          </article>`;
        }).join('')}
      </div>
      <a class="challenge-primary" href="${languagePrefix}/challenge">パックを使わず1問ずつ選ぶ</a>
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
  document.querySelector('[data-action="back-create"]')?.addEventListener('click', () => setState({
    mode: 'create',
    error: '',
    editingQuestion: false,
  }));
  document.querySelector('[data-action="skip-question"]')?.addEventListener('click', skipCreatorQuestion);
  document.querySelector('[data-action="edit-question"]')?.addEventListener('click', () => {
    captureCreatorConsent();
    setState({
      editingQuestion: true,
      editingOriginalCard: structuredClone(state.cards[state.questionIndex]),
      error: '',
    });
  });
  document.querySelector('[data-action="custom-question"]')?.addEventListener('click', () => {
    captureCreatorConsent();
    const cards = state.cards.slice();
    const original = structuredClone(cards[state.questionIndex]);
    cards[state.questionIndex] = {
      id: `USR${Date.now()}${state.questionIndex}`,
      sourceId: '',
      category: '自作のお題',
      title: '',
      choices: ['', '', '', '', ''],
    };
    setState({ cards, editingQuestion: true, editingOriginalCard: original, error: '' });
  });
  document.querySelector('[data-action="save-question-edit"]')?.addEventListener('click', saveCreatorQuestionEdit);
  document.querySelector('[data-action="cancel-question-edit"]')?.addEventListener('click', cancelCreatorQuestionEdit);
  document.querySelector('[data-action="previous-builder-question"]')?.addEventListener('click', previousBuilderQuestion);
  document.querySelectorAll('[data-action="builder-answer"]').forEach((button) => {
    button.addEventListener('click', () => answerQuestion(Number(button.dataset.choice)));
  });
  document.querySelector('[data-action="resume-create"]')?.addEventListener('click', resumeCreate);
  document.querySelector('[data-action="delete-draft"]')?.addEventListener('click', deleteCreatorDraft);
  document.querySelector('[data-action="previous-question"]')?.addEventListener('click', previousQuestion);
  document.querySelectorAll('[data-action="answer"]').forEach((button) => {
    button.addEventListener('click', () => answerQuestion(Number(button.dataset.choice)));
  });
  document.querySelectorAll('[data-action="copy-url"], [data-action="copy-ranking"]').forEach((button) => {
    button.addEventListener('click', () => copyValue(button));
  });
  document.querySelector('[data-action="share-instagram"]')?.addEventListener('click', shareToInstagram);
  document.querySelector('[data-action="share-line"]')?.addEventListener('click', () => {
    if (!state.room) return;
    const url = challengeUrl(state.room.code);
    openLineShare(shareText(state.room, url));
  });
  document.querySelector('[data-action="share-x"]')?.addEventListener('click', () => {
    if (!state.room) return;
    const url = challengeUrl(state.room.code);
    openXShare(shareText(state.room, url));
  });
  document.querySelector('[data-action="share-native"]')?.addEventListener('click', shareParticipation);
  document.querySelector('[data-action="refresh-manage"]')?.addEventListener('click', loadManageRoom);
  document.querySelector('[data-action="retry-question-submit"]')?.addEventListener('click', submitCreatorQuestionCandidates);
  document.querySelector('[data-action="report-question"]')?.addEventListener('click', (event) => reportQuestion(event.currentTarget));
  document.querySelector('[data-action="refresh-ranking"]')?.addEventListener('click', loadRanking);
  document.querySelector('[data-action="join"]')?.addEventListener('click', joinRoom);
  document.querySelector('[data-action="toggle-ranking"]')?.addEventListener('change', (event) => {
    chooseBoardPreference(event.currentTarget.checked);
  });
  document.querySelector('[data-action="publish-board-only"]')?.addEventListener('click', publishBoardOnly);
  document.querySelector('[data-action="retry-challenge"]')?.addEventListener('click', retryChallenge);
  document.querySelector('[data-action="swap-roles"]')?.addEventListener('click', startRoleSwap);
  document.querySelector('[data-action="share-result-line"]')?.addEventListener('click', shareResultToLine);
  document.querySelector('[data-action="share-result-x"]')?.addEventListener('click', shareResultToX);
  document.querySelector('[data-action="share-result-instagram"]')?.addEventListener('click', shareResultToInstagram);
  document.querySelector('[data-action="save-result-image"]')?.addEventListener('click', () => {
    saveResultImageOnly();
  });
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
  const preferredPack = questionPackBySlug(preferredPackSlug, isEnglish);
  const packedCards = questionPackCards(allCards, preferredPackSlug, isEnglish, QUESTION_COUNT);
  if (preferredPack && packedCards.length !== QUESTION_COUNT) {
    return setState({ error: 'questions-unavailable' });
  }
  const preferredCard = allCards.find((card) => card.id === preferredCardId);
  const pool = preferredCard ? allCards.filter((card) => card.id !== preferredCard.id) : allCards;
  const cards = (packedCards.length === QUESTION_COUNT
    ? packedCards
    : preferredCard
      ? [preferredCard, ...pickChallengeCards(pool, QUESTION_COUNT - 1)]
      : pickChallengeCards(pool, QUESTION_COUNT)).map(toCreatorDraftCard);
  const next = {
    creatorName: name,
    cards,
    answers: [],
    questionIndex: 0,
    error: '',
    mode: 'creator-edit',
    questionSubmissionConsent: true,
    editingQuestion: false,
    editingOriginalCard: null,
  };
  saveCreatorDraft(next);
  setState(next);
}

function captureCreatorConsent() {
  state.questionSubmissionConsent = document.getElementById('question-submit-consent')?.checked === true;
}

function captureCreatorEdit() {
  if (state.mode !== 'creator-edit') return;
  captureCreatorConsent();
  state.cards = state.cards.map((card, index) => ({
    ...card,
    title: document.querySelector(`[data-question="${index}"]`)?.value.trim() ?? card.title,
    choices: card.choices.map((choice, choiceIndex) => (
      document.querySelector(`[data-option="${index}:${choiceIndex}"]`)?.value.trim() ?? choice
    )),
  }));
}

function saveCreatorQuestionEdit() {
  captureCreatorEdit();
  const card = state.cards[state.questionIndex];
  if (!card?.title || card.choices.length !== 5 || card.choices.some((choice) => !choice)) {
    return setState({ error: 'questions-incomplete' });
  }
  const next = { editingQuestion: false, editingOriginalCard: null, error: '' };
  saveCreatorDraft({ ...state, ...next });
  setState(next);
}

function cancelCreatorQuestionEdit() {
  captureCreatorConsent();
  const cards = state.cards.slice();
  if (state.editingOriginalCard) cards[state.questionIndex] = state.editingOriginalCard;
  const next = { cards, editingQuestion: false, editingOriginalCard: null, error: '' };
  saveCreatorDraft({ ...state, ...next });
  setState(next);
}

function skipCreatorQuestion(options = {}) {
  captureCreatorConsent();
  const currentQuestionId = String(state.cards[state.questionIndex]?.sourceId || '');
  if (options?.trackSkip !== false && currentQuestionId) {
    recordQuestionSelectionEvent(currentQuestionId, 'challenge', 'skipped');
  }
  const usedIds = new Set(state.cards.map((card, index) => (
    index === state.questionIndex ? '' : String(card.sourceId || card.id)
  )).filter(Boolean));
  const pool = allCards.filter((card) => !usedIds.has(String(card.id))
    && String(card.id) !== String(state.cards[state.questionIndex]?.sourceId || ''));
  const replacement = pickChallengeCards(pool.length ? pool : allCards, 1)[0];
  if (!replacement) return setState({ error: 'questions-unavailable' });
  const cards = state.cards.slice();
  const answers = state.answers.slice();
  cards[state.questionIndex] = toCreatorDraftCard(replacement);
  delete answers[state.questionIndex];
  const next = { cards, answers, editingQuestion: false, editingOriginalCard: null, error: '' };
  saveCreatorDraft({ ...state, ...next });
  setState(next);
}

function previousBuilderQuestion() {
  if (state.questionIndex <= 0) return;
  captureCreatorConsent();
  const next = { questionIndex: state.questionIndex - 1, editingQuestion: false, error: '' };
  saveCreatorDraft({ ...state, ...next });
  setState(next);
}

function toCreatorDraftCard(card) {
  return {
    ...card,
    sourceId: card.id,
    choices: card.choices.slice(0, 5),
  };
}

function resumeCreate() {
  const draft = creatorDraft();
  if (!draft) return setState({ error: 'draft-not-found' });
  setState({
    mode: 'creator-edit',
    creatorName: draft.creatorName,
    cards: draft.cards,
    answers: draft.answers,
    questionIndex: Math.min(Math.max(Number(draft.questionIndex) || 0, 0), QUESTION_COUNT - 1),
    questionSubmissionConsent: draft.questionSubmissionConsent !== false,
    editingQuestion: false,
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
  if (state.mode === 'participant-answer') {
    return answerParticipantQuestion(choice);
  }

  const answers = state.answers.slice();
  answers[state.questionIndex] = choice;

  if (state.mode === 'creator-edit') {
    captureCreatorConsent();
    if (state.questionIndex < QUESTION_COUNT - 1) {
      const questionIndex = state.questionIndex + 1;
      saveCreatorDraft({ ...state, answers, questionIndex });
      return setState({ answers, questionIndex, error: '' });
    }
    if (answers.length !== QUESTION_COUNT || answers.some((answer) => !Number.isInteger(answer))) return;
    return createChallengeRoom(answers);
  }
}

async function answerParticipantQuestion(choice) {
  if (state.answerPending) return;
  const questionIndex = state.questionIndex;
  const answers = state.answers.slice();
  answers[questionIndex] = choice;
  quizFeedbackSoundPlayer.prime();
  setState({ answerPending: true, error: '' });
  try {
    const response = await fetch(`/api/challenge/rooms/${state.roomCode}/answer`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-challenge-participant-token': state.participantToken,
      },
      body: JSON.stringify({ questionIndex, choice }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'answer-failed');
    await quizFeedbackSoundPlayer.play(data.match === true);

    if (data.completed) {
      localStorage.removeItem(participantDraftKey(state.roomCode));
      await loadResult();
      return;
    }

    const nextQuestionIndex = Number.isInteger(data.nextQuestionIndex)
      ? data.nextQuestionIndex
      : questionIndex + 1;
    const next = {
      answers,
      questionIndex: Math.min(nextQuestionIndex, QUESTION_COUNT - 1),
      answerPending: false,
      error: '',
    };
    saveParticipantDraft(next);
    setState(next);
  } catch (error) {
    setState({
      answerPending: false,
      mode: 'participant-answer',
      error: error.message,
    });
  }
}

async function createChallengeRoom(answers) {
  const cards = state.cards.map((card, index) => {
    const source = allCards.find((item) => String(item.id) === String(card.sourceId || ''));
    const changed = !source || card.title !== source.title
      || card.choices.some((choice, choiceIndex) => choice !== source.choices[choiceIndex]);
    return { ...card, id: changed ? `USR${Date.now()}${index}` : source.id };
  });
  const candidates = changedQuestionCandidates(cards, allCards);
  const submissionConsent = state.questionSubmissionConsent;
  setState({ loading: true, error: '' });
  try {
    const response = await fetch('/api/challenge/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ creatorName: state.creatorName, cards, answers }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'create-failed');
    saveManageRoom(data.code, data.manageToken, data.room.creatorName);
    localStorage.removeItem(CREATOR_DRAFT_KEY);
    history.replaceState(null, '', `${languagePrefix}/challenge/manage?room=${data.code}#manage=${data.manageToken}`);
    setState({
      loading: false,
      roomCode: data.code,
      room: data.room,
      cards,
      manageToken: data.manageToken,
      participants: [],
      mode: 'manage',
      answers,
      questionSubmissionStatus: submissionConsent
        ? (candidates.length ? 'sending' : 'empty')
        : '',
      questionSubmissionCount: 0,
      questionSubmissionCandidates: submissionConsent ? candidates : [],
    });
    if (submissionConsent && candidates.length) submitCreatorQuestionCandidates();
  } catch (error) {
    setState({ loading: false, mode: 'creator-edit', error: error.message });
  }
}

async function submitCreatorQuestionCandidates() {
  if (!state.questionSubmissionCandidates.length) return;
  setState({ questionSubmissionStatus: 'sending' });
  try {
    const result = await submitQuestionCandidates({
      consent: true,
      sourceMode: isEnglish ? 'challenge-en' : 'challenge',
      questions: state.questionSubmissionCandidates,
    });
    setState({
      questionSubmissionStatus: 'sent',
      questionSubmissionCount: Number(result.submitted || 0),
      questionSubmissionCandidates: [],
    });
  } catch (error) {
    const blocked = error.message === 'question-personal-information-detected';
    setState({
      questionSubmissionStatus: blocked ? 'blocked' : 'failed',
      questionSubmissionCandidates: blocked ? [] : state.questionSubmissionCandidates,
    });
  }
}

async function reportQuestion(button) {
  const questionId = button?.dataset.questionId || '';
  const box = button?.closest('[data-report-box]');
  const reason = box?.querySelector('[data-report-reason]')?.value || '';
  if (!questionId || !reason) return;
  if (!confirm('このお題を通報し、確認が終わるまで公開ライブラリから非公開にしますか？')) return;
  button.disabled = true;
  try {
    await reportManagedQuestion(questionId, reason);
    allCards = allCards.filter((card) => String(card.managedQuestionId || card.id) !== questionId);
    alert('通報を受け付けました。このお題は公開ライブラリから非公開になりました。');
    skipCreatorQuestion({ trackSkip: false });
  } catch (error) {
    button.disabled = false;
    setState({ error: error.message || 'question-report-failed' });
  }
}

async function copyValue(button) {
  const value = button.dataset.copyValue || document.getElementById('share-url')?.value || '';
  const copied = await copyText(value);
  if (copied) {
    button.textContent = 'コピーしました';
    return;
  }
  const input = document.getElementById('share-url');
  input?.select();
  setState({ error: 'copy-failed' });
}

async function shareToInstagram() {
  if (!state.room) return;
  const copied = await copyText(challengeUrl(state.room.code));
  if (!copied) return setState({ error: 'copy-failed' });
  window.alert('あなたのクイズのリンクをコピーしました。\nInstagramストーリーズにシェアしてください！');
}

async function shareParticipation() {
  if (!state.room) return;
  const url = challengeUrl(state.room.code);
  const text = shareText(state.room, url);
  if (navigator.share) {
    try {
      await navigator.share({
        title: isEnglish
          ? `${state.room.creatorName}’s “Know Me” quiz`
          : `${state.room.creatorName}の「わたし理解度診断」`,
        text,
      });
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  const copied = await copyText(text);
  if (copied) {
    window.alert(isEnglish
      ? 'The invitation text was copied.'
      : 'SMSなどで送れる共有文をコピーしました。');
    return;
  }
  setState({ error: 'copy-failed' });
}

async function joinRoom() {
  quizFeedbackSoundPlayer.prime();
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
    saveParticipantToken(state.roomCode, data.participantToken);
    if (data.participant.submitted) {
      setState({ participantToken: data.participantToken });
      await loadResult(data.participantToken);
      return;
    }
    const next = {
      loading: false,
      answerPending: false,
      participantToken: data.participantToken,
      participantName: data.participant.name,
      cards: state.room.cards,
      answers: [],
      questionIndex: Math.min(Number(data.participant.answerCount) || 0, QUESTION_COUNT - 1),
      mode: 'participant-answer',
    };
    setState(next);
    saveParticipantDraft(next);
  } catch (error) {
    setState({ loading: false, mode: 'join', error: error.message });
  }
}

function chooseBoardPreference(enabled) {
  saveBoardOptIn(state.roomCode, enabled);
  setState({
    boardOptIn: enabled,
    boardActionMessage: '',
    error: '',
  });
}

async function updateBoardPreference(enabled) {
  if (!state.result || !state.participantToken) return false;
  const currentPreference = state.result.participant?.rankingParticipating === true;
  saveBoardOptIn(state.roomCode, enabled);
  if (currentPreference === enabled) {
    setState({
      boardOptIn: enabled,
      boardPreferenceBusy: false,
      error: '',
    });
    return true;
  }
  setState({
    boardOptIn: enabled,
    boardPreferenceBusy: true,
    boardActionMessage: '',
    error: '',
  });
  try {
    const response = await fetch(`/api/challenge/rooms/${state.roomCode}/ranking`, {
      method: enabled ? 'POST' : 'DELETE',
      headers: {
        'content-type': 'application/json',
        'x-challenge-participant-token': state.participantToken,
      },
      body: JSON.stringify({}),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || (enabled
        ? 'ranking-registration-failed'
        : 'ranking-unregistration-failed'));
    }
    saveBoardOptIn(state.roomCode, enabled);
    setState({
      result: { ...state.result, participant: data.participant },
      boardOptIn: enabled,
      boardPreferenceBusy: false,
    });
    return true;
  } catch (error) {
    const actualPreference = state.result.participant?.rankingParticipating === true;
    saveBoardOptIn(state.roomCode, actualPreference);
    setState({
      boardOptIn: actualPreference,
      boardPreferenceBusy: false,
      mode: 'result',
      error: error.message,
    });
    return false;
  }
}

async function applySelectedBoardPreference() {
  if (state.boardPreferenceBusy) return false;
  return updateBoardPreference(state.boardOptIn);
}

async function publishBoardOnly() {
  if (!state.result || state.boardPreferenceBusy) return;
  const updated = await updateBoardPreference(true);
  if (!updated) return;
  setState({
    boardOptIn: true,
    boardActionMessage: isEnglish
      ? 'Added to the Understanding Board.'
      : '理解度ボードに載せました。',
  });
}

async function retryChallenge() {
  if (!state.result || !state.participantToken) return;
  if (state.result.participant?.rankingParticipating
    && !confirm('もう一度予想すると、現在の理解度ボード掲載はいったん取り消されます。続けますか？')) return;
  setState({ loading: true, error: '' });
  try {
    const response = await fetch(`/api/challenge/rooms/${state.roomCode}/retry`, {
      method: 'POST',
      headers: { 'x-challenge-participant-token': state.participantToken },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'retry-failed');
    localStorage.removeItem(participantDraftKey(state.roomCode));
    resetBoardOptIn(state.roomCode);
    const next = {
      loading: false,
      answerPending: false,
      participantName: data.participant.name,
      cards: state.room.cards,
      answers: [],
      questionIndex: 0,
      result: null,
      resultImageUrl: '',
      resultImageBusy: false,
      resultImageError: '',
      boardOptIn: true,
      boardPreferenceBusy: false,
      mode: 'participant-answer',
      error: '',
    };
    saveParticipantDraft(next);
    setState(next);
  } catch (error) {
    setState({ loading: false, mode: 'result', error: error.message });
  }
}

function startRoleSwap() {
  if (!state.result) return;
  const cards = (state.result.answers || [])
    .map((answer) => answer?.card)
    .filter((card) => card?.title && Array.isArray(card.choices) && card.choices.length >= 5)
    .slice(0, QUESTION_COUNT)
    .map(toCreatorDraftCard);
  if (cards.length !== QUESTION_COUNT) {
    setState({ error: 'questions-unavailable' });
    return;
  }
  const next = {
    mode: 'creator-edit',
    roomCode: '',
    room: null,
    creatorName: String(state.result.participant?.name || state.participantName || '').slice(0, 12),
    participantName: '',
    participantToken: '',
    manageToken: '',
    cards,
    answers: [],
    questionIndex: 0,
    result: null,
    resultImageUrl: '',
    resultImageBusy: false,
    resultImageError: '',
    questionSubmissionConsent: true,
    editingQuestion: false,
    editingOriginalCard: null,
    error: '',
  };
  history.replaceState(null, '', `${languagePrefix}/challenge?role=swap`);
  saveCreatorDraft(next);
  setState(next);
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
    const answerCount = Math.min(
      Math.max(Number(resumeData.participant.answerCount) || 0, 0),
      QUESTION_COUNT - 1,
    );
    setState({
      participantName: resumeData.participant.name,
      answers: draft?.answers || [],
      questionIndex: answerCount,
      answerPending: false,
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
  stopResultFeedbackSequence();
  const response = await fetch(`/api/challenge/rooms/${state.roomCode}/result`, {
    headers: { 'x-challenge-participant-token': token },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'result-failed');
  const boardOptIn = readBoardOptIn(state.roomCode);
  setState({
    loading: false,
    answerPending: false,
    result: data,
    resultImageUrl: '',
    resultImageBusy: false,
    resultImageError: '',
    boardOptIn,
    boardPreferenceBusy: false,
    boardActionMessage: '',
    mode: 'result',
  });
}

function loadResultImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function resultRoundRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function splitResultText(text, maxLength = 18, maxLines = 3) {
  const value = String(text || '');
  if (!value) return [];
  const lines = [];
  value.split('\n').forEach((paragraph) => {
    for (let index = 0; index < paragraph.length; index += maxLength) {
      lines.push(paragraph.slice(index, index + maxLength));
    }
  });
  return lines.slice(0, maxLines);
}

function drawResultLines(context, lines, x, y, lineHeight) {
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
}

async function createChallengeResultCanvas(result) {
  await document.fonts?.ready?.catch(() => {});
  const [girlImage, qrImage] = await Promise.all([
    loadResultImage(RESULT_GIRL_IMAGE_SRC),
    loadResultImage(RESULT_QR_IMAGE_SRC),
  ]);
  const tier = isEnglish ? getChallengeResultTierEnglish(result.score) : getChallengeResultTier(result.score);
  const participantName = String(result.participant?.name || (isEnglish ? 'Player' : '回答者'));
  const creatorName = String(result.creatorName || (isEnglish ? 'Creator' : '出題者'));
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext('2d');

  context.fillStyle = '#ec4683';
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = '#191919';
  resultRoundRect(context, 68, 50, 944, 1250, 42);
  context.fill();

  context.fillStyle = '#ffffff';
  resultRoundRect(context, 88, 70, 904, 1210, 34);
  context.fill();

  context.fillStyle = '#191919';
  resultRoundRect(context, 88, 70, 904, 132, 34);
  context.fill();
  context.fillStyle = '#ffffff';
  context.font = '900 22px "Yu Gothic", sans-serif';
  context.textAlign = 'left';
  context.fillText(isEnglish ? 'KNOW ME QUIZ' : 'わたし理解度診断', 132, 112);
  context.font = '700 25px "HuiFontP29", "Yu Gothic", sans-serif';
  context.fillText(isEnglish ? `How well do you know ${creatorName}?` : '私のこと、ちゃんと分かってるよね？', 132, 151);
  context.font = '700 19px "Yu Gothic", sans-serif';
  context.fillStyle = '#ffe26b';
  context.fillText(isEnglish ? '10 questions made for conversation.' : '当てるより、話すための10問。', 132, 184);

  context.fillStyle = tier.tagBg;
  resultRoundRect(context, 760, 92, 176, 50, 25);
  context.fill();
  context.strokeStyle = '#ffffff';
  context.lineWidth = 4;
  resultRoundRect(context, 760, 92, 176, 50, 25);
  context.stroke();
  context.fillStyle = tier.tagColor;
  context.font = '900 21px "Yu Gothic", sans-serif';
  context.textAlign = 'center';
  context.fillText(tier.tag, 848, 125);

  context.fillStyle = '#fff8f1';
  resultRoundRect(context, 140, 248, 800, 344, 30);
  context.fill();
  context.strokeStyle = '#ec4683';
  context.setLineDash([18, 16]);
  context.lineWidth = 6;
  resultRoundRect(context, 140, 248, 800, 344, 30);
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = '#ec4683';
  context.font = '700 31px "HuiFontP29", "Yu Gothic", sans-serif';
  context.textAlign = 'left';
  const scoreLabelLines = splitResultText(
    isEnglish ? `${participantName} on\n${creatorName}’s quiz` : `${participantName}さんの\n${creatorName}さん理解度`,
    isEnglish ? 24 : 13,
    2,
  );
  drawResultLines(context, scoreLabelLines, 202, 326, 42);

  context.shadowColor = '#191919';
  context.shadowOffsetX = 8;
  context.shadowOffsetY = 8;
  context.font = '900 116px "Arial Black", "Yu Gothic", sans-serif';
  context.fillText(`${result.score}/10`, 202, 500);
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;

  context.fillStyle = '#ffe36f';
  resultRoundRect(context, 210, 514, 148, 50, 25);
  context.fill();
  context.strokeStyle = '#191919';
  context.lineWidth = 4;
  resultRoundRect(context, 210, 514, 148, 50, 25);
  context.stroke();
  context.fillStyle = '#191919';
  context.font = '900 24px "Yu Gothic", sans-serif';
  context.textAlign = 'center';
  context.fillText(isEnglish ? 'CORRECT' : '問正解', 284, 547);

  context.fillStyle = '#55c9dd';
  context.globalAlpha = 0.18;
  context.beginPath();
  context.arc(764, 418, 128, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
  if (girlImage) {
    context.save();
    context.shadowColor = 'rgba(0,0,0,.18)';
    context.shadowBlur = 18;
    context.shadowOffsetY = 10;
    context.drawImage(girlImage, 642, 286, 238, 284);
    context.restore();
  }

  context.fillStyle = '#191919';
  resultRoundRect(context, 408, 628, 264, 46, 23);
  context.fill();
  context.fillStyle = '#ffe36f';
  context.font = '900 25px "Yu Gothic", sans-serif';
  context.textAlign = 'center';
  context.fillText(isEnglish ? 'YOUR TITLE' : '今日の称号', 540, 660);

  context.fillStyle = '#ec4683';
  const titleLines = splitResultText(tier.title, 11, 2);
  context.font = `900 ${titleLines.length > 1 ? 46 : 54}px "HuiFontP29", "Yu Gothic", sans-serif`;
  drawResultLines(context, titleLines, 540, 740, 58);

  context.fillStyle = '#ffffff';
  resultRoundRect(context, 150, 816, 780, 248, 26);
  context.fill();
  context.strokeStyle = '#191919';
  context.lineWidth = 6;
  resultRoundRect(context, 150, 816, 780, 248, 26);
  context.stroke();
  context.fillStyle = '#191919';
  context.font = '900 31px "HuiFontP29", "Yu Gothic", sans-serif';
  const messageLines = splitResultText(tier.message, 20, 4);
  drawResultLines(context, messageLines, 540, 878, 47);

  context.fillStyle = '#ffe36f';
  resultRoundRect(context, 156, 1094, 768, 132, 26);
  context.fill();
  context.strokeStyle = '#191919';
  context.lineWidth = 5;
  resultRoundRect(context, 156, 1094, 768, 132, 26);
  context.stroke();
  context.fillStyle = '#191919';
  context.font = '900 28px "Yu Gothic", sans-serif';
  context.fillText(isEnglish ? 'Share this result' : 'この結果をシェアしよう', 448, 1134);
  context.fillStyle = '#d63a75';
  context.font = '900 22px "Yu Gothic", sans-serif';
  context.fillText(isEnglish ? 'Which answers matched?' : 'どこが当たった？', 448, 1168);
  context.fillStyle = '#191919';
  context.font = '700 22px monospace';
  context.fillText(isEnglish ? 'streetboardgame.com  /  #Watachan' : 'streetboardgame.com  /  #わたちゃん', 448, 1202);
  if (qrImage) {
    context.fillStyle = '#ffffff';
    resultRoundRect(context, 776, 1106, 108, 108, 18);
    context.fill();
    context.drawImage(qrImage, 784, 1114, 92, 92);
  }

  return canvas;
}

async function prepareResultImage() {
  if (!state.result || state.resultImageBusy || state.resultImageUrl) return;
  state.resultImageBusy = true;
  try {
    const canvas = await createChallengeResultCanvas(state.result);
    setState({
      resultImageUrl: canvas.toDataURL('image/png'),
      resultImageBusy: false,
      resultImageError: '',
    });
  } catch (error) {
    setState({
      resultImageBusy: false,
      resultImageError: '結果画像を作成できませんでした。ページを再読み込みしてください。',
    });
  }
}

async function saveChallengeResultImage(action = 'save-result-image') {
  if (!state.resultImageUrl || !state.result) return '';
  const button = document.querySelector(`[data-action="${action}"]`);
  const previousText = button?.textContent || '';
  if (button) {
    button.disabled = true;
    button.textContent = isEnglish ? 'Saving image…' : '画像を保存しています…';
  }
  try {
    const blob = dataUrlToBlob(state.resultImageUrl);
    return await saveImageBlob(
      blob,
      'watachan-challenge-score.png',
      isEnglish ? 'Know Me Quiz | Score result card' : 'わたし理解度診断｜点数入り結果カード',
    );
  } catch (error) {
    if (error?.name !== 'AbortError') {
      alert(isEnglish
        ? 'The image could not be saved. Please try again.'
        : '画像を保存できませんでした。もう一度お試しください。');
    }
    return '';
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousText;
    }
  }
}

function resultShareText({ includeUrl = true } = {}) {
  const tier = isEnglish ? getChallengeResultTierEnglish(state.result.score) : getChallengeResultTier(state.result.score);
  const shareUrl = `${location.origin}${languagePrefix}/challenge?room=${state.result.code}`;
  const lines = isEnglish
    ? [
        `I guessed ${state.result.creatorName}’s answers!`,
        'Which ones matched? Check the answers and try the same 10 questions.',
        `My title: “${tier.title}”`,
        '#Watachan',
      ]
    : [
        `${state.result.creatorName}の「わたし理解度診断」で答えを予想してみた📒`,
        'どこが当たった？答え合わせしてみて👇',
        `称号は「${tier.title}」`,
        '結果公開は任意・もう一度予想もOK',
        '#わたちゃん',
      ];
  if (includeUrl) lines.push(shareUrl);
  return lines.join('\n');
}

async function shareResultToLine() {
  if (!state.result) return;
  if (!await applySelectedBoardPreference()) return;
  openLineShare(resultShareText());
}

async function shareResultToX() {
  if (!state.result) return;
  if (!await applySelectedBoardPreference()) return;
  openXShare(resultShareText());
}

async function shareResultToInstagram() {
  if (!state.result || !state.resultImageUrl) return;
  if (!await applySelectedBoardPreference()) return;
  const copied = await copyText(resultShareText({ includeUrl: false }));
  if (!copied) return setState({ error: 'copy-failed' });
  const saveResult = await saveChallengeResultImage('share-result-instagram');
  if (!saveResult) return;
  window.alert(isEnglish
    ? 'The text was copied and the result image is ready. Choose Instagram Stories from the share sheet, or select the saved image in Instagram.'
    : '文章をコピーし、結果画像を用意しました。共有メニューからInstagramストーリーズを選ぶか、Instagramで保存した画像を選んでください。');
}

async function saveResultImageOnly() {
  if (!state.result || !state.resultImageUrl) return;
  if (!await applySelectedBoardPreference()) return;
  await saveChallengeResultImage();
}

function saveCurrentProgress(patch) {
  if (state.mode === 'creator-answer' || state.mode === 'creator-edit') {
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
    questionSubmissionConsent: value.questionSubmissionConsent !== false,
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

function readBoardOptIn(code) {
  if (!code) return true;
  try {
    return localStorage.getItem(`${BOARD_OPT_IN_KEY_PREFIX}${code}`) !== '0';
  } catch (error) {
    return true;
  }
}

function saveBoardOptIn(code, enabled) {
  if (!code) return;
  try {
    localStorage.setItem(`${BOARD_OPT_IN_KEY_PREFIX}${code}`, enabled ? '1' : '0');
  } catch (error) {
    // 保存できない場合も現在の画面では選択状態を維持する。
  }
}

function resetBoardOptIn(code) {
  if (!code) return;
  try {
    localStorage.removeItem(`${BOARD_OPT_IN_KEY_PREFIX}${code}`);
  } catch (error) {
    // 次の結果画面ではメモリ上の既定値を使用する。
  }
}

function challengeUrl(code) {
  return `${location.origin}${languagePrefix}/challenge?room=${code}&share=${CHALLENGE_SHARE_VERSION}`;
}

function manageUrl(code, token) {
  return `${languagePrefix}/challenge/manage?room=${code}#manage=${token}`;
}

function shareText(room, url) {
  return buildChallengeInviteText({
    creatorName: room.creatorName,
    url,
    isEnglish,
  });
}

function errorMessage(code) {
  return ({
    'name-required': '名前を入力してください。',
    'room-full': 'このクイズは上限の50人に達しました。',
    'room-not-found': 'クイズが見つからないか、有効期限が切れています。',
    'questions-unavailable': '問題データを読み込めませんでした。',
    'questions-incomplete': '10問すべての問題文と5つの選択肢を入力してください。',
    'participant-forbidden': '参加情報を確認できません。もう一度URLを開いてください。',
    'answers-already-submitted': 'この参加者の回答はすでに確定しています。',
    'answers-not-submitted': '10問の回答が完了していません。',
    'ranking-registration-failed': '結果を理解度ボードへ載せられませんでした。',
    'ranking-unregistration-failed': '結果を理解度ボードから外せませんでした。',
    'retry-failed': '再挑戦を開始できませんでした。',
    'manage-forbidden': '主催者用URLを確認できません。',
    'draft-not-found': '途中保存データが見つかりません。',
    'copy-failed': '自動コピーできませんでした。URL欄を長押ししてコピーしてください。',
    'library-failed': '人気のお題を読み込めませんでした。',
    'question-report-reason-required': '通報理由を選んでください。',
    'question-report-not-available': 'このお題は通報対象ではないか、すでに非公開です。',
    'question-report-failed': '通報を送信できませんでした。時間をおいてもう一度お試しください。',
  })[code] || '通信に失敗しました。時間をおいてもう一度お試しください。';
}

async function bootChallenge() {
  allCards = await loadManagedQuestionCards(allCards, 'challenge', isEnglish ? 'en' : 'ja');
  questionCatalogReady = true;
  if (quickStart && state.mode === 'creator-edit') {
    state.cards = pickChallengeCards(allCards, QUESTION_COUNT).map(toCreatorDraftCard);
  }
  if (state.mode === 'library') {
  document.title = isEnglish ? '10-question packs | How well do you know me?' : '人気の10問パック｜わたし理解度診断｜私のこと、ちゃんと分かってるよね？';
  render();
  } else if (state.mode === 'ranking') {
  document.title = isEnglish ? 'Understanding Board | How well do you know me?' : '理解度ボード｜わたし理解度診断｜私のこと、ちゃんと分かってるよね？';
  loadRanking();
  } else if (state.mode === 'manage') {
  document.title = isEnglish ? 'Manage responses | How well do you know me?' : '主催者用回答管理｜わたし理解度診断｜私のこと、ちゃんと分かってるよね？';
  loadManageRoom();
  } else if (state.mode === 'join') {
  loadRoom();
  } else {
  render();
  }
}

localizeDom(document);
bootChallenge();
