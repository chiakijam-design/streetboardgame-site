// Contact form endpoint (replaces Formspree, 2026-11-14).
// Every message is stored in REMOTE_DB first, then mailed to the operator through Resend.
// The operator address lives only in the CONTACT_NOTIFY_TO secret; this repository is public.
// Raw IP addresses are never stored: repeated sends are counted with hashed, hourly keys.

export const CONTACT_SITES = Object.freeze({
  wata: Object.freeze({
    name: 'わたし理解度診断',
    // Sender display name. No spaces: iPhone Mail swaps space-separated names like a family/given name.
    fromName: 'わたちゃんお問い合わせ',
    origins: Object.freeze(['https://www.streetboardgame.com']),
    sameOrigin: true,
  }),
  minna: Object.freeze({
    name: 'みんなのWeb診断',
    fromName: 'みんなのWeb診断お問い合わせ',
    origins: Object.freeze(['https://webpersonalitytest.com', 'https://www.webpersonalitytest.com']),
    sameOrigin: false,
  }),
});

export const CONTACT_LIMITS = Object.freeze({
  bodyBytes: 20_000,
  name: 100,
  email: 254,
  message: 4000,
  extraKeys: 10,
  extraValue: 300,
  minElapsedMs: 3000,
  perSenderPerHour: 5,
  rateWindowMs: 3_600_000,
  mailsPerDay: 80,
});

const FROM_ADDRESS = 'no-reply@notify.streetboardgame.com';
const EXTRA_LABELS = Object.freeze({
  feedback_type: '送りたい内容',
  usage_scene: '使った場面',
  topic: '種類',
  subject: '件名',
  page: 'ページ',
});
const readyDatabases = new WeakSet();

export function contactSiteForOrigin(origin, requestOrigin) {
  if (!origin) return null;
  for (const [key, site] of Object.entries(CONTACT_SITES)) {
    if (site.origins.includes(origin) || (site.sameOrigin && origin === requestOrigin)) return { key, site };
  }
  return null;
}

export async function handleContactApi(request, env, now = Date.now()) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';
  const match = contactSiteForOrigin(origin, url.origin);
  const cors = match && origin !== url.origin
    ? {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'Content-Type',
        'access-control-max-age': '86400',
        vary: 'Origin',
      }
    : { vary: 'Origin' };
  const reply = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow, noarchive',
      ...cors,
      ...extraHeaders,
    },
  });

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: match ? 204 : 403, headers: { 'cache-control': 'no-store', ...cors } });
  }
  if (request.method !== 'POST') return reply({ error: 'method-not-allowed' }, 405, { allow: 'POST, OPTIONS' });
  if (!match) return reply({ error: 'origin-not-allowed' }, 403);
  if (!env?.REMOTE_DB) return reply({ error: 'contact-unavailable' }, 503);
  if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) {
    return reply({ error: 'unsupported-media-type' }, 415);
  }

  let data;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > CONTACT_LIMITS.bodyBytes) return reply({ error: 'too-large' }, 413);
    data = JSON.parse(raw);
  } catch {
    return reply({ error: 'invalid-json' }, 400);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return reply({ error: 'invalid-json' }, 400);

  const name = cleanText(data.name, CONTACT_LIMITS.name, true);
  const email = cleanText(data.email, CONTACT_LIMITS.email, true).toLowerCase();
  const message = cleanText(data.message, CONTACT_LIMITS.message, false);
  if (!message) return reply({ error: 'message-required' }, 400);
  if (email && !isEmail(email)) return reply({ error: 'invalid-email' }, 400);
  const extra = cleanExtra(data.extra);

  const db = env.REMOTE_DB;
  await ensureContactTables(db);
  const identity = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!await allowSender(db, match.key, identity, now)) {
    const retryAfter = Math.max(1, Math.ceil((windowStart(now) + CONTACT_LIMITS.rateWindowMs - now) / 1000));
    return reply({ error: 'rate-limited' }, 429, { 'retry-after': String(retryAfter) });
  }

  const elapsed = Number(data.elapsedMs);
  const bot = Boolean(cleanText(data.hp, 200, true)) || !Number.isFinite(elapsed) || elapsed < CONTACT_LIMITS.minElapsedMs;
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO contact_messages
    (id, site, created_at, name, email, message, extra_json, verdict, mail_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, match.key, now, name, email, message, JSON.stringify(extra), bot ? 'bot' : 'ok', bot ? 'not_sent' : 'sending')
    .run();
  if (bot) return reply({ ok: true });

  let status = 'failed';
  let resendId = null;
  try {
    const sentToday = await db.prepare(`SELECT COUNT(*) AS n FROM contact_messages
      WHERE created_at > ? AND mail_status IN ('sending', 'sent', 'failed') AND id <> ?`)
      .bind(now - 86_400_000, id).first();
    if (Number(sentToday?.n || 0) >= CONTACT_LIMITS.mailsPerDay) {
      status = 'skipped_limit';
    } else if (env.RESEND_API_KEY && env.CONTACT_NOTIFY_TO) {
      const mail = buildContactMail({ site: match.site, name, email, message, extra, now });
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        redirect: 'manual',
        headers: {
          authorization: `Bearer ${env.RESEND_API_KEY}`,
          'content-type': 'application/json',
          'user-agent': 'streetboardgame-contact/1.0',
          'idempotency-key': `contact-${id}`,
        },
        body: JSON.stringify({
          from: `${match.site.fromName} <${FROM_ADDRESS}>`,
          to: [String(env.CONTACT_NOTIFY_TO).trim()],
          ...(email ? { reply_to: email } : {}),
          subject: mail.subject,
          text: mail.text,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && typeof result?.id === 'string') {
        status = 'sent';
        resendId = result.id.slice(0, 100);
      } else {
        console.error('contact-mail-failed', response.status);
      }
    } else {
      console.error('contact-mail-not-configured');
    }
  } catch (error) {
    console.error('contact-mail-error', String(error?.message || error).slice(0, 200));
  }
  await db.prepare('UPDATE contact_messages SET mail_status = ?, resend_id = ? WHERE id = ?').bind(status, resendId, id).run();
  // The message is stored either way, so the visitor sees success.
  return reply({ ok: true });
}

