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

// A section whose local data isn't there fails (status 'error'): left out
// of the answer and keeping it out of the week-long cache, while every other
// section answers as usual — never an 'empty' / 'disabled' that would be
// cached for a week.

// Connectivity needs the as-rel snapshot (without it every graph is empty);
// as2org only names the nodes, RIPEstat covers a failed download, so it
// counts only while still downloading. Exported for tests.
export const connectivityReadiness = ({ relLoaded = isAsRelLoaded, orgLoaded = isAsOrgLoaded, fetch = getAsnConnectivity } = {}) =>
    (...args) => {
        if (!relLoaded()) throw new Error('CAIDA as-rel snapshot not loaded');
        if (isStillLoading(orgLoaded)) throw new Error('CAIDA as2org snapshot still loading');
        return fetch(...args);
    };

// PeeringDB is 'disabled' only where it isn't configured (no Cloudflare key,
// so never downloaded). Configured but not loaded — still downloading, or
// the download failed — is an error. Exported for tests.
export const peeringdbReadiness = ({ configured = hasRadarApiKey, loaded = isPeeringdbLoaded } = {}) => () => {
    if (!configured()) return false;
    if (!loaded()) throw new Error('PeeringDB index not loaded');
    return true;
};

export default async (req, res) => {
    const asn = Number(req.query.asn);
    const loaders = buildSectionLoaders({
        hasRadarKey: hasRadarApiKey,
        // The summary plus its failed segments, so a partial one isn't cached.
        fetchRadarAsn: (n) => loadAsnSummary(String(n)),
        fetchRadarPrefixes: (n) => RADAR_VIEWS['bgp-prefixes'].fetch({ asn: String(n) }),
        isPartialPrefixes: (body) => !isCompleteRadarAnswer(body),
        getConnectivity: connectivityReadiness(),
        rdapAutnum: (n) => rdapAutnum(n, { timeoutMs: SOURCE_TIMEOUTS.autnum }),
        isAutnumMissing,
        queryAsRank: (n) => queryAsRank(n, { timeoutMs: SOURCE_TIMEOUTS.rank }),
        // Private-API pass-through: the caller's headers go upstream.
        requestReputation: (n) => requestAsnReputation(n, req.headers, { timeoutMs: SOURCE_TIMEOUTS.reputation }),
        isPeeringdbLoaded: peeringdbReadiness(),
        lookupPeeringdb,
    });
    const body = await composeAsnProfile(asn, loaders);
    if (allSourcesFailed(body)) {
        return res.status(502).json({ error: 'All sources failed', status: body.status });
    }
    return res.json(body);
};
