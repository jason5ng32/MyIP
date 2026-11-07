// The per-request IP limit of POST /api/bulk-lookup — one number behind two
// consumers: the handler's input check, and the Bulk IP Lookup page, which
// splits a larger run into requests of this size.
export const BULK_LOOKUP_MAX_IPS = 200;
