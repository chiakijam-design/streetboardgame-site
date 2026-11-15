// Link previews for invite URLs (/challenge?room=CODE): put the creator's
// display name into og:title / og:description / twitter:* / <title>.
// The page stays noindex and is served no-store when personalized.

import { scanQuestionSafety } from '../questions/safety.js';

const ROOM_CODE = /^[A-Z2-9]{8}$/;

// Names that would spread abuse, contact details or links through link
// previews are replaced with a generic heading (the name still shows inside
// the game, where the creator chose it).
const UNSAFE_LATIN_NAME = /fuck|shit|bitch|sex|porn|nude|nazi|nigg|kill|\bdie\b|https?:|www\.|\.(?:com|net|jp)\b/i;
export function isUnsafeShareName(name) {
  const text = String(name || '').normalize('NFKC');
  if (UNSAFE_LATIN_NAME.test(text)) return true;
  const { moderationFlags, personalInfoFlags } = scanQuestionSafety({ title: text });
  return moderationFlags.length > 0 || personalInfoFlags.some((flag) => flag === 'sns-id' || flag === 'phone-number');
}

const COPY = {
  ja: {
    genericTitle: '友だちからの挑戦｜私のこと、ちゃんと分かってるよね？',
    genericDescription: (count) => `友だちのこと、どれだけ分かってる？${count}問の答えを当てよう。登録不要。`,
    title: (name) => `${name}さんからの挑戦｜私のこと、ちゃんと分かってるよね？`,
    description: (name, count) => `${name}さんのこと、どれだけ分かってる？${count}問の答えを当てよう。登録不要。`,
  },
  en: {
    genericTitle: "A friend's challenge | How well do you know me?",
    genericDescription: (count) => `How well do you know your friend? Guess the answers to ${count} ${count === 1 ? 'question' : 'questions'}. No sign-up.`,
    title: (name) => `${name}'s challenge | How well do you know me?`,
    description: (name, count) => `How well do you know ${name}? Guess the answers to ${count} ${count === 1 ? 'question' : 'questions'}. No sign-up.`,
  },
  pt: {
    genericTitle: 'Desafio de um amigo | Você me conhece mesmo?',
    genericDescription: (count) => `Quanto você conhece seu amigo? Adivinhe as respostas de ${count} ${count === 1 ? 'pergunta' : 'perguntas'}. Sem cadastro.`,
    title: (name) => `Desafio de ${name} | Você me conhece mesmo?`,
    description: (name, count) => `Quanto você conhece ${name}? Adivinhe as respostas de ${count} ${count === 1 ? 'pergunta' : 'perguntas'}. Sem cadastro.`,
  },
  es: {
    genericTitle: 'El reto de un amigo | ¿Cuánto me conoces?',
    genericDescription: (count) => `¿Cuánto conoces a tu amigo? Adivina las respuestas de ${count} ${count === 1 ? 'pregunta' : 'preguntas'}. Sin registro.`,
    title: (name) => `El reto de ${name} | ¿Cuánto me conoces?`,
    description: (name, count) => `¿Cuánto conoces a ${name}? Adivina las respuestas de ${count} ${count === 1 ? 'pregunta' : 'preguntas'}. Sin registro.`,
  },
};

export function roomCodeFromUrl(url) {
  const code = String(url.searchParams.get('room') || '').trim().toUpperCase();
  return ROOM_CODE.test(code) ? code : '';
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanName(value) {
  // Display names are at most 12 characters; strip control characters.
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 12);
}

export async function readRoomShareInfo(env, code) {
  if (!code) return null;
  try {
    const now = Date.now();
    if (env?.REMOTE_DB) {
      const row = await env.REMOTE_DB.prepare(
        'SELECT creator_name, json_array_length(cards_json) AS card_count, expires_at FROM challenge_rooms WHERE code = ?',
      ).bind(code).first();
      if (!row || Number(row.expires_at) <= now) return null;
      const name = cleanName(row.creator_name);
      const count = Number(row.card_count) || 0;
      return name && count > 0 ? { name, count } : null;
    }
    if (env?.CHALLENGE_KV) {
      const room = await env.CHALLENGE_KV.get(`challenge:${code}`, { type: 'json' });
      if (!room || Number(room.expiresAt) <= now) return null;
      const name = cleanName(room.creatorName);
      const count = Array.isArray(room.cards) ? room.cards.length : 0;
      return name && count > 0 ? { name, count } : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function roomShareCopy(locale, info) {
  const copy = COPY[locale] || COPY.en;
  if (isUnsafeShareName(info.name)) return { title: copy.genericTitle, description: copy.genericDescription(info.count) };
  return { title: copy.title(info.name, info.count), description: copy.description(info.name, info.count) };
}

export function applyRoomShareMeta(html, locale, info) {
  if (!html || !info) return html;
  const { title, description } = roomShareCopy(locale, info);
  const t = escapeAttribute(title);
  const d = escapeAttribute(description);
  return html
    .replace(/<title>[^<]*<\/title>/i, `<title>${t}</title>`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*("\s*\/?>)/i, `$1${t}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*("\s*\/?>)/i, `$1${d}$2`)
    .replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*("\s*\/?>)/i, `$1${t}$2`)
    .replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*("\s*\/?>)/i, `$1${d}$2`);
}

// Convenience: look the room up and personalize. Returns { html, personalized }.
export async function personalizeRoomPage(html, env, url, locale) {
  const code = roomCodeFromUrl(url);
  if (!html || !code) return { html, personalized: false };
  const info = await readRoomShareInfo(env, code);
  if (!info) return { html, personalized: false };
  return { html: applyRoomShareMeta(html, locale, info), personalized: true };
}
