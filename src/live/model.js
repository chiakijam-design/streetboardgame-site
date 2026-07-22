import {
  LIVE_CREATOR_IMAGE_MAX_LENGTH,
  LIVE_QUESTION_TYPES,
  LIVE_RESERVATION_MAX_DAYS,
} from './config.js';

export const LIVE_TYPE_VALUES = Object.freeze(LIVE_QUESTION_TYPES.map(({ value }) => value));

export function createLiveQuestion(overrides = {}) {
  return {
    id: overrides.id || createClientId(),
    type: LIVE_TYPE_VALUES.includes(overrides.type) ? overrides.type : 'guess-person',
    text: String(overrides.text || ''),
    options: Array.isArray(overrides.options) && overrides.options.length >= 2
      ? overrides.options.slice(0, 5).map(String)
      : ['', ''],
    lockedIndex: Number.isInteger(overrides.lockedIndex) ? overrides.lockedIndex : null,
    selected: overrides.selected !== false,
    recommended: Boolean(overrides.recommended),
  };
}

export function normalizeLiveQuestion(question, maxOptions = 5) {
  const source = question && typeof question === 'object' ? question : {};
  const options = Array.isArray(source.options)
    ? source.options.slice(0, maxOptions).map((option) => normalizeText(option, 60)).filter(Boolean)
    : [];
  const type = LIVE_TYPE_VALUES.includes(source.type) ? source.type : 'poll';
  const lockedIndex = source.lockedIndex === null || source.lockedIndex === undefined || source.lockedIndex === ''
    ? Number.NaN
    : Number(source.lockedIndex);
  return {
    id: normalizeId(source.id) || createClientId(),
    type,
    text: normalizeText(source.text, 180),
    options,
    lockedIndex: type === 'poll' || !Number.isInteger(lockedIndex) || lockedIndex < 0 || lockedIndex >= options.length
      ? null
      : lockedIndex,
  };
}

export function validateLiveDraft(input, options = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const creationMode = source.creationMode === 'youtube' ? 'youtube' : 'manual';
  const maxOptions = creationMode === 'youtube' ? 5 : 4;
  const questions = Array.isArray(source.questions)
    ? source.questions.map((question) => normalizeLiveQuestion(question, maxOptions))
    : [];
  const draft = {
    creationMode,
    title: normalizeText(source.title, 80),
    subjectName: normalizeText(source.subjectName, 40),
    channelName: normalizeText(source.channelName, 80),
    scheduledAt: normalizeTimestamp(source.scheduledAt),
    creatorImageDataUrl: normalizeCreatorImage(source.creatorImageDataUrl),
    showLiveVoteCounts: source.showLiveVoteCounts === true,
    questions,
  };
  const errors = [];
  if (!draft.title) errors.push('ゲームタイトルを入力してください');
  if (!draft.subjectName) errors.push('主役または回答者の名前を入力してください');
  if (creationMode === 'youtube' && !draft.scheduledAt) {
    errors.push('ライブ配信の予約日時を選んでください');
  } else if (creationMode === 'youtube' && draft.scheduledAt <= now) {
    errors.push('予約日時は現在より後を選んでください');
  } else if (creationMode === 'youtube' && draft.scheduledAt > now + LIVE_RESERVATION_MAX_DAYS * 24 * 60 * 60 * 1000) {
    errors.push(`予約日時は${LIVE_RESERVATION_MAX_DAYS}日以内を選んでください`);
  }
  if (source.creatorImageDataUrl && !draft.creatorImageDataUrl) {
    errors.push('登録画像はJPEG・PNG・WebP形式で選び直してください');
  }
  if (questions.length < 1) errors.push('問題を1問以上作ってください');
  if (creationMode === 'youtube' && questions.length > 30) errors.push('YouTubeモードの問題は30問以内にしてください');
  const youtubeType = creationMode === 'youtube' ? questions[0]?.type : '';
  questions.forEach((question, index) => {
    if (!question.text) errors.push(`Q${index + 1}の問題文を入力してください`);
    if (creationMode === 'youtube' && question.options.length !== 5) {
      errors.push(`Q${index + 1}の選択肢を5個入力してください`);
    } else if (creationMode !== 'youtube' && question.options.length < 2) {
      errors.push(`Q${index + 1}の選択肢を2個以上入力してください`);
    }
    if (creationMode === 'youtube' && (!['guess-person', 'guess-majority'].includes(question.type) || question.type !== youtubeType)) {
      errors.push(`Q${index + 1}の問題タイプを統一してください`);
    }
    if (creationMode !== 'youtube' && question.type !== 'poll' && question.lockedIndex === null) {
      errors.push(`Q${index + 1}の非公開回答・予想を選んでください`);
    }
  });
  return { valid: errors.length === 0, errors, draft };
}

export function calculateLiveResult(question, votes) {
  const normalized = normalizeLiveQuestion(question);
  const counts = normalized.options.map(() => 0);
  for (const value of Object.values(votes || {})) {
    const index = Number(value);
    if (Number.isInteger(index) && index >= 0 && index < counts.length) counts[index] += 1;
  }
  const totalVotes = counts.reduce((sum, count) => sum + count, 0);
  const maxVotes = totalVotes > 0 ? Math.max(...counts) : 0;
  const popularIndices = maxVotes > 0
    ? counts.map((count, index) => count === maxVotes ? index : -1).filter((index) => index >= 0)
    : [];
  const options = normalized.options.map((text, index) => ({
    text,
    count: counts[index],
    percentage: totalVotes ? Math.round((counts[index] / totalVotes) * 1000) / 10 : 0,
  }));
  const base = { questionId: normalized.id, type: normalized.type, text: normalized.text, options, totalVotes, popularIndices };
  if (normalized.type === 'guess-person') {
    return {
      ...base,
      subjectAnswerIndex: normalized.lockedIndex,
      isCorrect: popularIndices.includes(normalized.lockedIndex),
    };
  }
  if (normalized.type === 'guess-majority') {
    return {
      ...base,
      predictionIndex: normalized.lockedIndex,
      isCorrect: popularIndices.includes(normalized.lockedIndex),
    };
  }
  return base;
}

export function recommendYouTubeCandidates(questions, perType = 5) {
  const counts = { 'guess-person': 0, 'guess-majority': 0 };
  return (questions || []).map((question) => {
    const type = question.type;
    const selected = Object.prototype.hasOwnProperty.call(counts, type) && counts[type] < perType;
    if (selected) counts[type] += 1;
    return { ...question, selected };
  });
}

function normalizeText(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeId(value) {
  const text = String(value || '').trim();
  return /^[A-Za-z0-9_-]{1,80}$/.test(text) ? text : '';
}

function normalizeTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? Math.trunc(timestamp) : 0;
}

function normalizeCreatorImage(value) {
  const dataUrl = String(value || '');
  if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(dataUrl)) return '';
  return dataUrl.length <= LIVE_CREATOR_IMAGE_MAX_LENGTH ? dataUrl : '';
}

function createClientId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
