// /api/cfradar — single dispatch route for all Cloudflare Radar data.
// `?view=` selects an entry in RADAR_VIEWS (common/cf-radar.js): the view's
// guards validate and normalize its params, its fetch builds the payload,
// and the route's cache middleware in backend-server.js reads the view's
// per-view TTL. Guards run before the API-key check so param errors stay
// 400s on keyless deployments (and tests never reach an upstream call).

import { RADAR_VIEWS, hasRadarApiKey } from '../common/cf-radar.js';
import logger from '../common/logger.js';

// Run a view's guard middlewares outside an Express chain. Each guard either
// calls next() or writes its own 4xx response — so "didn't pass" means the
// response has already been sent and the dispatcher must stop.
const runGuards = (guards, req, res) => guards.every((guard) => {
    let passed = false;
    guard(req, res, () => { passed = true; });
    return passed;
});

export default async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const viewName = req.query.view;
    if (!viewName) {
        return res.status(400).json({ error: 'No view provided' });
    }
    const view = RADAR_VIEWS[viewName];
    if (!view) {
        return res.status(400).json({ error: 'Invalid view' });
    }
    if (!runGuards(view.guards, req, res)) return;
    if (!hasRadarApiKey()) {
        return res.status(500).json({ error: 'API key is missing' });
    }

    try {
        res.json(await view.fetch(req.query));
    } catch (error) {
        logger.error({ err: error, view: viewName }, 'cf-radar view failed');
        res.status(500).json({ error: 'Internal server error' });
    }
};
