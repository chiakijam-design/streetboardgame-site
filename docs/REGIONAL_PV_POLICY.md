# Regional Cloudflare PV policy — 2026-11-05

Base release: ed819da9a1502b30a4f1415a0e677fbd02a3b420. This release enables notice/opt-out only for connections whose trusted Cloudflare request.cf.country is JP, from 2026-11-06T15:00:00Z (2026-11-07 00:00 JST). Before that date JP is pending-notice and still needs the existing explicit permission. AU, NZ, GB, EEA/EU, CH and every other or unknown country remain consent-gated.

## Basis and limits

This is a narrow configuration decision about ordinary public-document page/performance statistics. It is not a declaration that all analytics in Japan or any other country is consent-exempt. PPC FAQ Q8-3 distinguishes transfers expected to become personal data at the recipient from personal-related-information transfers generally. The documented RUM service does not store a persistent visitor identifier or fingerprint, receives the network IP but discards it at the nearest centre, and describes no cross-property user tracking. The public paths contain no free-form user paths; raw capability-bearing locations/referrers are excluded. Notice-mode collection additionally excludes detailed third-party and non-public same-site referrer paths. No question, answer, display name, account ID or management secret is intentionally sent.

The purpose, recipient Cloudflare, Inc., page/referring URLs without query or fragment, temporary page ID, view time, browser/device/performance/memory data, overseas processing and stop method are disclosed in the34 UI languages. The operator uses this for aggregate audience/performance improvements. Cloudflare can use Network Data for its own service operation/improvement/security and can share non-identifying aggregates with third parties. Its anonymized BEACON publication demonstrates that use is not limited to this site. Do not describe Cloudflare as using all such data solely on our behalf. No claim is made that Wata is actually selected in BEACON.

The applicable personal account and existing Wata manual Web Analytics installation were read in the official dashboard. Public self-serve terms and DPA were read; no new terms were accepted. Processor-purpose restrictions apply within their defined scope, not automatically to every kind of aggregate Network Data. AU/NZ cross-border and provider own-purpose requirements are not treated as resolved by generic GDPR marketing or the generic DPA; these countries remain opt-in. Country-of-IP is not nationality/residence or a conclusive determination of applicable law. Unknown/invalid country metadata never enables automatic collection.

## Existing promises and advance notice

The current privacy policy promises a dated advance announcement of important changes. The34-language announcement is rendered publicly before the effective date; the JP banner does not silently activate measurement during that period. Public privacy pages also show the date and scope. The server clock chooses pending-notice versus notice, never a URL parameter, a client country header or a UI language. Already-open pending pages do not acquire automatic collection merely when the time passes; a fresh document uses the new server decision.

Existing refusals persist until changed. Existing all-analytics opt-outs, GPC, DNT, analytics=exclude, automation, unavailable storage, unsafe URLs/referrers and private/API/unlisted paths remain excluded. An explicit Allow still lasts180days. Once expired it requires a real renewed permission even in JP; expired or malformed records are never silently converted into automatic permission. Automatic collection does not create a saved positive consent. The notice explains stopping, overseas processing and non-identifying third-party reuse; no CF choice enables Google/Microsoft/replay/ads.

Preferences use only the existing choice/time fields. Automatic mode requires a working preference store, including a constant immediately removed availability probe, not a visitorID. Stopping persists and reloads, and propagates to other tabs. If a stop cannot be saved, a CF-only cf_pv=off navigation suppresses collection in that document; no Google/Microsoft preference is changed. Already-sent aggregates cannot be recalled. Storage loss can prevent persistent preferences; do not promise cross-device persistence.

## Cache, load, verification and rollback

Final eligible public GET/HEADHTML is private,no-store with CDN-specific no-store headers so a country-specific representation cannot leak through a shared cache. The underlying prepared HTML assets and JS/CSS retain their independent cache behaviour. Fresh nonce/body pairing and conditional-request protection are preserved. No new D1 work, authentication, paid product or infrastructure contract is introduced. More eligible traffic can mean more beacon traffic, and a full HTML response is not free of transfer cost; no hard account fee cap or zero-overhead guarantee is made.

Test before deployment: JP before/exactly at/after the start; AU/NZ and unknown/unreviewed countries; forged country headers/query; shared template across countries;34 translations;180day expiry and malformed records; persistent refusal and privacy signals; storage read/write failure and failed stop; cross-tab withdrawal and travel; cached real vendor under actual CSP with all network intercepted; no synthetic input/secret/query/fragment markers or per-answer/history double counts; keyboard, RTL and320/390/PC layouts. Current vendor tests are not a permanent sandbox guarantee for future third-party JS. Never send synthetic test events to production.

The standard build can change esbuild hashed filenames under an isolated dependency layout even when both game/QR bundles are byte-identical. Such unrelated generated files are preserved separately and excluded. Static locale generation intentionally omits this runtime-only injection. Do not mix those unrelated paths into this release.

Rollback: restore the base code through a regular non-force update, keep Cloudflare manual installation to honour existing refusals, retain preference data, and accept a CF measurement gap. No DB restoration, token rotation or unconditional automatic edge injection is needed. Record the policy effective time and distinguish implementation, activation, synthetic scenarios and real received aggregates. Do not add CF to GA4 or reconstruct missing history.

## Primary sources

- https://www.ppc.go.jp/all_faq_index/faq1-q8-3/
- https://laws.e-gov.go.jp/law/359AC0000000086
- https://developers.cloudflare.com/web-analytics/about/
- https://developers.cloudflare.com/speed/observatory/rum-beacon/
- https://developers.cloudflare.com/workers/runtime-apis/request/
- https://www.cloudflare.com/terms/ (Network Data section2.5.5)
- https://www.cloudflare.com/privacypolicy/ (aggregation section4)
- https://www.cloudflare.com/cloudflare-customer-dpa/ (processor scope and3.1)
- https://blog.cloudflare.com/how-fast-is-the-web/
- https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-3-app-3-collection-of-solicited-personal-information
- https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-8-app-8-cross-border-disclosure-of-personal-information
- https://www.privacy.org.nz/privacy-principles/12/

Not all underlying provider practices can be independently audited. The Japanese configuration decision relies on these specific documented properties, the actual manual installation, minimized inspected payload and disclosed reuse, not an absolute legal-compliance warranty. The original e-Gov page had no readable text in this tool; parent legal research supplied the notification/publication route and no statutory quote is reproduced here.
