# Global page-view measurement

The optional Cloudflare collector is separate from the existing Japanese/English
GA4 and Clarity path. Do not remove the locale-review guard or change those tags
to expand global PV coverage. `analytics.js` is unchanged by this release.

All34 public languages offer the same explicit choice. No choice, refusal,
unreadable storage, GPC, DNT, `analytics=exclude`, the existing persistent opt-out,
automation, private/unknown routes and unsafe capability-bearing URLs suppress
the new tag. Refusals remain until changed; grants expire after180 days. The only
new browser record is the versioned choice and its timestamp, not a visitor ID.
The choice applies to Cloudflare only; the policy links to the existing opt-out
for all access analytics. Do not imply this is advertising or replay consent.

## Deployment and recovery

The Cloudflare account must be the personal account for `streetboardgame.com`.
Use the existing Web Analytics site, not a new paid product. Its RUM setting must
be **Enable with JS Snippet installation** so automatic injection cannot run
before consent. Never enable automatic global injection as a shortcut.

Prepare and verify the limited code/tree first. Change RUM to manual immediately
before the prepared normal main update; record the short measurement gap. If the
update does not execute, restore the previous **Enable, excluding visitor data in
the EU** setting. No game, review or database writes are required for this switch.

To revert after publication, keep automatic injection disabled/manual and restore
the prior code. This stops the new Cloudflare series while preserving the game.
Do not restore unconditional automatic collection after visitors may have saved a
refusal in the new flow. A repaired release must keep honouring those refusals.
Record the resulting measurement gap; never backfill it as zero traffic. No
database restoration, secret rotation or deletion is needed.

## Definition and limits

One PV is a public document load with affirmative Cloudflare consent, including
EU visitors who choose to permit measurement. `spa:false` is intentional:
answer selections, query/fragment/history changes and management transitions are
not additional PV. Existing public navigation uses real page loads. Do not
compare this series as if identical to the former automatically injected SPA
series, or count a game result as a new document view.

Cloudflare additionally receives performance aggregates and a per-page load ID.
The tested vendor payload excludes questions, answers, display names, URL query,
fragment, room identifier and management capability. Its script must not receive
custom event parameters or be coupled to user input. Prior opt-out must never be
cleared by a Cloudflare acceptance. Withdrawal saves refusal and reloads the page;
no next-document tag loads. Already-collected aggregates cannot be recalled.

The product's privacy statement and this implementation do not guarantee that a
third-party script can never change. Recheck the public vendor hash/payload after
updates. No cross-site identifier, fingerprint, new login or ad consent is added.

Report Cloudflare aggregate PV/geography separately from GA4 PV and game KPIs,
with calendar dates, timezone, acquisition time and bot/consent exclusions. Never
add the two sources, substitute infrastructure requests for views or people, or
recover past uncollected visits by estimation. Rejection, blockers, JavaScript
disabled, network loss and provider aggregation/sampling mean coverage is not100%.

Cloudflare Web Analytics itself has no additional product fee. A small first-party
script and fixed per-language configuration are added; no D1 calls or new paid
services are added. Synthetic cached-script timing is not physical-device INP or
a hard guarantee of zero overhead or a cap on the account's other usage fees.

Official behavior references:

- https://developers.cloudflare.com/web-analytics/get-started/
- https://developers.cloudflare.com/web-analytics/get-started/web-analytics-spa/
- https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/
