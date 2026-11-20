// Tests for frontend/utils/features/account-sync.js — the pure layer of account sync: the record (only a signed-in
// user's own record stamps), change detection by hash, pull preparation (adopt / foreign / own, stale cursor),
// adoption both ways, the per-item merge of an own record, upload batches by count and bytes, PUT answers (held,
// refused, conflicts, cursor jump) and the panel status.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    SYNC_BATCH_MAX_BYTES, hashSyncValue, syncRecordKey, createSyncRecord, readSyncRecord, writeSyncRecord,
    isPending, isOwnRecord, removeSyncRecord, detectLocalChanges, refreshSyncHashes, readSyncItem, readSyncPage, preparePull, mergePull,
    settleApplied, changedSince, hashItems, buildUploadBatches, markRefused, readSyncSave, mergeSave, syncStatusOf,
    syncStatusBadge, SYNC_STATUS_BADGES, hasHeldBack,
} from '../frontend/utils/features/account-sync.js';
import {
    SYNC_COLLECTIONS, SYNC_TOMBSTONE_TTL_MS, SYNC_MAX_ITEMS_PER_REQUEST, SYNC_MAX_BODY_BYTES,
} from '../frontend/utils/sync-collections.js';

// A collection of string values; 'bad' is refused.
const FAKE = Object.freeze({
    id: 'fake', version: 3, allowDelete: true,
    isValidItemId: (id) => typeof id === 'string' && /^[a-z0-9-]+$/.test(id),
    isValidValue: (id, value) => typeof value === 'string' && value !== 'bad',
});
const NO_DELETE = Object.freeze({ ...FAKE, allowDelete: false });

const memoryStorage = (initial = {}) => ({
    data: { ...initial },
    getItem(key) { return this.data[key] ?? null; },
    setItem(key, value) { this.data[key] = String(value); },
});

const DAY = 24 * 60 * 60 * 1000;
const h = hashSyncValue;
const record = (items, over = {}) => ({ ...createSyncRecord(), user: 'u1', cursor: 10, lastSyncAt: 1000, items, ...over });
const live = (id, value, updatedAt) => ({ id, updatedAt, deleted: false, value });
const gone = (id, updatedAt) => ({ id, updatedAt, deleted: true });
const prepared = (rec, userId = 'u1', now = 2000) => preparePull(rec, userId, now);
const memory = () => ({
    data: {},
    getItem(key) { return this.data[key] ?? null; },
    setItem(key, value) { this.data[key] = String(value); },
    removeItem(key) { delete this.data[key]; },
});

describe('account sync — the record', () => {
    it('hashes values by their JSON: same value, same hash', () => {
        assert.equal(h({ a: [1, 'x'] }), h({ a: [1, 'x'] }));
        assert.notEqual(h('checked'), h('ignored'));
        assert.match(h(true), /^[0-9a-z]+$/);
    });

    it('one key per collection and schema version', () => {
        assert.equal(syncRecordKey(FAKE), 'accountSync_fake_v3');
        assert.equal(syncRecordKey(SYNC_COLLECTIONS.connectivity), `accountSync_connectivity_v${SYNC_COLLECTIONS.connectivity.version}`);
    });

    it('round-trips through storage; junk entries drop, junk records read as none', () => {
        const storage = memoryStorage();
        assert.equal(readSyncRecord(storage, FAKE), null);
        const rec = record({ a: { hash: 'x', at: 5, ack: 5 }, b: { deleted: true, at: 6 } });
        writeSyncRecord(storage, FAKE, rec);
        assert.deepEqual(readSyncRecord(storage, FAKE), rec);
        storage.data[syncRecordKey(FAKE)] = JSON.stringify({
            user: 7, cursor: -1, items: { a: { hash: 'x', at: 'no' }, b: { deleted: true }, c: null, d: { at: 3 } },
        });
        assert.deepEqual(readSyncRecord(storage, FAKE), { user: null, cursor: 0, lastSyncAt: 0, items: { a: { hash: 'x' } } });
        storage.data[syncRecordKey(FAKE)] = '{nope';
        assert.equal(readSyncRecord(storage, FAKE), null);
        const removable = memory();
        writeSyncRecord(removable, FAKE, rec);
        removeSyncRecord(removable, FAKE);
        assert.equal(readSyncRecord(removable, FAKE), null);
    });

    it('stamps only in the signed-in user\'s own record', () => {
        assert.equal(isOwnRecord(record({}), 'u1'), true);
        assert.equal(isOwnRecord(record({}), 'u2'), false);
        assert.equal(isOwnRecord(record({}, { user: null }), 'u1'), false);
        assert.equal(isOwnRecord(null, 'u1'), false);
        assert.equal(isOwnRecord(record({}), null), false);
    });

    it('pending = stamped, not held at that stamp, not refused at it', () => {
        assert.equal(isPending({ hash: 'x' }), false);
        assert.equal(isPending({ hash: 'x', at: 5 }), true);
        assert.equal(isPending({ hash: 'x', at: 5, ack: 5 }), false);
        assert.equal(isPending({ hash: 'x', at: 6, ack: 5 }), true);
        assert.equal(isPending({ hash: 'x', at: 6, ack: 5, refused: 6 }), false);
        assert.equal(isPending({ hash: 'x', at: 7, refused: 6 }), true);
    });
});

