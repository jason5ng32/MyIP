// Unit tests for the CAIDA ASRank client in common/asrank.js: the pure
// GraphQL response mapper, and fetchAsRank's request shape and null-on-
// failure contract (fetch stubbed; real network stays out of scope).
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { mapAsRankResponse, fetchAsRank } from '../common/asrank.js';
import logger from '../common/logger.js';

const FULL_BODY = {
    data: {
        asn: {
            rank: 64,
            asnName: 'CLOUDFLARENET',
            organization: { orgName: 'Cloudflare, Inc.' },
            country: { iso: 'US' },
            asnDegree: { provider: 151, peer: 423, customer: 962, transit: 1286 },
            cone: { numberAsns: 963, numberPrefixes: 35738, numberAddresses: 32408873 },
        },
    },
};

describe('mapAsRankResponse', () => {
    it('flattens a full GraphQL response', () => {
        assert.deepEqual(mapAsRankResponse(FULL_BODY), {
            rank: 64,
            asnName: 'CLOUDFLARENET',
            orgName: 'Cloudflare, Inc.',
            country: 'US',
            degree: { providers: 151, peers: 423, customers: 962, transits: 1286 },
            cone: { asns: 963, prefixes: 35738, addresses: 32408873 },
        });
    });

    it('nulls missing sub-objects instead of throwing', () => {
        const mapped = mapAsRankResponse({ data: { asn: { rank: 1 } } });
        assert.equal(mapped.rank, 1);
        assert.deepEqual(mapped.cone, { asns: null, prefixes: null, addresses: null });
        assert.deepEqual(mapped.degree, { providers: null, peers: null, customers: null, transits: null });
    });

    it('returns null for an unknown ASN or malformed body', () => {
        assert.equal(mapAsRankResponse({ data: { asn: null } }), null);
        assert.equal(mapAsRankResponse(undefined), null);
    });
});

describe('fetchAsRank', () => {
    const originalFetch = globalThis.fetch;
    const originalWarn = logger.warn;
    afterEach(() => {
        globalThis.fetch = originalFetch;
        logger.warn = originalWarn;
    });

    it('POSTs the GraphQL query with the ASN as a string variable', async () => {
        let request;
        globalThis.fetch = async (url, init) => {
            request = { url: String(url), init };
            return new Response(JSON.stringify(FULL_BODY));
        };
        const record = await fetchAsRank(13335);
        assert.equal(request.url, 'https://api.asrank.caida.org/v2/graphql');
        assert.equal(request.init.method, 'POST');
        assert.deepEqual(JSON.parse(request.init.body).variables, { asn: '13335' });
        assert.equal(record.rank, 64);
    });

    it('returns null on a non-2xx answer or a network failure', async () => {
        logger.warn = () => {};
        globalThis.fetch = async () => new Response('busy', { status: 503 });
        assert.equal(await fetchAsRank(13335), null);
        globalThis.fetch = async () => { throw new Error('connect timeout'); };
        assert.equal(await fetchAsRank(13335), null);
    });
});
