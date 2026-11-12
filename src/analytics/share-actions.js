import { playDayJst } from './daily-play.js';
// Every data-result-share value rendered by src/platform/resultShare.js.
export const SHARE_ACTION_SURFACES = Object.freeze(['result', 'invite']);
export const SHARE_ACTIONS = Object.freeze(['native', 'copy', 'save', 'x', 'line', 'whatsapp', 'instagram-link', 'instagram']);

export function validShareAction(surface, action) {
  return SHARE_ACTION_SURFACES.includes(surface) && SHARE_ACTIONS.includes(action);
}

// Aggregate count only. A missing table (before migration 0031) or any D1 failure
// must never break the page or the share itself, so failures report stored:false.
export async function recordShareAction(env, surface, action, now = Date.now()) {
  if (!env.REMOTE_DB || !validShareAction(surface, action)) return false;
  try {
    await env.REMOTE_DB.prepare(`INSERT INTO play_daily_share_actions (day, surface, action, count)
      VALUES (?, ?, ?, 1) ON CONFLICT(day, surface, action) DO UPDATE SET count = count + 1
    `).bind(playDayJst(now), surface, action).run();
    return true;
  } catch {
    return false;
  }
}
