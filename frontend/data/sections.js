// Main section IDs for the page
//
// This set of IDs is used in multiple places:
//   - store.mountingStatus / loadingStatus key set
//   - composables/use-section-tracking.js scroll monitoring and `store.changeSection()`
//   - App.vue shortcut scroll targets
//   - Nav.vue top navigation item loop
//

export const SECTION_IDS = [
  'IPInfo',
  'Connectivity',
  'WebRTC',
  'DNSLeakTest',
  'SpeedTest',
  'AdvancedTools',
];

export const DEFAULT_SECTION = 'IPInfo';

// store.mountingStatus key mapping (lowercase snake-ish format, compatible with historical naming)
const MOUNTING_KEYS = [
  'ipcheck',
  'connectivity',
  'webrtc',
  'dnsleaktest',
  'speedtest',
  'advancedtools',
];

// store.loadingStatus key mapping (subset of mounting: without speedtest / advancedtools)
const LOADING_KEYS = [
  'ipcheck',
  'connectivity',
  'webrtc',
  'dnsleaktest',
];

function createStatusObject(keys) {
  return keys.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {});
}

/** Returns a fresh mountingStatus initial object */
export function createMountingStatus() {
  return createStatusObject(MOUNTING_KEYS);
}

/** Returns a fresh loadingStatus initial object */
export function createLoadingStatus() {
  return createStatusObject(LOADING_KEYS);
}
