// Japanese-only detailed guide for /challenge-guide, rendered by the Worker.
// It describes the current game screens (creator, participant, organizer)
// and is stripped from translated locale pages, which keep the shorter guide.
export const GUIDE_DETAILS_MARKER = 'data-guide-details';

const card = 'padding:16px;border:3px solid #1A1A1A;border-radius:14px;background:#FFFFFF;box-shadow:4px 4px 0 #000';
const h2 = 'margin:0 0 10px;font-size:18px;line-height:1.5';
const p = 'margin:8px 0 0;font-size:14px;line-height:1.85;font-weight:700';
const ul = 'margin:8px 0 0;padding-inline-start:1.3em;display:grid;gap:6px;font-size:14px;line-height:1.75;font-weight:700';

function section(id, title, body, background = '#FFFFFF') {
  return `<section aria-labelledby="${id}" style="${card};background:${background}"><h2 id="${id}" style="${h2}">${title}</h2>${body}</section>`;
}

function list(items) {
  return `<ul style="${ul}">${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
}

export const GUIDE_DETAILS_HTML = `<div ${GUIDE_DETAILS_MARKER} style="display:grid;gap:18px">`
  + section('guide-creator-title', '出題する人：クイズの作り方', ''
    + `<p style="${p}">トップページの「わたし理解度診断を作る」か、<a href="/challenge">クイズ作成画面</a>の「クイズを作る」から始めます。表示する名前（12文字まで）を入れると、共通のお題が1問ずつ表示されます。自分の答えに合う色のボタンを押すと、その1問が完成します。</p>`
    + list([
      '合わないお題は「この問題をスキップ」で次のお題へ進めます。',
      '「問題・選択肢を編集する」で、問題文や5つの選択肢を自分たち向けに書き換えられます。',
      '「自分で問題を作る」でオリジナルのお題を、「過去に作った問題を使う」で以前に作ったお題を入れられます。',
      '1問から作れて、最大10問まで追加できます。途中までの内容はこの端末に自動保存されます。',
    ]))
  + section('guide-packs-title', 'お題をまとめて選ぶなら', ''
    + `<p style="${p}"><a href="/challenge/library">お題ライブラリ</a>では、「初対面でも答えやすい10問」「食べものの好み10問」「わたしのトリセツ10問」など、テーマごとの10問パックを選べます。週ごとに入れ替わる「今週のお題」もあります。パックを選ぶと、そのテーマの問題でそのままクイズを作れます。</p>`)
  + section('guide-share-title', '参加URLの送り方', ''
    + `<p style="${p}">クイズが完成すると、参加用のURLが発行されます。送り方は次の中から選べます。</p>`
    + list([
      'リンクをコピーして、LINEやメッセージに貼る',
      'X・LINE・WhatsAppのボタンから、参加URLつきで送る',
      'Instagram用にリンクをコピーする、ストーリー用の文章と画像を保存する',
      '招待画像を保存して、グループに送る',
    ])
    + `<p style="${p}">1つのクイズには最大50人まで参加できます。回答する人はアプリのインストールや会員登録をしなくても、届いたURLを開くだけで遊べます。</p>`, '#FFE4EE')
  + section('guide-player-title', '回答する人：答えの予想と結果', ''
    + list([
      'URLを開いたら、表示名（12文字まで）を入れて挑戦を始めます。本名や学校名など、個人が分かる名前は避けてください。',
      '1問ずつ、出題者が選んだと思う答えを色のボタンで予想します。',
      '最後まで答えると「何問中何問正解」かが表示され、1問ごとの正解・不正解も見られます。',
      '回答を完了すると、表示名と点数がそのクイズの理解度ボードに自動で載ります。同じ端末から再挑戦すると最高点に更新されます。',
      '「次は私が出題する」から、同じ問題か新しい問題で、今度は自分がクイズを作れます。',
    ]))
  + section('guide-organizer-title', '答え合わせのあと：主催者用の画面', ''
    + list([
      '出題者の端末には、回答状況・理解度ボード・参加者の回答をまとめて見られる主催者用の画面が表示されます。',
      '2人以上が1問を答え終えると、「会話のきっかけ」になる問題が表示されます。順位を競うためではなく、答え合わせのあとに話すネタを見つけるための機能です。',
      '「最近作った診断へ保存」を押すと、この端末からあとで開き直せます。',
      '主催者用URLは回答内容を見られる秘密のURLです。この端末に保存され、30日後に無効になります。参加者や第三者には送らないでください。',
    ]))
  + section('guide-tips-title', '盛り上がる遊び方のコツ', list([
    'はじめての相手には3〜5問くらいの短いクイズがおすすめです。答えるのに時間がかからず、気軽に挑戦してもらえます。',
    'みんなの予想が分かれそうなお題を1〜2問まぜると、答え合わせが盛り上がります。',
    '結果画像をグループに送って、「なんでそれを選んだの？」と理由を聞いてみてください。点数より、その会話がこのゲームのいちばんの楽しみです。',
  ]), '#FFF8F1')
  + section('guide-safety-title', '安心して遊ぶために', list([
    '名前や自作の問題には、本名・学校名・住所など個人が分かる内容を入れないでください。',
    '自作・編集した問題は、作成時の設定がオンのままなら掲載候補として運営へ送られ、運営が編集して他の利用者へ公開することがあります。送りたくない場合は作成時にオフにしてください。',
    `性的な内容、いじめ、容姿への攻撃、差別的な表現は審査の対象です。くわしくは<a href="/content-guidelines">コンテンツ・肖像権ガイドライン</a>をご確認ください。`,
  ]))
  + '</div>';

const START = '<!-- guide-details -->';
const END = '<!-- /guide-details -->';
const PAGE = '[data-testid="challenge-guide-page"]';
// The React app re-renders #root on load, so the details live right after it.
// The original back link and footer are moved below the details with CSS so
// the page still ends with navigation.
const STYLE = `<style>${PAGE}>div:not([aria-hidden])>a[href="/"]:last-child,${PAGE}>footer{display:none!important}[data-guide-details-wrap]{width:100%;max-width:600px;margin:0 auto;background:#EC4F88;color:#1A1A1A;font-family:"Noto Sans JP",sans-serif}[data-guide-details-wrap] a{color:#B0174F}[data-guide-details-wrap] footer a{color:#FFFFFF}</style>`;
const BACK = '<a href="/" style="width:100%;min-height:60px;padding:14px 16px;align-items:center;justify-content:center;gap:6px;border:2.5px solid #1A1A1A;border-radius:14px;background:#1A1A1A;color:#FFFFFF;box-shadow:4px 4px 0 #5BD4E8;font-family:&quot;Noto Sans JP&quot;, sans-serif;font-size:16px;font-weight:800;line-height:1.35;text-align:center;cursor:pointer;display:flex;text-decoration:none">トップページへ戻る</a>';

export function injectGuideDetails(html) {
  if (!html || html.includes(GUIDE_DETAILS_MARKER)) return html;
  const marker = '<!-- /home-prerender -->';
  const index = html.indexOf(marker);
  if (index < 0) return html;
  const footer = (html.slice(0, index).match(/<footer\b[\s\S]*?<\/footer>/g) || []).pop() || '';
  const block = `${START}${STYLE}<div data-guide-details-wrap style="padding:0 20px 8px"><div style="display:grid;gap:18px;max-width:720px;margin:0 auto">${GUIDE_DETAILS_HTML}${BACK}</div>${footer}</div>${END}`;
  const at = index + marker.length;
  return html.slice(0, at) + block + html.slice(at);
}

export function removeGuideDetails(html) {
  if (!html) return html;
  const start = html.indexOf(START);
  const end = html.indexOf(END);
  if (start < 0 || end < start) return html;
  return html.slice(0, start) + html.slice(end + END.length);
}
