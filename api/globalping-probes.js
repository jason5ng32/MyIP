// /api/globalping-probes — compact country inventory of online Globalping
// probes for the frontend country pickers (MtrTest / GlobalLatencyTest /
// CensorshipCheck). Proxying instead of hitting api.globalping.io from the
// browser trades the multi-hundred-KB raw probe list for a few hundred
// bytes, probe-country coverage changes slowly.

import { fetchUpstream } from '../common/fetch-with-timeout.js';
import { buildProbeInventory } from '../common/globalping-inventory.js';
import logger from '../common/logger.js';

const GLOBALPING_PROBES_URL = 'https://api.globalping.io/v1/probes';

export default async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const response = await fetchUpstream(GLOBALPING_PROBES_URL);
        if (!response.ok) {
            throw new Error(`Globalping probes responded with status ${response.status}`);
        }
        res.json(buildProbeInventory(await response.json()));
    } catch (error) {
        logger.error({ err: error }, 'globalping-probes handler failed');
        res.status(500).json({ error: error.message });
    }
};
