import {
  LIVE_POLL_INTERVAL_MS,
  LIVE_QUESTION_TYPES,
  LIVE_RESERVATION_BUFFER_HOURS,
  LIVE_RESULT_IMAGE_PRICES,
  LIVE_SERIES,
  LIVE_TYPE_LABELS,
  LIVE_VIEWER_LIMIT,
} from './src/live/config.js';
import { createLiveQuestion, recommendYouTubeCandidates, validateLiveDraft } from './src/live/model.js';
import { sharePreparedImage } from './src/platform/imageSave.js';
import { openLineShare, openXShare } from './src/platform/share.js';

const root = document.getElementById('liveRoot');
const query = new URLSearchParams(location.search);
const initialRoomCode = String(query.get('room') || '').replace(/\D/g, '').slice(0, 6);
const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
const initialHostToken = hashParams.get('host') || '';
const initialSubjectToken = hashParams.get('subject') || '';
const initialVerificationId = String(query.get('verify') || '').toLowerCase();
const initialVerificationToken = hashParams.get('verification')
  || (initialVerificationId ? sessionStorage.getItem(`live:verification:${initialVerificationId}`) : '')
  || '';
const initialCreatorInvite = sessionStorage.getItem('live:creator-invite') || '';
const initialCheckoutResult = String(query.get('checkout') || '');
const initialCheckoutSessionId = String(query.get('session_id') || '');
if (initialRoomCode && /^[a-f0-9]{20,96}$/i.test(initialHostToken)) {
  sessionStorage.setItem(`live:host:${initialRoomCode}`, initialHostToken);
}
if (initialRoomCode && /^[a-f0-9]{20,96}$/i.test(initialSubjectToken)) {
  sessionStorage.setItem(`live:subject:${initialRoomCode}`, initialSubjectToken);
}
const state = {
  view: initialVerificationId ? 'channel-verification'
    : initialRoomCode && initialHostToken && !initialCreatorInvite ? 'staff-auth' : initialRoomCode ? 'room-loading' : 'entry',
  roomCode: initialRoomCode,
  game: null,
  error: '',
  draft: null,
  candidates: [],
  youtubeQuestionType: '',
  channelUrl: '',
  channelProfile: null,
  channelVerification: null,
  channelVerificationId: initialVerificationId,
  channelVerificationToken: initialVerificationToken,
  channelVerificationBusy: false,
  creatorAgreement: null,
  creatorAgreementBusy: false,
  creatorAgreementContractingName: '',
  creatorAgreementContactEmail: '',
  creatorInvite: initialCreatorInvite,
  hostToken: initialRoomCode && !initialSubjectToken ? sessionStorage.getItem(`live:host:${initialRoomCode}`) || initialHostToken : '',
  subjectToken: initialRoomCode && !initialHostToken ? sessionStorage.getItem(`live:subject:${initialRoomCode}`) || initialSubjectToken : '',
  participantToken: initialRoomCode ? sessionStorage.getItem(`live:participant:${initialRoomCode}`) || '' : '',
  hostAnswerIndex: null,
  subjectAnswerIndex: null,
  subjectQuestionId: '',
  scheduleAvailability: null,
  scheduleChecking: false,
  reservationScheduledAt: 0,
  rescheduleAvailability: null,
  rescheduleChecking: false,
  managementMessage: '',
  resultViewerName: '',
  resultShareBusy: false,
  checkoutBusy: false,
  checkoutStatusBusy: false,
  checkoutStatusAttempts: 0,
  checkoutResult: initialCheckoutResult,
  checkoutSessionId: initialCheckoutSessionId,
  checkoutStatus: null,
  checkoutEntitlementUrl: '',
  supportPanelOpen: false,
  creatorImageFile: null,
  creatorImagePreviewUrl: '',
  resultPreviewUrl: '',
  pollTimer: null,
  realtimeSocket: null,
  realtimeConnected: false,
  realtimeReconnectTimer: null,
  votePending: false,
  participantAnswers: initialRoomCode ? readParticipantAnswers(initialRoomCode) : {},
  systemStatus: { mode: 'normal', title: '', message: '' },
};

document.title = `${LIVE_SERIES.name} | わたちゃん`;
initializeLivePage();

async function initializeLivePage() {
  try {
    const response = await api('/api/live/status');
    state.systemStatus = response.status || state.systemStatus;
  } catch (error) { /* 状態APIが落ちていても静的ページ自体は表示する */ }
  if (state.view === 'channel-verification') await loadChannelVerification();
  else if (state.view === 'staff-auth') render();
  else if (initialRoomCode) initializeRoom();
  else render();
}

function render() {
  if (state.view === 'room-loading') return setPage('<div class="loading">ルームを読み込んでいます…</div>', false);
  if (state.view === 'staff-auth') return renderStaffAuth();
  if (state.view === 'entry') return renderEntry();
  if (state.view === 'channel-verification') return renderChannelVerification();
  if (state.view === 'youtube-editor') return renderEditor();
  if (state.view === 'youtube-candidates') return renderYouTubeCandidates();
  if (state.view === 'join') return renderJoin();
  if (state.view === 'host') return renderHost();
  if (state.view === 'subject') return renderSubject();
  if (state.view === 'participant') return renderParticipant();
  return setPage('<div class="panel"><h2>画面を表示できませんでした</h2></div>');
}