describe('account sync — change detection', () => {
    it('stamps an edited or new value now and keeps what the server holds', () => {
        const rec = record({ a: { hash: h('x'), at: 5, ack: 5 }, b: { hash: h('y') } });
        const { record: next, changed } = detectLocalChanges(rec, { a: 'x2', b: 'y', c: 'z' }, 50);
        assert.equal(changed, true);
        assert.deepEqual(next.items, {
            a: { hash: h('x2'), at: 50, ack: 5 }, b: { hash: h('y') }, c: { hash: h('z'), at: 50 },
        });
    });

    it('unchanged data changes nothing', () => {
        const rec = record({ a: { hash: h('x'), at: 5, ack: 5 } });
        assert.equal(detectLocalChanges(rec, { a: 'x' }, 50).changed, false);
    });

    it('an id gone locally becomes a tombstone stamped now; one back again is a new edit', () => {
        const rec = record({ a: { hash: h('x'), at: 5, ack: 5 } });
        const { record: deleted } = detectLocalChanges(rec, {}, 50);
        assert.deepEqual(deleted.items.a, { deleted: true, at: 50, ack: 5 });
        assert.ok(isPending(deleted.items.a));
        const { record: back } = detectLocalChanges(deleted, { a: 'x' }, 60);
        assert.deepEqual(back.items.a, { hash: h('x'), at: 60, ack: 5 });
    });

    it('forgets synced tombstones past the TTL, keeps pending ones', () => {
        const now = 200 * DAY;
        const old = now - SYNC_TOMBSTONE_TTL_MS - 1;
        const rec = record({ a: { deleted: true, at: old, ack: old }, b: { deleted: true, at: old } });
        const { record: next } = detectLocalChanges(rec, {}, now);
        assert.deepEqual(Object.keys(next.items), ['b']);
    });

    it('refreshSyncHashes takes current values without a stamp', () => {
        const rec = record({ a: { hash: h('x'), at: 5, ack: 5 } });
        const next = refreshSyncHashes(rec, { a: 'x2', b: 'y' }, ['a', 'b', 'missing']);
        assert.deepEqual(next.items, { a: { hash: h('x2'), at: 5, ack: 5 }, b: { hash: h('y') } });
        assert.equal(refreshSyncHashes(null, { a: 'x' }, ['a']), null);
    });
});

