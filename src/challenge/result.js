import { createReviewContext, createReviewTemplateTools } from '../core/review.js';

// messageLong: 4-line comment for the ja/en result card. Other locales keep
// using the translated two-line message (translations are keyed by message).
export const CHALLENGE_RESULT_TIERS = Object.freeze([
  {
    score: 0,
    title: '未知のわたし、全問発見',
    tag: 'START',
    tagBg: '#191919',
    tagColor: '#ffffff',
    message: 'まだ知らない話が10個見つかった。\n答え合わせから、会話を始めよう。',
    messageLong: 'まだ知らない話が10個見つかった。\n外れた答えは、ぜんぶ新しい発見。\n「なんでそれ？」と聞いてみよう。\n答え合わせから、会話を始めよう。',
  },
  {
    score: 1,
    title: 'ぴったりの第一歩',
    tag: '1 HIT',
    tagBg: '#f4a261',
    tagColor: '#ffffff',
    message: 'はじめの1問がぴったり一致。\nここから話すほど、もっと分かっていく。',
    messageLong: 'はじめの1問がぴったり一致。\n残る9問は、これから知れる話。\n気になった答えから聞いてみよう。\n話すほど、もっと分かっていく。',
  },
  {
    score: 2,
    title: '「そうなんだ！」が2つ',
    tag: '2 HIT',
    tagBg: '#ef8730',
    tagColor: '#ffffff',
    message: '2問の一致と、8問の新しい発見。\nここから話すほど、もっと分かっていく。',
    messageLong: '2問の一致と、8問の新しい発見。\n意外な答えほど、話のネタになる。\n外れた理由を、本人に聞いてみよう。\n話すほど、もっと分かっていく。',
  },
  {
    score: 3,
    title: 'わかってきた予感',
    tag: '3 HIT',
    tagBg: '#55c9dd',
    tagColor: '#191919',
    message: '相手らしさが3問ぴったり一致。\nここから話すほど、もっと分かっていく。',
    messageLong: '相手らしさが3問ぴったり一致。\n少しずつ、好みが見えてきた。\n外れた7問は、次の話題の宝庫。\n話すほど、もっと分かっていく。',
  },
  {
    score: 4,
    title: 'わたし理解度、更新中',
    tag: 'UPDATE',
    tagBg: '#55c9dd',
    tagColor: '#191919',
    message: '分かるところと意外なところが半分ずつ。\nズレた答えも、次の会話のきっかけ。',
    messageLong: '4問が一致。理解度は更新中。\n分かるところも、意外なところも。\nズレた答えも、次の会話のきっかけ。\n気になる1問から話してみよう。',
  },
  {
    score: 5,
    title: '半分ぴったり、半分発見',
    tag: 'HALF',
    tagBg: '#ffe36f',
    tagColor: '#191919',
    message: '分かるところと意外なところが半分ずつ。\n5個の発見から、話がもっと広がりそう。',
    messageLong: '分かるところと意外なところが半分ずつ。\n5問ぴったり、5問は新しい発見。\n5個の発見から、話がもっと広がりそう。\n次は半分以上の一致を目指そう。',
  },
  {
    score: 6,
    title: 'ぴったりが一歩リード',
    tag: 'GOOD',
    tagBg: '#f06e9f',
    tagColor: '#ffffff',
    message: '分かるところが、意外なところより一歩リード。\n残る4問にも、会話の種が見つかった。',
    messageLong: 'ぴったりが、意外より一歩リード。\n相手の好みをしっかりつかんでいる。\n残る4問にも、会話の種が見つかった。\n理由を聞けば、次はもっと当たる。',
  },
  {
    score: 7,
    title: 'かなりのわたし通',
    tag: 'GREAT',
    tagBg: '#ec4683',
    tagColor: '#ffffff',
    message: 'かなり分かっている。でもまだ発見あり。\n残る3問は、次に話したい話題。',
    messageLong: 'かなり分かっている。でも発見あり。\n7問の一致は、よく見ている証拠。\n残る3問は、次に話したい話題。\n答え合わせで、もっと近づける。',
  },
  {
    score: 8,
    title: 'わたし解像度、高画質',
    tag: 'EXPERT',
    tagBg: '#ec4683',
    tagColor: '#ffffff',
    message: 'かなり分かっている。でもまだ発見あり。\n2つの意外な答えまで、楽しめる結果。',
    messageLong: 'かなり分かっている。でも発見あり。\n8問一致は、もう上級者レベル。\n2つの意外な答えまで、楽しめる結果。\nあと少しで、満点に手が届く。',
  },
  {
    score: 9,
    title: 'あと1問も、会話の種',
    tag: 'あと1問',
    tagBg: '#ec4683',
    tagColor: '#ffffff',
    message: 'かなり分かっている。でもまだ発見あり。\n最後の1問が、新しい会話のきっかけ。',
    messageLong: 'かなり分かっている。あと1問だけ。\n9問一致は、かなりの理解度。\n最後の1問が、新しい会話のきっかけ。\n次はきっと、満点が狙える。',
  },
  {
    score: 10,
    title: 'わたし解像度100%',
    tag: 'PERFECT',
    tagBg: '#ffe36f',
    tagColor: '#191919',
    message: '10問すべて同じ答え。理解度ぴったり。\n理由まで聞けば、会話はもっと深くなる。',
    messageLong: '10問すべて同じ答え。理解度ぴったり。\n好みも考え方も、しっかり読めている。\nふたりの息は、ぴったり合っている。\n理由まで聞けば、会話はもっと深くなる。',
  },
]);