function renderStaffAuth() {
  setPage(`
    <section class="panel">
      <span class="eyebrow">STAFF SECURITY</span>
      <h2 style="margin-top:12px">スタッフ端末を確認</h2>
      <p class="help">スタッフ用URLだけでは企画を操作できません。運営から発行された招待コードを入力してください。</p>
      <div class="field"><label for="staffCreatorInvite">招待コード</label><input id="staffCreatorInvite" type="password" autocomplete="off" maxlength="64" placeholder="64文字の招待コード"></div>
      ${errorHtml()}
      <button class="primary" id="confirmStaffInvite" style="width:100%;margin-top:16px">確認して企画を開く</button>
    </section>
  `);
  bind('#confirmStaffInvite', 'click', async () => {
    state.creatorInvite = document.getElementById('staffCreatorInvite').value.trim();
    if (!isCreatorInviteReady()) { state.error = '64文字の招待コードを入力してください'; return render(); }
    sessionStorage.setItem('live:creator-invite', state.creatorInvite);
    state.view = 'room-loading';
    render();
    await initializeRoom();
  });
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
      <div class="notice">初期版は招待制です。運営の手動審査後に発行された招待コードが必要です。</div>
      <div class="field">
        <label for="creatorInvite">運営発行の招待コード</label>
        <input id="creatorInvite" type="password" autocomplete="off" maxlength="64" value="${escapeAttr(state.creatorInvite)}" placeholder="64文字の招待コード">
        <p class="help">招待コードはURLに含めず、この端末のセッション内だけに保存します。</p>
      </div>
      <div class="field">
        <label for="channelUrl">YouTubeチャンネル・動画URL</label>
        <input id="channelUrl" type="url" inputmode="url" autocomplete="url" placeholder="https://www.youtube.com/@handle または watch?v=..." value="${escapeAttr(state.channelUrl)}">
        <p class="help">チャンネルURLのほか、通常動画・短縮URL・Shorts・ライブのURLにも対応しています。動画URLの場合は投稿元チャンネルを自動で特定します。</p>
      </div>
      ${errorHtml()}
      <div id="youtubeGenerationChoices" class="grid" style="margin-top:16px" ${state.channelUrl.trim() ? '' : 'hidden'}>
        <button class="primary" data-youtube-type="guess-person" ${state.systemStatus.mode === 'maintenance' || !isCreatorInviteReady() ? 'disabled' : ''}>${escapeHtml(LIVE_SERIES.youtubePersonGenerateLabel)} <span class="accent">▶</span></button>
        <button class="secondary" data-youtube-type="guess-majority" ${state.systemStatus.mode === 'maintenance' || !isCreatorInviteReady() ? 'disabled' : ''}>${escapeHtml(LIVE_SERIES.youtubeMajorityGenerateLabel)} <span class="accent">▶</span></button>
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
  bind('#creatorInvite', 'input', (event) => {
    state.creatorInvite = event.target.value.trim();
    if (isCreatorInviteReady()) sessionStorage.setItem('live:creator-invite', state.creatorInvite);
    else sessionStorage.removeItem('live:creator-invite');
    document.querySelectorAll('[data-youtube-type]').forEach((button) => {
      button.disabled = state.systemStatus.mode === 'maintenance' || !isCreatorInviteReady();
    });
  });
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

function renderChannelVerification() {
  const verification = state.channelVerification;
  setPage(`
    <section class="hero">
      <span class="eyebrow">CHANNEL VERIFICATION</span>
      <h1>YouTubeチャンネル所有者確認</h1>
      <p>有料結果画像を販売するYouTuber本人・正式な運営者向けの確認画面です。</p>
    </section>
    <section class="panel" style="margin-top:18px">
      ${verification ? `
        <h2>${escapeHtml(verification.channelName)}</h2>
        <p class="help">対象：<a href="${escapeAttr(verification.channelUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(verification.channelUrl)}</a></p>
        ${verificationProgressHtml(verification)}
        <div class="verification-methods">
          <article class="question-card">
            <span class="badge">推奨</span><h3>YouTubeアカウントで確認</h3>
            <p class="help">Googleへログインし、このチャンネルを管理できるアカウントか確認します。読み取り権限だけを使い、確認後にアクセストークンを破棄します。</p>
            <button class="primary" id="startChannelOAuth" ${verification.ownershipStatus === 'verified' || state.channelVerificationBusy ? 'disabled' : ''}>Googleでチャンネル所有を確認</button>
          </article>
          <article class="question-card">
            <span class="badge">代替1</span><h3>チャンネル概要欄のコードで確認</h3>
            <p class="help">次のコードをYouTubeチャンネルの概要欄へ一時掲載し、反映後に確認してください。確認完了後は削除できます。</p>
            <div class="secret-output"><code id="channelConfirmationCode">${escapeHtml(verification.confirmationCode)}</code><button class="mini" id="copyConfirmationCode">コードをコピー</button></div>
            <button class="secondary" id="verifyChannelDescription" ${verification.ownershipStatus === 'verified' || state.channelVerificationBusy ? 'disabled' : ''}>概要欄に掲載したコードを確認</button>
          </article>
          <article class="question-card">
            <span class="badge">代替2</span><h3>運営による手動審査</h3>
            <p class="help">OAuthや概要欄を使えない場合に申請してください。運営から、チャンネルとの関係を示す資料や連絡をお願いすることがあります。</p>
            <button class="secondary" id="requestChannelManualReview" ${['verified', 'manual_pending'].includes(verification.ownershipStatus) || state.channelVerificationBusy ? 'disabled' : ''}>手動審査を申請</button>
          </article>
        </div>
        ${creatorAgreementHtml()}
        ${errorHtml()}
        <div class="actions"><button class="mini" id="refreshChannelVerification">確認状況を更新</button><a class="mini link-button" href="/live">LIVEトップへ戻る</a></div>
        <div class="notice">この確認URLは本人確認用の秘密URLです。第三者へ転送・公開しないでください。</div>
      ` : `
        <h2>確認情報を読み込めません</h2>
        ${errorHtml() || '<div class="error">確認URLが正しいか、発行したスタッフへ確認してください。</div>'}
        <a class="mini link-button" href="/live">LIVEトップへ戻る</a>
      `}
    </section>
  `);
  bindChannelVerificationActions();
  bindCreatorAgreementActions();
}

function verificationProgressHtml(verification) {
  const ownershipLabel = {
    pending: '未確認', manual_pending: '運営の手動審査待ち', verified: '所有確認済み', rejected: '確認却下',
  }[verification.ownershipStatus] || '確認中';
  const stripeLabel = {
    pending: 'Stripe名義関係の審査待ち', verified: 'Stripe名義関係を確認済み', rejected: 'Stripe名義関係を確認できません',
  }[verification.stripeRelationshipStatus] || 'Stripe審査中';
  return `
    <div class="verification-progress">
      <div class="verification-step ${verification.ownershipStatus === 'verified' ? 'is-done' : ''}"><strong>1. チャンネル所有</strong><span>${escapeHtml(ownershipLabel)}</span></div>
      <div class="verification-step ${verification.creatorAgreementAccepted ? 'is-done' : ''}"><strong>2. 収益分配契約</strong><span>${verification.creatorAgreementAccepted ? `規約${escapeHtml(verification.creatorAgreementTermsVersion)}に同意済み` : 'Web同意待ち'}</span></div>
      <div class="verification-step ${verification.stripeIdentityVerified ? 'is-done' : ''}"><strong>3. Stripe本人確認</strong><span>${verification.stripeIdentityVerified ? '確認済み' : '運営の案内後に確認'}</span></div>
      <div class="verification-step ${verification.stripeRelationshipStatus === 'verified' ? 'is-done' : ''}"><strong>4. 名義関係</strong><span>${escapeHtml(stripeLabel)}</span></div>
    </div>
    <div class="notice">${verification.canSellPaid
      ? '有料結果画像を販売できます。'
      : '無料LIVEはこのまま利用できます。有料販売は4段階すべての確認後に有効になります。'}</div>
  `;
}

function creatorAgreementHtml() {
  const data = state.creatorAgreement;
  if (!data) return '<section class="agreement-panel"><h3>収益分配契約</h3><div class="notice">契約情報を読み込んでいます。</div></section>';
  if (data.accepted && data.agreement) {
    return `
      <section class="agreement-panel agreement-complete">
        <span class="badge">同意記録済み</span><h3>収益分配契約の申込みを受け付けました</h3>
        <dl class="agreement-receipt">
          <div><dt>規約</dt><dd>バージョン ${escapeHtml(data.agreement.termsVersion)}</dd></div>
          <div><dt>規約SHA-256</dt><dd><code>${escapeHtml(data.agreement.termsDocumentSha256)}</code></dd></div>
          <div><dt>同意日時</dt><dd>${escapeHtml(formatLiveDate(data.agreement.acceptedAt))}</dd></div>
          <div><dt>契約者名</dt><dd>${escapeHtml(data.agreement.contractingName)}</dd></div>
          <div><dt>連絡先</dt><dd>${escapeHtml(data.agreement.contactEmailMasked)}</dd></div>
          <div><dt>振込先</dt><dd>${escapeHtml(data.agreement.stripeAccountMasked)}</dd></div>
          <div><dt>同意記録ID</dt><dd><code>${escapeHtml(data.agreement.agreementId)}</code></dd></div>
        </dl>
        <p class="help">契約は、チャンネル・Stripe本人確認・名義関係を運営が承認した時点で成立します。</p>
      </section>
    `;
  }
  if (!data.ownershipVerified) {
    return '<section class="agreement-panel"><h3>収益分配契約</h3><div class="notice">先に上の方法でチャンネル所有確認を完了してください。</div></section>';
  }
  if (!data.stripeAccountRegistered) {
    return '<section class="agreement-panel"><h3>収益分配契約</h3><div class="notice">チャンネル所有確認は完了しています。運営によるStripe Connect振込先登録後、この画面で契約へ同意できます。</div></section>';
  }
  return `
    <section class="agreement-panel">
      <span class="badge">CREATOR AGREEMENT</span><h3>収益分配契約へ同意する</h3>
      <p class="help">全文を確認したうえで、契約者本人または契約権限を持つ担当者が操作してください。</p>
      <div class="agreement-summary"><strong>規約バージョン ${escapeHtml(data.terms.version)}</strong><span>YouTuber分配70%・売上確定後14日保留・確定残高5,000円以上で月1回入金</span><a href="/creator-terms" target="_blank" rel="noopener noreferrer">収益分配規約の全文を読む</a></div>
      <div class="field"><label for="agreementContractingName">契約者名（個人氏名または法人名）</label><input id="agreementContractingName" maxlength="120" autocomplete="name" value="${escapeAttr(state.creatorAgreementContractingName)}"></div>
      <div class="field"><label for="agreementContactEmail">契約連絡先メールアドレス</label><input id="agreementContactEmail" type="email" maxlength="254" autocomplete="email" value="${escapeAttr(state.creatorAgreementContactEmail)}"></div>
      <div class="notice">登録済み振込先：${escapeHtml(data.stripeAccountMasked)}</div>
      <label class="agreement-check"><input id="confirmCreatorTerms" type="checkbox"> <span>収益分配規約の全文、売上70%の分配、14日保留、月次・5,000円基準、返金・チャージバック時の相殺に同意します。</span></label>
      <label class="agreement-check"><input id="confirmCreatorAuthority" type="checkbox"> <span>チャンネル、名称、画像等を許諾し、この契約を締結する権限があることを確認します。</span></label>
      <label class="agreement-check"><input id="confirmCreatorPrivacy" type="checkbox"> <span>契約証跡として規約バージョン、同意日時、IPアドレス、端末・ブラウザ情報、ConnectアカウントID等を保存することに同意します。</span></label>
      <button class="primary" id="acceptCreatorAgreement" disabled>${state.creatorAgreementBusy ? '同意記録を保存しています…' : '同意して契約を申し込む'}</button>
      <p class="help">これはWeb上の同意記録です。本人確認と運営承認の代わりにはなりません。</p>
    </section>
  `;
}

function bindCreatorAgreementActions() {
  bind('#agreementContractingName', 'input', (event) => { state.creatorAgreementContractingName = event.target.value; });
  bind('#agreementContactEmail', 'input', (event) => { state.creatorAgreementContactEmail = event.target.value; });
  ['#confirmCreatorTerms', '#confirmCreatorAuthority', '#confirmCreatorPrivacy'].forEach((selector) => bind(selector, 'change', updateCreatorAgreementButton));
  bind('#acceptCreatorAgreement', 'click', acceptCreatorAgreementFromPage);
}

function updateCreatorAgreementButton() {
  const button = document.getElementById('acceptCreatorAgreement');
  if (!button) return;
  button.disabled = state.creatorAgreementBusy || !['confirmCreatorTerms', 'confirmCreatorAuthority', 'confirmCreatorPrivacy']
    .every((id) => document.getElementById(id)?.checked);
}

async function acceptCreatorAgreementFromPage() {
  const contractingName = document.getElementById('agreementContractingName')?.value.trim() || '';
  const contactEmail = document.getElementById('agreementContactEmail')?.value.trim() || '';
  state.creatorAgreementContractingName = contractingName;
  state.creatorAgreementContactEmail = contactEmail;
  if (!contractingName || !contactEmail) {
    state.error = '契約者名と契約連絡先メールアドレスを入力してください';
    return render();
  }
  if (!confirm('表示中の収益分配規約へ同意し、契約を申し込みますか？')) return;
  state.creatorAgreementBusy = true;
  state.error = '';
  render();
  try {
    const terms = state.creatorAgreement.terms;
    await api(`/api/live/channel-verifications/${state.channelVerificationId}/agreement`, {
      method: 'POST', headers: verificationHeaders(), body: JSON.stringify({
        termsVersion: terms.version,
        termsDocumentSha256: terms.documentSha256,
        contractingName,
        contactEmail,
        confirmTerms: true,
        confirmAuthority: true,
        confirmPrivacy: true,
      }),
    });
    state.creatorAgreementBusy = false;
    await loadChannelVerification();
    return;
  } catch (error) {
    state.error = humanError(error);
  }
  state.creatorAgreementBusy = false;
  render();
}

function bindChannelVerificationActions() {
  bind('#copyConfirmationCode', 'click', () => copyText(state.channelVerification?.confirmationCode || ''));
  bind('#refreshChannelVerification', 'click', loadChannelVerification);
  bind('#verifyChannelDescription', 'click', () => updateChannelVerification('verify-description'));
  bind('#requestChannelManualReview', 'click', () => {
    if (confirm('運営へ手動審査を申請しますか？')) updateChannelVerification('manual-review');
  });
  bind('#startChannelOAuth', 'click', startChannelOAuth);
}

async function createChannelVerificationForDraft() {
  state.channelVerificationBusy = true;
  state.error = '';
  render();
  try {
    const verification = await api('/api/live/channel-verifications', {
      method: 'POST', headers: creatorInviteHeaders(), body: JSON.stringify({ channelUrl: state.channelUrl }),
    });
    state.channelVerification = verification;
    state.channelVerificationId = verification.verificationId;
    state.channelVerificationToken = verification.accessToken;
    state.draft.channelVerificationId = verification.verificationId;
    saveChannelVerificationAccess(verification);
  } catch (error) {
    state.error = humanError(error);
  }
  state.channelVerificationBusy = false;
  render();
}

async function loadChannelVerification() {
  if (!/^[a-f0-9]{32}$/i.test(state.channelVerificationId)
    || !/^[a-f0-9]{48}$/i.test(state.channelVerificationToken)) {
    state.error = '確認URLが無効です。スタッフに再発行を依頼してください';
    return render();
  }
  sessionStorage.setItem(`live:verification:${state.channelVerificationId}`, state.channelVerificationToken);
  state.channelVerificationBusy = true;
  try {
    const [verification, agreement] = await Promise.all([
      api(`/api/live/channel-verifications/${state.channelVerificationId}`, { headers: verificationHeaders() }),
      api(`/api/live/channel-verifications/${state.channelVerificationId}/agreement`, { headers: verificationHeaders() }),
    ]);
    state.channelVerification = verification;
    state.creatorAgreement = agreement;
    state.error = '';
    saveChannelVerificationAccess(state.channelVerification);
  } catch (error) {
    state.error = humanError(error);
  }
  state.channelVerificationBusy = false;
  render();
}

async function updateChannelVerification(action) {
  state.channelVerificationBusy = true;
  state.error = '';
  render();
  try {
    state.channelVerification = await api(`/api/live/channel-verifications/${state.channelVerificationId}/${action}`, {
      method: 'POST', headers: verificationHeaders(), body: '{}',
    });
    state.creatorAgreement = await api(`/api/live/channel-verifications/${state.channelVerificationId}/agreement`, {
      headers: verificationHeaders(),
    });
  } catch (error) {
    state.error = humanError(error);
  }
  state.channelVerificationBusy = false;
  render();
}

async function startChannelOAuth() {
  const popup = window.open('about:blank', '_blank');
  if (popup) popup.opener = null;
  state.channelVerificationBusy = true;
  state.error = '';
  render();
  try {
    const response = await api(`/api/live/channel-verifications/${state.channelVerificationId}/oauth-start`, {
      method: 'POST', headers: verificationHeaders(), body: '{}',
    });
    if (popup) popup.location.replace(response.authorizationUrl);
    else location.assign(response.authorizationUrl);
  } catch (error) {
    if (popup) popup.close();
    state.error = humanError(error);
  }
  state.channelVerificationBusy = false;
  render();
}

function saveChannelVerificationAccess(verification) {
  if (!verification?.verificationId || !state.channelVerificationToken) return;
  sessionStorage.setItem(`live:verification:${verification.verificationId}`, state.channelVerificationToken);
  if (verification.channelId) sessionStorage.setItem(`live:verification-channel:${verification.channelId}`, JSON.stringify({
    verificationId: verification.verificationId,
    accessToken: state.channelVerificationToken,
  }));
}

function restoreChannelVerificationAccess(channelId) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(`live:verification-channel:${channelId}`) || '{}');
    if (/^[a-f0-9]{32}$/i.test(saved.verificationId) && /^[a-f0-9]{48}$/i.test(saved.accessToken)) {
      state.channelVerificationId = saved.verificationId;
      state.channelVerificationToken = saved.accessToken;
      state.draft.channelVerificationId = saved.verificationId;
    }
  } catch (error) { /* 壊れた端末内データは無視する */ }
}