describe('account sync — reading answers', () => {
    it('keeps only well-formed items', () => {
        assert.deepEqual(readSyncItem(live('a', 'x', 5), FAKE), live('a', 'x', 5));
        assert.deepEqual(readSyncItem({ id: 'a', updatedAt: 5, deleted: true, value: 'x' }, FAKE), gone('a', 5));
        for (const bad of [null, live('A!', 'x', 5), live('a', 'x', 0), live('a', 'x', 1.5), live('a', 'bad', 5)]) {
            assert.equal(readSyncItem(bad, FAKE), null, JSON.stringify(bad));
        }
    });

    it('a page needs cursor, more and items', () => {
        assert.deepEqual(readSyncPage({ cursor: 4, more: false, items: [live('a', 'x', 5), live('a', 'bad', 5)] }, FAKE),
            { cursor: 4, more: false, items: [live('a', 'x', 5)] });
        for (const bad of [null, { cursor: -1, more: false, items: [] }, { cursor: 1, items: [] }, { cursor: 1, more: true }]) {
            assert.equal(readSyncPage(bad, FAKE), null);
        }
    });

    it('a save answer needs base, cursor, conflicts and refused', () => {
        assert.deepEqual(readSyncSave({ base: 1, cursor: 3, conflicts: [live('a', 'x', 9), 'junk'], refused: [{ id: 'b', reason: 'full' }, 7] }, FAKE),
            { base: 1, cursor: 3, conflicts: [live('a', 'x', 9)], refused: ['b'] });
        assert.equal(readSyncSave({ base: 1, cursor: 3, conflicts: [] }, FAKE), null);
    });
});

describe('account sync — preparing a pull', () => {
    it('no record or a guest one adopts from the start', () => {
        assert.deepEqual(prepared(null), { mode: 'adopt', stale: false, since: 0 });
        assert.deepEqual(prepared(record({}, { user: null, cursor: 9 })), { mode: 'adopt', stale: false, since: 0 });
    });

    it('another user\'s record is foreign, from the start', () => {
        assert.deepEqual(prepared(record({}, { user: 'old' }), 'u1'), { mode: 'foreign', stale: false, since: 0 });
    });

    it('the user\'s own record continues from its cursor; older than the tombstone TTL, from the start', () => {
        const now = 400 * DAY;
        assert.deepEqual(prepared(record({}, { lastSyncAt: now - DAY, cursor: 99 }), 'u1', now), { mode: 'own', stale: false, since: 99 });
        assert.deepEqual(prepared(record({}, { lastSyncAt: now - SYNC_TOMBSTONE_TTL_MS - 1, cursor: 99 }), 'u1', now),
            { mode: 'own', stale: true, since: 0 });
    });
});

