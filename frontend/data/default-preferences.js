// Default user preferences
//
// When userPreferences key is missing or missing fields in localStorage, use this default value as fallback.
// store.loadPreferences() will merge localStorage override values.

export const DEFAULT_PREFERENCES = Object.freeze({
  theme: 'auto', // auto | light | dark
  connectivityAutoRefresh: false,
  simpleMode: false,
  autoStart: true,
  hideUnavailableIPStack: false,
  popupConnectivityNotifications: true,
  ipCardsToShow: 4,
  ipGeoSource: 0,
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
