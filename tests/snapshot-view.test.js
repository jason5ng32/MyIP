// Tests for frontend/utils/features/snapshot-view.js — the Snapshots page's
// route state (`q` / `vs` with their fallbacks, the previous / specific
// compare modes), the time span and the enum label keys.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    COMPARE_PREVIOUS, COMPARE_SPECIFIC, resolveSnapshotView, snapshotViewQuery, seenSpan, seenSpanText, natTypeKey,
} from '../frontend/utils/features/snapshot-view.js';

const T0 = '2026-11-08T10:00:00.000Z';
const IDS = ['c', 'b', 'a']; // newest first

const snap = (sections, extra = {}) => ({
    id: 'x', firstSeenAt: T0, lastSeenAt: T0, name: '', kept: false, sections, ...extra,
});

describe('snapshot view — route state', () => {
    it('shows q and compares with a specific vs when both are stored', () => {
        assert.deepEqual(resolveSnapshotView(IDS, { q: 'b', vs: 'c' }),
            { selectedId: 'b', comparedId: 'c', defaultComparedId: 'a', mode: COMPARE_SPECIFIC });
    });

    it('without vs, compares with the next older snapshot', () => {
        assert.deepEqual(resolveSnapshotView(IDS, { q: 'c' }),
            { selectedId: 'c', comparedId: 'b', defaultComparedId: 'b', mode: COMPARE_PREVIOUS });
        assert.equal(resolveSnapshotView(IDS, { q: 'a' }).comparedId, null, 'the oldest has none');
        assert.equal(resolveSnapshotView(IDS, { q: 'a' }).mode, COMPARE_PREVIOUS);
    });

    it('an unknown, self or legacy vs falls back to the previous one', () => {
        for (const vs of ['gone', 'c', 'none', ['b']]) {
            const view = resolveSnapshotView(IDS, { q: 'c', vs });
            assert.deepEqual([view.comparedId, view.mode], ['b', COMPARE_PREVIOUS], String(vs));
        }
    });

    it('a specific vs may be newer than the shown one', () => {
        assert.deepEqual(resolveSnapshotView(IDS, { q: 'a', vs: 'c' }).comparedId, 'c');
    });

    it('falls back to this visit, then the newest', () => {
        assert.equal(resolveSnapshotView(IDS, {}, 'b').selectedId, 'b');
        assert.equal(resolveSnapshotView(IDS, { q: 'gone' }, 'b').selectedId, 'b');
        assert.equal(resolveSnapshotView(IDS, { q: 'gone' }, 'gone-too').selectedId, 'c');
        assert.equal(resolveSnapshotView(IDS, { q: ['b'] }).selectedId, 'c', 'a repeated q is not an id');
    });

    it('shows nothing without snapshots', () => {
        assert.deepEqual(resolveSnapshotView([], { q: 'a' }),
            { selectedId: null, comparedId: null, defaultComparedId: null, mode: COMPARE_PREVIOUS });
    });

    it('spells the view out as a query, vs only for a specific snapshot', () => {
        assert.deepEqual(snapshotViewQuery({ selectedId: 'c', comparedId: 'a', mode: COMPARE_SPECIFIC }), { q: 'c', vs: 'a' });
        assert.deepEqual(snapshotViewQuery({ selectedId: 'c', comparedId: 'b', mode: COMPARE_PREVIOUS }), { q: 'c' });
        assert.deepEqual(snapshotViewQuery({ selectedId: 'a', comparedId: null, mode: COMPARE_SPECIFIC }), { q: 'a' });
        assert.deepEqual(snapshotViewQuery({ selectedId: null, comparedId: null }), {});
    });

    it('round-trips through the query', () => {
        for (const query of [{ q: 'b', vs: 'c' }, { q: 'b' }, { q: 'a' }]) {
            assert.deepEqual(snapshotViewQuery(resolveSnapshotView(IDS, query)), query);
        }
    });
});

describe('snapshot view — time span', () => {
    it('reports a range only once updated after creation', () => {
        assert.equal(seenSpan(snap({})).range, false);
        const span = seenSpan(snap({}, { lastSeenAt: '2026-11-10T10:00:00.000Z' }));
        assert.deepEqual(span, { first: T0, last: '2026-11-10T10:00:00.000Z', range: true });
        assert.deepEqual(seenSpan(undefined), { first: '', last: '', range: false });
    });

    it('collapses a span whose ends format alike', () => {
        const minute = (iso) => iso.slice(0, 16);
        const sameMinute = snap({}, { lastSeenAt: '2026-11-08T10:00:40.000Z' });
        assert.deepEqual(seenSpanText(sameMinute, minute), { first: '2026-11-08T10:00' });
        const later = snap({}, { lastSeenAt: '2026-11-10T10:00:00.000Z' });
        assert.deepEqual(seenSpanText(later, minute), { first: '2026-11-08T10:00', last: '2026-11-10T10:00' });
        assert.deepEqual(seenSpanText(snap({}), minute), { first: '2026-11-08T10:00' });
    });
});

describe('snapshot view — value labels', () => {
    it('maps NAT codes onto the homepage keys', () => {
        assert.equal(natTypeKey('srflx'), 'webrtc.NATType.srflx');
        assert.equal(natTypeKey('unavailable'), 'webrtc.StatusUnavailable');
        assert.equal(natTypeKey('error'), 'webrtc.StatusError');
    });
});
