// Default user preferences
//
// When userPreferences key is missing or missing fields in localStorage, use this default value as fallback.
// store.loadPreferences() will merge localStorage override values.

// Versioned localStorage key for userPreferences; bump the suffix when stored
// values shouldn't merge onto a changed default. Shared with locales/i18n.js
// (which reads the active language from storage at boot) so the key can't
// drift. Older keys (userPreferences_v6 / userPreferences) are neither read
// nor migrated anymore — a visitor coming from that era simply starts from
// defaults.
export const PREFS_STORAGE_KEY = 'userPreferences_v7';

export const DEFAULT_PREFERENCES = Object.freeze({
  theme: 'auto', // auto | light | dark
  connectivityMultipleTests: false,
  simpleMode: false,
  // Per-module startup auto-run switches. IP info has no switch — it always
  // runs on load. See use-refresh-orchestrator.js.
  autoRunConnectivity: true,
  autoRunWebRTC: true,
  autoRunDnsLeak: true,
  popupConnectivityNotifications: false,
  ipCardsToShow: 2,
  ipGeoSource: 0,
  // Local IP-history recorder (see use-ip-history.js). Days: 1–90.
  ipHistoryEnabled: true,
  ipHistoryDays: 90,
  lang: 'auto', // auto | zh | en | fr | tr
  // User-defined extra targets for the Connectivity test grid. Each entry:
  //   { id: 'custom-<timestamp>', name: string, url: string-with-trailing-? }
  // See ConnectivityTest.vue for how these are merged with the built-in list.
  customConnectivityTargets: [],
});

/**
 * Returns a fresh default preferences object (writable copy).
 * Avoid calling side directly modifying DEFAULT_PREFERENCES (Object.freeze also prevents).
 */
export function createDefaultPreferences() {
  return { ...DEFAULT_PREFERENCES };
}
