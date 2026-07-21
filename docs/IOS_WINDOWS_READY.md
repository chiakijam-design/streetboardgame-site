# iPhoneアプリ化 Windows側準備

## 確定したアプリ情報

- アプリ名: わたちゃん
- Bundle ID: `com.streetboardgame.watachan`
- 提出用アイコン: `assets/app-icon-1024.png`（1024x1024、透過なし）

## 通信の境界

- 通常版、友達版、家族版は、ゲーム開始から結果表示までローカル資産だけで動作します。
- 遠隔版だけが `/api/remote` を使用します。
- LINE・X共有、Amazon、問い合わせなど、利用者が明示的に開く外部機能には通信が必要です。
- Capacitor用生成物では、起動時のGoogle AnalyticsとGoogle Fontsへの自動通信を除去します。公開中のWeb版は変更しません。

## Windowsでの確認

```powershell
pnpm run app:verify
pnpm test
```

## Macで残る作業

1. CapacitorのiOSプロジェクトを作成する
2. Xcodeで `assets/app-icon-1024.png` をAppIconへ設定する
3. 実機でオフライン起動、共有、画像保存、遠隔版を確認する
4. 署名、App Store Connect登録、審査用情報を設定する
