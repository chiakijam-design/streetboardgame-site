# LIVE Revenue Policy

`Youtuber専用　私のこと、ちゃんと分かってるよねLIVE`の有料結果画像・応援金には、次の収益配分を適用する。

- YouTuber: 売上総額の70%
- Stripeのカード決済手数料基準: 売上総額の3.6%
- Streetboardgame運営: 売上総額の26.4%（3.6%のカード決済手数料だった場合の基準値）

Stripe Connectのデスティネーション支払いでは、YouTuberの連結アカウントへ70%が残るよう、プラットフォームの`application_fee_amount`を名目30%にする。Stripeの実決済手数料はプラットフォーム側から差し引かれるため、運営の実純額は次の式で確定する。

```text
運営実純額 = application_fee_amount - Stripeが記録した実決済手数料
```

実装では`src/live/revenue.js`を使用し、決済完了後のStripe残高取引に記録された実手数料を渡す。3.6%から計算した推定額だけで売上台帳や送金額を確定してはいけない。

返金、チャージバック、Connect固有料金、税金、海外カードや別決済手段の追加料金は26.4%に含まれない。これらが発生した場合、運営の実純額は26.4%を下回る可能性がある。

## Stripe公式資料

- [日本のStripe料金体系](https://stripe.com/jp/pricing)
- [Connectのデスティネーション支払い](https://docs.stripe.com/connect/destination-charges)
