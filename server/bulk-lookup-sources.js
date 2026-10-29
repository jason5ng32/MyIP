// Data sources the Bulk IP Lookup (POST /api/bulk-lookup) can run on, picked
// by BULK_LOOKUP_SOURCE. Local data only: one request carries up to
// BULK_LOOKUP_MAX_IPS (200, common/bulk-lookup-limits.js), so a source here
// never calls a metered upstream.
import { lookupMaxMind, getMaxMindBuild } from './datasets/maxmind-service.js';
import logger from './logger.js';

export const DEFAULT_BULK_LOOKUP_SOURCE = 'maxmind';

// `lookup(ip, lang)` answers lookupMaxMind's shape; `build()` dates the data.
export const BULK_LOOKUP_SOURCES = {
    maxmind: { id: 'maxmind', lookup: lookupMaxMind, build: getMaxMindBuild },
};

// Registry entry for an env value; `known: false` means it fell back.
export const resolveBulkLookupSource = (value) => {
    const name = String(value ?? '').trim().toLowerCase() || DEFAULT_BULK_LOOKUP_SOURCE;
    const known = Object.hasOwn(BULK_LOOKUP_SOURCES, name);
    return { name, known, source: BULK_LOOKUP_SOURCES[known ? name : DEFAULT_BULK_LOOKUP_SOURCE] };
};

// Resolved once — env is read after dotenv, and an unknown value warns once.
let active = null;
export const bulkLookupSource = () => {
    if (active) return active;
    const { name, known, source } = resolveBulkLookupSource(process.env.BULK_LOOKUP_SOURCE);
    if (!known) logger.warn(`⚠️  Unknown BULK_LOOKUP_SOURCE "${name}" — falling back to ${source.id}`);
    active = source;
    return active;
};
