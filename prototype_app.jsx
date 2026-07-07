// 私のこと、ちゃんと分かってるよね? — インタラクティブプロトタイプ
// パッケージDNA版: ホットピンク + 黒 + シアン縁取り + イエローシール
// フロー: top → intro → play(同時発表式) → result → share/replay
// プレイの中身は変えず、ラッパーのビジュアル言語をパッケージに寄せる

const proto = {
  // パッケージから抽出したコアパレット
  pink:       '#EC4F88',  // メインピンク (パッケージ背景と同じ)
  pinkDeep:   '#D63A75',  // 一段濃いピンク (ボタン pressed、シャドウ)
  pinkSoft:   '#FFE4EE',  // 薄いピンク (背景のアクセント)
  cyan:       '#5BD4E8',  // タイトル縁取りのシアン
  yellow:     '#FFE26B',  // 注意書きシールの黄色
  yellowDark: '#F0C800',
  black:      '#1A1A1A',  // 黒 (キャラの服、文字)
  white:      '#FFFFFF',
  cream:      '#FFF8F1',  // 安全な背景
  text:       '#1A1A1A',
  textSoft:   '#7A6A6F',

  // タイポグラフィ
  display:    '"RocknRoll One", "Zen Maru Gothic", "Klee One", sans-serif',
  body:       '"Zen Maru Gothic", "Noto Sans JP", sans-serif',
  caption:    '"DotGothic16", monospace',
  handwrite:  '"HuiFontP29", "HuiFontP109", "HuiFont", "ふい字", "Yomogi", "Klee One", "Zen Maru Gothic", sans-serif',

  // シャドウ
  shadow:     '0 8px 24px rgba(236,79,136,0.25)',
  shadowSoft: '0 4px 12px rgba(236,79,136,0.15)',
  shadowHard: '4px 4px 0 #1A1A1A',
};

const { useState, useEffect, useMemo } = React;

// localStorage
const LS_KEY = 'sbg_quiz_state_v3'; // v3: パケDNA版
const RESUME_LS_KEY = 'sbg_resume_state_v1';
const ROUND_SIZE = 5;
const FRIEND_ROUND_SIZE = 5;
const FAMILY_ROUND_SIZE = 5;
const AMAZON_URL = 'https://www.amazon.co.jp/dp/B0G87M4ZYK';
const COLOR_LABELS = ['緑', '青', '黄', '赤', '橙'];
const RESULT_IMAGE_VERSION = 'results-20260707-2';
const HANDOFF_DELAY_MS = 600;
const FINAL_HANDOFF_DELAY_MS = 1000;
const LOVE_RETURN_DELAY_MS = 1300;
function normalizeFriendPlayerCount(value) {
  const n = Number(value);
  return [2, 3, 4].includes(n) ? n : 2;
}
function loadState() {
  try { return normalizeSavedState(JSON.parse(localStorage.getItem(LS_KEY) || 'null')); } catch (e) { return null; }
}
function saveState(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) {}
}
function loadResumeState() {
  try { return normalizeSavedState(JSON.parse(localStorage.getItem(RESUME_LS_KEY) || 'null')); } catch (e) { return null; }
}
function saveResumeState(s) {
  try { localStorage.setItem(RESUME_LS_KEY, JSON.stringify(s)); } catch (e) {}
}
function clearResumeState() {
  try { localStorage.removeItem(RESUME_LS_KEY); } catch (e) {}
}

function getResumeLabel(state) {
  if (!state || !state.cards || !state.cards.length) return '';
  const names = {
    play: '彼氏の愛情判定',
    friendPlay: '友達の友情判定',
    familyPlay: '家族の絆判定',
  };
  const gameName = names[state.screen] || '前回のゲーム';
  const done = Math.min(state.answers ? state.answers.length : 0, state.cards.length);
  const next = Math.min(done + 1, state.cards.length);
  return `${gameName}・${state.cards.length}問中${next}問目から`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function fetchImageBlob(src) {
  const res = await fetch(src, src && src.startsWith('data:') ? undefined : { cache: 'force-cache' });
  if (!res.ok) throw new Error('image-fetch-failed');
  return await res.blob();
}

function shouldUseNativeShare() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isMobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const hasCoarsePointer = typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(pointer: coarse)').matches;
  return Boolean(navigator.share && (isMobileUa || hasCoarsePointer));
}

async function sharePreparedImage({ src, filename, title, text, url }) {
  const blob = await fetchImageBlob(src);
  const file = new File([blob], filename, { type: 'image/png' });
  if (!shouldUseNativeShare()) {
    downloadBlob(blob, filename);
    return 'downloaded';
  }
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ title, text, url, files: [file] });
    return 'shared';
  }
  if (navigator.share) {
    await navigator.share({ title, text, url });
    downloadBlob(blob, filename);
    return 'shared-download';
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

async function savePreparedImage({ src, filename, title }) {
  const blob = await fetchImageBlob(src);
  const file = new File([blob], filename, { type: 'image/png' });
  if (shouldUseNativeShare() && navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ title, files: [file] });
    return 'shared-save-sheet';
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

function getImageActionMessage(result) {
  if (result === 'downloaded') return '画像を保存しました';
  if (result === 'shared') return 'シェアが完了しました';
  if (result === 'shared-download') return 'シェア画面を開き、画像も保存しました';
  if (result === 'shared-save-sheet') return '保存・共有の画面を開きました';
  return '保存・シェアが完了しました';
}

function showTemporaryStatus(setStatus, message, ms = 2800) {
  setStatus(message);
  setTimeout(() => setStatus(''), ms);
}

function canShareImageFile(filename = 'result.png') {
  try {
    if (!shouldUseNativeShare() || !navigator.canShare || !window.File) return false;
    const file = new File(['x'], filename, { type: 'image/png' });
    return navigator.canShare({ files: [file] });
  } catch (e) {
    return false;
  }
}

function getLoveResultImageSrc(score) {
  const safeScore = Math.max(0, Math.min(5, Number(score) || 0));
  return `/assets/results/love-${safeScore}.png`;
}

function getPreparedResultImageSrc(kind, score) {
  const safeKind = ['love', 'friend', 'family'].includes(kind) ? kind : 'love';
  const safeScore = Math.max(0, Math.min(5, Number(score) || 0));
  return `/assets/results/${safeKind}-${safeScore}.png?v=${RESULT_IMAGE_VERSION}`;
}

function preloadPreparedResultImages(kind) {
  const safeKind = ['love', 'friend', 'family'].includes(kind) ? kind : 'love';
  const key = `__watachan_${safeKind}_results_preloaded`;
  if (window[key]) return;
  window[key] = true;
  for (let i = 0; i <= 5; i += 1) {
    const img = new Image();
    img.src = getPreparedResultImageSrc(safeKind, i);
  }
}

function getQuestionHitScore(answers) {
  return answers.reduce((sum, answer) => sum + (answer.matches && answer.matches.some(Boolean) ? 1 : 0), 0);
}

function normalizeSavedState(s) {
  const screens = ['top', 'intro', 'play', 'resultReady', 'result', 'friendIntro', 'friendPlay', 'friendResultReady', 'friendResult', 'familyIntro', 'familyPlay', 'familyResultReady', 'familyResult', 'about', 'product'];
  if (!s || !screens.includes(s.screen)) return null;

  const cards = Array.isArray(s.cards) ? s.cards : [];
  const answers = Array.isArray(s.answers) ? s.answers : [];
  const qIdx = Number.isInteger(s.qIdx) ? s.qIdx : 0;
  const playerCount = normalizeFriendPlayerCount(s.playerCount);

  if (s.screen === 'play') {
    if (!cards.length || qIdx < 0 || qIdx >= cards.length) return null;
    return { screen: 'play', qIdx, answers: answers.slice(0, qIdx), cards };
  }

  if (s.screen === 'resultReady' || s.screen === 'result') {
    if (!cards.length || !answers.length) return null;
    return { screen: s.screen, qIdx: 0, answers, cards };
  }

  if (s.screen === 'friendPlay') {
    if (!cards.length || qIdx < 0 || qIdx >= cards.length) return null;
    return { screen: 'friendPlay', qIdx, answers: answers.slice(0, qIdx), cards, playerCount };
  }

  if (s.screen === 'friendResultReady' || s.screen === 'friendResult') {
    if (!cards.length || !answers.length) return null;
    return { screen: s.screen, qIdx: 0, answers, cards, playerCount };
  }

  if (s.screen === 'familyPlay') {
    if (!cards.length || qIdx < 0 || qIdx >= cards.length) return null;
    return { screen: 'familyPlay', qIdx, answers: answers.slice(0, qIdx), cards, playerCount };
  }

  if (s.screen === 'familyResultReady' || s.screen === 'familyResult') {
    if (!cards.length || !answers.length) return null;
    return { screen: s.screen, qIdx: 0, answers, cards, playerCount };
  }

  return { screen: s.screen, qIdx: 0, answers: [], cards: [], playerCount };
}

// ─────────────────────────────────────────────────────
// 共通装飾: シアン縁取りロゴテキスト
// ─────────────────────────────────────────────────────
function LogoText({ children, size = 32, color = '#FFFFFF', outline = '#5BD4E8', lineHeight = 1.15 }) {
  // 多重 text-shadow でシアンの太い縁取りを再現
  const s = Math.max(2, Math.round(size / 12));
  const shadows = [];
  // 8方向 + 中間でくっきり縁取り
  for (let dx = -s; dx <= s; dx++) {
    for (let dy = -s; dy <= s; dy++) {
      if (dx === 0 && dy === 0) continue;
      shadows.push(`${dx}px ${dy}px 0 ${outline}`);
    }
  }
  // 黒のドロップシャドウで奥行き
  shadows.push(`${s + 1}px ${s + 2}px 0 rgba(0,0,0,0.18)`);
  return (
    <div style={{
      fontFamily: proto.display,
      fontWeight: 900,
      fontSize: size,
      color,
      lineHeight,
      letterSpacing: '0.01em',
      textShadow: shadows.join(', '),
      WebkitTextStroke: '0',
    }}>{children}</div>
  );
}

// ─────────────────────────────────────────────────────
// 共通装飾: 黄色シール(テープ留め風)
// ─────────────────────────────────────────────────────
function StickyNote({ children, rotate = -3, style = {}, size = 110 }) {
  return (
    <div style={{
      position: 'relative', display: 'inline-block',
      transform: `rotate(${rotate}deg)`,
      ...style,
    }}>
      {/* テープ */}
      <div style={{
        position: 'absolute', top: -8, left: '50%',
        transform: 'translateX(-50%) rotate(-5deg)',
        width: 28, height: 12,
        background: 'rgba(230,210,150,0.85)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
      }} />
      {/* 円形シール */}
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: proto.yellow,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: 8,
        fontFamily: proto.body, fontSize: size * 0.10,
        fontWeight: 700, color: proto.black, lineHeight: 1.45,
        boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
      }}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// 共通装飾: 細い白ピル枠 (サブタイトル用)
// ─────────────────────────────────────────────────────
function PillLabel({ children, dark = false }) {
  return (
    <div style={{
      display: 'inline-block',
      padding: '5px 16px',
      border: `1.5px solid ${dark ? proto.black : '#FFFFFF'}`,
      borderRadius: 999,
      color: dark ? proto.black : '#FFFFFF',
      fontSize: 11, fontWeight: 600, letterSpacing: '0.15em',
      fontFamily: proto.body,
    }}>{children}</div>
  );
}

// ─────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────
function App() {
  // 初期画面の決定優先度:
  //  1. URL からのリクエスト (旧Wix URLリダイレクト): window.__INITIAL_SCREEN
  //  2. localStorage の続き状態
  //  3. デフォルト 'top'
  // URL指定があった場合は localStorage より優先 (リンクから遷移したらそこに飛ぶのが自然)
  const urlScreen = (typeof window !== 'undefined' && window.__INITIAL_SCREEN) || null;
  const saved = loadState();
  const initial = urlScreen
    ? { screen: urlScreen, qIdx: 0, answers: [], cards: [] }
    : (saved || { screen: 'top', qIdx: 0, answers: [], cards: [] });
  // 使ったら消す (リロード時に二重発動しないように)
  if (typeof window !== 'undefined') window.__INITIAL_SCREEN = null;

  const [screen, setScreen] = useState(initial.screen);
  const [qIdx, setQIdx] = useState(initial.qIdx);
  const [answers, setAnswers] = useState(initial.answers);
  const [cards, setCards] = useState(initial.cards || []);
  const [playerCount, setPlayerCount] = useState(normalizeFriendPlayerCount(initial.playerCount));
  const [resumeState, setResumeState] = useState(() => loadResumeState());

  // contact 指定だった場合、About にしてからフォームへスクロール
  useEffect(() => {
    if (urlScreen === 'about' && window.__SCROLL_TO_CONTACT) {
      window.__SCROLL_TO_CONTACT = false;
      // About画面のレンダリングを待ってからスクロール (scrollIntoViewは使わず、
      // window.scrollTo で安全に)
      setTimeout(() => {
        const el = document.getElementById('contact-section');
        if (el) {
          const top = el.getBoundingClientRect().top + window.pageYOffset - 20;
          window.scrollTo({ top: top, behavior: 'smooth' });
        }
      }, 350);
    }
  }, []); // 初回マウントのみ

  useEffect(() => {
    saveState({ screen, qIdx, answers, cards, playerCount });
  }, [screen, qIdx, answers, cards, playerCount]);

  useEffect(() => {
    const playableScreens = ['play', 'friendPlay', 'familyPlay'];
    if (playableScreens.includes(screen) && cards.length > 0 && answers.length < cards.length) {
      const nextResume = { screen, qIdx, answers, cards, playerCount };
      setResumeState(nextResume);
      saveResumeState(nextResume);
    }
  }, [screen, qIdx, answers, cards, playerCount]);

  const startNewRound = () => {
    clearResumeState();
    setResumeState(null);
    const picked = window.pickRandomCards(ROUND_SIZE);
    setCards(picked);
    setQIdx(0);
    setAnswers([]);
    setScreen('play');
  };

  const startFriendRound = (count) => {
    clearResumeState();
    setResumeState(null);
    const picked = window.pickRandomFriendCards(FRIEND_ROUND_SIZE);
    setPlayerCount(normalizeFriendPlayerCount(count));
    setCards(picked);
    setQIdx(0);
    setAnswers([]);
    setScreen('friendPlay');
  };

  const startFamilyRound = (count) => {
    clearResumeState();
    setResumeState(null);
    const picked = window.pickRandomFamilyCards(FAMILY_ROUND_SIZE);
    setPlayerCount(normalizeFriendPlayerCount(count));
    setCards(picked);
    setQIdx(0);
    setAnswers([]);
    setScreen('familyPlay');
  };

  const backToTop = () => {
    setScreen('top'); setQIdx(0); setAnswers([]); setCards([]); setPlayerCount(2);
  };

  const resumeGame = () => {
    const savedResume = loadResumeState();
    if (!savedResume) return;
    setCards(savedResume.cards || []);
    setQIdx(savedResume.qIdx || 0);
    setAnswers(savedResume.answers || []);
    setPlayerCount(normalizeFriendPlayerCount(savedResume.playerCount));
    setScreen(savedResume.screen);
  };

  const confirmLeaveGame = (nextScreen) => {
    const ok = window.confirm('ゲームを中断して戻りますか？\nトップの「つづきから再開する」から再開できます。');
    if (ok) setScreen(nextScreen);
  };

  const handleQAnswer = (girlIdx, boyIdx) => {
    const next = [...answers, { girl: girlIdx, boy: boyIdx, match: girlIdx === boyIdx }];
    setAnswers(next);
    if (qIdx + 1 >= cards.length) {
      clearResumeState();
      setResumeState(null);
      setScreen('resultReady');
    } else {
      setQIdx(qIdx + 1);
    }
  };

  const handleFriendAnswer = (round) => {
    const next = [...answers, round];
    setAnswers(next);
    if (qIdx + 1 >= cards.length) {
      clearResumeState();
      setResumeState(null);
      setScreen('friendResultReady');
    } else {
      setQIdx(qIdx + 1);
    }
  };

  const handleFamilyAnswer = (round) => {
    const next = [...answers, round];
    setAnswers(next);
    if (qIdx + 1 >= cards.length) {
      clearResumeState();
      setResumeState(null);
      setScreen('familyResultReady');
    } else {
      setQIdx(qIdx + 1);
    }
  };

  const hasProgress = Boolean(resumeState && resumeState.cards && resumeState.cards.length && resumeState.answers.length < resumeState.cards.length);
  const resumeLabel = getResumeLabel(resumeState);

  return (
    <div style={{
      width: '100%', minHeight: '100dvh',
      background: proto.pink,
      display: 'flex', justifyContent: 'center',
      overflowX: 'hidden',
      fontFamily: proto.body,
    }}>
      <div style={{
        width: '100%', maxWidth: 480, minHeight: '100dvh',
        background: proto.pink,
        boxShadow: '0 0 60px rgba(0,0,0,0.15)',
        position: 'relative', overflowX: 'hidden',
      }}>
        {screen === 'top' && (
          <TopScreen
            onStart={() => setScreen('intro')}
            hasProgress={hasProgress}
            resumeLabel={resumeLabel}
            onResume={resumeGame}
            onFriend={() => setScreen('friendIntro')}
            onFamily={() => setScreen('familyIntro')}
            onAbout={() => setScreen('about')}
            onProduct={() => setScreen('product')}
          />
        )}
        {screen === 'intro' && (
          <IntroScreen onStart={startNewRound} onBack={() => setScreen('top')} />
        )}
        {screen === 'friendIntro' && (
          <FriendIntroScreen onStart={startFriendRound} onBack={() => setScreen('top')} />
        )}
        {screen === 'familyIntro' && (
          <FamilyIntroScreen onStart={startFamilyRound} onBack={() => setScreen('top')} />
        )}
        {screen === 'play' && cards.length > 0 && (
          <PlayScreen
            card={cards[qIdx]}
            qIdx={qIdx}
            total={cards.length}
            onAnswer={handleQAnswer}
            onBack={() => confirmLeaveGame('intro')}
          />
        )}
        {screen === 'friendPlay' && cards.length > 0 && (
          <FriendPlayScreen
            card={cards[qIdx]}
            qIdx={qIdx}
            total={cards.length}
            playerCount={playerCount}
            onAnswer={handleFriendAnswer}
            onBack={() => confirmLeaveGame('friendIntro')}
          />
        )}
        {screen === 'familyPlay' && cards.length > 0 && (
          <FamilyPlayScreen
            card={cards[qIdx]}
            qIdx={qIdx}
            total={cards.length}
            playerCount={playerCount}
            onAnswer={handleFamilyAnswer}
            onBack={() => confirmLeaveGame('familyIntro')}
          />
        )}
        {screen === 'resultReady' && (
          <ResultReadyScreen
            title="5問終了！"
            subtitle="答え合わせいくよ"
            detail="彼女の答えを、彼氏が何問当てられたか発表します。ふたりで一緒に見てね。"
            buttonLabel="答え合わせへ"
            onResult={() => setScreen('result')}
            onHome={backToTop}
          />
        )}
        {screen === 'result' && (
          <ResultScreen
            answers={answers}
            cards={cards}
            onReplay={startNewRound}
            onHome={backToTop}
            onAbout={() => setScreen('about')}
            onProduct={() => setScreen('product')}
          />
        )}
        {screen === 'friendResultReady' && (
          <ResultReadyScreen
            title="5問終了！"
            subtitle="答え合わせいくよ"
            detail="本人の答えを、友達が何問当てられたか発表します。みんなで一緒に見てね。"
            buttonLabel="答え合わせへ"
            onResult={() => setScreen('friendResult')}
            onHome={backToTop}
          />
        )}
        {screen === 'friendResult' && (
          <FriendResultScreen
            answers={answers}
            cards={cards}
            playerCount={playerCount}
            onReplay={() => startFriendRound(playerCount)}
            onHome={backToTop}
            onAbout={() => setScreen('about')}
          />
        )}
        {screen === 'familyResultReady' && (
          <ResultReadyScreen
            title="5問終了！"
            subtitle="答え合わせいくよ"
            detail="本人の答えを、家族が何問当てられたか発表します。みんなで一緒に見てね。"
            buttonLabel="答え合わせへ"
            onResult={() => setScreen('familyResult')}
            onHome={backToTop}
          />
        )}
        {screen === 'familyResult' && (
          <FamilyResultScreen
            answers={answers}
            cards={cards}
            playerCount={playerCount}
            onReplay={() => startFamilyRound(playerCount)}
            onHome={backToTop}
            onAbout={() => setScreen('about')}
          />
        )}
        {screen === 'about' && (
          <AboutScreen
            onBack={() => setScreen('top')}
            onLove={() => setScreen('intro')}
            onFriend={() => setScreen('friendIntro')}
            onFamily={() => setScreen('familyIntro')}
          />
        )}
        {screen === 'product' && <ProductScreen onBack={() => setScreen('top')} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// TOP — パッケージの構図を直接踏襲
// ・ピンク全面背景
// ・上部に白ピル「彼氏の愛情判定ゲーム」
// ・中央に巨大な白+シアン縁取りロゴ
// ・右下に黄色注意書きシール
// ─────────────────────────────────────────────────────
function TopScreen({ onStart, hasProgress, resumeLabel, onResume, onFriend, onFamily, onAbout, onProduct }) {
  return (
    <main aria-labelledby="site-title" style={{
      minHeight: '100vh',
      background: proto.pink,
      color: proto.white,
      paddingBottom: 40,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 背景ノイズ感 (薄いハート散らし) */}
      <Decor />
      <h1 id="site-title" style={srOnlyStyle()}>
        わたちゃん 彼氏の愛情判定ゲーム
      </h1>
      <p style={srOnlyStyle()}>
        彼氏が彼女の答えを予想して愛情理解度を判定する無料カップル診断ゲームです。シリーズとして友達の友情判定と家族の絆判定も公開中です。
      </p>

      <div style={{ padding: '50px 24px 24px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <PillLabel>彼氏の愛情判定ゲーム</PillLabel>

        <div style={{ marginTop: 28, marginBottom: 8 }}>
          <LogoText size={42}>私のこと、</LogoText>
          <div style={{ marginTop: 4 }}>
            <LogoText size={42}>ちゃんと</LogoText>
          </div>
          <div style={{ marginTop: 4 }}>
            <LogoText size={42}>分かってるよね？</LogoText>
          </div>
        </div>

        <div style={{
          marginTop: 14,
          fontFamily: proto.caption,
          fontSize: 10, color: proto.white, opacity: 0.85,
          letterSpacing: '0.25em',
        }}>STREET BOARD GAME / vol.01</div>
      </div>

      {/* ヒーローブロック: 全身の女の子 + カード3枚 */}
      <div style={{
        padding: '12px 12px 24px',
        position: 'relative', zIndex: 1,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}>
        {/* 女の子 (左、全身ポーズ) */}
        <div style={{
          flexShrink: 0,
          marginRight: -40,  // カードに重なる
          marginBottom: -12,
          position: 'relative', zIndex: 2,
          filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.2))',
        }}>
          <Girl variant="full" height={320} />
        </div>
        {/* カードスタック (右側) */}
        <div style={{ flex: 1, minWidth: 0, marginBottom: 24 }}>
          <CardStack />
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '0 24px', position: 'relative', zIndex: 1 }}>
        {hasProgress && (
          <button onClick={onResume} style={{
            ...secondaryBtn(),
            marginBottom: 14,
            background: proto.white,
            minHeight: 68,
            display: 'block',
            textAlign: 'center',
          }}>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 900 }}>つづきから再開する ↻</span>
            <span style={{
              display: 'block',
              marginTop: 4,
              fontSize: 10,
              color: proto.pinkDeep,
              fontWeight: 900,
              lineHeight: 1.3,
            }}>{resumeLabel || '途中で閉じても、前回のゲームを再開できます'}</span>
          </button>
        )}
        <button onClick={onStart} style={primaryBtn()}>
          彼氏の愛情を判定する
          <span style={{
            display: 'inline-block', marginLeft: 6,
            color: proto.yellow, fontSize: 18,
            textShadow: '1px 1px 0 #000',
          }}>▶</span>
        </button>
        <button onClick={onFriend} style={{
          ...secondaryBtn(),
          marginTop: 14,
          background: proto.yellow,
        }}>
          友達の友情を判定する
        </button>
        <button onClick={onFamily} style={{
          ...secondaryBtn(),
          marginTop: 14,
          background: proto.white,
        }}>
          家族の絆を判定する
        </button>
        <div style={{
          marginTop: 9,
          fontSize: 11,
          lineHeight: 1.55,
          textAlign: 'center',
          color: proto.white,
          opacity: 0.88,
          fontWeight: 700,
        }}>
          まずは彼氏の愛情判定から。友達版と家族版も公開中。
        </div>
      </div>

      {/* 注意書きシール */}
      <div style={{
        marginTop: 22, display: 'flex', justifyContent: 'center',
        position: 'relative', zIndex: 1,
      }}>
        <StickyNote rotate={-4} size={150}>
          <div style={{ fontSize: 11, lineHeight: 1.55, whiteSpace: 'nowrap' }}>
            このゲームを<br/>
            キッカケに<br/>
            別れても<br/>
            一切責任は<br/>
            <span style={{ color: proto.pinkDeep, fontWeight: 800 }}>負いません</span>
          </div>
        </StickyNote>
      </div>

      {/* シリーズ */}
      <div style={{ padding: '28px 24px 0', position: 'relative', zIndex: 1 }}>
        <div style={{
          fontFamily: proto.caption, fontSize: 10,
          color: proto.white, letterSpacing: '0.25em',
          marginBottom: 10, paddingLeft: 4,
        }}>MAIN GAME / SERIES ✦</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <SeriesCard emoji="💕" title="彼氏の愛情判定" status="公開中" onClick={onStart} />
          <SeriesCard emoji="👯" title="友達の友情判定" status="公開中" onClick={onFriend} />
          <SeriesCard emoji="👨‍👩‍👧" title="家族の絆判定" status="公開中" onClick={onFamily} />
        </div>
      </div>

      {/* フッターリンク */}
      <div style={{
        padding: '22px 24px 0', position: 'relative', zIndex: 1,
        display: 'flex', justifyContent: 'center', gap: 18,
      }}>
        <FooterLink onClick={onAbout}>About</FooterLink>
        <span style={{ color: proto.white, opacity: 0.4 }}>·</span>
        <FooterLink onClick={onProduct}>製品版</FooterLink>
      </div>
    </main>
  );
}

function FooterLink({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', border: 'none',
      color: proto.white, fontFamily: proto.caption,
      fontSize: 11, letterSpacing: '0.2em',
      textDecoration: 'underline',
      textDecorationColor: 'rgba(255,255,255,0.5)',
      textUnderlineOffset: 4, cursor: 'pointer',
    }}>{children}</button>
  );
}

