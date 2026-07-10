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

const { useState, useEffect, useMemo, useRef } = React;

const ROUND_SIZE = 5;
const FRIEND_ROUND_SIZE = 5;
const FAMILY_ROUND_SIZE = 5;
const AMAZON_URL = 'https://www.amazon.co.jp/dp/B0G87M4ZYK';
const COLOR_LABELS = ['緑', '青', '黄', '赤', '橙'];
const RESULT_IMAGE_VERSION = 'results-20260707-2';
const HANDOFF_DELAY_MS = 600;
const FINAL_HANDOFF_DELAY_MS = 1000;
const LOVE_RETURN_DELAY_MS = 1300;
const PLAYER_NAME_STORAGE_KEY = 'watachan-player-names-v1';
const PLAYER_NAME_MAX_LENGTH = 6;
const DEFAULT_PLAYER_NAMES = {
  love: ['彼女', '彼氏'],
  friend: ['本人', '友達A', '友達B', '友達C'],
  family: ['本人', '家族A', '家族B', '家族C'],
};

function sanitizePlayerName(value, fallback, allowEmpty = false) {
  const text = String(value ?? '').replace(/\s+/g, ' ').slice(0, PLAYER_NAME_MAX_LENGTH);
  const trimmed = text.trim();
  if (allowEmpty) return text;
  return (trimmed || fallback).slice(0, PLAYER_NAME_MAX_LENGTH);
}

function normalizePlayerNames(value = {}, allowEmpty = false) {
  const result = {};
  Object.keys(DEFAULT_PLAYER_NAMES).forEach((kind) => {
    const defaults = DEFAULT_PLAYER_NAMES[kind];
    const source = Array.isArray(value[kind]) ? value[kind] : [];
    result[kind] = defaults.map((fallback, index) => sanitizePlayerName(source[index], fallback, allowEmpty));
  });
  return result;
}

function getLoveScoreLabel(girlName, boyName) {
  const girl = sanitizePlayerName(girlName, DEFAULT_PLAYER_NAMES.love[0]);
  const boy = sanitizePlayerName(boyName, DEFAULT_PLAYER_NAMES.love[1]);
  if (girl === DEFAULT_PLAYER_NAMES.love[0] && boy === DEFAULT_PLAYER_NAMES.love[1]) {
    return '彼氏の彼女理解度';
  }
  return `${boy}の${girl}理解度`;
}

function getLoveResultHeaderLabel(girlName, boyName) {
  const boy = sanitizePlayerName(boyName, DEFAULT_PLAYER_NAMES.love[1]);
  return `${boy}の愛情判定`;
}

function personalizeLoveText(text, girlName, boyName) {
  const girl = sanitizePlayerName(girlName, DEFAULT_PLAYER_NAMES.love[0]);
  const boy = sanitizePlayerName(boyName, DEFAULT_PLAYER_NAMES.love[1]);
  if (girl === DEFAULT_PLAYER_NAMES.love[0] && boy === DEFAULT_PLAYER_NAMES.love[1]) {
    return String(text || '');
  }
  const girlToken = '__WATACHAN_GIRL__';
  const boyToken = '__WATACHAN_BOY__';
  const perfectBoyToken = '__WATACHAN_PERFECT_BOY__';
  return String(text || '')
    .replace(/満点彼氏を名乗るには/g, `、${boyToken}が${perfectBoyToken}を名乗るには`)
    .replace(/彼女/g, girlToken)
    .replace(/彼氏/g, boyToken)
    .replace(new RegExp(girlToken, 'g'), girl)
    .replace(new RegExp(boyToken, 'g'), boy)
    .replace(new RegExp(perfectBoyToken, 'g'), '満点彼氏');
}

function loadPlayerNames() {
  if (typeof window === 'undefined') return normalizePlayerNames({}, true);
  try {
    return normalizePlayerNames(JSON.parse(window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || '{}'), true);
  } catch (e) {
    return normalizePlayerNames({}, true);
  }
}

function savePlayerNames(names) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, JSON.stringify(normalizePlayerNames(names, true)));
  } catch (e) {}
}

function normalizeFriendPlayerCount(value) {
  const n = Number(value);
  return [2, 3, 4].includes(n) ? n : 2;
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

function isMobileLike() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const hasCoarsePointer = typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(pointer: coarse)').matches;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || hasCoarsePointer;
}

