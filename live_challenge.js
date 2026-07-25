import QRCode from 'qrcode';
import { mergeChallengeCards, pickChallengeCards, prepareLoveChallengeCards } from './src/challenge/data.js';
import { LIVE_AGE_NOTICE } from './src/live/age-notice.js';
import {
  LIVE_POLL_INTERVAL_MS,
  LIVE_RESULT_IMAGE_PRICES,
  LIVE_RESULT_IMAGE_SERVICE,
  LIVE_SUPPORT_AMOUNTS,
} from './src/live/config.js';
import { CHECKOUT_TERMS } from './src/live/checkout-terms-config.js';
import {
  changedQuestionCandidates,
  loadManagedQuestionCards,
  reportManagedQuestion,
  submitQuestionCandidates,
} from './src/questions/catalog.js';
import { QUESTION_PUBLICATION_NOTICE, QUESTION_REVIEW_CRITERIA } from './src/questions/safety.js';
import { renderNotebookQuestionCard } from './src/challenge/question-card.js';

const QUESTION_COUNT = 10;
const app = document.getElementById('live-challenge-app');
let allCards = mergeChallengeCards(
  window.FRIEND_CARDS,
  window.FAMILY_CARDS,
  prepareLoveChallengeCards(window.ALL_CARDS),
);
const url = new URL(location.href);
const initialCode = (url.searchParams.get('room') || '').replace(/\D/g, '').slice(0, 6);
const initialCheckoutResult = String(url.searchParams.get('checkout') || '');
const initialCheckoutSessionId = String(url.searchParams.get('session_id') || '');
const initialHostToken = new URLSearchParams(location.hash.slice(1)).get('host') || '';
const savedParticipant = initialCode ? readSession(`live-challenge:${initialCode}`) : null;
const quickStart = readCreatorQuickStart('live');

function readCreatorQuickStart(expectedMode) {
  try {
    const raw = sessionStorage.getItem('watachan:creator-quick-start:v1');
    if (!raw) return null;
    sessionStorage.removeItem('watachan:creator-quick-start:v1');
    const value = JSON.parse(raw);
    const name = String(value?.name || '').trim().slice(0, 24);
    const age = Date.now() - Number(value?.createdAt || 0);
    if (value?.mode !== expectedMode || !name || age < 0 || age > 10 * 60 * 1000) return null;
    return { name };
  } catch (error) {
    return null;
  }
}

let state = {
  view: initialHostToken ? 'host' : initialCode
    ? (savedParticipant?.token ? 'viewer' : 'join')
    : quickStart ? 'create' : 'landing',
  code: initialCode,
  hostToken: initialHostToken,
  subjectToken: '',
  participantToken: savedParticipant?.token || '',
  participantName: savedParticipant?.name || '',
  hostName: quickStart?.name || '',
  questions: pickChallengeCards(allCards, QUESTION_COUNT).map(toDraftQuestion),
  game: null,
  hostAnswers: {},
  participantAnswers: readSession(`live-challenge:answers:${initialCode}`) || {},
  error: '',
  loading: Boolean(quickStart),
  pollTimer: null,
  socket: null,
  socketConnected: false,
  reconnectTimer: null,
  questionSubmissionConsent: true,
  questionSubmissionStatus: '',
  questionSubmissionCount: 0,
  questionSubmissionCandidates: [],
  builderIndex: 0,
  editingQuestion: false,
  editingOriginalQuestion: null,
  showLiveVoteCounts: false,
  paidSalesEnabled: false,
  paidCreatorProfiles: [],
  paidCreatorProfilesLoaded: false,
  paidCreatorProfilesLoading: false,
  paidCreatorVerificationId: '',
  resultImagePrice: LIVE_RESULT_IMAGE_PRICES[0],
  checkoutBusy: false,
  checkoutTermsAccepted: false,
  checkoutResult: initialCheckoutResult,
  checkoutSessionId: initialCheckoutSessionId,
  checkoutStatus: null,
  checkoutStatusBusy: false,
  checkoutStatusAttempts: 0,
  checkoutEntitlementUrl: '',
  supportPanelOpen: false,
};

render();
if (state.view === 'create') loadPaidCreatorProfiles();
loadManagedQuestionCards(allCards, 'live').then((cards) => {
  allCards = cards;
  if (state.view === 'landing' || (quickStart && state.view === 'create')) {
    state.questions = pickChallengeCards(allCards, QUESTION_COUNT).map(toDraftQuestion);
    state.questionSubmissionConsent = true;
    state.loading = false;
    render();
  }
});
if (state.view === 'host' || state.view === 'viewer') {
  loadRoom().then(startLiveUpdates).catch(showError);
}

