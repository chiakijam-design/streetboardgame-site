import { validShareAction } from './share-actions.js';
// Best effort count of share-button presses. Each button is counted at most once
// per page lifetime (and per result attempt); no outcome or identity is sent.
const delivered = new Set();
export function sendChallengeShareAction({ code, surface, action, participantToken = '', manageToken = '', attempt = 0 }) {
  if (!code || !validShareAction(surface, action)) return;
  const header = surface === 'result'
    ? ['x-challenge-participant-token', participantToken]
    : ['x-challenge-manage-token', manageToken];
  if (!header[1]) return;
  const key = `${surface}:${code}:${attempt}:${action}`;
  if (delivered.has(key)) return;
  delivered.add(key);
  void fetch(`/api/challenge/rooms/${code}/share-actions`, {
    method: 'POST', keepalive: true,
    headers: { 'content-type': 'application/json', [header[0]]: header[1] },
    body: JSON.stringify({ surface, action }),
  }).catch(() => {});
}
