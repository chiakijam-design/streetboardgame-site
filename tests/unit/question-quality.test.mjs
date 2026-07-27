import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessQuestionQuality,
  QUESTION_QUALITY_STANDARD,
} from '../../src/questions/quality.js';

test('答え合わせから会話が始まる問題を採用候補として判定する', () => {
  const result = assessQuestionQuality({
    title: '疲れた日に食べたくなるのは？',
    choices: ['ラーメン', 'カレー', '甘いもの', '家のごはん', '何も食べない'],
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.score, 100);
  assert.equal(result.conversationReady, true);
  assert.equal(result.standard, QUESTION_QUALITY_STANDARD);
  assert.ok(result.strengths.some((strength) => strength.includes('理由を話しやすい')));
});

test('未成立の問題文・重複選択肢・意味不明な仮置きを要修正にする', () => {
  const result = assessQuestionQuality({
    title: '質問',
    choices: ['選択肢1', '選択肢1', '3', '4', '5'],
  });
  const codes = result.issues.map((issue) => issue.code);

  assert.equal(result.status, 'needs-fix');
  assert.ok(codes.includes('question-not-formed'));
  assert.ok(codes.includes('duplicate-choices'));
  assert.ok(codes.includes('unclear-expression'));
  assert.ok(codes.includes('low-conversation-potential'));
});

test('誤字候補と極端に長い選択肢へ修正案を返す', () => {
  const result = assessQuestionQuality({
    title: '友達とのコミニュケーションで大切なのは？',
    choices: [
      '相手の話を聞く',
      '自分の考えを話す',
      '共通点を探す',
      '気持ちを言葉にする',
      'とても長い説明を途中で区切らずそのまま選択肢として四十五文字以上入力し続けて比較しにくくしてしまう',
    ],
  });
  const typo = result.issues.find((issue) => issue.code === 'possible-typo');
  const length = result.issues.find((issue) => issue.code === 'choice-length-extreme');

  assert.equal(result.status, 'needs-fix');
  assert.match(typo.detail, /コミニュケーション.*コミュニケーション/);
  assert.match(length.suggestion, /短くする/);
});

test('個人情報・容姿攻撃・性的内容を重大な審査対象にする', () => {
  const result = assessQuestionQuality({
    title: '通っている学校名と本名は？',
    choices: ['性的な話', 'ブス', '安全な話', '趣味', '休日'],
  });
  const codes = result.issues.map((issue) => issue.code);

  assert.equal(result.status, 'needs-fix');
  assert.ok(codes.includes('personal-information'));
  assert.ok(codes.includes('unsafe-content'));
});

test('既存問題との類似度と会話につながりにくい問いを要確認にする', () => {
  const result = assessQuestionQuality({
    title: '誕生日は何月？',
    choices: ['1月', '2月', '3月', '4月', '5月'],
  }, {
    similarMatches: [{
      title: '誕生日の月は？',
      score: 0.8,
    }],
  });
  const codes = result.issues.map((issue) => issue.code);

  assert.equal(result.status, 'review');
  assert.ok(codes.includes('similar-question'));
  assert.ok(codes.includes('low-conversation-potential'));
});

test('英語問題も問題形式と会話性を判定できる', () => {
  const result = assessQuestionQuality({
    language: 'en',
    title: 'What is your ideal weekend?',
    choices: ['Stay home', 'Go shopping', 'Meet friends', 'Take a trip', 'Play sports'],
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.conversationReady, true);
});
