// 2026-11-27 (Codex review 11/26 #2-13): daily counts for visitors who came from a shared link.
// Stored: day (JST), page language, share channel, step. Nothing that identifies a room or a person.
import { playDayJst } from './daily-play.js';
import { TARGET_LOCALES } from '../i18n/locales.js';

export const FUNNEL_STEPS = Object.freeze(['arrived', 'joined', 'completed', 'created']);
export const FUNNEL_CHANNELS = Object.freeze(['line', 'x', 'whatsapp', 'copy', 'instagram', 'share', 'qr']);

export function validShareFunnel(step, channel, locale) {
  return FUNNEL_STEPS.includes(step) && FUNNEL_CHANNELS.includes(channel) && TARGET_LOCALES.includes(locale);
}

// Best effort: a missing table (before migration 0035) or a D1 failure never breaks the game.
export async function recordShareFunnel(env, step, channel, locale, now = Date.now()) {
  if (!env.REMOTE_DB || !validShareFunnel(step, channel, locale)) return false;
  try {
    await env.REMOTE_DB.prepare(`INSERT INTO play_daily_share_funnel (day, locale, channel, step, count)
      VALUES (?, ?, ?, ?, 1) ON CONFLICT(day, locale, channel, step) DO UPDATE SET count = count + 1
    `).bind(playDayJst(now), locale, channel, step).run();
    return true;
  } catch {
    return false;
  }
}
