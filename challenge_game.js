import QRCode from 'qrcode';
import { mergeChallengeCards, pickChallengeCards, prepareLoveChallengeCards } from './src/challenge/data.js';
import {
  changedQuestionCandidates,
  loadManagedQuestionCards,
  reportManagedQuestion,
  submitQuestionCandidates,
} from './src/questions/catalog.js';
import { QUESTION_PUBLICATION_NOTICE, QUESTION_REVIEW_CRITERIA } from './src/questions/safety.js';
import { copyText, openLineShare, openXShare } from './src/platform/share.js';
import { renderNotebookQuestionCard } from './src/challenge/question-card.js';

const COLORS = ['#77bb62', '#3f78bd', '#f5c83b', '#d3313b', '#ef8730'];
const COLOR_NAMES = ['緑', '青', '黄', '赤', '橙'];
const QUESTION_COUNT = 10;
const CREATOR_DRAFT_KEY = 'watachan-challenge-creator-draft:v1';
const MANAGE_HISTORY_KEY = 'watachan-challenge-manage-history:v1';
const app = document.getElementById('challenge-app');
let allCards = mergeChallengeCards(
  window.FRIEND_CARDS,
  window.FAMILY_CARDS,
  prepareLoveChallengeCards(window.ALL_CARDS),
);
const currentUrl = new URL(location.href);
const pagePath = currentUrl.pathname.replace(/\/+$/, '') || '/challenge';
const roomCode = currentUrl.searchParams.get('room')?.trim().toUpperCase() || '';
const preferredCardId = currentUrl.searchParams.get('question')?.trim() || '';
const quickStart = readCreatorQuickStart('challenge');
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
  error: '',
  loading: false,
  questionSubmissionConsent: true,
  questionSubmissionStatus: '',
  questionSubmissionCount: 0,
  questionSubmissionCandidates: [],
  editingQuestion: false,
  editingOriginalCard: null,
};

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
  bindEvents();
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
          <small>タップで決定</small>
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
        <li>回答詳細を確認。希望者だけランキング公開</li>
      </ol>
      ${preferredCard ? `<div class="challenge-selected-question">
        <b>選んだお題を必ず入れます</b>
        <span>${escapeHtml(preferredCard.title)}</span>
      </div>` : ''}
      <label class="challenge-label" for="creator-name">出題者の名前（12文字まで）</label>
      <input id="creator-name" class="challenge-input" maxlength="12" autocomplete="nickname"
        placeholder="例：ちあき" value="${escapeHtml(state.creatorName)}">
      <button class="challenge-primary" data-action="start-create">10問に答えてクイズを作る <span>▶</span></button>
      <p class="challenge-note">友達・家族・共通のお題から出題します。回答途中はこの端末へ自動保存されます。</p>
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
      <article class="challenge-card" data-testid="challenge-paper-card">
        <div class="challenge-q-number">Q${state.questionIndex + 1}/10</div>
        <div class="challenge-card-title"><h2>${escapeHtml(card.title)}</h2></div>
        <div class="challenge-card-choices">
          ${card.choices.map((choice, index) => `
            <div class="challenge-card-choice">
              <i style="background:${COLORS[index]}" aria-hidden="true"></i>
              <span>${escapeHtml(choice)}</span>
            </div>
          `).join('')}
        </div>
      </article>
      <div class="challenge-answer-pad" data-testid="challenge-answer-pad">
        <div class="challenge-answer-pad-heading">
          <span>${isCreator ? '本人の番' : '予想する番'}</span>
          <small>タップで決定</small>
        </div>
        <div class="challenge-color-choices">
          ${card.choices.map((choice, index) => `
            <button
              type="button"
              data-action="answer"
              data-choice="${index}"
              class="challenge-color-choice ${selected === index ? 'is-selected' : ''}"
              aria-label="${escapeHtml(choice)}を選ぶ"
            >
              <i style="background:${COLORS[index]}" aria-hidden="true"></i>
              <span>${COLOR_NAMES[index]}</span>
            </button>
          `).join('')}
        </div>
        <p>ドットの色は、お題カード左側の5色と対応しています</p>
      </div>
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
    `<section class="challenge-panel challenge-share-screen" data-testid="challenge-share-screen">
      <div class="challenge-created-heading">
        <span aria-hidden="true">🏆</span>
        <h2>${escapeHtml(room.creatorName)}さんの理解度診断ができました！</h2>
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
        <a class="challenge-secondary" href="/challenge/ranking?room=${room.code}">フレンドランキングを見る</a>
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
      <span>${escapeHtml(participant.name)}<small>${participant.rankingParticipating ? 'ランキング参加' : 'ランキング不参加'}</small></span>
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
      <label class="challenge-label" for="participant-name">表示名（12文字まで）</label>
      <input id="participant-name" class="challenge-input" maxlength="12" autocomplete="nickname"
        placeholder="例：ゆう（本名は避けてください）" value="${escapeHtml(state.participantName)}">
      <label class="challenge-consent">
        <input id="ranking-consent" type="checkbox">
        <span><b>フレンドランキングに参加する（任意）</b><br>
        <small>チェックした場合だけ、表示名・得点・順位を公開します。チェックしなくても遊べます。</small></span>
      </label>
      <button class="challenge-primary" data-action="join">10問の答え当てに挑戦する <span>▶</span></button>
      <a class="challenge-secondary" href="/challenge/ranking?room=${room.code}">フレンドランキングを見る</a>
      <p class="challenge-note">回答内容は答え合わせと主催者の回答確認に使用されます。本名・学校名など個人が特定できる名前は入力しないでください。回答途中はこの端末へ自動保存されます。</p>
    </section>`,
  );
}

