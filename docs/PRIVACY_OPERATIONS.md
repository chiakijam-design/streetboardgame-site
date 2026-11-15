# プライバシー運用設定

最終更新: 2026-11-15（LIVE 版の削除・決済の終了に合わせて書き直し）

## 1. コードで実行される処理

- Cron Trigger: 毎時17分（`wrangler.jsonc` の `crons`）に `src/privacy/cleanup.js` を実行する。
- クイズの部屋と参加者: 作成から30日の期限を過ぎた部屋と、その参加者・回答を削除する。
- 回数制限の記録（`rate_limits`）: 期限切れの区切りを削除する。送り元は Worker の秘密の値を混ぜたハッシュ（HMAC、`src/security/sender-key.js`）で数え、生の IP アドレスは保存しない。
- 管理画面のセッション（`admin_sessions`）: 期限切れを削除する。
- お問い合わせ（`contact_messages`）: 受付から12か月を超えた行を削除する。
- 運用の記録（エラー・CSP 違反の報告）は D1 に保存せず、Cloudflare Workers Logs に出す。

Cron の直近実行と失敗は Cloudflare Workers の Cron Trigger、Logs、Notifications で確認する。

## 2. 終了した機能（LIVE 版・決済）

LIVE 版（配信・有料応援・結果画像の販売・YouTube 連携）は 2026-10-23 に終了し、2026-11-15 にプログラムと本番 D1 の表を削除した。購入は0件。表の控えは AI-HANDOFF/records/backup/wata-live-20261115/ にある。決済（Stripe）の処理もコードから外した。購入用 D1（`streetboardgame-live-purchases`）の表の削除（`migrations-purchases/0007_remove_live.sql`）と、決済関係の Worker の秘密の値の削除は、運営者の許可を得て行う。

## 3. 管理画面（お題の管理）

- `/question-ops` と、その API（`/api/questions/admin/*`、ログインの受け口 `/api/questions/admin/session` を含む）は Cloudflare Access（運営者のメールでのログイン）で守る。
- そのうえで Worker の秘密の値3つ（名前は LIVE 版のころのまま）による合言葉と二段階認証を使う。
  - `LIVE_ADMIN_TOKEN`: 32文字以上のランダム値
  - `LIVE_ADMIN_TOTP_SECRET`: 認証アプリへ登録する Base32 の秘密鍵。32文字以上
  - `LIVE_ADMIN_SESSION_SECRET`: 32文字以上の別のランダム値（回数制限の HMAC の鍵もここから別ラベルで導く。専用の `RATE_LIMIT_SECRET` を置けばそちらを使う）
- TOTP は30秒・6桁、時刻ずれは前後1区間まで。二段階認証のあとの管理セッションは15分で失効する。

## 4. 外部サービス側で必要な設定

- GA4: データ保持を14か月に設定する。送るのは固定の画面名（home・challenge_create など）と、名前や回答を含まない項目だけ。
- お問い合わせ（2026-11-14 に Formspree から自前の `/api/contact` へ移行）: ゲーム用 D1 の `contact_messages` に保存する。
- Resend: お問い合わせ通知メールの送信に使う（送信元 `notify.streetboardgame.com`）。API キーは送信専用の権限にし、宛先は `CONTACT_NOTIFY_TO` だけに置く。
- Cloudflare: Logs・Analytics の契約上の保持期間を確認し、不要な Logpush 保存を行わない。Cron 失敗、Worker 5xx、D1 使用量を通知対象にする。

## 5. 四半期点検

1. Cron が毎時成功していることを確認する。
2. D1 で期限を過ぎた部屋・回数制限・セッション・お問い合わせが残っていないことを確認する。
3. 管理者の秘密の値を交換し、Cloudflare Access の許可メールに不要な人がいないことを確認する。
4. GA4、Resend、Cloudflare の保持・権限設定を確認する。
