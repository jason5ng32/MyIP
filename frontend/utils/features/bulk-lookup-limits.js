// Thin re-export — the value lives in common/bulk-lookup-limits.js so the
// page's request size and the handler's limit stay one number.
//
//     import { BULK_LOOKUP_MAX_IPS } from '@/utils/features/bulk-lookup-limits.js';
export { BULK_LOOKUP_MAX_IPS } from '../../../common/bulk-lookup-limits.js';
