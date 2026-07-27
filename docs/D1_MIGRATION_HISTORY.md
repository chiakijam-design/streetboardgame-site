# D1 migration history

## Source of truth

- Migration files: `migrations/*.sql`
- Applied-migration ledger: production D1 table `d1_migrations`
- Actual schema: production D1 `sqlite_schema`

Wrangler decides whether a migration is pending from the file name recorded in
`d1_migrations`. A schema object existing by itself does not mark a migration as
applied.

## Production reconciliation on 2026-07-27

The production schema and data already reflected migrations 0011 through 0022,
but direct SQL execution had not added eleven file names to `d1_migrations`.
Replaying the files was unsafe: migration 0011 failed immediately because
`challenge_participants.ranking_consent_at` already existed, and later files
contain table rebuilds and data normalization.

The read-only audit confirmed:

- 0011: ranking consent column, ranking index, statistics table and index exist.
- 0012: catalog, submissions and rate-limit tables exist.
- 0013: safety flag and report tables, plus the report index, exist.
- 0014: approved and inactive rows have consistent challenge/LIVE flags.
- 0015: already recorded; retired tables and legacy series data are absent.
- 0016: all 22 restored common-question IDs exist.
- 0017: no `FQ*`, `FAM*` or `LOVE*` catalog IDs remain.
- 0018: `challenge_participants.board_comment` exists.
- 0019: all 100 `HLD001`–`HLD100` candidate rows exist.
- 0020: question-selection statistics table exists.
- 0021: all 100 `HLD101`–`HLD200` candidate rows exist.
- 0022: all 300 `HLD201`–`HLD500` candidate rows exist.

Two non-destructive indexes were absent:

- `idx_question_submissions_review`
- `idx_question_selection_priority`

`tools/d1-reconcile-migration-history-20260727.sql` creates those indexes and
records the eleven already-realized migration file names. It does not rebuild
tables, update question status, or delete application data.

## Rules for future migrations

1. Add every production schema or seed change as the next numbered SQL file.
2. Apply it with `wrangler d1 migrations apply ... --remote`; do not use direct
   `d1 execute` for numbered migrations.
3. Confirm `wrangler d1 migrations list ... --remote` is empty after applying.
4. Compare the production schema and key row counts before marking a historic
   migration as applied.
5. Capture a Time Travel bookmark before any manual reconciliation.
