// Tests for common/offline-data.js — the boot window, the per-route 503
// gate and the per-part isStillLoading probe.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runOfflineBootstrap, requireOfflineData, isStillLoading } from '../common/offline-data.js';

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
});

describe('isStillLoading', () => {
    it('is true only inside the boot window, for unready data', async () => {
        assert.equal(isStillLoading(missing), false, 'after boot a miss is a failed download');
        await duringBoot(() => {
            assert.equal(isStillLoading(ready, missing), true);
            assert.equal(isStillLoading(ready), false);
            assert.equal(isStillLoading(), false);
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
