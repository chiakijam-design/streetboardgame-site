-- 本番に残っている旧FQ/FAM/LOVE IDを現在の共通ライブラリIDへ統合する。
-- 同じ移行先IDが複数ある場合は、updated_atが新しい運営設定を優先する。
DROP TABLE IF EXISTS question_catalog_consolidated;

CREATE TABLE question_catalog_consolidated (
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

INSERT INTO question_catalog_consolidated (
  question_id, source_kind, source_ref, title, category, choices_json,
  status, use_challenge, use_live, created_at, updated_at
)
WITH normalized AS (
  SELECT
    CASE
      WHEN source_kind = 'static' AND question_id LIKE 'FQ%'
        THEN 'Q' || substr(question_id, 3)
      WHEN source_kind = 'static' AND question_id LIKE 'FAM%'
        THEN printf('Q5%02d', CAST(substr(question_id, 4) AS INTEGER))
      WHEN source_kind = 'static' AND question_id LIKE 'LOVE%'
        THEN printf('Q4%02d', CAST(substr(question_id, 5) AS INTEGER))
      ELSE question_id
    END AS normalized_id,
    question_id AS original_id,
    source_kind,
    CASE
      WHEN source_ref LIKE 'FQ%' THEN 'Q' || substr(source_ref, 3)
      WHEN source_ref LIKE 'FAM%' THEN printf('Q5%02d', CAST(substr(source_ref, 4) AS INTEGER))
      WHEN source_ref LIKE 'LOVE%' THEN printf('Q4%02d', CAST(substr(source_ref, 5) AS INTEGER))
      ELSE source_ref
    END AS normalized_ref,
    title,
    category,
    choices_json,
    status,
    created_at,
    updated_at
  FROM question_catalog
),
ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY normalized_id
      ORDER BY updated_at DESC,
        CASE WHEN original_id = normalized_id THEN 0 ELSE 1 END
    ) AS preference
  FROM normalized
)
SELECT
  normalized_id,
  source_kind,
  normalized_ref,
  title,
  category,
  choices_json,
  status,
  CASE WHEN status = 'approved' THEN 1 ELSE 0 END,
  CASE WHEN status = 'approved' THEN 1 ELSE 0 END,
  created_at,
  updated_at
FROM ranked
WHERE preference = 1;

DROP TABLE question_catalog;
ALTER TABLE question_catalog_consolidated RENAME TO question_catalog;

CREATE INDEX IF NOT EXISTS idx_question_catalog_public
ON question_catalog (status, use_challenge, use_live, updated_at);
