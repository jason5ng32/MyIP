// /api/asn-profile?asn=<n> — everything the ASN Profile page shows, in one
// answer: Radar ASN summary + prefix list (common/cf-radar.js), CAIDA
// topology and neighbours (./asn-connectivity.js), RDAP autnum
// (common/rdap.js), ASRank (common/asrank.js), the local PeeringDB index
// (common/peeringdb-db.js) and, when the private API is configured,
// reputation (common/asn-reputation.js). Composition, deadlines and statuses
// live in common/asn-profile.js. `asn` arrives as a canonical number string
// (requireValidASN). 200 unless every configured source failed (502).

import { RADAR_VIEWS, hasRadarApiKey, loadAsnSummary, isCompleteRadarAnswer } from '../common/cf-radar.js';
import { rdapAutnum, isAutnumMissing } from '../common/rdap.js';
import { queryAsRank } from '../common/asrank.js';
import { requestAsnReputation } from '../common/asn-reputation.js';
import { isPeeringdbLoaded, lookupPeeringdb } from '../common/peeringdb-db.js';
import { isAsRelLoaded } from '../common/as-rel-db.js';
import { isAsOrgLoaded } from '../common/as-org-db.js';
import { isStillLoading } from '../common/offline-data.js';
import {
    SOURCE_TIMEOUTS, buildSectionLoaders, composeAsnProfile, allSourcesFailed,
} from '../common/asn-profile.js';
import { getAsnConnectivity } from './asn-connectivity.js';

// A section whose local dataset is still downloading at boot fails (status
// 'error'): left out of the answer and keeping it uncached, while every
// other section answers as usual.
const unlessLoading = (checks, label, fn) => (...args) => {
    if (isStillLoading(...checks)) throw new Error(`${label} still loading`);
    return fn(...args);
};

export default async (req, res) => {
    const asn = Number(req.query.asn);
    const loaders = buildSectionLoaders({
        hasRadarKey: hasRadarApiKey,
        // The summary plus its failed segments, so a partial one isn't cached.
        fetchRadarAsn: (n) => loadAsnSummary(String(n)),
        fetchRadarPrefixes: (n) => RADAR_VIEWS['bgp-prefixes'].fetch({ asn: String(n) }),
        isPartialPrefixes: (body) => !isCompleteRadarAnswer(body),
        getConnectivity: unlessLoading([isAsRelLoaded, isAsOrgLoaded], 'CAIDA snapshot', getAsnConnectivity),
        rdapAutnum: (n) => rdapAutnum(n, { timeoutMs: SOURCE_TIMEOUTS.autnum }),
        isAutnumMissing,
        queryAsRank: (n) => queryAsRank(n, { timeoutMs: SOURCE_TIMEOUTS.rank }),
        // Private-API pass-through: the caller's headers go upstream.
        requestReputation: (n) => requestAsnReputation(n, req.headers, { timeoutMs: SOURCE_TIMEOUTS.reputation }),
        // The index only downloads with the Cloudflare key; without it the
        // section is 'disabled', never loading.
        isPeeringdbLoaded: unlessLoading([() => !hasRadarApiKey() || isPeeringdbLoaded()], 'PeeringDB index', isPeeringdbLoaded),
        lookupPeeringdb,
    });
    const body = await composeAsnProfile(asn, loaders);
    if (allSourcesFailed(body)) {
        return res.status(502).json({ error: 'All sources failed', status: body.status });
    }
    return res.json(body);
};