export function buildContactMail({ site, name, email, message, extra, now }) {
  const kind = extra.feedback_type || extra.subject || 'お問い合わせ';
  const subject = oneLine(`【${site.name}】${kind}${name ? `：${name}様` : ''}`).slice(0, 200);
  const received = new Date(now + 9 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ');
  const lines = [
    `${site.name} のお問い合わせフォームから届きました。`,
    email ? 'このメールに返信すると、送り主のメールアドレスへ届きます。' : '送り主はメールアドレスを入力していません（返信不要）。',
    '',
    `お名前：${name || '（未入力）'}`,
    `メール：${email || '（未入力）'}`,
    ...Object.entries(extra).map(([key, value]) => `${EXTRA_LABELS[key] || key}：${value}`),
    `受付：${received}（日本時間）`,
    '',
    '── 内容 ──',
    message,
  ];
  return { subject, text: lines.join('\n') };
}

function cleanText(value, max, singleLine) {
  if (typeof value !== 'string') return '';
  let text = value.normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  if (singleLine) text = oneLine(text);
  else text = text.replace(/\r\n?/g, '\n');
  return text.trim().slice(0, max);
}

function oneLine(value) {
  return String(value).replace(/[\r\n\t]+/g, ' ');
}

function cleanExtra(value) {
  const extra = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return extra;
  for (const [key, raw] of Object.entries(value).slice(0, CONTACT_LIMITS.extraKeys)) {
    if (!/^[a-z_]{1,30}$/.test(key)) continue;
    const text = cleanText(raw, CONTACT_LIMITS.extraValue, true);
    if (text) extra[key] = text;
  }
  return extra;
}

function isEmail(value) {
  return value.length <= CONTACT_LIMITS.email && /^[^\s@,;<>"()[\]\\]+@[^\s@,;<>"()[\]\\]+\.[^\s@,;<>"()[\]\\]+$/.test(value);
}

function windowStart(now) {
  return Math.floor(now / CONTACT_LIMITS.rateWindowMs) * CONTACT_LIMITS.rateWindowMs;
}

async function ensureContactTables(db) {
  if (readyDatabases.has(db)) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS live_rate_limits (
    rate_key TEXT PRIMARY KEY, window_start INTEGER NOT NULL,
    request_count INTEGER NOT NULL, expires_at INTEGER NOT NULL
  )`).run();
  readyDatabases.add(db);
}

async function allowSender(db, siteKey, identity, now) {
  const start = windowStart(now);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`contact:${start}:${identity}`));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const row = await db.prepare(`INSERT INTO live_rate_limits (rate_key, window_start, request_count, expires_at)
    VALUES (?, ?, 1, ?) ON CONFLICT(rate_key) DO UPDATE SET request_count = request_count + 1
    RETURNING request_count`)
    .bind(`contact:${siteKey}:${hash}`, start, start + CONTACT_LIMITS.rateWindowMs * 2)
    .first();
  return Number(row?.request_count) <= CONTACT_LIMITS.perSenderPerHour;
}
