// Operator sign-in (/api/questions/admin/session, behind the same Cloudflare Access
// policy as /question-ops) and the CSP report sink (moved out of the
// removed LIVE API, 2026-11-15).
import { createAdminSession, getAdminSession, requireAdminSession, revokeAdminSession } from './auth.js';
import { enforceChallengeRateLimit } from '../challenge/rate-limit.js';
import { recordOpsEvent } from '../ops/events.js';

const JSON_HEADERS = Object.freeze({
  'content-type': 'application/json; charset=UTF-8',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow, noarchive',
});

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extra } });
}

function clean(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max);
}

export async function handleAdminApi(request, env, path) {
  const identity = request.headers.get('CF-Connecting-IP') || 'unknown';
  try {
    if (path === '/api/security/csp-report' && request.method === 'POST') {
      await enforceChallengeRateLimit(env, identity, 'csp-report', 30);
      let report = {};
      try { report = JSON.parse((await request.text()).slice(0, 12_000) || '{}'); } catch { report = { invalid: true }; }
      const payload = report['csp-report'] || report.body || report;
      await recordOpsEvent(env, {
        category: 'security', severity: 'warning', eventType: 'csp-violation',
        message: 'Content Security Policy violation',
        metadata: {
          documentUri: clean(payload?.['document-uri'] || payload?.documentURL, 300),
          violatedDirective: clean(payload?.['violated-directive'] || payload?.effectiveDirective, 120),
          blockedUri: clean(payload?.['blocked-uri'] || payload?.blockedURL, 300),
        },
      });
      return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
    }
    if (path === '/api/questions/admin/session' && request.method === 'POST') {
      await enforceChallengeRateLimit(env, identity, 'admin-auth', 10);
      const session = await createAdminSession(request, env);
      return json({ csrfToken: session.csrfToken, expiresAt: session.expiresAt, trusted: session.trusted }, 200, { 'set-cookie': session.cookie });
    }
    if (path === '/api/questions/admin/session' && request.method === 'GET') {
      return json(await getAdminSession(request, env));
    }
    if ((path === '/api/questions/admin/session/logout' || path === '/api/questions/admin/session/logout-all') && request.method === 'POST') {
      await requireAdminSession(request, env, Date.now(), { mutation: true });
      const all = path.endsWith('logout-all');
      const result = await revokeAdminSession(request, env, { all });
      return json({ revoked: result.revoked, ...(all ? { all: true } : {}) }, 200, { 'set-cookie': result.cookie });
    }
    return json({ error: 'not-found' }, 404);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error(JSON.stringify({ adminApiError: clean(error?.message || error, 200) }));
    if (path === '/api/questions/admin/session' && request.method === 'POST' && [401, 403, 429].includes(status)) {
      await recordOpsEvent(env, { category: 'security', severity: 'warning', eventType: 'admin-login-failed', message: 'Operator sign-in failed', metadata: { status } });
    }
    const response = json({ error: status >= 500 ? 'internal-error' : (error?.message || 'error') }, status);
    if (error?.retryAfter) response.headers.set('retry-after', String(error.retryAfter));
    return response;
  }
}
