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

LIVEのリアルタイム投票は`wrangler.jsonc`に定義した2種類のDurable Objectsと、SQLiteストレージを指定した`exports`を使用する。これらのバインディングがない環境、または`LIVE_OPERATIONAL_VIEWER_LIMIT`が未設定の環境では安全のため視聴者上限は50人になる。デプロイ後は契約環境でWebSocket接続と段階負荷試験を確認し、環境変数を1,000、5,000、10,000と引き上げてから1万人枠を本番企画へ案内する。

YouTube Data API v3、チャンネル所有確認、非公開R2、Cloudflare Images、有料画像権限を有効化する場合は、先に[`docs/LIVE_EXTERNAL_SERVICES.md`](docs/LIVE_EXTERNAL_SERVICES.md)の資格情報・バインディング・`0005_live_paid_media.sql`の適用を完了する。R2バケット作成前に`wrangler.jsonc`の`LIVE_MEDIA`コメントを外すとデプロイが失敗するため、作成と契約を先に行う。

LIVE運営コンソール、障害告知、Stripe Checkout・Webhook・返金、WebSocket切断率監視、招待・手動審査・収益分配規約同意は、[`docs/LIVE_OPERATIONS_RUNBOOK.md`](docs/LIVE_OPERATIONS_RUNBOOK.md)と[`docs/LIVE_ABUSE_PREVENTION.md`](docs/LIVE_ABUSE_PREVENTION.md)に従い、ゲーム用D1へ`0008_live_creator_agreements.sql`まで、購入用D1へ`migrations-purchases/0002_live_checkout_orders.sql`まで適用し、`LIVE_ADMIN_TOKEN`、`LIVE_OPS_ALERT_WEBHOOK_URL`、`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`LIVE_PURCHASE_ACCESS_SECRET`を設定する。本番ではE2E専用の`LIVE_CREATOR_INVITE_BYPASS_TOKEN`を設定してはならない。

## Manual GitHub Flow

1. Commit changes in this folder.
2. Push to `chiakijam-design/streetboardgame-site`.
3. Wait for Cloudflare Pages / Workers to redeploy.
4. Verify `https://streetboardgame.com`.

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