function openLineShare(message) {
  const encoded = encodeURIComponent(message);
  if (isMobileLike()) {
    window.location.href = `line://msg/text/${encoded}`;
    return;
  }
  window.location.href = `https://line.me/R/msg/text/?${encoded}`;
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

function getLoveResultImageSrc(score) {
  const safeScore = Math.max(0, Math.min(5, Number(score) || 0));
  return `/assets/results/love-${safeScore}.png`;
}

function drawCanvasLines(ctx, lines, x, y, lineHeight, options = {}) {
  const align = options.align || 'center';
  ctx.textAlign = align;
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
}

function splitCanvasText(text, maxLength = 15) {
  const value = String(text || '');
  if (value.length <= maxLength) return [value];
  const lines = [];
  for (let i = 0; i < value.length; i += maxLength) {
    lines.push(value.slice(i, i + maxLength));
  }
  return lines.slice(0, 3);
}

function drawFittedCanvasText(ctx, text, x, y, maxWidth, {
  weight = 900,
  size = 20,
  minSize = 12,
  family = '"Zen Maru Gothic", sans-serif',
  align = 'left',
} = {}) {
  const value = String(text || '');
  let fontSize = size;
  ctx.textAlign = align;
  do {
    ctx.font = `${weight} ${fontSize}px ${family}`;
    if (ctx.measureText(value).width <= maxWidth || fontSize <= minSize) break;
    fontSize -= 1;
  } while (fontSize >= minSize);
  ctx.fillText(value, x, y);
}

const RESULT_GIRL_IMAGE_SRC = '/assets/character/girl-default.webp';
const RESULT_QR_IMAGE_SRC = '/assets/qr-site.png?v=20260710-qr-1';

function preloadCanvasCharacterImage() {
  if (typeof window === 'undefined') return null;
  if (!window.__watachanResultGirlImage) {
    const img = new Image();
    img.src = RESULT_GIRL_IMAGE_SRC;
    window.__watachanResultGirlImage = img;
  }
  return window.__watachanResultGirlImage;
}

function drawCanvasGirl(ctx, x, y, width, height) {
  const img = preloadCanvasCharacterImage();
  if (!img || !img.complete || !img.naturalWidth) return false;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;
  ctx.drawImage(img, x, y, width, height);
  ctx.restore();
  return true;
}

function preloadCanvasQrImage() {
  if (typeof window === 'undefined') return null;
  if (!window.__watachanResultQrImage) {
    const img = new Image();
    img.src = RESULT_QR_IMAGE_SRC;
    window.__watachanResultQrImage = img;
  }
  return window.__watachanResultQrImage;
}

function drawCanvasQr(ctx, x, y, size) {
  const img = preloadCanvasQrImage();
  if (!img || !img.complete || !img.naturalWidth) return false;
  ctx.save();
  ctx.fillStyle = proto.white;
  roundRect(ctx, x - 8, y - 8, size + 16, size + 16, 18);
  ctx.fill();
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
  return true;
}

function useCanvasAssetReady(preload) {
  const [ready, setReady] = useState(() => {
    const img = preload();
    return Boolean(img && img.complete && img.naturalWidth);
  });
  useEffect(() => {
    const img = preload();
    if (!img) return undefined;
    if (img.complete && img.naturalWidth) {
      setReady(true);
      return undefined;
    }
    const done = () => setReady(true);
    img.addEventListener('load', done, { once: true });
    return () => img.removeEventListener('load', done);
  }, [preload]);
  return ready;
}

function useCanvasCharacterReady() {
  return useCanvasAssetReady(preloadCanvasCharacterImage);
}

function useCanvasQrReady() {
  return useCanvasAssetReady(preloadCanvasQrImage);
}

function createLoveResultImageSrc(score, total, tier, players) {
  if (typeof document === 'undefined') return getLoveResultImageSrc(score);
  const lovePlayers = normalizePlayerNames({ love: players }).love;
  const girlName = lovePlayers[0];
  const boyName = lovePlayers[1];
  const safeScore = Math.max(0, Math.min(5, Number(score) || 0));
  const safeTotal = Math.max(1, Number(total) || 5);
  const resultTier = tier || RESULT_TIERS[safeScore] || RESULT_TIERS[0];
  const resultTitle = personalizeLoveText(resultTier.title, girlName, boyName);
  const resultMessage = personalizeLoveText(resultTier.msg, girlName, boyName);
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) return getLoveResultImageSrc(score);

  ctx.fillStyle = proto.pink;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = proto.black;
  roundRect(ctx, 70, 80, 940, 1210, 38);
  ctx.fill();

  ctx.fillStyle = proto.white;
  roundRect(ctx, 88, 98, 904, 1172, 30);
  ctx.fill();

  ctx.fillStyle = proto.black;
  roundRect(ctx, 88, 98, 904, 120, 30);
  ctx.fill();

  ctx.fillStyle = proto.white;
  ctx.font = '700 32px "DotGothic16", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(getLoveResultHeaderLabel(girlName, boyName), 132, 170);

  ctx.fillStyle = resultTier.tagBg || proto.pink;
  roundRect(ctx, 742, 126, 190, 54, 27);
  ctx.fill();
  ctx.strokeStyle = proto.white;
  ctx.lineWidth = 4;
  roundRect(ctx, 742, 126, 190, 54, 27);
  ctx.stroke();
  ctx.fillStyle = resultTier.tagBg === proto.yellow || resultTier.tagBg === proto.cyan ? proto.black : proto.white;
  ctx.font = '900 23px "Zen Maru Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(resultTier.tag, 837, 161);

  ctx.fillStyle = proto.cream;
  roundRect(ctx, 142, 265, 796, 330, 30);
  ctx.fill();
  ctx.strokeStyle = proto.pink;
  ctx.setLineDash([18, 16]);
  ctx.lineWidth = 6;
  roundRect(ctx, 142, 265, 796, 330, 30);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = proto.pink;
  const loveScoreLabel = getLoveScoreLabel(girlName, boyName);
  ctx.font = `900 ${loveScoreLabel.length >= 13 ? 27 : 32}px "Zen Maru Gothic", sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(loveScoreLabel, 205, 350);

  ctx.fillStyle = proto.pink;
  ctx.font = '900 122px "RocknRoll One", sans-serif';
  ctx.shadowColor = proto.black;
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 8;
  ctx.shadowOffsetY = 8;
  ctx.fillText(`${safeScore}/${safeTotal}`, 205, 486);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  ctx.fillStyle = proto.yellow;
  roundRect(ctx, 212, 505, 140, 48, 24);
  ctx.fill();
  ctx.strokeStyle = proto.black;
  ctx.lineWidth = 4;
  roundRect(ctx, 212, 505, 140, 48, 24);
  ctx.stroke();
  ctx.fillStyle = proto.black;
  ctx.font = '900 24px "Zen Maru Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('問正解', 282, 537);

  ctx.fillStyle = proto.cyan;
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.arc(760, 416, 124, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (!drawCanvasGirl(ctx, 638, 286, 238, 284)) {
    ctx.fillStyle = resultTier.emoji ? proto.pink : proto.yellow;
    ctx.font = '900 82px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(resultTier.emoji || '♡', 760, 450);
  }

  ctx.fillStyle = proto.pink;
  ctx.font = '900 54px "RocknRoll One", sans-serif';
  ctx.fillStyle = proto.black;
  roundRect(ctx, 408, 632, 264, 44, 22);
  ctx.fill();
  ctx.fillStyle = proto.yellow;
  ctx.font = '900 26px "Zen Maru Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('今日の称号', 540, 662);

  ctx.fillStyle = proto.pink;
  const titleLines = splitCanvasText(resultTitle, 11);
  ctx.font = `900 ${titleLines.length > 1 ? 48 : 54}px "RocknRoll One", sans-serif`;
  drawCanvasLines(ctx, titleLines, 540, 740, 58);

  ctx.fillStyle = proto.white;
  roundRect(ctx, 150, 815, 780, 250, 26);
  ctx.fill();
  ctx.strokeStyle = proto.black;
  ctx.lineWidth = 6;
  roundRect(ctx, 150, 815, 780, 250, 26);
  ctx.stroke();

  ctx.fillStyle = proto.black;
  ctx.font = '900 32px "Zen Maru Gothic", sans-serif';
  const messageLines = String(resultMessage || '')
    .split('\n')
    .flatMap((line) => splitCanvasText(line, 20))
    .slice(0, 4);
  drawCanvasLines(ctx, messageLines, 540, 875, 46);

  ctx.fillStyle = proto.yellow;
  roundRect(ctx, 156, 1094, 768, 132, 26);
  ctx.fill();
  ctx.strokeStyle = proto.black;
  ctx.lineWidth = 5;
  roundRect(ctx, 156, 1094, 768, 132, 26);
  ctx.stroke();
  ctx.fillStyle = proto.black;
  ctx.textAlign = 'center';
  ctx.font = '900 28px "Zen Maru Gothic", sans-serif';
  ctx.fillText('この結果、友達に伝えよう', 448, 1136);
  ctx.fillStyle = proto.pinkDeep;
  ctx.font = '900 22px "Zen Maru Gothic", sans-serif';
  ctx.fillText('あなたなら何問当てられる？', 448, 1170);
  ctx.fillStyle = proto.black;
  ctx.font = '900 22px "DotGothic16", monospace';
  ctx.fillText('streetboardgame.com  /  #わたちゃん', 448, 1203);
  drawCanvasQr(ctx, 784, 1114, 92);

  return canvas.toDataURL('image/png');
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

const REVIEW_CATEGORY_LABELS = {
  food: '食べ物・日常の好み',
  outing: 'おでかけ・遊びの感覚',
  lifestyle: '暮らし方・生活リズム',
  personality: '性格・価値観',
  memory: '思い出・過去のツボ',
  fantasy: 'もしも話・妄想力',
  entertainment: '推し・エンタメ感性',
  challenge: '苦手なこと・挑戦のクセ',
};

function inferReviewCategory(card = {}) {
  const source = `${card.category || ''} ${card.title || ''}`;
  if (/食|飲|ご飯|朝食|夜食|お菓子|コンビニ|味|料理|差し入れ|給食|祭り/.test(source)) return 'food';
  if (/旅行|行きたい|場所|デート|都道府県|地域|遊び|休日|パーティー|イベント/.test(source)) return 'outing';
  if (/家|部屋|暮らし|寝る前|お風呂|朝|支度|持ち物|常備/.test(source)) return 'lifestyle';
  if (/性格|価値観|自分|基準|信じ|人生|言葉|親友|属性/.test(source)) return 'personality';
  if (/昔|思い出|過去|子ども|学校|仕事|教科|アルバイト/.test(source)) return 'memory';
  if (/もし|能力|願い|無人島|宇宙|未来|生まれ変わる|一生/.test(source)) return 'fantasy';
  if (/SNS|映画|推し|本|漫画|音楽|アニメ|ゲーム/.test(source)) return 'entertainment';
  if (/苦手|怖い|挑戦|NG|イライラ|決断/.test(source)) return 'challenge';
  return 'personality';
}

function getCategorySummary(answers, cards, matcher) {
  const hits = {};
  const misses = {};
  answers.forEach((answer, index) => {
    const key = inferReviewCategory(cards[index]);
    if (matcher(answer)) hits[key] = (hits[key] || 0) + 1;
    else misses[key] = (misses[key] || 0) + 1;
  });
  const topKey = (values, fallback) => Object.entries(values)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || fallback;
  return {
    hit: REVIEW_CATEGORY_LABELS[topKey(hits, 'personality')],
    miss: REVIEW_CATEGORY_LABELS[topKey(misses, 'fantasy')],
    hitCount: Object.values(hits).reduce((sum, count) => sum + count, 0),
    missCount: Object.values(misses).reduce((sum, count) => sum + count, 0),
  };
}

const LOVE_REVIEW_VARIANTS = {
  opening: [
    '{boyName}と{girlName}は、{level}の恋愛相性です。',
    '{boyName}の読みは、{girlName}に対して{level}。',
    'ふたりの答え合わせは、{level}の空気が出ています。',
    '{boyName}から見た{girlName}理解度は、{level}でじわっと個性あり。',
  ],
  title: [
    '今日の称号「{title}」は、正解数よりもズレ方に味があるタイプ。',
    '「{title}」という結果どおり、近い部分と読めない部分が混ざっています。',
    '称号は「{title}」。分かっているところの強さがちゃんと出ています。',
    '今日のふたりは「{title}」寄り。答え合わせで距離が縮まる組み合わせ。',
  ],
  hit: [
    '{hit}では、ふたりの感覚が自然に重なりやすい流れ。',
    '{hit}まわりは強め。{boyName}の観察力がちゃんと働いています。',
    '{hit}の答えは近め。普段の会話や空気から、好みを拾えている印象。',
    '{hit}では、{girlName}の本音にかなり近いところまで届いています。',
  ],
  insight: [
    '何気ない選択や普段の好みほど、{boyName}の観察力が出やすいタイプ。',
    '言葉にしていない小さなクセほど、ふたりの関係性がにじみます。',
    '当たった答えには、いつもの会話で拾ったヒントがちゃんと残っています。',
    '正解した部分は、偶然というより「ちゃんと見てる」が出たところ。',
  ],
  miss: [
    '一方で{miss}では、{girlName}の中にまだ読めない余白が残っています。',
    '{miss}のズレは、知らないというより「まだ聞いたことがない」系の余白。',
    '{miss}では、{girlName}の意外な一面が少しだけ顔を出しています。',
    '{miss}まわりは、次に話すと盛り上がりそうな未回収ゾーン。',
  ],
  score: {
    high: [
      '全体的には、言葉にしなくても伝わる部分が多い安心シンクロ型。',
      'かなり分かっているけれど、完璧すぎない余白がかわいいタイプ。',
      '正解数は強め。あとは細かい好みのアップデートでさらに近づきます。',
    ],
    mid: [
      'ズレもあるけど、そのズレが会話のネタになって距離を縮める組み合わせ。',
      '分かるところと意外なところのバランスが、いちばん盛り上がるタイプ。',
      '半分以上読めている空気感。まだ知らない部分があるから面白い状態。',
    ],
    low: [
      '今はまだ予想外れも多め。でも知るほど急に伸びるポテンシャル型。',
      '未知数が多いぶん、答え合わせで新しい発見が出やすいタイプ。',
      'まだ読み切れていないけれど、ここから会話が増える余地はかなりあります。',
    ],
  },
  close: [
    '総合すると、ふたりは答え合わせでじわじわ仲が深まるタイプです。',
    '恋愛相性で見ると、正解数よりも「理由を聞いた時の盛り上がり」が強み。',
    'ふたりの距離は、当たり外れより答え合わせの会話で近づくタイプ。',
    'まとめると、ズレまで含めてネタになる、会話強めの相性です。',
  ],
};

function getLoveReviewLines(answers, cards, players, title = '') {
  const lovePlayers = normalizePlayerNames({ love: players }).love;
  const girlName = lovePlayers[0];
  const boyName = lovePlayers[1];
  const total = Math.max(1, answers.length);
  const score = answers.filter((answer) => answer.match).length;
  const themes = getCategorySummary(answers, cards, (answer) => answer.match);
  const personalizedTitle = personalizeLoveText(title || '彼女データ更新中', girlName, boyName);
  const level = score >= 4 ? 'かなり近い波長' : score >= 2 ? '半分シンクロ型' : '未知数多めの開拓型';
  const scoreBand = score >= 4 ? 'high' : score >= 2 ? 'mid' : 'low';
  const questionSeed = cards.reduce((sum, card, index) => {
    const text = `${card?.category || ''}${card?.title || ''}`;
    return sum + Array.from(text).reduce((s, char) => s + char.charCodeAt(0), 0) + (answers[index]?.match ? 17 : 3);
  }, 0);
  const values = {
    girlName,
    boyName,
    title: personalizedTitle,
    level,
    hit: themes.hit,
    miss: themes.miss,
  };
  const fillTemplate = (template) => template.replace(/\{(\w+)\}/g, (_, key) => values[key] || '');
  const pickVariant = (list, offset = 0) => {
    const seed = questionSeed + (score * 13) + (themes.hit.length * 5) + (themes.miss.length * 7) + offset;
    return list[Math.abs(seed) % list.length];
  };
  const hitLine = score > 0
    ? `${fillTemplate(pickVariant(LOVE_REVIEW_VARIANTS.hit, 3))} ${fillTemplate(pickVariant(LOVE_REVIEW_VARIANTS.insight, 4))}`
    : `${boyName}にとって、${girlName}の答えはまだ意外性多め。普段のイメージだけでは読みきれない、発見が多い回です。`;
  const missLine = score < total
    ? fillTemplate(pickVariant(LOVE_REVIEW_VARIANTS.miss, 5))
    : `今回は外した問題なし。${girlName}の好みや迷いどころまで、${boyName}の読みがかなり届いています。`;
  return [
    `${fillTemplate(pickVariant(LOVE_REVIEW_VARIANTS.opening, 1))} ${fillTemplate(pickVariant(LOVE_REVIEW_VARIANTS.title, 2))}`,
    hitLine,
    missLine,
    `${fillTemplate(pickVariant(LOVE_REVIEW_VARIANTS.score[scoreBand], 6))} ${fillTemplate(pickVariant(LOVE_REVIEW_VARIANTS.close, 7))}`,
  ];
}

const GROUP_REVIEW_COLORS = [
  { bg: '#DDF7FF', chip: '#5BD4E8' },
  { bg: '#FFE4EE', chip: '#EC4F88' },
  { bg: '#FFF0C6', chip: '#F59A32' },
];

const GROUP_REVIEW_VARIANTS = {
  friend: {
    opening: [
      '{subject}との友情は{level}。「{rank}」のにおいがします。',
      '{subject}との距離感は{level}。まだ見えてない引き出しも込みで「{rank}」タイプ。',
      '{subject}との相性は{level}。分かるところと謎なところの混ざり方が「{rank}」っぽい。',
      '{subject}への理解は{level}。当たった数より、ズレ方に友情のクセが出ています。',
    ],
    hit: [
      '{hit}では感覚が近く、何気ないノリが自然にそろいやすい流れ。',
      '{hit}の話になると、相手の好き嫌いやテンションを拾う力が出ています。',
      '{hit}まわりは強め。普段の会話や空気から、ちゃんと情報を集めているタイプ。',
      '{hit}では読みが当たりやすく、友達としての観察メモが地味に優秀。',
    ],
    miss: [
      '一方で{miss}は、まだ知らない余白が残るゾーン。ここが次に盛り上がるネタです。',
      '{miss}ではズレが出やすく、相手の中の意外な一面が顔を出しています。',
      '{miss}の読み違いは、仲が浅いというより「そこ聞いたことなかった」系のズレ。',
      '{miss}はまだ未回収の伏線多め。聞けば一気に距離が縮まりそう。',
    ],
    closing: [
      '総合すると、分かる部分と意外な部分のバランスが楽しい発見型。',
      '総合すると、いつものノリの奥にまだ掘れる話題が眠っているタイプ。',
      '総合すると、答え合わせで笑いながら友情データが更新される組み合わせ。',
      '総合すると、近いようで少しズレる、そのズレまで含めておいしい関係です。',
    ],
  },
  family: {
    opening: [
      '{subject}との家族相性は{level}。「{rank}」タイプです。',
      '{subject}への理解は{level}。家族なのにまだ発掘ポイントがある「{rank}」系。',
      '{subject}との距離感は{level}。近すぎて逆に見逃すところまで含めて家族っぽい。',
      '{subject}との絆は{level}。当たり方より、外し方に家族の味が出ています。',
    ],
    hit: [
      '{hit}では感覚が合いやすく、暮らしの中で自然に情報を拾えている印象。',
      '{hit}まわりは強め。毎日の空気感から、ちゃんと相手のクセを読めています。',
      '{hit}の読みは近め。言葉にしない好みまで、なんとなく察しているタイプ。',
      '{hit}では家族ならではの観察力が出ています。近くにいる強さあり。',
    ],
    miss: [
      '一方で{miss}は、近いからこそ思い込みが混ざりやすいゾーン。',
      '{miss}ではズレが出やすく、家族の中にもまだ知らない顔が残っています。',
      '{miss}は意外と未確認。昔のイメージで止まっている可能性があります。',
      '{miss}のズレは、家族会議より雑談でほどけるタイプの謎です。',
    ],
    closing: [
      '総合すると、分かる部分と知らない部分が同居する、家族らしい発見型。',
      '総合すると、近いのに全部は分からないところが逆におもしろい関係。',
      '総合すると、答え合わせで家庭内データベースが静かに更新される組み合わせ。',
      '総合すると、日常の中にまだ聞いてない話が眠っているタイプです。',
    ],
  },
};

function getGroupReviewSections(answers, cards, players, kind = 'friend') {
  const total = Math.max(1, answers.length);
  const scores = getPlayerScores(answers, players);
  const subject = players[0] || '本人';
  const relation = kind === 'family' ? '家族相性' : '友情相性';
  const variants = GROUP_REVIEW_VARIANTS[kind] || GROUP_REVIEW_VARIANTS.friend;
  const fillTemplate = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => values[key] || '');
  const pickVariant = (list, playerIndex, score, themes, offset = 0) => {
    const seed = (score * 7) + (playerIndex * 11) + themes.hit.length + (themes.miss.length * 3) + offset;
    return list[Math.abs(seed) % list.length];
  };
  return scores.map((player, playerIndex) => {
    const rank = getGroupResultRank(kind, player.score);
    const themes = getCategorySummary(answers, cards, (answer) => answer.matches[playerIndex]);
    const level = player.score >= 4 ? 'かなり高め' : player.score >= 2 ? 'じわじわ深まる途中' : 'まだ謎多め';
    const values = {
      subject,
      playerName: player.name,
      relation,
      level,
      rank: rank.name,
      hit: themes.hit,
      miss: themes.miss,
    };
    const hitLine = player.score > 0
      ? fillTemplate(pickVariant(variants.hit, playerIndex, player.score, themes, 1), values)
      : `${player.name}にとって、${subject}の答えはまだ意外性多め。知らない一面が多く出た回です。`;
    const missLine = player.score < total
      ? fillTemplate(pickVariant(variants.miss, playerIndex, player.score, themes, 2), values)
      : `${player.name}は今回は外しなし。${subject}の好みやクセをかなり自然に読めています。`;
    return {
      name: player.name,
      score: player.score,
      color: GROUP_REVIEW_COLORS[playerIndex % GROUP_REVIEW_COLORS.length],
      lines: [
        fillTemplate(pickVariant(variants.opening, playerIndex, player.score, themes, 0), values),
        hitLine,
        missLine,
        fillTemplate(pickVariant(variants.closing, playerIndex, player.score, themes, 3), values),
      ],
    };
  });
}

function ResultReviewBox({ lines, title = 'AI総評', onScrolledPast }) {
  const boxRef = useRef(null);
  useEffect(() => {
    if (!onScrolledPast || !lines || !lines.length) return undefined;
    let done = false;
    let hasReadReview = false;
    let rafId = null;
    const initialScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const check = () => {
      if (done || !boxRef.current) return;
      const rect = boxRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
      const requiredVisibleHeight = Math.min(140, Math.max(80, rect.height * 0.25));
      if (currentScrollY > initialScrollY + 80 && visibleHeight >= requiredVisibleHeight) {
        hasReadReview = true;
      }
      if (hasReadReview && rect.bottom <= -viewportHeight * 0.16) {
        done = true;
        onScrolledPast();
      }
    };
    const scheduleCheck = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        check();
      });
    };
    window.addEventListener('scroll', scheduleCheck, { passive: true });
    window.addEventListener('resize', scheduleCheck);
    return () => {
      window.removeEventListener('scroll', scheduleCheck);
      window.removeEventListener('resize', scheduleCheck);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [onScrolledPast, lines]);
  if (!lines || !lines.length) return null;
  return (
    <div ref={boxRef} style={{
      marginTop: 14,
      padding: '12px 12px',
      background: proto.cream,
      color: proto.text,
      border: `2.5px solid ${proto.black}`,
      borderRadius: 14,
      boxShadow: '4px 4px 0 #000',
    }}>
      <div style={{
        display: 'inline-block',
        marginBottom: 8,
        padding: '3px 10px',
        borderRadius: 999,
        background: proto.cyan,
        color: proto.black,
        border: `1.5px solid ${proto.black}`,
        fontSize: 11,
        fontWeight: 900,
      }}>{title}</div>
      <div style={{
        display: 'grid',
        gap: 6,
        fontSize: 12,
        lineHeight: 1.55,
        fontWeight: 800,
        textAlign: 'left',
      }}>
        {lines.map((line, index) => (
          <div key={`${line}-${index}`} style={{
            display: 'block',
          }}>
            <span>{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupResultReviewBox({ sections, title = 'AI総評', onScrolledPast }) {
  const boxRef = useRef(null);
  useEffect(() => {
    if (!onScrolledPast || !sections || !sections.length) return undefined;
    let done = false;
    let hasReadReview = false;
    let rafId = null;
    const initialScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const check = () => {
      if (done || !boxRef.current) return;
      const rect = boxRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
      const requiredVisibleHeight = Math.min(140, Math.max(80, rect.height * 0.25));
      if (currentScrollY > initialScrollY + 80 && visibleHeight >= requiredVisibleHeight) {
        hasReadReview = true;
      }
      if (hasReadReview && rect.bottom <= -viewportHeight * 0.16) {
        done = true;
        onScrolledPast();
      }
    };
    const scheduleCheck = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        check();
      });
    };
    window.addEventListener('scroll', scheduleCheck, { passive: true });
    window.addEventListener('resize', scheduleCheck);
    return () => {
      window.removeEventListener('scroll', scheduleCheck);
      window.removeEventListener('resize', scheduleCheck);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [onScrolledPast, sections]);
  if (!sections || !sections.length) return null;
  return (
    <div ref={boxRef} style={{
      marginTop: 14,
      padding: '12px 12px',
      background: proto.cream,
      color: proto.text,
      border: `2.5px solid ${proto.black}`,
      borderRadius: 14,
      boxShadow: '4px 4px 0 #000',
    }}>
      <div style={{
        display: 'inline-block',
        marginBottom: 10,
        padding: '3px 10px',
        borderRadius: 999,
        background: proto.cyan,
        color: proto.black,
        border: `1.5px solid ${proto.black}`,
        fontSize: 11,
        fontWeight: 900,
      }}>{title}</div>
      <div style={{ display: 'grid', gap: 10 }}>
        {sections.map((section) => (
          <div key={section.name} style={{
            padding: '10px 10px',
            background: section.color.bg,
            border: `2px solid ${proto.black}`,
            borderRadius: 12,
            boxShadow: '3px 3px 0 #000',
            textAlign: 'left',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 8,
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 28,
                padding: '0 10px',
                borderRadius: 999,
                background: section.color.chip,
                color: proto.white,
                border: `1.5px solid ${proto.black}`,
                boxShadow: '1.5px 1.5px 0 #000',
                fontSize: 12,
                fontWeight: 900,
              }}>{section.name}</span>
              <span style={{
                flexShrink: 0,
                fontFamily: proto.display,
                color: proto.pinkDeep,
                fontSize: 18,
                lineHeight: 1,
              }}>{section.score}/5</span>
            </div>
            <div style={{
              display: 'grid',
              gap: 6,
              fontSize: 12,
              lineHeight: 1.55,
              fontWeight: 800,
            }}>
              {section.lines.map((line, index) => (
                <div key={`${section.name}-${index}`} style={{
                  display: 'block',
                }}>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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

function blurActiveControl() {
  if (typeof document === 'undefined') return;
  const active = document.activeElement;
  if (active && typeof active.blur === 'function') active.blur();
}

function resetViewportPosition(behavior = 'auto') {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  window.scrollTo({ top: 0, left: 0, behavior });
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
  const root = document.getElementById('root');
  if (root) {
    root.scrollLeft = 0;
    root.scrollTop = 0;
  }
}

// ─────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────
function App() {
  // URL からのリクエスト (旧Wix URLリダイレクト): window.__INITIAL_SCREEN
  const urlScreen = (typeof window !== 'undefined' && window.__INITIAL_SCREEN) || null;
  const initial = urlScreen
    ? { screen: urlScreen, qIdx: 0, answers: [], cards: [] }
    : { screen: 'top', qIdx: 0, answers: [], cards: [] };
  // 使ったら消す (リロード時に二重発動しないように)
  if (typeof window !== 'undefined') window.__INITIAL_SCREEN = null;

  const [screen, setScreen] = useState(initial.screen);
  const [qIdx, setQIdx] = useState(initial.qIdx);
  const [answers, setAnswers] = useState(initial.answers);
  const [cards, setCards] = useState(initial.cards || []);
  const [playerCount, setPlayerCount] = useState(normalizeFriendPlayerCount(initial.playerCount));
  const [playerNames, setPlayerNames] = useState(loadPlayerNames);
  const [loveMode, setLoveMode] = useState('girlTarget');

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
    preloadCanvasCharacterImage();
    savePlayerNames(playerNames);
  }, [playerNames]);

  useEffect(() => {
    if (screen === 'about' && window.__SCROLL_TO_CONTACT) return;
    resetViewportPosition('auto');
    const frame = window.requestAnimationFrame
      ? window.requestAnimationFrame(() => resetViewportPosition('auto'))
      : setTimeout(() => resetViewportPosition('auto'), 0);
    return () => {
      if (window.cancelAnimationFrame && typeof frame === 'number') {
        window.cancelAnimationFrame(frame);
      } else {
        clearTimeout(frame);
      }
    };
  }, [screen, qIdx]);

  const updatePlayerName = (kind, index, value) => {
    setPlayerNames((current) => {
      const normalized = normalizePlayerNames(current, true);
      const fallback = DEFAULT_PLAYER_NAMES[kind] && DEFAULT_PLAYER_NAMES[kind][index];
      if (!fallback) return normalized;
      normalized[kind] = [...normalized[kind]];
      normalized[kind][index] = sanitizePlayerName(value, fallback, true);
      return normalized;
    });
  };

  const lovePlayPlayers = useMemo(() => {
    const names = normalizePlayerNames(playerNames).love;
    return loveMode === 'boyTarget' ? [names[1], names[0]] : names;
  }, [playerNames, loveMode]);

  const startNewRound = () => {
    blurActiveControl();
    resetViewportPosition('auto');
    const picked = window.pickRandomCards(ROUND_SIZE);
    setCards(picked);
    setQIdx(0);
    setAnswers([]);
    setScreen('play');
  };

  const startFriendRound = (count) => {
    blurActiveControl();
    resetViewportPosition('auto');
    const picked = window.pickRandomFriendCards(FRIEND_ROUND_SIZE);
    setPlayerCount(normalizeFriendPlayerCount(count));
    setCards(picked);
    setQIdx(0);
    setAnswers([]);
    setScreen('friendOrder');
  };

  const startFamilyRound = (count) => {
    blurActiveControl();
    resetViewportPosition('auto');
    const picked = window.pickRandomFamilyCards(FAMILY_ROUND_SIZE);
    setPlayerCount(normalizeFriendPlayerCount(count));
    setCards(picked);
    setQIdx(0);
    setAnswers([]);
    setScreen('familyOrder');
  };

  const backToTop = () => {
    setScreen('top'); setQIdx(0); setAnswers([]); setCards([]); setPlayerCount(2);
  };

  const confirmLeaveGame = (nextScreen) => {
    const ok = window.confirm('ゲームを中断して戻りますか？');
    if (ok) setScreen(nextScreen);
  };

  const handleQAnswer = (girlIdx, boyIdx) => {
    const next = [...answers, { girl: girlIdx, boy: boyIdx, match: girlIdx === boyIdx }];
    setAnswers(next);
    if (qIdx + 1 >= cards.length) {
      setScreen('resultReady');
    } else {
      setQIdx(qIdx + 1);
    }
  };

  const handleFriendAnswer = (round) => {
    const next = [...answers, round];
    setAnswers(next);
    if (qIdx + 1 >= cards.length) {
      setScreen('friendResultReady');
    } else {
      setQIdx(qIdx + 1);
    }
  };

  const handleFamilyAnswer = (round) => {
    const next = [...answers, round];
    setAnswers(next);
    if (qIdx + 1 >= cards.length) {
      setScreen('familyResultReady');
    } else {
      setQIdx(qIdx + 1);
    }
  };

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
            onFriend={() => setScreen('friendIntro')}
            onFamily={() => setScreen('familyIntro')}
            onLovePage={() => setScreen('lovePage')}
            onFriendPage={() => setScreen('friendPage')}
            onFamilyPage={() => setScreen('familyPage')}
            onAbout={() => setScreen('about')}
            onProduct={() => setScreen('product')}
          />
        )}
        {screen === 'lovePage' && (
          <GameIntroPage
            kind="love"
            onBack={() => setScreen('top')}
            onStart={() => setScreen('intro')}
            onFriend={() => setScreen('friendPage')}
            onFamily={() => setScreen('familyPage')}
          />
        )}
        {screen === 'friendPage' && (
          <GameIntroPage
            kind="friend"
            onBack={() => setScreen('top')}
            onStart={() => setScreen('friendIntro')}
            onLove={() => setScreen('lovePage')}
            onFamily={() => setScreen('familyPage')}
          />
        )}
        {screen === 'familyPage' && (
          <GameIntroPage
            kind="family"
            onBack={() => setScreen('top')}
            onStart={() => setScreen('familyIntro')}
            onLove={() => setScreen('lovePage')}
            onFriend={() => setScreen('friendPage')}
          />
        )}
        {screen === 'intro' && (
          <IntroScreen
            onStart={startNewRound}
            onBack={() => setScreen('top')}
            playerNames={playerNames.love}
            onPlayerNameChange={(index, value) => updatePlayerName('love', index, value)}
            loveMode={loveMode}
            onLoveModeChange={setLoveMode}
          />
        )}
        {screen === 'friendIntro' && (
          <FriendIntroScreen
            onStart={startFriendRound}
            onBack={() => setScreen('top')}
            playerNames={playerNames.friend}
            onPlayerNameChange={(index, value) => updatePlayerName('friend', index, value)}
          />
        )}
        {screen === 'familyIntro' && (
          <FamilyIntroScreen
            onStart={startFamilyRound}
            onBack={() => setScreen('top')}
            playerNames={playerNames.family}
            onPlayerNameChange={(index, value) => updatePlayerName('family', index, value)}
          />
        )}
        {screen === 'friendOrder' && (
          <PassOrderScreen
            label="FRIEND ORDER"
            title="スマホを回す順番"
            players={getFriendPlayers(playerCount, playerNames.friend)}
            guessName="友達"
            onStart={() => setScreen('friendPlay')}
            onBack={() => setScreen('friendIntro')}
          />
        )}
        {screen === 'familyOrder' && (
          <PassOrderScreen
            label="FAMILY ORDER"
            title="スマホを回す順番"
            players={getFamilyPlayers(playerCount, playerNames.family)}
            guessName="家族"
            onStart={() => setScreen('familyPlay')}
            onBack={() => setScreen('familyIntro')}
          />
        )}
        {screen === 'play' && cards.length > 0 && (
          <PlayScreen
            card={cards[qIdx]}
            qIdx={qIdx}
            total={cards.length}
            players={lovePlayPlayers}
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
            playerNames={playerNames.friend}
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
            playerNames={playerNames.family}
            onAnswer={handleFamilyAnswer}
            onBack={() => confirmLeaveGame('familyIntro')}
          />
        )}
        {screen === 'resultReady' && (
          <ResultReadyScreen
            title="5問終了！"
            subtitle="答え合わせいくよ"
            detail={`${lovePlayPlayers[0]}の答えを、${lovePlayPlayers[1]}が何問当てられたか発表します。ふたりで一緒に見てね。`}
            buttonLabel="答え合わせへ"
            onResult={() => setScreen('result')}
            onHome={backToTop}
          />
        )}
        {screen === 'result' && (
          <ResultScreen
            answers={answers}
            cards={cards}
            players={lovePlayPlayers}
            loveMode={loveMode}
            onReplay={startNewRound}
            onHome={backToTop}
            onAbout={() => setScreen('about')}
          />
        )}
        {screen === 'friendResultReady' && (
          <ResultReadyScreen
            title="5問終了！"
            subtitle="答え合わせいくよ"
            detail={`${playerNames.friend[0]}の答えを、みんなが何問当てられたか発表します。一緒に見てね。`}
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
            playerNames={playerNames.friend}
            onReplay={() => startFriendRound(playerCount)}
            onHome={backToTop}
            onAbout={() => setScreen('about')}
          />
        )}
        {screen === 'familyResultReady' && (
          <ResultReadyScreen
            title="5問終了！"
            subtitle="答え合わせいくよ"
            detail={`${playerNames.family[0]}の答えを、みんなが何問当てられたか発表します。一緒に見てね。`}
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
            playerNames={playerNames.family}
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
function TopScreen({ onStart, onFriend, onFamily, onLovePage, onFriendPage, onFamilyPage, onAbout, onProduct }) {
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
        彼氏の彼女理解度を測定できる無料カップル診断ゲームです。大学生カップルのデート、飲み会、旅行、おうち時間にもスマホ1台で遊べます。彼氏の愛情判定をメインに、同じゲーム内で遊べる彼女版、友達の友情判定、家族の絆判定も公開中です。
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
          <Girl
            variant="full"
            height={320}
            loading="eager"
            fetchPriority="high"
            alt="わたちゃん 彼氏の愛情判定ゲームのメインキャラクター"
          />
        </div>
        {/* カードスタック (右側) */}
        <div style={{ flex: 1, minWidth: 0, marginBottom: 24 }}>
          <CardStack />
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '0 24px', position: 'relative', zIndex: 1 }}>
        <button onClick={onStart} style={primaryBtn()}>
          彼氏の愛情を判定する
          <span style={{
            display: 'inline-block', marginLeft: 6,
            color: proto.yellow, fontSize: 18,
            textShadow: '1px 1px 0 #000',
          }}>▶</span>
        </button>
        <div style={{
          marginTop: 8,
          textAlign: 'center',
          fontSize: 10,
          lineHeight: 1.5,
          color: proto.white,
          opacity: 0.82,
          fontWeight: 800,
        }}>
          メイン作品、彼氏の愛情判定ゲーム
        </div>
        <a href="/remote" style={{
          ...secondaryBtn(),
          marginTop: 12,
          background: proto.cyan,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
        }}>
          遠隔で遊ぶ
        </a>
        <button onClick={onFriend} style={{
          ...secondaryBtn(),
          marginTop: 12,
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
          maxWidth: 420,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          シリーズ作品の友情判定版・家族の絆判定版もお楽しみください
        </div>
        <div aria-label="おすすめの遊ぶ場面" style={{
          marginTop: 12,
          display: 'flex',
          justifyContent: 'center',
          gap: 7,
          flexWrap: 'wrap',
        }}>
          {['大学生カップル', 'デート中', '飲み会', '旅行', 'おうち時間'].map((scene) => (
            <span key={scene} style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 26,
              padding: '4px 9px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.18)',
              border: '1.5px solid rgba(255,255,255,0.45)',
              color: proto.white,
              fontSize: 10,
              fontWeight: 900,
              lineHeight: 1,
              whiteSpace: 'nowrap',
              textShadow: '0 1px 0 rgba(0,0,0,0.15)',
            }}>
              {scene}
            </span>
          ))}
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

      {/* 遊び方・紹介ページへの入口 */}
      <div style={{ padding: '28px 24px 0', position: 'relative', zIndex: 1 }}>
        <div style={{
          fontFamily: proto.body, fontSize: 13,
          color: proto.white, letterSpacing: 0,
          marginBottom: 10, paddingLeft: 4,
          fontWeight: 900,
          textShadow: '1px 1px 0 rgba(0,0,0,0.25)',
        }}>まずはどんなゲームか知りたい</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <SeriesCard emoji="💕" title="彼氏の愛情判定" status="メイン" href="/love" onClick={onLovePage} />
          <SeriesCard emoji="👯" title="友達の友情判定" status="シリーズ" href="/friends" onClick={onFriendPage} />
          <SeriesCard emoji="👨‍👩‍👧" title="家族の絆判定" status="シリーズ" href="/family" onClick={onFamilyPage} />
        </div>
      </div>

      {/* フッターリンク */}
      <div style={{
        padding: '22px 24px 0', position: 'relative', zIndex: 1,
        display: 'flex', justifyContent: 'center', gap: 18,
      }}>
        <FooterLink href="/about" onClick={onAbout}>About</FooterLink>
        <span style={{ color: proto.white, opacity: 0.4 }}>·</span>
        <FooterLink href="/product" onClick={onProduct}>製品版</FooterLink>
      </div>
    </main>
  );
}

const GAME_INTRO_CONTENT = {
  love: {
    pill: 'LOVE CHECK',
    title: '彼氏の愛情判定ゲーム',
    heading: '彼氏の彼女理解度を測定します',
    lead: '私のこと、ちゃんと分かってるよねは、彼氏の彼女理解度を測定するゲームです。お題が５問出ます。彼女は思った答えをそのまま回答してください。彼氏は彼女が何と答えたか、予想して当ててください。５問中何問正解したかで彼氏の彼女理解度を判定します。',
    body: 'スマホ1台で始められるので、大学生カップルのデート中、飲み会、旅行、おうち時間でも気軽に遊べます。5問だけなのでテンポよく終わり、最後に何問当たったか、どの問題が当たったかをまとめて確認できます。',
    recommendTitle: 'こんなカップルにおすすめ',
    recommend: [
      '彼氏が彼女の好みをどれだけ分かっているか試したい',
      '付き合いたてで、自然に相手のことを知る話題がほしい',
      'デート中やおうち時間に、スマホだけで短く盛り上がりたい',
      '飲み会や旅行で、カップル診断っぽく結果をシェアしたい',
    ],
    scenes: ['大学生カップル', 'デート中', 'おうち時間', '飲み会', '旅行'],
    faq: [
      {
        q: '彼女の愛情判定もできる？',
        a: 'はい、できます。ゲームの設定に「誰の愛情を判定する？」という項目があります。そこで彼女の答えを彼氏が当てるを選んでください。',
      },
      {
        q: '無料で遊べますか？',
        a: '無料で遊べます。スマホ1台で5問だけ出題され、結果画像やシェア文も作れます。',
      },
      {
        q: 'どんな場面で遊びやすいですか？',
        a: '大学生カップルのデート中、飲み会、旅行、おうち時間など、短時間で相手の好みや考え方を知りたい場面に向いています。',
      },
    ],
    cta: '愛情判定をはじめる',
    related: [
      { label: '友達の友情判定を見る', href: '/friends', action: 'friend' },
      { label: '家族の絆判定を見る', href: '/family', action: 'family' },
    ],
  },
  friend: {
    pill: 'FRIEND CHECK',
    title: '友達の友情判定ゲーム',
    heading: '友達同士で盛り上がる無料の友情診断',
    lead: '友達の友情判定は、本人が選んだ答えを友達が予想して、どれだけ分かっているかをチェックするゲームです。本人は思った答えをそのまま回答してください。友達は本人が何と答えたか、予想して当ててください。5問中何問正解したかで、友達のことをどれだけ理解しているか診断します。',
    body: '2〜4人で遊べるので、大学生の友達同士、休み時間、旅行、飲み会などでどうぞ。本人、友達A、友達B、友達Cのように参加人数を選び、最後にそれぞれ5問中何問正解したかを見られます。',
    recommendTitle: 'こんな友達同士におすすめ',
    recommend: [
      '仲のいい友達の好みや考え方を、改めて確かめたい',
      '大学生の集まりや飲み会で、会話のきっかけがほしい',
      '旅行や休み時間に、2〜4人でさくっと遊べる友情ゲームを探している',
      '結果をLINEやXで共有して、あとから話題にしたい',
    ],
    scenes: ['大学生の集まり', '休み時間', '旅行', '飲み会'],
    faq: [
      {
        q: '友達の友情判定は何人で遊べますか？',
        a: '2〜4人で遊べます。本人が答えを選び、友達A、友達B、友達Cが順番に予想します。',
      },
      {
        q: '友情診断の結果はどう表示されますか？',
        a: '5問後に、友達ごとの正解数とランク表、答え合わせ、AI総評をまとめて確認できます。',
      },
      {
        q: '友達同士のどんな場面に向いていますか？',
        a: '大学生の集まり、休み時間、飲み会、旅行など、会話のきっかけが欲しい場面で遊びやすいゲームです。',
      },
    ],
    cta: '友情判定をはじめる',
    related: [
      { label: '彼氏の愛情判定を見る', href: '/love', action: 'love' },
      { label: '家族の絆判定を見る', href: '/family', action: 'family' },
    ],
  },
  family: {
    pill: 'FAMILY CHECK',
    title: '家族の絆判定ゲーム',
    heading: '家族で遊べる無料の絆チェック',
    lead: '家族の絆判定は、本人が選んだ答えを家族が予想して、家族の理解度を楽しくチェックするゲームです。本人は思った答えをそのまま回答してください。家族は本人が何と答えたか、予想して当ててください。5問中何問正解したかで、家族のことをどれだけ理解しているか診断します。',
    body: '親子、兄弟姉妹、親戚の集まりなどで、普段はあまり聞かない好みや考え方を知るきっかけになります。スマホ1台で2〜4人プレイに対応し、最後に家族それぞれの正解数を一覧で確認できます。',
    recommendTitle: 'こんな家族におすすめ',
    recommend: [
      '親子や兄弟姉妹で、お互いの好みを楽しく知りたい',
      '親戚の集まりや家族旅行で、みんなで遊べる話題がほしい',
      '普段あまり聞かない質問で、家族の意外な一面を知りたい',
      'スマホ1台で、2〜4人の家族ゲームをすぐ始めたい',
    ],
    scenes: ['親子で遊ぶ', '兄弟姉妹', '親戚の集まり', 'おうち時間'],
    faq: [
      {
        q: '家族の絆判定は何人で遊べますか？',
        a: '2〜4人で遊べます。本人が選んだ答えを、家族が順番に予想する形式です。',
      },
      {
        q: '家族診断の結果では何が分かりますか？',
        a: '家族ごとの正解数、ランク表、答え合わせ、AI総評を表示します。普段聞かない好みや考え方を知るきっかけになります。',
      },
      {
        q: 'どんな家族イベントに向いていますか？',
        a: 'おうち時間、親戚の集まり、家族旅行、親子の会話など、少し笑いながらお互いを知りたい場面に向いています。',
      },
    ],
    cta: '家族の絆判定をはじめる',
    related: [
      { label: '彼氏の愛情判定を見る', href: '/love', action: 'love' },
      { label: '友達の友情判定を見る', href: '/friends', action: 'friend' },
    ],
  },
};

function GameIntroPage({ kind, onBack, onStart, onLove, onFriend, onFamily }) {
  const content = GAME_INTRO_CONTENT[kind] || GAME_INTRO_CONTENT.love;
  const actionMap = { love: onLove, friend: onFriend, family: onFamily };
  return (
    <main style={{
      minHeight: '100vh',
      background: proto.pink,
      color: proto.text,
      paddingBottom: 36,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <Decor />
      <div style={{
        background: proto.black,
        color: proto.white,
        padding: '50px 22px 30px',
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'center',
      }}>
        <BackBtn onClick={onBack} top={50} dark label="トップに戻る" />
        <div style={{
          position: 'absolute',
          right: -18,
          bottom: -18,
          opacity: 0.82,
          pointerEvents: 'none',
        }}>
          <Girl variant="default" height={150} />
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <PillLabel>{content.pill}</PillLabel>
          <h1 style={{
            margin: '16px 0 0',
            fontSize: 'clamp(24px, 7vw, 34px)',
            lineHeight: 1.25,
            color: proto.white,
            textShadow: '3px 3px 0 #5BD4E8',
          }}>
            {content.title}
          </h1>
        </div>
      </div>

      <div style={{ padding: '22px 22px 0', position: 'relative', zIndex: 1 }}>
        <section style={{
          background: proto.white,
          border: `3px solid ${proto.black}`,
          borderRadius: 14,
          boxShadow: proto.shadowHard,
          padding: '18px 16px',
        }}>
          <h2 style={{ margin: 0, fontSize: 20, lineHeight: 1.45 }}>
            {content.heading}
          </h2>
          <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.8, fontWeight: 800 }}>
            {content.lead}
          </p>
          <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.85, fontWeight: 700 }}>
            {content.body}
          </p>
        </section>

        <section style={{
          marginTop: 16,
          background: proto.black,
          color: proto.white,
          border: `3px solid ${proto.black}`,
          borderRadius: 14,
          boxShadow: proto.shadowHard,
          padding: '14px 14px 16px',
        }}>
          <div style={{ fontFamily: proto.caption, fontSize: 10, color: proto.yellow, letterSpacing: '0.16em', marginBottom: 10 }}>
            PLAY SCENE
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {content.scenes.map((scene) => (
              <span key={scene} style={{
                display: 'inline-flex',
                minHeight: 28,
                alignItems: 'center',
                padding: '5px 10px',
                borderRadius: 999,
                background: proto.yellow,
                color: proto.black,
                border: `2px solid ${proto.black}`,
                boxShadow: '2px 2px 0 #000',
                fontSize: 11,
                fontWeight: 900,
              }}>{scene}</span>
            ))}
          </div>
        </section>

        <section style={{
          marginTop: 16,
          background: proto.white,
          border: `3px solid ${proto.black}`,
          borderRadius: 14,
          boxShadow: proto.shadowHard,
          padding: '14px',
        }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>{content.recommendTitle}</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {content.recommend.map((item) => (
              <div key={item} style={{
                display: 'grid',
                gridTemplateColumns: '22px minmax(0, 1fr)',
                gap: 8,
                alignItems: 'start',
                fontSize: 12,
                lineHeight: 1.7,
                fontWeight: 800,
              }}>
                <span style={{
                  display: 'inline-flex',
                  width: 20,
                  height: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  background: proto.cyan,
                  border: `2px solid ${proto.black}`,
                  boxShadow: '1px 1px 0 #000',
                  fontSize: 10,
                  lineHeight: 1,
                }}>✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <button onClick={onStart} style={{ ...primaryBtn(), marginTop: 18 }}>
          {content.cta}
          <span style={{ display: 'inline-block', marginLeft: 6, color: proto.yellow, fontSize: 18, textShadow: '1px 1px 0 #000' }}>▶</span>
        </button>

        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {content.related.map((item) => {
            const action = actionMap[item.action];
            return (
              <a key={item.href} href={item.href} onClick={(event) => {
                if (!action) return;
                event.preventDefault();
                action();
              }} style={{
                display: 'block',
                textAlign: 'center',
                background: proto.white,
                color: proto.black,
                border: `2.5px solid ${proto.black}`,
                borderRadius: 12,
                boxShadow: '3px 3px 0 #000',
                padding: '13px 12px',
                fontSize: 13,
                fontWeight: 900,
                textDecoration: 'none',
              }}>
                {item.label}
              </a>
            );
          })}
        </div>

        <section style={{
          marginTop: 16,
          background: '#FFF7F1',
          border: `3px solid ${proto.black}`,
          borderRadius: 14,
          boxShadow: proto.shadowHard,
          padding: '14px',
        }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>よくある質問</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {content.faq.map((item) => (
              <div key={item.q} style={{
                padding: '12px 12px',
                background: proto.white,
                border: `2px solid ${proto.black}`,
                borderRadius: 12,
              }}>
                <h3 style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>
                  {item.q}
                </h3>
                <p style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.75, fontWeight: 700 }}>
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function FooterLink({ children, href = '#', onClick }) {
  return (
    <a href={href} onClick={(event) => {
      if (!onClick) return;
      event.preventDefault();
      onClick();
    }} style={{
      background: 'transparent', border: 'none',
      color: proto.white, fontFamily: proto.caption,
      fontSize: 11, letterSpacing: '0.2em',
      textDecoration: 'underline',
      textDecorationColor: 'rgba(255,255,255,0.5)',
      textUnderlineOffset: 4, cursor: 'pointer',
    }}>{children}</a>
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
    { rotate: -8, top: 10,  left: 30,  delay: 0,    z: 1, src: 'assets/cards/1.png', webp: 'assets/cards/1.webp' },
    { rotate: 4,  top: 0,   left: 100, delay: 0.1,  z: 3, src: 'assets/cards/20.png', webp: 'assets/cards/20.webp' },
    { rotate: -3, top: 18,  left: 170, delay: 0.2,  z: 2, src: 'assets/cards/15.png', webp: 'assets/cards/15.webp' },
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
          <picture style={{ display: 'block', width: '100%', height: '100%' }}>
            <source srcSet={s.webp} type="image/webp" />
            <img src={s.src} alt="" width="110" height="165" loading="eager" decoding="async" style={{
              width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top',
              display: 'block',
            }} />
          </picture>
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

function SeriesCard({ emoji, title, status = 'COMING SOON', href = '#', onClick }) {
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
      <a href={href} onClick={(event) => {
        event.preventDefault();
        onClick();
      }} style={{
        ...style,
        fontFamily: proto.body,
        textDecoration: 'none',
        display: 'block',
      }}>
        {inner}
      </a>
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
function IntroScreen({ onStart, onBack, playerNames, onPlayerNameChange, loveMode, onLoveModeChange }) {
  const lovePlayers = normalizePlayerNames({ love: playerNames }).love;
  const girlName = lovePlayers[0];
  const boyName = lovePlayers[1];
  const targetName = loveMode === 'boyTarget' ? boyName : girlName;
  const guesserName = loveMode === 'boyTarget' ? girlName : boyName;
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
        <IntroSeoCard
          title="彼氏の愛情判定ゲームの遊び方"
          text="私のこと、ちゃんと分かってるよねは、彼氏の愛情を判定するゲームです。彼女が選んだお題の答えを、彼氏が予想し、５問中、何問当てられるかで彼氏の愛情を判定します（逆に、彼氏が選んだお題の答えを彼女が予想する遊び方もできます）"
          details={[
            '大学生カップルのデート中、飲み会、旅行、おうち時間、付き合いたての会話のきっかけにも使えるゲームです。最後に答え合わせがまとまって出ます。当たった問題も外した問題も振り返って一緒に盛り上がりましょう。',
          ]}
          tags={['彼氏の愛情判定', '彼女の愛情判定', '大学生カップル', 'カップル診断', '無料ゲーム']}
        />
        <NameEditorPanel
          title="名前を変える（任意）"
          names={playerNames}
          defaults={DEFAULT_PLAYER_NAMES.love}
          onChange={onPlayerNameChange}
        />
        <LoveModePanel
          girlName={girlName}
          boyName={boyName}
          loveMode={loveMode}
          onChange={onLoveModeChange}
        />
        <StepCard n="1" text={`${targetName}は、${guesserName}に見せずに自分が思った答えを選ぶ`} />
        <StepCard n="2" text={`${guesserName}は、${targetName}が選んだ答えを予想して同じ色を選ぶ`} />
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
            {targetName}の本音を、{guesserName}がどれだけ当てられるかをチェック。<br/>
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

function LoveModePanel({ girlName, boyName, loveMode, onChange }) {
  const options = [
    {
      key: 'girlTarget',
      title: `${boyName}の愛情判定`,
      sub: `${girlName}が選んだ答えを、${boyName}は当てられるか？`,
      bg: proto.yellow,
    },
    {
      key: 'boyTarget',
      title: `${girlName}の愛情判定`,
      sub: `${boyName}が選んだ答えを、${girlName}は当てられるか？`,
      bg: proto.cyan,
    },
  ];
  return (
    <div style={{
      marginBottom: 16,
      padding: 12,
      background: proto.black,
      color: proto.white,
      border: `3px solid ${proto.black}`,
      borderRadius: 14,
      boxShadow: '5px 5px 0 #000',
    }}>
      <div style={{
        fontFamily: proto.caption,
        fontSize: 10,
        color: proto.yellow,
        letterSpacing: '0.14em',
        marginBottom: 8,
      }}>誰の愛情を判定する？</div>
      <div style={{
        display: 'grid',
        gap: 10,
      }}>
        {options.map((option) => {
          const active = loveMode === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(option.key)}
              style={{
                width: '100%',
                minHeight: 66,
                borderRadius: 12,
                border: `2.5px solid ${proto.black}`,
                background: active ? option.bg : proto.white,
                color: proto.black,
                fontFamily: proto.body,
                fontWeight: 900,
                textAlign: 'left',
                padding: '10px 12px',
                boxShadow: active ? '3px 3px 0 #5BD4E8' : '3px 3px 0 rgba(0,0,0,0.55)',
              }}
            >
              <span style={{ display: 'block', fontSize: 'clamp(13px, 3.7vw, 15px)', lineHeight: 1.35 }}>{option.title}</span>
              <span style={{ display: 'block', marginTop: 3, fontSize: 11, color: proto.textSoft }}>
                {option.sub}
              </span>
            </button>
          );
        })}
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

function IntroSeoCard({ title, text, details = [], tags }) {
  return (
    <section style={{
      margin: '14px 0 12px',
      padding: '14px 14px 12px',
      background: 'rgba(255, 255, 255, 0.94)',
      border: `2.5px solid ${proto.black}`,
      borderRadius: 12,
      boxShadow: proto.shadowHard,
      color: proto.black,
    }}>
      <h2 style={{
        margin: '0 0 8px',
        fontSize: 15,
        lineHeight: 1.45,
        letterSpacing: 0,
      }}>{title}</h2>
      <p style={{
        margin: 0,
        fontSize: 12,
        lineHeight: 1.75,
        fontWeight: 700,
      }}>{text}</p>
      {details.map((detail) => (
        <p key={detail} style={{
          margin: '7px 0 0',
          fontSize: 12,
          lineHeight: 1.75,
          fontWeight: 700,
        }}>{detail}</p>
      ))}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 10,
      }}>
        {tags.map((tag) => (
          <span key={tag} style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 24,
            padding: '3px 9px',
            borderRadius: 999,
            border: `2px solid ${proto.black}`,
            background: proto.yellow,
            color: proto.black,
            fontSize: 10,
            fontWeight: 900,
            lineHeight: 1.2,
            boxShadow: '1.5px 1.5px 0 #000',
          }}>{tag}</span>
        ))}
      </div>
    </section>
  );
}

function NameEditorPanel({ title, names, defaults, onChange, visibleCount }) {
  const count = visibleCount || defaults.length;
  return (
    <div style={{
      margin: '16px 0 22px',
      padding: '12px 12px',
      background: proto.white,
      color: proto.text,
      border: `2.5px solid ${proto.black}`,
      borderRadius: 14,
      boxShadow: '3px 3px 0 #000',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 12, fontWeight: 900 }}>✎ {title}</div>
        <div style={{ fontSize: 9, color: proto.textSoft, fontWeight: 800 }}>名前は{PLAYER_NAME_MAX_LENGTH}文字まで</div>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {defaults.slice(0, count).map((fallback, index) => {
          const value = (names && names[index]) || '';
          return (
          <label key={`${fallback}-${index}`} style={{
            display: 'grid',
            gridTemplateColumns: '74px minmax(0, 1fr)',
            alignItems: 'start',
            gap: 8,
            fontSize: 11,
            fontWeight: 900,
          }}>
            <span style={{ paddingTop: 11 }}>{fallback}</span>
            <span style={{ display: 'grid', gap: 4 }}>
              <input
                value={value}
                onChange={(e) => onChange(index, e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder={`${fallback}（${PLAYER_NAME_MAX_LENGTH}文字まで）`}
                aria-label={`${fallback}の表示名。${PLAYER_NAME_MAX_LENGTH}文字まで`}
                maxLength={PLAYER_NAME_MAX_LENGTH}
                style={{
                  minWidth: 0,
                  height: 38,
                  padding: '0 10px',
                  borderRadius: 10,
                  border: `2px solid ${proto.black}`,
                  background: '#FFF8F1',
                  color: proto.text,
                  fontFamily: proto.body,
                  fontSize: 13,
                  fontWeight: 900,
                  boxSizing: 'border-box',
                }}
              />
              <span style={{
                justifySelf: 'end',
                color: value.length >= PLAYER_NAME_MAX_LENGTH ? proto.pinkDeep : proto.textSoft,
                fontSize: 9,
                fontWeight: 900,
                lineHeight: 1,
              }}>{value.length}/{PLAYER_NAME_MAX_LENGTH}文字</span>
            </span>
          </label>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// PLAY — 同時発表式
// ─────────────────────────────────────────────────────
function PlayScreen({ card, qIdx, total, players, onAnswer, onBack }) {
  const [phase, setPhase] = useState('girl');
  const [girlPick, setGirlPick] = useState(null);
  const [boyPick, setBoyPick] = useState(null);
  const [handoffMessage, setHandoffMessage] = useState('');
  const lovePlayers = normalizePlayerNames({ love: players }).love;
  const girlName = lovePlayers[0];
  const boyName = lovePlayers[1];

  useEffect(() => {
    setPhase('girl'); setGirlPick(null); setBoyPick(null); setHandoffMessage('');
  }, [qIdx, card && card.id]);

  const onGirlPick = (i) => {
    if (girlPick !== null) return;
    setGirlPick(i);
    setHandoffMessage(`${boyName}に渡してね`);
    setTimeout(() => {
      setHandoffMessage('');
      setPhase('boy');
    }, HANDOFF_DELAY_MS);
  };
  const onBoyPick = (i) => {
    if (boyPick !== null) return;
    setBoyPick(i);
    setHandoffMessage(qIdx + 1 >= total ? `${girlName}に渡して結果を見てね` : `${girlName}に渡して次の問題へ`);
    setTimeout(() => onAnswer(girlPick, i), LOVE_RETURN_DELAY_MS);
  };

  if (!card) return null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      minHeight: '100dvh', background: proto.pink, color: proto.white,
      position: 'relative', overflowX: 'hidden',
      paddingBottom: 'calc(118px + env(safe-area-inset-bottom))',
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
      <div style={{ padding: '24px 18px 0', position: 'relative', zIndex: 1 }}>
        <BackBtn onClick={onBack} top={14} dark label="遊び方に戻る" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <div style={{
            fontFamily: proto.caption, fontSize: 10, color: proto.white,
            letterSpacing: '0.15em', whiteSpace: 'nowrap',
          }}>
            QUESTION {qIdx + 1} / {total}
          </div>
          <div style={{
            fontFamily: proto.caption, fontSize: 10, color: proto.yellow,
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
      <div style={{ padding: '4px 18px 2px', textAlign: 'center' }}>
        <QuestionProgress qIdx={qIdx} total={total} />
      </div>
      <div style={{ padding: '2px 18px 4px', textAlign: 'center' }}>
        <PhaseBadge phase={phase} players={lovePlayers} />
      </div>

      {/* お題カード画像 */}
      <div style={{ padding: '0 22px 2px' }}>
        <div style={{
          position: 'relative',
          width: 'min(100%, clamp(218px, 34dvh, 300px))',
          margin: '0 auto',
          borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 12px 28px rgba(0,0,0,0.25)',
          background: '#FFF',
          border: `3px solid ${proto.white}`,
        }}>
          <img src={card.image} alt={card.title} width="756" height="1122" loading="eager" decoding="async" fetchPriority="high" style={{
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
            turnHint={handoffMessage || `今は${girlName}の番`}
            instruction={`${girlName}のターン  ── ${boyName}には見せずに、自分が思った答えの色を選んでね`}
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
              ✦ {girlName}の選択 受付完了 ✦<br/>
              <span style={{ fontSize: 9, color: proto.white, fontWeight: 500, opacity: 0.85 }}>
                次は{boyName}が「{girlName}が選んだ色」を予想してね
              </span>
            </div>
            <ColorPicker
              selected={boyPick}
              onPick={onBoyPick}
              highlight={proto.cyan}
              mode="guess"
              turnHint={handoffMessage || `今は${boyName}の番`}
              instruction={`${boyName}のターン  ── ${girlName}が選んだ色を予想してタップ`}
            />
          </>
        )}
      </div>
      {handoffMessage && <HandoffOverlay message={handoffMessage} />}
    </div>
  );
}

function PhaseBadge({ phase, players }) {
  const names = normalizePlayerNames({ love: players }).love;
  const girlName = names[0];
  const boyName = names[1];
  const conf = {
    girl: {
      eyebrow: 'STEP 1 / 2',
      title: `${girlName}が本音で選ぶターン`,
      note: `${boyName}には見せずに、自分が思った答えを選んでね`,
      color: proto.yellow,
    },
    boy: {
      eyebrow: 'STEP 2 / 2',
      title: `${boyName}が${girlName}の答えを予想`,
      note: `${girlName}がさっき選んだ答えを当ててね`,
      color: proto.cyan,
    },
  }[phase];
  return (
    <div style={{
      display: 'inline-block',
      minWidth: 202,
      maxWidth: '100%',
      padding: '6px 14px 7px',
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
        marginTop: 1,
        fontSize: 15,
        fontWeight: 900,
        lineHeight: 1.25,
      }}>{conf.title}</div>
      <div style={{
        marginTop: 2,
        fontSize: 9,
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
      minWidth: 172,
      padding: '6px 12px',
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
      <span style={{ fontSize: 16, lineHeight: 1 }}>
        {current}<span style={{ fontSize: 12 }}> / {total}問</span>
      </span>
      <span style={{
        fontSize: 9,
        color: proto.textSoft,
        whiteSpace: 'nowrap',
      }}>あと{remaining}問</span>
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
      padding: '54px 22px calc(230px + env(safe-area-inset-bottom))',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <Decor />
      <button
        type="button"
        onClick={onHome}
        style={{
          position: 'absolute',
          top: 'calc(18px + env(safe-area-inset-top))',
          left: 18,
          zIndex: 2,
          padding: '8px 12px',
          borderRadius: 999,
          border: `2px solid ${proto.white}`,
          background: 'rgba(0,0,0,0.22)',
          color: proto.white,
          fontFamily: proto.body,
          fontSize: 11,
          fontWeight: 900,
          cursor: 'pointer',
          touchAction: 'manipulation',
          backdropFilter: 'blur(8px)',
        }}
      >
        ← トップに戻る
      </button>
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
        largePrimary
        lifted
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
      fontSize: 9,
          fontWeight: 900,
          lineHeight: 1.45,
          opacity: 0.72,
        }}>
          画面を見せずにスマホを渡してね
        </div>
      </div>
      <div style={{
        position: 'absolute',
        left: '50%',
        bottom: 'calc(16px + env(safe-area-inset-bottom))',
        transform: 'translateX(-50%)',
        width: 'min(360px, calc(100% - 32px))',
        padding: '9px 12px',
        borderRadius: 999,
        background: proto.black,
        color: proto.yellow,
        border: `2px solid ${proto.yellow}`,
        boxShadow: '3px 3px 0 rgba(0,0,0,0.55)',
        textAlign: 'center',
        fontSize: 13,
        fontWeight: 900,
        lineHeight: 1.25,
        overflowWrap: 'anywhere',
      }}>
        {message}
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

function vibrateOnPick() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(15);
    }
  } catch (e) {}
}

function ColorPicker({ selected, onPick, highlight, instruction, mode = 'answer', turnHint = '' }) {
  const isLocked = selected !== null && selected !== undefined;
  const theme = getTurnColorTheme(mode, highlight);
  return (
    <div style={{
      position: 'fixed',
      left: '50%',
      bottom: 'calc(2px + env(safe-area-inset-bottom))',
      zIndex: 120,
      width: 'min(560px, calc(100% - 36px))',
      transform: 'translateX(-50%)',
    }}>
      <style>{`
        @keyframes chipPop {
          0% { transform: scale(1); }
          58% { transform: scale(1.18); }
          100% { transform: scale(1.08); }
        }
      `}</style>
      {turnHint && (
        <div style={{
          width: 'fit-content',
          maxWidth: '100%',
          margin: '0 auto 3px',
          padding: '4px 11px',
          borderRadius: 999,
          background: proto.black,
          color: theme.color,
          border: `2px solid ${theme.color}`,
          boxShadow: '2px 2px 0 rgba(0,0,0,0.55)',
          fontSize: 11,
          fontWeight: 900,
          lineHeight: 1.25,
          textAlign: 'center',
          overflowWrap: 'anywhere',
        }}>
          {turnHint}
        </div>
      )}
      <div style={{
        background: theme.panelBg,
        backdropFilter: 'blur(8px)',
        border: `2.5px solid ${theme.panelBorder}`,
        borderRadius: 18,
        padding: '7px 9px 7px',
        boxShadow: `0 8px 24px rgba(0,0,0,0.18), inset 0 0 0 1px ${theme.color}`,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 4,
          color: proto.white,
          fontWeight: 900,
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 20,
            padding: '2px 8px',
            borderRadius: 999,
            background: theme.labelBg,
            color: proto.black,
            border: `1.5px solid ${proto.black}`,
            boxShadow: '2px 2px 0 rgba(0,0,0,0.55)',
            fontSize: 10,
            lineHeight: 1,
          }}>{theme.label}</span>
          <span style={{
            fontSize: 9,
            color: isLocked ? theme.color : proto.white,
            opacity: isLocked ? 1 : 0.78,
          }}>{isLocked ? `${COLOR_LABELS[selected]}を選択済み` : 'タップで決定'}</span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 7,
        }}>
          {window.COLOR_OPTIONS.map((opt, i) => {
            const isSelected = selected === i;
            return (
              <button
                key={opt.id}
                onClick={() => {
                  if (!isLocked) {
                    vibrateOnPick();
                    onPick(i);
                  }
                }}
                disabled={isLocked}
                aria-label={`${COLOR_LABELS[i] || opt.name}を選ぶ`}
                style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column',
                minHeight: 45, minWidth: 44,
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
                  size={34}
                  selected={isSelected}
                  highlight={theme.color}
                />
                <span style={{
                  marginTop: 3,
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
        marginTop: 2, fontSize: 8, color: proto.white,
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
    msg: 'まだ知らない一面、多め。\nでもそれって、これから知れる余白がある。\n外した答えほど、ふたりのネタになる ♡',
    shareHook: '彼女データ、ただいま更新中でした' },
  { score: 3, title: 'ドヤ顔まであと一歩', emoji: '💞', tag: '惜しい', tagBg: '#FF7A92',
    msg: '半分以上わかってるのはちゃんと強い。\nただし満点彼氏を名乗るには、\nあと少し。\n外した問題、次回までに要復習 ♡',
    shareHook: '彼氏、ドヤ顔まであと一歩でした' },
  { score: 4, title: '彼女マスターまであと1問', emoji: '💖', tag: 'あと1問', tagBg: proto.pink,
    msg: 'これはかなり分かってる。\nあと1問で満点なのがいちばん悔しいやつ。\nもう一回やったら伝説、ある ♡',
    shareHook: '彼氏、彼女マスターまであと1問でした' },
  { score: 5, title: '彼女公認・理解王', emoji: '💕', tag: '♡ PERFECT ♡', tagBg: proto.yellow,
    msg: '全問正解はさすがに強すぎ。\n好みも迷いどころも、ちゃんと見てる彼氏。\nこれは堂々と自慢していいやつ ♡',
    shareHook: '全問正解、彼氏が彼女公認の理解王でした' },
];

function ResultScreen({ answers, cards, players, loveMode = 'girlTarget', onReplay, onHome, onAbout }) {
  const score = answers.filter(a => a.match).length;
  const total = answers.length || 5;
  const tier = RESULT_TIERS[score] || RESULT_TIERS[0];
  const lovePlayers = normalizePlayerNames({ love: players }).love;
  const girlName = lovePlayers[0];
  const boyName = lovePlayers[1];
  const personalizedTitle = personalizeLoveText(tier.title, girlName, boyName);
  const personalizedMessage = personalizeLoveText(tier.msg, girlName, boyName);
  const personalizedShareHook = personalizeLoveText(tier.shareHook, girlName, boyName);
  const [copied, setCopied] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const shareSheetShownRef = useRef(false);
  const canvasCharacterReady = useCanvasCharacterReady();
  const canvasQrReady = useCanvasQrReady();
  const preparedResultImageSrc = useMemo(
    () => createLoveResultImageSrc(score, total, tier, [girlName, boyName]),
    [score, total, tier, girlName, boyName, canvasCharacterReady, canvasQrReady]
  );

  const titleBreaks = {
    '彼女理解は初期設定中': ['彼女理解は', '初期設定中'],
    '彼女クイズ見習い中': ['彼女クイズ', '見習い中'],
    '彼女マスターまであと1問': ['彼女マスターまで', 'あと1問'],
  };
  const titleLines = titleBreaks[tier.title]
    ? titleBreaks[tier.title].map((line) => personalizeLoveText(line, girlName, boyName))
    : null;
  const titleSize = titleLines ? 22 : (personalizedTitle.length >= 14 ? 18 : 23);
  const titleNode = titleLines
    ? <>{titleLines[0]}<br/>{titleLines[1]}</>
    : personalizedTitle;
  const reviewLines = useMemo(
    () => getLoveReviewLines(answers, cards, [girlName, boyName], tier.title),
    [answers, cards, girlName, boyName, tier.title]
  );

  const showShareSheetAfterReview = () => {
    if (shareSheetShownRef.current) return;
    shareSheetShownRef.current = true;
    setShowShareSheet(true);
  };

  const shareUrl = `${location.origin}/`;
  const loveResultHeaderLabel = getLoveResultHeaderLabel(girlName, boyName);
  const loveGameTitle = `わたちゃん ${loveResultHeaderLabel}ゲーム`;
  const loveHashTag = loveMode === 'boyTarget' ? '#彼女の愛情判定' : '#彼氏の愛情判定';
  const targetName = girlName;
  const guesserName = boyName;
  const xShareText = `わたちゃんで${loveResultHeaderLabel}をやってみた！\n${guesserName}は${targetName}の答えを${score}/${total}問正解。\n称号は「${personalizedTitle}」。\n\nみんなは何問当たる？👇\n#わたちゃん ${loveHashTag}`;
  const lineShareText = `わたちゃんで${loveResultHeaderLabel}をやってみた！${guesserName}は${targetName}の答えを${score}/${total}問正解。称号は「${personalizedTitle}」でした。あなたなら何問当てられる？`;
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
    const text = encodeURIComponent(platform === 'line' ? lineShareText : xShareText);
    const url = encodeURIComponent(shareUrl);
    let target = '';
    if (platform === 'x') target = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
    if (platform === 'copy') {
      copyToClipboard(copyShareText, 'copy');
      return;
    }
    if (platform === 'line') {
      openLineShare(`${lineShareText}\n${shareUrl}`);
      return;
    }
    window.open(target, '_blank', 'noopener,noreferrer,width=600,height=500');
  };

  const handleSaveImage = async () => {
    setImageBusy(true);
    try {
      await savePreparedImage({
        src: preparedResultImageSrc,
        filename: `watachan-love-result-${score}-${total}.png`,
        title: loveGameTitle,
      });
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
      await sharePreparedImage({
        src: preparedResultImageSrc,
        filename: `watachan-love-result-${score}-${total}.png`,
        title: loveGameTitle,
        text: xShareText,
        url: shareUrl,
      });
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      alert('画像シェアに対応していない環境です。画像保存を試してみてください。');
    } finally {
      setImageBusy(false);
    }
  };

  const tagTextColor = tier.tagBg === proto.yellow || tier.tagBg === proto.cyan ? proto.black : proto.white;
  const loveScoreLabel = getLoveScoreLabel(girlName, boyName);

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
          <span>{loveResultHeaderLabel}</span>
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
              fontFamily: proto.body,
              fontSize: 11,
              color: proto.pink,
              letterSpacing: 0,
              marginBottom: 3,
              fontWeight: 900,
              lineHeight: 1.2,
            }}>{loveScoreLabel}</div>
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
          <div style={{
            display: 'inline-block',
            marginBottom: 5,
            padding: '3px 10px',
            borderRadius: 999,
            background: proto.black,
            color: proto.yellow,
            fontSize: 10,
            fontWeight: 900,
            border: `1.5px solid ${proto.black}`,
          }}>今日の称号</div>
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
        }}>{personalizedMessage}</div>

        <div style={{
          margin: '14px 18px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          fontFamily: proto.caption,
          color: proto.black,
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: '0.12em',
        }}>
          <span>streetboardgame.com</span>
          <span style={{ color: proto.pink, fontWeight: 900 }}>みんななら何問当てられる？</span>
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
                  <AnswerPick label={girlName} choice={girlChoice} opt={window.COLOR_OPTIONS[a.girl]} accent={proto.yellow} />
                  <AnswerPick label={boyName} choice={boyChoice} opt={window.COLOR_OPTIONS[a.boy]} accent={proto.cyan} />
                </div>
              </div>
            );
          })}
        </div>
        <ResultReviewBox lines={reviewLines} title="AI総評" />
      </div>

      {/* シェア */}
      <div style={{ padding: '22px 18px 0', position: 'relative', zIndex: 1 }}>
        <ResultImageActions
          busy={imageBusy || !canvasQrReady}
          onShare={handleShareImage}
          onX={() => handleShare('x')}
          onLine={() => handleShare('line')}
          onVisible={showShareSheetAfterReview}
          shareTitle="この結果、友達に伝えよう"
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
            シェア文をコピーしました ♡
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

      <div style={{ textAlign: 'center', marginTop: 24, paddingBottom: 8, position: 'relative', zIndex: 1 }}>
        <FooterLink href="/about" onClick={onAbout}>About / お問い合わせ</FooterLink>
      </div>
      <ShareBottomSheet
        open={showShareSheet}
        busy={imageBusy || !canvasQrReady}
        onClose={() => setShowShareSheet(false)}
        onX={() => handleShare('x')}
        onLine={() => handleShare('line')}
        onShare={handleShareImage}
        shareContext="XやLINEはURLつきで送れます。Instagramはプロフィールリンクへ"
        title="この結果、友達に送る？"
      />
    </div>
  );
}

