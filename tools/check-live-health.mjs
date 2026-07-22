const baseUrl = normalizeBaseUrl(process.env.LIVE_HEALTH_BASE_URL || 'https://www.streetboardgame.com');
const timeoutMs = normalizeTimeout(process.env.LIVE_HEALTH_TIMEOUT_MS);
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), timeoutMs);

try {
  const startedAt = Date.now();
  const [healthResponse, liveResponse] = await Promise.all([
    fetch(`${baseUrl}/api/live/health`, { signal: controller.signal, headers: { accept: 'application/json' } }),
    fetch(`${baseUrl}/live`, { signal: controller.signal, headers: { accept: 'text/html' } }),
  ]);
  const health = await readJson(healthResponse);
  const csp = liveResponse.headers.get('content-security-policy') || '';
  const result = {
    ok: healthResponse.ok && health?.ok === true && liveResponse.ok
      && csp.includes("default-src 'none'") && csp.includes("'strict-dynamic'"),
    checkedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    health: { status: healthResponse.status, state: health?.state || 'invalid-response' },
    live: { status: liveResponse.status, csp: Boolean(csp) },
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    checkedAt: new Date().toISOString(),
    error: error?.name === 'AbortError' ? 'health-check-timeout' : 'health-check-failed',
  }, null, 2));
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}

function normalizeBaseUrl(value) {
  const url = new URL(String(value || ''));
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid-health-base-url');
  return url.origin;
}

function normalizeTimeout(value) {
  const timeout = Number(value);
  return Number.isFinite(timeout) ? Math.min(30_000, Math.max(1_000, Math.floor(timeout))) : 10_000;
}

async function readJson(response) {
  try { return await response.json(); } catch (error) { return null; }
}
