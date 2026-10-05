import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { requireReferer, requirePublicIP, requireValidPrefix, requireValidDomain, requireValidProviderId, requireValidRecordType, requireValidReportId, requireValidCountry, requireValidASN, normalizeAsnQuery } from '../common/guards.js';

// Minimal (req, res, next) stubs — just enough to observe what the
// middleware does.
function makeReq({ referer, query = {} } = {}) {
    return {
        headers: referer ? { referer } : {},
        query,
    };
}

function makeRes() {
    const res = {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
    };
    return res;
}

describe('requireReferer', () => {
    it('calls next() when the referer is on the allow-list (localhost)', () => {
        let nextCalled = false;
        const req = makeReq({ referer: 'http://localhost/foo' });
        requireReferer(req, makeRes(), () => { nextCalled = true; });
        assert.equal(nextCalled, true);
    });

    it('returns 403 "What are you doing?" when no referer header', () => {
        const res = makeRes();
        let nextCalled = false;
        requireReferer(makeReq(), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.error, 'What are you doing?');
        assert.equal(nextCalled, false);
    });

    it('returns 403 "Access denied" when referer is not on the allow-list', () => {
        const res = makeRes();
        let nextCalled = false;
        requireReferer(makeReq({ referer: 'http://evil.example/x' }), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.error, 'Access denied');
        assert.equal(nextCalled, false);
    });
});

describe('requirePublicIP', () => {
    const guard = requirePublicIP();

    it('calls next() when ip query param is a valid IPv4', () => {
        let nextCalled = false;
        guard(makeReq({ query: { ip: '1.1.1.1' } }), makeRes(), () => { nextCalled = true; });
        assert.equal(nextCalled, true);
    });

    it('calls next() when ip query param is a valid IPv6', () => {
        let nextCalled = false;
        guard(makeReq({ query: { ip: '2001:4860:4860::8888' } }), makeRes(), () => { nextCalled = true; });
        assert.equal(nextCalled, true);
    });

    it('returns 400 "No IP address provided" when ip is missing', () => {
        const res = makeRes();
        let nextCalled = false;
        guard(makeReq({ query: {} }), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.error, 'No IP address provided');
        assert.equal(nextCalled, false);
    });

    it('returns 400 "Invalid IP address" when ip is malformed', () => {
        const res = makeRes();
        let nextCalled = false;
        guard(makeReq({ query: { ip: 'nope' } }), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.error, 'Invalid IP address');
        assert.equal(nextCalled, false);
    });

    it('rejects leading-zero IPv4 input before reaching an upstream handler', () => {
        const res = makeRes();
        let nextCalled = false;
        guard(makeReq({ query: { ip: '8.8.8.08' } }), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.error, 'Invalid IP address');
        assert.equal(nextCalled, false);
    });

    // Reserved space is well-formed but unanswerable by any upstream, so it
    // gets its own message — rejected before the handler, never fetched.
    for (const ip of ['10.0.0.1', '192.168.1.1', '127.0.0.1', '198.18.0.2', 'fd00::1', '::1']) {
        it(`returns 400 "Not a public IP address" for ${ip}`, () => {
            const res = makeRes();
            let nextCalled = false;
            guard(makeReq({ query: { ip } }), res, () => { nextCalled = true; });
            assert.equal(res.statusCode, 400);
            assert.equal(res.body.error, 'Not a public IP address');
            assert.equal(nextCalled, false);
        });
    }

    it('honors a custom param name', () => {
        const custom = requirePublicIP('target');
        let nextCalled = false;
        custom(makeReq({ query: { target: '8.8.8.8' } }), makeRes(), () => { nextCalled = true; });
        assert.equal(nextCalled, true);
    });
});

describe('requireValidPrefix', () => {
    const guard = requireValidPrefix();

    it('calls next() when prefix is a valid IPv4 CIDR', () => {
        let nextCalled = false;
        guard(makeReq({ query: { prefix: '8.8.8.0/24' } }), makeRes(), () => { nextCalled = true; });
        assert.equal(nextCalled, true);
    });

    it('calls next() when prefix is a valid IPv6 CIDR', () => {
        let nextCalled = false;
        guard(makeReq({ query: { prefix: '2001:4860:4860::/48' } }), makeRes(), () => { nextCalled = true; });
        assert.equal(nextCalled, true);
    });

    it('returns 400 "No prefix provided" when prefix is missing', () => {
        const res = makeRes();
        let nextCalled = false;
        guard(makeReq({ query: {} }), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.error, 'No prefix provided');
        assert.equal(nextCalled, false);
    });

    it('returns 400 "Invalid prefix" when prefix is malformed', () => {
        const res = makeRes();
        let nextCalled = false;
        guard(makeReq({ query: { prefix: '8.8.8.0' } }), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.error, 'Invalid prefix');
        assert.equal(nextCalled, false);
    });

    it('returns 400 when prefix length is out of v4 range', () => {
        const res = makeRes();
        guard(makeReq({ query: { prefix: '8.8.8.0/33' } }), res, () => {});
        assert.equal(res.statusCode, 400);
    });
});