function channelVerificationUrl() {
  return `${location.origin}/live?verify=${state.channelVerificationId}#verification=${state.channelVerificationToken}`;
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
      headers: creatorInviteHeaders(),
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
      channelName: state.channelProfile?.channelName || '',
      channelId: state.channelProfile?.channelId || '',
      channelVerificationId: '',
      scheduledAt: 0,
      resultImagePrice: LIVE_RESULT_IMAGE_PRICES[0],
      showLiveVoteCounts: false,
      questions: selected.map((question) => createLiveQuestion({ ...question, id: undefined })),
    };
    restoreChannelVerificationAccess(state.draft.channelId);
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
      headers: creatorInviteHeaders(),
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
        <div class="field editor-schedule-setting">
          <label for="scheduledAt">ライブ配信の予約日時</label>
          <input id="scheduledAt" type="datetime-local" min="${escapeAttr(minimumScheduleValue())}" value="${escapeAttr(formatDateTimeInput(state.draft.scheduledAt))}">
          <button class="secondary" id="checkSchedule" type="button" ${state.draft.scheduledAt && !state.scheduleChecking ? '' : 'disabled'}>${state.scheduleChecking ? '空き状況を確認中…' : 'この日時の空きを確認する'}</button>
          ${scheduleAvailabilityHtml()}
          <p class="help">予約時刻の前後${LIVE_RESERVATION_BUFFER_HOURS}時間は、ほかのYouTuberが予約できません。企画保存時にもサーバー側で再確認します。</p>
          <div class="capacity-notice"><strong>設計上限：視聴者${LIVE_VIEWER_LIMIT.toLocaleString('ja-JP')}人</strong><span>投票処理を32分割し、上限を超えた参加はサーバー側で拒否します。本番開放前には契約環境で段階的な負荷試験を行います。</span></div>
        </div>
        <div class="field editor-creator-image">
          <label for="creatorImage">結果画像に入れるYouTuber画像</label>
          <input id="creatorImage" type="file" accept="image/jpeg,image/png,image/webp">
          <p class="help">似顔絵・宣材写真などを登録できます。結果画像では通常の黒髪の女の子と差し替えます。中央に人物が写った正方形に近い画像がおすすめです。</p>
          ${state.creatorImagePreviewUrl ? `<div class="creator-image-preview"><img src="${escapeAttr(state.creatorImagePreviewUrl)}" alt="登録するYouTuber画像"><button class="mini" id="removeCreatorImage" type="button">画像を外す</button></div>` : '<div class="notice">画像を登録しない場合は、従来の黒髪の女の子を表示します。</div>'}
          <div class="notice">元画像は視聴者へ送らず、企画保存時に非公開ストレージへ直接アップロードします。運営の画像審査で承認されるまでは既定画像を表示します。</div>
          <label for="resultImagePrice">高画質結果画像の販売価格</label>
          <select id="resultImagePrice">${LIVE_RESULT_IMAGE_PRICES.map((price) => `<option value="${price}" ${Number(state.draft.resultImagePrice) === price ? 'selected' : ''}>${price.toLocaleString('ja-JP')}円（税込）</option>`).join('')}</select>
          <p class="help">有料販売の審査完了後に有効になります。売上の70%をYouTuber分配残高として記録します。</p>
        </div>
        ${channelOwnershipEditorHtml()}
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
  bind('#subjectName', 'input', (event) => {
    state.draft.subjectName = event.target.value;
    if (!state.draft.channelName) state.draft.channelName = event.target.value;
  });
  bind('#scheduledAt', 'change', (event) => {
    state.draft.scheduledAt = new Date(event.target.value).getTime() || 0;
    state.scheduleAvailability = null;
    render();
  });
  bind('#checkSchedule', 'click', checkScheduleAvailability);
  bind('#creatorImage', 'change', async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    try {
      validateCreatorImageFile(file);
      if (state.creatorImagePreviewUrl) URL.revokeObjectURL(state.creatorImagePreviewUrl);
      state.creatorImageFile = file;
      state.creatorImagePreviewUrl = URL.createObjectURL(file);
      state.error = '';
    } catch (error) {
      state.error = humanError(error);
    }
    render();
  });
  bind('#removeCreatorImage', 'click', () => {
    if (state.creatorImagePreviewUrl) URL.revokeObjectURL(state.creatorImagePreviewUrl);
    state.creatorImageFile = null;
    state.creatorImagePreviewUrl = '';
    render();
  });
  bind('#resultImagePrice', 'change', (event) => { state.draft.resultImagePrice = Number(event.target.value); });
  bind('#createChannelVerification', 'click', createChannelVerificationForDraft);
  bind('#copyChannelVerificationUrl', 'click', () => copyText(channelVerificationUrl()));
  bind('#refreshEditorChannelVerification', 'click', loadChannelVerification);
  bind('#showLiveVoteCounts', 'change', (event) => { state.draft.showLiveVoteCounts = event.target.checked; });
  document.querySelectorAll('[data-question-index]').forEach((card) => bindEditorCard(card));
  bind('#createGame', 'click', createGame);
}