// 背景装飾: 薄いハート散らし
function Decor() {
  const hearts = [
    { top: 60, left: 14, size: 14, opacity: 0.18 },
    { top: 120, right: 18, size: 10, opacity: 0.22 },
    { top: 220, left: 22, size: 8, opacity: 0.25 },
    { top: 360, right: 30, size: 12, opacity: 0.20 },
    { bottom: 80, left: 30, size: 10, opacity: 0.22 },
  ];
  return (
    <>
      {hearts.map((h, i) => (
        <div key={i} style={{
          position: 'absolute',
          ...h, color: proto.white,
          fontSize: h.size, pointerEvents: 'none',
        }}>♥</div>
      ))}
    </>
  );
}

// カード3枚スタック (お題カードビジュアルを暗示)
function CardStack() {
  // ランダムに3枚お題カードから引いてバラ撒く
  const stacks = [
    { rotate: -8, top: 10,  left: 30,  delay: 0,    z: 1, src: 'assets/cards/1.png' },
    { rotate: 4,  top: 0,   left: 100, delay: 0.1,  z: 3, src: 'assets/cards/20.png' },
    { rotate: -3, top: 18,  left: 170, delay: 0.2,  z: 2, src: 'assets/cards/15.png' },
  ];
  return (
    <div style={{
      position: 'relative', height: 200,
      display: 'flex', justifyContent: 'center',
    }}>
      {stacks.map((s, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: s.top, left: `calc(50% - 100px + ${s.left - 90}px)`,
          width: 110, height: 165,
          '--r': `${s.rotate}deg`,
          transform: 'rotate(var(--r))',
          zIndex: s.z,
          borderRadius: 8, overflow: 'hidden',
          boxShadow: '0 12px 24px rgba(0,0,0,0.25)',
          border: '3px solid #FFF',
          background: '#FFF',
          animation: `cardFloat 4s ${s.delay}s ease-in-out infinite`,
        }}>
          <img src={s.src} alt="" style={{
            width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top',
            display: 'block',
          }} />
        </div>
      ))}
      <style>{`
        @keyframes cardFloat {
          0%, 100% { transform: translateY(0) rotate(var(--r, 0deg)); }
          50% { transform: translateY(-4px) rotate(var(--r, 0deg)); }
        }
      `}</style>
    </div>
  );
}

function SeriesCard({ emoji, title, status = 'COMING SOON', onClick }) {
  const active = Boolean(onClick);
  const inner = (
    <>
      <div style={{ fontSize: 28, marginBottom: 4 }}>{emoji}</div>
      <div style={{
        fontFamily: proto.body, fontSize: 11, fontWeight: 700,
        color: proto.white,
      }}>{title}</div>
      <div style={{
        display: 'inline-block',
        fontFamily: proto.caption, fontSize: 9,
        color: active ? proto.black : proto.yellow,
        background: active ? proto.yellow : 'transparent',
        marginTop: 6,
        padding: active ? '3px 8px' : 0,
        borderRadius: 999,
        letterSpacing: '0.1em',
        fontWeight: 800,
      }}>{status}</div>
    </>
  );

  const style = {
    flex: '1 1 112px', padding: 12,
    background: active ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.15)',
    backdropFilter: 'blur(8px)',
    borderRadius: 14,
    border: active ? `2px solid ${proto.yellow}` : '1.5px dashed rgba(255,255,255,0.5)',
    textAlign: 'center',
    cursor: active ? 'pointer' : 'default',
    boxShadow: active ? '3px 3px 0 #000' : 'none',
    minHeight: 96,
  };

  if (active) {
    return (
      <button onClick={onClick} style={{
        ...style,
        fontFamily: proto.body,
      }}>
        {inner}
      </button>
    );
  }

  return (
    <div style={style}>
      {inner}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// INTRO — 黒背景 × ピンクのコントラスト
// ─────────────────────────────────────────────────────
function IntroScreen({ onStart, onBack }) {
  return (
    <div style={{ minHeight: '100vh', background: proto.pink, paddingBottom: 40 }}>
      {/* ヘッダー */}
      <div style={{
        background: proto.black, padding: '50px 22px 28px',
        textAlign: 'center', position: 'relative',
        overflow: 'hidden',
      }}>
        <BackBtn onClick={onBack} top={50} dark label="トップに戻る" />
        {/* 女の子: ヘッダー右端から覗く */}
        <div style={{
          position: 'absolute',
          right: -20, bottom: -8,
          opacity: 0.95,
          pointerEvents: 'none',
          filter: 'drop-shadow(0 4px 12px rgba(255,77,109,0.4))',
        }}>
          <Girl variant="default" height={150} />
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <PillLabel>HOW TO PLAY</PillLabel>
          <div style={{ marginTop: 14 }}>
            <LogoText size={26}>遊び方</LogoText>
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 22px' }}>
        <StepCard n="1" text="彼女は、彼氏に見せずに自分が思った答えを選ぶ" />
        <StepCard n="2" text="彼氏は、彼女が選んだ答えを予想して同じ色を選ぶ" />
        <StepCard n="3" text="5問終わったら、何問当たったか結果発表" />
        <StepCard n="4" text="最後に当たった問題・外した問題をまとめて確認" />

        <div style={{
          marginTop: 18, padding: '14px 16px',
          background: proto.black,
          borderRadius: 12,
          color: proto.white,
        }}>
          <div style={{
            fontFamily: proto.caption, fontSize: 10, color: proto.yellow,
            letterSpacing: '0.15em', marginBottom: 4,
          }}>★ RULES ★</div>
          <div style={{ fontSize: 12, lineHeight: 1.7 }}>
            全 <span style={{ color: proto.yellow, fontWeight: 800, fontSize: 16 }}>{window.ALL_CARDS.length}</span> 問のお題から
            <span style={{ color: proto.yellow, fontWeight: 800, fontSize: 16 }}> ランダムに 5 問</span> 出題！<br/>
            彼女の本音を、彼氏がどれだけ当てられるかをチェック。<br/>
            答え合わせは最後にまとめて表示されます ♡
          </div>
        </div>

        <button onClick={onStart} style={{ ...primaryBtn(), marginTop: 22 }}>
          スタート
          <span style={{
            display: 'inline-block', marginLeft: 6,
            color: proto.yellow, fontSize: 18, textShadow: '1px 1px 0 #000',
          }}>▶</span>
        </button>
      </div>
    </div>
  );
}

function StepCard({ n, text }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: 12, marginBottom: 10,
      background: proto.white,
      border: `2.5px solid ${proto.black}`,
      borderRadius: 14,
      boxShadow: proto.shadowHard,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: proto.pink,
        border: `2px solid ${proto.black}`,
        color: proto.white,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: proto.display, fontWeight: 900, fontSize: 18,
        flexShrink: 0,
        textShadow: '1px 1px 0 #000',
      }}>{n}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: proto.text, lineHeight: 1.45 }}>{text}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// PLAY — 同時発表式
