import { playDayJst } from './daily-play.js';
export const CHALLENGE_DAILY_ACTIONS = Object.freeze(['result_image_ready', 'result_image_save_requested', 'answer_report_viewed', 'role_swap_started']);

export async function recordDailyAction(env, mode, metric, now = Date.now()) {
  if (!env.REMOTE_DB) return false;
  await env.REMOTE_DB.prepare(`INSERT INTO play_daily_actions (day, mode, metric, count)
    VALUES (?, ?, ?, 1) ON CONFLICT(day, mode, metric) DO UPDATE SET count = count + 1
  `).bind(playDayJst(now), mode, metric).run();
  return true;
}
