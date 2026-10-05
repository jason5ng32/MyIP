// CAIDA ASRank client — global rank, customer cone and degree for one ASN via
// their GraphQL API, for /api/asn-profile. Academic service with no SLA:
// queryAsRank throws on any upstream failure, and the aggregate marks the
// section failed (and keeps that answer off the edge cache).
//
// ASRank's customer cone is path-observed and is the citable number; a naive
// transitive closure over as-rel p2c edges overestimates it badly for
// mixed-role networks.
//
// Source: https://api.asrank.caida.org/v2/graphql (free, no auth)

import { fetchUpstream } from './fetch-with-timeout.js';

const ASRANK_ENDPOINT = 'https://api.asrank.caida.org/v2/graphql';

const QUERY = `query Asn($asn: String!) {
    asn(asn: $asn) {
        rank
        asnName
        organization { orgName }
        country { iso }
        asnDegree { provider peer customer transit }
        cone { numberAsns numberPrefixes numberAddresses }
    }
}`;

// GraphQL response body → flat record; null when the ASN is unknown to
// ASRank. Exported for tests.
export const mapAsRankResponse = (body) => {
    const asn = body?.data?.asn;
    if (!asn) return null;
    return {
        rank: asn.rank ?? null,
        asnName: asn.asnName || null,
        orgName: asn.organization?.orgName || null,
        country: asn.country?.iso || null,
        degree: {
            providers: asn.asnDegree?.provider ?? null,
            peers: asn.asnDegree?.peer ?? null,
            customers: asn.asnDegree?.customer ?? null,
            transits: asn.asnDegree?.transit ?? null,
        },
        cone: {
            asns: asn.cone?.numberAsns ?? null,
            prefixes: asn.cone?.numberPrefixes ?? null,
            addresses: asn.cone?.numberAddresses ?? null,
        },
    };
};

// A 200 body is only an answer once GraphQL says so: any `errors` entry
// fails it, even beside a usable `data.asn` — fields a failed resolver left
// null would read as "ASRank has no figure" and get cached. A body without a
// `data` object is malformed. Exported for tests.
export const checkAsRankBody = (body) => {
    if (Array.isArray(body?.errors) && body.errors.length > 0) {
        throw new Error(`ASRank GraphQL error: ${body.errors[0]?.message || 'unknown'}`);
    }
    if (!body?.data || typeof body.data !== 'object') throw new Error('ASRank returned a malformed body');
    return body;
};

// ASRank record for an ASN; null when ASRank doesn't know it. Throws on an
// upstream failure (non-2xx, unparsable body, GraphQL errors), so callers
// that need to tell the two apart can.
export const queryAsRank = async (asn, { timeoutMs = 4000 } = {}) => {
    const res = await fetchUpstream(ASRANK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: QUERY, variables: { asn: String(asn) } }),
        timeoutMs,
    });
    if (!res.ok) throw new Error(`ASRank responded ${res.status}`);
    return mapAsRankResponse(checkAsRankBody(await res.json()));
};
