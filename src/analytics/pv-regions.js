// Configuration reviewed for JP public-document statistics only, 2026-11-05.
// 2026-11-22 (owner decision): Cloudflare's cookieless page statistics also run, without any consent UI,
// for every other and unknown edge country from PV_ALL_REGIONS_START_UTC. Google Analytics and Clarity
// remain Japan-only (separate gate in jp-ga4-policy.js / passive-policy.js).
// Country is edge-provided IP geography, not residence, nationality or language.
export const PV_NOTICE_COUNTRIES = Object.freeze(['JP']);
export const PV_NOTICE_START_UTC = '2026-11-06T15:00:00Z'; // November7 00:00 JST, advance public notice.
export const PV_ALL_REGIONS_START_UTC = '2026-11-21T15:00:00Z'; // November22 00:00 JST.
export function pvRegionMode(cf, now = Date.now()) {
  if (!cf || typeof cf.country !== 'string' || !Number.isFinite(now)) return 'consent';
  if (PV_NOTICE_COUNTRIES.includes(cf.country)) return now >= Date.parse(PV_NOTICE_START_UTC) ? 'notice' : 'pending-notice';
  return now >= Date.parse(PV_ALL_REGIONS_START_UTC) ? 'notice' : 'consent';
}
