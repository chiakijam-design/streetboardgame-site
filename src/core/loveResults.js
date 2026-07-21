const BLACK = '#1a1a1a';
const CYAN = '#5bd4e8';
const PINK = '#ec4f88';
const YELLOW = '#ffe26b';

export const LOVE_RESULT_TIERS = Object.freeze([
  {
    score: 0,
    title: '彼女理解は初期設定中',
    emoji: '💔',
    tag: '初期設定',
    tagBg: BLACK,
    tagColor: '#fff',
    msg: '0問正解は逆にレア。\nここから覚えることが多すぎて、デートの話題には困らない。\n今日の答え合わせから始めよ ♡',
    shareHook: '彼氏の彼女理解、まだ初期設定中でした',
  },
  {
    score: 1,
    title: '彼女データ収集中',
    emoji: '🩹',
    tag: '惜しい',
    tagBg: PINK,
    tagColor: '#fff',
    msg: 'まだ知らない一面、多め。\nでもそれって、これから知れる余白があるってこと。\n外した答えほど、ふたりのネタになる ♡',
    shareHook: '彼女データ、ただいま収集中でした',
  },
  {
    score: 2,
    title: '彼女データ更新中',
    emoji: '🌷',
    tag: 'UPDATE中',
    tagBg: CYAN,
    tagColor: BLACK,
    msg: 'まだ知らない一面、多め。\nでもそれって、これから知れる余白があるってこと。\n外した答えほど、ふたりのネタになる ♡',
    shareHook: '彼女データ、ただいま更新中でした',
  },
  {
    score: 3,
    title: 'ドヤ顔まであと一歩',
    emoji: '💕',
    tag: '惜しい',
    tagBg: PINK,
    tagColor: '#fff',
    msg: '半分以上わかってるのはちゃんと強い。\nただし満点彼氏を名乗るには、あと少し。\n外した問題、次回までに要復習 ♡',
    shareHook: 'ドヤ顔まであと一歩でした',
  },
  {
    score: 4,
    title: '彼女マスターまであと1問',
    emoji: '💗',
    tag: 'あと1問',
    tagBg: PINK,
    tagColor: '#fff',
    msg: 'これはかなり分かってる。\nあと1問で満点なのがいちばん悔しいやつ。\nもう一回やったら伝説、ある ♡',
    shareHook: '彼女マスターまであと1問でした',
  },
  {
    score: 5,
    title: '彼女公認・理解王',
    emoji: '💞',
    tag: '♡ PERFECT ♡',
    tagBg: YELLOW,
    tagColor: BLACK,
    msg: '全問正解はさすがに強すぎ。\n好みも迷いどころも、ちゃんと見てる証拠。\nこれは堂々と自慢していいやつ ♡',
    shareHook: '彼女公認の理解王でした',
  },
]);

export function getLoveResultTier(score) {
  const normalizedScore = Math.max(0, Math.min(5, Number(score) || 0));
  return LOVE_RESULT_TIERS[normalizedScore];
}
