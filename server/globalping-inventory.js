// Pure aggregation for the Globalping probe inventory: turns the raw
// /v1/probes payload (one entry per online probe) into the compact shape
// the frontend country pickers consume — which countries have a probe at
// all, grouped into the five continent buckets the UI displays (NA + SA
// merge into "americas"). Serving this from our backend keeps the multi-
// hundred-KB probe list off the visitor's connection.

// Globalping continent codes → our display buckets.
const CONTINENT_BUCKETS = { AS: 'asia', EU: 'europe', AF: 'africa', NA: 'americas', SA: 'americas', OC: 'oceania' };
const BUCKET_ORDER = ['asia', 'europe', 'africa', 'americas', 'oceania'];

// probes: raw array from Globalping. Returns
// { countries: [cc], continents: [{ key, countries: [cc] }] } with
// continents in display order and country codes sorted alphabetically.
export const buildProbeInventory = (probes) => {
    const countries = new Set();
    const buckets = new Map();

    for (const probe of (Array.isArray(probes) ? probes : [])) {
        const cc = probe?.location?.country;
        if (!cc) continue;
        countries.add(cc);
        const bucket = CONTINENT_BUCKETS[probe?.location?.continent];
        if (!bucket) continue;
        if (!buckets.has(bucket)) buckets.set(bucket, new Set());
        buckets.get(bucket).add(cc);
    }

    return {
        countries: [...countries].sort(),
        continents: BUCKET_ORDER
            .filter((key) => buckets.has(key))
            .map((key) => ({ key, countries: [...buckets.get(key)].sort() })),
    };
};
