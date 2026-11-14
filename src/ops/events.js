// Operational events (errors, security signals). Since LIVE and its operations
// console were removed (2026-11-15) these go to Workers Logs only, not to D1.
const MAX_TEXT = 500;

export async function recordOpsEvent(env, input = {}) {
  const event = {
    at: new Date().toISOString(),
    category: String(input.category || 'application').slice(0, 40),
    severity: String(input.severity || 'info').slice(0, 20),
    eventType: String(input.eventType || 'event').slice(0, 80),
    message: String(input.message || '').slice(0, MAX_TEXT),
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
  };
  const line = JSON.stringify({ opsEvent: event }).slice(0, 4000);
  if (event.severity === 'critical' || event.severity === 'error') console.error(line);
  else console.warn(line);
  return event;
}
