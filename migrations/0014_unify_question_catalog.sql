-- 通常版とLIVE版は同じ採用済みお題を利用する。
-- 旧シリーズ分類列は既存環境との互換性のため残すが、値は共通状態へ正規化する。
UPDATE question_catalog
SET
  use_challenge = CASE WHEN status = 'approved' THEN 1 ELSE 0 END,
  use_live = CASE WHEN status = 'approved' THEN 1 ELSE 0 END,
  target_friend = 0,
  target_family = 0,
  category = CASE
    WHEN question_id LIKE 'CUSEN%' THEN 'Community questions'
    ELSE 'みんなのお題'
  END,
  updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000;