// ─────────────────────────────────────────────────────
function PlayScreen({ card, qIdx, total, onAnswer, onBack }) {
  const [phase, setPhase] = useState('girl');
  const [girlPick, setGirlPick] = useState(null);
  const [boyPick, setBoyPick] = useState(null);
  const [handoffMessage, setHandoffMessage] = useState('');

  useEffect(() => {
    setPhase('girl'); setGirlPick(null); setBoyPick(null); setHandoffMessage('');
  }, [qIdx, card && card.id]);

  const onGirlPick = (i) => {
    if (girlPick !== null) return;
    setGirlPick(i);
    setHandoffMessage('彼氏に渡してね');
    setTimeout(() => {
      setHandoffMessage('');
      setPhase('boy');
    }, HANDOFF_DELAY_MS);
  };
  const onBoyPick = (i) => {
    if (boyPick !== null) return;
    setBoyPick(i);
    setHandoffMessage(qIdx + 1 >= total ? '彼女に渡して結果を見てね' : '彼女に渡して次の問題へ');
    setTimeout(() => onAnswer(girlPick, i), LOVE_RETURN_DELAY_MS);
  };

  if (!card) return null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      minHeight: '100dvh', background: proto.pink, color: proto.white,
      position: 'relative', overflowX: 'hidden',
      paddingBottom: 'calc(132px + env(safe-area-inset-bottom))',
    }}>
      {/* キャラ装飾: 右下のコーナーから小さく覗く */}
      <div style={{
        position: 'absolute', right: -24, bottom: -12,
        opacity: 0.15, pointerEvents: 'none',
        zIndex: 0,
      }}>
        <Girl variant="full" height={240} />
      </div>
      {/* progress */}
      <div style={{ padding: '34px 18px 0', position: 'relative', zIndex: 1 }}>
        <BackBtn onClick={onBack} top={20} dark label="遊び方に戻る" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{
            fontFamily: proto.caption, fontSize: 11, color: proto.white,
            letterSpacing: '0.15em', whiteSpace: 'nowrap',
          }}>
            QUESTION {qIdx + 1} / {total}
          </div>
          <div style={{
            fontFamily: proto.caption, fontSize: 11, color: proto.yellow,
            fontWeight: 700, letterSpacing: '0.1em',
          }}>
            {Array(total).fill(0).map((_,i)=> i < qIdx ? '♡' : i === qIdx ? '◆' : '○').join(' ')}
          </div>
        </div>
        <div style={{
          width: '100%', height: 6, borderRadius: 99,
          background: 'rgba(0,0,0,0.2)',
        }}>
          <div style={{
            width: `${((qIdx + (phase==='reveal'?1:0)) / total) * 100}%`,
            height: '100%', borderRadius: 99,
            background: proto.yellow,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* phase ラベル */}
      <div style={{ padding: '6px 18px 3px', textAlign: 'center' }}>
        <QuestionProgress qIdx={qIdx} total={total} />
      </div>
      <div style={{ padding: '0 18px 5px', textAlign: 'center' }}>
        <AutoSaveHint />
      </div>
      <div style={{ padding: '4px 18px 5px', textAlign: 'center' }}>
        <PhaseBadge phase={phase} />
      </div>

      {/* お題カード画像 */}
      <div style={{ padding: '0 22px 7px' }}>
        <div style={{
          position: 'relative',
          width: 'min(100%, 330px)',
          margin: '0 auto',
          borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 12px 28px rgba(0,0,0,0.25)',
          background: '#FFF',
          border: `3px solid ${proto.white}`,
        }}>
          <img src={card.image} alt={card.title} style={{
            width: '100%', height: 'auto', aspectRatio: '756 / 1122', objectFit: 'contain', display: 'block',
          }} />
        </div>
      </div>

      {/* メインエリア */}
      <div style={{ flex: 1, padding: '0 18px 14px' }}>
        {phase === 'girl' && (
          <ColorPicker
            selected={girlPick}
            onPick={onGirlPick}
            highlight={proto.yellow}
            mode="answer"
            instruction="♀ 彼女のターン  ── 彼氏には見せずに、自分が思った答えの色を選んでね"
          />
        )}
        {phase === 'boy' && (
          <>
            <div style={{
              padding: '7px 12px', marginBottom: 7,
              background: 'rgba(0,0,0,0.25)',
              border: `1.5px dashed ${proto.yellow}`,
              borderRadius: 12, fontSize: 11,
              color: proto.yellow,
              textAlign: 'center', fontWeight: 600,
            }}>
              ✦ 彼女の選択 受付完了 ✦<br/>
              <span style={{ fontSize: 9, color: proto.white, fontWeight: 500, opacity: 0.85 }}>
                次は彼氏が「彼女が選んだ色」を予想してね
              </span>
            </div>
            <ColorPicker
              selected={boyPick}
              onPick={onBoyPick}
              highlight={proto.cyan}
              mode="guess"
              instruction="♂ 彼氏のターン  ── 彼女が選んだ色を予想してタップ"
            />
          </>
        )}
      </div>
      {handoffMessage && <HandoffOverlay message={handoffMessage} />}
    </div>
  );
}

function PhaseBadge({ phase }) {
  const conf = {
    girl: {
      eyebrow: 'STEP 1 / 2',
      title: '彼女が本音で選ぶターン',
      note: '彼氏には見せずに、自分が思った答えを選んでね',
      color: proto.yellow,
    },
    boy: {
      eyebrow: 'STEP 2 / 2',
      title: '彼氏が彼女の答えを予想',
      note: '彼女がさっき選んだ答えを当ててね',
      color: proto.cyan,
    },
  }[phase];
  return (
    <div style={{
      display: 'inline-block',
      minWidth: 220,
      maxWidth: '100%',
      padding: '9px 18px 10px',
      background: conf.color,
      color: proto.black,
      borderRadius: 16,
      fontFamily: proto.body,
      border: `2.5px solid ${proto.black}`,
      boxShadow: '3px 3px 0 #000',
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: proto.caption,
        fontSize: 9,
        fontWeight: 900,
        letterSpacing: '0.16em',
        opacity: 0.78,
      }}>{conf.eyebrow}</div>
      <div style={{
        marginTop: 2,
        fontSize: 17,
        fontWeight: 900,
        lineHeight: 1.25,
      }}>{conf.title}</div>
      <div style={{
        marginTop: 3,
        fontSize: 10,
        fontWeight: 800,
        lineHeight: 1.4,
      }}>{conf.note}</div>
    </div>
  );
}

function QuestionProgress({ qIdx, total, label = 'QUESTION' }) {
  const current = Math.min(total, qIdx + 1);
  const remaining = Math.max(0, total - current);
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      minWidth: 190,
      padding: '8px 14px',
      background: proto.white,
      color: proto.black,
      border: `2.5px solid ${proto.black}`,
      borderRadius: 999,
      boxShadow: '3px 3px 0 #000',
      fontFamily: proto.body,
      fontWeight: 900,
    }}>
      <span style={{
        fontFamily: proto.caption,
        fontSize: 9,
        letterSpacing: '0.14em',
        color: proto.pinkDeep,
      }}>{label}</span>
      <span style={{ fontSize: 18, lineHeight: 1 }}>
        {current}<span style={{ fontSize: 12 }}> / {total}問</span>
      </span>
      <span style={{
        fontSize: 10,
        color: proto.textSoft,
        whiteSpace: 'nowrap',
      }}>あと{remaining}問</span>
    </div>
  );
}

function AutoSaveHint({ text = '途中で閉じても、トップからつづきに戻れます' }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      maxWidth: '100%',
      minHeight: 28,
      padding: '5px 10px',
      borderRadius: 999,
      background: 'rgba(255,255,255,0.18)',
      border: '1px solid rgba(255,255,255,0.4)',
      color: proto.white,
      fontSize: 10,
      fontWeight: 800,
      lineHeight: 1.35,
      textAlign: 'center',
      boxSizing: 'border-box',
    }}>
      <span aria-hidden="true" style={{ color: proto.yellow }}>↻</span>
      <span>{text}</span>
    </div>
  );
}

