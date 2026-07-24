// Unit tests for the OONI aggregation classification logic
// (common/ooni-blocking.js). Fixtures mirror the real aggregation response
// shape: one row per probe_cc × blocking_type, where the empty blocking_type
// row carries the ok / failure counts.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { classifyOoniCountries, OONI_WINDOW_DAYS } from '../common/ooni-blocking.js';

const row = (cc, bt, { n = 0, ok = 0, anomaly = 0, confirmed = 0, failure = 0 } = {}) => ({
    probe_cc: cc,
    blocking_type: bt,
    measurement_count: n,
    ok_count: ok,
    anomaly_count: anomaly,
    confirmed_count: confirmed,
    failure_count: failure,
});

describe('classifyOoniCountries', () => {
    it('returns [] for empty input', () => {
        assert.deepEqual(classifyOoniCountries([]), []);
    });

    it('classifies CN-style anomaly-only blocking as "likely" with a methods breakdown', () => {
        const result = classifyOoniCountries([
            row('CN', '', { n: 137, ok: 60, failure: 77 }),
            row('CN', 'dns', { n: 947, anomaly: 947 }),
            row('CN', 'http-failure', { n: 337, anomaly: 337 }),
            row('CN', 'tcp_ip', { n: 12, anomaly: 12 }),
        ]);
        assert.equal(result.length, 1);
        const cn = result[0];
        assert.equal(cn.tier, 'likely');
        assert.equal(cn.measurements, 1433);
        assert.equal(cn.confirmed, 0);
        assert.deepEqual(cn.methods, { dns: 947, 'http-failure': 337, tcp_ip: 12 });
    });

    it('classifies blockpage countries as "confirmed" once confirmed share passes 5%', () => {
        const result = classifyOoniCountries([
            row('IR', '', { n: 388, ok: 136, failure: 242, confirmed: 16 }),
            row('IR', 'dns', { n: 3338, anomaly: 107, confirmed: 3230 }),
            row('IR', 'http-failure', { n: 1301, anomaly: 1299 }),
        ]);
        assert.equal(result[0].tier, 'confirmed');
        assert.equal(result[0].methods.dns, 3337);
    });

    it('requires a larger sample for the noisy "signs" tier', () => {
        const signs = classifyOoniCountries([
            row('SY', '', { n: 20, ok: 20 }),
            row('SY', 'dns', { n: 10, anomaly: 10 }),
        ]);
        assert.equal(signs[0].tier, 'signs'); // 33% of 30 measurements

        const tooSmall = classifyOoniCountries([
            row('LT', '', { n: 10, ok: 10 }),
            row('LT', 'dns', { n: 3, anomaly: 3 }),
        ]);
        assert.equal(tooSmall[0].tier, 'ok'); // 23% but only 13 measurements
    });

    it('flags rarely-tested domains once the sample reaches the floor (7-of-8 anomalous)', () => {
        const result = classifyOoniCountries([
            row('CN', '', { n: 1, ok: 1 }),
            row('CN', 'http-failure', { n: 7, anomaly: 7 }),
        ]);
        assert.equal(result[0].tier, 'likely');
    });

    it('leaves under-sampled countries at "ok" even with a 100% anomaly share', () => {
        const result = classifyOoniCountries([
            row('DJ', 'dns', { n: 4, anomaly: 4 }),
        ]);
        assert.equal(result[0].tier, 'ok');
    });

    it('does not count measurement failures toward the blocked share', () => {
        const result = classifyOoniCountries([
            row('US', '', { n: 90, ok: 30, failure: 60 }),
            row('US', 'dns', { n: 10, anomaly: 10 }),
        ]);
        assert.equal(result[0].tier, 'ok'); // 10% blocked share, failures ignored
    });

    it('merges rows for the same country across hostname variants', () => {
        // apex + www. variant rows arrive concatenated; counts must sum.
        const result = classifyOoniCountries([
            row('RU', 'dns', { n: 300, anomaly: 300 }),
            row('RU', '', { n: 200, ok: 200 }),
            row('RU', 'dns', { n: 100, anomaly: 60, confirmed: 40 }),
        ]);
        assert.equal(result.length, 1);
        assert.equal(result[0].measurements, 600);
        assert.equal(result[0].methods.dns, 400);
        assert.equal(result[0].tier, 'confirmed'); // 40/600 = 6.7% confirmed
    });

    it('sorts flagged tiers first, then by blocked share within a tier', () => {
        const result = classifyOoniCountries([
            row('US', '', { n: 1000, ok: 1000 }),
            row('CN', 'dns', { n: 90, anomaly: 90 }),
            row('CN', '', { n: 10, ok: 10 }),
            row('IR', 'dns', { n: 50, confirmed: 50 }),
            row('MM', 'dns', { n: 30, anomaly: 18 }),
            row('MM', '', { n: 12, ok: 12 }),
        ]);
        assert.deepEqual(result.map((e) => e.country), ['IR', 'CN', 'MM', 'US']);
        assert.deepEqual(result.map((e) => e.tier), ['confirmed', 'likely', 'signs', 'ok']);
    });

    it('ignores rows without a probe_cc and unknown blocking types', () => {
        const result = classifyOoniCountries([
            row(undefined, 'dns', { n: 50, anomaly: 50 }),
            row('FR', 'weird-type', { n: 100, anomaly: 100 }),
        ]);
        assert.equal(result.length, 1);
        assert.equal(result[0].country, 'FR');
        assert.deepEqual(result[0].methods, {});
    });

    it('exports a 30-day window constant (backend computes the dates)', () => {
        assert.equal(OONI_WINDOW_DAYS, 30);
    });
});
