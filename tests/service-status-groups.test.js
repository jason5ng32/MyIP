// Unit tests for groupProviders / normalizeIndicator — the Service Status
// page's split into the issues and operational card groups.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { groupProviders, normalizeIndicator } from '../frontend/utils/features/service-status-groups.js';

const PROVIDERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => ({ id, name: id.toUpperCase() }));
const ids = (list) => list.map((p) => p.id);

describe('normalizeIndicator', () => {
    it('keeps the Statuspage indicators', () => {
        for (const v of ['none', 'minor', 'major', 'critical', 'maintenance']) {
            assert.equal(normalizeIndicator(v), v);
        }
    });

    it('reads anything else as unknown', () => {
        for (const v of [undefined, null, '', 'unknown', 'degraded', 'toString']) {
            assert.equal(normalizeIndicator(v), 'unknown');
        }
    });
});

describe('groupProviders', () => {
    it('puts critical / major / minor / maintenance in issues, severity first', () => {
        const out = groupProviders(PROVIDERS, {
            a: 'maintenance', b: 'none', c: 'minor', d: 'critical', e: 'major', f: 'none', g: 'none', h: 'none',
        });
        assert.deepEqual(ids(out.issues), ['d', 'e', 'c', 'a']);
        assert.deepEqual(ids(out.operational), ['b', 'f', 'g', 'h']);
    });

    it('keeps list order between providers of equal severity', () => {
        const out = groupProviders(PROVIDERS, {
            a: 'minor', b: 'major', c: 'minor', d: 'major', e: 'none', f: 'minor', g: 'none', h: 'none',
        });
        assert.deepEqual(ids(out.issues), ['b', 'd', 'a', 'c', 'f']);
    });

    it('lists operational providers in list order, unknown ones last and not as issues', () => {
        const out = groupProviders(PROVIDERS, {
            a: 'unknown', b: 'none', c: 'bogus', d: 'none', f: 'none', g: 'major', h: 'none',
        });
        assert.deepEqual(ids(out.operational), ['b', 'd', 'f', 'h', 'a', 'c', 'e']);
        assert.deepEqual(ids(out.issues), ['g']);
    });

    it('leaves issues empty when everything is operational', () => {
        const all = Object.fromEntries(PROVIDERS.map((p) => [p.id, 'none']));
        const out = groupProviders(PROVIDERS, all);
        assert.deepEqual(out.issues, []);
        assert.deepEqual(ids(out.operational), ids(PROVIDERS));
    });

    it('puts every provider in the operational group while loading', () => {
        const out = groupProviders(PROVIDERS, { a: 'major' }, { loading: true });
        assert.deepEqual(out.issues, []);
        assert.deepEqual(ids(out.operational), ids(PROVIDERS));
    });

    it('puts every provider in the operational group after a failed fetch', () => {
        const out = groupProviders(PROVIDERS, { a: 'major' }, { failed: true });
        assert.deepEqual(out.issues, []);
        assert.deepEqual(ids(out.operational), ids(PROVIDERS));
    });

    it('returns the same provider objects and leaves the input untouched', () => {
        const list = [...PROVIDERS];
        const out = groupProviders(list, { a: 'none', b: 'major' });
        assert.equal(out.issues[0], PROVIDERS[1]);
        assert.deepEqual(ids(list), ids(PROVIDERS));
    });
});