describe('account sync — merging a pull', () => {
    const merge = (rec, local, items, over = {}) => mergePull({
        prepared: prepared(rec), record: rec, local, items, cursor: 20, userId: 'u1', now: 2000, ...over,
    });

    it('an unstamped or older local value takes the cloud\'s; only differing values are applied', () => {
        const rec = record({ a: { hash: h('x') }, b: { hash: h('y'), at: 5, ack: 5 }, c: { hash: h('z') } });
        const result = merge(rec, { a: 'x', b: 'y', c: 'z' }, [live('a', 'x2', 7), live('b', 'y2', 6), live('c', 'z', 3)]);
        assert.deepEqual(result.upserts, { a: 'x2', b: 'y2' });
        assert.deepEqual(result.deletes, []);
        assert.deepEqual(result.record.items, {
            a: { hash: h('x2'), at: 7, ack: 7 }, b: { hash: h('y2'), at: 6, ack: 6 }, c: { hash: h('z'), at: 3, ack: 3 },
        });
        assert.equal(result.record.cursor, 20);
        assert.equal(result.record.lastSyncAt, 2000);
    });

    it('a newer or equal local stamp stays and remains pending', () => {
        const rec = record({ a: { hash: h('mine'), at: 9 }, b: { hash: h('mine'), at: 7 } });
        const result = merge(rec, { a: 'mine', b: 'mine' }, [live('a', 'theirs', 8), live('b', 'theirs', 7)]);
        assert.deepEqual(result.upserts, {});
        assert.ok(isPending(result.record.items.a));
        assert.ok(isPending(result.record.items.b));
    });

    it('a stamp the server already held takes the cloud\'s, even an older one (this device\'s clock ran ahead)', () => {
        const rec = record({ a: { hash: h('mine'), at: 9000, ack: 9000 }, b: { hash: h('mine'), at: 9000, ack: 5 } });
        const result = merge(rec, { a: 'mine', b: 'mine' }, [live('a', 'theirs', 8), live('b', 'theirs', 8)]);
        assert.deepEqual(result.upserts, { a: 'theirs' });
        assert.deepEqual(result.record.items.a, { hash: h('theirs'), at: 8, ack: 8 });
        assert.ok(isPending(result.record.items.b));
    });

    it('its own echo (same stamp, same value) is held', () => {
        const rec = record({ a: { hash: h('x'), at: 9 }, b: { deleted: true, at: 9 } });
        const result = merge(rec, { a: 'x' }, [live('a', 'x', 9), gone('b', 9)]);
        assert.equal(isPending(result.record.items.a), false);
        assert.equal(isPending(result.record.items.b), false);
    });

    it('a newer cloud delete removes the local item; one for an unknown id is only recorded', () => {
        const rec = record({ a: { hash: h('x'), at: 5, ack: 5 } });
        const result = merge(rec, { a: 'x' }, [gone('a', 6), gone('b', 6)]);
        assert.deepEqual(result.deletes, ['a']);
        assert.deepEqual(result.record.items, { a: { deleted: true, at: 6, ack: 6 }, b: { deleted: true, at: 6, ack: 6 } });
    });

    it('a later page\'s newer version of the same id wins', () => {
        const result = merge(record({}), {}, [live('a', 'x', 5), live('a', 'x2', 8)]);
        assert.deepEqual(result.upserts, { a: 'x2' });
    });

    describe('adoption (a guest record or none)', () => {
        const adopt = (local, items, rec = null) => mergePull({
            prepared: prepared(rec), record: rec, local, items, cursor: 4, userId: 'u1', now: 2000,
        });

        it('an account with items replaces the device: its live items taken, the rest deleted, nothing pending', () => {
            const result = adopt({ a: 'mine', b: 'mine', c: 'same' }, [live('a', 'cloud', 3), gone('b', 3), live('c', 'same', 3), live('d', 'new', 3)]);
            assert.deepEqual(result.upserts, { a: 'cloud', d: 'new' });
            assert.deepEqual(result.deletes.sort(), ['b']);
            assert.equal(Object.values(result.record.items).some(isPending), false);
            assert.equal(result.record.user, 'u1');
            assert.equal(result.record.cursor, 4);
        });

        it('local items the account lacks are deleted (a preference key goes back to its default in the adapter)', () => {
            const result = adopt({ theme: 'dark', lang: 'fr' }, [live('lang', 'en', 3)]);
            assert.deepEqual(result.upserts, { lang: 'en' });
            assert.deepEqual(result.deletes, ['theme']);
        });

        it('a tombstone alone still makes the account non-empty', () => {
            const result = adopt({ a: 'mine' }, [gone('z', 3)]);
            assert.deepEqual(result.deletes, ['a']);
            assert.deepEqual(result.upserts, {});
        });

        it('edits of this signed-in session (`keep`) stay, stamped now, whatever the account holds', () => {
            const result = mergePull({
                prepared: prepared(null), record: null, local: { visit: 'new', a: 'mine', guest: 'old' },
                items: [live('a', 'cloud', 3)], cursor: 4, userId: 'u1', now: 2000, keep: ['visit', 'a', 'gone'],
            });
            assert.deepEqual(result.upserts, {});
            assert.deepEqual(result.deletes, ['guest']);
            assert.deepEqual(result.record.items.visit, { hash: h('new'), at: 2000 });
            assert.ok(isPending(result.record.items.a));
        });

        it('changedSince lists what differs from a baseline; no baseline, nothing', () => {
            const baseline = hashItems({ a: 'x', b: 'y' });
            assert.deepEqual(changedSince(baseline, { a: 'x', b: 'y2', c: 'z' }), ['b', 'c']);
            assert.deepEqual(changedSince(null, { a: 'x' }), []);
            assert.equal(hashItems(null), null);
        });

        it('an empty account takes everything on the device, stamped now and pending', () => {
            const result = adopt({ a: 'x', b: 'y' }, [], record({}, { user: null }));
            assert.deepEqual(result.record.items, { a: { hash: h('x'), at: 2000 }, b: { hash: h('y'), at: 2000 } });
            assert.deepEqual(result.deletes, []);
            assert.ok(Object.values(result.record.items).every(isPending));
        });
    });

    describe('another user\'s record', () => {
        const foreign = (local, items) => {
            const rec = record({ a: { hash: h('x'), at: 50 } }, { user: 'old' });
            return mergePull({ prepared: prepared(rec, 'u1'), record: rec, local, items, cursor: 2, userId: 'u1', now: 2000 });
        };

        it('the account replaces the device, as an adoption', () => {
            const result = foreign({ a: 'x', b: 'y' }, [live('a', 'cloud', 3)]);
            assert.deepEqual(result.upserts, { a: 'cloud' });
            assert.deepEqual(result.deletes, ['b']);
            assert.equal(result.record.user, 'u1');
        });

        it('an empty account keeps only this session\'s edits', () => {
            const rec = record({}, { user: 'old' });
            const result = mergePull({
                prepared: prepared(rec, 'u1'), record: rec, local: { a: 'x', b: 'y' }, items: [], cursor: 2, userId: 'u1', now: 2000, keep: ['b'],
            });
            assert.deepEqual(result.deletes, ['a']);
            assert.ok(isPending(result.record.items.b));
        });

        it('an empty account empties the device instead of taking its data', () => {
            const result = foreign({ a: 'x', b: 'y' }, []);
            assert.deepEqual(result.deletes, ['a', 'b']);
            assert.deepEqual(result.record.items, {});
        });
    });

    it('stale cursor: synced items the server no longer lists are dropped, pending ones stay', () => {
        const now = 400 * DAY;
        const rec = record({
            a: { hash: h('x'), at: 5, ack: 5 }, b: { hash: h('y'), at: 9, ack: 5 }, c: { hash: h('z') },
            d: { deleted: true, at: 4, ack: 4 }, e: { hash: h('w'), at: 5, ack: 5 },
        }, { lastSyncAt: now - SYNC_TOMBSTONE_TTL_MS - DAY });
        const result = mergePull({
            prepared: preparePull(rec, 'u1', now), record: rec, local: { a: 'x', b: 'y', c: 'z', e: 'w' }, items: [live('e', 'w', 5)],
            cursor: 30, userId: 'u1', now,
        });
        assert.deepEqual(result.deletes, ['a']);
        assert.deepEqual(Object.keys(result.record.items).sort(), ['b', 'c', 'e']);
    });

    it('settleApplied takes the hash of what the owner stored; other local items get an unstamped entry', () => {
        const rec = record({ a: { hash: h('x'), at: 7, ack: 7 } });
        const settled = settleApplied(rec, { a: 'sanitised', theme: 'auto' }, ['a']);
        assert.deepEqual(settled.items.a, { hash: h('sanitised'), at: 7, ack: 7 });
        assert.deepEqual(settled.items.theme, { hash: h('auto') });
    });
});

