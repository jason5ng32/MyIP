// Thin re-export — implementation lives in common/bgp-prefix.js so the
// front-end and back-end share one source of truth (same pattern as
// valid-ip.js and fetch-with-timeout.js).
//
//     import { toBgpPrefix } from '@/utils/bgp-prefix.js';
export { toBgpPrefix, isValidBgpPrefix } from '../../common/bgp-prefix.js';