function ResultImageActions({
  busy,
  onShare,
  onX,
  onLine,
  onVisible,
  shareTitle = 'この結果、友達に伝えよう',
}) {
  const cardRef = useRef(null);
  useEffect(() => {
    if (!onVisible) return undefined;
    const element = cardRef.current;
    if (!element) return undefined;
    let done = false;
    const trigger = () => {
      if (done) return;
      done = true;
      onVisible();
    };
    const check = () => {
      if (done) return;
      const doc = document.documentElement;
      const viewportHeight = window.innerHeight || doc.clientHeight || 0;
      const scrollTop = window.scrollY || doc.scrollTop || 0;
      const remainingScroll = Math.max(0, doc.scrollHeight - (scrollTop + viewportHeight));
      if (remainingScroll <= 48) {
        trigger();
      }
    };
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [onVisible]);

  return (
    <div ref={cardRef} style={{
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
      <div style={{ fontSize: 17 }}>{shareTitle}</div>
      <div style={{ marginTop: 3, fontSize: 11, color: proto.text, lineHeight: 1.5 }}>
        XやLINEはURLつきで送れます。Instagramはプロフィールリンクへ
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        marginTop: 12,
        direction: 'rtl',
      }}>
        <button onClick={onX || onShare} disabled={busy} style={{
          minHeight: 58,
          borderRadius: 12,
          border: `2.5px solid ${proto.black}`,
          background: proto.black,
          color: proto.white,
          fontFamily: proto.body,
          fontSize: 13,
          fontWeight: 900,
          boxShadow: '3px 3px 0 #5BD4E8',
          direction: 'ltr',
          opacity: busy ? 0.65 : 1,
          cursor: busy ? 'default' : 'pointer',
        }}>
          Xで結果をツイート
        </button>
        <button onClick={onLine || onShare} disabled={busy} style={{
          minHeight: 58,
          borderRadius: 12,
          border: `2.5px solid ${proto.black}`,
          background: '#06C755',
          color: proto.white,
          fontFamily: proto.body,
          fontSize: 13,
          fontWeight: 900,
          boxShadow: '3px 3px 0 #000',
          direction: 'ltr',
          opacity: busy ? 0.65 : 1,
          cursor: busy ? 'default' : 'pointer',
        }}>
          LINEで結果を送る
        </button>
      </div>
      <button onClick={onShare} disabled={busy} style={{
        width: '100%',
        minHeight: 50,
        marginTop: 10,
        borderRadius: 12,
        border: `2.5px solid ${proto.black}`,
        background: proto.white,
        color: proto.black,
        fontFamily: proto.body,
        fontSize: 13,
        fontWeight: 900,
        boxShadow: '3px 3px 0 #000',
        opacity: busy ? 0.65 : 1,
        cursor: busy ? 'default' : 'pointer',
      }}>
        {busy ? '画像を準備中...' : '判定画像も送りたい。まずは画像を保存'}
      </button>
    </div>
  );
}

function ShareBottomSheet({
  open,
  busy,
  onClose,
  onX,
  onLine,
  onShare,
  shareContext = 'XやLINEはURLつきで送れます。Instagramはプロフィールリンクへ',
  title = 'この結果、友達に送る？',
}) {
  if (!open) return null;
  const runAction = (action) => {
    if (busy || !action) return;
    if (onClose) onClose();
    action();
  };
  const sheetButton = (background, color = proto.black) => ({
    width: '100%',
    minHeight: 58,
    borderRadius: 13,
    border: `2.5px solid ${proto.black}`,
    background,
    color,
    fontFamily: proto.body,
    fontSize: 14,
    fontWeight: 900,
    boxShadow: background === proto.black ? '3px 3px 0 #5BD4E8' : '3px 3px 0 #000',
    opacity: busy ? 0.65 : 1,
    cursor: busy ? 'default' : 'pointer',
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="結果をシェア"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'grid',
        alignItems: 'end',
        padding: '0 14px calc(14px + env(safe-area-inset-bottom))',
        background: 'rgba(0,0,0,0.38)',
      }}
    >
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 0,
          background: 'transparent',
        }}
      />
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 560,
        margin: '0 auto',
        boxSizing: 'border-box',
        padding: '16px 14px 14px',
        borderRadius: '22px 22px 14px 14px',
        border: `3px solid ${proto.black}`,
        background: proto.yellow,
        color: proto.black,
        boxShadow: '0 -7px 0 #5BD4E8, 0 -18px 40px rgba(0,0,0,0.28)',
        textAlign: 'center',
        fontWeight: 900,
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
        }}>
          SHARE YOUR RESULT
        </div>
        <div style={{ fontSize: 20, lineHeight: 1.35 }}>
          {title}
        </div>
        <div style={{
          marginTop: 5,
          fontSize: 12,
          color: proto.text,
          lineHeight: 1.55,
        }}>
          {shareContext}
        </div>
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          <button
            type="button"
            onClick={() => runAction(onLine)}
            disabled={busy}
            style={sheetButton('#06C755', proto.white)}
          >
            LINEで結果を送る
          </button>
          <button
            type="button"
            onClick={() => runAction(onX)}
            disabled={busy}
            style={sheetButton(proto.black, proto.white)}
          >
            Xで結果をツイート
          </button>
          <button
            type="button"
            onClick={() => runAction(onShare)}
            disabled={busy}
            style={sheetButton(proto.white, proto.black)}
          >
            {busy ? '画像を準備中...' : '判定画像も送りたい。まずは画像を保存'}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 12,
            minHeight: 38,
            padding: '8px 14px',
            border: 0,
            background: 'transparent',
            color: proto.textSoft,
            fontFamily: proto.body,
            fontSize: 13,
            fontWeight: 900,
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          あとで
        </button>
      </div>
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

