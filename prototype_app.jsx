import { LIVE_AGE_NOTICE } from './src/live/age-notice.js';
import { BOARD_GAME_PRODUCT } from './src/product/config.js';
import { renderNotebookQuestionCard } from './src/challenge/question-card.js';

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
        <p data-testid="product-positioning" style={{
          margin: '0 0 12px',
          textAlign: 'center',
          color: theme.pinkDeep,
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: '.04em',
        }}>
          通常でも配信でも使える理解度診断メーカー
        </p>
        <h2 id="rules-title" style={{ margin: 0, textAlign: 'center', fontSize: 18, lineHeight: 1.5 }}>
          あなたの「わたし理解度診断」を作って、<br />みんなに挑戦してもらおう
        </h2>
        <p data-testid="brand-promise" style={{
          margin: '12px 0 0',
          padding: '10px 12px',
          border: `2px solid ${theme.black}`,
          borderRadius: 999,
          background: theme.white,
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 900,
          lineHeight: 1.5,
        }}>
          相手を理解できるまで、何度でも挑戦できる
        </p>
        <Rules />
        <div data-testid="top-mode-pillars" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
          gap: 10,
          marginTop: 16,
        }}>
          <section style={modePillarStyle(theme.cyan)}>
            <span style={modePillarLabelStyle()}>通常版</span>
            <b style={{ fontSize: 16 }}>友達向け</b>
            <p style={modePillarNoteStyle()}>URLを送って、<br />好きな時間に回答</p>
          </section>
          <section style={modePillarStyle(theme.yellow)}>
            <span style={modePillarLabelStyle()}>LIVE版</span>
            <b style={{ fontSize: 16 }}>LIVE向け</b>
            <p style={modePillarNoteStyle()}>配信者と視聴者が同時回答し、<br />1問ずつ答え合わせ</p>
          </section>
        </div>
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

function modePillarStyle(accent) {
  return {
    display: 'grid',
    alignContent: 'start',
    gap: 6,
    minHeight: 126,
    padding: '12px 9px',
    border: `3px solid ${theme.black}`,
    borderRadius: 14,
    background: theme.white,
    boxShadow: `3px 4px 0 ${accent}`,
    textAlign: 'center',
  };
}

function modePillarLabelStyle() {
  return {
    justifySelf: 'center',
    padding: '3px 9px',
    borderRadius: 999,
    background: theme.black,
    color: theme.white,
    fontFamily: theme.caption,
    fontSize: 10,
    letterSpacing: '.08em',
  };
}

function modePillarNoteStyle() {
  return {
    margin: 0,
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.55,
  };
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
        <div
          key={title}
          className="top-question-card"
          data-testid="top-question-card"
          style={{
            position: 'absolute',
            top: [22, 0, 30][index],
            left: [0, '28%', '52%'][index],
            width: 118,
            aspectRatio: '756 / 1122',
            overflow: 'hidden',
            transform: `rotate(${[-8, 4, -3][index]}deg)`,
            zIndex: [1, 3, 2][index],
            border: '3px solid #fff',
            borderRadius: 10,
            background: '#fff',
            boxShadow: '0 12px 24px rgba(0,0,0,.25)',
            color: theme.black,
          }}
          dangerouslySetInnerHTML={{ __html: renderNotebookQuestionCard({ title, choices }) }}
        />
      ))}
    </div>
  );
}

