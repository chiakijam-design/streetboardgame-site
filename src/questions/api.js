import { requireLiveAdminSession } from '../live/admin-auth.js';
import { scanQuestionSafety } from './safety.js';

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
let schemaReadyPromise = null;

export async function handleQuestionApi(request, env, path) {
  if (request.method === 'OPTIONS') return json({});
  if (!env.REMOTE_DB) return json({ error: 'question-storage-not-configured' }, 503);

  try {
    await ensureQuestionSchema(env);

    if (path === '/api/questions/catalog' && request.method === 'GET') {
      return json({ questions: await publicCatalog(env) });
    }

    if (path === '/api/questions/submissions' && request.method === 'POST') {
      return await createSubmissions(request, env);
    }

    const reportRoute = path.match(/^\/api\/questions\/catalog\/([A-Za-z0-9_-]{2,80})\/report$/);
    if (reportRoute && request.method === 'POST') {
      return await reportCatalogQuestion(request, env, reportRoute[1]);
    }

    if (path.startsWith('/api/questions/admin/')) {
      await requireLiveAdminSession(request, env);
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

    return json({ error: 'not-found' }, 404);
  } catch (error) {
    return json({
      error: error?.message || 'question-api-error',
      ...(error?.details || {}),
    }, Number(error?.status) || 500);
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
      status, use_challenge, use_live, target_friend, target_family, updated_at
    FROM question_catalog
    WHERE status = 'approved' OR source_kind = 'static'
    ORDER BY updated_at DESC
  `).all();
  return (result?.results || []).map(mapCatalogRow);
}

async function adminOverview(env) {
  const [catalogResult, submissionResult] = await Promise.all([
    env.REMOTE_DB.prepare(`
      SELECT q.question_id, q.source_kind, q.source_ref, q.title, q.category, q.choices_json, q.status,
        q.use_challenge, q.use_live, q.target_friend, q.target_family, q.created_at, q.updated_at,
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
  ]);
  return {
    catalog: (catalogResult?.results || []).map(mapCatalogRow),
    submissions: (submissionResult?.results || []).map(mapSubmissionRow),
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
  await env.REMOTE_DB.batch([
    env.REMOTE_DB.prepare(`
      INSERT OR IGNORE INTO question_reports
        (report_id, question_id, reason, detail, reported_at, ip_hash)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      questionId,
      reason,
      sanitizeShortText(body.detail, 300),
      now,
      ipHash,
    ),
    env.REMOTE_DB.prepare(`
      UPDATE question_catalog
      SET status = 'disabled', use_challenge = 0, use_live = 0, updated_at = ?
      WHERE question_id = ? AND source_kind = 'custom'
    `).bind(now, questionId),
  ]);
  return json({ questionId, hidden: true });
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
          use_challenge, use_live, target_friend, target_family, created_at, updated_at)
      VALUES (?, 'custom', ?, ?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?)
    `).bind(
      catalogId,
      question.sourceQuestionId,
      question.title,
      sanitizeShortText(body.category, 60) || (isEnglishSubmission ? 'Community questions' : 'みんなのお題'),
      JSON.stringify(question.choices),
      1,
      1,
      0,
      0,
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
  const sourceKind = body.sourceKind === 'custom' ? 'custom' : 'static';
  const sourceRef = sanitizeShortText(body.sourceRef, 80) || questionId;
  const status = body.status === 'disabled' ? 'disabled' : 'approved';
  const now = Date.now();
  await env.REMOTE_DB.prepare(`
    INSERT INTO question_catalog
      (question_id, source_kind, source_ref, title, category, choices_json, status,
        use_challenge, use_live, target_friend, target_family, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(question_id) DO UPDATE SET
      source_kind = excluded.source_kind,
      source_ref = excluded.source_ref,
      title = excluded.title,
      category = excluded.category,
      choices_json = excluded.choices_json,
      status = excluded.status,
      use_challenge = excluded.use_challenge,
      use_live = excluded.use_live,
      target_friend = excluded.target_friend,
      target_family = excluded.target_family,
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
    0,
    0,
    now,
    now,
  ).run();
  const row = await env.REMOTE_DB.prepare(`
    SELECT question_id, source_kind, source_ref, title, category, choices_json, status,
      use_challenge, use_live, target_friend, target_family, created_at, updated_at
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
    targetFriend: false,
    targetFamily: false,
    createdAt: row.created_at == null ? null : Number(row.created_at),
    updatedAt: Number(row.updated_at || 0),
    reportCount: Number(row.report_count || 0),
    lastReportedAt: row.last_reported_at == null ? null : Number(row.last_reported_at),
    language: String(row.question_id || '').startsWith('CUSEN') ? 'en' : 'ja',
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
  if (!schemaReadyPromise) {
    schemaReadyPromise = env.REMOTE_DB.batch([
      env.REMOTE_DB.prepare(`CREATE TABLE IF NOT EXISTS question_catalog (
        question_id TEXT PRIMARY KEY, source_kind TEXT NOT NULL, source_ref TEXT, title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'みんなのお題', choices_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'approved', use_challenge INTEGER NOT NULL DEFAULT 0,
        use_live INTEGER NOT NULL DEFAULT 0,
        target_friend INTEGER NOT NULL DEFAULT 0, target_family INTEGER NOT NULL DEFAULT 0,
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
    ]).catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }
  return schemaReadyPromise;
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