describe('account sync — upload batches', () => {
    it('pending items only, deletes as tombstones; refused ids and values come back as invalid', () => {
        const rec = record({
            a: { hash: h('x'), at: 5 }, b: { hash: h('y'), at: 5, ack: 5 }, c: { deleted: true, at: 6, ack: 2 },
            'BAD!': { hash: h('z'), at: 5 }, d: { hash: h('bad'), at: 5 },
        });
        const { batches, invalid } = buildUploadBatches(rec, { a: 'x', b: 'y', 'BAD!': 'z', d: 'bad' }, FAKE);
        assert.deepEqual(batches, [[{ id: 'a', updatedAt: 5, value: 'x' }, { id: 'c', updatedAt: 6, deleted: true }]]);
        assert.deepEqual(invalid.sort(), ['BAD!', 'd']);
        assert.deepEqual(buildUploadBatches(rec, { a: 'x' }, NO_DELETE).invalid.includes('c'), true);
    });

    it('splits by count', () => {
        const items = {};
        const local = {};
        for (let i = 0; i < SYNC_MAX_ITEMS_PER_REQUEST + 3; i += 1) {
            items[`i${i}`] = { hash: 'x', at: 5 };
            local[`i${i}`] = 'v';
        }
        const { batches } = buildUploadBatches(record(items), local, FAKE);
        assert.deepEqual(batches.map((batch) => batch.length), [SYNC_MAX_ITEMS_PER_REQUEST, 3]);
    });

    it('stays under the server\'s body limit', () => {
        assert.ok(SYNC_BATCH_MAX_BYTES < SYNC_MAX_BODY_BYTES);
    });

    it('splits by bytes; an item larger than the cap goes alone', () => {
        const big = 'x'.repeat(Math.floor(SYNC_BATCH_MAX_BYTES / 2.5));
        const local = { a: big, b: big, c: big, d: 'x'.repeat(SYNC_BATCH_MAX_BYTES + 10), e: 's' };
        const items = Object.fromEntries(Object.keys(local).map((id) => [id, { hash: 'h', at: 5 }]));
        const { batches } = buildUploadBatches(record(items), local, FAKE);
        assert.deepEqual(batches.map((batch) => batch.map((item) => item.id)), [['a', 'b'], ['c'], ['d'], ['e']]);
        for (const batch of batches.slice(0, 2)) assert.ok(JSON.stringify(batch).length <= SYNC_BATCH_MAX_BYTES);
    });

    it('markRefused holds an item back until its next edit', () => {
        const next = markRefused(record({ a: { hash: h('x'), at: 5 } }), ['a', 'missing']);
        assert.equal(isPending(next.items.a), false);
        assert.equal(hasHeldBack(next), true);
        assert.equal(hasHeldBack(detectLocalChanges(next, { a: 'x2' }, 9).record), false);
        assert.equal(hasHeldBack(record({ a: { hash: h('x'), at: 5, ack: 5 }, b: { hash: h('y') } })), false);
        assert.ok(isPending(detectLocalChanges(next, { a: 'x2' }, 9).record.items.a));
    });
});

