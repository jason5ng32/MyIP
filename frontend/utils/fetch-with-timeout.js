// Thin re-export — implementation lives in common/fetch-with-timeout.js
// so the front-end and back-end share one source of truth (just like
// valid-ip.js). Front-end callers keep writing:
//
//     import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';
//
// Default timeout is 5s; pass { timeoutMs: ... } to override.
export { fetchWithTimeout } from '../../common/fetch-with-timeout.js';
