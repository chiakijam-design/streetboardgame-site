import { LIVE_AGE_NOTICE } from './src/live/age-notice.js';
import { BOARD_GAME_PRODUCT } from './src/product/config.js';

const { useEffect, useState } = React;
const CREATOR_QUICK_START_KEY = 'watachan:creator-quick-start:v1';

const theme = {
  pink: '#EC4F88',
  pinkDeep: '#D63A75',
  cyan: '#5BD4E8',
  yellow: '#FFE26B',
  black: '#1A1A1A',
  white: '#FFFFFF',
  cream: '#FFF8F1',
  display: '"RocknRoll One", "Zen Maru Gothic", sans-serif',
  body: '"Zen Maru Gothic", sans-serif',
  caption: '"DotGothic16", monospace',
};

function App() {
  const requested = window.__INITIAL_SCREEN || 'top';
  const screen = ['top', 'challengePage', 'about', 'product'].includes(requested) ? requested : 'top';
  window.__INITIAL_SCREEN = null;

  useEffect(() => {
    window.scrollTo(0, 0);
    if (screen !== 'about' || !window.__SCROLL_TO_CONTACT) return;
    window.__SCROLL_TO_CONTACT = false;
    requestAnimationFrame(() => document.getElementById('contact-section')?.scrollIntoView());
  }, [screen]);

  if (screen === 'challengePage') return <ChallengeGuide />;
  if (screen === 'about') return <AboutPage />;
  if (screen === 'product') return <ProductPage />;
  return <TopPage />;
}

