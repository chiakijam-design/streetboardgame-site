-- 廃止したローカル・遠隔ゲームの保存領域と旧シリーズ分類を削除する。
DROP TABLE IF EXISTS remote_rooms;
DROP TABLE IF EXISTS remote_rate_limits;

DELETE FROM question_catalog
WHERE source_kind = 'static'
  AND (
    question_id LIKE 'LOVE%'
    OR question_id LIKE 'FAM%'
    OR question_id LIKE 'BG%'
  );

UPDATE question_submissions
SET source_question_id = 'Q' || substr(source_question_id, 3)
WHERE source_question_id LIKE 'FQ%';

UPDATE question_submissions
SET catalog_id = 'Q' || substr(catalog_id, 3)
WHERE catalog_id LIKE 'FQ%';

UPDATE question_reports
SET question_id = 'Q' || substr(question_id, 3)
WHERE question_id LIKE 'FQ%';

CREATE TABLE question_catalog_current (
  question_id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL,
  source_ref TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'みんなのお題',
  choices_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved',
  use_challenge INTEGER NOT NULL DEFAULT 0,
  use_live INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO question_catalog_current (
  question_id, source_kind, source_ref, title, category, choices_json,
  status, use_challenge, use_live, created_at, updated_at
)
SELECT
  CASE
    WHEN question_id LIKE 'FQ%' THEN 'Q' || substr(question_id, 3)
    ELSE question_id
  END,
  source_kind,
  CASE
    WHEN source_ref LIKE 'FQ%' THEN 'Q' || substr(source_ref, 3)
    ELSE source_ref
  END,
  title, category, choices_json,
  status,
  CASE WHEN status = 'approved' THEN 1 ELSE 0 END,
  CASE WHEN status = 'approved' THEN 1 ELSE 0 END,
  created_at, updated_at
FROM question_catalog;

DROP TABLE question_catalog;
ALTER TABLE question_catalog_current RENAME TO question_catalog;

CREATE INDEX IF NOT EXISTS idx_question_catalog_public
ON question_catalog (status, use_challenge, use_live, updated_at);