function channelOwnershipEditorHtml() {
  if (!state.channelVerificationId) {
    return `
      <div class="field editor-channel-verification">
        <span class="field-label">有料結果画像の販売準備（任意）</span>
        <div class="notice">無料LIVEの企画保存・配信には不要です。有料販売を行う場合だけ、YouTuber本人へチャンネル確認URLを送ってください。</div>
        <button class="secondary" id="createChannelVerification" type="button" ${state.channelVerificationBusy ? 'disabled' : ''}>チャンネル所有確認URLを発行する</button>
      </div>
    `;
  }
  return `
    <div class="field editor-channel-verification">
      <span class="field-label">有料結果画像の販売準備</span>
      ${state.channelVerification ? verificationProgressHtml(state.channelVerification) : '<div class="notice">この企画には所有確認手続きが紐づいています。最新状況を取得してください。</div>'}
      <label for="channelVerificationUrl">YouTuber本人へ送る秘密URL</label>
      <input id="channelVerificationUrl" readonly value="${escapeAttr(channelVerificationUrl())}">
      <div class="actions"><button class="mini" id="copyChannelVerificationUrl" type="button">確認URLをコピー</button><button class="mini" id="refreshEditorChannelVerification" type="button">確認状況を更新</button></div>
      <p class="help">このURLはYouTuber本人または正式なチャンネル運営者だけへ、安全な連絡手段で送ってください。</p>
    </div>
  `;
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

function minimumScheduleValue() {
  return formatDateTimeInput(Date.now() + 10 * 60 * 1000);
}

function formatDateTimeInput(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function formatLiveDate(value, includeTime = true) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '日時未設定';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '日時未設定';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

function scheduleAvailabilityHtml() {
  if (!state.draft.scheduledAt) return '<div class="notice">カレンダーから配信日と開始時刻を選んでください。</div>';
  if (state.scheduleChecking) return '<div class="notice">予約枠を確認しています…</div>';
  if (state.scheduleAvailability === true) return '<div class="notice schedule-ok">この日時は予約できます。企画保存時に予約を確定します。</div>';
  if (state.scheduleAvailability === false) return `<div class="error">前後${LIVE_RESERVATION_BUFFER_HOURS}時間以内に別の予約があります。別の日時を選んでください。</div>`;
  return `<div class="notice">選択中：${escapeHtml(formatLiveDate(state.draft.scheduledAt))}</div>`;
}

async function checkScheduleAvailability() {
  if (!state.draft.scheduledAt) return;
  state.scheduleChecking = true;
  state.scheduleAvailability = null;
  render();
  try {
    const response = await api(`/api/live/reservations/availability?scheduledAt=${encodeURIComponent(state.draft.scheduledAt)}`);
    state.scheduleAvailability = response.available === true;
    state.error = '';
  } catch (error) {
    state.scheduleAvailability = null;
    state.error = humanError(error);
  }
  state.scheduleChecking = false;
  render();
}

function rescheduleAvailabilityHtml(game) {
  const scheduledAt = Number(state.reservationScheduledAt || game?.scheduledAt || 0);
  if (!scheduledAt) return '<div class="notice">変更先の配信日と開始時刻を選んでください。</div>';
  if (state.rescheduleChecking) return '<div class="notice">変更先の予約枠を確認しています…</div>';
  if (state.rescheduleAvailability === true) return '<div class="notice schedule-ok">この日時へ変更できます。確定するまでは現在の予約枠を保持します。</div>';
  if (state.rescheduleAvailability === false) return `<div class="error">前後${LIVE_RESERVATION_BUFFER_HOURS}時間以内に別の予約があります。現在の予約は変更されていません。</div>`;
  if (scheduledAt === Number(game?.scheduledAt)) return '<div class="notice">現在の予約日時です。変更するときは新しい日時を選んでください。</div>';
  return `<div class="notice">変更候補：${escapeHtml(formatLiveDate(scheduledAt))}</div>`;
}

async function checkReservationRescheduleAvailability() {
  const scheduledAt = Number(state.reservationScheduledAt || state.game?.scheduledAt || 0);
  if (!scheduledAt || scheduledAt === Number(state.game?.scheduledAt)) {
    state.rescheduleAvailability = null;
    state.error = scheduledAt ? '現在と異なる予約日時を選んでください' : '変更先の予約日時を選んでください';
    return render();
  }
  state.rescheduleChecking = true;
  state.rescheduleAvailability = null;
  state.managementMessage = '';
  state.error = '';
  render();
  try {
    const response = await api(`/api/live/reservations/availability?scheduledAt=${encodeURIComponent(scheduledAt)}&code=${encodeURIComponent(state.roomCode)}`, { headers: hostHeaders() });
    state.rescheduleAvailability = response.available === true;
  } catch (error) {
    state.error = humanError(error);
  }
  state.rescheduleChecking = false;
  render();
}

async function rescheduleReservation() {
  const scheduledAt = Number(state.reservationScheduledAt || 0);
  if (state.rescheduleAvailability !== true || !scheduledAt) return;
  if (!window.confirm(`予約日時を「${formatLiveDate(scheduledAt)}」へ変更しますか？\n現在の予約枠は、変更が成功するまで保持されます。`)) return;
  try {
    const response = await api(`/api/live/games/${state.roomCode}/reschedule`, {
      method: 'POST', headers: hostHeaders(), body: JSON.stringify({ scheduledAt }),
    });
    state.game = response.game;
    state.reservationScheduledAt = Number(response.game?.scheduledAt) || 0;
    state.rescheduleAvailability = null;
    state.managementMessage = `予約日時を${formatLiveDate(response.game?.scheduledAt)}へ変更しました。`;
    state.error = '';
  } catch (error) {
    state.rescheduleAvailability = null;
    state.error = humanError(error);
  }
  render();
}

async function rotateReservationLink(target) {
  const label = target === 'host' ? 'スタッフ用URL' : 'YouTuber本人用URL';
  if (!window.confirm(`${label}を再発行しますか？\n再発行すると、古いURLは直ちに使えなくなります。`)) return;
  try {
    const response = await api(`/api/live/games/${state.roomCode}/rotate-links`, {
      method: 'POST', headers: hostHeaders(),
      body: JSON.stringify({ host: target === 'host', subject: target === 'subject' }),
    });
    state.game = response.game;
    if (target === 'host' && response.hostToken) {
      state.hostToken = response.hostToken;
      sessionStorage.setItem(`live:host:${state.roomCode}`, response.hostToken);
      history.replaceState({}, '', `/live?room=${state.roomCode}#host=${response.hostToken}`);
    }
    state.managementMessage = `${label}を再発行しました。表示された新URLをコピーして、安全な方法で共有してください。`;
    state.error = '';
  } catch (error) {
    state.error = humanError(error);
  }
  render();
}

async function cancelReservation() {
  if (!window.confirm('このLIVE予約をキャンセルしますか？\n予約枠は解放され、視聴者・YouTuber本人・古いスタッフURLにはキャンセル済みと表示されます。この操作は元に戻せません。')) return;
  try {
    const response = await api(`/api/live/games/${state.roomCode}/cancel`, {
      method: 'POST', headers: hostHeaders(), body: JSON.stringify({}),
    });
    state.game = response.game;
    state.error = '';
    clearInterval(state.pollTimer);
    closeRealtimeSocket();
  } catch (error) {
    state.error = humanError(error);
  }
  render();
}

function validateCreatorImageFile(file) {
  if (!/^image\/(?:jpeg|png|webp)$/i.test(file.type || '')) throw new Error('invalid-creator-image');
  if (Number(file.size) > 10 * 1024 * 1024) throw new Error('creator-image-too-large');
  if (Number(file.size) < 1) throw new Error('invalid-creator-image');
}

async function createGame() {
  const validation = validateLiveDraft(state.draft);
  if (!validation.valid) { state.error = validation.errors.join('\n'); return render(); }
  state.error = '';
  const button = document.getElementById('createGame');
  button.disabled = true;
  button.textContent = '企画を保存しています…';
  try {
    let body;
    if (state.creatorImageFile) {
      body = new FormData();
      body.append('draft', JSON.stringify({ draft: validation.draft }));
      body.append('image', state.creatorImageFile, state.creatorImageFile.name || 'creator-image');
    } else {
      body = JSON.stringify({ draft: validation.draft });
    }
    const response = await api('/api/live/games', { method: 'POST', headers: creatorInviteHeaders(), body });
    state.roomCode = response.code;
    state.hostToken = response.hostToken;
    state.game = response.game;
    if (state.creatorImagePreviewUrl) URL.revokeObjectURL(state.creatorImagePreviewUrl);
    state.creatorImageFile = null;
    state.creatorImagePreviewUrl = '';
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
    state.view = state.hostToken ? 'staff-auth' : 'join';
  }
  render();
}

function renderJoin() {
  if (state.game?.phase === 'cancelled') return setPage(cancelledLiveHtml(state.game));
  if (state.game?.phase === 'terminated') return setPage(terminatedLiveHtml(state.game));
  const isFull = Number(state.game?.participantCount || 0) >= Number(state.game?.participantLimit || LIVE_VIEWER_LIMIT);
  setPage(`
    <section class="panel">
      <span class="eyebrow">JOIN LIVE</span>
      <h2 style="margin-top:12px">${escapeHtml(state.game?.title || LIVE_SERIES.name)}</h2>
      ${state.game?.scheduledAt ? `<div class="notice">配信予定：${escapeHtml(formatLiveDate(state.game.scheduledAt))}</div>` : ''}
      <div class="capacity-notice"><strong>視聴者上限 ${state.game?.participantLimit || LIVE_VIEWER_LIMIT}人</strong><span>現在 ${state.game?.participantCount || 0}人が参加しています。</span></div>
      <div class="room-code" aria-label="ルームコード ${escapeAttr(state.roomCode)}">${escapeHtml(state.roomCode)}</div>
      <div class="field"><label for="participantName">あなたの名前</label><input id="participantName" maxlength="24" autocomplete="nickname" placeholder="名前を入力"></div>
      ${errorHtml()}
      <button class="primary" id="joinGame" style="margin-top:16px" ${isFull ? 'disabled' : ''}>${isFull ? '参加上限に達しました' : '参加する <span class="accent">▶</span>'}</button>
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
    state.participantAnswers = {};
    saveParticipantAnswers();
    state.resultViewerName = response.game?.participantName || name;
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
  if (game.phase === 'cancelled') return setPage(cancelledLiveHtml(game));
  if (game.phase === 'terminated') return setPage(terminatedLiveHtml(game));
  let content = '';
  if (game.phase === 'lobby') {
    const shareUrl = `${location.origin}/live?room=${state.roomCode}`;
    const managementUrl = `${shareUrl}#host=${state.hostToken}`;
    const subjectUrl = game.subjectToken ? `${shareUrl}#subject=${game.subjectToken}` : '';
    content = `
      <section class="panel">
        <span class="eyebrow">SAVED</span><h2 style="margin-top:12px">企画を保存しました</h2>
        <p class="help">${escapeHtml(game.title)}は${escapeHtml(formatSavedUntil(game.expiresAt))}まで保存されます。配信当日は、このスタッフ用URLから戻ってきてください。</p>
        <div class="notice"><strong>予約日時：</strong>${escapeHtml(formatLiveDate(game.scheduledAt))}<br>この時刻の前後${LIVE_RESERVATION_BUFFER_HOURS}時間は、ほかのLIVE予約を受け付けません。</div>
        <div class="capacity-notice"><strong>視聴者上限 ${game.participantLimit || LIVE_VIEWER_LIMIT}人</strong><span>上限を超えた視聴者は参加APIでも拒否されます。</span></div>
        <div class="field"><label for="managementUrl">スタッフ用URL（視聴者には共有しない）</label><input id="managementUrl" readonly value="${escapeAttr(managementUrl)}"></div>
        <button class="secondary" id="copyManagementUrl" style="width:100%;margin-top:10px">スタッフ用URLをコピー</button>
        ${subjectUrl ? `<div class="field"><label for="subjectUrl">YouTuber本人用URL（本人だけに共有）</label><input id="subjectUrl" readonly value="${escapeAttr(subjectUrl)}"></div><button class="secondary" id="copySubjectUrl" style="width:100%;margin-top:10px">YouTuber本人用URLをコピー</button>` : ''}
      </section>
      <section class="panel live-reservation-management">
        <span class="eyebrow">RESERVATION</span><h2 style="margin-top:12px">予約を変更・キャンセル</h2>
        <p class="help">クローズドβ中は変更後も予約時刻の前後${LIVE_RESERVATION_BUFFER_HOURS}時間を確保します。ライブ開始後は変更できません。</p>
        <div class="field"><label for="reservationScheduledAt">新しい配信日時</label><input id="reservationScheduledAt" type="datetime-local" min="${escapeAttr(minimumScheduleValue())}" value="${escapeAttr(formatDateTimeInput(state.reservationScheduledAt || game.scheduledAt))}"></div>
        <div class="actions"><button class="secondary" id="checkReschedule">変更先の空きを確認</button><button class="primary" id="confirmReschedule" ${state.rescheduleAvailability === true ? '' : 'disabled'}>この日時へ変更</button></div>
        ${rescheduleAvailabilityHtml(game)}
        <h3 style="margin-top:20px">非公開URLの再発行</h3><p class="help">再発行した瞬間に古いURLは使えなくなります。新URLを安全な方法で担当者へ共有してください。</p>
        <div class="actions"><button class="secondary" id="rotateHostUrl">スタッフ用URLを再発行</button><button class="secondary" id="rotateSubjectUrl">本人用URLを再発行</button></div>
        <button class="danger" id="cancelReservation" style="width:100%;margin-top:22px">このLIVE予約をキャンセル</button>
        ${state.managementMessage ? `<div class="notice" role="status">${escapeHtml(state.managementMessage)}</div>` : ''}
        ${errorHtml()}
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
  bind('#reservationScheduledAt', 'change', (event) => {
    state.reservationScheduledAt = new Date(event.target.value).getTime() || 0;
    state.rescheduleAvailability = null;
    state.managementMessage = '';
    state.error = '';
    render();
  });
  bind('#checkReschedule', 'click', checkReservationRescheduleAvailability);
  bind('#confirmReschedule', 'click', rescheduleReservation);
  bind('#rotateHostUrl', 'click', () => rotateReservationLink('host'));
  bind('#rotateSubjectUrl', 'click', () => rotateReservationLink('subject'));
  bind('#cancelReservation', 'click', cancelReservation);
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
  if (game.phase === 'cancelled') return setPage(cancelledLiveHtml(game));
  if (game.phase === 'terminated') return setPage(terminatedLiveHtml(game));
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
  if (game.phase === 'cancelled') return setPage(cancelledLiveHtml(game));
  if (game.phase === 'terminated') return setPage(terminatedLiveHtml(game));
  let content = '';
  if (game.phase === 'lobby') {
    content = `<section class="panel"><span class="eyebrow">WAITING</span><h2 style="margin-top:12px">${escapeHtml(game.title)}</h2><div class="notice">参加しました。司会者が開始するまでこの画面でお待ちください。</div>${participantHtml(game)}</section>`;
  } else if (game.phase === 'answering') {
    content = `<section class="panel">${liveQuestionHeader(game)}<div class="notice">${escapeHtml(game.subjectName)}本人が回答中です。回答が確定すると投票できるようになります。</div></section>`;
  } else if (game.phase === 'voting') {
    const waitingMessage = game.flowVersion >= 4 ? '回答しました。スタッフが次の問題へ進むまでお待ちください。' : '回答しました。YouTuberが次の問題へ進むまでお待ちください。';
    content = `<section class="panel">${liveQuestionHeader(game, '出題')}<div class="vote-options">${game.question.options.map((option, index) => `<button class="vote-option ${game.myVoteIndex === index ? 'selected' : ''}" data-vote-index="${index}" ${game.myVoteIndex !== null || state.votePending ? 'disabled' : ''}><span class="badge">${index + 1}</span><span>${escapeHtml(option)}</span>${game.showVoteCount ? `<span class="live-vote-count">${game.question.voteCounts?.[index] || 0}票</span>` : ''}</button>`).join('')}</div>${game.showVoteCount ? '<div class="notice">選択肢別の現在票数を表示しています。</div>' : ''}${game.myVoteIndex !== null ? `<div class="notice">${waitingMessage}</div>` : state.votePending ? '<div class="notice">回答を送信しています…</div>' : '<div class="notice">YouTuberと同時に回答してください。</div>'}</section>`;
  } else if (game.phase === 'review-question') {
    content = `<section class="panel"><span class="eyebrow">ANSWER CHECK</span>${liveQuestionHeader(game, '答え合わせ')}<div class="notice">スタッフが答えを発表するまでお待ちください。</div></section>`;
  } else if (game.phase === 'review-answer') {
    content = `<section class="panel"><span class="eyebrow">ANSWER</span>${liveQuestionHeader(game, '答え合わせ')}${personalResultBlock(game.question.result)}${resultBlock(game.question.result, game.subjectName, false)}<div class="notice">スタッフが次の答え合わせへ進むまでお待ちください。</div></section>`;
  } else if (game.phase === 'reveal') {
    content = `<section class="panel">${liveQuestionHeader(game)}${personalResultBlock(game.question.result)}${resultBlock(game.question.result, game.subjectName)}<div class="notice">司会者が次の問題へ進むまでお待ちください。</div></section>`;
  } else {
    const viewerName = state.resultViewerName || game.participantName || '視聴者';
    content = `<section class="panel"><span class="eyebrow">FINISH</span><h2 style="margin-top:12px">あなたの最終結果</h2>${personalSummary(game.results)}<div class="result-list">${game.results.map((result, index) => `<article class="result-card"><span class="badge">Q${index + 1}</span>${personalResultBlock(result)}${resultBlock(result, game.subjectName)}</article>`).join('')}</div></section>
      <section class="panel live-result-image-panel">
        <span class="eyebrow">RESULT IMAGE</span>
        <h2 style="margin-top:12px">購入用結果画像のプレビュー</h2>
        <p class="help">YouTubeチャンネル名・登録したYouTuber画像・ライブ配信日・あなたの名前が入ります。</p>
        <div class="field"><label for="resultViewerName">結果画像に入れるあなたの名前</label><input id="resultViewerName" maxlength="24" value="${escapeAttr(viewerName)}" placeholder="名前を入力"></div>
        <div class="result-image-status" id="resultImageStatus">プレビューを作成しています…</div>
        <img class="live-result-preview" id="liveResultPreview" alt="購入用結果画像のプレビュー" hidden>
        ${liveCheckoutHtml(game)}
        ${errorHtml()}
        <div class="live-result-share">
          <strong>この結果を友達に送る</strong>
          <p>XやLINEは結果文とLIVEページのURLを送れます。画像はPCでは保存、スマホでは共有・保存できます。</p>
          <div class="live-result-share-grid">
            <button class="live-share-button live-share-x" id="shareLiveResultX" type="button">Xで結果をツイート</button>
            <button class="live-share-button live-share-line" id="shareLiveResultLine" type="button">LINEで結果を送る</button>
          </div>
          <button class="live-share-button live-share-image" id="shareLiveResultImage" type="button">結果画像を保存／送る</button>
          <div class="result-share-status" id="resultShareStatus" aria-live="polite"></div>
        </div>
        <div class="notice">決済はStreetboardgame運営者がStripe Checkoutで受け付けます。返金条件は購入前に<a href="/refund-policy" target="_blank" rel="noopener noreferrer">返金・キャンセルポリシー</a>をご確認ください。</div>
      </section>`;
  }
  setPage(content);
  document.querySelectorAll('[data-vote-index]').forEach((button) => button.addEventListener('click', () => vote(Number(button.dataset.voteIndex))));
  bind('#resultViewerName', 'input', (event) => {
    state.resultViewerName = event.target.value.slice(0, 24);
    refreshLiveResultPreview();
  });
  bind('#shareLiveResultX', 'click', shareLiveResultX);
  bind('#shareLiveResultLine', 'click', shareLiveResultLine);
  bind('#shareLiveResultImage', 'click', shareLiveResultImage);
  bind('#buyLiveResultImage', 'click', () => startLiveCheckout('result_image'));
  bind('#toggleLiveSupport', 'click', () => { state.supportPanelOpen = !state.supportPanelOpen; render(); });
  document.querySelectorAll('[data-live-support-amount]').forEach((button) => button.addEventListener('click', () => {
    startLiveCheckout('support', Number(button.dataset.liveSupportAmount));
  }));
  bind('#downloadPaidLiveResult', 'click', downloadPaidLiveResult);
  if (game.phase === 'complete') {
    refreshLiveResultPreview();
    if (state.checkoutResult === 'success' && state.checkoutSessionId && !state.checkoutStatusBusy
      && state.checkoutStatusAttempts === 0) refreshLiveCheckoutStatus();
  }
}

function liveCheckoutHtml(game) {
  const price = Number(game.resultImagePrice) || 0;
  const status = state.checkoutStatus;
  let returnMessage = '';
  if (state.checkoutResult === 'cancelled') returnMessage = '<div class="notice">決済はキャンセルされました。請求は確定していません。</div>';
  if (state.checkoutResult === 'success' && !status) returnMessage = '<div class="notice">決済結果を確認しています。この画面を閉じずにお待ちください。</div>';
  if (status?.status === 'paid') {
    returnMessage = status.productType === 'result_image'
      ? `<div class="notice schedule-ok"><strong>購入が完了しました。</strong><br>高画質結果画像は購入日から30日間ダウンロードできます。</div><button class="secondary" id="downloadPaidLiveResult" type="button">高画質結果画像をダウンロード</button>`
      : '<div class="notice schedule-ok"><strong>応援ありがとうございます。</strong><br>決済が完了しました。</div>';
  } else if (status && ['payment_failed', 'checkout_failed'].includes(status.status)) {
    returnMessage = '<div class="error">決済を完了できませんでした。カード情報を確認して、もう一度お試しください。</div>';
  } else if (status && ['refunded', 'refund_pending', 'refund_processing', 'fraud_review'].includes(status.status)) {
    returnMessage = '<div class="notice">この決済は返金・確認処理中または返金済みのため、ダウンロードできません。</div>';
  } else if (status) {
    returnMessage = '<div class="notice">Stripeから決済完了通知を確認しています。反映されない場合は少し待ってから画面を更新してください。</div>';
  }
  if (!game.paidSalesEnabled) {
    return `<div class="live-checkout-panel">${returnMessage}<div class="notice">このLIVEでは有料販売の本人確認・契約・Stripe審査が完了していないため、購入と応援は受け付けていません。</div></div>`;
  }
  return `<div class="live-checkout-panel">
    ${returnMessage}
    <button class="primary" id="buyLiveResultImage" type="button" ${state.checkoutBusy || !price ? 'disabled' : ''}>${state.checkoutBusy ? 'Stripeへ接続中…' : `${price.toLocaleString('ja-JP')}円で高画質版を購入`}</button>
    <button class="mini live-support-toggle" id="toggleLiveSupport" type="button" ${state.checkoutBusy ? 'disabled' : ''}>♡ 応援する</button>
    ${state.supportPanelOpen ? `<div class="live-support-amounts"><strong>応援金額を選ぶ</strong>${(game.supportAmounts || []).map((amount) => `<button class="mini" data-live-support-amount="${amount}" type="button">${Number(amount).toLocaleString('ja-JP')}円</button>`).join('')}<p class="help">応援メッセージは初期版では公開されません。</p></div>` : ''}
  </div>`;
}

async function startLiveCheckout(productType, amount = null) {
  if (state.checkoutBusy || !state.game) return;
  state.checkoutBusy = true;
  state.error = '';
  render();
  try {
    const requestId = randomCheckoutRequestId();
    const response = await api(`/api/live/games/${state.roomCode}/checkout`, {
      method: 'POST',
      headers: { ...participantHeaders(), 'x-live-checkout-request': requestId },
      body: JSON.stringify({
        productType,
        amount,
        viewerName: state.resultViewerName || state.game.participantName || '視聴者',
      }),
    });
    if (!/^https:\/\/checkout\.stripe\.com\//.test(response.checkoutUrl || '')) throw new Error('stripe-checkout-response-invalid');
    location.assign(response.checkoutUrl);
  } catch (error) {
    state.checkoutBusy = false;
    state.error = humanError(error);
    render();
  }
}

async function refreshLiveCheckoutStatus() {
  if (state.checkoutStatusBusy || !state.checkoutSessionId) return;
  state.checkoutStatusBusy = true;
  try {
    const response = await api(`/api/live/checkouts/${encodeURIComponent(state.checkoutSessionId)}`, { headers: participantHeaders() });
    state.checkoutStatus = response;
    state.checkoutEntitlementUrl = response.entitlementUrl || '';
    state.checkoutStatusAttempts += 1;
    state.checkoutStatusBusy = false;
    render();
    if (!['paid', 'refunded', 'payment_failed', 'refund_failed'].includes(response.status)
      && state.checkoutStatusAttempts < 10) setTimeout(refreshLiveCheckoutStatus, 1500);
  } catch (error) {
    state.checkoutStatusBusy = false;
    state.checkoutStatusAttempts += 1;
    if (error.status === 404 && state.checkoutStatusAttempts < 10) {
      setTimeout(refreshLiveCheckoutStatus, 1500);
      return;
    }
    state.error = humanError(error);
    render();
  }
}

async function downloadPaidLiveResult() {
  if (!state.checkoutEntitlementUrl) return;
  try {
    const entitlement = await api(state.checkoutEntitlementUrl);
    location.assign(entitlement.downloadUrl);
  } catch (error) {
    state.error = humanError(error);
    render();
  }
}

function randomCheckoutRequestId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function liveResultShareContent() {
  const game = state.game || {};
  const viewerName = String(state.resultViewerName || game.participantName || '視聴者').trim().slice(0, 24) || '視聴者';
  const correctCount = (game.results || []).filter((result) => (
    result.type === 'guess-person' ? result.myIsCorrect === true : result.myVoteWasPopular === true
  )).length;
  const total = Number(game.questionCount) || game.results?.length || 0;
  const channelName = game.channelName || game.subjectName || 'YouTubeチャンネル';
  const text = `${channelName}の「私のこと、ちゃんと分かってるよねLIVE」に参加！\n${viewerName}は${correctCount}/${total}問正解でした。\n\nみんなは何問当たる？👇\n#わたちゃん #視聴者参加型LIVE`;
  return {
    text,
    url: `${location.origin}/live`,
    filename: `watachan-live-result-${correctCount}-${total}.svg`,
    title: `${channelName} LIVE結果`,
  };
}

function shareLiveResultX() {
  const { text, url } = liveResultShareContent();
  openXShare(`${text}\n${url}`);
}

function shareLiveResultLine() {
  const { text, url } = liveResultShareContent();
  openLineShare(`${text}\n${url}`);
}

async function shareLiveResultImage() {
  if (state.resultShareBusy || !state.game) return;
  const button = document.getElementById('shareLiveResultImage');
  const status = document.getElementById('resultShareStatus');
  const originalText = button?.textContent || '結果画像を保存／送る';
  state.resultShareBusy = true;
  if (button) {
    button.disabled = true;
    button.textContent = '画像を準備中…';
  }
  if (status) status.textContent = '';
  try {
    const viewerName = state.resultViewerName || state.game.participantName || '視聴者';
    const src = await createLiveResultPreview(state.game, viewerName);
    const details = liveResultShareContent();
    let result;
    try {
      result = await sharePreparedImage({ src, ...details });
    } finally {
      URL.revokeObjectURL(src);
    }
    if (status) status.textContent = result === 'downloaded' ? '結果画像を保存しました。' : '共有・保存画面を開きました。';
  } catch (error) {
    if (error?.name !== 'AbortError' && status) status.textContent = '画像を準備できませんでした。もう一度お試しください。';
  } finally {
    state.resultShareBusy = false;
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

async function refreshLiveResultPreview() {
  const preview = document.getElementById('liveResultPreview');
  const status = document.getElementById('resultImageStatus');
  if (!preview || !status || !state.game) return;
  status.textContent = 'プレビューを作成しています…';
  try {
    const viewerName = state.resultViewerName || state.game.participantName || '視聴者';
    const nextUrl = await createLiveResultPreview(state.game, viewerName);
    if (state.resultPreviewUrl) URL.revokeObjectURL(state.resultPreviewUrl);
    state.resultPreviewUrl = nextUrl;
    preview.src = nextUrl;
    preview.dataset.viewerName = viewerName;
    preview.dataset.channelName = state.game.channelName || state.game.subjectName || '';
    preview.dataset.liveDate = formatLiveDate(state.game.scheduledAt, false);
    preview.hidden = false;
    status.textContent = '画像に入る内容を確認してください。名前は上の欄で変更できます。';
  } catch (error) {
    preview.hidden = true;
    status.textContent = 'プレビューを作成できませんでした。画面を更新して再度お試しください。';
  }
}

async function createLiveResultPreview(game, viewerName) {
  const response = await fetch(`/api/live/games/${state.roomCode}/result-preview?name=${encodeURIComponent(String(viewerName || '').slice(0, 24))}`, {
    headers: participantHeaders(),
    cache: 'no-store',
  });
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    const error = new Error(json.error || 'result-preview-failed');
    error.status = response.status;
    throw error;
  }
  return URL.createObjectURL(await response.blob());
}

function liveQuestionHeader(game, stage = '') {
  return `<div class="progress">${stage ? `${escapeHtml(stage)} · ` : ''}Q${game.currentQuestionIndex + 1} / ${game.questionCount} · ${escapeHtml(LIVE_TYPE_LABELS[game.question.type] || '')}</div><h2>${escapeHtml(game.question.text)}</h2>`;
}

function participantHtml(game) {
  const omitted = Math.max(0, Number(game.participantCount || 0) - Number(game.participants?.length || 0));
  return `<h3 style="margin-top:18px">参加者 ${game.participantCount} / ${game.participantLimit || LIVE_VIEWER_LIMIT}人</h3><div class="participant-chips">${game.participants.map((participant) => `<span>${escapeHtml(participant.name)}</span>`).join('') || '<span>参加待ち</span>'}${omitted ? `<span>ほか${omitted}人</span>` : ''}</div>`;
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
  if (state.realtimeConnected && state.realtimeSocket?.readyState === WebSocket.OPEN) {
    state.votePending = true;
    state.error = '';
    state.realtimeSocket.send(JSON.stringify({
      type: 'vote',
      questionId: state.game.question.id,
      optionIndex,
    }));
    render();
    return;
  }
  try {
    const response = await api(`/api/live/games/${state.roomCode}/vote`, {
      method: 'POST', headers: participantHeaders(),
      body: JSON.stringify({ questionId: state.game.question.id, optionIndex }),
    });
    state.game = response.game;
    rememberParticipantAnswer(state.game.question?.id, optionIndex);
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
  if (state.view === 'host' && state.hostToken && !response.game?.host) {
    sessionStorage.removeItem(`live:host:${state.roomCode}`);
    state.hostToken = '';
    state.view = state.participantToken ? 'participant' : 'join';
  }
  if (state.view === 'subject' && state.subjectToken && !response.game?.subject) {
    sessionStorage.removeItem(`live:subject:${state.roomCode}`);
    state.subjectToken = '';
    state.view = state.participantToken ? 'participant' : 'join';
  }
  if (['complete', 'cancelled', 'terminated'].includes(response.game?.phase)) {
    clearInterval(state.pollTimer);
    closeRealtimeSocket();
  }
  if (state.participantToken && !state.resultViewerName && response.game?.participantName) {
    state.resultViewerName = response.game.participantName;
  }
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
  if (state.view === 'participant' && state.game?.realtime && state.participantToken) connectRealtimeSocket();
  state.pollTimer = setInterval(async () => {
    if (!['host', 'subject', 'participant'].includes(state.view)) return;
    if (state.view === 'participant' && state.realtimeConnected) return;
    try { await loadRoom(); render(); } catch (error) { /* 次のポーリングで再試行 */ }
  }, LIVE_POLL_INTERVAL_MS);
}

function connectRealtimeSocket() {
  if (!state.game?.realtime || !state.participantToken || ['complete', 'cancelled', 'terminated'].includes(state.game?.phase)) return;
  if ([WebSocket.OPEN, WebSocket.CONNECTING].includes(state.realtimeSocket?.readyState)) return;
  clearTimeout(state.realtimeReconnectTimer);
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${location.host}/api/live/games/${state.roomCode}/socket`, ['live-v1', state.participantToken]);
  state.realtimeSocket = socket;
  socket.addEventListener('open', () => {
    if (state.realtimeSocket !== socket) return;
    state.realtimeConnected = true;
  });
  socket.addEventListener('message', (event) => {
    if (state.realtimeSocket !== socket) return;
    let message;
    try { message = JSON.parse(event.data); } catch (error) { return; }
    if ((message.type === 'ready' || message.type === 'state') && message.game) {
      if (message.answers && typeof message.answers === 'object') {
        state.participantAnswers = message.answers;
        saveParticipantAnswers();
      }
      state.game = personalizeRealtimeState(
        message.game,
        state.participantAnswers,
        message.participantName || state.resultViewerName,
      );
      state.votePending = false;
      if (['complete', 'cancelled', 'terminated'].includes(state.game.phase)) {
        clearInterval(state.pollTimer);
        closeRealtimeSocket();
      }
      render();
      return;
    }
    if (message.type === 'vote-accepted') {
      state.votePending = false;
      rememberParticipantAnswer(message.questionId, Number(message.optionIndex));
      if (state.game?.question?.id === message.questionId) state.game.myVoteIndex = Number(message.optionIndex);
      state.error = '';
      render();
      return;
    }
    if (message.type === 'vote-rejected') {
      state.votePending = false;
      state.error = humanError(new Error(message.error || 'live-vote-error'));
      render();
    }
  });
  socket.addEventListener('close', () => {
    if (state.realtimeSocket !== socket) return;
    state.realtimeSocket = null;
    state.realtimeConnected = false;
    state.votePending = false;
    if (state.view === 'participant' && !['complete', 'cancelled', 'terminated'].includes(state.game?.phase)) {
      state.realtimeReconnectTimer = setTimeout(connectRealtimeSocket, 1_000 + Math.floor(Math.random() * 2_000));
    }
  });
  socket.addEventListener('error', () => socket.close());
}

function closeRealtimeSocket() {
  clearTimeout(state.realtimeReconnectTimer);
  state.realtimeReconnectTimer = null;
  const socket = state.realtimeSocket;
  state.realtimeSocket = null;
  state.realtimeConnected = false;
  if (socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(socket.readyState)) socket.close(1000, 'complete');
}

function rememberParticipantAnswer(questionId, optionIndex) {
  if (!questionId || !Number.isInteger(optionIndex)) return;
  state.participantAnswers = { ...state.participantAnswers, [questionId]: optionIndex };
  saveParticipantAnswers();
}

function saveParticipantAnswers() {
  if (!state.roomCode) return;
  sessionStorage.setItem(`live:answers:${state.roomCode}`, JSON.stringify(state.participantAnswers || {}));
}

function readParticipantAnswers(roomCode) {
  try {
    const value = JSON.parse(sessionStorage.getItem(`live:answers:${roomCode}`) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch (error) {
    return {};
  }
}

function personalizeRealtimeState(game, answers, participantName) {
  const questionId = game?.question?.id;
  const hasCurrentAnswer = questionId && Object.prototype.hasOwnProperty.call(answers || {}, questionId);
  const personalized = {
    ...game,
    participantName: participantName || game.participantName,
    myVoteIndex: hasCurrentAnswer ? Number(answers[questionId]) : null,
  };
  if (game.question) {
    personalized.question = {
      ...game.question,
      result: game.question.result ? personalizeRealtimeResult(game.question.result, answers) : game.question.result,
    };
  }
  if (Array.isArray(game.results)) {
    personalized.results = game.results.map((result) => personalizeRealtimeResult(result, answers));
  }
  return personalized;
}

function personalizeRealtimeResult(result, answers) {
  const hasVote = Object.prototype.hasOwnProperty.call(answers || {}, result.questionId);
  const myVoteIndex = hasVote ? Number(answers[result.questionId]) : null;
  if (result.type === 'guess-person') {
    return { ...result, myVoteIndex, myIsCorrect: hasVote ? myVoteIndex === result.subjectAnswerIndex : null };
  }
  if (result.type === 'guess-majority') {
    return { ...result, myVoteIndex, myVoteWasPopular: hasVote ? result.popularIndices.includes(myVoteIndex) : null };
  }
  return { ...result, myVoteIndex };
}

function setPage(content, withTopbar = true) {
  const status = state.systemStatus || {};
  const statusBanner = status.mode !== 'normal'
    ? `<section class="system-status ${status.mode}" role="status"><strong>${escapeHtml(status.title || 'LIVEサービスからのお知らせ')}</strong><span>${escapeHtml(status.message || '')}</span></section>`
    : '';
  root.innerHTML = `<div class="shell">${withTopbar ? `<header class="topbar"><a class="brand" href="/live">${escapeHtml(LIVE_SERIES.name)}</a><a class="back" href="/">トップへ</a></header>` : ''}${statusBanner}${content}</div>`;
}

function terminatedLiveHtml(game) {
  return `<section class="panel"><span class="eyebrow">LIVE CLOSED</span><h2 style="margin-top:12px">このLIVEは運営により終了しました</h2><div class="error" role="alert">${escapeHtml(game.terminationMessage || '運営上の理由により、このLIVEは終了しました。')}</div><a class="primary" style="display:grid;place-items:center;margin-top:16px;text-decoration:none" href="/live">LIVEトップへ</a></section>`;
}

function cancelledLiveHtml(game) {
  return `<section class="panel"><span class="eyebrow">RESERVATION CANCELLED</span><h2 style="margin-top:12px">このLIVE予約はキャンセルされました</h2><div class="notice" role="status">${escapeHtml(game.cancellationMessage || 'スタッフにより、このLIVE予約はキャンセルされました。')}</div><p class="help">このルームでは参加・回答できません。新しい開催案内がある場合は、配信者から共有されたURLをご確認ください。</p><a class="primary" style="display:grid;place-items:center;margin-top:16px;text-decoration:none" href="/live">LIVEトップへ</a></section>`;
}

function typeSelect(value, field, disabled = false) {
  return `<select data-field="${field}" ${disabled ? 'disabled' : ''}>${LIVE_QUESTION_TYPES.map((type) => `<option value="${type.value}" ${value === type.value ? 'selected' : ''}>${escapeHtml(type.label)}</option>`).join('')}</select>`;
}

function isCreatorInviteReady() { return /^[a-f0-9]{64}$/i.test(state.creatorInvite || ''); }
function creatorInviteHeaders() { return isCreatorInviteReady() ? { 'x-live-creator-invite': state.creatorInvite } : {}; }
function hostHeaders() { return { 'x-live-host-token': state.hostToken, ...creatorInviteHeaders() }; }
function subjectHeaders() { return { 'x-live-subject-token': state.subjectToken }; }
function participantHeaders() { return { 'x-live-participant-token': state.participantToken }; }
function verificationHeaders() { return { 'x-live-verification-token': state.channelVerificationToken }; }

async function api(path, options = {}) {
  const contentHeaders = options.body instanceof FormData ? {} : { 'content-type': 'application/json' };
  const response = await fetch(path, {
    ...options,
    headers: { ...contentHeaders, ...(options.headers || {}) },
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
    'youtube-channel-not-found': 'YouTube公式APIでこのチャンネルを確認できませんでした。@handleまたはチャンネルID形式のURLをお試しください',
    'youtube-channel-url-ambiguous': 'この旧形式URLはチャンネルを一意に特定できません。@handleまたはチャンネルID形式のURLを入力してください',
    'youtube-api-not-configured': 'YouTube公式APIの設定が未完了です。運営者がAPIキーを設定するまで問題を生成できません',
    'youtube-api-quota-exceeded': 'YouTube公式APIの本日の利用上限に達しました。時間を置いてお試しください',
    'youtube-api-request-failed': 'YouTube公式APIから情報を取得できませんでした。URLを確認して再度お試しください',
    'verification-forbidden': 'チャンネル確認URLが無効です。発行したスタッフへ確認してください',
    'verification-not-found': 'チャンネル確認手続きが見つかりません。発行したスタッフへ確認してください',
    'verification-already-verified': 'このチャンネルの所有確認は完了しています',
    'verification-rejected': 'この確認申請は運営により却下されています。スタッフから新しい確認URLを受け取ってください',
    'channel-ownership-required': '収益分配契約へ同意する前に、チャンネル所有確認を完了してください',
    'stripe-account-registration-required': 'Stripe Connect振込先の登録後に収益分配契約へ同意できます',
    'creator-terms-stale': '規約が更新されています。画面を再読み込みして最新の規約を確認してください',
    'contracting-name-required': '契約者名を入力してください',
    'contract-contact-email-required': '有効な契約連絡先メールアドレスを入力してください',
    'creator-agreement-confirmation-required': '3つの確認事項すべてへの同意が必要です',
    'paid-channel-verification-required': 'このLIVEは有料販売の本人確認・契約・Stripe審査が完了していません',
    'result-image-not-for-sale': 'このLIVEでは高画質結果画像を販売していません',
    'invalid-support-amount': '応援金額を選び直してください',
    'stripe-secret-key-not-configured': '決済の本番設定が完了していません。運営へお問い合わせください',
    'live-checkout-not-configured': '決済・購入画像の本番設定が完了していません。運営へお問い合わせください',
    'stripe-api-request-failed': 'Stripeへ接続できませんでした。時間を置いてもう一度お試しください',
    'stripe-checkout-response-invalid': 'Stripe決済画面を開けませんでした。もう一度お試しください',
    'checkout-not-found': '決済情報を確認できませんでした。画面を更新して再度お試しください',
    'checkout-request-conflict': '決済操作が重複しました。画面を更新してもう一度お試しください',
    'checkout-forbidden': 'この端末では決済結果を確認できません',
    'purchase-access-signing-not-configured': '購入画像の受け取り設定が完了していません。運営へお問い合わせください',
    'youtube-confirmation-code-not-found': 'チャンネル概要欄に確認コードが見つかりません。公開反映を確認してから再度お試しください',
    'youtube-oauth-not-configured': 'YouTubeアカウント確認の本番設定が未完了です。概要欄コードまたは手動審査をご利用ください',
    'youtube-oauth-callback-invalid': 'Googleからの確認結果が不完全です。もう一度お試しください',
    'youtube-oauth-state-invalid': '確認の有効時間を過ぎました。元の画面からもう一度お試しください',
    'youtube-oauth-token-failed': 'Googleアカウントの確認に失敗しました。もう一度お試しください',
    'youtube-channel-not-owned': 'このGoogleアカウントでは対象チャンネルの所有を確認できませんでした',
    'youtube-creation-required': 'LIVEゲームはYouTubeチャンネルから作成してください',
    'creator-invite-required': '初期版は招待制です。運営から発行された招待コードを入力してください',
    'creator-invite-invalid': '招待コードが無効・期限切れ・別チャンネル用です。運営へ確認してください',
    'creator-invite-storage-required': '招待確認用データベースが未設定です。運営へ連絡してください',
    'invalid-scheduled-at': '現在より後のライブ配信日時を選んでください',
    'scheduled-at-too-far': '予約できるのは現在から365日以内です',
    'live-slot-unavailable': `選んだ日時の前後${LIVE_RESERVATION_BUFFER_HOURS}時間以内に別の予約があります。別の日時を選んでください`,
    'reservation-change-closed': '予約の変更・キャンセル・URL再発行はライブ開始前だけ行えます',
    'reservation-not-found': '予約枠が見つかりません。画面を更新してからもう一度お試しください',
    'rotation-target-required': '再発行するURLを選んでください',
    'another-live-active': '別のYouTube LIVEが進行中です。終了後にもう一度お試しください',
    'participant-limit-reached': `参加上限の${Number(state.game?.participantLimit || LIVE_VIEWER_LIMIT).toLocaleString('ja-JP')}人に達したため、このルームには参加できません`,
    'invalid-creator-image': 'YouTuber画像はJPEG・PNG・WebP形式で選んでください',
    'creator-image-too-large': '画像を圧縮できませんでした。10MB以下の別画像を選んでください',
    'creator-image-dimensions-too-large': '画像の縦横サイズが大きすぎます。縦横12,000px以下の別画像を選んでください',
    'creator-image-transform-failed': '画像の安全な変換に失敗しました。別のJPEG・PNG・WebP画像を選んでください',
    'creator-image-storage-failed': '非公開画像ストレージへの保存に失敗しました。時間をおいて再度お試しください',
    'result-image-storage-failed': '高画質結果画像の保存に失敗しました。決済状況を確認して運営へお問い合わせください',
    'live-media-not-configured': '非公開画像ストレージの設定が未完了です。画像を外すか、運営者がR2・Imagesを設定してから保存してください',
    'room-not-found': 'ルームが見つかりません。コードを確認してください',
    'name-required': '名前を入力してください',
    'participant-name-not-allowed': 'この参加者名は利用できません。人を傷つけない別の名前を入力してください',
    'game-finished': 'このゲームは終了しています',
    'game-cancelled': 'このLIVE予約はキャンセルされています',
    'game-terminated': 'このLIVEは運営により終了しました',
    'live-maintenance': '現在、LIVEサービスはメンテナンス中です。お知らせをご確認ください',
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
