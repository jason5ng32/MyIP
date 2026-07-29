// IP database definitions
//
// Each item: { id, text, url, enabled, configKey? }
// - id    numeric identifier, referenced elsewhere in the app (e.g. userPreferences.ipGeoSource)
// - text  UI display name, also lookup key (e.g. `WebRtcTest.vue` looks for "MaxMind")
// - url   template string, {{ip}} and {{lang}} will be replaced by buildDbUrl()
// - enabled   availability, derived from /api/configs (runtime failures never touch it)
// - configKey /api/configs flag gating this source; absent = key-free, always available

export const IP_DATABASES = [
  { id: 0, text: 'IPCheck.ing', url: '/api/ipchecking?ip={{ip}}&lang={{lang}}', enabled: true, configKey: 'ipChecking' },
  { id: 1, text: 'IPinfo.io', url: '/api/ipinfo?ip={{ip}}', enabled: true, configKey: 'ipInfo' },
  { id: 2, text: 'IP-API.com', url: '/api/ipapicom?ip={{ip}}&lang={{lang}}', enabled: true },
  { id: 3, text: 'IPAPI.is', url: '/api/ipapiis?ip={{ip}}', enabled: true, configKey: 'ipapiis' },
  { id: 4, text: 'IP2Location.io', url: '/api/ip2location?ip={{ip}}', enabled: true, configKey: 'ip2location' },
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