function render() {
  if (!app) return;
  document.documentElement.dataset.liveChallengeView = state.view;
  document.documentElement.dataset.liveChallengePhase = state.game?.phase || '';
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
      <p class="notice">審査済みの配信者は、結果画像の販売と応援受付を任意で追加できます。無料LIVEは登録なしで作れます。</p>
      <p class="live-age-notice" data-testid="live-age-notice">⚠️ ${LIVE_AGE_NOTICE}</p>
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
  const question = state.questions[state.builderIndex];
  if (!question) return loadingView();
  if (state.editingQuestion) return liveQuestionEditView(question);
  return `<section class="panel">
    <span class="section-pill">配信者用</span>
    <h2 style="margin-top:10px">1問ずつクイズを作る</h2>
    <p>問題を確認して「この問題を使う」を押すと、その1問が完成します。答えは配信中に視聴者と同時に選びます。</p>
    <div class="field">
      <label for="host-name">配信者名（24文字まで）</label>
      <input id="host-name" maxlength="24" autocomplete="nickname" placeholder="例：わたちゃん" value="${escapeHtml(state.hostName)}">
    </div>
    <label class="check">
      <input id="show-counts" type="checkbox" ${state.showLiveVoteCounts ? 'checked' : ''}>
      <span>配信中、視聴者にも選択肢ごとの回答人数を表示する<br><small>配信開始後もON・OFFを切り替えられます。</small></span>
    </label>
    ${paidSalesSettingsView()}
    ${progressView(state.builderIndex)}
    <article class="live-builder-card" data-testid="live-question-builder">
      <div class="live-builder-paper notebook-question-card" data-testid="live-builder-paper-card">
        <span class="q-badge notebook-card-counter">Q${state.builderIndex + 1}/10</span>
        <h3 class="notebook-card-accessible-title">${escapeHtml(question.text)}</h3>
        ${renderNotebookQuestionCard(question)}
      </div>
      <button class="primary live-use-question" data-action="use-live-question">
        <span>この問題を使う<small>（答えは配信中に選択）</small></span>
        <b aria-hidden="true">▶</b>
      </button>
      <div class="button-row">
        <button class="secondary" data-action="skip-live-question">この問題をスキップ</button>
        <button class="ghost" data-action="edit-live-question">✎ 編集する</button>
      </div>
      <button class="ghost" data-action="custom-live-question">＋ 自分で問題を作る</button>
      ${questionReportControls(question)}
    </article>
    <label class="check">
      <input id="question-submit-consent" type="checkbox" ${state.questionSubmissionConsent ? 'checked' : ''}
        aria-label="このクイズを友達や他の人も使えるようにする">
      <span><b>このクイズを友達や他の人も使えるようにする</b><br><small>初期状態はONです。ONのままなら、自作・編集した問題を掲載候補として運営へ送ります。外してもLIVEは作れます。<br>${QUESTION_PUBLICATION_NOTICE}<br>${QUESTION_REVIEW_CRITERIA}</small></span>
    </label>
    <div class="live-builder-footer">
      <button class="ghost" data-action="previous-live-question" ${state.builderIndex === 0 ? 'disabled aria-disabled="true"' : ''}>前の問題に戻る</button>
      <button class="ghost" data-action="back-landing">最初に戻る</button>
    </div>
  </section>`;
}

