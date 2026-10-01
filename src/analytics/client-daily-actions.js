// Best effort browser telemetry, not unique people or a purchase signal.
// One event/action/result attempt per page lifetime. No identity in D1 totals.
const delivered = new Set();
export function sendChallengeDailyAction(code, token, attempt, metric) {
  if (!code || !token) return;
  const key = `${code}:${attempt}:${metric}`;
  if (delivered.has(key)) return;
  delivered.add(key);
  void fetch(`/api/challenge/rooms/${code}/actions`, {
    method: 'POST', keepalive: true,
    headers: { 'content-type': 'application/json', 'x-challenge-participant-token': token },
    body: JSON.stringify({ metric }),
  }).catch(() => {});
}
