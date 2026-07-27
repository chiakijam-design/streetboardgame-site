import { createReviewContext, createReviewTemplateTools } from '../core/review.js';

export const CHALLENGE_RESULT_TIERS = Object.freeze([
  {
    score: 0,
    title: '10個の新発見',
    tag: 'START',
    tagBg: '#191919',
    tagColor: '#ffffff',
    message: 'まだ知らない話が10個見つかった。\n答え合わせから、会話を始めよう。',
  },
  {
    score: 1,
    title: 'はじめの1問ぴったり',
    tag: '1 HIT',
    tagBg: '#f4a261',
    tagColor: '#ffffff',
    message: 'はじめの1問がぴったり一致。\nここから話すほど、もっと分かっていく。',
  },
  {
    score: 2,
    title: '会話の種を2個発見',
    tag: '2 HIT',
    tagBg: '#ef8730',
    tagColor: '#ffffff',
    message: '2問の一致と、8問の新しい発見。\nここから話すほど、もっと分かっていく。',
  },
  {
    score: 3,
    title: '分かりはじめの3問',
    tag: '3 HIT',
    tagBg: '#55c9dd',
    tagColor: '#191919',
    message: '相手らしさが3問ぴったり一致。\nここから話すほど、もっと分かっていく。',
  },
  {
    score: 4,
    title: '理解度更新中',
    tag: 'UPDATE',
    tagBg: '#55c9dd',
    tagColor: '#191919',
    message: '分かるところと意外なところが半分ずつ。\nズレた答えも、次の会話のきっかけ。',
  },
  {
    score: 5,
    title: '半分ぴったり',
    tag: 'HALF',
    tagBg: '#ffe36f',
    tagColor: '#191919',
    message: '分かるところと意外なところが半分ずつ。\n5個の発見から、話がもっと広がりそう。',
  },
  {
    score: 6,
    title: '分かる方が一歩リード',
    tag: 'GOOD',
    tagBg: '#f06e9f',
    tagColor: '#ffffff',
    message: '分かるところが、意外なところより一歩リード。\n残る4問にも、会話の種が見つかった。',
  },
  {
    score: 7,
    title: 'かなり分かってる',
    tag: 'GREAT',
    tagBg: '#ec4683',
    tagColor: '#ffffff',
    message: 'かなり分かっている。でもまだ発見あり。\n残る3問は、次に話したい話題。',
  },
  {
    score: 8,
    title: '理解度かなり高め',
    tag: 'EXPERT',
    tagBg: '#ec4683',
    tagColor: '#ffffff',
    message: 'かなり分かっている。でもまだ発見あり。\n2つの意外な答えまで、楽しめる結果。',
  },
  {
    score: 9,
    title: 'あと1問にも発見',
    tag: 'あと1問',
    tagBg: '#ec4683',
    tagColor: '#ffffff',
    message: 'かなり分かっている。でもまだ発見あり。\n最後の1問が、新しい会話のきっかけ。',
  },
  {
    score: 10,
    title: '10問ぴったり理解',
    tag: 'PERFECT',
    tagBg: '#ffe36f',
    tagColor: '#191919',
    message: '10問すべて同じ答え。理解度ぴったり。\n理由まで聞けば、会話はもっと深くなる。',
  },
]);