function paidSalesSettingsView() {
  const profiles = state.paidCreatorProfiles;
  const selected = profiles.find((profile) => profile.verificationId === state.paidCreatorVerificationId)
    || profiles[0];
  const loading = state.paidCreatorProfilesLoading
    ? '<div class="notice" role="status">この端末の販売登録を確認しています。</div>'
    : '';
  const unavailable = state.paidCreatorProfilesLoaded && !profiles.length
    ? `<div class="notice">この端末に販売可能な配信者登録がありません。無料LIVEはそのまま作れます。販売にはYouTubeチャンネルの所有確認、収益分配契約、Stripe審査が必要です。</div>
      <a class="ghost" href="/live" target="_blank" rel="noopener noreferrer">販売登録・本人確認を確認する</a>`
    : '';
  const settings = profiles.length ? `<div class="sales-fields" ${state.paidSalesEnabled ? '' : 'hidden'}>
      <div class="field">
        <label for="paid-creator-profile">売上を受け取る配信者</label>
        <select id="paid-creator-profile">
          ${profiles.map((profile) => `<option value="${escapeHtml(profile.verificationId)}" ${profile.verificationId === selected?.verificationId ? 'selected' : ''}>${escapeHtml(profile.channelName)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="result-image-price">${LIVE_RESULT_IMAGE_SERVICE.name}</label>
        <select id="result-image-price">
          ${LIVE_RESULT_IMAGE_PRICES.map((price) => `<option value="${price}" ${state.resultImagePrice === price ? 'selected' : ''}>${number(price)}円（税込）</option>`).join('')}
        </select>
      </div>
      <p class="help">視聴者は10問終了後に高画質結果画像を購入できます。応援は${LIVE_SUPPORT_AMOUNTS.map((amount) => `${number(amount)}円`).join('・')}（すべて税込）から選べます。売上の70%を配信者分配残高へ記録します。</p>
    </div>` : '';
  return `<section class="sales-settings" data-testid="live-sales-settings">
    <div class="sales-heading"><span>販売機能</span><small>任意</small></div>
    <label class="check">
      <input id="enable-paid-sales" type="checkbox" ${state.paidSalesEnabled ? 'checked' : ''} ${profiles.length ? '' : 'disabled'}>
      <span><b>結果画像の販売・応援を受け付ける</b><br><small>無料結果カードは全員に表示されます。販売を使う場合だけ、審査済みの配信者登録を選びます。</small></span>
    </label>
    ${loading}${unavailable}${settings}
  </section>`;
}

function liveQuestionEditView(question) {
  const index = state.builderIndex;
  return `<section class="panel" data-testid="live-question-edit-form">
    <span class="section-pill">Q${index + 1}を編集</span>
    <h2 style="margin-top:10px">問題・選択肢を編集する</h2>
    <div class="field">
      <label for="live-builder-question">問題文</label>
      <textarea id="live-builder-question" data-question="${index}" maxlength="180"
        aria-label="Q${index + 1}の問題文">${escapeHtml(question.text)}</textarea>
    </div>
    ${question.options.map((option, optionIndex) => `<label class="option-edit">
      <b>${optionIndex + 1}</b>
      <input data-option="${index}:${optionIndex}" maxlength="60" value="${escapeHtml(option)}"
        aria-label="Q${index + 1} 選択肢${optionIndex + 1}">
    </label>`).join('')}
    <label class="check">
      <input id="question-submit-consent" type="checkbox" ${state.questionSubmissionConsent ? 'checked' : ''}
        aria-label="このクイズを友達や他の人も使えるようにする">
      <span><b>このクイズを友達や他の人も使えるようにする</b><br><small>ONのままなら、この自作・編集した問題を掲載候補として運営へ送ります。<br>${QUESTION_PUBLICATION_NOTICE}<br>${QUESTION_REVIEW_CRITERIA}</small></span>
    </label>
    <button class="primary" data-action="save-live-question-edit">この内容で問題に戻る <span>▶</span></button>
    <button class="ghost" data-action="cancel-live-question-edit">キャンセル</button>
  </section>`;
}

function questionReportControls(question) {
  if (!question?.reportable || !question.managedQuestionId) return '';
  return `<div class="question-report" data-report-box>
    <label for="live-report-reason">不適切なお題を通報</label>
    <select id="live-report-reason" data-report-reason>
      <option value="personal-information">個人情報</option>
      <option value="sexual-content">性的内容</option>
      <option value="bullying">いじめ</option>
      <option value="appearance-attack">容姿攻撃</option>
      <option value="discrimination">差別表現</option>
      <option value="other">その他</option>
    </select>
    <button class="ghost" data-action="report-question" data-question-id="${escapeHtml(question.managedQuestionId)}">このお題を通報する</button>
    <small>通報すると、このお題は確認が終わるまで公開ライブラリから非公開になります。</small>
  </div>`;
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
  if (state.game.phase === 'reveal') return hostRevealView();
  return `<section class="panel"><h2>ゲームを更新しています</h2><p>少し待ってください。</p></section>`;
}

function hostLobbyView() {
  return `<section class="panel">
    <span class="section-pill">配信者画面</span>
    <h2 style="margin-top:10px">視聴者を招待する</h2>
    ${questionSubmissionNotice()}
    ${state.game.resultImagePrice ? `<div class="notice"><strong>販売機能：ON</strong><br>結果画像 ${number(state.game.resultImagePrice)}円（税込）・応援 ${LIVE_SUPPORT_AMOUNTS.map((amount) => `${number(amount)}円`).join('／')}（税込）を、10問終了後に表示します。</div>` : ''}
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

function questionSubmissionNotice() {
  if (!state.questionSubmissionStatus) return '';
  const messages = {
    sending: '掲載候補のお題を運営へ送信しています。',
    sent: `掲載候補として${state.questionSubmissionCount}問を運営へ送信しました。承認されるまで公開ライブラリには追加されません。`,
    empty: '掲載候補の送信に同意しましたが、自作・編集したお題がないため送信対象はありませんでした。',
    failed: 'LIVEは作成できましたが、掲載候補のお題は通信エラーで送信できませんでした。',
    blocked: 'LIVEは作成できましたが、掲載候補に個人情報らしい内容を検知したため運営へ送信しませんでした。',
  };
  const retry = state.questionSubmissionStatus === 'failed'
    ? '<button class="secondary" data-action="retry-question-submit">お題候補の送信を再試行</button>'
    : '';
  return `<div class="notice" role="status" data-testid="question-submission-status">
    ${escapeHtml(messages[state.questionSubmissionStatus] || '')}${retry}
  </div>`;
}

function hostQuestionView() {
  const game = state.game;
  const question = game.question;
  const answer = state.hostAnswers[question.id];
  const answered = question.subjectAnswered;
  return `<article class="question-card live-active-question" data-testid="live-host-question">
    ${progressView(game.currentQuestionIndex)}
    <span class="q-label">配信者の秘密回答 ・ Q${game.currentQuestionIndex + 1}/10</span>
    <h2>${escapeHtml(question.text)}</h2>
    <p class="help">${answered ? '回答を確定しました。視聴者の回答を待ち、そろったら締め切ってください。' : '視聴者と同じタイミングで、あなたの答えを1つ選んでください。'}</p>
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
      視聴者の回答を締め切る <span>▶</span>
    </button>
  </article>`;
}

function hostRevealView() {
  const game = state.game;
  const question = game.question;
  const result = question.result || {};
  const hostAnswer = Number.isInteger(result.subjectAnswerIndex) ? result.subjectAnswerIndex : null;
  return `<article class="question-card live-active-question live-reveal-question" data-testid="live-host-reveal">
    ${progressView(game.currentQuestionIndex)}
    <span class="q-label">回答公開中 ・ Q${game.currentQuestionIndex + 1}/10</span>
    <h2>${escapeHtml(question.text)}</h2>
    <p class="help">視聴者の回答を締め切り、配信者の回答を公開しました。</p>
    <div class="choices">
      ${question.options.map((option, index) => revealChoice(option, index, {
        hostAnswer: hostAnswer === index,
        count: question.voteCounts?.[index],
      })).join('')}
    </div>
    <p class="notice reveal-notice">この答え合わせを配信で確認してから、次の問題へ進んでください。</p>
    <button class="primary" data-action="next">
      ${game.currentQuestionIndex === 9 ? '10問の結果を見る' : `Q${game.currentQuestionIndex + 2}へ進む`} <span>▶</span>
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
  if (state.game.phase === 'reveal') return viewerRevealView();
  return `<section class="panel waiting"><div class="pulse"></div><h2>次の問題を待っています</h2></section>`;
}

function viewerQuestionView() {
  const game = state.game;
  const question = game.question;
  const answer = Object.prototype.hasOwnProperty.call(state.participantAnswers, question.id)
    ? Number(state.participantAnswers[question.id])
    : Number.isInteger(game.myVoteIndex) ? game.myVoteIndex : null;
  return `<article class="question-card live-active-question" data-testid="live-viewer-question">
    ${progressView(game.currentQuestionIndex)}
    <span class="q-label">${escapeHtml(game.subjectName)}さんと同じ答えなら1点 ・ Q${game.currentQuestionIndex + 1}/10</span>
    <h2>${escapeHtml(question.text)}</h2>
    <p class="help">${answer === null ? '配信者の答えを予想するのではなく、あなた自身の答えを選んでください。' : '回答を送信しました。配信者が回答を締め切るまで待ってください。'}</p>
    <div class="choices">
      ${question.options.map((option, index) => choiceButton(option, index, {
        selected: answer === index,
        disabled: answer !== null,
        count: question.voteCounts?.[index],
        action: 'viewer-answer',
      })).join('')}
    </div>
    ${answer !== null ? '<p class="notice">回答済みです。締め切られると、この画面に配信者の回答が表示されます。</p>' : ''}
  </article>`;
}

function viewerRevealView() {
  const game = state.game;
  const question = game.question;
  const result = question.result || {};
  const hostAnswer = Number.isInteger(result.subjectAnswerIndex) ? result.subjectAnswerIndex : null;
  const viewerAnswer = Number.isInteger(result.myVoteIndex) ? result.myVoteIndex : null;
  const isCorrect = result.myIsCorrect === true;
  return `<article class="question-card live-active-question live-reveal-question" data-testid="live-viewer-reveal">
    ${progressView(game.currentQuestionIndex)}
    <span class="q-label">答え合わせ ・ Q${game.currentQuestionIndex + 1}/10</span>
    <h2>${escapeHtml(question.text)}</h2>
    <div class="reveal-judgement ${isCorrect ? 'ok' : 'ng'}" role="status">
      <strong>${isCorrect ? '○ 一致！ 1点' : '× 不一致'}</strong>
      <span>配信者の回答を公開しました</span>
    </div>
    <div class="choices">
      ${question.options.map((option, index) => revealChoice(option, index, {
        hostAnswer: hostAnswer === index,
        viewerAnswer: viewerAnswer === index,
        count: question.voteCounts?.[index],
      })).join('')}
    </div>
    <p class="notice reveal-notice">配信者が次の問題へ進むまで待ってください。</p>
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
      ${liveCheckoutView()}
      <a class="ghost" href="/live-challenge" style="text-decoration:none">トップへ戻る</a>
    </div>
  </section>`;
}

function liveCheckoutView() {
  const game = state.game || {};
  const supportEnabled = game.supportPaymentsEnabled === true;
  const resultEnabled = game.resultImageSalesEnabled === true;
  const status = state.checkoutStatus;
  let returnMessage = '';
  if (state.checkoutResult === 'cancelled') {
    returnMessage = '<div class="notice">決済はキャンセルされました。請求は確定していません。</div>';
  } else if (state.checkoutResult === 'success' && !status) {
    returnMessage = '<div class="notice">決済結果を確認しています。この画面を閉じずにお待ちください。</div>';
  }
  if (status?.status === 'paid') {
    returnMessage = status.productType === 'result_image'
      ? `<div class="notice"><strong>高画質結果画像を生成しました。</strong><br>決済日から${LIVE_RESULT_IMAGE_SERVICE.downloadDays}日間ダウンロードできます。</div><button class="secondary" data-action="download-paid-result">高画質結果画像をダウンロード</button>`
      : '<div class="notice"><strong>応援ありがとうございます。</strong><br>決済が完了しました。</div>';
  } else if (status && ['payment_failed', 'checkout_failed'].includes(status.status)) {
    returnMessage = '<div class="error">決済を完了できませんでした。カード情報を確認して、もう一度お試しください。</div>';
  } else if (status && ['refunded', 'refund_pending', 'refund_processing', 'fraud_review'].includes(status.status)) {
    returnMessage = '<div class="notice">この決済は返金・確認処理中または返金済みです。</div>';
  }
  if (!supportEnabled && !resultEnabled && !returnMessage) return '';
  if (!supportEnabled && !resultEnabled) return `<div class="live-checkout-panel">${returnMessage}</div>`;
  const price = Number(game.resultImagePrice) || 0;
  return `<section class="live-checkout-panel" data-testid="live-checkout-panel">
    <h3>配信者の販売・応援メニュー</h3>
    ${returnMessage}
    <label class="checkout-consent">
      <input id="checkout-terms-consent" type="checkbox" ${state.checkoutTermsAccepted ? 'checked' : ''}>
      <span><a href="/terms" target="_blank" rel="noopener noreferrer">利用規約</a>に同意し、<a href="/legal" target="_blank" rel="noopener noreferrer">特定商取引法に基づく表記</a>、<a href="/refund-policy" target="_blank" rel="noopener noreferrer">返金・キャンセルポリシー</a>、<a href="/privacy" target="_blank" rel="noopener noreferrer">プライバシーポリシー</a>を確認しました。未成年の場合は保護者の同意を得ています。</span>
    </label>
    ${resultEnabled ? `<div class="notice"><strong>${LIVE_RESULT_IMAGE_SERVICE.name}</strong><br>${LIVE_RESULT_IMAGE_SERVICE.resolution}の高画質画像を生成し、決済日から${LIVE_RESULT_IMAGE_SERVICE.downloadDays}日間ダウンロードできます。</div>
      <button class="primary" data-action="buy-result-image" ${state.checkoutBusy || !state.checkoutTermsAccepted || !price ? 'disabled' : ''}>${state.checkoutBusy ? 'Stripeへ接続中…' : `${number(price)}円（税込）で申し込む`}</button>` : ''}
    ${supportEnabled ? `<button class="secondary" data-action="toggle-support" aria-expanded="${state.supportPanelOpen}">♡ 配信者を応援する</button>
      ${state.supportPanelOpen ? `<div class="support-amounts" role="group" aria-label="応援金額を選ぶ">${(game.supportAmounts || LIVE_SUPPORT_AMOUNTS).map((amount) => `<button class="ghost" data-support-amount="${amount}" ${state.checkoutBusy || !state.checkoutTermsAccepted ? 'disabled' : ''}>${number(amount)}円（税込）</button>`).join('')}<p class="help">決済はStreetboardgame運営者が受け付け、売上の70%を配信者へ分配します。</p></div>` : ''}` : ''}
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

function revealChoice(option, index, config) {
  const badges = [
    config.hostAnswer ? '<b class="reveal-badge host">配信者の回答</b>' : '',
    config.viewerAnswer ? '<b class="reveal-badge viewer">あなたの回答</b>' : '',
  ].join('');
  const count = Number.isFinite(Number(config.count)) ? `<span class="count">${number(config.count)}人</span>` : '';
  const classes = [
    'choice',
    'reveal-choice',
    config.hostAnswer ? 'host-answer' : '',
    config.viewerAnswer ? 'viewer-answer' : '',
  ].filter(Boolean).join(' ');
  return `<div class="${classes}">
    <span class="number">${index + 1}</span>
    <span>${escapeHtml(option)}</span>
    <span class="reveal-choice-meta">${badges}${count}</span>
  </div>`;
}

function loadingView() {
  return '<section class="panel waiting"><div class="pulse"></div><h2>読み込み中</h2><p>少し待ってください。</p></section>';
}

function bindEvents() {
  document.querySelector('[data-action="open-create"]')?.addEventListener('click', () => {
    setState({ view: 'create' });
    loadPaidCreatorProfiles();
  });
  document.querySelectorAll('[data-action="back-landing"]').forEach((button) => button.addEventListener('click', () => {
    history.replaceState(null, '', '/live-challenge');
    setState({
      view: 'landing',
      code: '',
      builderIndex: 0,
      editingQuestion: false,
      editingOriginalQuestion: null,
      error: '',
    });
  }));
  document.querySelector('[data-action="go-code"]')?.addEventListener('click', goToCode);
  document.getElementById('entry-code')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') goToCode();
  });
  document.querySelector('[data-action="use-live-question"]')?.addEventListener('click', useLiveQuestion);
  document.querySelector('[data-action="skip-live-question"]')?.addEventListener('click', skipLiveQuestion);
  document.querySelector('[data-action="edit-live-question"]')?.addEventListener('click', () => {
    captureDraft();
    setState({
      editingQuestion: true,
      editingOriginalQuestion: structuredClone(state.questions[state.builderIndex]),
      error: '',
    });
  });
  document.querySelector('[data-action="custom-live-question"]')?.addEventListener('click', () => {
    captureDraft();
    const questions = state.questions.slice();
    const original = structuredClone(questions[state.builderIndex]);
    questions[state.builderIndex] = {
      id: `custom-${Date.now()}-${state.builderIndex}`,
      sourceId: '',
      text: '',
      options: ['', '', '', '', ''],
    };
    setState({ questions, editingQuestion: true, editingOriginalQuestion: original, error: '' });
  });
  document.querySelector('[data-action="save-live-question-edit"]')?.addEventListener('click', saveLiveQuestionEdit);
  document.querySelector('[data-action="cancel-live-question-edit"]')?.addEventListener('click', cancelLiveQuestionEdit);
  document.querySelector('[data-action="previous-live-question"]')?.addEventListener('click', previousLiveQuestion);
  document.querySelector('[data-action="join-game"]')?.addEventListener('click', joinGame);
  document.querySelector('[data-action="copy-link"]')?.addEventListener('click', copyJoinLink);
  document.querySelector('[data-action="retry-question-submit"]')?.addEventListener('click', submitCreatorQuestionCandidates);
  document.querySelector('[data-action="report-question"]')?.addEventListener('click', (event) => reportQuestion(event.currentTarget));
  document.querySelector('[data-action="start-game"]')?.addEventListener('click', () => hostAction('start'));
  document.querySelectorAll('[data-action="host-answer"]').forEach((button) => button.addEventListener('click', () => hostAnswer(Number(button.dataset.index))));
  document.querySelectorAll('[data-action="viewer-answer"]').forEach((button) => button.addEventListener('click', () => viewerAnswer(Number(button.dataset.index))));
  document.querySelector('[data-action="advance"]')?.addEventListener('click', () => hostAction('advance'));
  document.querySelector('[data-action="next"]')?.addEventListener('click', () => hostAction('next'));
  document.querySelectorAll('[data-action="toggle-counts"]').forEach((input) => input.addEventListener('change', () => toggleCounts(input.checked)));
  document.querySelector('[data-action="save-result"]')?.addEventListener('click', saveResultCard);
  document.getElementById('enable-paid-sales')?.addEventListener('change', (event) => {
    captureDraft();
    setState({ paidSalesEnabled: event.target.checked === true, error: '' });
  });
  document.getElementById('paid-creator-profile')?.addEventListener('change', (event) => {
    state.paidCreatorVerificationId = event.target.value;
  });
  document.getElementById('result-image-price')?.addEventListener('change', (event) => {
    state.resultImagePrice = Number(event.target.value);
  });
  document.getElementById('checkout-terms-consent')?.addEventListener('change', (event) => {
    state.checkoutTermsAccepted = event.target.checked === true;
    render();
  });
  document.querySelector('[data-action="buy-result-image"]')?.addEventListener('click', () => startLiveCheckout('result_image'));
  document.querySelector('[data-action="toggle-support"]')?.addEventListener('click', () => {
    setState({ supportPanelOpen: !state.supportPanelOpen });
  });
  document.querySelectorAll('[data-support-amount]').forEach((button) => button.addEventListener('click', () => {
    startLiveCheckout('support', Number(button.dataset.supportAmount));
  }));
  document.querySelector('[data-action="download-paid-result"]')?.addEventListener('click', downloadPaidResult);
  if (state.game?.phase === 'complete' && state.checkoutResult === 'success' && state.checkoutSessionId
    && !state.checkoutStatusBusy && state.checkoutStatusAttempts === 0) {
    refreshLiveCheckoutStatus();
  }
}

function goToCode() {
  const code = (document.getElementById('entry-code')?.value || '').replace(/\D/g, '').slice(0, 6);
  if (code.length !== 6) return showError('invalid-code');
  location.href = `/live-challenge?room=${code}`;
}

function captureDraft() {
  state.hostName = document.getElementById('host-name')?.value.trim() || state.hostName;
  const consent = document.getElementById('question-submit-consent');
  if (consent) state.questionSubmissionConsent = consent.checked === true;
  const showCounts = document.getElementById('show-counts');
  if (showCounts) state.showLiveVoteCounts = showCounts.checked === true;
  const paidSales = document.getElementById('enable-paid-sales');
  if (paidSales) state.paidSalesEnabled = paidSales.checked === true;
  const paidProfile = document.getElementById('paid-creator-profile');
  if (paidProfile) state.paidCreatorVerificationId = paidProfile.value;
  const resultPrice = document.getElementById('result-image-price');
  if (resultPrice) state.resultImagePrice = Number(resultPrice.value);
  state.questions = state.questions.map((question, index) => ({
    ...question,
    text: document.querySelector(`[data-question="${index}"]`)?.value.trim() ?? question.text,
    options: question.options.map((option, optionIndex) => (
      document.querySelector(`[data-option="${index}:${optionIndex}"]`)?.value.trim() ?? option
    )),
  }));
}

function useLiveQuestion() {
  captureDraft();
  const question = state.questions[state.builderIndex];
  if (!question?.text || question.options.length !== 5 || question.options.some((option) => !option)) {
    return showError('questions-incomplete');
  }
  if (state.builderIndex < QUESTION_COUNT - 1) {
    return setState({ builderIndex: state.builderIndex + 1, error: '' });
  }
  createGame();
}

function skipLiveQuestion() {
  captureDraft();
  const usedIds = new Set(state.questions.map((question, index) => (
    index === state.builderIndex ? '' : String(question.sourceId || '')
  )).filter(Boolean));
  const currentSourceId = String(state.questions[state.builderIndex]?.sourceId || '');
  const pool = allCards.filter((card) => !usedIds.has(String(card.id)) && String(card.id) !== currentSourceId);
  const replacement = pickChallengeCards(pool.length ? pool : allCards, 1)[0];
  if (!replacement) return showError('questions-incomplete');
  const questions = state.questions.slice();
  questions[state.builderIndex] = toDraftQuestion(replacement);
  setState({ questions, editingQuestion: false, editingOriginalQuestion: null, error: '' });
}

function saveLiveQuestionEdit() {
  captureDraft();
  const question = state.questions[state.builderIndex];
  if (!question?.text || question.options.length !== 5 || question.options.some((option) => !option)) {
    return showError('questions-incomplete');
  }
  setState({ editingQuestion: false, editingOriginalQuestion: null, error: '' });
}

function cancelLiveQuestionEdit() {
  captureDraft();
  const questions = state.questions.slice();
  if (state.editingOriginalQuestion) questions[state.builderIndex] = state.editingOriginalQuestion;
  setState({ questions, editingQuestion: false, editingOriginalQuestion: null, error: '' });
}

function previousLiveQuestion() {
  captureDraft();
  if (state.builderIndex <= 0) return;
  setState({ builderIndex: state.builderIndex - 1, editingQuestion: false, error: '' });
}

async function createGame() {
  captureDraft();
  const submissionCandidates = changedQuestionCandidates(state.questions, allCards);
  const submissionConsent = state.questionSubmissionConsent;
  const subjectName = state.hostName;
  const showLiveVoteCounts = state.showLiveVoteCounts;
  const paidProfile = state.paidCreatorProfiles.find(
    (profile) => profile.verificationId === state.paidCreatorVerificationId,
  );
  if (!subjectName) return showError('stream-name-required');
  if (state.paidSalesEnabled && !paidProfile) return showError('paid-channel-verification-required');
  if (state.questions.some((question) => !question.text || question.options.some((option) => !option))) {
    return showError('questions-incomplete');
  }
  setState({ loading: true, error: '' });
  try {
    const response = await api('/api/live/stream-games', {
      method: 'POST',
      headers: state.paidSalesEnabled
        ? { 'x-live-verification-token': paidProfile.accessToken }
        : {},
      body: JSON.stringify({
        subjectName,
        showLiveVoteCounts,
        paidSalesRequested: state.paidSalesEnabled,
        channelName: state.paidSalesEnabled ? paidProfile.channelName : '',
        channelId: state.paidSalesEnabled ? paidProfile.channelId : '',
        channelVerificationId: state.paidSalesEnabled ? paidProfile.verificationId : '',
        resultImagePrice: state.paidSalesEnabled ? state.resultImagePrice : 0,
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
    setState({
      view: 'host',
      loading: false,
      questionSubmissionStatus: submissionConsent
        ? (submissionCandidates.length ? 'sending' : 'empty')
        : '',
      questionSubmissionCount: 0,
      questionSubmissionCandidates: submissionConsent ? submissionCandidates : [],
    });
    if (submissionConsent && submissionCandidates.length) submitCreatorQuestionCandidates();
    startLiveUpdates();
  } catch (error) {
    setState({ loading: false, error: error.message });
  }
}

async function loadPaidCreatorProfiles() {
  if (state.paidCreatorProfilesLoading || state.paidCreatorProfilesLoaded) return;
  state.paidCreatorProfilesLoading = true;
  render();
  const saved = [];
  try {
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index) || '';
      if (!key.startsWith('live:verification-channel:')) continue;
      const value = JSON.parse(sessionStorage.getItem(key) || '{}');
      if (/^[a-f0-9]{32}$/i.test(value.verificationId)
        && /^[a-f0-9]{48}$/i.test(value.accessToken)) {
        saved.push(value);
      }
    }
  } catch (error) {
    // Storage may be unavailable. Free LIVE remains usable.
  }
  const loaded = await Promise.all(saved.map(async (entry) => {
    try {
      const verification = await api(`/api/live/channel-verifications/${entry.verificationId}`, {
        headers: { 'x-live-verification-token': entry.accessToken },
      });
      return verification.canSellPaid ? { ...verification, accessToken: entry.accessToken } : null;
    } catch (error) {
      return null;
    }
  }));
  const profiles = loaded.filter(Boolean);
  state.paidCreatorProfiles = profiles;
  state.paidCreatorProfilesLoaded = true;
  state.paidCreatorProfilesLoading = false;
  if (!profiles.some((profile) => profile.verificationId === state.paidCreatorVerificationId)) {
    state.paidCreatorVerificationId = profiles[0]?.verificationId || '';
  }
  render();
}

async function submitCreatorQuestionCandidates() {
  if (!state.questionSubmissionCandidates.length) return;
  setState({ questionSubmissionStatus: 'sending' });
  try {
    const result = await submitQuestionCandidates({
      consent: true,
      sourceMode: 'live-challenge',
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
    skipLiveQuestion();
  } catch (error) {
    button.disabled = false;
    showError(error);
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

async function startLiveCheckout(productType, amount = null) {
  if (state.checkoutBusy || !state.game || !state.checkoutTermsAccepted) return;
  state.checkoutBusy = true;
  state.error = '';
  render();
  try {
    const response = await api(`/api/live/games/${state.code}/checkout`, {
      method: 'POST',
      headers: {
        'x-live-participant-token': state.participantToken,
        'x-live-checkout-request': randomCheckoutRequestId(),
      },
      body: JSON.stringify({
        productType,
        amount,
        viewerName: state.participantName || state.game.participantName || '視聴者',
        termsAccepted: true,
        termsVersion: CHECKOUT_TERMS.version,
        termsDocumentSha256: CHECKOUT_TERMS.documentSha256,
      }),
    });
    if (!/^https:\/\/checkout\.stripe\.com\//.test(response.checkoutUrl || '')) {
      throw new Error('stripe-checkout-response-invalid');
    }
    location.assign(response.checkoutUrl);
  } catch (error) {
    state.checkoutBusy = false;
    showError(error);
  }
}

async function refreshLiveCheckoutStatus() {
  if (state.checkoutStatusBusy || !state.checkoutSessionId) return;
  state.checkoutStatusBusy = true;
  try {
    const response = await api(`/api/live/checkouts/${encodeURIComponent(state.checkoutSessionId)}`, {
      headers: { 'x-live-participant-token': state.participantToken },
    });
    state.checkoutStatus = response;
    state.checkoutEntitlementUrl = response.entitlementUrl || '';
    state.checkoutStatusAttempts += 1;
    state.checkoutStatusBusy = false;
    render();
    if (!['paid', 'refunded', 'payment_failed', 'refund_failed'].includes(response.status)
      && state.checkoutStatusAttempts < 10) {
      setTimeout(refreshLiveCheckoutStatus, 1500);
    }
  } catch (error) {
    state.checkoutStatusBusy = false;
    state.checkoutStatusAttempts += 1;
    if (error.status === 404 && state.checkoutStatusAttempts < 10) {
      setTimeout(refreshLiveCheckoutStatus, 1500);
      return;
    }
    showError(error);
  }
}

async function downloadPaidResult() {
  if (!state.checkoutEntitlementUrl) return;
  try {
    const entitlement = await api(state.checkoutEntitlementUrl);
    location.assign(entitlement.downloadUrl);
  } catch (error) {
    showError(error);
  }
}

function randomCheckoutRequestId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
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
  if (!response.ok) {
    const error = new Error(data.error || 'request-failed');
    error.status = response.status;
    throw error;
  }
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
    image: card.image || '',
    managedQuestionId: card.managedQuestionId || null,
    reportable: card.reportable === true,
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
    'question-report-reason-required': '通報理由を選んでください。',
    'question-report-not-available': 'このお題は通報対象ではないか、すでに非公開です。',
    'question-report-failed': '通報を送信できませんでした。時間をおいてもう一度お試しください。',
    'rate-limit-exceeded': '操作が集中しています。少し待ってから試してください。',
    'paid-channel-verification-required': '販売には、本人確認・収益分配契約・Stripe審査が完了した配信者登録が必要です。',
    'invalid-result-image-price': '結果画像の販売価格を選び直してください。',
    'result-image-not-for-sale': 'このLIVEでは結果画像を販売していません。',
    'invalid-support-amount': '応援金額を選び直してください。',
    'checkout-terms-acceptance-required': '利用規約と決済条件への同意が必要です。',
    'live-support-checkout-not-configured': '応援決済の本番設定が完了していません。',
    'live-result-checkout-not-configured': '結果画像決済の本番設定が完了していません。',
    'stripe-checkout-response-invalid': 'Stripe決済画面を開けませんでした。もう一度お試しください。',
    'checkout-not-found': '決済情報を確認できませんでした。少し待ってから更新してください。',
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
