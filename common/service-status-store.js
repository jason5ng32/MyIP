// In-memory poller + cache for the "Service Status" section.
//
// Rather than fetch upstream status pages on each visitor request, a single
// background timer refreshes all providers every REFRESH_INTERVAL and keeps
// the latest normalized snapshot in memory. Request handlers just read the
// snapshot — upstream load is constant (16 providers × 2 endpoints / 5 min)
// no matter how much traffic the site gets.
//
// Mirrors the bootstrap-at-boot + start-scheduler shape of the MaxMind / CAIDA
// updaters, but kept deliberately lean: memory only, no files, no locks.

import { fetchUpstream } from './fetch-with-timeout.js';
import logger from './logger.js';
import { STATUS_PROVIDERS } from './service-status-providers.js';
import { assembleProvider } from './service-status-transform.js';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// Latest snapshot served to clients. `updatedAt` stays null until the first
// successful-or-degraded refresh lands.
let snapshot = { updatedAt: null, providers: [] };
let schedulerStarted = false;

// Fetch + parse one JSON endpoint; throws on non-2xx so the caller can degrade.
async function fetchJson(url) {
    const res = await fetchUpstream(url);
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    return res.json();
}

// Refresh a single provider. Never throws.
//
// `previous` is this provider's last published entry (if any). On a failed
// summary fetch we serve last-known-good rather than flipping a healthy
// provider to 'unknown' — upstream status pages have frequent transient
// blips (DNS hiccups, TLS resets) that shouldn't surface as "status
// unavailable". Only the genuinely-degraded case (no prior good data) is a
// warn; recoverable blips drop to debug to keep the prod log quiet.
async function refreshProvider(provider, previous) {
    const [summary, incidents] = await Promise.allSettled([
        fetchJson(`${provider.api}/api/v2/summary.json`),
        fetchJson(`${provider.api}/api/v2/incidents.json`),
    ]);
    const summaryJson = summary.status === 'fulfilled' ? summary.value : null;
    const incidentsJson = incidents.status === 'fulfilled' ? incidents.value : null;

    if (!summaryJson) {
        const hadGood = previous && previous.indicator !== 'unknown';
        if (hadGood) {
            logger.debug({ provider: provider.id }, 'service-status refresh blip; serving last-known-good');
            return previous;
        }
        logger.warn({ err: summary.reason, provider: provider.id }, 'service-status summary fetch failed (no prior data)');
    }

    const entry = assembleProvider(provider, summaryJson, incidentsJson);
    // Keep prior incidents if only the incidents endpoint blipped this tick.
    if (!incidentsJson && previous?.incidents?.length) {
        entry.incidents = previous.incidents;
    }
    return entry;
}

// Refresh every provider in parallel and publish a new snapshot. Exported so
// boot can await an initial fill before the server starts serving.
export async function refreshServiceStatus() {
    const prevById = new Map(snapshot.providers.map((p) => [p.id, p]));
    const providers = await Promise.all(
        STATUS_PROVIDERS.map((p) => refreshProvider(p, prevById.get(p.id))),
    );
    snapshot = { updatedAt: new Date().toISOString(), providers };
    return snapshot;
}

// Lightweight overview: every provider's status light, without the heavier
// components / incidents arrays. Served by /api/service-status so the initial
// page load stays small; detail is pulled per-provider on demand.
export function getServiceStatusOverview() {
    return {
        updatedAt: snapshot.updatedAt,
        providers: snapshot.providers.map(({ id, name, page, indicator }) => ({
            id, name, page, indicator,
        })),
    };
}

// One provider's full cached entry (or null if not in the snapshot yet).
// Backs the components / incidents detail endpoints.
export function getProviderDetail(id) {
    return snapshot.providers.find((p) => p.id === id) || null;
}

// Populate the cache once at boot. Non-fatal: a failure leaves an empty
// snapshot that the next scheduled tick will fill.
export async function bootstrapServiceStatus() {
    try {
        await refreshServiceStatus();
        logger.info('📦 Service status cache primed');
    } catch (error) {
        logger.warn({ err: error }, '⚠️  Service status initial refresh failed; will retry on schedule');
    }
}

// Start the 5-minute refresh loop. Idempotent; timer is unref'd so it never
// keeps the process alive on its own.
export function startServiceStatusPolling() {
    if (schedulerStarted) return;
    schedulerStarted = true;
    const tick = () => {
        refreshServiceStatus().catch((error) => {
            logger.error({ err: error }, 'service-status refresh tick failed');
        });
    };
    setInterval(tick, REFRESH_INTERVAL_MS).unref?.();
    logger.info(`🗓️  Service status auto refresh every ${REFRESH_INTERVAL_MS / 60000} minutes (${STATUS_PROVIDERS.length} providers)`);
}
