// Unit tests for the CAIDA ASRank client in server/asrank.js: the pure
// GraphQL response mapper and body check, and queryAsRank's request shape,
// null for an unknown ASN and throw-on-failure contract (fetch stubbed; real network
// stays out of scope).
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { checkAsRankBody, mapAsRankResponse, queryAsRank } from '../server/asrank.js';

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

describe('checkAsRankBody', () => {
    it('passes a body with data and no errors', () => {
        assert.equal(checkAsRankBody(FULL_BODY), FULL_BODY);
        const unknown = { data: { asn: null } };
        assert.equal(checkAsRankBody(unknown), unknown);
        assert.equal(checkAsRankBody({ ...unknown, errors: [] }).data, unknown.data);
    });

    it('throws on GraphQL errors, with or without data', () => {
        assert.throws(() => checkAsRankBody({ errors: [{ message: 'timeout' }], data: { asn: null } }), /GraphQL error: timeout/);
        assert.throws(() => checkAsRankBody({ errors: [{ message: 'cone failed' }], data: FULL_BODY.data }), /cone failed/);
        assert.throws(() => checkAsRankBody({ errors: [{}] }), /GraphQL error/);
    });

    it('throws on a body without a data object', () => {
        for (const body of [null, undefined, {}, { data: null }, 'oops']) {
            assert.throws(() => checkAsRankBody(body), /malformed/, String(body));
        }
    });
});

describe('queryAsRank', () => {
    const originalFetch = globalThis.fetch;
    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('POSTs the GraphQL query with the ASN as a string variable', async () => {
        let request;
        globalThis.fetch = async (url, init) => {
            request = { url: String(url), init };
            return new Response(JSON.stringify(FULL_BODY));
        };
        const record = await queryAsRank(13335);
        assert.equal(request.url, 'https://api.asrank.caida.org/v2/graphql');
        assert.equal(request.init.method, 'POST');
        assert.deepEqual(JSON.parse(request.init.body).variables, { asn: '13335' });
        assert.equal(record.rank, 64);
    });

    it('resolves null for an ASN ASRank does not know', async () => {
        globalThis.fetch = async () => new Response(JSON.stringify({ data: { asn: null } }));
        assert.equal(await queryAsRank(64512), null);
    });

    it('throws on a 200 carrying GraphQL errors instead of reading it as unknown', async () => {
        globalThis.fetch = async () => new Response(JSON.stringify({ errors: [{ message: 'upstream timeout' }], data: { asn: null } }));
        await assert.rejects(queryAsRank(13335), /GraphQL error: upstream timeout/);
        globalThis.fetch = async () => new Response('<html>oops</html>');
        await assert.rejects(queryAsRank(13335));
    });

    it('throws on a non-2xx answer or a network failure', async () => {
        globalThis.fetch = async () => new Response('busy', { status: 503 });
        await assert.rejects(queryAsRank(13335), /ASRank responded 503/);
        globalThis.fetch = async () => { throw new Error('connect timeout'); };
        await assert.rejects(queryAsRank(13335), /connect timeout/);
    });
});
