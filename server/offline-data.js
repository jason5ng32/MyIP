// Boot-time readiness of the offline datasets (server/datasets/datasets.js) and
// the primed service-status snapshot. The backend listens before any of them
// is downloaded; runOfflineBootstrap marks that window, and requireOfflineData
// answers 503 on a route whose data is still missing inside it. Outside the
// window a missing dataset is a failed download, served degraded as before.
// A response assembled from independent parts (the ASN Profile) instead asks
// isStillLoading per part and leaves just that part out, uncached.
//
// Snapshots already on disk are loaded before the listener opens (CAIDA,
// PeeringDB and IEEE at import, MaxMind in backend-server.js), so a restart
// never hits the gate — only a first boot or a newly added dataset does.

let booting = false;

// Run the boot steps in parallel, gating until all settle. Steps log their
// own failures; one that throws still lets the gate go.
export const runOfflineBootstrap = async (steps) => {
    booting = true;
    try {
        await Promise.allSettled(steps.map((step) => Promise.resolve().then(step)));
    } finally {
        booting = false;
    }
};

// Whether the boot window is open: some offline data may still be on its way.
export const isOfflineBootstrapping = () => booting;

// Whether any of `checks` is unready inside the boot window — data that is
// on its way, as opposed to a download that already failed.
export const isStillLoading = (...checks) => booting && checks.some((isReady) => !isReady());

// `checks` are the route's `() => boolean` readiness probes (isMaxMindReady,
// isAsRelLoaded, …). 503 is never edge-cached (cacheable only stamps < 400),
// so nothing degraded is pinned.
export const requireOfflineData = (checks) => (req, res, next) => {
    if (isStillLoading(...checks)) {
        res.setHeader('Retry-After', '30');
        return res.status(503).json({ error: 'Offline data is loading' });
    }
    next();
};
