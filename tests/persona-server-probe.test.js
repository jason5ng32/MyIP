// Coverage for the Cloudflare trace probe and the opt-in probes. The recurring
// theme: every failure path degrades to "not available" so the remaining checks
// still run.

import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';

import { probeTrace, parseTraceBody } from '../frontend/utils/persona/probe-server.js';
import { probeGeolocation } from '../frontend/utils/persona/probe-geolocation.js';

const originalFetch = globalThis.fetch;
const stubFetch = (impl) => { globalThis.fetch = impl; };

describe('parseTraceBody', () => {
    it('parses the key=value lines Cloudflare returns', () => {
        // Captured verbatim from 4.ipcheck.ing/cdn-cgi/trace (2026-08-18).
        const fields = parseTraceBody(
            'fl=998f55\nh=4.ipcheck.ing\nip=1.2.3.4\nts=1787029026.000\n'
            + 'visit_scheme=https\ncolo=SIN\nhttp=http/2\nloc=SG\ntls=TLSv1.3\nkex=X25519',
        );
        assert.equal(fields.loc, 'SG');
        assert.equal(fields.colo, 'SIN');
        assert.equal(fields.tls, 'TLSv1.3');
    });

    it('ignores blank and malformed lines', () => {
        const fields = parseTraceBody('loc=JP\n\ngarbage\n=novalue\ncolo=NRT');
        assert.deepEqual(fields, { loc: 'JP', colo: 'NRT' });
    });
});

describe('probeTrace', () => {
    afterEach(() => { globalThis.fetch = originalFetch; });

    it('reads the country and PoP out of a trace response', async () => {
        stubFetch(async () => new Response('loc=jp\ncolo=NRT\ntls=TLSv1.3\nhttp=http/3', { status: 200 }));
        const result = await probeTrace();
        assert.equal(result.available, true);
        assert.equal(result.country, 'JP', 'country codes are uppercased');
        assert.equal(result.colo, 'NRT');
    });

    it('reports unavailable rather than throwing when the endpoint fails', async () => {
        stubFetch(async () => { throw new TypeError('network'); });
        const result = await probeTrace();
        assert.equal(result.available, false);
        assert.equal(result.reason, 'unreachable');
    });

    it('reports the status when the endpoint refuses', async () => {
        stubFetch(async () => new Response('', { status: 503 }));
        assert.equal((await probeTrace()).reason, 'http-503');
    });
});

describe('probeGeolocation', () => {
    const originalNavigator = globalThis.navigator;
    afterEach(() => {
        Object.defineProperty(globalThis, 'navigator', {
            configurable: true, writable: true, value: originalNavigator,
        });
        globalThis.fetch = originalFetch;
    });

    const stubNavigator = (value) => Object.defineProperty(globalThis, 'navigator', {
        configurable: true, writable: true, value,
    });

    it('reports unsupported where the API is missing', async () => {
        stubNavigator({});
        assert.deepEqual(await probeGeolocation(), { available: false, reason: 'unsupported' });
    });

    it('treats a denied prompt as a normal outcome', async () => {
        stubNavigator({
            geolocation: { getCurrentPosition: (_ok, fail) => fail({ code: 1 }) },
        });
        assert.deepEqual(await probeGeolocation(), { available: false, reason: 'denied' });
    });

    it('rounds coordinates before they leave the device', async () => {
        stubNavigator({
            geolocation: {
                getCurrentPosition: (ok) => ok({
                    coords: { latitude: 35.689487, longitude: 139.691711, accuracy: 25 },
                }),
            },
        });
        const result = await probeGeolocation();
        // Two decimals ≈ 1km: enough for the API to name a country, far less
        // than the position the browser handed us.
        assert.deepEqual(result, {
            available: true, latitude: 35.69, longitude: 139.69, accuracyMetres: 25,
        });
    });

    it('reports the position without an accuracy the device did not give', async () => {
        stubNavigator({
            geolocation: { getCurrentPosition: (ok) => ok({ coords: { latitude: 0, longitude: 0 } }) },
        });
        assert.equal((await probeGeolocation()).accuracyMetres, undefined);
    });
});