describe('account sync — merging a save answer', () => {
    const sent = [{ id: 'a', updatedAt: 5, value: 'x' }, { id: 'b', updatedAt: 5, value: 'y' }, { id: 'c', updatedAt: 5, value: 'z' }];
    const rec = record({ a: { hash: h('x'), at: 5 }, b: { hash: h('y'), at: 5 }, c: { hash: h('z'), at: 5 } }, { cursor: 10 });
    const local = { a: 'x', b: 'y', c: 'z' };

    it('holds the accepted, keeps the refused local, takes conflicts, and jumps the cursor from base', () => {
        const result = mergeSave({
            record: rec, sent, local, now: 3000,
            answer: { base: 10, cursor: 12, conflicts: [live('c', 'cloud', 8)], refused: ['b'] },
        });
        assert.equal(isPending(result.record.items.a), false);
        assert.deepEqual(result.record.items.b, { hash: h('y'), at: 5, refused: 5 });
        assert.deepEqual(result.upserts, { c: 'cloud' });
        assert.deepEqual(result.record.items.c, { hash: h('cloud'), at: 8, ack: 8 });
        assert.equal(result.record.cursor, 12);
        assert.equal(result.record.lastSyncAt, 3000);
        assert.equal(result.pullNeeded, false);
    });

    it('another device wrote in between: the cursor stays and a pull follows', () => {
        const result = mergeSave({ record: rec, sent, local, now: 3000, answer: { base: 11, cursor: 14, conflicts: [], refused: [] } });
        assert.equal(result.record.cursor, 10);
        assert.equal(result.pullNeeded, true);
    });

    it('an edit made while the request was in flight stays pending', () => {
        const edited = { ...rec, items: { ...rec.items, a: { hash: h('x2'), at: 9 } } };
        const result = mergeSave({ record: edited, sent, local, now: 3000, answer: { base: 10, cursor: 12, conflicts: [], refused: ['a'] } });
        assert.ok(isPending(result.record.items.a));
        const accepted = mergeSave({ record: edited, sent, local, now: 3000, answer: { base: 10, cursor: 12, conflicts: [], refused: [] } });
        assert.deepEqual(accepted.record.items.a, { hash: h('x2'), at: 9, ack: 5 });
        assert.ok(isPending(accepted.record.items.a));
    });
});