export const CHALLENGE_RESULT_TIERS_EN = Object.freeze([
  { score: 0, title: '10 New Sides Discovered', tag: 'START', tagBg: '#191919', tagColor: '#ffffff', message: 'You found ten new things to talk about.\nLet the answer review start the conversation.', messageLong: 'You found ten new things to learn.\nEvery miss is a fresh discovery.\nAsk them, “Why that answer?”\nLet the review start the talk.' },
  { score: 1, title: 'One Match, First Step', tag: '1 HIT', tagBg: '#f4a261', tagColor: '#ffffff', message: 'Your first answer matched perfectly.\nThe more you talk, the more you will understand.', messageLong: 'Your first match: a perfect start.\nNine answers are left to discover.\nAsk about the one that surprised you.\nThe more you talk, the more you know.' },
  { score: 2, title: 'Two “Oh, Really?” Moments', tag: '2 HITS', tagBg: '#ef8730', tagColor: '#ffffff', message: 'Two matches and eight new discoveries.\nThe more you talk, the more you will understand.', messageLong: 'Two matches and eight discoveries.\nSurprising answers make great topics.\nAsk why they chose differently.\nThe more you talk, the more you know.' },
  { score: 3, title: 'Starting to Get the Picture', tag: '3 HITS', tagBg: '#55c9dd', tagColor: '#191919', message: 'Three answers matched their point of view.\nThe more you talk, the more you will understand.', messageLong: 'Three answers matched their style.\nTheir tastes are coming into view.\nSeven misses mean seven new topics.\nThe more you talk, the more you know.' },
  { score: 4, title: 'You-Knowledge Updating', tag: 'UPDATE', tagBg: '#55c9dd', tagColor: '#191919', message: 'Some answers matched and some surprised you.\nEvery difference is a new conversation starter.', messageLong: 'Four matches: your view is updating.\nSome answers fit, some surprised you.\nEach difference starts a new chat.\nPick one answer and ask about it.' },
  { score: 5, title: 'Half Matches, Half Discoveries', tag: 'HALF', tagBg: '#ffe36f', tagColor: '#191919', message: 'Half familiar and half surprising.\nFive discoveries can lead to five new stories.', messageLong: 'Half familiar, half surprising.\nFive matches and five discoveries.\nFive discoveries, five new stories.\nAim for more than half next time.' },
  { score: 6, title: 'More in Sync Than Surprised', tag: 'GOOD', tagBg: '#f06e9f', tagColor: '#ffffff', message: 'What you know now leads what surprised you.\nThe other four answers give you more to discuss.', messageLong: 'More in sync than surprised.\nYou know their tastes quite well.\nFour answers left to talk about.\nAsk why, and you will match more.' },
  { score: 7, title: 'Pretty Fluent in You', tag: 'GREAT', tagBg: '#ec4683', tagColor: '#ffffff', message: 'You understand them well, with discoveries left.\nThe last three answers are your next topics.', messageLong: 'You know them well, with more to learn.\nSeven matches: you pay attention.\nThe last three are your next topics.\nThe review brings you even closer.' },
  { score: 8, title: 'Your World in HD', tag: 'EXPERT', tagBg: '#ec4683', tagColor: '#ffffff', message: 'You understand them well, with discoveries left.\nEnjoy the two answers that still surprised you.', messageLong: 'Eight matches: expert level.\nYou really know how they think.\nTwo surprises left to enjoy.\nA perfect score is within reach.' },
  { score: 9, title: 'One More Conversation Starter', tag: '1 DISCOVERY', tagBg: '#ec4683', tagColor: '#ffffff', message: 'You understand them well, with one discovery left.\nThat last answer can start a new conversation.', messageLong: 'So close: just one answer away.\nNine matches show real insight.\nThe last one sparks a new chat.\nNext time, go for a perfect score.' },
  { score: 10, title: 'You in 100% Focus', tag: 'PERFECT', tagBg: '#ffe36f', tagColor: '#191919', message: 'All ten answers matched. Perfect understanding.\nAsk why, and the conversation can go even deeper.', messageLong: 'All ten answers matched.\nYou read their tastes and thinking.\nYou two are perfectly in sync.\nAsk why, and the talk goes deeper.' },
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

export function getChallengeResultTier(score, total = 10) {
  if (Number.isInteger(total) && total > 0 && total < 10) return shortQuizTier(score, total, CHALLENGE_RESULT_TIERS);
  const safeScore = Math.max(0, Math.min(10, Math.trunc(Number(score) || 0)));
  return CHALLENGE_RESULT_TIERS[safeScore];
}

export function getChallengeResultTierEnglish(score, total = 10) {
  if (Number.isInteger(total) && total > 0 && total < 10) return shortQuizTier(score, total, CHALLENGE_RESULT_TIERS_EN);
  const safeScore = Math.max(0, Math.min(10, Math.trunc(Number(score) || 0)));
  return CHALLENGE_RESULT_TIERS_EN[safeScore];
}

export function getChallengeReviewLinesEnglish(result = {}) {
  const answers = Array.isArray(result.answers) ? result.answers : [];
  if (answers.length > 0 && answers.length < 10) return shortQuizReview(result, answers);
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
  if (answers.length > 0 && answers.length < 10) return shortQuizReview(result, answers);
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

function shortQuizTier(score, total, tiers) {
  const safeScore = Math.max(0, Math.min(total, Math.trunc(Number(score) || 0)));
  return { ...tiers[safeScore === total ? 10 : 4], score: safeScore,
    tag: `${safeScore}/${total}`, message: tiers[10].message.split('\n')[1] };
}

function shortQuizReview(result, answers) {
  const score = Math.max(0, Math.min(answers.length, Math.trunc(Number(result.score) || 0)));
  const correct = answers.filter(answer => answer.match === true || answer.isCorrect === true);
  const missed = answers.filter(answer => answer.match !== true && answer.isCorrect !== true);
  const titles = items => items.map(answer => String(answer.card?.title || '')).filter(Boolean).join(' · ') || '—';
  return [`${score}/${answers.length}`, `✓ ${titles(correct)}`, `× ${titles(missed)}`,
    String((missed[0] || correct[0])?.card?.title || '—')];
}
