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
  'DNSLeakTest',
  'WebRTC',
  'SpeedTest',
  'AdvancedTools',
];

export const DEFAULT_SECTION = 'IPInfo';

// Loading semantics only apply to the four sections that actually run async
// network tests on mount. SpeedTest and AdvancedTools mount but have no
// orchestrator-tracked loading phase. Listed explicitly (not derived via
// slice) so future reorders of SECTION_IDS don't silently change membership.
const LOADING_SECTIONS = [
  'IPInfo',
  'Connectivity',
  'DNSLeakTest',
  'WebRTC',
];

function createStatusObject(keys) {
  return Object.fromEntries(keys.map((key) => [key, false]));
}

/** Returns a fresh mountingStatus initial object */
export function createMountingStatus() {
  return createStatusObject(SECTION_IDS);
}

/** Returns a fresh loadingStatus initial object */
export function createLoadingStatus() {
  return createStatusObject(LOADING_SECTIONS);
}
