// Tests for common/ip-extended.js — the `extended` block's field list, gate values and validator.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as contract from '../common/ip-extended.js';
import * as contractBridge from '../frontend/utils/ip/ip-extended.js';

const {
    EXTENDED_FIELDS, EXTENDED_GATES, EXTENDED_FLAGS, SOURCE_METRIC_IDS, METRIC_TEXT_LENGTH, isValidExtended,
} = contract;

const full = {
    anonymity: { code: 'vpn', provider: 'Acme', protocol: 'wireguard' },
    lineType: 'hosting',
    native: false,
    score: 72,
    abuse: 'low',
    scenarios: [{ id: 'email', level: 'high' }],
    scoreDetails: {
        dimensions: {
            anonymity: { class: 'vpn', sources: 'multi', lastSeen: '2026-09-01' },
            reputation: { level: 'low' },
            network: { level: 'none' },
        },
    },
    flags: { isVPN: true, isAnyAnonymizer: true, isDatacenter: false },
    metrics: [{ id: 'fraudScore', value: 12, max: 100 }, { id: 'abuserScore', value: '0.002 (Low)' }],
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

    it('rejects an anonymity object without a verdict code', () => {
        assert.equal(isValidExtended({ anonymity: { provider: 'Acme' } }), false);
        assert.equal(isValidExtended({ anonymity: { protocol: 'wireguard' } }), false);
    });

    it('accepts every flag of the vocabulary, true or false', () => {
        for (const key of EXTENDED_FLAGS) {
            assert.ok(isValidExtended({ flags: { [key]: true } }), key);
            assert.ok(isValidExtended({ flags: { [key]: false } }), key);
        }
        assert.ok(EXTENDED_FLAGS.includes('isAnyAnonymizer'));
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

    it('rejects a source\'s own field list as an unknown field', () => {
        assert.equal(EXTENDED_FIELDS.includes('details'), false);
        assert.equal(isValidExtended({
            lineType: 'hosting',
            details: [{ group: 'network', rows: [{ key: 'company.type', value: 'hosting' }] }],
        }), false);
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
            { scoreDetails: { tags: { isVPN: true } } },
            { scoreDetails: { extra: {} } },
            { scoreDetails: [] },
            { scoreDetails: { dimensions: 'x' } },
            { scoreDetails: { dimensions: { velocity: { level: 'low' } } } },
            { scoreDetails: { dimensions: { network: { level: 'low', asn: 12345 } } } },
            { scoreDetails: { dimensions: { anonymity: { class: null } } } },
            { scoreDetails: { dimensions: { reputation: 'low' } } },
            { anonymity: {} },
            { anonymity: { code: undefined } },
        ];
        for (const value of bad) assert.equal(isValidExtended(value), false, JSON.stringify(value));
    });
});

describe('extended contract: flags', () => {
    it('rejects an unknown key, a non-boolean value or a non-object', () => {
        const bad = [
            { flags: { isBogon: false } },
            { flags: { isBenignBot: true } },
            { flags: { isVPN: 'true' } },
            { flags: { isVPN: 1 } },
            { flags: { isVPN: null } },
            { flags: [] },
            { flags: 'isVPN' },
        ];
        for (const value of bad) assert.equal(isValidExtended(value), false, JSON.stringify(value));
    });
});

describe('extended contract: codes without a kind', () => {
    it('accepts the detected anonymity code and abuse level', () => {
        assert.ok(isValidExtended({ anonymity: { code: 'detected' } }));
        assert.ok(isValidExtended({ anonymity: { code: 'detected', provider: 'Acme' } }));
        assert.ok(isValidExtended({ abuse: 'detected' }));
        assert.ok(isValidExtended({ abuse: 'none', anonymity: { code: 'none' } }));
    });
});

describe('extended contract: metrics', () => {
    it('accepts every id, numbers with or without max, and text up to the limit', () => {
        for (const id of SOURCE_METRIC_IDS) {
            assert.ok(isValidExtended({ metrics: [{ id, value: 0 }] }), id);
            assert.ok(isValidExtended({ metrics: [{ id, value: 3.5, max: 100 }] }), id);
            assert.ok(isValidExtended({ metrics: [{ id, value: 'x'.repeat(METRIC_TEXT_LENGTH) }] }), id);
        }
        assert.ok(isValidExtended({ metrics: SOURCE_METRIC_IDS.map((id) => ({ id, value: 1 })) }));
    });

    it('rejects malformed metrics', () => {
        const bad = [
            { metrics: [] },
            { metrics: {} },
            { metrics: [{ id: 'qualityScore', value: 1 }] },
            { metrics: [{ id: 'fraudScore', value: 1 }, { id: 'fraudScore', value: 2 }] },
            { metrics: [{ id: 'abuserScore', value: '0.002 (Low)', max: 100 }] },
            { metrics: [{ id: 'abuserScore', value: 'x'.repeat(METRIC_TEXT_LENGTH + 1) }] },
            { metrics: [{ id: 'abuserScore', value: '' }] },
            { metrics: [{ id: 'fraudScore', value: Number.NaN }] },
            { metrics: [{ id: 'fraudScore', value: Number.POSITIVE_INFINITY }] },
            { metrics: [{ id: 'fraudScore', value: 1, max: 0 }] },
            { metrics: [{ id: 'fraudScore', value: 150, max: 100 }] },
            { metrics: [{ id: 'fraudScore', value: -1 }] },
            { metrics: [{ id: 'fraudScore', value: 1, max: '100' }] },
            { metrics: [{ id: 'fraudScore', value: true }] },
            { metrics: [{ id: 'fraudScore', value: null }] },
            { metrics: [{ id: 'fraudScore', value: 1, label: 'x' }] },
            { metrics: [{ value: 1 }] },
        ];
        for (const value of bad) assert.equal(isValidExtended(value), false, JSON.stringify(value).slice(0, 120));
    });
});

describe('extended contract bridge', () => {
    it('re-exports every export as the same object', () => {
        assert.deepEqual(Object.keys(contractBridge).sort(), Object.keys(contract).sort());
        for (const key of Object.keys(contract)) assert.equal(contractBridge[key], contract[key], key);
    });
});