function resultView() {
  const result = state.result;
  if (!result) return errorView();
  const rankingSummary = result.rank == null
    ? `${result.participant.name}さんはランキングに参加していません。`
    : `${result.participant.name}さんは、ランキング参加者の中で ${result.rank}位です。`;
  return shell(
    'RESULT',
    `${result.score}/10問 正解`,
    rankingSummary,
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
      </ol>` : '<p class="challenge-empty">ランキングに参加した回答者はまだいません。</p>'}
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
  document.querySelector('[data-action="refresh-manage"]')?.addEventListener('click', loadManageRoom);
  document.querySelector('[data-action="retry-question-submit"]')?.addEventListener('click', submitCreatorQuestionCandidates);
  document.querySelector('[data-action="report-question"]')?.addEventListener('click', (event) => reportQuestion(event.currentTarget));
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
  const cards = (preferredCard
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

function skipCreatorQuestion() {
  captureCreatorConsent();
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

  if (state.questionIndex < QUESTION_COUNT - 1) {
    const questionIndex = state.questionIndex + 1;
    saveCurrentProgress({ answers, questionIndex });
    return setState({ answers, questionIndex });
  }
  if (answers.length !== QUESTION_COUNT || answers.some((answer) => !Number.isInteger(answer))) return;

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
    history.replaceState(null, '', `/challenge/manage?room=${data.code}#manage=${data.manageToken}`);
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
      sourceMode: 'challenge',
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
    skipCreatorQuestion();
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

async function joinRoom() {
  const name = document.getElementById('participant-name')?.value.trim().slice(0, 12) || '';
  if (!name) return setState({ error: 'name-required' });
  const rankingConsent = document.getElementById('ranking-consent')?.checked === true;
  setState({ loading: true, participantName: name, error: '' });
  try {
    const headers = { 'content-type': 'application/json' };
    if (state.participantToken) headers['x-challenge-participant-token'] = state.participantToken;
    const response = await fetch(`/api/challenge/rooms/${state.roomCode}/join`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, rankingConsent }),
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
  const rankingText = state.result.rank == null
    ? 'ランキング不参加'
    : `ランキング参加者の中で${state.result.rank}位`;
  const shareUrl = state.result.rank == null
    ? `${location.origin}/challenge?room=${state.result.code}`
    : `${location.origin}/challenge/ranking?room=${state.result.code}`;
  const text = `${state.result.creatorName}さんの答え当てに挑戦して${state.result.score}/10問正解、${rankingText}！\n#わたちゃん\n${shareUrl}`;
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

function challengeUrl(code) {
  return `${location.origin}/challenge?room=${code}`;
}

function manageUrl(code, token) {
  return `/challenge/manage?room=${code}#manage=${token}`;
}

function shareText(room, url) {
  return `${room.creatorName}さんの「理解度診断」に挑戦！\n10問の答えを予想してね👇\n${url}`;
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
  allCards = await loadManagedQuestionCards(allCards, 'challenge');
  if (quickStart && state.mode === 'creator-edit') {
    state.cards = pickChallengeCards(allCards, QUESTION_COUNT).map(toCreatorDraftCard);
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
}

bootChallenge();
