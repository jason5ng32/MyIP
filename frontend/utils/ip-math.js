// Thin re-export — implementation lives in common/ip-math.js so the
// front-end IP Calculator and the back-end's CIDR containment (rdap.js)
// share one source of truth (same pattern as valid-ip.js / bgp-prefix.js).
//
//     import { parseCidr, cidrInfo } from '@/utils/ip-math.js';
export * from '../../common/ip-math.js';
