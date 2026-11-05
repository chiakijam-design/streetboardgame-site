// Configuration reviewed for JP public-document statistics only, 2026-11-05.
// AU/NZ and every other country remain disabled by the passive collector.
// Country is edge-provided IP geography, not residence, nationality or language.
export const PV_NOTICE_COUNTRIES = Object.freeze(['JP']);
export const PV_NOTICE_START_UTC = '2026-11-06T15:00:00Z'; // November7 00:00 JST, advance public notice.
export function pvRegionMode(cf, now = Date.now()) {
  if (!cf || typeof cf.country !== 'string' || !PV_NOTICE_COUNTRIES.includes(cf.country) || !Number.isFinite(now)) return 'consent';
  return now >= Date.parse(PV_NOTICE_START_UTC) ? 'notice' : 'pending-notice';
}
