// IP database definitions
//
// Each item: { id, slug, text, url, enabled, configKey?, extended?, quotaKey?, attribution? }
// - id    stable identifier, stored in visitors' localStorage (userPreferences.ipGeoSource):
//         a stored number names whichever source holds it, so don't renumber casually
// - slug  the backend route key (`/api/<slug>`), also the `?ipdb=` value (data/url-params.js)
// - text  UI display name, also lookup key (e.g. `WebRtcTest.vue` looks for "MaxMind")
// - url   template string, {{ip}} and {{lang}} will be replaced by buildDbUrl()
// - enabled   availability, derived from /api/configs (runtime failures never touch it)
// - configKey /api/configs flag gating this source; absent = key-free, always available
// - extended  true when the source's answer carries the `extended` block (common/ip-extended.js)
// - quotaKey  the metered feature's key in the signed-in user's quota snapshot
// - attribution  { url }: the provider's home page, linked from the IP section's data-source sentence
// Array order is the Preferences list order and the fallback walk order.

export const IP_DATABASES = [
  { id: 0, slug: 'ipchecking', text: 'IPCheck.ing', url: '/api/ipchecking?ip={{ip}}&lang={{lang}}', enabled: true, configKey: 'ipChecking', extended: true, quotaKey: 'ipinfo', attribution: { url: 'https://ipcheck.ing/' } },
  { id: 1, slug: 'ipapiis', text: 'IPAPI.is', url: '/api/ipapiis?ip={{ip}}', enabled: true, configKey: 'ipapiis', extended: true, attribution: { url: 'https://ipapi.is/' } },
  { id: 2, slug: 'ip2locationio', text: 'IP2Location.io', url: '/api/ip2locationio?ip={{ip}}', enabled: true, configKey: 'ip2locationio', extended: true, attribution: { url: 'https://www.ip2location.io/' } },
  { id: 3, slug: 'ipapicom', text: 'IP-API.com', url: '/api/ipapicom?ip={{ip}}&lang={{lang}}', enabled: true, extended: true, attribution: { url: 'https://ip-api.com/' } },
  { id: 4, slug: 'bigdatacloud', text: 'BigDataCloud', url: '/api/bigdatacloud?ip={{ip}}&lang={{lang}}', enabled: true, configKey: 'bigdatacloud', extended: true, attribution: { url: 'https://www.bigdatacloud.com/' } },
  { id: 5, slug: 'iplocate', text: 'IPLocate.io', url: '/api/iplocate?ip={{ip}}', enabled: true, configKey: 'iplocate', extended: true, attribution: { url: 'https://www.iplocate.io/' } },
  { id: 6, slug: 'maxmind', text: 'MaxMind', url: '/api/maxmind?ip={{ip}}&lang={{lang}}', enabled: true, attribution: { url: 'https://www.maxmind.com/' } },
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

/**
 * Pure function: derive availability from /api/configs — keyed sources follow
 * their flag, key-free sources stay enabled. Returns a fresh array.
 */
export const applyConfigAvailability = (dbs, configs) =>
  dbs.map((db) => ({
    ...db,
    enabled: db.configKey ? !!configs?.[db.configKey] : true,
  }));

/**
 * Pure function: nearest available source id, walking forward cyclically from
 * preferredId (the direction the fetch fallback walks). Unknown ids start
 * from the head; nothing enabled → preferredId unchanged.
 */
export const nearestEnabledId = (preferredId, dbs) => {
  if (!dbs.length) return preferredId;
  const idx = dbs.findIndex((db) => db.id === preferredId);
  const start = idx === -1 ? 0 : idx;
  for (let i = 0; i < dbs.length; i++) {
    const db = dbs[(start + i) % dbs.length];
    if (db.enabled) return db.id;
  }
  return preferredId;
};
