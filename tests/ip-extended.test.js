// Tests for common/ip-extended.js — the `extended` block's field list, gate values and validator.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as contract from '../common/ip-extended.js';
import * as contractBridge from '../frontend/utils/ip/ip-extended.js';

const { EXTENDED_FIELDS, EXTENDED_GATES, isValidExtended } = contract;

const full = {
    anonymity: { code: 'vpn', provider: 'Acme', protocol: 'wireguard' },
    lineType: 'hosting',
    native: false,
    score: 72,
    abuse: 'low',
    scenarios: [{ id: 'email', level: 'high' }],
    scoreDetails: { tags: { isVPN: true }, dimensions: {} },
};

describe('extended contract', () => {
    it('lists every field of a full block plus the gate', () => {
        assert.deepEqual([...EXTENDED_FIELDS].sort(), ['gate', ...Object.keys(full)].sort());
        assert.deepEqual([...EXTENDED_GATES], ['auth', 'quota', 'cooldown']);
    });

    it('accepts a full block, an empty one and any subset', () => {
        assert.ok(isValidExtended(full));
        assert.ok(isValidExtended({}));
        for (const [key, value] of Object.entries(full)) assert.ok(isValidExtended({ [key]: value }), key);
        assert.ok(isValidExtended({ anonymity: { code: 'none' }, lineType: 'unknown', score: 'unknown' }));
    });

    it('accepts each gate alone', () => {
        for (const gate of EXTENDED_GATES) assert.ok(isValidExtended({ gate }), gate);
    });

    it('rejects a gate beside other fields, or an unknown gate', () => {
        assert.equal(isValidExtended({ gate: 'auth', score: 50 }), false);
        assert.equal(isValidExtended({ gate: 'sign_in_required' }), false);
        assert.equal(isValidExtended({ gate: undefined }), false);
    });

    it('rejects non-objects and unknown fields', () => {
        for (const value of [null, undefined, 'x', 1, [], { extra: 1 }]) {
            assert.equal(isValidExtended(value), false, JSON.stringify(value));
        }
    });

    it('rejects malformed fields', () => {
        const bad = [
            { anonymity: { code: 'masked' } },
            { anonymity: { code: 'vpn', provider: '' } },
            { anonymity: { code: 'vpn', extra: 1 } },
            { anonymity: 'vpn' },
            { lineType: 'Hosting' },
            { native: 'true' },
            { score: 101 },
            { score: -1 },
            { score: '50' },
            { score: Number.NaN },
            { abuse: 'severe' },
            { scenarios: [] },
            { scenarios: [{ id: 'nope', level: 'low' }] },
            { scenarios: [{ id: 'email', level: 'severe' }] },
            { scenarios: [{ id: 'email', level: 'low' }, { id: 'email', level: 'high' }] },
            { scenarios: [{ id: 'email', level: 'low', kind: 'x' }] },
            { scoreDetails: { tags: 'x' } },
            { scoreDetails: { extra: {} } },
            { scoreDetails: [] },
        ];
        for (const value of bad) assert.equal(isValidExtended(value), false, JSON.stringify(value));
    });
});

describe('extended contract bridge', () => {
    it('re-exports every export as the same object', () => {
        assert.deepEqual(Object.keys(contractBridge).sort(), Object.keys(contract).sort());
        for (const key of Object.keys(contract)) assert.equal(contractBridge[key], contract[key], key);
    });
});
