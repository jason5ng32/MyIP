// Boot-time readiness of the offline datasets (MaxMind, CAIDA, PeeringDB) and
// the primed service-status snapshot. The backend listens before any of them
// is downloaded; runOfflineBootstrap marks that window, and requireOfflineData
// answers 503 on a route whose data is still missing inside it. Outside the
// window a missing dataset is a failed download, served degraded as before.
//
// Snapshots already on disk are loaded before the listener opens (CAIDA and
// PeeringDB at import, MaxMind in backend-server.js), so an ordinary restart
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

// `checks` are the route's `() => boolean` readiness probes (isMaxMindReady,
// isAsRelLoaded, …), or a `(req) => checks` resolver for routes whose data
// depends on the request (the /api/cfradar view registry). 503 is never
// edge-cached (cacheable only stamps < 400), so nothing degraded is pinned.
export const requireOfflineData = (checks) => (req, res, next) => {
    if (!booting) return next();
    const list = typeof checks === 'function' ? checks(req) : checks;
    if (list?.some((isReady) => !isReady())) {
        res.setHeader('Retry-After', '30');
        return res.status(503).json({ error: 'Offline data is loading' });
    }
    next();
};
