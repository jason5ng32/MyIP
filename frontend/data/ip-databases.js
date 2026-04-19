// IP database definitions
//
// Each item: { id, text, url, enabled }
// - id    numeric identifier, referenced elsewhere in the app (e.g. userPreferences.ipGeoSource)
// - text  UI display name, also lookup key (e.g. `WebRtcTest.vue` looks for "MaxMind")
// - url   template string, {{ip}} and {{lang}} will be replaced by buildDbUrl()
// - enabled initial enabled state (user can toggle in Preferences, store will write back this field)

export const IP_DATABASES = [
  { id: 0, text: 'IPCheck.ing', url: '/api/ipchecking?ip={{ip}}&lang={{lang}}', enabled: true },
  { id: 1, text: 'IPinfo.io', url: '/api/ipinfo?ip={{ip}}', enabled: true },
  { id: 2, text: 'IP-API.com', url: '/api/ipapicom?ip={{ip}}&lang={{lang}}', enabled: true },
  { id: 3, text: 'IPAPI.is', url: '/api/ipapiis?ip={{ip}}', enabled: true },
  { id: 4, text: 'IP2Location.io', url: '/api/ip2location?ip={{ip}}', enabled: true },
  { id: 5, text: 'IP.sb', url: '/api/ipsb?ip={{ip}}', enabled: true },
  { id: 6, text: 'MaxMind', url: '/api/maxmind?ip={{ip}}&lang={{lang}}', enabled: true },
];

/**
 * Returns a fresh ipDBs array (store state initial value), not sharing references with exported IP_DATABASES.
 */
export function createInitialIpDBs() {
  return IP_DATABASES.map((db) => ({ ...db }));
}

/**
 * Pure function: render the final request URL based on the data source record and IP/lang.
 * Extracted to data layer for convenience of unit tests, avoiding dependency on Pinia store.
 */
export function buildDbUrl(db, ip, lang) {
  if (!db || !db.url) return null;
  return db.url.replace('{{ip}}', ip).replace('{{lang}}', lang || 'en');
}
