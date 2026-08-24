// Thin re-export — implementation lives in common/dns-record-types.js so the
// record-type picker and the backend guard read the same list (same pattern as
// valid-ip.js and bgp-prefix.js).
//
//     import { DNS_RECORD_TYPES } from '@/utils/dns-record-types.js';
export { DNS_RECORD_TYPES } from '../../common/dns-record-types.js';
