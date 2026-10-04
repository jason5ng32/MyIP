// scripts/fetch-offline-data.js — download every offline dataset the backend
// reads (MaxMind GeoLite2, CAIDA as2org / as-rel, the PeeringDB index) ahead
// of a first start, so the server boots with all of them in place. Runs as
// `pnpm fetch-offline-data`; safe to repeat, and safe beside a running server
// (the updaters' file locks serialize the two; the server's file watcher and
// next scheduled tick pick up what this publishes).
//
// The same .env gates as the server's boot download decide what is fetched:
// MaxMind needs MAXMIND_ACCOUNT_ID + MAXMIND_LICENSE_KEY, PeeringDB needs the
// Cloudflare key, the CAIDA rows always run. A snapshot published within the
// last 24 hours is skipped without touching the network; an older one is
// re-downloaded only when the remote has a newer version.
//
// Exits 1 when any dataset failed or couldn't be checked (another process
// held its lock).

import dotenv from 'dotenv';

dotenv.config({ quiet: true });

// After dotenv: the logger and the updaters read the environment at import.
const { initUpstreamUserAgent } = await import('../common/upstream-ua.js');
const { syncMaxMindDatabases } = await import('../common/maxmind-updater.js');
const { datasets, syncDataset } = await import('../common/caida-updater.js');

initUpstreamUserAgent();

const NOTES = {
    'missing-credentials': 'skipped — MAXMIND_ACCOUNT_ID / MAXMIND_LICENSE_KEY not set',
    present: 'on disk; no credentials to check for updates',
    disabled: 'skipped — needs CLOUDFLARE_API_KEY',
    fresh: 'up to date (published within 24 h)',
    'not-modified': 'up to date (remote unchanged)',
    downloaded: 'downloaded',
    locked: 'not checked — another process is updating it; re-run once it finishes',
    'already-running': 'not checked — an update is already running; re-run once it finishes',
};

// Outcomes that leave the dataset unconfirmed: reported, and counted as a
// failure so a scripted first start doesn't proceed as if it were ready.
const UNCONFIRMED = new Set(['locked', 'already-running']);

const jobs = [
    ['maxmind', syncMaxMindDatabases],
    ...datasets.map((dataset) => [dataset.id, () => syncDataset(dataset)]),
];

let failed = 0;
for (const [id, run] of jobs) {
    try {
        const { status } = await run();
        if (UNCONFIRMED.has(status)) {
            failed++;
            console.warn(`⚠️  ${id}: ${NOTES[status]}`);
        } else {
            console.log(`✅ ${id}: ${NOTES[status] || status}`);
        }
    } catch (error) {
        failed++;
        console.error(`❌ ${id}: ${error.message}`);
    }
}

// Explicit exit: the logger's pretty-print worker would otherwise hold the
// process open.
process.exit(failed ? 1 : 0);