function FixedActionBar({ primaryLabel, onPrimary, secondaryLabel, onSecondary, largePrimary = false, lifted = false }) {
  const primaryStyle = primaryBtn();
  return (
    <div style={{
      position: 'fixed',
      left: '50%',
      bottom: lifted ? 'calc(92px + env(safe-area-inset-bottom))' : 0,
      transform: 'translateX(-50%)',
      width: 'min(480px, 100vw)',
      padding: lifted ? '10px 18px 12px' : '12px 18px calc(14px + env(safe-area-inset-bottom))',
      boxSizing: 'border-box',
      background: lifted
        ? 'linear-gradient(180deg, rgba(236,79,136,0), rgba(236,79,136,0.88) 24%, rgba(236,79,136,0.96))'
        : 'linear-gradient(180deg, rgba(236,79,136,0), rgba(236,79,136,0.98) 18%, rgba(236,79,136,1))',
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

function PassOrderScreen({ label, title, players, guessName, onStart, onBack }) {
  const mainPlayer = players[0] || '本人';
  return (
    <div style={{
      minHeight: '100dvh',
      background: proto.pink,
      padding: '42px 20px 150px',
      boxSizing: 'border-box',
      position: 'relative',
    }}>
      <BackBtn onClick={onBack} top={42} label="人数選択に戻る" />

      <div style={{ textAlign: 'center', paddingTop: 42 }}>
        <PillLabel>{label}</PillLabel>
        <div style={{ marginTop: 14 }}>
          <LogoText size={27}>{title}</LogoText>
        </div>
        <p style={{
          margin: '10px auto 0',
          maxWidth: 330,
          color: proto.white,
          fontSize: 13,
          lineHeight: 1.75,
          fontWeight: 900,
          textShadow: '0 2px 0 rgba(0,0,0,0.18)',
        }}>
          1問ごとに、この順番でスマホを渡してね。
        </p>
      </div>

      <div style={{
        marginTop: 22,
        background: proto.white,
        border: `3px solid ${proto.black}`,
        borderRadius: 18,
        boxShadow: '6px 6px 0 #000',
        padding: '18px 16px',
      }}>
        <div style={{
          background: proto.black,
          color: proto.yellow,
          borderRadius: 12,
          padding: '12px 10px',
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 900,
          lineHeight: 1.5,
          marginBottom: 14,
        }}>
          {mainPlayer}は「自分の答え」<br />
          {guessName}は「{mainPlayer}の答え」を予想
        </div>

        <div style={{ display: 'grid', gap: 9 }}>
          {players.map((player, index) => {
            const isMain = index === 0;
            return (
              <React.Fragment key={player}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '46px 1fr',
                  gap: 12,
                  alignItems: 'center',
                  minHeight: 68,
                  padding: '10px 12px',
                  background: isMain ? proto.yellow : proto.cyan,
                  border: `2.5px solid ${proto.black}`,
                  borderRadius: 14,
                  boxShadow: '3px 3px 0 #000',
                }}>
                  <div style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: proto.white,
                    border: `2px solid ${proto.black}`,
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: proto.caption,
                    fontSize: 14,
                    fontWeight: 900,
                  }}>
                    {index + 1}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 20,
                      fontWeight: 900,
                      lineHeight: 1.25,
                    }}>{player}</div>
                    <div style={{
                      marginTop: 3,
                      fontSize: 12,
                      fontWeight: 900,
                      lineHeight: 1.45,
                    }}>
                      {isMain ? '自分が思った答えを選ぶ' : '本人が選んだ答えを予想する'}
                    </div>
                  </div>
                </div>
                {index < players.length - 1 && (
                  <div style={{
                    textAlign: 'center',
                    fontSize: 20,
                    fontWeight: 900,
                    color: proto.black,
                    lineHeight: 1,
                  }}>↓</div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div style={{
          marginTop: 16,
          padding: '12px 14px',
          background: '#FFF7D8',
          border: `2px dashed ${proto.black}`,
          borderRadius: 12,
          fontSize: 12,
          lineHeight: 1.65,
          fontWeight: 900,
          textAlign: 'center',
        }}>
          5問ぜんぶ終わったら、全員分の答え合わせをまとめて見ます。
        </div>
      </div>

      <FixedActionBar
        primaryLabel="この順番で始める ▶"
        onPrimary={onStart}
        secondaryLabel="人数を選び直す"
        onSecondary={onBack}
        largePrimary
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────
// FRIEND MODE
// ─────────────────────────────────────────────────────
const FRIEND_PLAYERS = ['本人', '友達A', '友達B', '友達C'];
function getFriendPlayers(playerCount, names) {
  const source = normalizePlayerNames({ friend: names }).friend;
  return source.slice(0, normalizeFriendPlayerCount(playerCount));
}
function getFriendPlayersLabel(playerCount, names) {
  return getFriendPlayers(playerCount, names).join(' + ');
}

function FriendIntroScreen({ onStart, onBack, playerNames, onPlayerNameChange }) {
  const friendPlayers = normalizePlayerNames({ friend: playerNames }).friend;
  const mainPlayer = friendPlayers[0];
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
        </div>
      </div>

      <div style={{ padding: '24px 22px' }}>
        <IntroSeoCard
          title="友達同士で盛り上がる無料の友情診断"
          text="友達の友情判定は、本人が選んだ答えを友達が予想して、どれだけ分かっているかをチェックするゲームです。5問中何問正解したかで、友達のことをどれだけ理解しているか診断します。"
          details={[
            'スマホを順番に渡すだけなので、大学生の集まり、旅行、飲み会、休み時間にも遊びやすい形式です。',
          ]}
          tags={['友情判定', '友達ゲーム', '友情診断', '2〜4人プレイ']}
        />
        <NameEditorPanel
          title="名前を変える（任意）"
          names={playerNames}
          defaults={DEFAULT_PLAYER_NAMES.friend}
          onChange={onPlayerNameChange}
        />
        <StepCard n="1" text="人数を選ぶ" />
        <StepCard n="2" text={`${mainPlayer}は、友達に見せずに自分が思った答えを選ぶ`} />
        <StepCard n="3" text={`友達は、${mainPlayer}が選んだ答えを予想して同じ色を選ぶ`} />
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
                  {getFriendPlayersLabel(count, playerNames)}
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

function FriendPlayScreen({ card, qIdx, total, playerCount, playerNames, onAnswer, onBack }) {
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

  const friendPlayers = getFriendPlayers(playerCount, playerNames);
  const currentPlayer = friendPlayers[turn] || friendPlayers[1] || '友達A';
  const mainPlayer = friendPlayers[0] || '本人';
  const playerLabel = getFriendPlayersLabel(playerCount, playerNames);

  const handlePick = (i) => {
    if (phase === 'answer') {
      setTargetPick(i);
      const nextPlayer = getFriendPlayers(playerCount, playerNames)[1] || '友達A';
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
      setHandoffMessage(qIdx + 1 >= total ? `${mainPlayer}に渡して結果を見てね` : `${mainPlayer}に渡して次の問題へ`);
      setTimeout(() => onAnswer({
        target: targetPick,
        guesses: next,
        matches: next.map(g => g === targetPick),
      }), FINAL_HANDOFF_DELAY_MS);
    } else {
      const nextPlayer = getFriendPlayers(playerCount, playerNames)[turn + 1] || `友達${turn + 1}`;
      setHandoffMessage(`${nextPlayer}に渡してね`);
      setTimeout(() => {
        setHandoffMessage('');
        setTurn(turn + 1);
      }, HANDOFF_DELAY_MS);
    }
  };

  if (!card) return null;

  return (
    <div style={{
      minHeight: '100dvh', background: proto.pink, color: proto.white,
      position: 'relative', overflowX: 'hidden',
      paddingBottom: 'calc(118px + env(safe-area-inset-bottom))',
    }}>
      <Decor />
      <div style={{ padding: '24px 18px 0', position: 'relative', zIndex: 1 }}>
        <BackBtn onClick={onBack} top={14} dark label="友情版の遊び方に戻る" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <div style={{
            fontFamily: proto.caption, fontSize: 10,
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

      <div style={{ padding: '4px 18px 2px', textAlign: 'center' }}>
        <QuestionProgress qIdx={qIdx} total={total} label="FRIEND Q" />
      </div>
      <div style={{ padding: '2px 18px 4px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block',
          minWidth: 220,
          maxWidth: '100%',
          padding: '6px 14px 7px',
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
          <div style={{ marginTop: 1, fontSize: 14 }}>
            {phase === 'answer' ? `${mainPlayer}が本音で選ぶターン` : `${currentPlayer}が${mainPlayer}の答えを予想`}
          </div>
          <div style={{ marginTop: 2, fontSize: 9, lineHeight: 1.35 }}>
            {phase === 'answer' ? `友達には見せずに、${mainPlayer}が思ったものを選んでね` : `${mainPlayer}がさっき選んだものを当ててね`}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 22px 2px' }}>
        <FriendQuestionCard card={card} />
      </div>

      <div style={{ padding: '0 18px 14px' }}>
        {phase === 'answer' && (
          <ColorPicker
            selected={targetPick}
            onPick={handlePick}
            highlight={proto.yellow}
            mode="answer"
            turnHint={handoffMessage || `今は${mainPlayer}の番`}
            instruction={`${mainPlayer}だけが見て、自分が思ったものを選んでね`}
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
              {mainPlayer}の答えは受付完了。<br/>
              <span style={{ fontSize: 9, color: proto.yellow }}>
                {currentPlayer}は「{mainPlayer}が選んだもの」を予想してね
              </span>
            </div>
            <ColorPicker
              selected={guesses[turn - 1]}
              onPick={handlePick}
              highlight={proto.cyan}
              mode="guess"
              turnHint={handoffMessage || `今は${currentPlayer}の番`}
              instruction={`${currentPlayer}のターン ── ${mainPlayer}が選んだ色を予想`}
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
      width: 'min(100%, clamp(218px, 34dvh, 300px))',
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

function FriendReveal({ card, targetPick, guesses, playerCount, players = FRIEND_PLAYERS, onNext }) {
  const hitCount = guesses.filter(g => g === targetPick).length;
  const mainPlayer = players[0] || '本人';
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
          <span>{mainPlayer}の答え：{card.choices[targetPick]}</span>
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
              <span style={{ fontSize: 12, fontWeight: 900 }}>{players[i + 1] || FRIEND_PLAYERS[i + 1]}</span>
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

const GROUP_RESULT_RANKS = {
  friend: [
    { score: 5, name: 'もはや本人より本人のこと知ってる友', note: '友情こわいくらい同期済み' },
    { score: 4, name: '親友の取扱説明書ほぼ読破', note: 'あと1問で本人公認マスター' },
    { score: 3, name: '友情データいい感じに同期中', note: '普通に分かっててちょっと照れる' },
    { score: 2, name: '友達アップデート待ち', note: 'まだ知らない一面、残ってます' },
    { score: 1, name: 'まだプロフィール1行目', note: 'ここから深掘りしたら化ける' },
    { score: 0, name: '初対面より初対面', note: '逆に今日から仲良くなれる' },
  ],
  family: [
    { score: 5, name: '家族なのにテレパシー開通済み', note: '説明なしで通じるレベル' },
    { score: 4, name: '実家のWi-Fiくらい繋がってる', note: 'たまに切れるけどかなり強い' },
    { score: 3, name: 'ほどよく分かる、ほどよく謎', note: '家族ってだいたいこのへん' },
    { score: 2, name: '家族データ更新通知きてます', note: '知らない一面、まだ未読です' },
    { score: 1, name: '同じ家にいたのに初耳多め', note: '今日の答え合わせが本編' },
    { score: 0, name: '親戚の集まりで自己紹介から', note: 'まずは近況報告から始めよう' },
  ],
};

const GROUP_RANK_COLORS = {
  5: { bg: '#FFE26B', chip: '#FF4F8B', text: proto.black },
  4: { bg: '#DDF7FF', chip: '#5BD4E8', text: proto.black },
  3: { bg: '#E8F7D9', chip: '#79BD5F', text: proto.black },
  2: { bg: '#FFF0C6', chip: '#F59A32', text: proto.black },
  1: { bg: '#FFE4EE', chip: '#EC4F88', text: proto.black },
  0: { bg: '#EFE9FF', chip: '#8E6BE8', text: proto.black },
};

function getGroupRankColors(score) {
  return GROUP_RANK_COLORS[score] || GROUP_RANK_COLORS[0];
}

function getGroupResultRank(kind, score) {
  const ranks = GROUP_RESULT_RANKS[kind] || GROUP_RESULT_RANKS.friend;
  return ranks.find((rank) => rank.score === score) || ranks[ranks.length - 1];
}

function getGroupScoreHighlight(scores, total, kind = 'friend') {
  if (!scores.length) return '';
  const bestScore = Math.max(...scores.map((item) => item.score));
  const lowScore = Math.min(...scores.map((item) => item.score));
  const bestNames = scores.filter((item) => item.score === bestScore).map((item) => item.name).join('・');
  const lowNames = scores.filter((item) => item.score === lowScore).map((item) => item.name).join('・');
  if (bestScore === total) {
    return `${bestNames}、${total}問正解。これはもう本人公認レベル。`;
  }
  if (bestScore === lowScore) {
    return kind === 'family'
      ? `全員${bestScore}問正解。家族の謎、まだまだ残ってます。`
      : `全員${bestScore}問正解。友情は横並び、答え合わせで深まるやつ。`;
  }
  if (lowScore === 0) {
    return `${bestNames}がトップ。${lowNames}は今日からアップデート開始。`;
  }
  return `${bestNames}がトップ。${lowNames}は次回の伸びしろ担当。`;
}

function PlayerScoreBoard({ answers, players, label, kind = 'friend' }) {
  const total = Math.max(1, answers.length);
  const scores = getPlayerScores(answers, players);
  const ranks = GROUP_RESULT_RANKS[kind] || GROUP_RESULT_RANKS.friend;
  const highlight = getGroupScoreHighlight(scores, total, kind);

  return (
    <div style={{
      margin: '14px 16px 0',
      padding: '12px 10px 14px',
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
        padding: '11px 10px',
        background: '#FFF8F1',
        border: `2px solid ${proto.white}`,
        borderRadius: 12,
        color: proto.text,
        textAlign: 'left',
      }}>
        <div style={{
          display: 'inline-block',
          padding: '3px 9px',
          marginBottom: 7,
          borderRadius: 999,
          background: proto.yellow,
          border: `1.5px solid ${proto.black}`,
          fontSize: 10,
          fontWeight: 900,
        }}>ランク表</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {ranks.map((rank) => {
            const colors = getGroupRankColors(rank.score);
            return (
            <div key={rank.score} style={{
              display: 'grid',
              gridTemplateColumns: '74px minmax(0, 1fr)',
              alignItems: 'baseline',
              gap: 8,
              padding: '7px 8px',
              background: colors.bg,
              border: `1.5px solid ${proto.black}`,
              borderRadius: 10,
              boxShadow: '2px 2px 0 rgba(0,0,0,0.18)',
              fontSize: 11,
              lineHeight: 1.35,
              fontWeight: 900,
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 28,
                padding: '0 6px',
                borderRadius: 999,
                background: colors.chip,
                color: proto.white,
                border: `1.5px solid ${proto.black}`,
                boxShadow: '1.5px 1.5px 0 #000',
                fontSize: 10,
                textShadow: '1px 1px 0 rgba(0,0,0,0.28)',
                whiteSpace: 'nowrap',
              }}>{rank.score}問正解</span>
              <span>{rank.name}<span style={{ display: 'block', color: proto.textSoft, fontSize: 10, marginTop: 1 }}>{rank.note}</span></span>
            </div>
            );
          })}
        </div>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.max(1, scores.length)}, minmax(0, 1fr))`,
        gap: 8,
        marginTop: 10,
      }}>
        {highlight && (
          <div style={{
            gridColumn: '1 / -1',
            padding: '9px 10px',
            background: proto.yellow,
            color: proto.black,
            border: `2px solid ${proto.white}`,
            borderRadius: 10,
            boxShadow: '2px 2px 0 #000',
            fontSize: 12,
            lineHeight: 1.45,
            fontWeight: 900,
            textAlign: 'center',
          }}>
            今回の見どころ: {highlight}
          </div>
        )}
        {scores.map((item) => (
          <div key={item.name} style={{
            minWidth: 0,
            display: 'grid',
            justifyItems: 'center',
            alignItems: 'center',
            gap: 4,
            padding: '10px 7px',
            background: item.score === total ? proto.yellow : proto.pinkSoft,
            border: `2px solid ${proto.white}`,
            borderRadius: 10,
            color: proto.text,
            fontWeight: 900,
          }}>
            <div style={{
              fontSize: 12,
              lineHeight: 1.25,
              overflowWrap: 'anywhere',
              textAlign: 'center',
            }}>{item.name}</div>
            <div style={{
              fontSize: 28,
              lineHeight: 1,
              fontFamily: proto.display,
              color: item.score === total ? proto.black : proto.pinkDeep,
            }}>{item.score}/{total}</div>
            <div style={{
              fontSize: 10,
              lineHeight: 1,
              color: proto.textSoft,
            }}>問正解</div>
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

function getPlayerScoreSummary(answers, players, kind = 'friend') {
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
  const headline = isFamily ? '家族それぞれの結果一覧' : '友達それぞれの結果一覧';
  const targetLabel = `${players[0] || '本人'}の理解度`;
  const ranks = GROUP_RESULT_RANKS[kind] || GROUP_RESULT_RANKS.friend;
  const highlight = getGroupScoreHighlight(scores, total, kind);
  const shareCta = isFamily ? 'この結果、家族に伝えよう' : 'この結果、友達に伝えよう';
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = proto.pink;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = proto.black;
  roundRect(ctx, 70, 80, 940, 1210, 38);
  ctx.fill();

  ctx.fillStyle = proto.white;
  roundRect(ctx, 88, 98, 904, 1172, 30);
  ctx.fill();

  ctx.fillStyle = proto.black;
  roundRect(ctx, 88, 98, 904, 116, 30);
  ctx.fill();

  ctx.fillStyle = proto.white;
  ctx.font = '700 32px "DotGothic16", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(isFamily ? 'FAMILY BOND RESULT' : 'FRIEND CHECK RESULT', 132, 168);

  ctx.fillStyle = proto.cyan;
  roundRect(ctx, 730, 126, 222, 52, 26);
  ctx.fill();
  ctx.fillStyle = proto.black;
  ctx.textAlign = 'center';
  drawFittedCanvasText(ctx, targetLabel, 841, 160, 186, {
    fontFamily: '"Zen Maru Gothic", sans-serif',
    fontWeight: 900,
    fontSize: 24,
    minFontSize: 17,
    align: 'center',
  });

  ctx.fillStyle = proto.pink;
  ctx.font = '900 64px "RocknRoll One", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 470, 310);

  ctx.fillStyle = proto.cyan;
  ctx.globalAlpha = 0.16;
  ctx.beginPath();
  ctx.arc(826, 294, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  drawCanvasGirl(ctx, 748, 196, 150, 183);

  ctx.fillStyle = proto.black;
  roundRect(ctx, 140, 350, 800, 106, 22);
  ctx.fill();
  ctx.fillStyle = proto.yellow;
  ctx.font = '900 32px "Zen Maru Gothic", sans-serif';
  ctx.fillText(headline, 540, 392);
  ctx.fillStyle = proto.white;
  ctx.font = '900 21px "Zen Maru Gothic", sans-serif';
  splitCanvasText(highlight, 26).slice(0, 2).forEach((line, index) => {
    ctx.fillText(line, 540, 424 + index * 24);
  });

  const rankTop = 462;
  ctx.fillStyle = proto.white;
  roundRect(ctx, 140, rankTop, 800, 462, 26);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = proto.black;
  roundRect(ctx, 140, rankTop, 800, 462, 26);
  ctx.stroke();
  ctx.fillStyle = proto.black;
  ctx.font = '900 30px "Zen Maru Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ランク表', 540, rankTop + 44);
  ranks.forEach((rank, index) => {
    const rowTop = rankTop + 68 + index * 62;
    const colors = getGroupRankColors(rank.score);
    ctx.fillStyle = colors.bg;
    roundRect(ctx, 176, rowTop, 728, 56, 14);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = proto.black;
    roundRect(ctx, 176, rowTop, 728, 56, 14);
    ctx.stroke();

    ctx.fillStyle = colors.chip;
    roundRect(ctx, 198, rowTop + 13, 128, 30, 15);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = proto.black;
    roundRect(ctx, 198, rowTop + 13, 128, 30, 15);
    ctx.stroke();

    ctx.fillStyle = proto.white;
    ctx.font = '900 18px "Zen Maru Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${rank.score}問正解`, 262, rowTop + 34);

    ctx.fillStyle = proto.black;
    drawFittedCanvasText(ctx, rank.name, 350, rowTop + 24, 520, {
      weight: 900,
      size: 19,
      minSize: 14,
    });
    ctx.fillStyle = proto.textSoft;
    drawFittedCanvasText(ctx, rank.note, 350, rowTop + 46, 520, {
      weight: 800,
      size: 13,
      minSize: 10,
    });
  });

  ctx.fillStyle = proto.black;
  roundRect(ctx, 140, 942, 800, 56, 20);
  ctx.fill();
  ctx.fillStyle = proto.yellow;
  ctx.font = '900 28px "Zen Maru Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 540, 978);

  const cardTop = 1014;
  const cardGap = 18;
  const cardHeight = 112;
  const cardCount = Math.max(1, scores.length);
  const cardWidth = (740 - cardGap * (cardCount - 1)) / cardCount;
  scores.forEach((item, index) => {
    const x = 170 + index * (cardWidth + cardGap);
    const y = cardTop;
    ctx.fillStyle = item.score === total ? proto.yellow : proto.pinkSoft;
    roundRect(ctx, x, y, cardWidth, cardHeight, 22);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = proto.black;
    roundRect(ctx, x, y, cardWidth, cardHeight, 22);
    ctx.stroke();

    ctx.fillStyle = proto.black;
    drawFittedCanvasText(ctx, item.name, x + cardWidth / 2, y + 29, cardWidth - 28, {
      weight: 900,
      size: 26,
      minSize: 16,
      align: 'center',
    });

    ctx.fillStyle = proto.pinkDeep;
    ctx.font = '900 50px "RocknRoll One", sans-serif';
    ctx.fillText(`${item.score}/${total}`, x + cardWidth / 2, y + 82);

    ctx.fillStyle = proto.textSoft;
    ctx.font = '900 18px "Zen Maru Gothic", sans-serif';
    ctx.fillText('問正解', x + cardWidth / 2, y + 104);
  });

  ctx.fillStyle = proto.yellow;
  roundRect(ctx, 152, 1132, 776, 116, 22);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = proto.black;
  roundRect(ctx, 152, 1132, 776, 116, 22);
  ctx.stroke();
  ctx.fillStyle = proto.black;
  ctx.textAlign = 'center';
  ctx.font = '900 27px "Zen Maru Gothic", sans-serif';
  ctx.fillText(shareCta, 452, 1167);
  ctx.fillStyle = proto.pinkDeep;
  ctx.font = '900 20px "Zen Maru Gothic", sans-serif';
  ctx.fillText('あなたなら何問当てられる？', 452, 1197);
  ctx.fillStyle = proto.black;
  ctx.font = '900 20px "DotGothic16", monospace';
  ctx.fillText('streetboardgame.com  /  #わたちゃん', 452, 1226);
  drawCanvasQr(ctx, 812, 1153, 74);

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

function FriendResultScreen({ answers, cards, playerCount, playerNames, onReplay, onHome, onAbout }) {
  const totalQuestions = Math.max(1, answers.length || 5);
  const friendPlayers = useMemo(() => getFriendPlayers(playerCount, playerNames), [playerCount, playerNames]);
  const targetLabel = `${friendPlayers[0]}の理解度`;
  const scoreSummary = getPlayerScoreSummary(answers, friendPlayers, 'friend');
  const [copied, setCopied] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const shareSheetShownRef = useRef(false);
  const canvasCharacterReady = useCanvasCharacterReady();
  const canvasQrReady = useCanvasQrReady();
  const preparedResultImageSrc = useMemo(
    () => createGroupResultImageSrc('friend', answers, friendPlayers),
    [answers, friendPlayers, canvasCharacterReady, canvasQrReady]
  );
  const groupScores = useMemo(() => getPlayerScores(answers, friendPlayers), [answers, friendPlayers]);
  const groupHighlight = getGroupScoreHighlight(groupScores, totalQuestions, 'friend');
  const reviewSections = useMemo(
    () => getGroupReviewSections(answers, cards, friendPlayers, 'friend'),
    [answers, cards, friendPlayers]
  );

  const showShareSheetAfterReview = () => {
    if (shareSheetShownRef.current) return;
    shareSheetShownRef.current = true;
    setShowShareSheet(true);
  };

  const shareUrl = `${location.origin}/friends`;
  const shareText = `わたちゃんの友情判定をやってみた！\n今回は「${targetLabel}」を判定。\n${scoreSummary}。\n${groupHighlight}\n\n友達とやると答え合わせが盛り上がる。\nみんなは何問当たる？👇\n#わたちゃん #友情判定`;

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
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      '_blank',
      'noopener,noreferrer,width=600,height=500'
    );
  };

  const openLine = () => {
    openLineShare(`${shareText}\n${shareUrl}`);
  };

  const handleSaveImage = async () => {
    setImageBusy(true);
    try {
      await savePreparedImage({
        src: preparedResultImageSrc,
        filename: `watachan-friend-result-${totalQuestions}.png`,
        title: 'わたちゃん 友達の友情判定ゲーム',
      });
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
      await sharePreparedImage({
        src: preparedResultImageSrc,
        filename: `watachan-friend-result-${totalQuestions}.png`,
        title: 'わたちゃん 友達の友情判定ゲーム',
        text: shareText,
        url: shareUrl,
      });
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
            letterSpacing: 0,
            whiteSpace: 'nowrap',
          }}>{targetLabel}</span>
        </div>
        <PlayerScoreBoard
          answers={answers}
          players={friendPlayers}
          kind="friend"
          label="友達の友情判定"
        />
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
        <GroupResultReviewBox sections={reviewSections} title="AI総評" />
      </div>

      <div style={{ padding: '22px 18px 0', position: 'relative', zIndex: 1 }}>
        <ResultImageActions
          busy={imageBusy || !canvasQrReady}
          onShare={handleShareImage}
          onX={openX}
          onLine={openLine}
          onVisible={showShareSheetAfterReview}
          shareTitle="この結果、友達に伝えよう"
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
          <FooterLink href="/about" onClick={onAbout}>About / お問い合わせ</FooterLink>
        </div>
      </div>
      <ShareBottomSheet
        open={showShareSheet}
        busy={imageBusy || !canvasQrReady}
        onClose={() => setShowShareSheet(false)}
        onX={openX}
        onLine={openLine}
        onShare={handleShareImage}
        shareContext="XやLINEはURLつきで送れます。Instagramはプロフィールリンクへ"
        title="この結果、友達に送る？"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────
// FAMILY MODE
// ─────────────────────────────────────────────────────
const FAMILY_PLAYERS = ['本人', '家族A', '家族B', '家族C'];
function getFamilyPlayers(playerCount, names) {
  const source = normalizePlayerNames({ family: names }).family;
  return source.slice(0, normalizeFriendPlayerCount(playerCount));
}
function getFamilyPlayersLabel(playerCount, names) {
  return getFamilyPlayers(playerCount, names).join(' + ');
}

function FamilyIntroScreen({ onStart, onBack, playerNames, onPlayerNameChange }) {
  const familyPlayers = normalizePlayerNames({ family: playerNames }).family;
  const mainPlayer = familyPlayers[0];
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
        </div>
      </div>

      <div style={{ padding: '24px 22px' }}>
        <IntroSeoCard
          title="家族で遊べる無料の絆チェック"
          text="家族の絆判定は、本人が選んだ答えを家族が予想して、家族の理解度を楽しくチェックするゲームです。5問中何問正解したかで、家族のことをどれだけ理解しているか診断します。"
          details={[
            '親子、兄弟姉妹、親戚の集まりでも、普段は聞かない好みや考え方を楽しく知れる診断ゲームとして遊べます。',
          ]}
          tags={['家族の絆判定', '家族ゲーム', '親子ゲーム', '2〜4人プレイ']}
        />
        <NameEditorPanel
          title="名前を変える（任意）"
          names={playerNames}
          defaults={DEFAULT_PLAYER_NAMES.family}
          onChange={onPlayerNameChange}
        />
        <StepCard n="1" text="人数を選ぶ" />
        <StepCard n="2" text={`${mainPlayer}は、家族に見せずに自分が思った答えを選ぶ`} />
        <StepCard n="3" text={`家族は、${mainPlayer}が選んだ答えを予想して同じ色を選ぶ`} />
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
                  {getFamilyPlayersLabel(count, playerNames)}
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

function FamilyPlayScreen({ card, qIdx, total, playerCount, playerNames, onAnswer, onBack }) {
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

  const familyPlayers = getFamilyPlayers(playerCount, playerNames);
  const currentPlayer = familyPlayers[turn] || familyPlayers[1] || '家族A';
  const mainPlayer = familyPlayers[0] || '本人';
  const playerLabel = getFamilyPlayersLabel(playerCount, playerNames);

  const handlePick = (i) => {
    if (phase === 'answer') {
      setTargetPick(i);
      const nextPlayer = getFamilyPlayers(playerCount, playerNames)[1] || '家族A';
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
      setHandoffMessage(qIdx + 1 >= total ? `${mainPlayer}に渡して結果を見てね` : `${mainPlayer}に渡して次の問題へ`);
      setTimeout(() => onAnswer({
        target: targetPick,
        guesses: next,
        matches: next.map(g => g === targetPick),
      }), FINAL_HANDOFF_DELAY_MS);
    } else {
      const nextPlayer = getFamilyPlayers(playerCount, playerNames)[turn + 1] || `家族${turn + 1}`;
      setHandoffMessage(`${nextPlayer}に渡してね`);
      setTimeout(() => {
        setHandoffMessage('');
        setTurn(turn + 1);
      }, HANDOFF_DELAY_MS);
    }
  };

  if (!card) return null;

  return (
    <div style={{
      minHeight: '100dvh', background: proto.pink, color: proto.white,
      position: 'relative', overflowX: 'hidden',
      paddingBottom: 'calc(118px + env(safe-area-inset-bottom))',
    }}>
      <Decor />
      <div style={{ padding: '24px 18px 0', position: 'relative', zIndex: 1 }}>
        <BackBtn onClick={onBack} top={14} dark label="家族版の遊び方に戻る" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <div style={{
            fontFamily: proto.caption, fontSize: 10,
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

      <div style={{ padding: '4px 18px 2px', textAlign: 'center' }}>
        <QuestionProgress qIdx={qIdx} total={total} label="FAMILY Q" />
      </div>
      <div style={{ padding: '2px 18px 4px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block',
          minWidth: 220,
          maxWidth: '100%',
          padding: '6px 14px 7px',
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
          <div style={{ marginTop: 1, fontSize: 14 }}>
            {phase === 'answer' ? `${mainPlayer}が本音で選ぶターン` : `${currentPlayer}が${mainPlayer}の答えを予想`}
          </div>
          <div style={{ marginTop: 2, fontSize: 9, lineHeight: 1.35 }}>
            {phase === 'answer' ? `家族には見せずに、${mainPlayer}が思ったものを選んでね` : `${mainPlayer}がさっき選んだものを当ててね`}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 22px 2px' }}>
        <FriendQuestionCard card={card} />
      </div>

      <div style={{ padding: '0 18px 14px' }}>
        {phase === 'answer' && (
          <ColorPicker
            selected={targetPick}
            onPick={handlePick}
            highlight={proto.yellow}
            mode="answer"
            turnHint={handoffMessage || `今は${mainPlayer}の番`}
            instruction={`${mainPlayer}だけが見て、自分が思ったものを選んでね`}
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
              {mainPlayer}の答えは受付完了！<br/>
              <span style={{ fontSize: 9, color: proto.yellow }}>
                {currentPlayer}は「{mainPlayer}が選んだもの」を予想してね
              </span>
            </div>
            <ColorPicker
              selected={guesses[turn - 1]}
              onPick={handlePick}
              highlight={proto.cyan}
              mode="guess"
              turnHint={handoffMessage || `今は${currentPlayer}の番`}
              instruction={`${currentPlayer}のターン ── ${mainPlayer}が選んだ色を予想`}
            />
          </>
        )}
      </div>
      {handoffMessage && <HandoffOverlay message={handoffMessage} />}
    </div>
  );
}

function FamilyResultScreen({ answers, cards, playerCount, playerNames, onReplay, onHome, onAbout }) {
  const totalQuestions = Math.max(1, answers.length || 5);
  const familyPlayers = useMemo(() => getFamilyPlayers(playerCount, playerNames), [playerCount, playerNames]);
  const targetLabel = `${familyPlayers[0]}の理解度`;
  const scoreSummary = getPlayerScoreSummary(answers, familyPlayers, 'family');
  const [copied, setCopied] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const shareSheetShownRef = useRef(false);
  const canvasCharacterReady = useCanvasCharacterReady();
  const canvasQrReady = useCanvasQrReady();
  const preparedResultImageSrc = useMemo(
    () => createGroupResultImageSrc('family', answers, familyPlayers),
    [answers, familyPlayers, canvasCharacterReady, canvasQrReady]
  );
  const groupScores = useMemo(() => getPlayerScores(answers, familyPlayers), [answers, familyPlayers]);
  const groupHighlight = getGroupScoreHighlight(groupScores, totalQuestions, 'family');
  const reviewSections = useMemo(
    () => getGroupReviewSections(answers, cards, familyPlayers, 'family'),
    [answers, cards, familyPlayers]
  );

  const showShareSheetAfterReview = () => {
    if (shareSheetShownRef.current) return;
    shareSheetShownRef.current = true;
    setShowShareSheet(true);
  };

  const shareUrl = `${location.origin}/family`;
  const shareText = `わたちゃんの家族の絆判定をやってみた！\n今回は「${targetLabel}」を判定。\n${scoreSummary}。\n${groupHighlight}\n\n家族でやると意外とズレる。\nみんなは何問当たる？👇\n#わたちゃん #家族の絆判定`;

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
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      '_blank',
      'noopener,noreferrer,width=600,height=500'
    );
  };

  const openLine = () => {
    openLineShare(`${shareText}\n${shareUrl}`);
  };

  const handleSaveImage = async () => {
    setImageBusy(true);
    try {
      await savePreparedImage({
        src: preparedResultImageSrc,
        filename: `watachan-family-result-${totalQuestions}.png`,
        title: 'わたちゃん 家族の絆判定ゲーム',
      });
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
      await sharePreparedImage({
        src: preparedResultImageSrc,
        filename: `watachan-family-result-${totalQuestions}.png`,
        title: 'わたちゃん 家族の絆判定ゲーム',
        text: shareText,
        url: shareUrl,
      });
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
            letterSpacing: 0,
            whiteSpace: 'nowrap',
          }}>{targetLabel}</span>
        </div>
        <PlayerScoreBoard
          answers={answers}
          players={familyPlayers}
          kind="family"
          label="家族の絆判定"
        />
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
        <GroupResultReviewBox sections={reviewSections} title="AI総評" />
      </div>

      <div style={{ padding: '22px 18px 0', position: 'relative', zIndex: 1 }}>
        <ResultImageActions
          busy={imageBusy || !canvasQrReady}
          onShare={handleShareImage}
          onX={openX}
          onLine={openLine}
          onVisible={showShareSheetAfterReview}
          shareTitle="この結果、家族に伝えよう"
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
          <FooterLink href="/about" onClick={onAbout}>About / お問い合わせ</FooterLink>
        </div>
      </div>
      <ShareBottomSheet
        open={showShareSheet}
        busy={imageBusy || !canvasQrReady}
        onClose={() => setShowShareSheet(false)}
        onX={openX}
        onLine={openLine}
        onShare={handleShareImage}
        shareContext="XやLINEはURLつきで送れます。Instagramはプロフィールリンクへ"
        title="この結果、家族に送る？"
      />
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
            ストリートボードゲームは、「彼氏の愛情判定ゲーム」をメインにしたwebで遊べるゲームサイトです。
            彼女のことを、彼氏はどれだけ分かっているか、理解度チェックで彼氏の愛情を判定します。
            シリーズの作品として、友達の友情判定、家族の絆判定も遊べます。
            デート中・飲み会・旅行・おうち時間に、スマホ1台、無料、会員登録なしでお楽しみください。
          </div>
        </Card>

        <SectionTitle style={{ marginTop: 22 }}>♡ シリーズ展開</SectionTitle>
        <Card>
          <SeriesRow emoji="💕" title="彼氏の愛情判定" sub="メインゲーム" active onClick={onLove} />
          <SeriesRow emoji="👯" title="友達の友情判定" sub="シリーズ" active onClick={onFriend} />
          <SeriesRow emoji="👨‍👩‍👧" title="家族の絆判定" sub="シリーズ" active onClick={onFamily} last />
        </Card>

        <div id="contact-section" style={{ scrollMarginTop: 20 }}>
          <SectionTitle style={{ marginTop: 22 }}>♡ お問い合わせ</SectionTitle>
          <Card>
            <ContactForm />
          </Card>
        </div>

        <BottomHomeButton onClick={onBack} />

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
        <BottomHomeButton onClick={onBack} />
      </div>
    </div>
  );
}

function BottomHomeButton({ onClick }) {
  return (
    <div style={{ paddingTop: 22 }}>
      <button
        type="button"
        onClick={onClick}
        aria-label="トップページに戻る"
        style={{
          ...secondaryBtn(),
          minHeight: 60,
          fontSize: 15,
          boxShadow: '4px 4px 0 #000',
        }}
      >
        トップページに戻る
      </button>
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
      minWidth: 46, minHeight: 44,
      maxWidth: 'calc(100% - 36px)',
      padding: '0 13px 0 10px',
      borderRadius: 999,
      background: dark ? proto.white : 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(10px)',
      border: `2px solid ${proto.black}`,
      color: proto.black,
      fontSize: 12, cursor: 'pointer', zIndex: 50,
      boxShadow: '2px 2px 0 #000',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      gap: 7,
      fontWeight: 900,
      fontFamily: proto.body,
      lineHeight: 1,
      whiteSpace: 'nowrap',
      touchAction: 'manipulation',
    }}>
      <span style={{ fontSize: 18, lineHeight: 1, transform: 'translateY(-1px)' }}>←</span>
      <span>{label}</span>
    </button>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