function TopPage() {
  const [creatorName, setCreatorName] = useState('');
  const [error, setError] = useState('');

  const start = (mode) => {
    const name = creatorName.trim();
    if (!name) {
      setError('名前を入力してください。');
      return;
    }
    try {
      sessionStorage.setItem(CREATOR_QUICK_START_KEY, JSON.stringify({ mode, name, createdAt: Date.now() }));
    } catch (_) {
      setError('ブラウザの一時保存を利用できません。設定を確認してください。');
      return;
    }
    location.assign(mode === 'live' ? '/live-challenge' : '/challenge');
  };

  return (
    <main aria-labelledby="site-title" style={pageStyle()}>
      <Decor />
      <h1 id="site-title" style={srOnly()}>
        わたし理解度診断｜私のこと、ちゃんと分かってるよね？
      </h1>
      <section style={{ padding: '50px 20px 20px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <Pill>わたし理解度診断</Pill>
        <div style={{ marginTop: 26 }}>
          <Logo>私のこと、</Logo>
          <Logo>ちゃんと</Logo>
          <Logo>分かってるよね？</Logo>
        </div>
        <p style={{ margin: '14px 0 0', color: theme.white, fontWeight: 900, fontSize: 16 }}>
          当てるより、話すための10問。
        </p>
        <p style={{ margin: '8px 0 0', color: theme.white, opacity: .85, fontFamily: theme.caption, fontSize: 10, letterSpacing: '.2em' }}>
          STREET BOARD GAME / vol.01
        </p>
      </section>

      <div data-testid="top-character-visual" style={{
        minHeight: 315,
        padding: '4px 14px 20px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ width: '42%', maxWidth: 210, marginRight: -42, zIndex: 2 }}>
          <Girl
            variant="full"
            height={310}
            loading="eager"
            fetchPriority="high"
            alt="わたし理解度診断のメインキャラクター"
          />
        </div>
        <CommonCardStack />
      </div>

      <section data-testid="top-common-rules" aria-labelledby="rules-title" style={{
        margin: '0 24px 22px',
        padding: '18px 16px 16px',
        position: 'relative',
        zIndex: 1,
        background: 'linear-gradient(160deg, #FFD6E5 0%, #FFEAF1 100%)',
        color: theme.black,
        border: `3px solid ${theme.black}`,
        borderRadius: 18,
        boxShadow: `5px 5px 0 ${theme.pinkDeep}`,
      }}>
        <h2 id="rules-title" style={{ margin: 0, textAlign: 'center', fontSize: 18, lineHeight: 1.5 }}>
          あなたの「わたし理解度診断」を作って、<br />みんなに挑戦してもらおう
        </h2>
        <Rules />
        <form onSubmit={(event) => { event.preventDefault(); start('challenge'); }} style={{
          display: 'grid',
          gap: 10,
          marginTop: 16,
          paddingTop: 14,
          borderTop: `2px dashed ${theme.black}`,
        }}>
          <label htmlFor="top-creator-name" style={{ fontSize: 12, fontWeight: 900 }}>
            あなたの名前（12文字まで）
          </label>
          <input
            id="top-creator-name"
            value={creatorName}
            maxLength={12}
            autoComplete="nickname"
            placeholder="例：ちあき"
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'top-name-error' : undefined}
            onChange={(event) => { setCreatorName(event.target.value.slice(0, 12)); setError(''); }}
            style={inputStyle()}
          />
          {error && <p id="top-name-error" role="alert" style={{ margin: 0, color: '#B81745', fontSize: 12, fontWeight: 900 }}>{error}</p>}
          <button type="submit" aria-label="みんなに挑戦してもらう" style={primaryButton()}>
            みんなに挑戦してもらう <span style={{ color: theme.yellow }}>▶</span>
          </button>
          <p style={buttonNote()}>10問を作る → 自分の正解を登録 → 参加URLを送る</p>
          <button type="button" aria-label="ライブ配信でみんなに挑戦してもらう" onClick={() => start('live')} style={primaryButton()}>
            ライブ配信でみんなに挑戦してもらう <span style={{ color: theme.yellow }}>▶</span>
          </button>
          <p data-testid="live-age-notice" style={noticeStyle()}>⚠️ {LIVE_AGE_NOTICE}</p>
          <p style={buttonNote()}>10問を作る → 配信で参加方法を案内 → 視聴者と同時回答</p>
        </form>
      </section>

      <nav aria-label="ゲームシリーズの紹介ページ" style={{ padding: '4px 24px 0', position: 'relative', zIndex: 1 }}>
        <h2 style={{ margin: '0 0 10px', color: theme.white, fontSize: 14 }}>まずはどんなゲームか知りたい</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
          <ModeLink href="/challenge-guide" icon="📣" title="みんなに挑戦してもらう" note="10問・最大50人" />
          <ModeLink href="/live-challenge" icon="🎙️" title="ライブ配信でみんなに挑戦してもらう" note="10問・最大1,000人" />
        </div>
      </nav>
      <SiteFooter />
    </main>
  );
}

function Rules() {
  const steps = [
    'あなたが、出題する10問を選ぶ・作る',
    '自分の正解を選ぶ',
    'URL・QRコードで友達に問題を送信',
    '何問正解かでみんなの理解度を診断',
  ];
  const colors = [theme.cyan, theme.pink, theme.yellow, theme.white];
  return (
    <ol style={{ display: 'grid', gap: 8, margin: '14px 0 0', padding: 0, listStyle: 'none' }}>
      {steps.map((step, index) => (
        <li key={step} data-testid="top-common-rule-step" style={{
          display: 'grid',
          gridTemplateColumns: '34px minmax(0,1fr)',
          gap: 10,
          alignItems: 'center',
          minHeight: 46,
          padding: '7px 10px 7px 8px',
          border: `2px solid ${theme.black}`,
          borderRadius: 12,
          background: theme.white,
          boxShadow: '2px 2px 0 #000',
          fontSize: 12,
          lineHeight: 1.55,
          fontWeight: 900,
        }}>
          <b style={{
            display: 'grid',
            placeItems: 'center',
            width: 32,
            height: 32,
            border: `2px solid ${theme.black}`,
            borderRadius: '50%',
            background: colors[index],
            color: index === 1 ? theme.white : theme.black,
          }}>{index + 1}</b>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

function CommonCardStack() {
  const cards = [
    ['休日にしたいこと', ['動画を見る', '買い物', 'ゲーム', '外へ行く', 'のんびり']],
    ['今ほしいもの', ['時間', '旅行', '服', 'ごほうび', '睡眠']],
    ['好きな食べもの', ['お寿司', '焼き肉', 'とんかつ', 'ラーメン', 'パンケーキ']],
  ];
  return (
    <div aria-hidden="true" style={{ position: 'relative', width: '58%', maxWidth: 300, height: 215 }}>
      {cards.map(([title, choices], index) => (
        <div key={title} style={{
          position: 'absolute',
          top: [22, 0, 30][index],
          left: [0, '28%', '52%'][index],
          width: 118,
          minHeight: 175,
          padding: '10px 8px',
          overflow: 'hidden',
          transform: `rotate(${[-8, 4, -3][index]}deg)`,
          zIndex: [1, 3, 2][index],
          border: '3px solid #fff',
          borderRadius: 10,
          background: 'repeating-linear-gradient(#fff 0 23px,#b8ddea 24px 25px)',
          boxShadow: '0 12px 24px rgba(0,0,0,.25)',
          color: theme.black,
          fontFamily: theme.body,
        }}>
          <div style={{ padding: '8px 4px', background: '#74C7E3', fontSize: 10, fontWeight: 900, textAlign: 'center' }}>{title}</div>
          {choices.map((choice, choiceIndex) => (
            <div key={choice} style={{ display: 'grid', gridTemplateColumns: '12px 1fr', gap: 5, alignItems: 'center', minHeight: 24, fontSize: 8 }}>
              <i style={{ width: 9, height: 9, borderRadius: '50%', background: ['#77bb62', '#3f78bd', '#f5c83b', '#d3313b', '#ef8730'][choiceIndex] }} />
              <span>{choice}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ChallengeGuide() {
  return (
    <main style={pageStyle()}>
      <Header title="みんなに挑戦してもらう" label="CHALLENGE" />
      <div style={contentWrap()}>
        <Panel>
          <h2 style={{ margin: 0, fontSize: 20 }}>あなたの答えを、最大50人が予想します</h2>
          <p style={paragraph()}>
            自分が選んだ10問へ先に答え、発行された参加URLをみんなに送る無料クイズです。
            参加者はあなたの答えを予想し、10問の答え合わせから理解度を確かめます。
          </p>
          <p style={paragraph()}>
            問題は共通のお題ライブラリから1問ずつ選び、スキップ・編集・自作もできます。
            結果公開は任意で、もう一度答えを予想することもできます。
          </p>
        </Panel>
        <Panel dark>
          <h2 style={{ margin: '0 0 12px', fontSize: 17 }}>遊び方</h2>
          {['名前を入力して10問を選ぶ・作る', '自分の正解を登録する', '参加URL・QRコードを送る', '10問の答え合わせを見る'].map((item, index) => (
            <div key={item} style={{ marginTop: 8, padding: 10, borderRadius: 10, background: theme.white, color: theme.black, fontWeight: 900, fontSize: 13 }}>
              {index + 1}. {item}
            </div>
          ))}
        </Panel>
        <a href="/challenge" style={{ ...primaryButton(), textDecoration: 'none', display: 'flex' }}>
          10問クイズを作る <span style={{ color: theme.yellow }}>▶</span>
        </a>
        <Panel>
          <h2 style={{ margin: '0 0 10px', fontSize: 17 }}>よくある質問</h2>
          <p style={paragraph()}><b>無料で遊べますか？</b><br />クイズ作成、参加URLの共有、答え合わせを無料で利用できます。</p>
          <p style={paragraph()}><b>何人まで参加できますか？</b><br />1つのクイズへ最大50人まで参加できます。</p>
        </Panel>
      </div>
      <SiteFooter />
    </main>
  );
}

function AboutPage() {
  return (
    <main style={pageStyle()}>
      <Header title="About" label="STREETBOARDGAME" />
      <div style={contentWrap()}>
        <Panel>
          <h2 style={{ marginTop: 0 }}>当てるより、話すための10問。</h2>
          <p style={paragraph()}>
            「私のこと、ちゃんと分かってるよね？」は、自分の答えをみんなに予想してもらい、
            答え合わせから次の会話を生む「わたし理解度診断」です。
          </p>
          <p style={paragraph()}>
            通常版とLIVE版は同じお題ライブラリを使い、結果公開と理解度ボードへの掲載は自分で選べます。
          </p>
        </Panel>
        <Panel>
          <h2 id="contact-section" style={{ marginTop: 0 }}>お問い合わせ</h2>
          <p style={paragraph()}>不具合・掲載内容・サービスについてのお問い合わせは、専用フォームから受け付けています。</p>
          <a href="https://docs.google.com/forms/d/e/1FAIpQLSeQeT5BD6t9JScWcPoBYPyQIEeQADfImSu1uGyJcSnJqnM8gA/viewform" rel="noopener noreferrer" target="_blank" style={{ ...primaryButton(), display: 'flex', textDecoration: 'none' }}>
            お問い合わせフォーム
          </a>
        </Panel>
        <HomeLink />
      </div>
      <SiteFooter />
    </main>
  );
}

function ProductPage() {
  return (
    <main style={pageStyle()}>
      <Header title="製品版もあります" label="BOARD GAME EDITION" />
      <div style={contentWrap()}>
        <Panel>
          <h2 style={{ marginTop: 0 }}>{BOARD_GAME_PRODUCT.title}</h2>
          <p style={paragraph()}>{BOARD_GAME_PRODUCT.description}</p>
          <p style={paragraph()}>
            スマホを置いてカードを囲み、その場で選んだ答えを見せ合える54問入りの製品版です。
          </p>
          <a href={BOARD_GAME_PRODUCT.amazonUrl} rel="sponsored noopener noreferrer" target="_blank" style={{ ...primaryButton(), display: 'flex', textDecoration: 'none' }}>
            {BOARD_GAME_PRODUCT.cta}
          </a>
          <p style={{ margin: '10px 0 0', fontSize: 12 }}>{BOARD_GAME_PRODUCT.disclosure}</p>
        </Panel>
        <HomeLink />
      </div>
      <SiteFooter />
    </main>
  );
}

function Header({ title, label }) {
  return (
    <header style={{ padding: '48px 22px 30px', background: theme.black, color: theme.white, textAlign: 'center', position: 'relative' }}>
      <a href="/" style={{ position: 'absolute', top: 18, left: 18, padding: '10px 14px', borderRadius: 999, background: theme.white, color: theme.black, border: `2px solid ${theme.black}`, textDecoration: 'none', fontWeight: 900 }}>
        ← トップへ
      </a>
      <Pill>{label}</Pill>
      <h1 style={{ margin: '16px 0 0', fontSize: 'clamp(28px,8vw,42px)', textShadow: `3px 3px 0 ${theme.cyan}` }}>{title}</h1>
    </header>
  );
}

function Panel({ children, dark = false }) {
  return (
    <section style={{
      padding: 16,
      background: dark ? theme.black : theme.white,
      color: dark ? theme.white : theme.black,
      border: `3px solid ${theme.black}`,
      borderRadius: 14,
      boxShadow: '4px 4px 0 #1A1A1A',
    }}>{children}</section>
  );
}

function HomeLink() {
  return <a href="/" style={{ ...primaryButton(), display: 'flex', textDecoration: 'none' }}>トップページへ戻る</a>;
}

function SiteFooter() {
  const links = [['About', '/about'], ['人気のお題', '/challenge/library'], ['製品版', '/product'], ['利用規約', '/terms'], ['プライバシー', '/privacy'], ['特商法表記', '/legal']];
  return (
    <footer style={{ padding: '24px 20px 32px', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '10px 18px', position: 'relative', zIndex: 1 }}>
      {links.map(([label, href]) => <a key={href} href={href} style={{ color: theme.white, fontSize: 12, fontWeight: 800 }}>{label}</a>)}
    </footer>
  );
}

function ModeLink({ href, icon, title, note }) {
  return (
    <a href={href} style={{ minHeight: 112, padding: 12, borderRadius: 14, border: `2px solid ${theme.yellow}`, boxShadow: '3px 3px 0 #000', background: 'rgba(255,255,255,.2)', color: theme.white, textAlign: 'center', textDecoration: 'none' }}>
      <div style={{ fontSize: 28 }}>{icon}</div>
      <div style={{ marginTop: 4, fontSize: 12, fontWeight: 900, lineHeight: 1.5 }}>{title}</div>
      <span style={{ display: 'inline-block', marginTop: 7, padding: '3px 8px', borderRadius: 999, background: theme.yellow, color: theme.black, fontSize: 10, fontWeight: 900 }}>{note}</span>
    </a>
  );
}

function Pill({ children }) {
  return <span style={{ display: 'inline-flex', minHeight: 32, alignItems: 'center', padding: '5px 14px', borderRadius: 999, border: '2px solid currentColor', color: theme.white, fontFamily: theme.caption, fontSize: 11, letterSpacing: '.12em', fontWeight: 900 }}>{children}</span>;
}

function Logo({ children }) {
  return <div style={{ color: theme.white, fontFamily: theme.display, fontSize: 'clamp(34px,10vw,48px)', lineHeight: 1.2, textShadow: `4px 4px 0 ${theme.cyan}` }}>{children}</div>;
}

function Decor() {
  return <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 12% 10%,rgba(255,255,255,.2) 0 5px,transparent 6px),radial-gradient(circle at 88% 20%,rgba(255,255,255,.15) 0 4px,transparent 5px)' }} />;
}

function pageStyle() {
  return { minHeight: '100dvh', background: theme.pink, color: theme.black, fontFamily: theme.body, position: 'relative', overflow: 'hidden' };
}

function contentWrap() {
  return { display: 'grid', gap: 18, maxWidth: 720, margin: '0 auto', padding: '24px 20px' };
}

function paragraph() {
  return { margin: '10px 0 0', fontSize: 14, lineHeight: 1.85, fontWeight: 700 };
}

function inputStyle() {
  return { width: '100%', minHeight: 50, padding: '11px 14px', border: `2.5px solid ${theme.black}`, borderRadius: 12, background: theme.white, color: theme.black, fontFamily: theme.body, fontSize: 16, fontWeight: 800, boxShadow: '2px 2px 0 #000', outline: 'none' };
}

function primaryButton() {
  return { width: '100%', minHeight: 60, padding: '14px 16px', alignItems: 'center', justifyContent: 'center', gap: 6, border: `2.5px solid ${theme.black}`, borderRadius: 14, background: theme.black, color: theme.white, boxShadow: `4px 4px 0 ${theme.cyan}`, fontFamily: theme.display, fontSize: 16, fontWeight: 800, lineHeight: 1.35, textAlign: 'center', cursor: 'pointer' };
}

function buttonNote() {
  return { margin: '-2px 0 1px', fontSize: 10, lineHeight: 1.55, textAlign: 'center', fontWeight: 800 };
}

function noticeStyle() {
  return { margin: '8px 0 1px', padding: '9px 10px', border: `2px solid ${theme.black}`, borderRadius: 10, background: '#FFF9D7', color: theme.black, fontSize: 12, lineHeight: 1.6, textAlign: 'left', fontWeight: 900 };
}

function srOnly() {
  return { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 };
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