function SilentSparkles({ compact = false }) {
  const items = [
    { label: '♡', top: '10%', left: '12%', delay: '0s', color: proto.yellow },
    { label: '✦', top: '18%', right: '14%', delay: '0.18s', color: proto.cyan },
    { label: '•', bottom: '16%', left: '18%', delay: '0.32s', color: proto.white },
    { label: '♡', bottom: '14%', right: '16%', delay: '0.48s', color: proto.yellow },
  ];
  return (
    <div aria-hidden="true" style={{
      position: 'absolute',
      inset: compact ? -10 : -18,
      pointerEvents: 'none',
      overflow: 'hidden',
      borderRadius: compact ? 18 : 24,
    }}>
      {items.map((item, i) => (
        <span key={i} className="silent-sparkle-item" style={{
          position: 'absolute',
          top: item.top,
          left: item.left,
          right: item.right,
          bottom: item.bottom,
          color: item.color,
          fontSize: compact ? 12 : 15,
          fontWeight: 900,
          opacity: 0,
          textShadow: '1px 1px 0 rgba(0,0,0,0.3)',
          animation: `silentSparkle 1.4s ${item.delay} ease-out both`,
        }}>{item.label}</span>
      ))}
      <style>{`
        @keyframes silentSparkle {
          0% { transform: translateY(6px) scale(0.7); opacity: 0; }
          25% { opacity: 0.9; }
          100% { transform: translateY(-10px) scale(1.05); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .silent-sparkle-item { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>
    </div>
  );
}

function ResultReadyScreen({ title, subtitle, detail, buttonLabel, onResult, onHome }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: proto.pink,
      color: proto.white,
      padding: '54px 22px calc(152px + env(safe-area-inset-bottom))',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <Decor />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <PillLabel>FINAL CHECK</PillLabel>
        <div style={{ marginTop: 18 }}>
          <LogoText size={36} color={proto.yellow} outline="#000000" lineHeight={1.15}>
            {title}
          </LogoText>
        </div>
        <div style={{
          margin: '18px auto 0',
          maxWidth: 340,
          background: proto.white,
          color: proto.black,
          border: `3px solid ${proto.black}`,
          borderRadius: 18,
          boxShadow: proto.shadowHard,
          padding: '18px 16px',
          boxSizing: 'border-box',
          position: 'relative',
        }}>
          <SilentSparkles />
          <div style={{
            fontSize: 20,
            fontWeight: 900,
            lineHeight: 1.35,
          }}>{subtitle}</div>
          <div style={{
            marginTop: 10,
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.65,
            color: proto.textSoft,
          }}>{detail}</div>
          <div style={{
            marginTop: 14,
            padding: '8px 10px',
            borderRadius: 12,
            background: proto.yellow,
            border: `2px solid ${proto.black}`,
            color: proto.black,
            fontSize: 12,
            fontWeight: 900,
            lineHeight: 1.45,
          }}>
            準備できたら、みんなで一緒に押してね
          </div>
        </div>
      </div>
      <FixedActionBar
        primaryLabel={buttonLabel}
        onPrimary={onResult}
        secondaryLabel="トップに戻る"
        onSecondary={onHome}
        largePrimary
      />
    </div>
  );
}

function HandoffOverlay({ message }) {
  const parts = String(message || '').split('に渡して');
  const targetName = parts[0] || message;
  const actionText = parts.length > 1 ? `に渡して${parts.slice(1).join('に渡して')}` : '';
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      boxSizing: 'border-box',
      background: 'rgba(0,0,0,0.28)',
      pointerEvents: 'none',
    }}>
      <div style={{
        width: 'min(360px, 100%)',
        background: proto.yellow,
        color: proto.black,
        border: `3px solid ${proto.black}`,
        borderRadius: 18,
        boxShadow: '7px 7px 0 #000',
        padding: '24px 18px 22px',
        textAlign: 'center',
        fontFamily: proto.body,
        animation: 'handoffPop 0.22s ease-out',
        position: 'relative',
      }}>
        <SilentSparkles compact />
        <div style={{
          fontFamily: proto.caption,
          fontSize: 10,
          letterSpacing: '0.18em',
          marginBottom: 10,
        }}>PASS THE PHONE</div>
        <div style={{
          display: 'inline-block',
          maxWidth: '100%',
          padding: '6px 14px 8px',
          borderRadius: 14,
          background: proto.white,
          border: `2.5px solid ${proto.black}`,
          boxShadow: '3px 3px 0 #000',
          fontSize: targetName.length >= 7 ? 28 : 34,
          fontWeight: 900,
          lineHeight: 1.15,
          overflowWrap: 'anywhere',
        }}>
          {targetName}
        </div>
        <div style={{
          marginTop: 12,
          fontSize: 22,
          fontWeight: 900,
          lineHeight: 1.35,
        }}>
          {actionText || message}
        </div>
        <div style={{
          marginTop: 8,
          fontSize: 11,
          fontWeight: 900,
          lineHeight: 1.45,
          opacity: 0.72,
        }}>
          画面を見せずにスマホを渡してね
        </div>
      </div>
      <style>{`
        @keyframes handoffPop {
          0% { transform: translateY(10px) scale(0.94); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function getTurnColorTheme(mode, highlight) {
  const isGuess = mode === 'guess';
  const color = isGuess ? proto.cyan : proto.yellow;
  return {
    color: highlight || color,
    label: isGuess ? '予想の番' : '本人の番',
    panelBg: isGuess ? 'rgba(91,212,232,0.32)' : 'rgba(255,226,107,0.32)',
    panelBorder: isGuess ? 'rgba(91,212,232,0.78)' : 'rgba(255,226,107,0.82)',
    labelBg: color,
  };
}

function ColorPicker({ selected, onPick, highlight, instruction, mode = 'answer' }) {
  const isLocked = selected !== null && selected !== undefined;
  const theme = getTurnColorTheme(mode, highlight);
  return (
    <div style={{
      position: 'fixed',
      left: '50%',
      bottom: 'calc(4px + env(safe-area-inset-bottom))',
      zIndex: 120,
      width: 'min(560px, calc(100% - 28px))',
      transform: 'translateX(-50%)',
    }}>
      <style>{`
        @keyframes chipPop {
          0% { transform: scale(1); }
          58% { transform: scale(1.18); }
          100% { transform: scale(1.08); }
        }
      `}</style>
      {instruction && (
        <div style={{
          fontSize: 11, color: proto.white, textAlign: 'center',
          marginBottom: 4, fontWeight: 600, letterSpacing: '0.05em',
          textShadow: '1px 1px 0 rgba(0,0,0,0.4)',
        }}>{instruction}</div>
      )}
      <div style={{
        background: theme.panelBg,
        backdropFilter: 'blur(8px)',
        border: `2.5px solid ${theme.panelBorder}`,
        borderRadius: 18,
        padding: '9px 10px 9px',
        boxShadow: `0 8px 24px rgba(0,0,0,0.18), inset 0 0 0 1px ${theme.color}`,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 6,
          color: proto.white,
          fontWeight: 900,
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 22,
            padding: '2px 9px',
            borderRadius: 999,
            background: theme.labelBg,
            color: proto.black,
            border: `1.5px solid ${proto.black}`,
            boxShadow: '2px 2px 0 rgba(0,0,0,0.55)',
            fontSize: 11,
            lineHeight: 1,
          }}>{theme.label}</span>
          <span style={{
            fontSize: 10,
            color: isLocked ? theme.color : proto.white,
            opacity: isLocked ? 1 : 0.78,
          }}>{isLocked ? `${COLOR_LABELS[selected]}を選択済み` : 'タップで決定'}</span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 8,
        }}>
          {window.COLOR_OPTIONS.map((opt, i) => {
            const isSelected = selected === i;
            return (
              <button
                key={opt.id}
                onClick={() => {
                  if (!isLocked) onPick(i);
                }}
                disabled={isLocked}
                aria-label={`${COLOR_LABELS[i] || opt.name}を選ぶ`}
                style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column',
                minHeight: 54, minWidth: 48,
                padding: 0,
                background: 'transparent', border: 'none',
                cursor: isLocked ? 'default' : 'pointer', fontFamily: proto.body,
                touchAction: 'manipulation',
                transition: 'opacity 0.18s, transform 0.18s',
                transform: isSelected ? 'translateY(-6px) scale(1.12)' : 'none',
                opacity: isLocked && !isSelected ? 0.45 : 1,
              }}>
                <ColorChip
                  color={opt.color}
                  size={40}
                  selected={isSelected}
                  highlight={theme.color}
                />
                <span style={{
                  marginTop: 4,
                  fontSize: 9,
                  fontWeight: 900,
                  color: proto.white,
                  textShadow: '1px 1px 0 rgba(0,0,0,0.35)',
                  lineHeight: 1,
                }}>{COLOR_LABELS[i] || opt.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{
        marginTop: 3, fontSize: 9, color: proto.white,
        textAlign: 'center', lineHeight: 1.5, opacity: 0.85,
        textShadow: '1px 1px 0 rgba(0,0,0,0.35)',
      }}>
        ドットの色はお題カード左側の5色と対応しています
      </div>
    </div>
  );
}

function ColorChip({ color, size = 44, selected = false, highlight }) {
  const ringColor = selected ? (highlight || color) : 'transparent';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color,
      position: 'relative',
      boxShadow: selected
        ? `0 0 0 3px #FFF, 0 0 0 6px ${ringColor}, 0 8px 18px rgba(0,0,0,0.3), inset 0 -3px 6px rgba(0,0,0,0.18), inset 0 2px 3px rgba(255,255,255,0.4)`
        : `0 4px 10px rgba(0,0,0,0.25), inset 0 -3px 6px rgba(0,0,0,0.15), inset 0 2px 3px rgba(255,255,255,0.35)`,
      flexShrink: 0,
      transform: selected ? 'scale(1.08)' : 'scale(1)',
      animation: selected ? 'chipPop 0.24s ease-out' : 'none',
      transition: 'box-shadow 0.18s, transform 0.18s',
    }} />
  );
}

const MISS_MESSAGES = [
  <>彼氏、今日は読心術お休みです。<br/>あとで答え合わせ会しよ ♡</>,
  <>そこ外すの、逆に才能。<br/>彼女検定、追試決定です ✦</>,
  <>彼女の取扱説明書、<br/>まだ第1章で止まってます。</>,
  <>惜しいようで惜しくないかも。<br/>でも伸びしろは満点 ♡</>,
  <>今のは彼女からの小テスト。<br/>彼氏、補習入りました。</>,
  <>気持ちは近い。答えは遠い。<br/>次で名誉挽回しよ ✦</>,
];

const HIT_MESSAGES = [
  <>彼氏、今日の読心術キレてます。<br/>その調子で次も当てて ♡</>,
  <>それ当てるの、普通にすごい。<br/>彼女検定、単位出ます ✦</>,
  <>ちゃんと見てるじゃん。<br/>今のは加点ポイント高め ♡</>,
  <>気持ちのWi-Fiつながってます。<br/>通信状態かなり良好 ✦</>,
  <>彼女の取扱説明書、<br/>ちゃんと読み込んでるタイプ。</>,
  <>今の正解はうれしいやつ。<br/>ちょっと自慢していい ♡</>,
];

function Reveal({ card, girlPick, boyPick, onNext }) {
  const girlOpt = window.COLOR_OPTIONS[girlPick];
  const boyOpt = window.COLOR_OPTIONS[boyPick];
  const match = girlPick === boyPick;
  const hitMessage = HIT_MESSAGES[(card.id + girlPick + boyPick) % HIT_MESSAGES.length];
  const missMessage = MISS_MESSAGES[(card.id + girlPick + boyPick) % MISS_MESSAGES.length];

  return (
    <div style={{
      animation: 'revealFade 0.5s ease',
      paddingBottom: 'calc(84px + env(safe-area-inset-bottom))',
    }}>
      <style>{`
        @keyframes revealFade {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes matchPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>
      <div style={{
        textAlign: 'center', marginBottom: 16,
        animation: match ? 'matchPulse 0.6s ease' : 'none',
      }}>
        <LogoText
          size={42}
          color={match ? proto.yellow : proto.white}
          outline={match ? '#000000' : '#000000'}
        >{match ? '正解 ♡' : 'ハズレ…'}</LogoText>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <PickCard label="♀ 彼女" opt={girlOpt} accent={proto.yellow} />
        <PickCard label="♂ 彼氏" opt={boyOpt} accent={proto.cyan} />
      </div>

      <div style={{
        padding: '12px 14px', borderRadius: 14,
        background: match ? proto.yellow : proto.white,
        border: `2.5px solid ${proto.black}`,
        boxShadow: proto.shadowHard,
        fontSize: 12, color: proto.black,
        textAlign: 'center', lineHeight: 1.7, fontWeight: 600,
      }}>
        {match
          ? hitMessage
          : missMessage
        }
      </div>

      <button onClick={onNext} style={{
        ...primaryBtn(),
        marginTop: 20,
        position: 'fixed',
        left: '50%',
        bottom: 'calc(12px + env(safe-area-inset-bottom))',
        width: 'min(444px, calc(100vw - 36px))',
        transform: 'translateX(-50%)',
        zIndex: 5,
      }}>
        次の問題へ
        <span style={{ marginLeft: 6, color: proto.yellow, textShadow: '1px 1px 0 #000' }}>→</span>
      </button>
    </div>
  );
}

function PickCard({ label, opt, accent }) {
  return (
    <div style={{
      flex: 1, padding: 14,
      background: proto.white,
      borderRadius: 16,
      border: `2.5px solid ${proto.black}`,
      boxShadow: proto.shadowHard,
      textAlign: 'center',
    }}>
      <div style={{
        display: 'inline-block', padding: '2px 8px',
        background: accent, color: proto.black,
        border: `1.5px solid ${proto.black}`, borderRadius: 999,
        fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
        marginBottom: 10,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <ColorChip color={opt.color} size={48} />
      </div>
      <div style={{
        fontSize: 13, color: proto.text, marginTop: 10,
        lineHeight: 1.4, fontWeight: 700,
      }}>
        {opt.name}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// RESULT
// ─────────────────────────────────────────────────────
const RESULT_TIERS = [
  { score: 0, title: '彼女理解は初期設定中', emoji: '💔', tag: '初期設定', tagBg: proto.black,
    msg: '0問正解は逆にレア。\nここから覚えることが多すぎて、デートの話題には困らない。\n今日の答え合わせから始めよ ♡',
    shareHook: '彼氏の彼女理解、まだ初期設定中でした' },
  { score: 1, title: '彼女クイズ見習い中', emoji: '🌱', tag: '見習い', tagBg: '#F4A261',
    msg: '1問当てたのはえらい。\nでもまだ「分かってる風」ゾーン。\n次のデートで一気にアップデート希望 ✦',
    shareHook: 'うちの彼氏、彼女クイズ見習い中でした' },
  { score: 2, title: '彼女データ更新中', emoji: '🌷', tag: 'UPDATE中', tagBg: proto.cyan,
    msg: 'まだ知らない一面、多め。\nでもそれって、これから知れる余白があるってこと。\n外した答えほど、ふたりのネタになる ♡',
    shareHook: '彼女データ、ただいま更新中でした' },
  { score: 3, title: 'ドヤ顔まであと一歩', emoji: '💞', tag: '惜しい', tagBg: '#FF7A92',
    msg: '半分以上わかってるのはちゃんと強い。\nただし満点彼氏を名乗るには、あと少し。\n外した問題、次回までに要復習 ♡',
    shareHook: '彼氏、ドヤ顔まであと一歩でした' },
  { score: 4, title: '彼女マスターまであと1問', emoji: '💖', tag: 'あと1問', tagBg: proto.pink,
    msg: 'これはかなり分かってる。\nあと1問で満点なのがいちばん悔しいやつ。\nもう一回やったら伝説、ある ♡',
    shareHook: '彼氏、彼女マスターまであと1問でした' },
  { score: 5, title: '彼女公認・理解王', emoji: '💕', tag: '♡ PERFECT ♡', tagBg: proto.yellow,
    msg: '全問正解はさすがに強すぎ。\n好みも迷いどころも、ちゃんと見てる彼氏。\nこれは堂々と自慢していいやつ ♡',
    shareHook: '全問正解、彼氏が彼女公認の理解王でした' },
];

function ResultScreen({ answers, cards, onReplay, onHome, onAbout, onProduct }) {
  const score = answers.filter(a => a.match).length;
  const total = answers.length || 5;
  const tier = RESULT_TIERS[score] || RESULT_TIERS[0];
  const [copied, setCopied] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageStatus, setImageStatus] = useState('');
  const preparedResultImageSrc = getLoveResultImageSrc(score);

  useEffect(() => {
    preloadPreparedResultImages('love');
  }, []);

  const titleBreaks = {
    '彼女理解は初期設定中': ['彼女理解は', '初期設定中'],
    '彼女クイズ見習い中': ['彼女クイズ', '見習い中'],
    '彼女マスターまであと1問': ['彼女マスターまで', 'あと1問'],
  };
  const titleLines = titleBreaks[tier.title];
  const titleSize = titleLines ? 22 : (tier.title.length >= 14 ? 18 : 23);
  const titleNode = titleLines
    ? <>{titleLines[0]}<br/>{titleLines[1]}</>
    : tier.title;

  const shareUrl = window.location.href;
  const xShareText = `彼氏の愛情判定ゲームで${score}/${total}問正解！\n結果は「${tier.title}」でした。\n${tier.shareHook} ♡\n\nみんなは何問当たる？\n#わたちゃん #私のことちゃんと分かってるよね #彼氏の愛情判定`;
  const instagramShareText = `彼氏の愛情判定ゲーム\n${score}/${total}問正解\n「${tier.title}」\n${tier.shareHook} ♡\n\nストーリーに載せて\n「うちら何問当たると思う？」って聞いてみて👇\n\n#わたちゃん\n${shareUrl}`;
  const lineShareText = `彼氏の愛情判定ゲームで${score}/${total}問正解！結果は「${tier.title}」でした。${tier.shareHook} ♡`;
  const copyShareText = `${xShareText}\n${shareUrl}`;

  const copyToClipboard = (value, type) => {
    const done = () => {
      setCopied(type);
      setTimeout(() => setCopied(false), 2000);
    };
    const fallback = () => {
      const el = document.createElement('textarea');
      el.value = value;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      done();
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(value).then(done).catch(fallback);
    } else {
      fallback();
    }
  };

  const handleShare = (platform) => {
    if (platform === 'x' && canShareImageFile(`watachan-love-result-${score}-${total}.png`)) {
      handleShareImage();
      return;
    }
    const text = encodeURIComponent(platform === 'line' ? lineShareText : xShareText);
    const url = encodeURIComponent(shareUrl);
    let target = '';
    if (platform === 'x') target = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
    if (platform === 'line') target = `https://social-plugins.line.me/lineit/share?url=${url}&text=${text}`;
    if (platform === 'instagram') {
      copyToClipboard(instagramShareText, 'instagram');
      return;
    }
    if (platform === 'copy') {
      copyToClipboard(copyShareText, 'copy');
      return;
    }
    window.open(target, '_blank', 'noopener,noreferrer,width=600,height=500');
  };

  const handleSaveImage = async () => {
    setImageBusy(true);
    try {
      const result = await savePreparedImage({
        src: preparedResultImageSrc,
        filename: `watachan-love-result-${score}-${total}.png`,
        title: 'わたちゃん 彼氏の愛情判定ゲーム',
      });
      showTemporaryStatus(setImageStatus, getImageActionMessage(result));
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      alert('画像の準備に失敗しました。もう一度試してみてください。');
    } finally {
      setImageBusy(false);
    }
  };

  const handleShareImage = async () => {
    setImageBusy(true);
    try {
      const result = await sharePreparedImage({
        src: preparedResultImageSrc,
        filename: `watachan-love-result-${score}-${total}.png`,
        title: 'わたちゃん 彼氏の愛情判定ゲーム',
        text: xShareText,
        url: shareUrl,
      });
      showTemporaryStatus(setImageStatus, getImageActionMessage(result));
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      alert('画像シェアに対応していない環境です。画像保存を試してみてください。');
    } finally {
      setImageBusy(false);
    }
  };

  const tagTextColor = tier.tagBg === proto.yellow || tier.tagBg === proto.cyan ? proto.black : proto.white;

  return (
    <div style={{
      minHeight: '100vh',
      background: proto.pink,
      position: 'relative',
      paddingBottom: 40,
      overflowX: 'hidden',
    }}>
      <Decor />

      <div style={resultHeroStyle()}>
      <div style={{ padding: '58px 22px 6px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <PillLabel>YOUR RESULT</PillLabel>
      </div>
      <style>{`
        @keyframes scorePop {
          0% { transform: scale(0.3); opacity: 0; }
          70% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div style={{
        margin: '18px 18px 0',
        padding: '0 0 18px',
        background: proto.white,
        border: `3px solid ${proto.black}`,
        borderRadius: 16,
        boxShadow: '6px 6px 0 #000',
        textAlign: 'center', position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          background: proto.black,
          color: proto.white,
          padding: '9px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          fontFamily: proto.caption,
          fontSize: 10,
          letterSpacing: '0.18em',
        }}>
          <span>LOVE CHECK RESULT</span>
          <span style={{
            background: tier.tagBg,
            color: tagTextColor,
            padding: '4px 9px',
            borderRadius: 999,
            border: `1.5px solid ${proto.white}`,
            fontFamily: proto.body,
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
          }}>{tier.tag}</span>
        </div>

        <div style={{
          margin: '14px 16px 0',
          padding: '12px 12px',
          border: `2.5px dashed ${proto.pink}`,
          borderRadius: 14,
          background: proto.cream,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 118px',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{ textAlign: 'left', paddingLeft: 2 }}>
            <div style={{
              fontFamily: proto.caption,
              fontSize: 10,
              color: proto.pink,
              letterSpacing: '0.15em',
              marginBottom: 3,
              fontWeight: 800,
            }}>彼氏理解度</div>
            <div style={{ animation: 'scorePop 0.8s ease' }}>
              <LogoText size={54} color={proto.pink} outline={proto.black} lineHeight={1}>
                {score}/{total}
              </LogoText>
            </div>
            <div style={{
              display: 'inline-block',
              marginTop: 4,
              padding: '3px 9px',
              background: proto.yellow,
              color: proto.black,
              border: `2px solid ${proto.black}`,
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 900,
            }}>問正解</div>
          </div>
          <div style={{
            position: 'relative',
            minHeight: 138,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}>
            <div style={{
              position: 'absolute',
              right: 0,
              top: 4,
              fontSize: 34,
              animation: 'scorePop 0.8s ease 0.2s both',
              zIndex: 2,
            }}>{tier.emoji}</div>
            <div style={{
              filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.12))',
              transform: 'translateY(8px)',
            }}>
              <Girl variant={girlVariantForScore(score, total)} height={150} />
            </div>
          </div>
        </div>

        <div style={{
          margin: '14px 18px 0',
          padding: '4px 0 0',
        }}>
          <LogoText size={titleSize} color={proto.pink} outline={proto.black} lineHeight={1.25}>
            {titleNode}
          </LogoText>
        </div>
        <div style={{
          margin: '13px 18px 0',
          padding: '12px 12px',
          background: score >= 4 ? proto.yellow : proto.white,
          border: `2.5px solid ${proto.black}`,
          borderRadius: 12,
          boxShadow: '3px 3px 0 #000',
          fontSize: 12,
          color: proto.text,
          lineHeight: 1.75,
          whiteSpace: 'pre-line',
          fontWeight: 700,
        }}>{tier.msg}</div>

        <div style={{
          margin: '14px 18px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          fontFamily: proto.caption,
          color: proto.textSoft,
          fontSize: 9,
          letterSpacing: '0.12em',
        }}>
          <span>streetboardgame.com</span>
          <span style={{ color: proto.pink, fontWeight: 900 }}>何問当たる？</span>
        </div>
      </div>
      </div>

      {/* 内訳 */}
      <div style={{ padding: '20px 18px 0', position: 'relative', zIndex: 1 }}>
        <div style={{
          fontFamily: proto.caption, fontSize: 10,
          color: proto.white, letterSpacing: '0.25em',
          marginBottom: 8, paddingLeft: 4,
        }}>YOUR ANSWERS</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
          {answers.map((a, i) => (
            <div key={i} style={{
              flex: 1, padding: '10px 4px', borderRadius: 10,
              background: a.match ? proto.yellow : proto.white,
              border: `2px solid ${proto.black}`,
              textAlign: 'center',
              boxShadow: '2px 2px 0 #000',
            }}>
              <div style={{
                fontFamily: proto.caption, fontSize: 9,
                color: proto.black, fontWeight: 700,
              }}>Q{i+1}</div>
              <div style={{ fontSize: 18, marginTop: 2 }}>{a.match ? '♡' : '×'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 詳細 */}
      <div style={{ padding: '20px 18px 0', position: 'relative', zIndex: 1 }}>
        <div style={{
          width: '100%',
          minHeight: 54,
          background: proto.black,
          color: proto.white,
          border: `2.5px solid ${proto.black}`,
          borderRadius: 14,
          boxShadow: '5px 5px 0 #5BD4E8',
          fontFamily: proto.display,
          fontSize: 16,
          fontWeight: 900,
          letterSpacing: '0.04em',
          textShadow: '2px 2px 0 #5BD4E8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          答え合わせ
        </div>
        <div style={{
          fontFamily: proto.caption, fontSize: 10,
          color: proto.white, letterSpacing: '0.25em',
          margin: '14px 0 8px', paddingLeft: 4,
        }}>ANSWER DETAILS</div>
        <div style={{ display: 'grid', gap: 7 }}>
          {answers.map((a, i) => {
            const card = cards[i];
            const girlChoice = card && card.choices ? card.choices[a.girl] : window.COLOR_OPTIONS[a.girl]?.name;
            const boyChoice = card && card.choices ? card.choices[a.boy] : window.COLOR_OPTIONS[a.boy]?.name;
            return (
              <div key={i} style={{
                background: a.match ? proto.yellow : proto.white,
                border: `2px solid ${proto.black}`,
                borderRadius: 10,
                boxShadow: '2px 2px 0 #000',
                overflow: 'hidden',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  padding: '6px 8px',
                  background: a.match ? proto.black : proto.pinkSoft,
                  color: a.match ? proto.white : proto.black,
                  borderBottom: `2px solid ${proto.black}`,
                }}>
                  <div style={{
                    fontFamily: proto.caption,
                    fontSize: 9,
                    letterSpacing: '0.12em',
                    fontWeight: 800,
                  }}>Q{i + 1}</div>
                  <div style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 11,
                    fontWeight: 900,
                    lineHeight: 1.35,
                    textAlign: 'left',
                  }}>{card ? card.title : 'お題'}</div>
                  <div style={{
                    flexShrink: 0,
                    padding: '2px 7px',
                    borderRadius: 999,
                    background: a.match ? proto.yellow : proto.white,
                    color: proto.black,
                    border: `1.5px solid ${proto.black}`,
                    fontSize: 9,
                    fontWeight: 900,
                  }}>{a.match ? '当たり' : 'ハズレ'}</div>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                  padding: 8,
                }}>
                  <AnswerPick label="彼女" choice={girlChoice} opt={window.COLOR_OPTIONS[a.girl]} accent={proto.yellow} />
                  <AnswerPick label="彼氏" choice={boyChoice} opt={window.COLOR_OPTIONS[a.boy]} accent={proto.cyan} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* シェア */}
      <div style={{ padding: '22px 18px 0', position: 'relative', zIndex: 1 }}>
        <ResultImageActions
          busy={imageBusy}
          onShare={handleShareImage}
          status={imageStatus}
        />
        <button onClick={() => handleShare('copy')} style={textOnlyBtn()}>
          {copied === 'copy' ? 'シェア文をコピーしました' : '文章だけコピーする'}
        </button>
        {copied && (
          <div style={{
            marginTop: 8, padding: '6px 10px', borderRadius: 8,
            background: proto.yellow, color: proto.black, fontSize: 11,
            textAlign: 'center', fontWeight: 700,
            border: `2px solid ${proto.black}`,
          }}>
            {copied === 'instagram' ? 'Instagram用の文章をコピーしました ♡' : 'シェア文をコピーしました ♡'}
          </div>
        )}
        <ResultReplayActions
          primaryLabel="新しいお題でもう一度"
          onPrimary={onReplay}
          secondaryLabel="トップに戻る"
          onSecondary={onHome}
        />

        <div style={{
          marginTop: 12, fontFamily: proto.caption, fontSize: 10,
          color: proto.white, textAlign: 'center', lineHeight: 1.5, opacity: 0.85,
        }}>
          全 {window.ALL_CARDS ? window.ALL_CARDS.length : 42} 問の中からランダム出題 ✦
        </div>
      </div>

      {/* 製品誘導 */}
      <div style={{ padding: '24px 18px 0', position: 'relative', zIndex: 1 }}>
        <div
          role="button"
          tabIndex={0}
          aria-label="カードゲーム版の詳細を見る"
          onClick={onProduct}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onProduct();
            }
          }}
          style={{
          padding: 14, borderRadius: 16,
          background: proto.white,
          border: `2.5px solid ${proto.black}`,
          boxShadow: proto.shadowHard,
          display: 'flex', alignItems: 'center', gap: 12,
          cursor: 'pointer',
        }}>
          <div style={{ fontSize: 36 }}>🎴</div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: proto.caption, fontSize: 10, color: proto.pink,
              fontWeight: 800, letterSpacing: '0.1em',
            }}>
              MORE FUN ♡
            </div>
            <div style={{
              fontSize: 12, color: proto.text, marginTop: 2,
              lineHeight: 1.4, fontWeight: 700,
            }}>
              54問入り・カードゲーム版
            </div>
            <div style={{
              fontSize: 11, color: proto.textSoft, marginTop: 4,
              lineHeight: 1.45, fontWeight: 700,
            }}>
              飲み会・旅行・おうちデートでもっと深掘り
            </div>
            <a
              href={AMAZON_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 9,
                minHeight: 34,
                padding: '0 12px',
                borderRadius: 999,
                background: '#FF9900',
                color: proto.white,
                border: `2px solid ${proto.black}`,
                boxShadow: '2px 2px 0 #000',
                fontSize: 11,
                fontWeight: 900,
                textDecoration: 'none',
              }}
            >
              Amazon版を見る
            </a>
          </div>
          <div style={{
            color: proto.pink, fontSize: 20, fontWeight: 800,
          }}>→</div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <FooterLink onClick={onAbout}>About / お問い合わせ</FooterLink>
        </div>
      </div>
    </div>
  );
}

function ResultImageActions({ busy, onShare, status = '' }) {
  return (
    <div style={{
      background: proto.yellow,
      color: proto.black,
      border: `3px solid ${proto.black}`,
      borderRadius: 14,
      boxShadow: '5px 5px 0 #000',
      padding: '14px 12px',
      textAlign: 'center',
      fontWeight: 900,
      lineHeight: 1.45,
    }}>
      <div style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 999,
        background: proto.black,
        color: proto.white,
        fontFamily: proto.caption,
        fontSize: 10,
        letterSpacing: '0.12em',
        marginBottom: 8,
      }}>SHARE YOUR RESULT</div>
      <div style={{ fontSize: 16 }}>答え合わせを見たら結果をシェア</div>
      <div style={{ marginTop: 3, fontSize: 11, color: proto.text, lineHeight: 1.5 }}>
        スマホは共有、パソコンは画像保存になります
      </div>
      <button onClick={onShare} disabled={busy} style={{
        width: '100%',
        minHeight: 62,
        marginTop: 14,
        borderRadius: 12,
        border: `2.5px solid ${proto.black}`,
        background: proto.black,
        color: proto.white,
        fontFamily: proto.body,
        fontSize: 15,
        fontWeight: 900,
        boxShadow: '3px 3px 0 #5BD4E8',
        opacity: busy ? 0.65 : 1,
        cursor: busy ? 'default' : 'pointer',
      }}>
        {busy ? '画像を準備中...' : '結果画像を保存・シェアする ▶'}
      </button>
      {status && (
        <div role="status" aria-live="polite" style={{
          marginTop: 10,
          padding: '8px 10px',
          borderRadius: 10,
          background: proto.white,
          color: proto.black,
          border: `2px solid ${proto.black}`,
          boxShadow: '2px 2px 0 #000',
          fontSize: 12,
          fontWeight: 900,
          lineHeight: 1.35,
        }}>
          {status} ♡
        </div>
      )}
    </div>
  );
}

function ResultReplayActions({ primaryLabel, onPrimary, secondaryLabel, onSecondary }) {
  return (
    <div style={{
      display: 'grid',
      gap: 12,
      marginTop: 16,
    }}>
      <button onClick={onPrimary} style={primaryBtn()}>
        {primaryLabel}
      </button>
      {secondaryLabel && onSecondary && (
        <button onClick={onSecondary} style={{
          ...secondaryBtn(),
          minHeight: 50,
          padding: '12px 14px',
        }}>
          {secondaryLabel}
        </button>
      )}
    </div>
  );
}

function FixedActionBar({ primaryLabel, onPrimary, secondaryLabel, onSecondary, largePrimary = false }) {
  const primaryStyle = primaryBtn();
  return (
    <div style={{
      position: 'fixed',
      left: '50%',
      bottom: 0,
      transform: 'translateX(-50%)',
      width: 'min(480px, 100vw)',
      padding: '12px 18px calc(14px + env(safe-area-inset-bottom))',
      boxSizing: 'border-box',
      background: 'linear-gradient(180deg, rgba(236,79,136,0), rgba(236,79,136,0.98) 18%, rgba(236,79,136,1))',
      zIndex: 30,
      pointerEvents: 'none',
    }}>
      <div style={{ display: 'grid', gap: largePrimary ? 14 : 12, pointerEvents: 'auto' }}>
        <button onClick={onPrimary} style={{
          ...primaryStyle,
          minHeight: largePrimary ? 84 : primaryStyle.minHeight,
          padding: largePrimary ? '22px 16px' : primaryStyle.padding,
          fontSize: largePrimary ? 21 : primaryStyle.fontSize,
          borderRadius: largePrimary ? 18 : primaryStyle.borderRadius,
          boxShadow: largePrimary ? '6px 6px 0 #5BD4E8' : primaryStyle.boxShadow,
          letterSpacing: largePrimary ? '0.1em' : primaryStyle.letterSpacing,
        }}>
          {primaryLabel}
        </button>
        {secondaryLabel && onSecondary && (
          <button onClick={onSecondary} style={{
            ...secondaryBtn(),
            minHeight: 50,
            padding: '12px 14px',
          }}>
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function ShareBtn({ label, ariaLabel, bg, fg, onClick }) {
  return (
    <button onClick={onClick} aria-label={ariaLabel || label} style={{
      flex: 1, minHeight: 56, borderRadius: 12,
      background: bg, color: fg,
      border: `2.5px solid ${proto.black}`,
      fontSize: 12, fontWeight: 800, fontFamily: proto.body,
      letterSpacing: '0.05em',
      boxShadow: '3px 3px 0 #000',
      cursor: 'pointer', transition: 'transform 0.1s',
    }}>{label}</button>
  );
}

function AnswerPick({ label, choice, opt, accent }) {
  return (
    <div style={{
      padding: '7px 7px',
      background: proto.white,
      border: `1.5px solid ${proto.black}`,
      borderRadius: 8,
      minWidth: 0,
    }}>
      <div style={{
        display: 'inline-block',
        padding: '1px 7px',
        background: accent,
        color: proto.black,
        border: `1.5px solid ${proto.black}`,
        borderRadius: 999,
        fontSize: 9,
        fontWeight: 900,
        marginBottom: 5,
      }}>{label}</div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minHeight: 26,
      }}>
        <span style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: opt ? opt.color : proto.textSoft,
          border: `1.5px solid ${proto.black}`,
          boxShadow: '1px 1px 0 #000',
          flexShrink: 0,
        }} />
        <span style={{
          minWidth: 0,
          fontSize: 11,
          lineHeight: 1.3,
          fontWeight: 900,
          color: proto.text,
          overflowWrap: 'anywhere',
        }}>{choice}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// FRIEND MODE
// ─────────────────────────────────────────────────────
const FRIEND_PLAYERS = ['本人', '友達A', '友達B', '友達C'];
function getFriendPlayers(playerCount) {
  return FRIEND_PLAYERS.slice(0, normalizeFriendPlayerCount(playerCount));
}
function getFriendPlayersLabel(playerCount) {
  return getFriendPlayers(playerCount).join(' + ');
}

function FriendIntroScreen({ onStart, onBack }) {
  return (
    <div style={{ minHeight: '100vh', background: proto.pink, paddingBottom: 40 }}>
      <div style={{
        background: proto.black, padding: '50px 22px 28px',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <BackBtn onClick={onBack} top={50} dark label="トップに戻る" />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <PillLabel>FRIEND CHECK</PillLabel>
          <div style={{ marginTop: 14 }}>
            <LogoText size={26}>友達の友情判定</LogoText>
          </div>
          <div style={{
            marginTop: 8, color: proto.white, fontSize: 12,
            lineHeight: 1.7, fontWeight: 700,
          }}>
            本人が自分の答えを選び、友達がその答えを予想するゲーム。
            2〜4人で「本人のことをどれだけ分かっているか」を判定します。
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 22px' }}>
        <StepCard n="1" text="人数を選ぶ" />
        <StepCard n="2" text="本人は、友達に見せずに自分が思った答えを選ぶ" />
        <StepCard n="3" text="友達は、本人が選んだ答えを予想して同じ色を選ぶ" />
        <StepCard n="4" text="5問後に、誰が何問当てたか発表" />

        <div style={{
          marginTop: 18, padding: '14px 16px',
          background: proto.black,
          borderRadius: 12,
          color: proto.white,
        }}>
          <div style={{
            fontFamily: proto.caption, fontSize: 10, color: proto.yellow,
            letterSpacing: '0.15em', marginBottom: 4,
          }}>★ SELECT PLAYERS ★</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {[2, 3, 4].map((count) => (
              <button key={count} onClick={() => onStart(count)} style={{
                minHeight: 72,
                background: count === 2 ? proto.cyan : count === 3 ? proto.yellow : proto.white,
                color: proto.black,
                border: `2.5px solid ${proto.black}`,
                borderRadius: 12,
                boxShadow: '3px 3px 0 #000',
                fontWeight: 900,
                cursor: 'pointer',
                padding: '12px 14px',
                lineHeight: 1.25,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                textAlign: 'left',
              }}>
                <div style={{ fontSize: 20, whiteSpace: 'nowrap' }}>{count}人で遊ぶ</div>
                <div style={{ fontSize: 11, fontWeight: 900, lineHeight: 1.35, textAlign: 'right' }}>
                  {getFriendPlayersLabel(count)}
                </div>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, lineHeight: 1.6, opacity: 0.9 }}>
            ランダムに5問だけ出ます。
          </div>
        </div>
      </div>
    </div>
  );
}

function FriendPlayScreen({ card, qIdx, total, playerCount, onAnswer, onBack }) {
  const [phase, setPhase] = useState('answer');
  const [targetPick, setTargetPick] = useState(null);
  const [guesses, setGuesses] = useState([]);
  const [turn, setTurn] = useState(1);
  const [handoffMessage, setHandoffMessage] = useState('');

  useEffect(() => {
    setPhase('answer');
    setTargetPick(null);
    setGuesses([]);
    setTurn(1);
    setHandoffMessage('');
  }, [qIdx, card && card.id, playerCount]);

  const handlePick = (i) => {
    if (phase === 'answer') {
      setTargetPick(i);
      const nextPlayer = getFriendPlayers(playerCount)[1] || '友達A';
      setHandoffMessage(`${nextPlayer}に渡してね`);
      setTimeout(() => {
        setHandoffMessage('');
        setPhase('guess');
      }, HANDOFF_DELAY_MS);
      return;
    }
    const next = [...guesses, i];
    setGuesses(next);
    if (turn >= playerCount - 1) {
      setHandoffMessage(qIdx + 1 >= total ? '本人に渡して結果を見てね' : '本人に渡して次の問題へ');
      setTimeout(() => onAnswer({
        target: targetPick,
        guesses: next,
        matches: next.map(g => g === targetPick),
      }), FINAL_HANDOFF_DELAY_MS);
    } else {
      const nextPlayer = getFriendPlayers(playerCount)[turn + 1] || `友達${turn + 1}`;
      setHandoffMessage(`${nextPlayer}に渡してね`);
      setTimeout(() => {
        setHandoffMessage('');
        setTurn(turn + 1);
      }, HANDOFF_DELAY_MS);
    }
  };

  if (!card) return null;
  const friendPlayers = getFriendPlayers(playerCount);
  const currentPlayer = friendPlayers[turn] || friendPlayers[1] || '友達A';
  const playerLabel = getFriendPlayersLabel(playerCount);

  return (
    <div style={{
      minHeight: '100dvh', background: proto.pink, color: proto.white,
      position: 'relative', overflowX: 'hidden',
      paddingBottom: 'calc(132px + env(safe-area-inset-bottom))',
    }}>
      <Decor />
      <div style={{ padding: '34px 18px 0', position: 'relative', zIndex: 1 }}>
        <BackBtn onClick={onBack} top={20} dark label="友情版の遊び方に戻る" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{
            fontFamily: proto.caption, fontSize: 11,
            letterSpacing: '0.15em', whiteSpace: 'nowrap',
          }}>FRIEND Q {qIdx + 1} / {total}</div>
          <div style={{
            fontFamily: proto.body,
            fontSize: 10,
            color: proto.yellow,
            fontWeight: 900,
            textAlign: 'right',
            lineHeight: 1.3,
          }}>
            {playerLabel}
          </div>
        </div>
        <div style={{ width: '100%', height: 6, borderRadius: 99, background: 'rgba(0,0,0,0.2)' }}>
          <div style={{
            width: `${(qIdx / total) * 100}%`,
            height: '100%', borderRadius: 99, background: proto.yellow,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      <div style={{ padding: '6px 18px 3px', textAlign: 'center' }}>
        <QuestionProgress qIdx={qIdx} total={total} label="FRIEND Q" />
      </div>
      <div style={{ padding: '0 18px 5px', textAlign: 'center' }}>
        <AutoSaveHint text="途中で閉じても、トップから友情判定のつづきに戻れます" />
      </div>

      <div style={{ padding: '3px 18px 5px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block',
          minWidth: 220,
          maxWidth: '100%',
          padding: '7px 16px 8px',
          background: phase === 'answer' ? proto.yellow : phase === 'guess' ? proto.cyan : proto.white,
          color: proto.black,
          borderRadius: 16,
          fontWeight: 900,
          border: `2.5px solid ${proto.black}`,
          boxShadow: '3px 3px 0 #000',
          fontFamily: proto.body,
          lineHeight: 1.3,
        }}>
          <div style={{
            fontFamily: proto.caption,
            fontSize: 9,
            letterSpacing: '0.16em',
            opacity: 0.78,
          }}>
            {phase === 'answer' ? 'STEP 1' : `STEP ${turn + 1}`}
          </div>
          <div style={{ marginTop: 1, fontSize: 15 }}>
            {phase === 'answer' ? '本人が本音で選ぶターン' : `${currentPlayer}が本人の答えを予想`}
          </div>
          <div style={{ marginTop: 2, fontSize: 9, lineHeight: 1.35 }}>
            {phase === 'answer' ? '友達には見せずに、本人が思ったものを選んでね' : '本人がさっき選んだものを当ててね'}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 22px 7px' }}>
        <FriendQuestionCard card={card} />
      </div>

      <div style={{ padding: '0 18px 14px' }}>
        {phase === 'answer' && (
          <ColorPicker
            selected={targetPick}
            onPick={handlePick}
            highlight={proto.yellow}
            mode="answer"
            instruction="本人だけが見て、自分が思ったものを選んでね"
          />
        )}
        {phase === 'guess' && (
          <>
            <div style={{
              padding: '7px 12px', marginBottom: 7,
              background: 'rgba(0,0,0,0.25)',
              border: `1.5px dashed ${proto.yellow}`,
              borderRadius: 12, fontSize: 11,
              textAlign: 'center', fontWeight: 700,
            }}>
              本人の答えは受付完了。<br/>
              <span style={{ fontSize: 9, color: proto.yellow }}>
                {currentPlayer}は「本人が選んだもの」を予想してね
              </span>
            </div>
            <ColorPicker
              selected={guesses[turn - 1]}
              onPick={handlePick}
              highlight={proto.cyan}
              mode="guess"
              instruction={`${currentPlayer}のターン ── 本人が選んだ色を予想`}
            />
          </>
        )}
      </div>
      {handoffMessage && <HandoffOverlay message={handoffMessage} />}
    </div>
  );
}

function FriendQuestionCard({ card }) {
  const titleLines = splitCardTitle(card.title);
  const lineYs = [40, 113, 186, 260, 333, 407, 480, 553, 627, 701, 773, 848, 922, 996, 1068];
  const choiceRows = [3, 5, 7, 9, 11];
  const choiceYs = choiceRows.map((row) => Math.round((lineYs[row] + lineYs[row + 1]) / 2));
  const holes = [36, 120, 204, 288, 372, 456, 540, 624, 708];

  return (
    <div style={{
      position: 'relative',
      background: proto.white,
      border: `3px solid ${proto.white}`,
      borderRadius: 18,
      boxShadow: '0 14px 30px rgba(0,0,0,0.22)',
      overflow: 'hidden',
      width: 'min(100%, 330px)',
      maxWidth: 560,
      margin: '0 auto',
      aspectRatio: '756 / 1122',
    }}>
      <svg viewBox="0 0 756 1122" width="100%" height="100%" role="img" aria-label={card.title} style={{ display: 'block' }}>
        <rect width="756" height="1122" fill="#FFFFFF" />

        {/* notebook holes */}
        {holes.map((x) => (
          <circle key={x} cx={x} cy="-12" r="31" fill={proto.pink} opacity="0.96" />
        ))}

        {/* notebook ruled lines */}
        <line x1="134" y1="0" x2="134" y2="1122" stroke="rgba(236,79,136,0.18)" strokeWidth="2.5" />
        {lineYs.map((y) => (
          <line key={y} x1="0" y1={y} x2="756" y2={y} stroke="rgba(91,212,232,0.34)" strokeWidth="4" />
        ))}
        {/* title tape */}
        <rect x="68" y="57" width="620" height="150" fill="rgba(91,212,232,0.68)" />
        <rect x="68" y="57" width="620" height="150" fill="#5BD4E8" opacity="0.34" />
        <g fontFamily={proto.handwrite} fontWeight="400" fill={proto.text} textAnchor="middle">
          {titleLines.map((line, i) => (
            <text key={line} x="378" y={titleLines.length === 1 ? 150 : 126 + i * 48} fontSize={titleLines.length === 1 ? 44 : 40} dominantBaseline="middle">
              {line}
            </text>
          ))}
        </g>

        {/* choices */}
        {card.choices.map((choice, i) => {
          const opt = window.COLOR_OPTIONS[i];
          const fontSize = choice.length >= 12 ? 32 : choice.length >= 8 ? 36 : 40;
          return (
            <g key={choice}>
              <circle cx="77" cy={choiceYs[i]} r="41" fill={opt.color} filter="url(#friendCardDotShadow)" />
              <text
                x="406"
                y={choiceYs[i] + 2}
                fontFamily={proto.handwrite}
                fontSize={fontSize}
                fontWeight="400"
                fill={proto.text}
                dominantBaseline="middle"
                textAnchor="middle"
              >
                {choice}
              </text>
            </g>
          );
        })}

        {/* curl */}
        <defs>
          <filter id="friendCardDotShadow" x="-35%" y="-35%" width="170%" height="170%">
            <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#000000" floodOpacity="0.24" />
          </filter>
          <linearGradient id="friendCardCurl" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#DDDDDD" />
            <stop offset="0.45" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#CFCFCF" />
          </linearGradient>
        </defs>
        <path d="M690 920 C725 930 746 1004 736 1122 L652 1122 C668 1055 676 982 690 920 Z" fill="url(#friendCardCurl)" opacity="0.9" />
        <path d="M680 932 C715 952 730 1014 724 1122" stroke="rgba(0,0,0,0.10)" strokeWidth="4" fill="none" />
      </svg>
    </div>
  );
}

function splitCardTitle(title) {
  if (!title || title.length <= 9) return [title || ''];
  const breakAt = Math.ceil(title.length / 2);
  return [title.slice(0, breakAt), title.slice(breakAt)];
}

function FriendReveal({ card, targetPick, guesses, playerCount, onNext }) {
  const hitCount = guesses.filter(g => g === targetPick).length;
  return (
    <div style={{ paddingBottom: 'calc(84px + env(safe-area-inset-bottom))' }}>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <LogoText size={38} color={hitCount ? proto.yellow : proto.white} outline="#000000">
          {hitCount ? `${hitCount}人正解！` : '全員ハズレ…'}
        </LogoText>
      </div>
      <div style={{
        padding: 12,
        background: proto.white,
        border: `2.5px solid ${proto.black}`,
        borderRadius: 14,
        boxShadow: proto.shadowHard,
        color: proto.text,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingBottom: 10,
          marginBottom: 10,
          borderBottom: `2px dashed ${proto.pink}`,
          fontWeight: 900,
        }}>
          <ColorChip color={window.COLOR_OPTIONS[targetPick].color} size={24} />
          <span>本人の答え：{card.choices[targetPick]}</span>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {guesses.map((g, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 10,
              background: g === targetPick ? proto.yellow : proto.pinkSoft,
              border: `1.5px solid ${proto.black}`,
            }}>
              <span style={{ fontSize: 12, fontWeight: 900 }}>{FRIEND_PLAYERS[i + 1]}</span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 800 }}>{card.choices[g]}</span>
              <span style={{ fontSize: 13, fontWeight: 900 }}>{g === targetPick ? '当たり' : 'ハズレ'}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{
        marginTop: 14,
        padding: '12px 14px',
        background: hitCount === playerCount - 1 ? proto.yellow : proto.white,
        border: `2.5px solid ${proto.black}`,
        borderRadius: 12,
        boxShadow: '3px 3px 0 #000',
        color: proto.text,
        fontSize: 12,
        lineHeight: 1.7,
        textAlign: 'center',
        fontWeight: 800,
      }}>
        {hitCount === playerCount - 1
          ? '全員当てるの、友情の解像度高すぎ。'
          : hitCount > 0
            ? '当てた人、ちゃんと見てる。外した人は今からアップデート。'
            : '全員外しは逆に盛り上がる。本人、まだまだ謎多き友達です。'}
      </div>
      <button onClick={onNext} style={{
        ...primaryBtn(),
        marginTop: 20,
        position: 'fixed',
        left: '50%',
        bottom: 'calc(12px + env(safe-area-inset-bottom))',
        width: 'min(444px, calc(100vw - 36px))',
        transform: 'translateX(-50%)',
        zIndex: 5,
      }}>
        次の問題へ
        <span style={{ marginLeft: 6, color: proto.yellow, textShadow: '1px 1px 0 #000' }}>→</span>
      </button>
    </div>
  );
}

function PlayerScoreBoard({ answers, players, label }) {
  const total = Math.max(1, answers.length);
  const scores = getPlayerScores(answers, players);

  return (
    <div style={{
      margin: '14px 16px 0',
      padding: '12px 10px',
      background: proto.black,
      border: `2.5px solid ${proto.black}`,
      borderRadius: 14,
      boxShadow: '4px 4px 0 #000',
    }}>
      <div style={{
        fontFamily: proto.caption,
        fontSize: 9,
        color: proto.yellow,
        fontWeight: 900,
        letterSpacing: '0.12em',
        marginBottom: 9,
      }}>{label}</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.max(1, scores.length)}, minmax(0, 1fr))`,
        gap: 8,
      }}>
        {scores.map((item) => (
          <div key={item.name} style={{
            minWidth: 0,
            padding: '10px 5px',
            background: item.score === total ? proto.yellow : proto.pinkSoft,
            border: `2px solid ${proto.white}`,
            borderRadius: 10,
            color: proto.text,
            fontWeight: 900,
          }}>
            <div style={{
              fontSize: 10,
              lineHeight: 1.2,
              overflowWrap: 'anywhere',
            }}>{item.name}</div>
            <div style={{
              marginTop: 3,
              fontSize: 22,
              lineHeight: 1,
              fontFamily: proto.display,
              color: item.score === total ? proto.black : proto.pinkDeep,
            }}>{item.score}/{total}</div>
            <div style={{ marginTop: 2, fontSize: 9, lineHeight: 1.2 }}>
              問正解
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getPlayerScores(answers, players) {
  return players.slice(1).map((name, idx) => ({
    name,
    score: answers.reduce((sum, answer) => sum + (answer.matches[idx] ? 1 : 0), 0),
  }));
}

function getPlayerScoreSummary(answers, players) {
  const total = Math.max(1, answers.length);
  return getPlayerScores(answers, players)
    .map((item) => `${item.name} ${item.score}/${total}問`)
    .join('、');
}

function createGroupResultImageSrc(kind, answers, players) {
  if (typeof document === 'undefined') return '';
  const total = Math.max(1, answers.length || 5);
  const scores = getPlayerScores(answers, players);
  const isFamily = kind === 'family';
  const title = isFamily ? '家族の絆判定' : '友達の友情判定';
  const headline = isFamily ? '家族それぞれの結果' : '友達それぞれの結果';
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = proto.pink;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = proto.black;
  roundRect(ctx, 70, 80, 940, 1180, 38);
  ctx.fill();

  ctx.fillStyle = proto.white;
  roundRect(ctx, 88, 98, 904, 1144, 30);
  ctx.fill();

  ctx.fillStyle = proto.black;
  roundRect(ctx, 88, 98, 904, 116, 30);
  ctx.fill();

  ctx.fillStyle = proto.white;
  ctx.font = '700 32px "DotGothic16", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(isFamily ? 'FAMILY BOND RESULT' : 'FRIEND CHECK RESULT', 132, 168);

  ctx.fillStyle = proto.cyan;
  roundRect(ctx, 782, 126, 150, 52, 26);
  ctx.fill();
  ctx.fillStyle = proto.black;
  ctx.font = '900 26px "Zen Maru Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('個別判定', 857, 161);

  ctx.fillStyle = proto.pink;
  ctx.font = '900 64px "RocknRoll One", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 540, 310);

  ctx.fillStyle = proto.black;
  roundRect(ctx, 150, 370, 780, 92, 22);
  ctx.fill();
  ctx.fillStyle = proto.yellow;
  ctx.font = '900 36px "Zen Maru Gothic", sans-serif';
  ctx.fillText(headline, 540, 430);

  const cardTop = 520;
  const cardGap = 34;
  const cardHeight = 150;
  scores.forEach((item, index) => {
    const y = cardTop + index * (cardHeight + cardGap);
    ctx.fillStyle = item.score === total ? proto.yellow : proto.pinkSoft;
    roundRect(ctx, 170, y, 740, cardHeight, 26);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = proto.black;
    roundRect(ctx, 170, y, 740, cardHeight, 26);
    ctx.stroke();

    ctx.fillStyle = proto.black;
    ctx.font = '900 36px "Zen Maru Gothic", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(item.name, 220, y + 62);

    ctx.fillStyle = proto.pinkDeep;
    ctx.font = '900 70px "RocknRoll One", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${item.score}/${total}`, 790, y + 76);

    ctx.fillStyle = proto.black;
    ctx.font = '900 28px "Zen Maru Gothic", sans-serif';
    ctx.fillText('問正解', 880, y + 76);
  });

  ctx.fillStyle = proto.black;
  ctx.font = '900 34px "Zen Maru Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('答え合わせで、どの問題を当てたか確認してね', 540, 1110);

  ctx.fillStyle = proto.textSoft;
  ctx.font = '700 26px "DotGothic16", monospace';
  ctx.fillText('streetboardgame.com / #わたちゃん', 540, 1190);

  return canvas.toDataURL('image/png');
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function MultiPlayerAnswerDetails({ answers, cards, players, label }) {
  return (
    <>
      <div style={{
        fontFamily: proto.caption, fontSize: 10,
        color: proto.white, letterSpacing: '0.25em',
        margin: '10px 0 6px', paddingLeft: 4,
      }}>{label}</div>
      <div style={{ display: 'grid', gap: 7 }}>
        {answers.map((a, i) => {
          const card = cards[i];
          const choices = card && card.choices ? card.choices : [];
          const rows = [
            { name: players[0] || '本人', pick: a.target, isTarget: true, match: true },
            ...a.guesses.map((g, gi) => ({
              name: players[gi + 1] || `参加者${gi + 1}`,
              pick: g,
              isTarget: false,
              match: g === a.target,
            })),
          ];
          return (
            <div key={i} style={{
              background: proto.white,
              border: `2px solid ${proto.black}`,
              borderRadius: 10,
              boxShadow: '2px 2px 0 #000',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '6px 8px',
                background: proto.black,
                color: proto.white,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span style={{ fontFamily: proto.caption, fontSize: 9 }}>Q{i + 1}</span>
                <span style={{ flex: 1, fontSize: 11, fontWeight: 900, textAlign: 'left', lineHeight: 1.3 }}>{card ? card.title : ''}</span>
              </div>
              <div style={{
                padding: 7,
                color: proto.text,
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.max(2, rows.length)}, minmax(0, 1fr))`,
                gap: 5,
              }}>
                {rows.map((row) => (
                  <div key={row.name} style={{
                    minWidth: 0,
                    padding: '6px 4px',
                    borderRadius: 8,
                    background: row.isTarget ? proto.cyan : (row.match ? proto.yellow : proto.pinkSoft),
                    border: `1.5px solid ${proto.black}`,
                    fontWeight: 900,
                    textAlign: 'center',
                  }}>
                    <div style={{
                      fontSize: 9,
                      lineHeight: 1.2,
                      color: proto.pinkDeep,
                      overflowWrap: 'anywhere',
                    }}>{row.name}</div>
                    <div style={{
                      marginTop: 3,
                      fontSize: 11,
                      lineHeight: 1.25,
                      overflowWrap: 'anywhere',
                    }}>{choices[row.pick] || '-'}</div>
                    <div style={{
                      marginTop: 3,
                      fontSize: 9,
                      lineHeight: 1,
                      color: row.isTarget ? proto.black : (row.match ? proto.black : proto.textSoft),
                    }}>{row.isTarget ? '本人' : (row.match ? '当たり' : 'ハズレ')}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function FriendResultScreen({ answers, cards, playerCount, onReplay, onHome, onAbout }) {
  const totalQuestions = Math.max(1, answers.length || 5);
  const friendPlayers = useMemo(() => getFriendPlayers(playerCount), [playerCount]);
  const scoreSummary = getPlayerScoreSummary(answers, friendPlayers);
  const [copied, setCopied] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageStatus, setImageStatus] = useState('');
  const preparedResultImageSrc = useMemo(
    () => createGroupResultImageSrc('friend', answers, friendPlayers),
    [answers, friendPlayers]
  );

  const shareUrl = `${location.origin}/friends`;
  const shareText = `友達の友情判定ゲームをやってみた！\n${scoreSummary}\n\n友達とやったら何問当たる？\n#わたちゃん #友情判定ゲーム #streetboardgame`;

  const copyShareText = () => {
    const value = `${shareText}\n${shareUrl}`;
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(value).then(done).catch(done);
    } else {
      done();
    }
  };

  const openX = () => {
    if (canShareImageFile(`watachan-friend-result-${totalQuestions}.png`)) {
      handleShareImage();
      return;
    }
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      '_blank',
      'noopener,noreferrer,width=600,height=500'
    );
  };

  const handleSaveImage = async () => {
    setImageBusy(true);
    try {
      const result = await savePreparedImage({
        src: preparedResultImageSrc,
        filename: `watachan-friend-result-${totalQuestions}.png`,
        title: 'わたちゃん 友達の友情判定ゲーム',
      });
      showTemporaryStatus(setImageStatus, getImageActionMessage(result));
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      alert('画像の準備に失敗しました。もう一度試してみてください。');
    } finally {
      setImageBusy(false);
    }
  };

  const handleShareImage = async () => {
    setImageBusy(true);
    try {
      const result = await sharePreparedImage({
        src: preparedResultImageSrc,
        filename: `watachan-friend-result-${totalQuestions}.png`,
        title: 'わたちゃん 友達の友情判定ゲーム',
        text: shareText,
        url: shareUrl,
      });
      showTemporaryStatus(setImageStatus, getImageActionMessage(result));
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      alert('画像シェアに対応していない環境です。画像保存を試してみてください。');
    } finally {
      setImageBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: proto.pink,
      position: 'relative',
      paddingBottom: 40,
      overflowX: 'hidden',
    }}>
      <Decor />
      <div style={resultHeroStyle()}>
      <div style={{ padding: '58px 22px 6px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <PillLabel>FRIEND RESULT</PillLabel>
      </div>
      <div style={{
        margin: '18px 18px 0',
        background: proto.white,
        border: `3px solid ${proto.black}`,
        borderRadius: 16,
        boxShadow: '6px 6px 0 #000',
        textAlign: 'center',
        overflow: 'hidden',
      }}>
        <div style={{
          background: proto.black,
          color: proto.white,
          padding: '9px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          fontFamily: proto.caption,
          fontSize: 10,
          letterSpacing: '0.18em',
        }}>
          <span>FRIEND CHECK RESULT</span>
          <span style={{
            background: proto.cyan,
            color: proto.black,
            padding: '4px 9px',
            borderRadius: 999,
            border: `1.5px solid ${proto.white}`,
            fontFamily: proto.body,
            fontSize: 9,
            fontWeight: 900,
          }}>個別判定</span>
        </div>
        <PlayerScoreBoard
          answers={answers}
          players={friendPlayers}
          label="それぞれ何問当たった？"
        />
        <div style={{
          margin: '14px 18px 18px',
          padding: '12px 12px',
          background: proto.white,
          border: `2.5px solid ${proto.black}`,
          borderRadius: 12,
          boxShadow: '3px 3px 0 #000',
          fontSize: 12,
          color: proto.text,
          lineHeight: 1.75,
          fontWeight: 700,
        }}>答え合わせで、誰がどの問題を当てたかまとめて確認できます。</div>
      </div>
      </div>

      <div style={{ padding: '20px 18px 0', position: 'relative', zIndex: 1 }}>
        <div style={{
          width: '100%',
          minHeight: 54,
          background: proto.black,
          color: proto.white,
          border: `2.5px solid ${proto.black}`,
          borderRadius: 14,
          boxShadow: '5px 5px 0 #5BD4E8',
          fontFamily: proto.display,
          fontSize: 16,
          fontWeight: 900,
          letterSpacing: '0.04em',
          textShadow: '2px 2px 0 #5BD4E8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          答え合わせ
        </div>
        <MultiPlayerAnswerDetails
          answers={answers}
          cards={cards}
          players={friendPlayers}
          label="ANSWER DETAILS"
        />
      </div>

      <div style={{ padding: '22px 18px 0', position: 'relative', zIndex: 1 }}>
        <ResultImageActions
          busy={imageBusy}
          onShare={handleShareImage}
          status={imageStatus}
        />
        <button onClick={copyShareText} style={textOnlyBtn()}>
          {copied ? 'シェア文をコピーしました' : '文章だけコピーする'}
        </button>
        {copied && (
          <div style={{
            marginTop: 8, padding: '6px 10px', borderRadius: 8,
            background: proto.yellow, color: proto.black, fontSize: 11,
            textAlign: 'center', fontWeight: 700,
            border: `2px solid ${proto.black}`,
          }}>
            シェア文をコピーしました
          </div>
        )}
        <ResultReplayActions
          primaryLabel="同じ人数でもう一度"
          onPrimary={onReplay}
          secondaryLabel="トップに戻る"
          onSecondary={onHome}
        />
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <FooterLink onClick={onAbout}>About / お問い合わせ</FooterLink>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// FAMILY MODE
// ─────────────────────────────────────────────────────
const FAMILY_PLAYERS = ['本人', '家族A', '家族B', '家族C'];
function getFamilyPlayers(playerCount) {
  return FAMILY_PLAYERS.slice(0, normalizeFriendPlayerCount(playerCount));
}
function getFamilyPlayersLabel(playerCount) {
  return getFamilyPlayers(playerCount).join(' + ');
}

function FamilyIntroScreen({ onStart, onBack }) {
  return (
    <div style={{ minHeight: '100vh', background: proto.pink, paddingBottom: 40 }}>
      <div style={{
        background: proto.black, padding: '50px 22px 28px',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <BackBtn onClick={onBack} top={50} dark label="トップに戻る" />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <PillLabel>FAMILY CHECK</PillLabel>
          <div style={{ marginTop: 14 }}>
            <LogoText size={26}>家族の絆判定</LogoText>
          </div>
          <div style={{
            marginTop: 8, color: proto.white, fontSize: 12,
            lineHeight: 1.7, fontWeight: 700,
          }}>
            本人が自分の答えを選び、家族がその答えを予想するゲーム。
            2〜4人で「家族のことをどれだけ分かっているか」を判定します。
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 22px' }}>
        <StepCard n="1" text="人数を選ぶ" />
        <StepCard n="2" text="本人は、家族に見せずに自分が思った答えを選ぶ" />
        <StepCard n="3" text="家族は、本人が選んだ答えを予想して同じ色を選ぶ" />
        <StepCard n="4" text="5問後に、誰が何問当てたか発表" />

        <div style={{
          marginTop: 18, padding: '14px 16px',
          background: proto.black,
          borderRadius: 12,
          color: proto.white,
        }}>
          <div style={{
            fontFamily: proto.caption, fontSize: 10, color: proto.yellow,
            letterSpacing: '0.15em', marginBottom: 4,
          }}>★ SELECT PLAYERS ★</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {[2, 3, 4].map((count) => (
              <button key={count} onClick={() => onStart(count)} style={{
                minHeight: 72,
                background: count === 2 ? proto.cyan : count === 3 ? proto.yellow : proto.white,
                color: proto.black,
                border: `2.5px solid ${proto.black}`,
                borderRadius: 12,
                boxShadow: '3px 3px 0 #000',
                fontWeight: 900,
                cursor: 'pointer',
                padding: '12px 14px',
                lineHeight: 1.25,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                textAlign: 'left',
              }}>
                <div style={{ fontSize: 20, whiteSpace: 'nowrap' }}>{count}人で遊ぶ</div>
                <div style={{ fontSize: 11, fontWeight: 900, lineHeight: 1.35, textAlign: 'right' }}>
                  {getFamilyPlayersLabel(count)}
                </div>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, lineHeight: 1.6, opacity: 0.9 }}>
            ランダムに5問だけ出ます。
          </div>
        </div>
      </div>
    </div>
  );
}

function FamilyPlayScreen({ card, qIdx, total, playerCount, onAnswer, onBack }) {
  const [phase, setPhase] = useState('answer');
  const [targetPick, setTargetPick] = useState(null);
  const [guesses, setGuesses] = useState([]);
  const [turn, setTurn] = useState(1);
  const [handoffMessage, setHandoffMessage] = useState('');

  useEffect(() => {
    setPhase('answer');
    setTargetPick(null);
    setGuesses([]);
    setTurn(1);
    setHandoffMessage('');
  }, [qIdx, card && card.id, playerCount]);

  const handlePick = (i) => {
    if (phase === 'answer') {
      setTargetPick(i);
      const nextPlayer = getFamilyPlayers(playerCount)[1] || '家族A';
      setHandoffMessage(`${nextPlayer}に渡してね`);
      setTimeout(() => {
        setHandoffMessage('');
        setPhase('guess');
      }, HANDOFF_DELAY_MS);
      return;
    }
    const next = [...guesses, i];
    setGuesses(next);
    if (turn >= playerCount - 1) {
      setHandoffMessage(qIdx + 1 >= total ? '本人に渡して結果を見てね' : '本人に渡して次の問題へ');
      setTimeout(() => onAnswer({
        target: targetPick,
        guesses: next,
        matches: next.map(g => g === targetPick),
      }), FINAL_HANDOFF_DELAY_MS);
    } else {
      const nextPlayer = getFamilyPlayers(playerCount)[turn + 1] || `家族${turn + 1}`;
      setHandoffMessage(`${nextPlayer}に渡してね`);
      setTimeout(() => {
        setHandoffMessage('');
        setTurn(turn + 1);
      }, HANDOFF_DELAY_MS);
    }
  };

  if (!card) return null;
  const familyPlayers = getFamilyPlayers(playerCount);
  const currentPlayer = familyPlayers[turn] || familyPlayers[1] || '家族A';
  const playerLabel = getFamilyPlayersLabel(playerCount);

  return (
    <div style={{
      minHeight: '100dvh', background: proto.pink, color: proto.white,
      position: 'relative', overflowX: 'hidden',
      paddingBottom: 'calc(132px + env(safe-area-inset-bottom))',
    }}>
      <Decor />
      <div style={{ padding: '34px 18px 0', position: 'relative', zIndex: 1 }}>
        <BackBtn onClick={onBack} top={20} dark label="家族版の遊び方に戻る" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{
            fontFamily: proto.caption, fontSize: 11,
            letterSpacing: '0.15em', whiteSpace: 'nowrap',
          }}>FAMILY Q {qIdx + 1} / {total}</div>
          <div style={{
            fontFamily: proto.body,
            fontSize: 10,
            color: proto.yellow,
            fontWeight: 900,
            textAlign: 'right',
            lineHeight: 1.3,
          }}>
            {playerLabel}
          </div>
        </div>
        <div style={{ width: '100%', height: 6, borderRadius: 99, background: 'rgba(0,0,0,0.2)' }}>
          <div style={{
            width: `${(qIdx / total) * 100}%`,
            height: '100%', borderRadius: 99, background: proto.yellow,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      <div style={{ padding: '6px 18px 3px', textAlign: 'center' }}>
        <QuestionProgress qIdx={qIdx} total={total} label="FAMILY Q" />
      </div>
      <div style={{ padding: '0 18px 5px', textAlign: 'center' }}>
        <AutoSaveHint text="途中で閉じても、トップから家族判定のつづきに戻れます" />
      </div>

      <div style={{ padding: '3px 18px 5px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block',
          minWidth: 220,
          maxWidth: '100%',
          padding: '7px 16px 8px',
          background: phase === 'answer' ? proto.yellow : proto.cyan,
          color: proto.black,
          borderRadius: 16,
          fontWeight: 900,
          border: `2.5px solid ${proto.black}`,
          boxShadow: '3px 3px 0 #000',
          fontFamily: proto.body,
          lineHeight: 1.3,
        }}>
          <div style={{
            fontFamily: proto.caption,
            fontSize: 9,
            letterSpacing: '0.16em',
            opacity: 0.78,
          }}>
            {phase === 'answer' ? 'STEP 1' : `STEP ${turn + 1}`}
          </div>
          <div style={{ marginTop: 1, fontSize: 15 }}>
            {phase === 'answer' ? '本人が本音で選ぶターン' : `${currentPlayer}が本人の答えを予想`}
          </div>
          <div style={{ marginTop: 2, fontSize: 9, lineHeight: 1.35 }}>
            {phase === 'answer' ? '家族には見せずに、本人が思ったものを選んでね' : '本人がさっき選んだものを当ててね'}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 22px 7px' }}>
        <FriendQuestionCard card={card} />
      </div>

      <div style={{ padding: '0 18px 14px' }}>
        {phase === 'answer' && (
          <ColorPicker
            selected={targetPick}
            onPick={handlePick}
            highlight={proto.yellow}
            mode="answer"
            instruction="本人だけが見て、自分が思ったものを選んでね"
          />
        )}
        {phase === 'guess' && (
          <>
            <div style={{
              padding: '7px 12px', marginBottom: 7,
              background: 'rgba(0,0,0,0.25)',
              border: `1.5px dashed ${proto.yellow}`,
              borderRadius: 12, fontSize: 11,
              textAlign: 'center', fontWeight: 700,
            }}>
              本人の答えは受付完了！<br/>
              <span style={{ fontSize: 9, color: proto.yellow }}>
                {currentPlayer}は「本人が選んだもの」を予想してね
              </span>
            </div>
            <ColorPicker
              selected={guesses[turn - 1]}
              onPick={handlePick}
              highlight={proto.cyan}
              mode="guess"
              instruction={`${currentPlayer}のターン ── 本人が選んだ色を予想`}
            />
          </>
        )}
      </div>
      {handoffMessage && <HandoffOverlay message={handoffMessage} />}
    </div>
  );
}

function FamilyResultScreen({ answers, cards, playerCount, onReplay, onHome, onAbout }) {
  const totalQuestions = Math.max(1, answers.length || 5);
  const familyPlayers = useMemo(() => getFamilyPlayers(playerCount), [playerCount]);
  const scoreSummary = getPlayerScoreSummary(answers, familyPlayers);
  const [copied, setCopied] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageStatus, setImageStatus] = useState('');
  const preparedResultImageSrc = useMemo(
    () => createGroupResultImageSrc('family', answers, familyPlayers),
    [answers, familyPlayers]
  );

  const shareUrl = `${location.origin}/family`;
  const shareText = `家族の絆判定ゲームをやってみた！\n${scoreSummary}\n\n家族でやったら何問当たる？\n#わたちゃん #家族の絆判定 #streetboardgame`;

  const copyShareText = () => {
    const value = `${shareText}\n${shareUrl}`;
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(value).then(done).catch(done);
    } else {
      done();
    }
  };

  const openX = () => {
    if (canShareImageFile(`watachan-family-result-${totalQuestions}.png`)) {
      handleShareImage();
      return;
    }
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      '_blank',
      'noopener,noreferrer,width=600,height=500'
    );
  };

  const handleSaveImage = async () => {
    setImageBusy(true);
    try {
      const result = await savePreparedImage({
        src: preparedResultImageSrc,
        filename: `watachan-family-result-${totalQuestions}.png`,
        title: 'わたちゃん 家族の絆判定ゲーム',
      });
      showTemporaryStatus(setImageStatus, getImageActionMessage(result));
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      alert('画像の準備に失敗しました。もう一度試してみてください。');
    } finally {
      setImageBusy(false);
    }
  };

  const handleShareImage = async () => {
    setImageBusy(true);
    try {
      const result = await sharePreparedImage({
        src: preparedResultImageSrc,
        filename: `watachan-family-result-${totalQuestions}.png`,
        title: 'わたちゃん 家族の絆判定ゲーム',
        text: shareText,
        url: shareUrl,
      });
      showTemporaryStatus(setImageStatus, getImageActionMessage(result));
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      alert('画像シェアに対応していない環境です。画像保存を試してみてください。');
    } finally {
      setImageBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: proto.pink,
      position: 'relative',
      paddingBottom: 40,
      overflowX: 'hidden',
    }}>
      <Decor />
      <div style={resultHeroStyle()}>
      <div style={{ padding: '58px 22px 6px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <PillLabel>FAMILY RESULT</PillLabel>
      </div>
      <div style={{
        margin: '18px 18px 0',
        background: proto.white,
        border: `3px solid ${proto.black}`,
        borderRadius: 16,
        boxShadow: '6px 6px 0 #000',
        textAlign: 'center',
        overflow: 'hidden',
      }}>
        <div style={{
          background: proto.black,
          color: proto.white,
          padding: '9px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          fontFamily: proto.caption,
          fontSize: 10,
          letterSpacing: '0.18em',
        }}>
          <span>FAMILY BOND RESULT</span>
          <span style={{
            background: proto.cyan,
            color: proto.black,
            padding: '4px 9px',
            borderRadius: 999,
            border: `1.5px solid ${proto.white}`,
            fontFamily: proto.body,
            fontSize: 9,
            fontWeight: 900,
          }}>個別判定</span>
        </div>
        <PlayerScoreBoard
          answers={answers}
          players={familyPlayers}
          label="それぞれ何問当たった？"
        />
        <div style={{
          margin: '14px 18px 18px',
          padding: '12px 12px',
          background: proto.white,
          border: `2.5px solid ${proto.black}`,
          borderRadius: 12,
          boxShadow: '3px 3px 0 #000',
          fontSize: 12,
          color: proto.text,
          lineHeight: 1.75,
          fontWeight: 700,
        }}>答え合わせで、誰がどの問題を当てたかまとめて確認できます。</div>
      </div>
      </div>

      <div style={{ padding: '20px 18px 0', position: 'relative', zIndex: 1 }}>
        <div style={{
          width: '100%',
          minHeight: 54,
          background: proto.black,
          color: proto.white,
          border: `2.5px solid ${proto.black}`,
          borderRadius: 14,
          boxShadow: '5px 5px 0 #5BD4E8',
          fontFamily: proto.display,
          fontSize: 16,
          fontWeight: 900,
          letterSpacing: '0.04em',
          textShadow: '2px 2px 0 #5BD4E8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          答え合わせ
        </div>
        <MultiPlayerAnswerDetails
          answers={answers}
          cards={cards}
          players={familyPlayers}
          label="ANSWER DETAILS"
        />
      </div>

      <div style={{ padding: '22px 18px 0', position: 'relative', zIndex: 1 }}>
        <ResultImageActions
          busy={imageBusy}
          onShare={handleShareImage}
          status={imageStatus}
        />
        <button onClick={copyShareText} style={textOnlyBtn()}>
          {copied ? 'シェア文をコピーしました' : '文章だけコピーする'}
        </button>
        {copied && (
          <div style={{
            marginTop: 8, padding: '6px 10px', borderRadius: 8,
            background: proto.yellow, color: proto.black, fontSize: 11,
            textAlign: 'center', fontWeight: 700,
            border: `2px solid ${proto.black}`,
          }}>
            シェア文をコピーしました
          </div>
        )}
        <ResultReplayActions
          primaryLabel="同じ人数でもう一度"
          onPrimary={onReplay}
          secondaryLabel="トップに戻る"
          onSecondary={onHome}
        />
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <FooterLink onClick={onAbout}>About / お問い合わせ</FooterLink>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// ABOUT
// ─────────────────────────────────────────────────────
function AboutScreen({ onBack, onLove, onFriend, onFamily }) {
  return (
    <div style={{ minHeight: '100vh', background: proto.pink, paddingBottom: 40 }}>
      <div style={{
        background: proto.black, padding: '50px 24px 28px',
        textAlign: 'center', position: 'relative',
        overflow: 'hidden',
      }}>
        <BackBtn onClick={onBack} top={50} dark label="トップに戻る" />
        {/* 女の子: ヘッダー左下から覗く (左向きに反転) */}
        <div style={{
          position: 'absolute',
          left: -24, bottom: -8,
          opacity: 0.9, pointerEvents: 'none',
          filter: 'drop-shadow(0 4px 12px rgba(255,77,109,0.4))',
        }}>
          <Girl variant="default" height={160} flip />
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 32, marginBottom: 4 }}>💌</div>
          <LogoText size={26}>About</LogoText>
          <div style={{
            fontFamily: proto.caption, fontSize: 10, color: proto.white,
            opacity: 0.7, marginTop: 4, letterSpacing: '0.25em',
          }}>STREET BOARD GAME とは</div>
        </div>
      </div>

      <div style={{ padding: '24px 22px' }}>
        <SectionTitle>♡ コンセプト</SectionTitle>
        <Card>
          <div style={{ fontSize: 12, lineHeight: 1.8, color: proto.text, fontWeight: 600 }}>
            ストリートボードゲームは、彼氏が彼女の答えを当てる
            「彼氏の愛情判定ゲーム」をメインにしたオリジナルゲームサイトです。
            そのシリーズとして、友達の友情判定や家族の絆判定など、
            2人〜数人で気軽に遊べるゲームを展開しています。
          </div>
        </Card>

        <SectionTitle style={{ marginTop: 22 }}>♡ シリーズ展開</SectionTitle>
        <Card>
          <SeriesRow emoji="💕" title="彼氏の愛情判定" sub="公開中" active onClick={onLove} />
          <SeriesRow emoji="👯" title="友達の友情判定" sub="公開中" active onClick={onFriend} />
          <SeriesRow emoji="👨‍👩‍👧" title="家族の絆判定" sub="公開中" active onClick={onFamily} last />
        </Card>

        <div id="contact-section" style={{ scrollMarginTop: 20 }}>
          <SectionTitle style={{ marginTop: 22 }}>♡ お問い合わせ</SectionTitle>
          <Card>
            <ContactForm />
          </Card>
        </div>

        <div style={{
          marginTop: 22, padding: '10px 0', textAlign: 'center',
          fontFamily: proto.caption, fontSize: 10,
          color: proto.white, letterSpacing: '0.15em', opacity: 0.7,
        }}>
          © 2026 streetboardgame.com
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children, style = {} }) {
  return (
    <div style={{
      display: 'inline-block', padding: '4px 14px',
      background: proto.yellow, color: proto.black,
      border: `2px solid ${proto.black}`,
      borderRadius: 8, marginBottom: 10,
      fontFamily: proto.body, fontSize: 13, fontWeight: 800,
      transform: 'rotate(-1deg)',
      boxShadow: '2px 2px 0 #000',
      ...style,
    }}>{children}</div>
  );
}

function Card({ children }) {
  return (
    <div style={{
      padding: 16, background: proto.white,
      border: `2.5px solid ${proto.black}`,
      borderRadius: 16, boxShadow: proto.shadowHard,
    }}>{children}</div>
  );
}

function SeriesRow({ emoji, title, sub, active, last, onClick }) {
  const clickable = typeof onClick === 'function';
  const content = (
    <>
      <div style={{ fontSize: 22 }}>{emoji}</div>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: proto.text }}>{title}</div>
        <div style={{
          fontFamily: proto.caption, fontSize: 10,
          color: active ? proto.pink : proto.textSoft,
          marginTop: 1, letterSpacing: '0.1em',
        }}>{sub}</div>
      </div>
      {active && <div style={{
        padding: '3px 10px', borderRadius: 999,
        background: proto.pink, color: proto.white,
        border: `1.5px solid ${proto.black}`,
        fontSize: 9, fontWeight: 800, letterSpacing: '0.05em',
      }}>NEW</div>}
    </>
  );
  const style = {
    width: '100%',
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '8px 0',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    borderBottom: last ? 'none' : `1px dashed ${proto.pink}`,
    background: 'transparent',
    fontFamily: proto.body,
    cursor: clickable ? 'pointer' : 'default',
  };

  if (clickable) {
    return (
      <button type="button" onClick={onClick} style={style} aria-label={`${title}を開く`}>
        {content}
      </button>
    );
  }

  return (
    <div style={style}>
      {content}
    </div>
  );
}

function ContactForm() {
  // 送信状態: 'idle' | 'sending' | 'sent' | 'error'
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xrevejjr';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === 'sending') return;

    const form = e.currentTarget;
    const formData = new FormData(form);

    setStatus('sending');
    setErrorMsg('');

    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' },
      });

      if (res.ok) {
        setStatus('sent');
        form.reset();
        // GA イベント
        if (typeof window.trackEvent === 'function') {
          window.trackEvent('contact_form_submit', { result: 'success' });
        }
        // 5秒後に idle に戻す
        setTimeout(() => setStatus('idle'), 5000);
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = (data.errors && data.errors[0] && data.errors[0].message)
          || '送信に失敗しました。時間をおいて再度お試しください。';
        setStatus('error');
        setErrorMsg(msg);
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg('通信エラーが発生しました。ネット接続を確認してください。');
    }
  };

  const sending = status === 'sending';
  const sent = status === 'sent';
  const error = status === 'error';

  return (
    <form onSubmit={handleSubmit}>
      {/* Formspree: 件名を指定 */}
      <input type="hidden" name="_subject" value="streetboardgame.com お問い合わせ" />
      {/* スパム対策 honeypot (人間は触らない隠しフィールド) */}
      <input type="text" name="_gotcha" style={{ display: 'none' }} tabIndex="-1" autoComplete="off" />

      <input name="name" aria-label="お名前" placeholder="お名前" required style={inputStyle} disabled={sending} />
      <input name="email" type="email" aria-label="メールアドレス" placeholder="メールアドレス" required style={inputStyle} disabled={sending} />
      <textarea name="message" aria-label="メッセージ" placeholder="メッセージ" rows={4} required style={{...inputStyle, resize: 'none'}} disabled={sending} />

      {error && (
        <div style={{
          marginTop: 4, marginBottom: 8, padding: '8px 12px',
          background: '#FFE5E5', color: '#C8323C',
          border: `1.5px solid #C8323C`, borderRadius: 8,
          fontSize: 11, fontWeight: 600, lineHeight: 1.5,
        }}>⚠ {errorMsg}</div>
      )}

      <button type="submit" disabled={sending || sent} style={{
        width: '100%', padding: '12px', marginTop: 4,
        background: sent ? '#06C755' : (sending ? '#7A5A62' : proto.pink),
        color: proto.white,
        border: `2.5px solid ${proto.black}`,
        borderRadius: 12,
        fontSize: 13, fontWeight: 800, fontFamily: proto.body,
        boxShadow: '3px 3px 0 #000',
        cursor: (sending || sent) ? 'default' : 'pointer',
        opacity: sending ? 0.7 : 1,
      }}>
        {sent ? '✓ 送信しました' : (sending ? '送信中…' : '送信する ✉')}
      </button>

      {sent && (
        <div style={{
          marginTop: 10, padding: '10px 12px',
          background: 'rgba(6,199,85,0.1)', color: proto.text,
          borderRadius: 8, fontSize: 11, fontWeight: 600,
          textAlign: 'center', lineHeight: 1.6,
        }}>
          お問い合わせありがとうございます ♡<br/>
          内容を確認後、ご返信いたします
        </div>
      )}
    </form>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 14px', marginBottom: 8,
  borderRadius: 10,
  border: `2px solid ${proto.black}`,
  fontSize: 12, background: '#FFF', color: proto.text,
  outline: 'none', fontFamily: proto.body,
  boxSizing: 'border-box', fontWeight: 600,
};

// ─────────────────────────────────────────────────────
// PRODUCT
// ─────────────────────────────────────────────────────
function ProductScreen({ onBack }) {
  return (
    <div style={{ minHeight: '100vh', background: proto.pink, paddingBottom: 40 }}>
      <div style={{
        background: proto.black, padding: '50px 24px 24px',
        textAlign: 'center', position: 'relative',
      }}>
        <BackBtn onClick={onBack} top={50} dark label="トップに戻る" />
        <PillLabel>MORE FUN ♡</PillLabel>
        <div style={{ marginTop: 14 }}>
          <LogoText size={22}>製品版もあります</LogoText>
        </div>
      </div>

      <div style={{ padding: '24px 22px 0' }}>
        <div style={{
          padding: 4,
          background: proto.yellow,
          border: `3px solid ${proto.black}`,
          borderRadius: 20,
          boxShadow: '5px 5px 0 #000',
        }}>
          <div style={{ background: proto.white, borderRadius: 16, padding: 16 }}>
            {/* 商品プレースホルダ画像: 本物のパッケージレイアウト再現 */}
            <div style={{
              width: '100%', aspectRatio: '1 / 1', borderRadius: 12,
              background: proto.pink,
              border: `2.5px solid ${proto.black}`,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(circle at 22% 26%, rgba(255,255,255,0.16) 0 24px, transparent 25px), radial-gradient(circle at 76% 72%, rgba(255,226,107,0.18) 0 58px, transparent 59px)',
                pointerEvents: 'none',
              }} />
              {/* 上部のキャプション */}
              <div style={{
                position: 'absolute', top: 18, left: 18,
                padding: '6px 16px', borderRadius: 999,
                background: proto.white, color: proto.pinkDeep,
                fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap',
                fontFamily: proto.body, zIndex: 3,
              }}>彼氏の愛情判定ゲーム</div>

              <div style={{
                position: 'absolute',
                top: 23,
                right: 20,
                zIndex: 3,
                background: proto.black,
                color: proto.yellow,
                borderRadius: 5,
                padding: '4px 9px',
                fontFamily: proto.caption,
                fontSize: 9,
                letterSpacing: '0.14em',
                transform: 'rotate(-2deg)',
              }}>54 QUESTIONS</div>

              {/* 女の子 (左下、全身ポーズ) */}
              <div style={{
                position: 'absolute', left: 20, bottom: 42,
                filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.22))',
                zIndex: 2,
              }}>
                <Girl variant="full" height={230} />
              </div>

              {/* タイトルテキスト (右上寄り、縦組み風) */}
              <div style={{
                position: 'absolute',
                top: 74, right: 18,
                textAlign: 'right',
                zIndex: 4,
                maxWidth: '48%',
              }}>
                <LogoText size={21}>私のこと、</LogoText>
                <div style={{ marginTop: 3 }}><LogoText size={21}>ちゃんと</LogoText></div>
                <div style={{ marginTop: 3 }}><LogoText size={21}>分かってる</LogoText></div>
                <div style={{ marginTop: 3 }}><LogoText size={21}>よね？</LogoText></div>
              </div>

              <div style={{
                position: 'absolute',
                right: 16,
                bottom: 86,
                zIndex: 3,
                display: 'none',
                gap: 5,
              }}>
                {['2人〜', '10分〜', 'カード54問'].map((label) => (
                  <div key={label} style={{
                    minWidth: 86,
                    textAlign: 'center',
                    background: proto.white,
                    color: proto.black,
                    border: `2px solid ${proto.black}`,
                    borderRadius: 999,
                    padding: '5px 9px',
                    fontSize: 11,
                    fontWeight: 900,
                    boxShadow: '2px 2px 0 #000',
                  }}>{label}</div>
                ))}
              </div>

              {/* 付箋: 右下隅、タイトルとは離れた位置に配置 */}
              <div style={{ position: 'absolute', bottom: 14, right: 18, zIndex: 5 }}>
                <StickyNote rotate={-6} size={76}>
                  <div style={{ fontSize: 5.8, lineHeight: 1.28, fontWeight: 900, letterSpacing: 0 }}>
                    このゲームを<br/>
                    キッカケに<br/>
                    別れても<br/>
                    一切責任は<br/>
                    <span style={{ color: proto.pinkDeep, fontWeight: 900 }}>負いません</span>
                  </div>
                </StickyNote>
              </div>
            </div>

            <div style={{
              display: 'inline-block', padding: '3px 10px', marginTop: 14,
              background: proto.black, color: proto.yellow,
              fontFamily: proto.caption, fontSize: 10, fontWeight: 700,
              letterSpacing: '0.15em', borderRadius: 4,
            }}>BOARD GAME EDITION</div>
            <div style={{ marginTop: 10 }}>
              <LogoText size={20} color={proto.pink} outline={proto.black} lineHeight={1.3}>
                私のこと、<br/>ちゃんと分かってるよね？
              </LogoText>
            </div>
            <div style={{
              fontSize: 12, color: proto.textSoft, marginTop: 6, fontWeight: 600,
            }}>
              54問入り・カードゲーム版
            </div>

            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <Feature label="54問" />
              <Feature label="2人〜" />
              <Feature label="10分〜" />
            </div>

            <a
              href={AMAZON_URL}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'block', textAlign: 'center', textDecoration: 'none',
                width: '100%', padding: '12px', marginTop: 16, boxSizing: 'border-box',
                background: '#FF9900', color: proto.white,
                border: `2.5px solid ${proto.black}`,
                borderRadius: 12, fontSize: 14, fontWeight: 800,
                fontFamily: proto.body, letterSpacing: '0.05em',
                boxShadow: '3px 3px 0 #000',
              }}
            >Amazonで購入する →</a>
            <div style={{
              marginTop: 8, textAlign: 'center',
              fontFamily: proto.caption, fontSize: 9,
              color: proto.textSoft, letterSpacing: '0.05em',
            }}>
              ※ Amazonアフィリエイトを利用しています
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 22px 0' }}>
        <SectionTitle>♡ こんな場面にぴったり</SectionTitle>
        {[
          ['🌙', 'デート中の沈黙タイムに'],
          ['🎂', '記念日や誕生日に'],
          ['🍷', '宅飲み・お泊まり会に'],
          ['💌', 'プレゼントとしても'],
        ].map(([e, t], i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px', marginBottom: 8,
            background: proto.white,
            border: `2.5px solid ${proto.black}`,
            borderRadius: 12,
            boxShadow: '3px 3px 0 #000',
          }}>
            <div style={{ fontSize: 22 }}>{e}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: proto.text }}>{t}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Feature({ label }) {
  return (
    <div style={{
      flex: 1, padding: '6px 0', textAlign: 'center',
      background: proto.pink, color: proto.white,
      border: `2px solid ${proto.black}`,
      borderRadius: 8,
      fontFamily: proto.display, fontSize: 13, fontWeight: 800,
      textShadow: '1px 1px 0 #000',
      boxShadow: '2px 2px 0 #000',
    }}>{label}</div>
  );
}

// ─────────────────────────────────────────────────────
// 共通ボタン
// ─────────────────────────────────────────────────────
function primaryBtn() {
  return {
    width: '100%', minHeight: 60, padding: '17px 16px',
    background: proto.black, color: proto.white,
    border: `2.5px solid ${proto.black}`,
    borderRadius: 14,
    fontSize: 16, fontWeight: 800, fontFamily: proto.display,
    lineHeight: 1.25,
    boxShadow: '4px 4px 0 #5BD4E8', // シアンの落影
    letterSpacing: '0.08em', cursor: 'pointer',
    touchAction: 'manipulation',
    userSelect: 'none',
    transition: 'transform 0.1s',
    textShadow: '1px 1px 0 #5BD4E8',
  };
}

function secondaryBtn() {
  return {
    width: '100%', minHeight: 56, padding: '14px 16px',
    background: proto.white, color: proto.black,
    border: `2.5px solid ${proto.black}`,
    borderRadius: 14,
    fontSize: 13, fontWeight: 800, fontFamily: proto.body,
    boxShadow: '3px 3px 0 #000',
    touchAction: 'manipulation',
    userSelect: 'none',
    cursor: 'pointer',
  };
}

function textOnlyBtn() {
  return {
    display: 'block',
    width: '100%',
    marginTop: 10,
    padding: '8px 10px',
    background: 'transparent',
    border: 'none',
    color: proto.white,
    fontFamily: proto.body,
    fontSize: 12,
    fontWeight: 900,
    textDecoration: 'underline',
    textUnderlineOffset: 4,
    cursor: 'pointer',
  };
}

function resultHeroStyle() {
  return {
    minHeight: 'calc(100dvh - 142px)',
    padding: '34px 0 20px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 1,
  };
}

function srOnlyStyle() {
  return {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  };
}

// 戻るボタン
function BackBtn({ onClick, top = 20, dark = false, label = '戻る' }) {
  return (
    <button onClick={onClick} aria-label={label} style={{
      position: 'absolute', top, left: 18,
      width: 44, height: 44, borderRadius: 999,
      background: dark ? proto.white : 'rgba(255,255,255,0.85)',
      backdropFilter: 'blur(10px)',
      border: `2px solid ${proto.black}`,
      color: proto.black,
      fontSize: 18, cursor: 'pointer', zIndex: 50,
      boxShadow: '2px 2px 0 #000',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800,
    }}>←</button>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
