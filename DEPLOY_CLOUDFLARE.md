# Cloudflare Deploy Notes

This site is designed to deploy as static assets with Cloudflare Workers routing.

## Expected Production Setup

- Project name: `streetboardgame`
- Domain: `streetboardgame.com`
- Worker URL noted in the backup: `streetboardgame.chiaki-jam.workers.dev`
- Source repository target: `chiakijam-design/streetboardgame-site`

## Files Cloudflare Needs

- `index.html`
- `404.html`
- `assets/`
- `_headers`
- `_redirects`
- `_worker.js`
- `wrangler.jsonc`

Do not ignore `wrangler.jsonc`; it contains the `ASSETS` binding and Worker entry point.

「みんなに挑戦してもらう」はゲーム用D1の`REMOTE_DB`を使用する。デプロイ前に`migrations/0010_challenge_rooms.sql`、`migrations/0011_challenge_ranking_library.sql`、`migrations/0018_challenge_board_comments.sql`を番号順に適用する。挑戦者上限は画面表示だけでなくD1への条件付きINSERTでも50人に固定され、クイズと参加情報は作成から30日後にCronで削除される。0011は理解度ボード掲載同意日時と匿名のお題別プレイ回数、0018は利用者が定型候補から選んだ理解度ボードコメントを追加する。

LIVE版は2026-10-23に終了し、2026-11-15にコードと本番D1の表を削除した（`migrations/0033_remove_live.sql`、購入用D1は `migrations-purchases/0007_remove_live.sql` と同じ内容を運営者が画面で適用済み）。旧URLは410を返す。Durable Object の2クラスは空の代役（`src/retired/durable-objects.js`）として残している。



## Contact Form

- `POST /api/contact` stores every message in `REMOTE_DB` (`contact_messages`) first, then mails the operator through Resend. Apply `migrations/0032_contact_messages.sql` before deploying.
- It accepts this site (same origin) and `https://webpersonalitytest.com` / `https://www.webpersonalitytest.com` (CORS preflight). Other origins get 403.
- Worker secrets: `RESEND_API_KEY` (sending access for `notify.streetboardgame.com`) and `CONTACT_NOTIFY_TO` (operator address). Never write the address in this public repository.
- A filled hidden field or a send within 3 seconds is stored as `bot` without mail. Each sender may send 5 messages per hour (HMAC-keyed hashes in `rate_limits`, see `src/security/sender-key.js`; no raw IP). Mail stops at 80 per day; later messages are still stored (`skipped_limit`).
- Cron deletes contact messages 12 months after receipt.

## Question Catalog and Moderation

- Apply `migrations/0012_question_catalog_moderation.sql` to `REMOTE_DB` before deployment.
- Apply `migrations/0013_question_safety_reports.sql` to `REMOTE_DB` before deploying automatic safety flags and question reporting.
- Apply `migrations/0014_unify_question_catalog.sql` to `REMOTE_DB` to normalize every approved question and clear the retired audience flags (historical; already applied).
- Apply `migrations/0016_restore_common_question_overrides.sql` to `REMOTE_DB` after `0015` to restore the adopted/disabled decisions for questions moved into the common library without restoring retired game modes.
- Apply `migrations/0017_consolidate_legacy_question_ids.sql` to `REMOTE_DB` if old `FQ`/`FAM`/`LOVE` catalog IDs remain. It keeps the newest status/edit for duplicate IDs and converts them to the common `Q` ID namespace.
- `/question-ops` signs in through `/api/questions/admin/session` (token + TOTP, `src/admin/`). The page and every `/api/questions/admin/*` API sit behind Cloudflare Access.
- `migrations/0034_question_quality_20261115.sql` is a data fix (duplicates hidden, unclear titles reworded); its change list is `docs/records/question-quality-20261115.md`.
- Do not expose `LIVE_ADMIN_TOKEN` or the TOTP secret in static assets or browser code.
- The "このクイズを友達や他の人も使えるようにする" checkbox is ON by default (owner decision, confirmed 2026-11-15). While it stays ON, custom or edited questions are sent to `/question-ops` as library candidates; creators can turn it off and still create the quiz. The screen states that it starts ON.
- Configure all three Worker secrets before using the moderation page: `LIVE_ADMIN_TOKEN`,
  `LIVE_ADMIN_TOTP_SECRET`, and `LIVE_ADMIN_SESSION_SECRET`. Each secret must meet the
  validation in `src/admin/auth.js`; production fails closed with HTTP 503 when they are absent.
- `/question-ops` is intentionally unlinked, `noindex`, and `no-store`, but the URL itself is not
  treated as a security boundary. The signed 15-minute two-factor session protects every read and
  write API. Cloudflare Access (operator email) is the outer gate.

## Manual GitHub Flow

1. Commit changes in this folder.
2. Push to `chiakijam-design/streetboardgame-site`.
3. Wait for Cloudflare Pages / Workers to redeploy.
4. Verify `https://streetboardgame.com`.
5. Confirm Workers & Pages > `streetboardgame` > Observability is enabled and Invocation Logs remain disabled to avoid storing capability URLs.

## Manual Cloudflare Checks

Check these after a deployment:

- `/` loads the top screen.
- `/?screen=intro` opens the how-to-play screen.
- `/?screen=about&to=contact` opens About and scrolls to the contact form.
- `/watachan` redirects to `/`.
- `/contact` redirects to `/?screen=about&to=contact`.
- `assets/ogp-challenge-v4.jpg` (and `assets/ogp-challenge-en-v2.jpg` for English) is reachable for SNS previews.
- `/live-challenge`, `/pricing`, `/refund-policy` and `/creator-terms` answer 410.

## Wrangler Preview

If Wrangler is installed:

```powershell
npx wrangler dev
```

If this asks to install dependencies, approve only after confirming you want local Cloudflare preview support on this machine.
