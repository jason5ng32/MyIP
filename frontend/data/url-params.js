// Global URL parameters: every query parameter the app reads on any page,
// one row each (page-scoped ones, a tool's `q` / Snapshots' `vs`, stay with
// their page). tests/url-params.test.js fails on a read missing here.
//
// - override  sets `preference` for this page load: URL > stored > default;
//             parsed by utils/url-overrides.js, never persisted or synced
// - dev       DEV builds only
// - legacy    an old link shape, rewritten on arrival

export const URL_PARAMS = Object.freeze([
  { name: 'hl', kind: 'override', preference: 'lang' },
  { name: 'theme', kind: 'override', preference: 'theme' },
  { name: 'ipdb', kind: 'override', preference: 'ipGeoSource' },
  { name: 'probes', kind: 'override', preference: 'ipCardsToShow' },
  // Festival skin preview (utils/features/festival-skin.js).
  { name: 'festival', kind: 'dev' },
  // `/?tool=<slug>` → `/tools/<slug>` (utils/legacy-tool-link.js).
  { name: 'tool', kind: 'legacy' },
]);

export const URL_OVERRIDE_PARAMS = Object.freeze(URL_PARAMS.filter((param) => param.kind === 'override'));
