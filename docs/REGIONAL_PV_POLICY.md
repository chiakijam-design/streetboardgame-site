# Passive measurement policy — 2026-11-05

This supersedes the consent-dialog design in release 368b156. The operator requested no measurement prompts, banners, advance-notice bars or measurement controls on use screens, in all 34 languages. Ordinary provider, purpose, processing/reuse and stop information stays inside the privacy page. No substitute widget is introduced.

## Collection scope and data-series break

Cloudflare public-document statistics may start only for trusted `request.cf.country === 'JP'`, from 2026-11-06T15:00:00Z (November 7, 00:00 JST). The previously announced date is not moved forward. Before that date, every country is disabled. Other and unknown countries stay disabled even when an old Allow record exists. Neither a URL parameter, UI language nor a client country header can grant permission. Country is IP geography, not nationality, residence or a complete determination of applicable law.

Japan direct GA4 was separately reviewed on 2026-11-06. Wata GA account 397426476 data-sharing options (all four) and stream 15047559969 enhanced measurement were disabled with explicit operator approval, saved and independently reloaded. Signals and user-provided data are off, the inspected Google Ads / AdSense / DV360 / SA360 links are empty, and there are no connected site tags. Only trusted edge JP connections to the existing Japanese/English public scope may load the direct SDK. GTM and downstream Microsoft Clarity stay off everywhere. No other country or language clearance is inferred. No positive consent is created. Already-open old documents retain their prior behavior until reloaded. The GA4 collection gap remains a missing-data interval, never zero traffic.

Existing CF refusals, the all-analytics exclusion, `analytics=exclude`, `cf_pv=off`, GPC, DNT, automation, storage failure, unsafe referrers and private/unlisted routes remain excluded. Expired (180-day), invalid or malformed positive records stay disabled without requesting renewal. No automatic collection writes a positive consent. The existing privacy-page analytics-stop link saves the refusal and reloads. Cross-tab storage changes stop started documents. Previously sent aggregates cannot be recalled. Storage deletion, different browsers and devices do not preserve a preference reliably.

## Narrow basis and limits

The earlier JP review applies only to minimized public-document Cloudflare RUM statistics. It does not exempt Microsoft, replay, advertising or all analytics in Japan. The separately minimized Japan-only GA4 configuration below uses ordinary GA cookies, not a cookieless guarantee. AU/NZ provider-purpose and cross-border conditions remain unresolved and are not inferred from generic GDPR claims. There is no country expansion in this repair.

Cloudflare receives transport IP, which its documentation says is discarded at the nearest centre, and minimized public URL/referrer, temporary page ID and device/performance information. Query, fragment, user-input and secret-bearing URLs/referrers are excluded. Detailed third-party and non-public same-site referrers suppress collection. No question, answer, display name, account identifier or management secret is intentionally sent. The current inspected vendor is not a permanent guarantee about future third-party code.

Cloudflare's self-serve Network Data terms permit service operation/improvement/security use, and its privacy notice permits non-identifying aggregate sharing. Processor-purpose restrictions apply within their defined scope. Do not state that every kind of data is used solely for this site or that overseas processing never occurs. Ordinary privacy disclosures retain these limits and the existing effective date; the earlier public advance announcement is not claimed never to have existed.

## Deployment, verification and rollback

Runtime injection contains only passive configuration/scripts and privacy-page text. Both changed JS URLs are versioned to avoid stale cached collectors. Public HTML remains private/no-store with fresh CSP nonce and country representation; private/API/unlisted routes never gain CF collection. No new D1 work, authentication, paid product or infrastructure contract is introduced. Only the specifically authorized Wata Google sharing/enhanced-measurement settings were saved.

Verify all 34 languages/public routes, JP before/exactly at the date, other/unknown/forged-country cases, prior refusals, old/expired Allow, GPC/DNT, unavailable storage, private data, cross-tab stop, one cached real-vendor PV and no history/answer duplication, and PC/390/320/RTL absence of measurement UI. All synthetic HTTP/WebSocket traffic must be intercepted; never send test events to live analytics. Standard build filename-only drift from the isolated dependency layout is excluded from publication.

