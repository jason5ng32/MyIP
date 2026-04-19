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
  ipCardsToShow: 2,
  ipGeoSource: 0,
  lang: 'auto', // auto | zh | en | fr | tr
});

/**
 * Returns a fresh default preferences object (writable copy).
 * Avoid calling side directly modifying DEFAULT_PREFERENCES (Object.freeze also prevents).
 */
export function createDefaultPreferences() {
  return { ...DEFAULT_PREFERENCES };
}
