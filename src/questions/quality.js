import { safetyFlagLabels, scanQuestionSafety } from './safety.js';

export const QUESTION_QUALITY_STANDARD = 'どの問題が出ても、答え合わせから会話が始まること';

export const QUALITY_STATUS_LABELS = Object.freeze({
  ready: '採用候補',
  review: '要確認',
  'needs-fix': '要修正',
});

export const QUALITY_ISSUE_LABELS = Object.freeze({
  'question-not-formed': '問題文として未成立',
  'choice-count': '選択肢数が5個ではない',
  'empty-choice': '空の選択肢がある',
  'duplicate-choices': '選択肢が重複',
  'similar-choices': '意味が近すぎる選択肢',
  'title-length-extreme': '問題文の長さが極端',
  'choice-length-extreme': '選択肢の長さが極端',
  'possible-typo': '誤字の可能性',
  'unclear-expression': '意味不明な表現の可能性',
  'personal-information': '個人情報の可能性',
  'unsafe-content': '有害表現の可能性',
  'similar-question': '既存問題と類似',
  'low-conversation-potential': '会話につながりにくい可能性',
});

const TYPO_RULES = Object.freeze([
  [/シュミレーション/gu, 'シミュレーション'],
  [/コミニュケーション/gu, 'コミュニケーション'],
  [/こんにちわ/gu, 'こんにちは'],
  [/いちよう/gu, '一応'],
  [/づつ/gu, 'ずつ'],
]);

const CONVERSATION_MARKERS_JA = /好き|苦手|理想|したい|ほしい|欲しい|選ぶ|選べる|なら|思う|感じる|過ご|休日|放課後|学校|思い出|昔|将来|価値観|気分|嬉|楽しい|落ち込|疲れ|相談|ほめ|食べ|飲み|行き|見る|観る|聴く|話す|自分|一番|おすすめ|つい|普段|よく|大切|迷った|例える|生まれ変わる|テンション/u;
const QUESTION_MARKERS_JA = /[?？]|何|どれ|どの|どこ|いつ|誰|どう|どんな|なぜ|好き|苦手|理想|したい|ほしい|欲しい|選ぶ|なら|のは|自分|一番/u;
const CONVERSATION_MARKERS_EN = /\b(favou?rite|prefer|would|want|wish|feel|think|usually|often|memory|future|dream|weekend|school|friend|choose|most|least|ideal|relax|enjoy)\b/iu;
const QUESTION_MARKERS_EN = /[?]|\b(what|which|where|when|who|why|how|would|do|does|are|is|can)\b/iu;
const GENERIC_TITLE = /^(?:質問|問題|どれ|これ|それ|あれ|なんとなく|その他|question|quiz|which|this)$/iu;
const GENERIC_CHOICE = /^(?:選択肢\s*)?[1-5A-E]$/iu;
const UNCLEAR_SYMBOLS = /�|[\u0000-\u0008\u000B\u000C\u000E-\u001F]|[!?！？。、・…ー]{5,}|(.)\1{7,}/u;