Daily diagnosis must record the precise publication SHA/time, GA4/Clarity gap, CF country/date scope and organic receipt latency separately. No reconstruction of unmeasured history, 100% coverage claim, CF-to-GA addition or unique-person inference is permitted. No new resident watcher is required.

Rollback via a regular non-force code update. Prefer disabling collection while retaining the no-prompt UI if emergency rollback is needed; restoring 368b156 also restores the unwanted prompts and unsafe unreviewed Google behavior and requires an explicit decision. No DB restore or preference deletion is needed.

## Primary references used in the existing review

- https://developers.cloudflare.com/web-analytics/about/
- https://developers.cloudflare.com/speed/observatory/rum-beacon/
- https://www.cloudflare.com/terms/ (Network Data §2.5.5)
- https://www.cloudflare.com/privacypolicy/ (aggregate use §4)
- https://www.cloudflare.com/cloudflare-customer-dpa/
- https://www.ppc.go.jp/all_faq_index/faq1-q8-3/
- https://laws.e-gov.go.jp/law/359AC0000000086
- https://developers.google.com/tag-platform/security/guides/consent
- https://learn.microsoft.com/en-us/clarity/setup-and-installation/consent-mode

No absolute legal-compliance warranty follows from these references. Conditions not established in this review result in collection being disabled.

## Japan basic GA4 review, 2026-11-06

The operator approved purpose-restricted collection without gameplay prompts. PPC FAQ Q8-3 does not require recipient-consent verification for every personal-related-information transfer, but for transfers expected to be acquired as personal data by the recipient. This review relies on no site identity/account linkage, no user-provided data, no Google Signals or advertising association, no linked advertising products, and all account sharing disabled. Google documents that all-off Analytics sharing limits Analytics data to service operation and maintenance. This is a narrow implementation assessment, not a blanket Japan exemption. DPA processor instructions/service purposes apply within their scope; Google processes data outside Japan including the US. Ordinary privacy-page text identifies provider, purposes, cookie identifiers/device/referring domain, overseas processing and the existing stop link, plus the Google partner-data-use link. No banner, modal, advance notice or gameplay measurement control is restored.

The direct SDK queues ad_storage/ad_user_data/ad_personalization denied, allow_google_signals=false and allow_ad_personalization_signals=false. No analytics_storage=granted or affirmative choice is manufactured. One explicit initial page_view uses a query/fragment-free public URL and fixed title; referrer is reduced to origin. Only enumerated game_start/game_play/game_result/share parameters pass. The runtime suppresses private routes, unknown query keys, fragments, existing refusal/expired or malformed permission records, GPC/DNT, analytics exclusion, unavailable storage and unsafe secret-bearing entry/referrer. Unknown or forged region is off. Standard GA4 identifiers may support users/sessions, but are not verified unique people and are not joined to names, quiz IDs or answers.

Limits: JavaScript, blockers, prior refusals, storage failures and region/locale/path exclusions cause undercount. Strict query allowlisting may exclude legitimate campaigns; do not silently loosen it or claim full traffic coverage. IP country is not nationality/residence. No retrospective recovery of the gap is possible. Synthetic SDK requests must be intercepted; post-publication organic receipt and processing delay are separate from local successful packet tests. No new account fee is introduced by this standard property; browser transfer and CPU must be measured with the actual SDK.

Additional primary references: https://support.google.com/analytics/answer/1011397 ; https://www.ppc.go.jp/all_faq_index/faq1-q8-3/ ; https://business.safety.google/adsprocessorterms/ ; https://marketingplatform.google.com/about/analytics/terms/jp/ ; https://developers.google.com/tag-platform/security/guides/privacy .

Production verification follow-up: ordinary privacy disclosure derives from the trusted server policy even on privacy documents without an analytics bootstrap. The current fixed invitation share-version parameter is accepted but never sent; unknown share values remain blocked. Account sharing settings are account-wide, not property-specific: account 397426476 contains four properties. Other property-specific stream/advertising settings were not changed.

Cross-tab regression: localStorage availability is probed once per document. Storage listeners react only to the explicit analytics-exclusion/CF-preference keys (or clear); they never respond to probe or unrelated writes. This prevents feedback storms while preserving immediate cross-tab refusal and one reload on exclusion.
