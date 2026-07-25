import { createReviewContext, createReviewTemplateTools } from '../core/review.js';

export const CHALLENGE_RESULT_TIERS = Object.freeze([
  {
    score: 0,
    title: 'はじめましてレベル',
    tag: 'START',
    tagBg: '#191919',
    tagColor: '#ffffff',
    message: '答え合わせが、理解度アップのスタート。\n知らなかった一面を今日から覚えていこう。',
  },
  {
    score: 1,
    title: '理解度クイズ見習い中',
    tag: '見習い',
    tagBg: '#f4a261',
    tagColor: '#ffffff',
    message: '1問当てたのはえらい。\nまだ「分かってる風」ゾーン。次回に期待！',
  },
  {
    score: 2,
    title: 'まだまだ観察中',
    tag: '2 HIT',
    tagBg: '#ef8730',
    tagColor: '#ffffff',
    message: '知らない一面が多いほど、答え合わせは面白い。\n外した問題を次の会話のネタにしよう。',
  },
  {
    score: 3,
    title: 'ちょっと分かってきた',
    tag: '3 HIT',
    tagBg: '#55c9dd',
    tagColor: '#191919',
    message: '相手らしさが少しずつ見えてきた。\n意外だった答えを覚えれば一気に伸びそう。',
  },
  {
    score: 4,
    title: '理解度アップデート中',
    tag: 'UPDATE',
    tagBg: '#55c9dd',
    tagColor: '#191919',
    message: '分かっているところと意外なところが半々。\n今がいちばん伸びしろのあるタイミング。',
  },
  {
    score: 5,
    title: '半分シンクロ',
    tag: 'HALF',
    tagBg: '#ffe36f',
    tagColor: '#191919',
    message: '10問の半分で答えが一致。\nズレた5問も、話せばもっと仲良くなれるはず。',
  },
  {
    score: 6,
    title: 'なかなか読めてる',
    tag: 'GOOD',
    tagBg: '#f06e9f',
    tagColor: '#ffffff',
    message: '相手の好みをしっかり読めている。\nあと少し細かい部分まで分かれば上級者。',
  },
  {
    score: 7,
    title: 'かなり分かってる',
    tag: 'GREAT',
    tagBg: '#ec4683',
    tagColor: '#ffffff',
    message: '7問正解は観察力かなり高め。\n普段の会話や行動をちゃんと覚えている証拠。',
  },
  {
    score: 8,
    title: '理解度上級者',
    tag: 'EXPERT',
    tagBg: '#ec4683',
    tagColor: '#ffffff',
    message: 'ここまで当てられたら理解度は上級クラス。\n残り2問の意外な答えも楽しんで。',
  },
  {
    score: 9,
    title: '理解王まであと1問',
    tag: 'あと1問',
    tagBg: '#ec4683',
    tagColor: '#ffffff',
    message: 'ほぼ全部分かっている惜しすぎる結果。\n最後の1問まで覚えたら、次は満点かも。',
  },
  {
    score: 10,
    title: '公認・理解王',
    tag: 'PERFECT',
    tagBg: '#ffe36f',
    tagColor: '#191919',
    message: '全問正解はさすがに強すぎる。\n好みも迷いどころも、しっかり分かってる！',
  },
]);

const REVIEW_VARIANTS = Object.freeze({
  opening: [
    '{participant}さんの{creator}さん理解度は「{title}」。',
    '{participant}さんの読みは、{creator}さんに対して{score}/10問正解。称号は「{title}」です。',
    '今回の答え合わせで見えた、{participant}さんと{creator}さんの理解度は「{title}」。',
  ],
  hit: [
    '特に「{hit}」では、普段の会話や行動をしっかり覚えているようです。',
    '「{hit}」まわりは得意分野。{creator}さんらしさをかなり読めています。',
    '当たった問題を見ると、「{hit}」への観察力が強めです。',
  ],
  miss: [
    '一方で「{miss}」には、まだ知らなかった一面が残っています。',
    '次に話してみたいのは「{miss}」。意外な答えほど会話が盛り上がりそうです。',
    '「{miss}」のズレは、これから理解度を伸ばせるポイントです。',
  ],
  close: {
    low: [
      '今は発見が多い段階。答え合わせをきっかけに、次は一気に点数が伸びそうです。',
      '知らない部分が多いぶん、これから聞ける話題もたくさんあります。',
    ],
    mid: [
      '分かるところと意外なところがちょうど半々。ズレまで楽しめる結果です。',
      '基本はつかめています。外した答えを覚えれば、次は上級者が見えてきます。',
    ],
    high: [
      '相手らしさをかなり正確につかめています。普段からよく見ている証拠です。',
      '理解度はかなり高め。残った小さな意外性も、ふたりの面白さです。',
    ],
  },
});

export function getChallengeResultTier(score) {
  const safeScore = Math.max(0, Math.min(10, Math.trunc(Number(score) || 0)));
  return CHALLENGE_RESULT_TIERS[safeScore];
}

export function getChallengeReviewLines(result = {}) {
  const answers = Array.isArray(result.answers) ? result.answers : [];
  const cards = answers.map((answer) => answer?.card || {});
  const context = createReviewContext(answers, cards);
  const tier = getChallengeResultTier(result.score);
  const participant = String(result.participant?.name || '回答者').trim() || '回答者';
  const creator = String(result.creatorName || '出題者').trim() || '出題者';
  const values = {
    participant,
    creator,
    score: String(context.score),
    title: tier.title,
    hit: context.hit,
    miss: context.miss,
  };
  const { fillTemplate, pickVariant } = createReviewTemplateTools(values, context);
  const scoreBand = context.score >= 8 ? 'high' : context.score >= 4 ? 'mid' : 'low';
  const hitLine = context.score > 0
    ? fillTemplate(pickVariant(REVIEW_VARIANTS.hit, 2))
    : `${participant}さんにとって、${creator}さんの答えはまだ意外性多め。まずは答え合わせから理解度アップ！`;
  const missLine = context.score < 10
    ? fillTemplate(pickVariant(REVIEW_VARIANTS.miss, 3))
    : `今回は外した問題なし。${creator}さんの好みや考え方まで、${participant}さんの読みが届いています。`;

  return [
    fillTemplate(pickVariant(REVIEW_VARIANTS.opening, 1)),
    hitLine,
    missLine,
    fillTemplate(pickVariant(REVIEW_VARIANTS.close[scoreBand], 4)),
  ];
}