export function assessQuestionQuality(question, { similarMatches = [] } = {}) {
  const title = cleanText(question?.title || question?.text);
  const choices = Array.isArray(question?.choices || question?.options)
    ? (question.choices || question.options).map(cleanText)
    : [];
  const language = question?.language === 'en' || looksEnglish(title) ? 'en' : 'ja';
  const issues = [];
  const strengths = [];

  if (!isFormedQuestion(title, language)) {
    addIssue(issues, {
      code: 'question-not-formed',
      severity: title.length < 3 || GENERIC_TITLE.test(title) ? 'critical' : 'warning',
      detail: title
        ? '誰が読んでも同じ意味に取れる問いか確認してください。'
        : '問題文が入力されていません。',
      suggestion: '「〜なら？」「一番〜なのは？」「〜するときは？」の形に直す',
    });
  }

  if (choices.length !== 5) {
    addIssue(issues, {
      code: 'choice-count',
      severity: 'critical',
      detail: `現在は${choices.length}個です。`,
      suggestion: '意味の異なる選択肢を5個そろえる',
    });
  }

  if (choices.some((choice) => !choice)) {
    addIssue(issues, {
      code: 'empty-choice',
      severity: 'critical',
      detail: '空欄の選択肢があります。',
      suggestion: '5個すべてに回答として成立する言葉を入れる',
    });
  }

  const duplicateGroups = duplicateChoiceGroups(choices);
  if (duplicateGroups.length) {
    addIssue(issues, {
      code: 'duplicate-choices',
      severity: 'critical',
      detail: duplicateGroups.map((group) => `「${group.join('」「')}」`).join('、'),
      suggestion: '表記だけでなく意味も異なる5択へ直す',
    });
  } else if (choices.length === 5 && choices.every(Boolean)) {
    strengths.push('5つの選択肢が重複なくそろっています。');
  }

  const similarChoicePairs = findSimilarChoicePairs(choices);
  if (similarChoicePairs.length) {
    addIssue(issues, {
      code: 'similar-choices',
      severity: 'warning',
      detail: similarChoicePairs.slice(0, 2).map(([left, right]) => `「${left}」と「${right}」`).join('、'),
      suggestion: '答え合わせで違いを説明できる選択肢へ置き換える',
    });
  }

  const titleLength = [...title].length;
  if (titleLength > 60 || titleLength > 0 && titleLength < 3) {
    addIssue(issues, {
      code: 'title-length-extreme',
      severity: titleLength > 100 || titleLength < 3 ? 'critical' : 'warning',
      detail: `問題文は${titleLength}文字です。`,
      suggestion: '目安として4〜40文字程度の一文にまとめる',
    });
  }

  const extremeChoices = choices.filter((choice) => [...choice].length > 30);
  if (extremeChoices.length) {
    addIssue(issues, {
      code: 'choice-length-extreme',
      severity: extremeChoices.some((choice) => [...choice].length > 45) ? 'critical' : 'warning',
      detail: `${extremeChoices.length}個の選択肢が30文字を超えています。`,
      suggestion: '選択肢は一目で比較できる24文字程度までに短くする',
    });
  } else if (titleLength >= 3 && titleLength <= 60 && choices.length === 5 && choices.every((choice) => [...choice].length <= 30)) {
    strengths.push('問題文と選択肢が読みやすい長さです。');
  }

  const combinedText = [title, ...choices].join('\n');
  const typoSuggestions = findTypoSuggestions(combinedText);
  if (typoSuggestions.length) {
    addIssue(issues, {
      code: 'possible-typo',
      severity: 'warning',
      detail: typoSuggestions.join('、'),
      suggestion: '候補を参考に原文を読み直す',
    });
  }

  if (looksUnclear(title, choices)) {
    addIssue(issues, {
      code: 'unclear-expression',
      severity: 'critical',
      detail: '文字化け、記号の連続、仮置きの回答などを検知しました。',
      suggestion: '中高生が一読して意味を理解できる自然な表現へ直す',
    });
  }

  const safety = scanQuestionSafety({ title, choices });
  if (safety.personalInfoFlags.length) {
    addIssue(issues, {
      code: 'personal-information',
      severity: 'critical',
      detail: safetyFlagLabels(safety.personalInfoFlags).join('・'),
      suggestion: '本名、学校名、SNS ID、電話番号、住所を含まない内容へ直す',
    });
  }
  if (safety.moderationFlags.length) {
    addIssue(issues, {
      code: 'unsafe-content',
      severity: 'critical',
      detail: safetyFlagLabels(safety.moderationFlags).join('・'),
      suggestion: '性的内容、いじめ、容姿攻撃、差別表現を含まない内容へ直す',
    });
  }

  const strongestMatch = [...(similarMatches || [])]
    .filter((match) => Number.isFinite(Number(match?.score)))
    .sort((left, right) => Number(right.score) - Number(left.score))[0];
  if (strongestMatch && Number(strongestMatch.score) >= 0.58) {
    const percent = Math.round(Number(strongestMatch.score) * 100);
    addIssue(issues, {
      code: 'similar-question',
      severity: percent >= 85 ? 'critical' : 'warning',
      detail: `「${cleanText(strongestMatch.title)}」と${percent}%類似しています。`,
      suggestion: '答え合わせで新しい会話が生まれる違いがあるか比較する',
    });
  }

  if (hasConversationPotential(title, language)) {
    strengths.push('好み・習慣・価値観など、答えの理由を話しやすい問いです。');
  } else {
    addIssue(issues, {
      code: 'low-conversation-potential',
      severity: 'warning',
      detail: '正解を確認するだけで会話が終わる可能性があります。',
      suggestion: '好み・習慣・思い出・価値観・意外性のいずれかが伝わる問いにする',
    });
  }

  const score = qualityScore(issues);
  const hasCritical = issues.some((issue) => issue.severity === 'critical');
  const status = hasCritical ? 'needs-fix' : issues.length ? 'review' : 'ready';
  return {
    score,
    status,
    statusLabel: QUALITY_STATUS_LABELS[status],
    standard: QUESTION_QUALITY_STANDARD,
    issues,
    strengths,
    safety,
    conversationReady: !hasCritical && !issues.some((issue) => issue.code === 'low-conversation-potential'),
  };
}

