# iPhoneアプリ化のWindows側準備

## 確定しているアプリ情報

- アプリ名: わたちゃん
- Bundle ID: `com.streetboardgame.watachan`
- 提出用アイコン: `assets/app-icon-1024.png`

## 通信の境界

- 通常版とLIVE版のルーム・結果共有には外部通信が必要です。
- LINE・X共有、Amazon、お問い合わせなど、外部サービスを開く機能にも通信が必要です。
- Capacitor用生成物では、起動時のGoogle AnalyticsとGoogle Fontsへの自動通信を除去します。公開Web版は変更しません。

## Windowsでの確認

```powershell
pnpm run app:verify
pnpm test
```

## Macで残る作業

1. CapacitorのiOSプロジェクトを作成する
2. Xcodeで `assets/app-icon-1024.png` をAppIconへ設定する
3. 実機でオフライン起動、共有、画像保存、LIVE版を確認する
4. 署名、App Store Connect登録、審査用情報を設定する
