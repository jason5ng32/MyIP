// Tests for common/offline-data.js — the boot window and the per-route 503
// gate, plus the Radar views' declared dependencies.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runOfflineBootstrap, requireOfflineData } from '../common/offline-data.js';
import { RADAR_VIEWS } from '../common/cf-radar.js';
import { isAsRelLoaded } from '../common/as-rel-db.js';
import { isMaxMindReady } from '../common/maxmind-service.js';

const makeRes = () => ({
    statusCode: null,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
});

// Run a gate once; true when it passed the request on.
const passes = (gate, req = { query: {} }) => {
    let passed = false;
    const res = makeRes();
    gate(req, res, () => { passed = true; });
    return { passed, res };
};

// Hold the boot window open while `fn` runs, then close it.
const duringBoot = async (fn) => {
    let release;
    const boot = runOfflineBootstrap([() => new Promise((resolve) => { release = resolve; })]);
    try {
        await fn();
    } finally {
        release();
        await boot;
    }
};

const ready = () => true;
const missing = () => false;

describe('requireOfflineData', () => {
    it('passes everything outside the boot window, missing data included', () => {
        assert.equal(passes(requireOfflineData([missing])).passed, true);
    });

    it('answers 503 + Retry-After during boot while a dataset is missing', async () => {
        await duringBoot(() => {
            const { passed, res } = passes(requireOfflineData([ready, missing]));
            assert.equal(passed, false);
            assert.equal(res.statusCode, 503);
            assert.equal(res.headers['Retry-After'], '30');
            assert.deepEqual(res.body, { error: 'Offline data is loading' });
        });
    });

    it('passes during boot once every dataset the route reads is loaded', async () => {
        await duringBoot(() => {
            assert.equal(passes(requireOfflineData([ready, ready])).passed, true);
            assert.equal(passes(requireOfflineData([])).passed, true);
        });
    });

    it('resolves per-request checks; no checks (unknown view) passes', async () => {
        const gate = requireOfflineData((req) => ({ a: [missing], b: [ready] })[req.query.view]);
        await duringBoot(() => {
            assert.equal(passes(gate, { query: { view: 'a' } }).passed, false);
            assert.equal(passes(gate, { query: { view: 'b' } }).passed, true);
            assert.equal(passes(gate, { query: { view: 'nope' } }).passed, true);
        });
    });
});

describe('runOfflineBootstrap', () => {
    it('closes the window after every step settles, a throwing one included', async () => {
        const gate = requireOfflineData([missing]);
        let duringSteps;
        await runOfflineBootstrap([
            async () => { throw new Error('download failed'); },
            async () => { duringSteps = passes(gate).passed; },
        ]);
        assert.equal(duringSteps, false);
        assert.equal(passes(gate).passed, true);
    });
});

describe('Radar view dependencies', () => {
    it('asn reads the CAIDA graph, bgp-prefixes MaxMind; the rest nothing local', () => {
        assert.deepEqual(RADAR_VIEWS.asn.offlineData, [isAsRelLoaded]);
        assert.deepEqual(RADAR_VIEWS['bgp-prefixes'].offlineData, [isMaxMindReady]);
        assert.equal(RADAR_VIEWS.outages.offlineData, undefined);
        assert.equal(RADAR_VIEWS['country-traffic'].offlineData, undefined);
    });
});