export const CHALLENGE_RESULT_TIERS_EN = Object.freeze([
  { score: 0, title: '10 New Discoveries', tag: 'START', tagBg: '#191919', tagColor: '#ffffff', message: 'You found ten new things to talk about.\nLet the answer review start the conversation.' },
  { score: 1, title: 'First Match Found', tag: '1 HIT', tagBg: '#f4a261', tagColor: '#ffffff', message: 'Your first answer matched perfectly.\nThe more you talk, the more you will understand.' },
  { score: 2, title: 'Two Conversation Seeds', tag: '2 HITS', tagBg: '#ef8730', tagColor: '#ffffff', message: 'Two matches and eight new discoveries.\nThe more you talk, the more you will understand.' },
  { score: 3, title: 'Starting to Connect', tag: '3 HITS', tagBg: '#55c9dd', tagColor: '#191919', message: 'Three answers matched their point of view.\nThe more you talk, the more you will understand.' },
  { score: 4, title: 'Understanding Updated', tag: 'UPDATE', tagBg: '#55c9dd', tagColor: '#191919', message: 'Some answers matched and some surprised you.\nEvery difference is a new conversation starter.' },
  { score: 5, title: 'Half Perfectly Matched', tag: 'HALF', tagBg: '#ffe36f', tagColor: '#191919', message: 'Half familiar and half surprising.\nFive discoveries can lead to five new stories.' },
  { score: 6, title: 'Understanding Leads', tag: 'GOOD', tagBg: '#f06e9f', tagColor: '#ffffff', message: 'What you know now leads what surprised you.\nThe other four answers give you more to discuss.' },
  { score: 7, title: 'You Know Them Well', tag: 'GREAT', tagBg: '#ec4683', tagColor: '#ffffff', message: 'You understand them well, with discoveries left.\nThe last three answers are your next topics.' },
  { score: 8, title: 'Strong Understanding', tag: 'EXPERT', tagBg: '#ec4683', tagColor: '#ffffff', message: 'You understand them well, with discoveries left.\nEnjoy the two answers that still surprised you.' },
  { score: 9, title: 'One More Discovery', tag: '1 DISCOVERY', tagBg: '#ec4683', tagColor: '#ffffff', message: 'You understand them well, with one discovery left.\nThat last answer can start a new conversation.' },
  { score: 10, title: 'Perfectly in Sync', tag: 'PERFECT', tagBg: '#ffe36f', tagColor: '#191919', message: 'All ten answers matched. Perfect understanding.\nAsk why, and the conversation can go even deeper.' },
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

export function getChallengeResultTierEnglish(score) {
  const safeScore = Math.max(0, Math.min(10, Math.trunc(Number(score) || 0)));
  return CHALLENGE_RESULT_TIERS_EN[safeScore];
}

export function getChallengeReviewLinesEnglish(result = {}) {
  const answers = Array.isArray(result.answers) ? result.answers : [];
  const score = Math.max(0, Math.min(10, Math.trunc(Number(result.score) || 0)));
  const participant = String(result.participant?.name || 'This player').trim() || 'This player';
  const creator = String(result.creatorName || 'the creator').trim() || 'the creator';
  const tier = getChallengeResultTierEnglish(score);
  const correct = answers.filter((answer) => answer?.match === true || answer?.isCorrect === true);
  const missed = answers.filter((answer) => answer?.match !== true && answer?.isCorrect !== true);
  const hit = String(correct[0]?.card?.title || '');
  const miss = String(missed[0]?.card?.title || '');
  const nextTopic = miss || hit || 'one of the answers';
  const lines = [
    `Overall understanding: ${participant} earned “${tier.title}” on ${creator}’s 10 questions.`,
  ];
  lines.push(hit
    ? `What you knew well: You read “${hit}” correctly—your observation skills showed there.`
    : `What you knew well: The review is a fresh starting point, with plenty still to discover.`);
  lines.push(miss
    ? `A surprising mismatch: “${miss}” revealed a side you had not quite expected.`
    : `A surprising mismatch: Nothing caught you out this time—you understood every answer.`);
  lines.push(`A fun topic for next time: Ask why they chose “${nextTopic}” and keep the conversation going.`);
  return lines;
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
  const hitLine = context.score > 0
    ? `「${context.hit}」。${creator}さんらしさをよく読めています。`
    : `今回は10問すべてが新しい発見。答え合わせから10個の話題が見つかりました。`;
  const missLine = context.score < 10
    ? `「${context.miss}」。まだ知らなかった一面が見つかりました。`
    : `今回は外した問題なし。${creator}さんの好みや考え方まで、${participant}さんの読みが届いています。`;
  const nextTopic = String(
    answers.find((answer) => answer?.match !== true && answer?.isCorrect !== true)?.card?.title
      || answers[0]?.card?.title
      || context.miss,
  );

  return [
    `全体の理解度：${fillTemplate(pickVariant(REVIEW_VARIANTS.opening, 1))}`,
    `よく分かっていた分野：${hitLine}`,
    `意外にズレた分野：${missLine}`,
    `次に話すと楽しそうな話題：「${nextTopic}」。選んだ理由を聞いてみよう。`,
  ];
}