describe('requireValidCountry', () => {
    const guard = requireValidCountry();

    it('calls next() and uppercases the code in place', () => {
        let nextCalled = false;
        const req = makeReq({ query: { country: 'iq' } });
        guard(req, makeRes(), () => { nextCalled = true; });
        assert.equal(nextCalled, true);
        assert.equal(req.query.country, 'IQ');
    });

    it('returns 400 "No country provided" when country is missing', () => {
        const res = makeRes();
        let nextCalled = false;
        guard(makeReq({ query: {} }), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.error, 'No country provided');
        assert.equal(nextCalled, false);
    });

    it('returns 400 "Invalid country" for anything but two letters', () => {
        for (const bad of ['USA', 'U', 'U1', 'us,de', 'ÜS']) {
            const res = makeRes();
            guard(makeReq({ query: { country: bad } }), res, () => {});
            assert.equal(res.statusCode, 400, bad);
            assert.equal(res.body.error, 'Invalid country', bad);
        }
    });
});

describe('requireValidProviderId', () => {
    const guard = requireValidProviderId();

    it('calls next() for a whitelisted provider id', () => {
        let nextCalled = false;
        guard(makeReq({ query: { id: 'claude' } }), makeRes(), () => { nextCalled = true; });
        assert.equal(nextCalled, true);
    });

    it('returns 400 "No provider id provided" when id is missing', () => {
        const res = makeRes();
        let nextCalled = false;
        guard(makeReq({ query: {} }), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.error, 'No provider id provided');
        assert.equal(nextCalled, false);
    });

    it('returns 400 "Invalid provider id" for an unknown id', () => {
        const res = makeRes();
        let nextCalled = false;
        guard(makeReq({ query: { id: 'not-a-provider' } }), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.error, 'Invalid provider id');
        assert.equal(nextCalled, false);
    });
});

describe('requireValidReportId', () => {
    const guard = requireValidReportId();
    // A report id is 16 random bytes as base64url — always exactly 22 chars.
    const validId = 'AbC123-_xyz987654321ab';

    // This guard reads req.params (route param), not req.query.
    const makeParamsReq = (params) => ({ headers: {}, params });

    it('calls next() for a well-formed 22-char base64url id', () => {
        let nextCalled = false;
        guard(makeParamsReq({ id: validId }), makeRes(), () => { nextCalled = true; });
        assert.equal(nextCalled, true);
    });

    it('returns 400 when the id is missing', () => {
        const res = makeRes();
        let nextCalled = false;
        guard(makeParamsReq({}), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.error, 'Invalid report id');
        assert.equal(nextCalled, false);
    });

    it('returns 400 for wrong length or non-base64url characters', () => {
        for (const bad of ['short', 'a'.repeat(23), 'a'.repeat(21), `${'a'.repeat(21)}+`, `${'a'.repeat(21)}/`]) {
            const res = makeRes();
            let nextCalled = false;
            guard(makeParamsReq({ id: bad }), res, () => { nextCalled = true; });
            assert.equal(res.statusCode, 400, `should reject "${bad}"`);
            assert.equal(nextCalled, false);
        }
    });
});

describe('requireValidRecordType', () => {
    const guard = requireValidRecordType();

    it('calls next() for a supported type', () => {
        let nextCalled = false;
        guard(makeReq({ query: { type: 'CAA' } }), makeRes(), () => { nextCalled = true; });
        assert.equal(nextCalled, true);
    });

    it('uppercases the type in place so the handler switch matches', () => {
        const req = makeReq({ query: { type: 'caa' } });
        guard(req, makeRes(), () => {});
        assert.equal(req.query.type, 'CAA');
    });

    it('rejects a missing type', () => {
        const res = makeRes();
        let nextCalled = false;
        guard(makeReq({ query: {} }), res, () => { nextCalled = true; });
        assert.equal(nextCalled, false);
        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { error: 'No record type provided' });
    });

    it('rejects a type the resolver does not handle, so DoH never forwards it', () => {
        for (const type of ['ANY', 'DNSKEY', 'HTTPS', 'PTR', '../etc']) {
            const res = makeRes();
            let nextCalled = false;
            guard(makeReq({ query: { type } }), res, () => { nextCalled = true; });
            assert.equal(nextCalled, false, type);
            assert.equal(res.statusCode, 400);
            assert.deepEqual(res.body, { error: 'Invalid record type' });
        }
    });
});

