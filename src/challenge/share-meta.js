// Link previews for invite URLs (/challenge?room=CODE): put the creator's
// display name into og:title / og:description / twitter:* / <title>.
// The page stays noindex and is served no-store when personalized.

const ROOM_CODE = /^[A-Z2-9]{8}$/;

const COPY = {
  ja: {
    title: (name) => `${name}さんからの挑戦｜私のこと、ちゃんと分かってるよね？`,
    description: (name, count) => `${name}さんのこと、どれだけ分かってる？${count}問の答えを当てよう。登録不要。`,
  },
  en: {
    title: (name) => `${name}'s challenge | How well do you know me?`,
    description: (name, count) => `How well do you know ${name}? Guess the answers to ${count} ${count === 1 ? 'question' : 'questions'}. No sign-up.`,
  },
  pt: {
    title: (name) => `Desafio de ${name} | Você me conhece mesmo?`,
    description: (name, count) => `Quanto você conhece ${name}? Adivinhe as respostas de ${count} ${count === 1 ? 'pergunta' : 'perguntas'}. Sem cadastro.`,
  },
  es: {
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
