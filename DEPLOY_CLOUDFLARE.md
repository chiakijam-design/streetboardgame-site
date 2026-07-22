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

LIVEのリアルタイム投票は`wrangler.jsonc`に定義した2種類のDurable Objectsと、SQLiteストレージを指定した`exports`を使用する。これらのバインディングがない環境では安全のため従来ポーリングへ戻り、視聴者上限は50人になる。デプロイ後は契約環境でWebSocket接続と段階負荷試験を確認してから、1万人枠を本番企画へ案内する。

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