describe('requireValidDomain', () => {
    const guard = requireValidDomain();

    it('calls next() for a valid domain', () => {
        let nextCalled = false;
        guard(makeReq({ query: { domain: 'example.com' } }), makeRes(), () => { nextCalled = true; });
        assert.equal(nextCalled, true);
    });

    it('lowercases the domain in place (canonical cache key)', () => {
        const req = makeReq({ query: { domain: 'WWW.Example.COM' } });
        let nextCalled = false;
        guard(req, makeRes(), () => { nextCalled = true; });
        assert.equal(nextCalled, true);
        assert.equal(req.query.domain, 'www.example.com');
    });

    it('supports a custom query parameter name', () => {
        const hostnameGuard = requireValidDomain('hostname');
        const req = makeReq({ query: { hostname: 'WWW.Example.COM' } });
        let nextCalled = false;
        hostnameGuard(req, makeRes(), () => { nextCalled = true; });
        assert.equal(nextCalled, true);
        assert.equal(req.query.hostname, 'www.example.com');
    });

    it('returns 400 when the domain is missing', () => {
        const res = makeRes();
        let nextCalled = false;
        guard(makeReq({ query: {} }), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.error, 'No domain provided');
        assert.equal(nextCalled, false);
    });

    it('returns 400 for non-domain inputs', () => {
        for (const bad of ['not a domain', 'nodot', '1.2.3.4.5.', 'http://example.com', 'exa_mple.com']) {
            const res = makeRes();
            let nextCalled = false;
            guard(makeReq({ query: { domain: bad } }), res, () => { nextCalled = true; });
            assert.equal(res.statusCode, 400, `should reject "${bad}"`);
            assert.equal(nextCalled, false);
        }
    });
});

describe('requireValidASN', () => {
    const guard = requireValidASN();

    it('canonicalizes to the bare number string in place', () => {
        for (const [input, expected] of [['13335', '13335'], ['AS13335', '13335'], ['as13335', '13335'],
            ['AS013335', '13335'], ['0013335', '13335'], [' 13335 ', '13335'], ['1', '1'],
            ['4294967295', '4294967295'], ['AS4294967295', '4294967295']]) {
            const req = makeReq({ query: { asn: input } });
            let nextCalled = false;
            guard(req, makeRes(), () => { nextCalled = true; });
            assert.equal(nextCalled, true, input);
            assert.equal(req.query.asn, expected, input);
        }
    });

    it('returns 400 "No ASN provided" when the param is missing', () => {
        const res = makeRes();
        let nextCalled = false;
        guard(makeReq(), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.error, 'No ASN provided');
        assert.equal(nextCalled, false);
    });

    it('returns 400 for AS0, values past 32 bits, overlong digit strings and non-ASNs', () => {
        for (const bad of ['0', 'AS0', '000', '4294967296', 'AS99999999999', '00000000013335', '9'.repeat(400),
            'ASN13335', '13335a', '-1', '1.5', 'AS 13335', 'not-an-asn', ['1', '2']]) {
            const res = makeRes();
            let nextCalled = false;
            guard(makeReq({ query: { asn: bad } }), res, () => { nextCalled = true; });
            assert.equal(res.statusCode, 400, `should reject "${bad}"`);
            assert.equal(res.body.error, 'Invalid ASN');
            assert.equal(nextCalled, false);
        }
    });

    it('honours a custom param name', () => {
        const req = makeReq({ query: { origin: 'AS64500' } });
        let nextCalled = false;
        requireValidASN('origin')(req, makeRes(), () => { nextCalled = true; });
        assert.equal(nextCalled, true);
        assert.equal(req.query.origin, '64500');
    });
});

describe('normalizeAsnQuery', () => {
    const guard = normalizeAsnQuery();

    it('canonicalizes ASN-shaped values to AS<n> in place', () => {
        for (const [input, expected] of [['AS13335', 'AS13335'], ['as13335', 'AS13335'], ['As13335', 'AS13335'],
            ['AS013335', 'AS13335'], [' AS13335 ', 'AS13335'], ['AS4294967295', 'AS4294967295']]) {
            const req = makeReq({ query: { q: input } });
            let nextCalled = false;
            guard(req, makeRes(), () => { nextCalled = true; });
            assert.equal(nextCalled, true, input);
            assert.equal(req.query.q, expected, input);
        }
    });

    it('returns 400 for AS0 and values past 32 bits', () => {
        for (const bad of ['AS0', 'as0', 'AS4294967296', 'AS99999999999']) {
            const res = makeRes();
            let nextCalled = false;
            guard(makeReq({ query: { q: bad } }), res, () => { nextCalled = true; });
            assert.equal(res.statusCode, 400, `should reject "${bad}"`);
            assert.equal(res.body.error, 'Invalid ASN');
            assert.equal(nextCalled, false);
        }
    });

    it('passes IPs, domains, bare numbers, missing and array values through untouched', () => {
        for (const query of [{ q: '1.1.1.1' }, { q: 'example.com' }, { q: 'ASN13335' }, {}, { q: ['AS1', 'AS2'] },
            { q: '13335' }, { q: '0' }, { q: '99999999999' }]) {
            const req = makeReq({ query: { ...query } });
            let nextCalled = false;
            guard(req, makeRes(), () => { nextCalled = true; });
            assert.equal(nextCalled, true);
            assert.deepEqual(req.query, query);
        }
    });
});