function addIssue(issues, issue) {
  if (issues.some((candidate) => candidate.code === issue.code)) return;
  issues.push({
    ...issue,
    label: QUALITY_ISSUE_LABELS[issue.code] || issue.code,
  });
}

function isFormedQuestion(title, language) {
  if (!title || GENERIC_TITLE.test(title)) return false;
  if (language === 'en') return QUESTION_MARKERS_EN.test(title);
  return QUESTION_MARKERS_JA.test(title);
}

function hasConversationPotential(title, language) {
  return language === 'en'
    ? CONVERSATION_MARKERS_EN.test(title)
    : CONVERSATION_MARKERS_JA.test(title);
}

function duplicateChoiceGroups(choices) {
  const groups = new Map();
  choices.forEach((choice) => {
    const normalized = normalizeComparable(choice);
    if (!normalized) return;
    const group = groups.get(normalized) || [];
    group.push(choice);
    groups.set(normalized, group);
  });
  return [...groups.values()].filter((group) => group.length > 1);
}

function findSimilarChoicePairs(choices) {
  const pairs = [];
  for (let leftIndex = 0; leftIndex < choices.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < choices.length; rightIndex += 1) {
      const left = normalizeComparable(choices[leftIndex]);
      const right = normalizeComparable(choices[rightIndex]);
      if (!left || !right || left === right || Math.min(left.length, right.length) < 3) continue;
      if (left.includes(right) || right.includes(left)) {
        pairs.push([choices[leftIndex], choices[rightIndex]]);
      }
    }
  }
  return pairs;
}

function findTypoSuggestions(text) {
  return TYPO_RULES.flatMap(([pattern, replacement]) => {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    pattern.lastIndex = 0;
    return match ? [`「${match[0]}」→「${replacement}」`] : [];
  });
}

function looksUnclear(title, choices) {
  if (UNCLEAR_SYMBOLS.test([title, ...choices].join('\n'))) return true;
  if (unbalancedBrackets(title)) return true;
  return choices.filter((choice) => GENERIC_CHOICE.test(choice)).length >= 3;
}

function unbalancedBrackets(value) {
  return [
    ['「', '」'],
    ['『', '』'],
    ['（', '）'],
    ['(', ')'],
    ['[', ']'],
  ].some(([open, close]) => count(value, open) !== count(value, close));
}

function count(value, target) {
  return [...String(value || '')].filter((character) => character === target).length;
}

function qualityScore(issues) {
  const deduction = issues.reduce((sum, issue) => (
    sum + (issue.severity === 'critical' ? 32 : 12)
  ), 0);
  return Math.max(0, 100 - deduction);
}

function looksEnglish(value) {
  const text = String(value || '');
  return /[A-Za-z]/.test(text) && !/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(text);
}

function normalizeComparable(value) {
  return cleanText(value)
    .toLocaleLowerCase('ja')
    .replace(/[\s　、。・,."'“”‘’!?！？（）()[\]「」『』]/gu, '');
}

function cleanText(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
}
