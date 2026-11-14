// JST calendar day used by the daily play counters (LIVE realtime counters removed 2026-11-15).
export function playDayJst(now) {
  return new Date(Number(now) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
