// Pure classification logic for the OONI-backed censorship view: turns raw
// rows from OONI's aggregation API (probe_cc × blocking_type, see
// api/ooni-blocking.js) into one tiered entry per country.
//
// Tier semantics — calibrated against real 30-day data for known-blocked
// domains (twitter/facebook/bbc/pornhub, 2026-07):
//   confirmed  OONI fingerprint-confirmed blocking (blockpage served). Only
//              exists in countries that serve identifiable blockpages.
//   likely     High anomaly share. Countries that block via DNS poisoning /
//              RST injection (e.g. CN) never produce `confirmed`, so anomaly
//              share is the primary signal, not a fallback.
//   signs      Moderate anomaly share — intermittent interference or noisy
//              CDN geo-variance. Requires a larger sample to avoid false
//              positives from low-traffic countries.
//   ok         Everything else, including under-sampled countries.

export const OONI_WINDOW_DAYS = 30;

// Minimum measurements for a country to be classifiable at all. Kept low on
// purpose: for rarely-tested domains a handful of measurements is all OONI
// has, and 7-of-8 anomalous is still a real signal (the ratio thresholds do
// the actual gatekeeping). Below this, one noisy probe would decide the tier.
const MIN_SAMPLES = 5;
// `signs` is the noisiest tier; demand a larger sample before flagging.
const SIGNS_MIN_SAMPLES = 30;

const CONFIRMED_RATIO = 0.05;
const LIKELY_RATIO = 0.5;
const SIGNS_RATIO = 0.2;

const TIER_ORDER = { confirmed: 0, likely: 1, signs: 2, ok: 3 };

// OONI's blocking_type values for web_connectivity anomalies. Rows with an
// empty blocking_type carry the ok / failure counts and never contribute to
// the per-method breakdown.
const BLOCKING_TYPES = new Set(['dns', 'tcp_ip', 'http-failure', 'http-diff']);

const classifyTier = ({ measurements, anomaly, confirmed }) => {
    if (measurements < MIN_SAMPLES) return 'ok';
    const blockedRatio = (anomaly + confirmed) / measurements;
    if (confirmed / measurements >= CONFIRMED_RATIO) return 'confirmed';
    if (blockedRatio >= LIKELY_RATIO) return 'likely';
    if (measurements >= SIGNS_MIN_SAMPLES && blockedRatio >= SIGNS_RATIO) return 'signs';
    return 'ok';
};

// rows: concatenated OONI result rows (both hostname variants are fine — the
// accumulator merges by probe_cc). Returns one entry per country, flagged
// tiers first, each tier sorted by blocked share descending.
export const classifyOoniCountries = (rows) => {
    const byCountry = new Map();

    for (const row of rows) {
        const cc = row?.probe_cc;
        if (!cc) continue;
        let entry = byCountry.get(cc);
        if (!entry) {
            entry = { country: cc, measurements: 0, ok: 0, anomaly: 0, confirmed: 0, failure: 0, methods: {} };
            byCountry.set(cc, entry);
        }
        entry.measurements += row.measurement_count || 0;
        entry.ok += row.ok_count || 0;
        entry.anomaly += row.anomaly_count || 0;
        entry.confirmed += row.confirmed_count || 0;
        entry.failure += row.failure_count || 0;

        const bt = row.blocking_type;
        if (BLOCKING_TYPES.has(bt)) {
            const hits = (row.anomaly_count || 0) + (row.confirmed_count || 0);
            if (hits > 0) entry.methods[bt] = (entry.methods[bt] || 0) + hits;
        }
    }

    const blockedShare = (e) => e.measurements ? (e.anomaly + e.confirmed) / e.measurements : 0;

    return [...byCountry.values()]
        .map((e) => ({ ...e, tier: classifyTier(e) }))
        .sort((a, b) =>
            (TIER_ORDER[a.tier] - TIER_ORDER[b.tier])
            || (blockedShare(b) - blockedShare(a))
            || (b.measurements - a.measurements)
        );
};
