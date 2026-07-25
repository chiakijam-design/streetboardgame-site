export const PERSONAL_INFO_FLAG_LABELS = Object.freeze({
  'real-name': '本名・氏名',
  'school-name': '学校名',
  'sns-id': 'SNS ID',
  'phone-number': '電話番号',
  address: '住所',
});

export const MODERATION_FLAG_LABELS = Object.freeze({
  'sexual-content': '性的内容',
  bullying: 'いじめ',
  'appearance-attack': '容姿攻撃',
  discrimination: '差別表現',
});

export const QUESTION_REVIEW_CRITERIA = '性的内容、いじめ、容姿攻撃、差別表現は審査対象です。';
export const QUESTION_PUBLICATION_NOTICE = '送信した内容は運営が編集し、他の利用者へ公開する可能性があります。';

const PERSONAL_INFO_RULES = [
  ['real-name', /(?:本名|氏名|フルネーム|名字と名前|苗字と名前)|(?:^|[\s、。・])[\p{Script=Han}]{1,5}[\s　]+[\p{Script=Han}]{1,5}(?:$|[\s、。・])/u],
  ['school-name', /(?:学校名|校名|通っている学校|在学中の学校|所属校)|[\p{Script=Han}\p{Script=Katakana}A-Za-z0-9]{2,24}(?:小学校|中学校|高等学校|高校|大学|専門学校|学園)/u],
  ['sns-id', /(?:^|[\s(（])@[A-Za-z0-9_.-]{2,30}\b|(?:LINE|Instagram|インスタ|Twitter|TikTok|SNS)\s*(?:ID|アカウント|ユーザー名)\s*[:：]?\s*[@A-Za-z0-9_.-]{2,30}/iu],
  ['phone-number', /(?:\+81[-\s]?\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}|0\d{1,4}[-‐‑‒–—―ー－\s]\d{1,4}[-‐‑‒–—―ー－\s]\d{3,4}|0[789]0\d{8})/u],
  ['address', /(?:^|[^\d])〒?\d{3}[-‐‑‒–—―ー－]\d{4}(?![-‐‑‒–—―ー－\d])|(?:北海道|東京都|京都府|大阪府|.{2,3}県).{0,24}(?:市|区|町|村).{0,24}(?:丁目|番地|番|号)|(?:住所|自宅の場所|住んでいる場所)\s*[:：]/u],
];

const MODERATION_RULES = [
  ['sexual-content', /性的|セックス|エッチ|下ネタ|裸|性器|胸を触|キスした|処女|童貞|アダルト|AV(?:女優|男優|動画)?/iu],
  ['bullying', /いじめ|仲間外れ|ハブ(?:る|られ)|無視し(?:よう|て)|死ね|消えろ|きもい|キモい|うざい|ウザい/u],
  ['appearance-attack', /容姿|ブス|デブ|ハゲ|不細工|顔面|太りすぎ|痩せすぎ|見た目.{0,8}(?:悪|キモ|嫌)/u],
  ['discrimination', /差別|人種|民族|国籍.{0,8}(?:嫌|無理)|障害者|外人|部落|同性愛.{0,8}(?:嫌|無理)/u],
];

export function scanQuestionSafety(question) {
  const text = [
    question?.title || question?.text || '',
    ...(question?.choices || question?.options || []),
  ].map((value) => String(value || '').normalize('NFKC')).join('\n');

  const personalInfoFlags = matchingFlags(text, PERSONAL_INFO_RULES);
  const moderationFlags = matchingFlags(text, MODERATION_RULES);
  return {
    personalInfoFlags,
    moderationFlags,
    flags: [...personalInfoFlags, ...moderationFlags],
  };
}

export function safetyFlagLabels(flags) {
  return [...new Set(flags || [])].map((flag) => (
    PERSONAL_INFO_FLAG_LABELS[flag] || MODERATION_FLAG_LABELS[flag] || flag
  ));
}

function matchingFlags(text, rules) {
  return rules.filter(([, pattern]) => pattern.test(text)).map(([flag]) => flag);
}
