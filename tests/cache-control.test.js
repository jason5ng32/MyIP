// Tests for common/cache-control.js — the cacheable() middleware: the full
// TTL on a 2xx JSON body, nothing on an error, the cacheIf veto and the
// degraded TTL it can fall back to.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cacheable } from '../common/cache-control.js';

// Run the middleware, then answer `body` with `status`; returns the
// Cache-Control header it left (undefined = the /api no-store default).
const answer = (middleware, { status = 200, body = {}, req = {} } = {}) => {
    const headers = {};
    const res = {
        statusCode: status,
        locals: {},
        setHeader: (name, value) => { headers[name] = value; },
        json: () => res,
    };
    middleware(req, res, () => {});
    res.json(body);
    return headers['Cache-Control'];
};

describe('cacheable', () => {
    it('stamps the full TTL on a 2xx body, nothing on an error', () => {
        assert.equal(answer(cacheable(60)), 'public, max-age=60');
        assert.equal(answer(cacheable(60), { status: 502 }), undefined);
    });

    it('resolves the TTL per request; falsy keeps no-store', () => {
        const ttl = (req) => ({ a: 30 })[req.query.view];
        assert.equal(answer(cacheable(ttl), { req: { query: { view: 'a' } } }), 'public, max-age=30');
        assert.equal(answer(cacheable(ttl), { req: { query: { view: 'b' } } }), undefined);
    });

    it('leaves a vetoed body uncached without a degraded TTL', () => {
        assert.equal(answer(cacheable(60, { cacheIf: (body) => body.ok }), { body: { ok: false } }), undefined);
        assert.equal(answer(cacheable(60, { cacheIf: (body) => body.ok }), { body: { ok: true } }), 'public, max-age=60');
    });

    it('gives a vetoed body the degraded TTL, resolved when the body is sent', () => {
        let booting = true;
        const middleware = () => cacheable(604800, { cacheIf: (body) => body.ok, degradedMaxAge: () => (booting ? 0 : 86400) });
        assert.equal(answer(middleware(), { body: { ok: false } }), undefined, 'nothing degraded while booting');
        booting = false;
        assert.equal(answer(middleware(), { body: { ok: false } }), 'public, max-age=86400');
        assert.equal(answer(middleware(), { body: { ok: true } }), 'public, max-age=604800');
        assert.equal(answer(cacheable(604800, { cacheIf: () => false, degradedMaxAge: 3600 })), 'public, max-age=3600');
        assert.equal(answer(middleware(), { status: 502, body: { ok: false } }), undefined, 'never on an error');
    });
});
