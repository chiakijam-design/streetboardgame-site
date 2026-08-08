import { requireLiveAdminSession } from '../live/admin-auth.js';
import { recordLiveOpsEvent } from '../live/ops.js';
import { scanQuestionSafety } from './safety.js';
import { getQuestionTrendMetrics } from './trends.js';

const DAILY_QUESTION_LIMIT = 20;
const MAX_BATCH_SIZE = 10;
const REPORT_REASONS = new Set([
  'personal-information',
  'sexual-content',
  'bullying',
  'appearance-attack',
  'discrimination',
  'other',
]);
const REPORT_RATE_LIMIT = 5;
const REPORT_WINDOW_MS = 60 * 60 * 1000;
const schemaReadyByDatabase = new WeakMap();

export async function handleQuestionApi(request, env, path) {
  if (request.method === 'OPTIONS') return json({});
  if (!env.REMOTE_DB) return json({ error: 'question-storage-not-configured' }, 503);

  try {
    await ensureQuestionSchema(env);

    if (path === '/api/questions/catalog' && request.method === 'GET') {
      const [questions, selectionStats] = await Promise.all([
        publicCatalog(env),
        publicSelectionStats(env),
      ]);
      return json({ questions, selectionStats });
    }

    if (path === '/api/questions/trends' && request.method === 'GET') {
      const language = new URL(request.url).searchParams.get('lang') === 'en' ? 'en' : 'ja';
      return json(await getQuestionTrendMetrics(env, language));
    }

    if (path === '/api/questions/selection-session' && request.method === 'POST') {
      return await createSelectionSession(request, env);
    }

    if (path === '/api/questions/selection-events' && request.method === 'POST') {
      return await recordSelectionEvent(request, env);
    }

    if (path === '/api/questions/submissions' && request.method === 'POST') {
      return await createSubmissions(request, env);
    }

    const reportRoute = path.match(/^\/api\/questions\/catalog\/([A-Za-z0-9_-]{2,80})\/report$/);
    if (reportRoute && request.method === 'POST') {
      return await reportCatalogQuestion(request, env, reportRoute[1]);
    }

    if (path.startsWith('/api/questions/admin/')) {
      await requireLiveAdminSession(request, env, Date.now(), { mutation: request.method !== 'GET' });
    }

    if (path === '/api/questions/admin/overview' && request.method === 'GET') {
      return json(await adminOverview(env));
    }

    const reviewRoute = path.match(/^\/api\/questions\/admin\/submissions\/([a-f0-9-]{36})\/review$/i);
    if (reviewRoute && request.method === 'POST') {
      return await reviewSubmission(request, env, reviewRoute[1]);
    }

    const catalogRoute = path.match(/^\/api\/questions\/admin\/catalog\/([A-Za-z0-9_-]{2,80})$/);
    if (catalogRoute && request.method === 'PUT') {
      return await saveCatalogQuestion(request, env, catalogRoute[1]);
    }

    const reporterRestrictionRoute = path.match(/^\/api\/questions\/admin\/reporters\/([a-f0-9]{64})\/(restrict|restore)$/i);
    if (reporterRestrictionRoute && request.method === 'POST') {
      return await updateReporterRestriction(request, env, reporterRestrictionRoute[1], reporterRestrictionRoute[2]);
    }

    return json({ error: 'not-found' }, 404);
  } catch (error) {
    const status = Number(error?.status) || 500;
    const traceId = crypto.randomUUID();
    if (status >= 500) {
      await recordLiveOpsEvent(env, {
        category: 'application', severity: 'critical', eventType: 'question-api-error',
        message: error?.message || 'question-api-error',
        metadata: { path, method: request.method, status, traceId },
      }).catch(() => {});
      return json({ error: 'internal-error', traceId }, status);
    }
    return json({ error: error?.message || 'question-api-error', ...(error?.details || {}) }, status);
  }
}

