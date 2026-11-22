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

// Question counts are labels or counters so the same text also works for one question.
function invite(sender, generic, question, instructions) {
  const from = name => sender.replace('{name}', () => name);
  const body = count => instructions.replace('{count}', String(count));
  return {
    genericTitle: generic + ' | ' + question,
    genericDescription: count => question + ' ' + body(count),
    title: name => from(name) + ' | ' + question,
    description: (name, count) => from(name) + ' — ' + body(count),
  };
}

const COPY = {
  "ar": invite("تحدٍّ من {name}", "تحدٍّ من صديق", "إلى أي مدى تعرفني؟", "خمّن إجاباتي. عدد الأسئلة: {count}. لا حاجة إلى التسجيل."),
  "bg": invite("Предизвикателство от {name}", "Приятелско предизвикателство", "Колко добре ме познаваш?", "Познай моите отговори. Брой въпроси: {count}. Без регистрация."),
  "bn": invite("{name} তোমাকে চ্যালেঞ্জ করেছে", "বন্ধুর চ্যালেঞ্জ", "আমাকে কতটা চেনো?", "আমার উত্তরগুলো অনুমান করো। প্রশ্নের সংখ্যা: {count}। নিবন্ধনের দরকার নেই।"),
  "cs": invite("Výzva od {name}", "Výzva od kamaráda", "Jak dobře mě znáš?", "Zkus uhodnout moje odpovědi. Počet otázek: {count}. Bez registrace."),
  "da": invite("En udfordring fra {name}", "En udfordring fra en ven", "Hvor godt kender du mig?", "Gæt mine svar. Antal spørgsmål: {count}. Ingen tilmelding."),
  "de": invite("Ein Quiz von {name}", "Ein Quiz aus deinem Freundeskreis", "Wie gut kennst du mich?", "Errate meine Antworten. Anzahl der Fragen: {count}. Ohne Anmeldung."),
  "el": invite("Πρόκληση από {name}", "Μια φιλική πρόκληση", "Πόσο καλά με ξέρεις;", "Μάντεψε τις απαντήσεις μου. Αριθμός ερωτήσεων: {count}. Χωρίς εγγραφή."),
  "fi": invite("Haaste käyttäjältä {name}", "Haaste ystävältä", "Kuinka hyvin tunnet minut?", "Arvaa vastaukseni. Kysymyksiä: {count}. Et tarvitse tiliä."),
  "fr": invite("{name} propose un quiz", "Un défi entre amis", "Tu me connais bien ?", "Devine mes réponses. Nombre de questions : {count}. Sans inscription."),
  "he": invite("אתגר מאת {name}", "אתגר בין חברים", "עד כמה אנחנו מכירים?", "אפשר לנחש מה עניתי. מספר השאלות: {count}. אין צורך בהרשמה."),
  "hi": invite("{name} की चुनौती", "दोस्त की चुनौती", "तुम मुझे कितना जानते हो?", "मेरे जवाबों का अंदाज़ा लगाओ। सवालों की संख्या: {count}। पंजीकरण ज़रूरी नहीं है।"),
  "hr": invite("Izazov šalje {name}", "Prijateljski izazov", "Koliko me dobro poznaješ?", "Pogodi moje odgovore. Broj pitanja: {count}. Bez registracije."),
  "hu": invite("A kihívás feladója: {name}", "Baráti kihívás", "Mennyire ismersz?", "Találd ki a válaszaimat! A kérdések száma: {count}. Regisztráció nélkül."),
  "id": invite("Tantangan dari {name}", "Tantangan dari teman", "Seberapa baik kamu mengenalku?", "Coba tebak jawabanku. Jumlah pertanyaan: {count}. Tidak perlu mendaftar."),
  "it": invite("La sfida di {name}", "Una sfida tra amici", "Quanto mi conosci?", "Prova a indovinare le mie risposte. Numero di domande: {count}. Non serve registrarsi."),
  "ko": invite("{name}님의 도전장", "친구가 보낸 도전장", "나를 얼마나 잘 알까?", "내가 고른 답을 맞혀 봐! 총 {count}문제. 가입 없이 참여할 수 있어."),
  "ms": invite("Cabaran daripada {name}", "Cabaran daripada rakan", "Sejauh mana kamu mengenali saya?", "Cuba teka jawapan saya. Bilangan soalan: {count}. Tak perlu mendaftar."),
  "nl": invite("Een quiz van {name}", "Een quiz voor vrienden", "Hoe goed ken je mij?", "Raad mijn antwoorden. Aantal vragen: {count}. Aanmelden is niet nodig."),
  "no": invite("En utfordring fra {name}", "En utfordring fra en venn", "Hvor godt kjenner du meg?", "Gjett svarene mine. Antall spørsmål: {count}. Ingen registrering."),
  "pl": invite("Wyzwanie od {name}", "Wyzwanie od znajomej osoby", "Jak dobrze mnie znasz?", "Zgadnij moje odpowiedzi. Liczba pytań: {count}. Bez rejestracji."),
  "ro": invite("O provocare de la {name}", "O provocare între prieteni", "Cât de bine mă cunoști?", "Ghicește răspunsurile mele. Număr de întrebări: {count}. Fără înscriere."),
  "ru": invite("Вызов от {name}", "Дружеский вызов", "Хорошо ли ты меня знаешь?", "Угадай мои ответы. Количество вопросов: {count}. Без регистрации."),
  "sk": invite("Výzva od {name}", "Kamarátska výzva", "Ako dobre ma poznáš?", "Skús uhádnuť moje odpovede. Počet otázok: {count}. Bez registrácie."),
  "sv": invite("En utmaning från {name}", "En utmaning från en vän", "Hur väl känner du mig?", "Gissa mina svar. Antal frågor: {count}. Inget konto behövs."),
  "th": invite("คำท้าจาก {name}", "คำท้าจากเพื่อน", "คุณรู้จักฉันดีแค่ไหน?", "ลองทายคำตอบของฉันให้ครบ {count} ข้อ เล่นได้โดยไม่ต้องสมัคร"),
  "tr": invite("Testi hazırlayan: {name}", "Bir arkadaşından davet", "Beni ne kadar iyi tanıyorsun?", "Cevaplarımı tahmin et. Soru sayısı: {count}. Kayıt gerekmez."),
  "uk": invite("Виклик від {name}", "Дружній виклик", "Як добре ти мене знаєш?", "Спробуй вгадати мої відповіді. Кількість запитань: {count}. Без реєстрації."),
  "vi": invite("Thử thách từ {name}", "Thử thách từ một người bạn", "Bạn hiểu mình đến đâu?", "Đoán câu trả lời của mình nhé! Số câu hỏi: {count}. Không cần đăng ký."),
  "zh-Hans": invite("来自{name}的挑战", "来自朋友的挑战", "你有多了解我？", "猜猜我选了哪些答案！共{count}道题，无需注册。"),
  "zh-Hant": invite("來自{name}的挑戰", "來自朋友的挑戰", "你有多了解我？", "猜猜我選了哪些答案！共{count}題，免註冊。"),
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

export function applyRoomShareMeta(html, locale, info, shareUrl = '') {
  if (!html || !info) return html;
  const { title, description } = roomShareCopy(locale, info);
  const t = escapeAttribute(title);
  const d = escapeAttribute(description);
  // 2026-11-21 (Codex review #2): the card's og:url names this room's public join URL in every language
  // (never the management URL), so two different quizzes never claim the same card URL.
  const withUrl = shareUrl ? html.replace(/(<meta\s+property="og:url"\s+content=")[^"]*("\s*\/?>)/i, `$1${escapeAttribute(shareUrl)}$2`) : html;
  return withUrl
    .replace(/<title>[^<]*<\/title>/i, () => `<title>${t}</title>`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*("\s*\/?>)/i, (_, open, close) => open + t + close)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*("\s*\/?>)/i, (_, open, close) => open + d + close)
    .replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*("\s*\/?>)/i, (_, open, close) => open + t + close)
    .replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*("\s*\/?>)/i, (_, open, close) => open + d + close);
}

// Convenience: look the room up and personalize. Returns { html, personalized }.
export async function personalizeRoomPage(html, env, url, locale) {
  const code = roomCodeFromUrl(url);
  if (!html || !code) return { html, personalized: false };
  const info = await readRoomShareInfo(env, code);
  if (!info) return { html, personalized: false };
  const prefix = locale && locale !== 'ja' ? `/${locale}` : '';
  const shareUrl = `https://www.streetboardgame.com${prefix}/challenge?room=${encodeURIComponent(code)}`;
  return { html: applyRoomShareMeta(html, locale, info, shareUrl), personalized: true };
}