function ChallengeGuide() {
  const steps = [
    '名前を入力して、出題する10問を選ぶ・作る',
    '自分の正解を選ぶ',
    '参加URL・QRコードを友達へ送る',
    '何問正解かを確認し、答え合わせを楽しむ',
  ];
  const recommendations = [
    '友達が自分のことをどれだけ分かっているか知りたい',
    '休み時間・放課後・旅行で会話のきっかけがほしい',
    'LINEやSNSで参加URLを送り、離れた相手にも挑戦してほしい',
    '点数を競うより、意外な答えから次の会話を楽しみたい',
  ];
  const faqs = [
    {
      question: 'どうやって理解度診断を作りますか？',
      answer: '共通のお題から1問ずつ選び、自分の正解を登録して10問を完成させます。問題文と5つの選択肢は編集でき、自分で問題を作ることもできます。',
    },
    {
      question: '何人まで挑戦できますか？',
      answer: '1つの理解度診断へ最大50人まで参加できます。回答する人は、届いた参加URLから自分のスマホで10問へ回答します。',
    },
    {
      question: '無料で遊べますか？',
      answer: 'クイズ作成、参加URL・QRコードの共有、10問の答え合わせ、答え合わせレポートを無料で利用できます。',
    },
    {
      question: '点数は必ず公開されますか？',
      answer: '公開されません。理解度ボードへ載せるかは回答した本人が選べます。載せる前に、同じ10問へもう一度挑戦することもできます。',
    },
  ];

  return (
    <main data-testid="challenge-guide-page" style={pageStyle()}>
      <Decor />
      <header data-testid="challenge-guide-hero" style={{
        minHeight: 240,
        padding: '50px 22px 31px',
        position: 'relative',
        overflow: 'hidden',
        background: theme.black,
        color: theme.white,
        textAlign: 'center',
      }}>
        <a href="/" style={{
          position: 'absolute',
          top: 18,
          left: 18,
          zIndex: 3,
          minHeight: 44,
          display: 'inline-flex',
          alignItems: 'center',
          padding: '9px 14px',
          border: `2px solid ${theme.black}`,
          borderRadius: 999,
          background: theme.white,
          color: theme.black,
          boxShadow: `3px 3px 0 ${theme.cyan}`,
          textDecoration: 'none',
          fontSize: 14,
          fontWeight: 900,
        }}>
          ← トップへ
        </a>
        <div aria-hidden="true" style={{
          position: 'absolute',
          right: -22,
          bottom: -22,
          width: 176,
          opacity: .84,
          filter: 'drop-shadow(0 5px 13px rgba(236,79,136,.38))',
          pointerEvents: 'none',
        }}>
          <Girl variant="default" width="100%" height="auto" loading="eager" fetchPriority="high" />
        </div>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <Pill>CHALLENGE</Pill>
          <h1 style={{
            maxWidth: 430,
            margin: '17px auto 0',
            color: theme.white,
            fontFamily: theme.display,
            fontSize: 'clamp(27px,7.5vw,38px)',
            lineHeight: 1.35,
            textShadow: `4px 4px 0 ${theme.cyan}`,
          }}>
            みんなに挑戦してもらう
          </h1>
          <p style={{
            margin: '10px 0 0',
            color: theme.yellow,
            fontSize: 13,
            lineHeight: 1.55,
            fontWeight: 900,
          }}>
            URLを送って、好きな時間に回答
          </p>
        </div>
      </header>

      <div style={contentWrap()}>
        <section data-testid="challenge-guide-intro" style={guideCardStyle()}>
          <span style={aboutLabelStyle(theme.cyan)}>通常版</span>
          <h2 style={{ margin: '12px 0 0', color: theme.pinkDeep, fontSize: 22, lineHeight: 1.5 }}>
            あなたの答えを、<br />最大50人が予想します
          </h2>
          <p style={paragraph()}>
            出題者が10問を選び、自分の正解を先に登録して、発行された参加URLをみんなへ送る「わたし理解度診断」です。
            回答する人は、届いたURLからあなたの答えを予想します。
          </p>
          <p style={paragraph()}>
            問題は共通のお題ライブラリから1問ずつ選び、スキップ・編集・自作もできます。
            10問後は正解とすれ違いを振り返る答え合わせレポートを確認できます。
          </p>
        </section>

        <section aria-label="おすすめの利用場面" style={{
          padding: '15px',
          border: `3px solid ${theme.black}`,
          borderRadius: 14,
          background: theme.black,
          color: theme.white,
          boxShadow: '4px 4px 0 #000',
        }}>
          <div style={{
            marginBottom: 11,
            color: theme.yellow,
            fontFamily: theme.caption,
            fontSize: 10,
            letterSpacing: '.16em',
          }}>
            PLAY SCENE
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['休み時間', '放課後', 'LINE', '友達グループ', '旅行'].map((scene) => (
              <span key={scene} style={{
                minHeight: 30,
                display: 'inline-flex',
                alignItems: 'center',
                padding: '5px 10px',
                border: `2px solid ${theme.black}`,
                borderRadius: 999,
                background: theme.yellow,
                color: theme.black,
                boxShadow: '2px 2px 0 #000',
                fontSize: 11,
                fontWeight: 900,
              }}>
                {scene}
              </span>
            ))}
          </div>
        </section>

        <section aria-labelledby="guide-recommend-title" style={guideCardStyle()}>
          <h2 id="guide-recommend-title" style={{ margin: '0 0 12px', fontSize: 18 }}>
            こんな人におすすめ
          </h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {recommendations.map((item) => (
              <div key={item} style={{
                display: 'grid',
                gridTemplateColumns: '24px minmax(0,1fr)',
                gap: 9,
                alignItems: 'start',
                fontSize: 14,
                lineHeight: 1.65,
                fontWeight: 800,
              }}>
                <span aria-hidden="true" style={{
                  width: 22,
                  height: 22,
                  display: 'grid',
                  placeItems: 'center',
                  border: `2px solid ${theme.black}`,
                  borderRadius: '50%',
                  background: theme.cyan,
                  boxShadow: '1px 1px 0 #000',
                  fontSize: 11,
                }}>✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="guide-steps-title" style={{
          padding: 16,
          border: `3px solid ${theme.black}`,
          borderRadius: 14,
          background: '#FFE4EE',
          boxShadow: '4px 4px 0 #000',
        }}>
          <h2 id="guide-steps-title" style={{ margin: '0 0 12px', fontSize: 18 }}>遊び方</h2>
          <div style={{ display: 'grid', gap: 9 }}>
            {steps.map((item, index) => (
              <div key={item} style={{
                minHeight: 56,
                display: 'grid',
                gridTemplateColumns: '38px minmax(0,1fr)',
                gap: 10,
                alignItems: 'center',
                padding: 9,
                border: `2.5px solid ${theme.black}`,
                borderRadius: 12,
                background: theme.white,
                boxShadow: '2px 2px 0 #000',
                fontSize: 14,
                lineHeight: 1.55,
                fontWeight: 900,
              }}>
                <span style={{
                  width: 34,
                  height: 34,
                  display: 'grid',
                  placeItems: 'center',
                  border: `2px solid ${theme.black}`,
                  borderRadius: '50%',
                  background: [theme.cyan, theme.pink, theme.yellow, theme.white][index],
                  color: index === 1 ? theme.white : theme.black,
                }}>
                  {index + 1}
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section data-testid="challenge-guide-promise" style={{
          padding: '15px 16px',
          border: `3px solid ${theme.black}`,
          borderRadius: 14,
          background: theme.white,
          boxShadow: `4px 4px 0 ${theme.cyan}`,
          textAlign: 'center',
        }}>
          <span style={aboutLabelStyle(theme.yellow)}>このゲームの約束</span>
          <h2 style={{ margin: '11px 0 0', fontSize: 17, lineHeight: 1.6 }}>
            相手を理解できるまで、<br />何度でも挑戦できる
          </h2>
          <p style={paragraph()}>
            理解度ボードへの掲載は任意です。掲載前に同じ10問へ再挑戦でき、
            掲載した結果も点数順ではなく回答完了順で表示します。
          </p>
        </section>

        <a href="/challenge" style={{ ...primaryButton(), minHeight: 68, textDecoration: 'none', display: 'flex' }}>
          10問の理解度診断を作る <span style={{ color: theme.yellow }}>▶</span>
        </a>

        <section aria-labelledby="guide-faq-title" style={{ ...guideCardStyle(), background: theme.cream }}>
          <h2 id="guide-faq-title" style={{ margin: '0 0 12px', fontSize: 18 }}>よくある質問</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {faqs.map((item) => (
              <article key={item.question} style={{
                padding: 12,
                border: `2px solid ${theme.black}`,
                borderRadius: 12,
                background: theme.white,
              }}>
                <h3 style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{item.question}</h3>
                <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.75, fontWeight: 700 }}>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <a href="/live-challenge" style={{
          minHeight: 62,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '11px 14px',
          border: `2.5px solid ${theme.black}`,
          borderRadius: 13,
          background: theme.white,
          color: theme.black,
          boxShadow: '3px 3px 0 #000',
          textDecoration: 'none',
        }}>
          <span aria-hidden="true" style={{ fontSize: 27 }}>🎙️</span>
          <span style={{ flex: 1 }}>
            <strong style={{ display: 'block', fontSize: 14 }}>LIVE版もあります</strong>
            <span style={{ display: 'block', marginTop: 3, fontSize: 12, lineHeight: 1.55, fontWeight: 700 }}>
              配信者と視聴者が同時回答し、1問ずつ答え合わせ
            </span>
          </span>
          <span aria-hidden="true">›</span>
        </a>

        <HomeLink />
      </div>
      <SiteFooter />
    </main>
  );
}

function guideCardStyle() {
  return {
    padding: 16,
    border: `3px solid ${theme.black}`,
    borderRadius: 14,
    background: theme.white,
    boxShadow: '4px 4px 0 #000',
  };
}

function AboutPage() {
  return (
    <main data-testid="about-page" style={pageStyle()}>
      <Decor />
      <header data-testid="about-hero" style={{
        minHeight: 228,
        padding: '48px 22px 28px',
        position: 'relative',
        overflow: 'hidden',
        background: theme.black,
        color: theme.white,
        textAlign: 'center',
      }}>
        <a href="/" style={{
          position: 'absolute',
          top: 18,
          left: 18,
          zIndex: 3,
          minHeight: 44,
          display: 'inline-flex',
          alignItems: 'center',
          padding: '9px 14px',
          border: `2px solid ${theme.black}`,
          borderRadius: 999,
          background: theme.white,
          color: theme.black,
          boxShadow: '3px 3px 0 rgba(91,212,232,.85)',
          textDecoration: 'none',
          fontSize: 14,
          fontWeight: 900,
        }}>
          ← トップへ
        </a>
        <div aria-hidden="true" style={{
          position: 'absolute',
          left: -28,
          bottom: -10,
          width: 172,
          opacity: .9,
          filter: 'drop-shadow(0 5px 13px rgba(236,79,136,.38))',
          pointerEvents: 'none',
        }}>
          <Girl variant="default" width="100%" height="auto" flip loading="eager" fetchPriority="high" />
        </div>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div aria-hidden="true" style={{ marginBottom: 3, fontSize: 32 }}>💌</div>
          <h1 style={{
            margin: 0,
            color: theme.white,
            fontFamily: theme.display,
            fontSize: 'clamp(34px,10vw,44px)',
            lineHeight: 1.25,
            textShadow: `4px 4px 0 ${theme.cyan}`,
          }}>
            About
          </h1>
          <p style={{
            margin: '8px 0 0',
            color: theme.white,
            opacity: .78,
            fontFamily: theme.caption,
            fontSize: 10,
            letterSpacing: '.2em',
          }}>
            STREET BOARD GAME とは
          </p>
        </div>
      </header>
      <div style={contentWrap()}>
        <section aria-labelledby="about-concept-title">
          <AboutSectionTitle id="about-concept-title">♡ コンセプト</AboutSectionTitle>
          <AboutCard>
            <span style={aboutLabelStyle(theme.cyan)}>わたし理解度診断</span>
            <h2 style={{ margin: '13px 0 0', color: theme.pinkDeep, fontSize: 22, lineHeight: 1.5 }}>
              私のこと、ちゃんと<br />分かってるよね？
            </h2>
            <p style={{ margin: '10px 0 0', fontSize: 16, lineHeight: 1.65, fontWeight: 900 }}>
              当てるより、話すための10問。
            </p>
            <p style={paragraph()}>
              自分の答えをみんなに予想してもらい、答え合わせから次の会話を生むゲームです。
              出題者が10問を作り、回答する人へ参加URLを送って遊びます。
            </p>
          </AboutCard>
        </section>

        <section aria-labelledby="about-promise-title">
          <AboutSectionTitle id="about-promise-title">♡ 大切にしていること</AboutSectionTitle>
          <AboutCard>
            <div data-testid="about-brand-promise" style={{
              padding: '13px 14px',
              border: `2.5px solid ${theme.black}`,
              borderRadius: 12,
              background: theme.black,
              color: theme.white,
              boxShadow: `3px 3px 0 ${theme.cyan}`,
              textAlign: 'center',
              fontSize: 15,
              lineHeight: 1.6,
              fontWeight: 900,
            }}>
              相手を理解できるまで、何度でも挑戦できる
            </div>
            <div style={{ display: 'grid', gap: 9, marginTop: 15 }}>
              <AboutValue
                icon="↻"
                title="もう一度、答えを予想できる"
                text="点数が気になっても、結果を載せる前に同じ10問へ再挑戦できます。"
              />
              <AboutValue
                icon="○"
                title="結果公開は自分で選べる"
                text="理解度ボードへの掲載は任意。掲載した結果は回答完了順で表示し、点数による順位づけもしません。"
              />
              <AboutValue
                icon="✎"
                title="答え合わせを会話の入口に"
                text="結果画像と答え合わせレポートで、当たった理由や意外な違いを話せます。"
              />
            </div>
          </AboutCard>
        </section>

        <section aria-labelledby="about-modes-title">
          <AboutSectionTitle id="about-modes-title">♡ 2つの遊び方</AboutSectionTitle>
          <nav aria-label="現在遊べる2つのモード" style={{ display: 'grid', gap: 10 }}>
            <AboutMode
              href="/challenge"
              icon="📣"
              label="通常版"
              title="みんなに挑戦してもらう"
              text="URLを送って、好きな時間に回答"
              color={theme.cyan}
            />
            <AboutMode
              href="/live-challenge"
              icon="🎙️"
              label="LIVE版"
              title="ライブ配信でみんなに挑戦してもらう"
              text="配信者と視聴者が同時回答し、1問ずつ答え合わせ"
              color={theme.yellow}
            />
          </nav>
        </section>

        <a href="/product" style={{
          minHeight: 64,
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          padding: '11px 14px',
          border: `2.5px solid ${theme.black}`,
          borderRadius: 13,
          background: '#FFE4EE',
          color: theme.black,
          boxShadow: '3px 3px 0 #000',
          textDecoration: 'none',
        }}>
          <span aria-hidden="true" style={{ fontSize: 27 }}>🎴</span>
          <span style={{ flex: 1 }}>
            <strong style={{ display: 'block', fontSize: 14 }}>カードで遊べる製品版もあります</strong>
            <span style={{ display: 'block', marginTop: 3, fontSize: 12, lineHeight: 1.55, fontWeight: 700 }}>
              スマホを置いて、その場でカードを囲む
            </span>
          </span>
          <span aria-hidden="true">›</span>
        </a>

        <section id="contact-section" aria-labelledby="about-contact-title" style={{ scrollMarginTop: 20 }}>
          <AboutSectionTitle id="about-contact-title">♡ お問い合わせ</AboutSectionTitle>
          <AboutCard>
            <p style={{ ...paragraph(), marginTop: 0 }}>
              不具合・掲載内容・サービスについて、下のフォームから送信できます。
            </p>
            <ContactForm />
          </AboutCard>
        </section>
        <HomeLink />
      </div>
      <SiteFooter />
    </main>
  );
}

function AboutSectionTitle({ id, children }) {
  return (
    <h2 id={id} style={{
      display: 'inline-flex',
      margin: '0 0 11px',
      padding: '6px 13px',
      border: `2.5px solid ${theme.black}`,
      borderRadius: 8,
      background: theme.yellow,
      color: theme.black,
      boxShadow: '2px 2px 0 #000',
      fontSize: 15,
      lineHeight: 1.4,
      transform: 'rotate(-1deg)',
    }}>
      {children}
    </h2>
  );
}

function AboutCard({ children }) {
  return (
    <div style={{
      padding: 17,
      border: `2.5px solid ${theme.black}`,
      borderRadius: 16,
      background: theme.white,
      boxShadow: '4px 4px 0 #000',
    }}>
      {children}
    </div>
  );
}

function AboutValue({ icon, title, text }) {
  return (
    <article style={{
      display: 'grid',
      gridTemplateColumns: '42px minmax(0,1fr)',
      gap: 10,
      alignItems: 'center',
      padding: 10,
      border: `2px solid ${theme.black}`,
      borderRadius: 11,
      background: theme.cream,
    }}>
      <span aria-hidden="true" style={{
        width: 38,
        height: 38,
        display: 'grid',
        placeItems: 'center',
        border: `2px solid ${theme.black}`,
        borderRadius: '50%',
        background: theme.pink,
        color: theme.white,
        fontSize: 19,
        fontWeight: 900,
      }}>
        {icon}
      </span>
      <div>
        <h3 style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{title}</h3>
        <p style={{ margin: '3px 0 0', color: '#6D5861', fontSize: 12, lineHeight: 1.65, fontWeight: 700 }}>{text}</p>
      </div>
    </article>
  );
}

function AboutMode({ href, icon, label, title, text, color }) {
  return (
    <a href={href} style={{
      minHeight: 92,
      display: 'grid',
      gridTemplateColumns: '48px minmax(0,1fr) 18px',
      gap: 10,
      alignItems: 'center',
      padding: 13,
      border: `2.5px solid ${theme.black}`,
      borderRadius: 14,
      background: theme.white,
      color: theme.black,
      boxShadow: '4px 4px 0 #000',
      textDecoration: 'none',
    }}>
      <span aria-hidden="true" style={{ fontSize: 28, textAlign: 'center' }}>{icon}</span>
      <span>
        <span style={{ ...aboutLabelStyle(color), padding: '3px 9px', fontSize: 10 }}>{label}</span>
        <strong style={{ display: 'block', marginTop: 6, fontSize: 14, lineHeight: 1.5 }}>{title}</strong>
        <span style={{ display: 'block', marginTop: 3, color: '#6D5861', fontSize: 12, lineHeight: 1.55, fontWeight: 700 }}>{text}</span>
      </span>
      <span aria-hidden="true" style={{ fontSize: 20, fontWeight: 900 }}>›</span>
    </a>
  );
}

function aboutLabelStyle(background) {
  return {
    display: 'inline-flex',
    padding: '5px 10px',
    border: `2px solid ${theme.black}`,
    borderRadius: 999,
    background,
    color: theme.black,
    fontSize: 11,
    lineHeight: 1.2,
    fontWeight: 900,
  };
}

function ContactForm() {
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const sending = status === 'sending';
  const sent = status === 'sent';

  const submit = async (event) => {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget;
    setStatus('sending');
    setErrorMessage('');
    try {
      const response = await fetch('https://formspree.io/f/xrevejjr', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = Array.isArray(data?.errors) && data.errors[0]?.message
          ? data.errors[0].message
          : '送信に失敗しました。時間をおいてもう一度お試しください。';
        throw new Error(message);
      }
      form.reset();
      setStatus('sent');
      if (typeof window.trackEvent === 'function') {
        window.trackEvent('contact_form_submit', { result: 'success' });
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage(error?.message || '通信エラーが発生しました。ネット接続を確認してください。');
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
      <input type="hidden" name="_subject" value="streetboardgame.com お問い合わせ" />
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="contact-company">入力しないでください</label>
        <input id="contact-company" name="_gotcha" tabIndex="-1" autoComplete="off" />
      </div>
      <label htmlFor="contact-name" style={contactLabelStyle()}>
        お名前
        <input id="contact-name" name="name" required maxLength={50} autoComplete="name" style={{ ...inputStyle(), marginTop: 5 }} disabled={sending} />
      </label>
      <label htmlFor="contact-email" style={contactLabelStyle()}>
        メールアドレス
        <input id="contact-email" name="email" type="email" required maxLength={160} autoComplete="email" inputMode="email" style={{ ...inputStyle(), marginTop: 5 }} disabled={sending} />
      </label>
      <label htmlFor="contact-message" style={contactLabelStyle()}>
        お問い合わせ内容
        <textarea id="contact-message" name="message" required maxLength={2000} rows={7} style={{ ...inputStyle(), minHeight: 150, marginTop: 5, resize: 'vertical', lineHeight: 1.6 }} disabled={sending} />
      </label>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.65, fontWeight: 700 }}>
        送信内容はお問い合わせ対応に利用します。詳しくは<a href="/privacy">プライバシーポリシー</a>をご確認ください。
      </p>
      {status === 'error' && (
        <p role="alert" style={{ margin: 0, padding: 10, border: '2px solid #B81745', borderRadius: 10, background: '#FFE7EF', color: '#8E1237', fontSize: 13, lineHeight: 1.6, fontWeight: 900 }}>
          {errorMessage}
        </p>
      )}
      {sent && (
        <p role="status" style={{ margin: 0, padding: 10, border: '2px solid #16805D', borderRadius: 10, background: '#DFF8EF', color: '#075940', fontSize: 13, lineHeight: 1.6, fontWeight: 900 }}>
          送信しました。お問い合わせありがとうございます。
        </p>
      )}
      <button type="submit" disabled={sending || sent} style={{ ...primaryButton(), opacity: sending ? .72 : 1 }}>
        {sent ? '送信済み ✓' : sending ? '送信中…' : '送信する ✉'}
      </button>
    </form>
  );
}

function contactLabelStyle() {
  return { display: 'grid', fontSize: 14, lineHeight: 1.5, fontWeight: 900 };
}

function ProductPage() {
  const scenes = [
    ['🏫', '休み時間・放課後に', '友達同士でカードを囲んで、会話のきっかけに。'],
    ['🏠', 'おうち時間に', '家族や友達と、スマホを置いてゆっくり答え合わせ。'],
    ['🧳', '旅行・集まりに', '移動中や宿泊先で、みんなの意外な答えを発見。'],
    ['🎁', 'プレゼントにも', '一緒に遊ぶ時間まで贈れる、54問入りのカードゲーム。'],
  ];
  return (
    <main data-testid="product-page" style={pageStyle()}>
      <Decor />
      <Header title="製品版もあります" label="BOARD GAME EDITION" />
      <div style={contentWrap()}>
        <section data-testid="product-showcase" aria-labelledby="product-title" style={{
          padding: 4,
          background: theme.yellow,
          border: `3px solid ${theme.black}`,
          borderRadius: 20,
          boxShadow: '5px 5px 0 #000',
        }}>
          <div style={{ padding: 15, background: theme.white, borderRadius: 15 }}>
            <div aria-label="カードゲーム版のパッケージイメージ" style={{
              width: '100%',
              aspectRatio: '1 / 1',
              minHeight: 270,
              position: 'relative',
              overflow: 'hidden',
              border: `2.5px solid ${theme.black}`,
              borderRadius: 13,
              background: `linear-gradient(145deg, ${theme.pink} 0%, ${theme.pinkDeep} 100%)`,
            }}>
              <div aria-hidden="true" style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(circle at 14% 18%,rgba(255,255,255,.17) 0 22px,transparent 23px),radial-gradient(circle at 82% 78%,rgba(255,226,107,.2) 0 54px,transparent 55px)',
              }} />
              <span style={{
                position: 'absolute',
                top: 16,
                left: 16,
                zIndex: 3,
                padding: '6px 13px',
                borderRadius: 999,
                background: theme.white,
                color: theme.pinkDeep,
                fontSize: 10,
                fontWeight: 900,
              }}>
                わたし理解度診断
              </span>
              <span style={{
                position: 'absolute',
                top: 18,
                right: 15,
                zIndex: 3,
                padding: '5px 8px',
                borderRadius: 5,
                background: theme.black,
                color: theme.yellow,
                fontFamily: theme.caption,
                fontSize: 9,
                letterSpacing: '.12em',
                transform: 'rotate(2deg)',
              }}>
                54 QUESTIONS
              </span>
              <div style={{
                position: 'absolute',
                left: '2%',
                bottom: '2%',
                zIndex: 2,
                width: '49%',
                filter: 'drop-shadow(0 9px 13px rgba(0,0,0,.22))',
              }}>
                <Girl
                  variant="full"
                  width="100%"
                  height="auto"
                  loading="eager"
                  fetchPriority="high"
                  alt="製品版パッケージのメインキャラクター"
                />
              </div>
              <div style={{
                position: 'absolute',
                top: '24%',
                right: '5%',
                zIndex: 4,
                width: '54%',
                textAlign: 'right',
                color: theme.white,
                fontFamily: theme.display,
                fontSize: 'clamp(20px,6.7vw,32px)',
                fontWeight: 900,
                lineHeight: 1.28,
                textShadow: `3px 3px 0 ${theme.cyan}`,
              }}>
                私のこと、<br />ちゃんと<br />分かってる<br />よね？
              </div>
              <div style={{
                position: 'absolute',
                right: '5%',
                bottom: '5%',
                zIndex: 5,
                width: '35%',
                maxWidth: 122,
                aspectRatio: '1 / 1',
                display: 'grid',
                placeItems: 'center',
                padding: 10,
                borderRadius: '50%',
                background: theme.yellow,
                color: theme.black,
                border: `2.5px solid ${theme.black}`,
                boxShadow: '3px 4px 0 rgba(0,0,0,.25)',
                transform: 'rotate(-5deg)',
                textAlign: 'center',
                fontSize: 'clamp(10px,3.3vw,14px)',
                lineHeight: 1.45,
                fontWeight: 900,
              }}>
                当てるより、<br />話すための<br />54問。
              </div>
            </div>

            <span style={{
              display: 'inline-block',
              marginTop: 14,
              padding: '4px 10px',
              borderRadius: 5,
              background: theme.black,
              color: theme.yellow,
              fontFamily: theme.caption,
              fontSize: 10,
              letterSpacing: '.14em',
            }}>
              BOARD GAME EDITION
            </span>
            <h2 id="product-title" style={{ margin: '11px 0 0', color: theme.pink, fontSize: 22, lineHeight: 1.45 }}>
              {BOARD_GAME_PRODUCT.title}
            </h2>
            <p style={paragraph()}>{BOARD_GAME_PRODUCT.description}</p>
            <p style={paragraph()}>
              Web版の「通常版」「LIVE版」と同じく、正解数を競うより、答え合わせから会話が生まれることを大切にしたカードゲームです。
            </p>
            <div aria-label="製品版の特徴" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, marginTop: 15 }}>
              <ProductFeature label="54問入り" />
              <ProductFeature label="カードで遊ぶ" />
              <ProductFeature label="スマホ不要" />
            </div>
            <a href={BOARD_GAME_PRODUCT.amazonUrl} rel="sponsored noopener noreferrer" target="_blank" style={{
              ...primaryButton(),
              display: 'flex',
              marginTop: 18,
              background: '#FF9900',
              color: theme.black,
              textDecoration: 'none',
              boxShadow: '4px 4px 0 #000',
            }}>
              {BOARD_GAME_PRODUCT.cta}
            </a>
            <p style={{ margin: '10px 0 0', color: '#6D5861', fontSize: 12, lineHeight: 1.6, textAlign: 'center' }}>
              {BOARD_GAME_PRODUCT.disclosure}
            </p>
          </div>
        </section>

        <section aria-labelledby="product-scenes-title">
          <h2 id="product-scenes-title" style={productSectionTitle()}>♡ こんな場面にぴったり</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {scenes.map(([icon, title, description]) => (
              <article key={title} style={{
                display: 'grid',
                gridTemplateColumns: '46px minmax(0,1fr)',
                gap: 11,
                alignItems: 'center',
                padding: 13,
                border: `2.5px solid ${theme.black}`,
                borderRadius: 13,
                background: theme.white,
                boxShadow: '3px 3px 0 #000',
              }}>
                <span aria-hidden="true" style={{ fontSize: 27, textAlign: 'center' }}>{icon}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15 }}>{title}</h3>
                  <p style={{ margin: '4px 0 0', color: '#6D5861', fontSize: 12, lineHeight: 1.6, fontWeight: 700 }}>{description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="product-ways-title" style={{
          padding: 16,
          border: `3px solid ${theme.black}`,
          borderRadius: 16,
          background: '#FFE4EE',
          boxShadow: '4px 4px 0 #000',
        }}>
          <h2 id="product-ways-title" style={{ margin: 0, fontSize: 19, textAlign: 'center' }}>
            遊ぶ場面に合わせて、3つの楽しみ方
          </h2>
          <div style={{ display: 'grid', gap: 9, marginTop: 14 }}>
            <ProductWay label="通常版" title="URLを送って、好きな時間に回答" href="/challenge" />
            <ProductWay label="LIVE版" title="配信者と視聴者が同時回答" href="/live-challenge" />
            <ProductWay label="製品版" title="スマホを置いて、その場でカードを囲む" />
          </div>
          <p style={{ ...paragraph(), marginBottom: 0, textAlign: 'center' }}>
            どの遊び方でも、合言葉は「当てるより、話すため」。
          </p>
        </section>
        <HomeLink />
      </div>
      <SiteFooter />
    </main>
  );
}

function ProductFeature({ label }) {
  return (
    <span style={{
      minHeight: 42,
      display: 'grid',
      placeItems: 'center',
      padding: '7px 4px',
      border: `2px solid ${theme.black}`,
      borderRadius: 9,
      background: theme.pink,
      color: theme.white,
      boxShadow: '2px 2px 0 #000',
      fontSize: 12,
      fontWeight: 900,
      textAlign: 'center',
    }}>
      {label}
    </span>
  );
}

function ProductWay({ label, title, href }) {
  const content = (
    <>
      <span style={{
        minWidth: 65,
        padding: '5px 8px',
        border: `2px solid ${theme.black}`,
        borderRadius: 999,
        background: label === '製品版' ? theme.yellow : theme.cyan,
        color: theme.black,
        fontSize: 11,
        fontWeight: 900,
        textAlign: 'center',
      }}>{label}</span>
      <strong style={{ flex: 1, fontSize: 13, lineHeight: 1.55 }}>{title}</strong>
      {href && <span aria-hidden="true">›</span>}
    </>
  );
  const style = {
    minHeight: 58,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    border: `2.5px solid ${theme.black}`,
    borderRadius: 12,
    background: theme.white,
    color: theme.black,
    boxShadow: '2px 3px 0 #000',
    textDecoration: 'none',
  };
  return href ? <a href={href} style={style}>{content}</a> : <div style={style}>{content}</div>;
}

function productSectionTitle() {
  return {
    display: 'inline-flex',
    margin: '2px 0 12px',
    padding: '7px 12px',
    border: `2.5px solid ${theme.black}`,
    borderRadius: 999,
    background: theme.black,
    color: theme.yellow,
    boxShadow: `3px 3px 0 ${theme.cyan}`,
    fontSize: 17,
  };
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
  return {
    width: '100%',
    maxWidth: 600,
    minHeight: '100dvh',
    margin: '0 auto',
    background: theme.pink,
    color: theme.black,
    fontFamily: theme.body,
    position: 'relative',
    overflow: 'hidden',
  };
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
