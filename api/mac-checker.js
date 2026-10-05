// /api/macchecker?mac= — MAC Lookup against the local IEEE registries
// (server/datasets/oui-db.js). `mac` is a full address or a vendor prefix of 6–12
// hex digits (common/mac-input.js). The answer names the block that covers
// it, its range and the first-octet flags; an address no block covers is
// still a 200 with `found: false`.

import { normalizeMacQuery } from '../common/mac-input.js';
import { lookupMac } from '../server/datasets/oui-db.js';

// `lookup` is injectable so tests can run the handler over fixture registries.
export const createMacChecker = (lookup) => async (req, res) => {
    const { mac } = req.query;
    if (!mac) {
        return res.status(400).json({ error: 'No MAC address provided' });
    }
    const hex = normalizeMacQuery(String(mac));
    if (!hex) {
        return res.status(400).json({ error: 'Invalid MAC address' });
    }

    // Past the boot window (requireOfflineData) only a failed download leaves this empty.
    const result = lookup(hex);
    if (!result) {
        return res.status(503).json({ error: 'MAC database unavailable' });
    }
    res.json(result);
};

export default createMacChecker(lookupMac);