async function createSubmissions(request, env) {
  const body = await readJson(request);
  if (body.consent !== true) throw apiError('question-submission-consent-required', 400);
  const sourceMode = normalizeSourceMode(body.sourceMode);
  const questions = Array.isArray(body.questions) ? body.questions.slice(0, MAX_BATCH_SIZE).map(sanitizeQuestion) : [];
  if (!questions.length) throw apiError('question-submission-empty', 400);
  const safetyResults = questions.map(scanQuestionSafety);
  const personalInfoFlags = [...new Set(safetyResults.flatMap((result) => result.personalInfoFlags))];
  if (personalInfoFlags.length) {
    throw apiError('question-personal-information-detected', 400, { flags: personalInfoFlags });
  }

  const ipHash = await requestIpHash(request);
  await consumeDailyLimit(env, ipHash, questions.length);
  const now = Date.now();
  const submissions = questions.map((question) => ({
    submissionId: crypto.randomUUID(),
    ...question,
  }));
  const statements = [];
  submissions.forEach((submission, index) => {
    statements.push(env.REMOTE_DB.prepare(`
      INSERT INTO question_submissions
        (submission_id, source_mode, source_question_id, title, choices_json, status, submitted_at, ip_hash)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `).bind(
      submission.submissionId,
      sourceMode,
      submission.sourceQuestionId,
      submission.title,
      JSON.stringify(submission.choices),
      now,
      ipHash,
    ));
    const flags = safetyResults[index].moderationFlags;
    if (flags.length) {
      statements.push(env.REMOTE_DB.prepare(`
        INSERT INTO question_submission_flags (submission_id, flags_json, created_at)
        VALUES (?, ?, ?)
      `).bind(submission.submissionId, JSON.stringify(flags), now));
    }
  });
  await env.REMOTE_DB.batch(statements);
  return json({ submitted: submissions.length, submissionIds: submissions.map((item) => item.submissionId) }, 201);
}

async function publicCatalog(env) {
  const result = await env.REMOTE_DB.prepare(`
    SELECT question_id, source_kind, source_ref, title, category, choices_json,
      status, use_challenge, use_live, updated_at
    FROM question_catalog
    WHERE status = 'approved' OR source_kind = 'static'
    ORDER BY updated_at DESC
  `).all();
  return (result?.results || []).map(mapCatalogRow);
}

async function publicSelectionStats(env) {
  const result = await env.REMOTE_DB.prepare(`
    SELECT question_id, mode, shown_count, skip_count
    FROM question_selection_stats
    WHERE shown_count > 0 OR skip_count > 0
  `).all();
  return (result?.results || []).map(mapSelectionStatsRow);
}

