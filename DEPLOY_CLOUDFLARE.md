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

旧LIVEのリアルタイム基盤は既存購入・運用記録の保全用としてコードを残している。新規の公開入口は閉じ、旧ゲームURLは`/challenge`へ恒久転送する。

YouTube Data API v3、チャンネル所有確認、字幕由来の内輪問題生成、非公開R2、Cloudflare Images、有料画像権限を有効化する場合は、先に[`docs/LIVE_EXTERNAL_SERVICES.md`](docs/LIVE_EXTERNAL_SERVICES.md)の資格情報・OAuth審査・バインディングと、ゲーム用D1の`0009_live_youtube_caption_sources.sql`までの適用を完了する。R2バケット作成前に`wrangler.jsonc`の`LIVE_MEDIA`コメントを外すとデプロイが失敗するため、作成と契約を先に行う。

LIVE運営コンソール、障害告知、Stripe Checkout・Webhook・返金・70%月次分配、WebSocket切断率監視、配信中チャット・有料応援メッセージ、招待・手動審査・収益分配規約同意は、[`docs/LIVE_OPERATIONS_RUNBOOK.md`](docs/LIVE_OPERATIONS_RUNBOOK.md)と[`docs/LIVE_ABUSE_PREVENTION.md`](docs/LIVE_ABUSE_PREVENTION.md)に従い、ゲーム用D1へ`0025_live_chat.sql`まで、購入用D1へ`migrations-purchases/0006_live_support_message.sql`まで適用し、`LIVE_ADMIN_TOKEN`、`LIVE_OPS_ALERT_WEBHOOK_URL`、`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`LIVE_PURCHASE_ACCESS_SECRET`を設定する。本番ではE2E専用の`LIVE_CREATOR_INVITE_BYPASS_TOKEN`を設定してはならない。

## Question Catalog and Moderation

- Apply `migrations/0012_question_catalog_moderation.sql` to `REMOTE_DB` before deployment.
- Apply `migrations/0013_question_safety_reports.sql` to `REMOTE_DB` before deploying automatic safety flags and question reporting.
- Apply `migrations/0014_unify_question_catalog.sql` to `REMOTE_DB` to normalize every approved question for both the normal and LIVE modes and clear the retired audience flags.
- Apply `migrations/0016_restore_common_question_overrides.sql` to `REMOTE_DB` after `0015` to restore the adopted/disabled decisions for questions moved into the common library without restoring retired game modes.
- Apply `migrations/0017_consolidate_legacy_question_ids.sql` to `REMOTE_DB` if old `FQ`/`FAM`/`LOVE` catalog IDs remain. It keeps the newest status/edit for duplicate IDs and converts them to the common `Q` ID namespace.
- `/question-ops` reuses the existing LIVE operations token and TOTP authentication.
- Do not expose `LIVE_ADMIN_TOKEN` or the TOTP secret in static assets or browser code.
- Public submissions are stored only when the creator explicitly checks the review-consent checkbox.
- Configure all three Worker secrets before using the moderation page: `LIVE_ADMIN_TOKEN`,
  `LIVE_ADMIN_TOTP_SECRET`, and `LIVE_ADMIN_SESSION_SECRET`. Each secret must meet the
  validation in `src/live/admin-auth.js`; production fails closed with HTTP 503 when they are absent.
- `/question-ops` is intentionally unlinked, `noindex`, and `no-store`, but the URL itself is not
  treated as a security boundary. The signed 15-minute two-factor session protects every read and
  write API. Cloudflare Access can be added as a second outer gate for operator email accounts.

## Manual GitHub Flow

1. Commit changes in this folder.
2. Push to `chiakijam-design/streetboardgame-site`.
3. Wait for Cloudflare Pages / Workers to redeploy.
4. Verify `https://streetboardgame.com`.
5. Run `pnpm run check:live-health` and confirm that the production Worker returns `ok: true`.
6. Confirm Workers & Pages > `streetboardgame` > Observability is enabled and Invocation Logs remain disabled to avoid storing capability URLs.

## Manual Cloudflare Checks

Check these after a deployment:

- `/` loads the top screen.
- `/?screen=intro` opens the how-to-play screen.
- `/?screen=about&to=contact` opens About and scrolls to the contact form.
- `/watachan` redirects to `/?screen=intro`.
- `/contact` redirects to `/?screen=about&to=contact`.
- `assets/ogp.jpg` is reachable for SNS previews.

## Wrangler Preview

If Wrangler is installed:

```powershell
npx wrangler dev
```

If this asks to install dependencies, approve only after confirming you want local Cloudflare preview support on this machine.
