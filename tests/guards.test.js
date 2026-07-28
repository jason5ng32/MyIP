import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { requireReferer, requireValidIP, requireValidPrefix, requireValidDomain, requireValidProviderId, requireValidReportId } from '../common/guards.js';

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

describe('requireValidIP', () => {
    const guard = requireValidIP();

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

    it('honors a custom param name', () => {
        const custom = requireValidIP('target');
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