describe('account sync — a conflict against an edit made while the request was in flight', () => {
    const sent = [{ id: 'a', updatedAt: 5, value: 'x' }];
    const edited = record({ a: { hash: h('x2'), at: 9 } }, { cursor: 10 });
    const answer = (updatedAt) => ({ base: 10, cursor: 10, conflicts: [live('a', 'cloud', updatedAt)], refused: [] });

    it('the newer local edit stays pending', () => {
        const result = mergeSave({ record: edited, sent, local: { a: 'x2' }, now: 3000, answer: answer(7) });
        assert.deepEqual(result.upserts, {});
        assert.deepEqual(result.record.items.a, { hash: h('x2'), at: 9 });
        assert.ok(isPending(result.record.items.a));
    });

    it('a cloud value as new or newer than that edit is taken', () => {
        for (const updatedAt of [9, 12]) {
            const result = mergeSave({ record: edited, sent, local: { a: 'x2' }, now: 3000, answer: answer(updatedAt) });
            assert.deepEqual(result.upserts, { a: 'cloud' });
            assert.equal(isPending(result.record.items.a), false);
        }
    });

    it('the stamp that was sent always takes the conflict, whatever the clocks say', () => {
        const ahead = record({ a: { hash: h('x'), at: 9000 } }, { cursor: 10 });
        const result = mergeSave({
            record: ahead, sent: [{ id: 'a', updatedAt: 9000, value: 'x' }], local: { a: 'x' }, now: 3000, answer: answer(7),
        });
        assert.deepEqual(result.upserts, { a: 'cloud' });
    });
});

describe('account sync — panel status', () => {
    const status = (over) => syncStatusOf({ available: true, signedIn: true, states: [], ...over });

    it('nothing without sync; signed out; then save failed, failed, paused, synced, in that order', () => {
        assert.equal(syncStatusOf({ available: false, signedIn: true, states: ['synced'] }), null);
        assert.equal(status({ signedIn: false, saveFailed: true }), 'signedOut');
        assert.equal(status({ states: ['failed', 'reload'], saveFailed: true }), 'saveFailed');
        assert.equal(status({ states: ['synced', 'failed', 'reload'] }), 'failed');
        assert.equal(status({ states: ['synced', 'reload'] }), 'paused');
        assert.equal(status({ states: ['idle', 'stopped'] }), 'paused');
        assert.equal(status({ states: ['idle', 'synced'] }), 'synced');
        assert.equal(status({ states: ['idle'] }), null, 'nothing has synced yet');
        assert.equal(status({ states: [] }), null, 'sync off: no status');
    });

    it('each status maps to a tone, a short label and the full sentence as hover text', () => {
        assert.deepEqual(syncStatusBadge('synced'), { tone: 'ok-fast', label: 'nav.preferences.syncStatusSynced', title: 'nav.preferences.syncSynced' });
        assert.deepEqual(syncStatusBadge('paused'), { tone: 'ok-slow', label: 'nav.preferences.syncStatusPaused', title: 'nav.preferences.syncReload' });
        assert.deepEqual(syncStatusBadge('failed'), { tone: 'fail', label: 'nav.preferences.syncStatusFailed', title: 'nav.preferences.syncFailed' });
        assert.deepEqual(syncStatusBadge('saveFailed'), { tone: 'fail', label: 'nav.preferences.syncStatusFailed', title: 'nav.preferences.syncSaveFailed' });
        assert.deepEqual(syncStatusBadge('partial'), { tone: 'ok-mild', label: 'nav.preferences.syncStatusPartial', title: 'nav.preferences.syncPartial' });
        assert.equal(syncStatusOf({ available: true, signedIn: true, states: ['synced', 'partial'] }), 'partial');
        assert.equal(syncStatusOf({ available: true, signedIn: true, states: ['partial', 'reload'] }), 'paused');
        assert.equal(syncStatusBadge('signedOut'), null);
        assert.equal(syncStatusBadge(null), null);
        assert.ok(Object.isFrozen(SYNC_STATUS_BADGES));
    });
});
