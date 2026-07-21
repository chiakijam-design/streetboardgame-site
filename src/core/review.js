import {
  countMatches,
  getScoreBand,
  getScoreLevel,
  isCorrectAnswer,
} from './scoring.js';

export const REVIEW_CATEGORY_LABELS = Object.freeze({
  food: '食べ物・日常の好み',
  outing: 'おでかけ・遊びの感覚',
  lifestyle: '暮らし方・生活リズム',
  personality: '性格・価値観',
  memory: '思い出・過去のツボ',
  fantasy: 'もしも話・妄想力',
  entertainment: '推し・エンタメ感性',
  challenge: '苦手なこと・挑戦のクセ',
});

export function inferReviewCategory(card = {}) {
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

function topCategory(bucket, fallback) {
  return Object.entries(bucket)
    .sort((left, right) => right[1] - left[1])[0]?.[0] || fallback;
}

export function createReviewContext(answers = [], cards = []) {
  const safeAnswers = Array.isArray(answers) ? answers : [];
  const safeCards = Array.isArray(cards) ? cards : [];
  const hits = {};
  const misses = {};

  safeAnswers.forEach((answer, index) => {
    const category = inferReviewCategory(safeCards[index]);
    const bucket = isCorrectAnswer(answer) ? hits : misses;
    bucket[category] = (bucket[category] || 0) + 1;
  });

  const hitCategory = topCategory(hits, 'personality');
  const missCategory = topCategory(misses, 'fantasy');
  const score = countMatches(safeAnswers);
  const questionSeed = safeCards.reduce((sum, card, index) => {
    const text = `${card?.category || ''}${card?.title || ''}`;
    const textSeed = Array.from(text).reduce((value, char) => value + char.charCodeAt(0), 0);
    return sum + textSeed + (isCorrectAnswer(safeAnswers[index]) ? 17 : 3);
  }, 0);

  return {
    total: Math.max(1, safeAnswers.length),
    score,
    hits,
    misses,
    hitCategory,
    missCategory,
    hit: REVIEW_CATEGORY_LABELS[hitCategory],
    miss: REVIEW_CATEGORY_LABELS[missCategory],
    hitCount: Object.values(hits).reduce((sum, count) => sum + count, 0),
    missCount: Object.values(misses).reduce((sum, count) => sum + count, 0),
    level: getScoreLevel(score),
    scoreBand: getScoreBand(score),
    questionSeed,
  };
}

export function createReviewTemplateTools(values, context) {
  const fillTemplate = (template) => String(template || '').replace(
    /\{(\w+)\}/g,
    (_, key) => values?.[key] || '',
  );
  const pickVariant = (list, offset = 0) => {
    const safeList = Array.isArray(list) ? list : [];
    if (!safeList.length) return '';
    const seed = context.questionSeed
      + (context.score * 13)
      + (context.hit.length * 5)
      + (context.miss.length * 7)
      + offset;
    return safeList[Math.abs(seed) % safeList.length];
  };
  return { fillTemplate, pickVariant };
}