async function recordSelectionEvent(request, env) {
  const body = await readJson(request);
  const selectionSession = await verifySelectionSession(body.sessionToken, env);
  const questionId = sanitizeShortText(body.questionId, 80);
  if (!/^[A-Za-z0-9_-]{2,80}$/.test(questionId)) {
    throw apiError('question-selection-id-invalid', 400);
  }
  const mode = body.mode === 'live' ? 'live' : body.mode === 'challenge' ? 'challenge' : '';
  if (!mode) throw apiError('question-selection-mode-invalid', 400);
  const event = body.event === 'shown' ? 'shown' : body.event === 'skipped' ? 'skipped' : '';
  if (!event) throw apiError('question-selection-event-invalid', 400);
  const now = Date.now();
  const ipHash = await requestIpHash(request);
  if (selectionSession.ipHash !== ipHash) throw apiError('question-selection-session-invalid', 403);
  const recentIpCount = await env.REMOTE_DB.prepare(`
    SELECT COUNT(*) AS count FROM question_selection_events
    WHERE ip_hash = ? AND created_at > ?
  `).bind(ipHash, now - REPORT_WINDOW_MS).first();
  const recentDeviceCount = await env.REMOTE_DB.prepare(`
    SELECT COUNT(*) AS count FROM question_selection_events
    WHERE device_hash = ? AND created_at > ?
  `).bind(selectionSession.deviceHash, now - REPORT_WINDOW_MS).first();
  if (Number(recentIpCount?.count || 0) >= 1200 || Number(recentDeviceCount?.count || 0) >= 600) {
    await recordLiveOpsEvent(env, {
      category: 'security', severity: 'warning', eventType: 'question-selection-rate-limited',
      message: '大量の問題選択イベントを制限しました。',
      metadata: { ipHash, deviceHash: selectionSession.deviceHash },
    }).catch(() => {});
    throw apiError('question-selection-rate-limited', 429);
  }
  const eventKey = await sha256Hex([
    selectionSession.sessionId, selectionSession.deviceHash, questionId, mode, event,
  ].join(':'));
  const inserted = await env.REMOTE_DB.prepare(`
    INSERT OR IGNORE INTO question_selection_events
      (event_key, session_id, device_hash, ip_hash, question_id, mode, event, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(eventKey, selectionSession.sessionId, selectionSession.deviceHash, ipHash,
    questionId, mode, event, now).run();
  if (Number(inserted?.meta?.changes || 0) !== 1) return json({ recorded: false, duplicate: true });
  const shownIncrement = event === 'shown' ? 1 : 0;
  const skipIncrement = event === 'skipped' ? 1 : 0;
  await env.REMOTE_DB.prepare(`
    INSERT INTO question_selection_stats
      (question_id, mode, shown_count, skip_count, last_shown_at, last_skipped_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(question_id, mode) DO UPDATE SET
      shown_count = shown_count + excluded.shown_count,
      skip_count = skip_count + excluded.skip_count,
      last_shown_at = CASE
        WHEN excluded.last_shown_at IS NULL THEN last_shown_at ELSE excluded.last_shown_at END,
      last_skipped_at = CASE
        WHEN excluded.last_skipped_at IS NULL THEN last_skipped_at ELSE excluded.last_skipped_at END
  `).bind(
    questionId,
    mode,
    shownIncrement,
    skipIncrement,
    event === 'shown' ? now : null,
    event === 'skipped' ? now : null,
  ).run();
  return json({ recorded: true });
}

async function createSelectionSession(request, env) {
  const body = await readJson(request);
  const rawDeviceId = sanitizeShortText(body.deviceId, 120);
  if (!/^[A-Za-z0-9_-]{16,120}$/.test(rawDeviceId)) {
    throw apiError('question-selection-device-invalid', 400);
  }
  const now = Date.now();
  const ipHash = await requestIpHash(request);
  const deviceHash = await sha256Hex(`question-device:${rawDeviceId}`);
  const payload = {
    version: 1,
    sessionId: crypto.randomUUID(),
    deviceHash,
    ipHash,
    expiresAt: now + 2 * 60 * 60 * 1000,
  };
  const encoded = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await signSelectionPayload(encoded, env);
  return json({ sessionToken: `${encoded}.${signature}`, expiresAt: payload.expiresAt }, 201);
}

async function verifySelectionSession(value, env, now = Date.now()) {
  const [payload, signature, extra] = String(value || '').split('.');
  if (!payload || !signature || extra) throw apiError('question-selection-session-required', 401);
  const expected = await signSelectionPayload(payload, env);
  if (!constantTimeEqual(signature, expected)) throw apiError('question-selection-session-invalid', 403);
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
  } catch (error) {
    throw apiError('question-selection-session-invalid', 403);
  }
  if (parsed?.version !== 1 || !/^[a-f0-9-]{36}$/i.test(String(parsed.sessionId || ''))
    || !/^[a-f0-9]{64}$/i.test(String(parsed.deviceHash || ''))
    || !/^[a-f0-9]{64}$/i.test(String(parsed.ipHash || ''))
    || Number(parsed.expiresAt) <= now || Number(parsed.expiresAt) > now + 2 * 60 * 60 * 1000) {
    throw apiError('question-selection-session-expired', 401);
  }
  return parsed;
}

async function signSelectionPayload(payload, env) {
  const secret = String(env?.QUESTION_EVENT_SIGNING_SECRET || env?.LIVE_ADMIN_SESSION_SECRET || '');
  if (secret.length < 32) throw apiError('question-selection-signing-not-configured', 503);
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return encodeBase64Url(new Uint8Array(signature));
}

async function adminOverview(env) {
  const [catalogResult, submissionResult, selectionStatsResult] = await Promise.all([
    env.REMOTE_DB.prepare(`
      SELECT q.question_id, q.source_kind, q.source_ref, q.title, q.category, q.choices_json, q.status,
        q.use_challenge, q.use_live, q.created_at, q.updated_at,
        q.quarantined_at, q.quarantine_reason, q.previous_status,
        (SELECT COUNT(*) FROM question_reports r WHERE r.question_id = q.question_id) AS report_count,
        (SELECT MAX(reported_at) FROM question_reports r WHERE r.question_id = q.question_id) AS last_reported_at
      FROM question_catalog q
      ORDER BY q.updated_at DESC
      LIMIT 1000
    `).all(),
    env.REMOTE_DB.prepare(`
      SELECT s.submission_id, s.source_mode, s.source_question_id, s.title, s.choices_json, s.status,
        s.submitted_at, s.reviewed_at, s.review_note, s.catalog_id, f.flags_json
      FROM question_submissions s
      LEFT JOIN question_submission_flags f ON f.submission_id = s.submission_id
      ORDER BY CASE s.status WHEN 'pending' THEN 0 ELSE 1 END, s.submitted_at DESC
      LIMIT 500
    `).all(),
    env.REMOTE_DB.prepare(`
      SELECT question_id, mode, shown_count, skip_count
      FROM question_selection_stats
      WHERE shown_count > 0 OR skip_count > 0
    `).all(),
  ]);
  return {
    catalog: (catalogResult?.results || []).map(mapCatalogRow),
    submissions: (submissionResult?.results || []).map(mapSubmissionRow),
    selectionStats: (selectionStatsResult?.results || []).map(mapSelectionStatsRow),
    reports: await listQuestionReports(env),
  };
}

async function reportCatalogQuestion(request, env, questionId) {
  const body = await readJson(request);
  const reason = REPORT_REASONS.has(body.reason) ? body.reason : '';
  if (!reason) throw apiError('question-report-reason-required', 400);
  const current = await env.REMOTE_DB.prepare(`
    SELECT question_id, source_kind, status
    FROM question_catalog
    WHERE question_id = ?
  `).bind(questionId).first();
  if (!current || current.source_kind !== 'custom') {
    throw apiError('question-report-not-available', 404);
  }

  const now = Date.now();
  const ipHash = await requestIpHash(request);
  const rawDeviceId = sanitizeShortText(body.deviceId, 120);
  const reporterHash = rawDeviceId
    ? await sha256Hex(`question-reporter:${rawDeviceId}`)
    : ipHash;
  await assertReporterAllowed(env, reporterHash, now);
  await consumeReportRateLimit(env, ipHash, now);
  const insert = await env.REMOTE_DB.prepare(`
    INSERT OR IGNORE INTO question_reports
      (report_id, question_id, reason, detail, reported_at, ip_hash)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(), questionId, reason, sanitizeShortText(body.detail, 300), now, reporterHash,
  ).run();
  const duplicate = Number(insert?.meta?.changes || 0) !== 1;
  const counts = await env.REMOTE_DB.prepare(`
    SELECT COUNT(DISTINCT ip_hash) AS report_count,
      SUM(CASE WHEN reason IN ('personal-information','sexual-content','bullying','discrimination') THEN 1 ELSE 0 END) AS serious_count
    FROM question_reports WHERE question_id = ?
  `).bind(questionId).first();
  const reportCount = Number(counts?.report_count || 0);
  const seriousCount = Number(counts?.serious_count || 0);
  const quarantine = seriousCount >= 1 || reportCount >= 2;
  if (quarantine && current.status !== 'quarantined') {
    await env.REMOTE_DB.prepare(`
      UPDATE question_catalog
      SET previous_status = CASE WHEN status = 'quarantined' THEN previous_status ELSE status END,
        status = 'quarantined', use_challenge = 0, use_live = 0,
        quarantined_at = ?, quarantine_reason = ?, updated_at = ?
      WHERE question_id = ? AND source_kind = 'custom'
    `).bind(now, reason, now, questionId).run();
    await recordLiveOpsEvent(env, {
      category: 'moderation', severity: seriousCount ? 'critical' : 'warning',
      eventType: 'question-auto-quarantined', code: questionId,
      message: '通報しきい値に達した問題を一時隔離しました。',
      metadata: { questionId, reason, reportCount, seriousCount },
    }).catch(() => {});
  }
  return json({ questionId, duplicate, reportCount, quarantined: quarantine });
}

async function listQuestionReports(env) {
  const result = await env.REMOTE_DB.prepare(`
    SELECT r.report_id, r.question_id, r.reason, r.detail, r.reported_at, r.ip_hash,
      CASE WHEN x.reporter_hash IS NULL OR x.revoked_at IS NOT NULL
        OR (x.expires_at IS NOT NULL AND x.expires_at <= ?) THEN 0 ELSE 1 END AS reporter_restricted
    FROM question_reports r
    LEFT JOIN question_reporter_restrictions x ON x.reporter_hash = r.ip_hash
    ORDER BY r.reported_at DESC
    LIMIT 500
  `).bind(Date.now()).all();
  return (result?.results || []).map((row) => ({
    id: row.report_id,
    questionId: row.question_id,
    reason: row.reason,
    detail: row.detail || '',
    reportedAt: Number(row.reported_at),
    reporterHash: row.ip_hash,
    reporterRestricted: Boolean(row.reporter_restricted),
  }));
}

async function updateReporterRestriction(request, env, reporterHash, action) {
  const body = await readJson(request);
  const now = Date.now();
  if (action === 'restore') {
    await env.REMOTE_DB.prepare(`
      UPDATE question_reporter_restrictions SET revoked_at = ? WHERE reporter_hash = ?
    `).bind(now, reporterHash).run();
    return json({ reporterHash, restricted: false });
  }
  const expiresAt = body.permanent === true ? null : now + 30 * 24 * 60 * 60 * 1000;
  await env.REMOTE_DB.prepare(`
    INSERT INTO question_reporter_restrictions
      (reporter_hash, reason, created_at, expires_at, revoked_at)
    VALUES (?, ?, ?, ?, NULL)
    ON CONFLICT(reporter_hash) DO UPDATE SET reason = excluded.reason,
      created_at = excluded.created_at, expires_at = excluded.expires_at, revoked_at = NULL
  `).bind(reporterHash, sanitizeShortText(body.reason, 180), now, expiresAt).run();
  return json({ reporterHash, restricted: true, expiresAt });
}

async function assertReporterAllowed(env, reporterHash, now) {
  const row = await env.REMOTE_DB.prepare(`
    SELECT reporter_hash FROM question_reporter_restrictions
    WHERE reporter_hash = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)
    LIMIT 1
  `).bind(reporterHash, now).first();
  if (row) throw apiError('question-reporter-restricted', 403);
}

async function consumeReportRateLimit(env, reporterHash, now) {
  const windowStart = Math.floor(now / REPORT_WINDOW_MS) * REPORT_WINDOW_MS;
  const rateKey = `${windowStart}:${reporterHash}`;
  await env.REMOTE_DB.prepare('DELETE FROM question_report_rate_limits WHERE expires_at <= ?').bind(now).run();
  const row = await env.REMOTE_DB.prepare(`
    SELECT report_count FROM question_report_rate_limits WHERE rate_key = ?
  `).bind(rateKey).first();
  if (Number(row?.report_count || 0) >= REPORT_RATE_LIMIT) {
    await recordLiveOpsEvent(env, {
      category: 'security', severity: 'warning', eventType: 'question-report-rate-limited',
      message: '同一送信元からの大量通報を制限しました。', metadata: { reporterHash },
    }).catch(() => {});
    throw apiError('question-report-rate-limited', 429);
  }
  await env.REMOTE_DB.prepare(`
    INSERT INTO question_report_rate_limits (rate_key, window_start, report_count, expires_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(rate_key) DO UPDATE SET report_count = report_count + 1
  `).bind(rateKey, windowStart, windowStart + REPORT_WINDOW_MS).run();
}

async function reviewSubmission(request, env, submissionId) {
  const body = await readJson(request);
  const decision = body.decision === 'approved' ? 'approved' : body.decision === 'rejected' ? 'rejected' : '';
  if (!decision) throw apiError('review-decision-invalid', 400);
  const current = await env.REMOTE_DB.prepare(`
    SELECT submission_id, source_mode, source_question_id, title, choices_json, status
    FROM question_submissions WHERE submission_id = ?
  `).bind(submissionId).first();
  if (!current) throw apiError('submission-not-found', 404);
  if (current.status !== 'pending') throw apiError('submission-already-reviewed', 409);

  const now = Date.now();
  const reviewNote = sanitizeShortText(body.reviewNote, 300);
  let catalogId = null;
  if (decision === 'approved') {
    const question = sanitizeQuestion({
      title: body.title || current.title,
      choices: body.choices || JSON.parse(current.choices_json),
      sourceQuestionId: current.source_question_id,
    });
    const isEnglishSubmission = String(current.source_mode || '').endsWith('-en');
    catalogId = `${isEnglishSubmission ? 'CUSEN' : 'CUS'}${crypto.randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`;
    await env.REMOTE_DB.prepare(`
      INSERT INTO question_catalog
        (question_id, source_kind, source_ref, title, category, choices_json, status,
          use_challenge, use_live, created_at, updated_at)
      VALUES (?, 'custom', ?, ?, ?, ?, 'approved', ?, ?, ?, ?)
    `).bind(
      catalogId,
      question.sourceQuestionId,
      question.title,
      sanitizeShortText(body.category, 60) || (isEnglishSubmission ? 'Community questions' : 'みんなのお題'),
      JSON.stringify(question.choices),
      1,
      1,
      now,
      now,
    ).run();
  }

  await env.REMOTE_DB.prepare(`
    UPDATE question_submissions
    SET status = ?, reviewed_at = ?, review_note = ?, catalog_id = ?
    WHERE submission_id = ?
  `).bind(decision, now, reviewNote, catalogId, submissionId).run();
  return json({ submissionId, status: decision, catalogId });
}

async function saveCatalogQuestion(request, env, questionId) {
  const body = await readJson(request);
  const question = sanitizeQuestion(body);
  const sourceKind = body.sourceKind === 'custom'
    ? 'custom'
    : body.sourceKind === 'candidate'
      ? 'candidate'
      : 'static';
  const sourceRef = sanitizeShortText(body.sourceRef, 80) || questionId;
  const status = normalizeCatalogStatus(body.status);
  const now = Date.now();
  await env.REMOTE_DB.prepare(`
    INSERT INTO question_catalog
      (question_id, source_kind, source_ref, title, category, choices_json, status,
        use_challenge, use_live, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(question_id) DO UPDATE SET
      source_kind = excluded.source_kind,
      source_ref = excluded.source_ref,
      title = excluded.title,
      category = excluded.category,
      choices_json = excluded.choices_json,
      status = excluded.status,
      use_challenge = excluded.use_challenge,
      use_live = excluded.use_live,
      quarantined_at = CASE WHEN excluded.status = 'quarantined' THEN question_catalog.quarantined_at ELSE NULL END,
      quarantine_reason = CASE WHEN excluded.status = 'quarantined' THEN question_catalog.quarantine_reason ELSE '' END,
      previous_status = CASE WHEN excluded.status = 'quarantined' THEN question_catalog.previous_status ELSE '' END,
      updated_at = excluded.updated_at
  `).bind(
    questionId,
    sourceKind,
    sourceRef,
    question.title,
    sanitizeShortText(body.category, 60) || 'みんなのお題',
    JSON.stringify(question.choices),
    status,
    status === 'approved' ? 1 : 0,
    status === 'approved' ? 1 : 0,
    now,
    now,
  ).run();
  const row = await env.REMOTE_DB.prepare(`
    SELECT question_id, source_kind, source_ref, title, category, choices_json, status,
      use_challenge, use_live, created_at, updated_at
    FROM question_catalog WHERE question_id = ?
  `).bind(questionId).first();
  return json({ question: mapCatalogRow(row) });
}

async function consumeDailyLimit(env, ipHash, increment) {
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const rateKey = `${day}:${ipHash}`;
  const expiresAt = now + 2 * 24 * 60 * 60 * 1000;
  await env.REMOTE_DB.prepare('DELETE FROM question_submission_limits WHERE expires_at <= ?').bind(now).run();
  const row = await env.REMOTE_DB.prepare(
    'SELECT question_count FROM question_submission_limits WHERE rate_key = ?',
  ).bind(rateKey).first();
  if (Number(row?.question_count || 0) + increment > DAILY_QUESTION_LIMIT) {
    throw apiError('question-submission-rate-limited', 429);
  }
  await env.REMOTE_DB.prepare(`
    INSERT INTO question_submission_limits (rate_key, question_count, expires_at)
    VALUES (?, ?, ?)
    ON CONFLICT(rate_key) DO UPDATE SET
      question_count = question_submission_limits.question_count + excluded.question_count,
      expires_at = excluded.expires_at
  `).bind(rateKey, increment, expiresAt).run();
}

function sanitizeQuestion(value) {
  const title = sanitizeShortText(value?.title || value?.text, 180);
  const choices = Array.isArray(value?.choices || value?.options)
    ? (value.choices || value.options).map((choice) => sanitizeShortText(choice, 60))
    : [];
  if (!title || choices.length !== 5 || choices.some((choice) => !choice)) {
    throw apiError('question-invalid', 400);
  }
  return {
    title,
    choices,
    sourceQuestionId: sanitizeShortText(value?.sourceQuestionId || value?.sourceId, 80) || null,
  };
}

function normalizeSourceMode(value) {
  if (value === 'challenge' || value === 'live-challenge'
    || value === 'challenge-en' || value === 'live-challenge-en') return value;
  throw apiError('question-source-mode-invalid', 400);
}

function normalizeCatalogStatus(value) {
  if (value === 'held' || value === 'disabled' || value === 'quarantined') return value;
  return 'approved';
}

function sanitizeShortText(value, maxLength) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function mapCatalogRow(row) {
  return {
    id: row.question_id,
    sourceKind: row.source_kind,
    sourceRef: row.source_ref || null,
    title: row.title,
    category: row.category,
    choices: parseChoices(row.choices_json),
    status: row.status || 'approved',
    useChallenge: (row.status || 'approved') === 'approved',
    useLive: (row.status || 'approved') === 'approved',
    createdAt: row.created_at == null ? null : Number(row.created_at),
    updatedAt: Number(row.updated_at || 0),
    reportCount: Number(row.report_count || 0),
    lastReportedAt: row.last_reported_at == null ? null : Number(row.last_reported_at),
    quarantinedAt: row.quarantined_at == null ? null : Number(row.quarantined_at),
    quarantineReason: row.quarantine_reason || '',
    previousStatus: row.previous_status || '',
    language: String(row.question_id || '').startsWith('CUSEN') ? 'en' : 'ja',
  };
}

function mapSelectionStatsRow(row) {
  return {
    questionId: row.question_id,
    mode: row.mode,
    shownCount: Math.max(0, Number(row.shown_count) || 0),
    skipCount: Math.max(0, Number(row.skip_count) || 0),
  };
}

function mapSubmissionRow(row) {
  return {
    id: row.submission_id,
    sourceMode: row.source_mode,
    language: String(row.source_mode || '').endsWith('-en') ? 'en' : 'ja',
    sourceQuestionId: row.source_question_id || null,
    title: row.title,
    choices: parseChoices(row.choices_json),
    status: row.status,
    submittedAt: Number(row.submitted_at),
    reviewedAt: row.reviewed_at == null ? null : Number(row.reviewed_at),
    reviewNote: row.review_note || '',
    catalogId: row.catalog_id || null,
    safetyFlags: parseStringArray(row.flags_json),
  };
}

function parseChoices(value) {
  try {
    const choices = JSON.parse(value);
    return Array.isArray(choices) ? choices : [];
  } catch (error) {
    return [];
  }
}

function parseStringArray(value) {
  try {
    const values = JSON.parse(value || '[]');
    return Array.isArray(values) ? values.filter((item) => typeof item === 'string') : [];
  } catch (error) {
    return [];
  }
}

async function requestIpHash(request) {
  const ip = String(request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown')
    .split(',')[0].trim();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`question-submit:${ip}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function ensureQuestionSchema(env) {
  let schemaReadyPromise = schemaReadyByDatabase.get(env.REMOTE_DB);
  if (!schemaReadyPromise) {
    schemaReadyPromise = env.REMOTE_DB.batch([
      env.REMOTE_DB.prepare(`CREATE TABLE IF NOT EXISTS question_catalog (
        question_id TEXT PRIMARY KEY, source_kind TEXT NOT NULL, source_ref TEXT, title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'みんなのお題', choices_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'approved', use_challenge INTEGER NOT NULL DEFAULT 0,
        use_live INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      )`),
      env.REMOTE_DB.prepare(`CREATE TABLE IF NOT EXISTS question_submissions (
        submission_id TEXT PRIMARY KEY, source_mode TEXT NOT NULL, source_question_id TEXT,
        title TEXT NOT NULL, choices_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
        submitted_at INTEGER NOT NULL, reviewed_at INTEGER, review_note TEXT, catalog_id TEXT,
        ip_hash TEXT NOT NULL
      )`),
      env.REMOTE_DB.prepare(`CREATE TABLE IF NOT EXISTS question_submission_limits (
        rate_key TEXT PRIMARY KEY, question_count INTEGER NOT NULL, expires_at INTEGER NOT NULL
      )`),
      env.REMOTE_DB.prepare(`CREATE TABLE IF NOT EXISTS question_submission_flags (
        submission_id TEXT PRIMARY KEY, flags_json TEXT NOT NULL, created_at INTEGER NOT NULL
      )`),
      env.REMOTE_DB.prepare(`CREATE TABLE IF NOT EXISTS question_reports (
        report_id TEXT PRIMARY KEY, question_id TEXT NOT NULL, reason TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '', reported_at INTEGER NOT NULL, ip_hash TEXT NOT NULL,
        UNIQUE (question_id, ip_hash)
      )`),
      env.REMOTE_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_question_reports_question
        ON question_reports (question_id, reported_at)`),
      env.REMOTE_DB.prepare(`CREATE TABLE IF NOT EXISTS question_selection_stats (
        question_id TEXT NOT NULL, mode TEXT NOT NULL,
        shown_count INTEGER NOT NULL DEFAULT 0, skip_count INTEGER NOT NULL DEFAULT 0,
        last_shown_at INTEGER, last_skipped_at INTEGER,
        PRIMARY KEY (question_id, mode)
      )`),
      env.REMOTE_DB.prepare(`CREATE TABLE IF NOT EXISTS question_report_rate_limits (
        rate_key TEXT PRIMARY KEY, window_start INTEGER NOT NULL,
        report_count INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL
      )`),
      env.REMOTE_DB.prepare(`CREATE TABLE IF NOT EXISTS question_reporter_restrictions (
        reporter_hash TEXT PRIMARY KEY, reason TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
        expires_at INTEGER, revoked_at INTEGER
      )`),
      env.REMOTE_DB.prepare(`CREATE TABLE IF NOT EXISTS question_selection_events (
        event_key TEXT PRIMARY KEY, session_id TEXT NOT NULL, device_hash TEXT NOT NULL,
        ip_hash TEXT NOT NULL, question_id TEXT NOT NULL, mode TEXT NOT NULL,
        event TEXT NOT NULL, created_at INTEGER NOT NULL
      )`),
    ]).catch((error) => {
      schemaReadyByDatabase.delete(env.REMOTE_DB);
      throw error;
    });
    schemaReadyPromise = schemaReadyPromise.then(async () => {
      const columns = await env.REMOTE_DB.prepare('PRAGMA table_info(question_catalog)').all();
      const names = new Set((columns?.results || []).map((column) => column.name));
      const additions = [];
      if (!names.has('quarantined_at')) additions.push('ALTER TABLE question_catalog ADD COLUMN quarantined_at INTEGER');
      if (!names.has('quarantine_reason')) additions.push("ALTER TABLE question_catalog ADD COLUMN quarantine_reason TEXT NOT NULL DEFAULT ''");
      if (!names.has('previous_status')) additions.push("ALTER TABLE question_catalog ADD COLUMN previous_status TEXT NOT NULL DEFAULT ''");
      for (const sql of additions) await env.REMOTE_DB.prepare(sql).run();
    });
    schemaReadyByDatabase.set(env.REMOTE_DB, schemaReadyPromise);
  }
  return schemaReadyPromise;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function encodeBase64Url(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value) {
  const base64 = String(value || '').replace(/-/g, '+').replace(/_/g, '/')
    .padEnd(Math.ceil(String(value || '').length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function constantTimeEqual(left, right) {
  const leftBytes = new TextEncoder().encode(String(left || ''));
  const rightBytes = new TextEncoder().encode(String(right || ''));
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < Math.max(leftBytes.length, rightBytes.length); index += 1) {
    difference |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }
  return difference === 0;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (error) {
    return {};
  }
}

function apiError(message, status, details = null) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store',
    },
  });
}
