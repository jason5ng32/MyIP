// Tests for frontend/utils/features/snapshots.js — the snapshot store model:
// untrusted restore (bad JSON, wrong versions, missing fields, oversized,
// schema-invalid sections, legacy fields), applying sections and in-place
// updates, retention by count (kept snapshots exempt), the kept cap, the
// auto mode, the label card, labels and user actions.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    SNAPSHOTS_STORE_VERSION, SNAPSHOTS_KEEP_LAST_DEFAULT,
    SNAPSHOTS_KEEP_LAST_OPTIONS, SNAPSHOTS_MAX_BYTES,
    MAX_KEPT_SNAPSHOTS, HOME_SECTION_IDS, SNAPSHOT_NAME_MAX,
    createEmptyStore, clampKeepLast, SNAPSHOTS_AUTO_MODES, SNAPSHOTS_AUTO_DEFAULT, snapshotsAutoMode, snapshotsNotifyOn,
    sanitizeSnapshot, restoreStore,
    createSnapshot, applySection, touchSnapshot, addSnapshot, pruneStore, primaryCardOf, autoLabel,
    labelCardIdOf, labelCardOf, formatAutoLabel, SNAPSHOT_LABEL_CARD_ID_MAX,
    snapshotLabel, renameSnapshot, keepSnapshot, keptCountOf, removeSnapshot, findSnapshot,
} from '../frontend/utils/features/snapshots.js';
import { REPORT_VERSION, validateReport } from '../common/report-schema.js';
import { DEFAULT_PREFERENCES } from '../frontend/data/default-preferences.js';

const T0 = '2026-11-08T10:00:00.000Z';
const at = (minutes) => new Date(Date.parse(T0) + minutes * 60000).toISOString();

const ipinfo = (...ips) => ({
    testedAt: T0,
    cards: ips.map((ip, i) => ({
        id: `card${i}`, source: `src${i}`, ip, countryCode: 'SG', city: 'Singapore', asn: 'AS4773', isp: 'Singtel',
    })),
});
const connectivity = { testedAt: T0, targets: [{ id: 'google', name: 'Google', status: 'ok', timeMs: 30 }] };

const snapshot = (id, minutes, fields = {}) => {
    const sections = fields.sections ?? { ipinfo: ipinfo('8.8.8.8') };
    return { ...createSnapshot({ id, now: at(minutes) }), ...fields, sections };
};
const storeOf = (...snapshots) => ({ v: SNAPSHOTS_STORE_VERSION, snapshots });
const raw = (value) => JSON.stringify(value);

describe('snapshots — constants', () => {
    it('records the five homepage sections; preference defaults match the option lists', () => {
        assert.deepEqual([...HOME_SECTION_IDS], ['ipinfo', 'connectivity', 'webrtc', 'dnsleak', 'speedtest']);
        assert.deepEqual([...SNAPSHOTS_KEEP_LAST_OPTIONS], [10, 50, 100]);
        assert.equal(SNAPSHOTS_KEEP_LAST_DEFAULT, 50);
        assert.equal(MAX_KEPT_SNAPSHOTS, 20);
        assert.deepEqual([...SNAPSHOTS_AUTO_MODES], ['smart', 'every', 'off']);
        assert.equal(SNAPSHOTS_AUTO_DEFAULT, 'smart');
        assert.equal(DEFAULT_PREFERENCES.snapshotsAuto, SNAPSHOTS_AUTO_DEFAULT);
        assert.equal(DEFAULT_PREFERENCES.snapshotsLabelCard, 1);
        assert.equal(DEFAULT_PREFERENCES.snapshotsKeepLast, SNAPSHOTS_KEEP_LAST_DEFAULT);
    });

    it('fixtures are legal report sections', () => {
        const result = validateReport({
            v: REPORT_VERSION, generatedAt: T0, origin: 'test', locale: 'en',
            sections: { ipinfo: ipinfo('8.8.8.8', '2001:4860:4860::8888'), connectivity },
        });
        assert.deepEqual(result.errors, []);
    });

    it('clamps keepLast onto the offered options', () => {
        assert.equal(clampKeepLast(50), 50);
        assert.equal(clampKeepLast(100), 100);
        assert.equal(clampKeepLast(20), SNAPSHOTS_KEEP_LAST_DEFAULT, 'no longer offered');
        assert.equal(clampKeepLast(7), SNAPSHOTS_KEEP_LAST_DEFAULT);
        assert.equal(clampKeepLast('10'), SNAPSHOTS_KEEP_LAST_DEFAULT);
        assert.equal(clampKeepLast(undefined), SNAPSHOTS_KEEP_LAST_DEFAULT);
    });

    it('normalizes snapshotsAuto onto a mode, the old booleans included', () => {
        for (const mode of ['smart', 'every', 'off']) assert.equal(snapshotsAutoMode(mode), mode);
        assert.equal(snapshotsAutoMode(false), 'off');
        assert.equal(snapshotsAutoMode(true), 'smart');
        for (const junk of [undefined, null, '', 'always', 'SMART', 0, 1, {}]) {
            assert.equal(snapshotsAutoMode(junk), 'smart', String(junk));
        }
    });

    it('turns the change notice on unless set false, and off whenever recording is', () => {
        assert.equal(snapshotsNotifyOn({}), true);
        assert.equal(snapshotsNotifyOn(undefined), true);
        assert.equal(snapshotsNotifyOn({ snapshotsAuto: 'every', snapshotsNotify: true }), true);
        assert.equal(snapshotsNotifyOn({ snapshotsAuto: 'smart', snapshotsNotify: false }), false);
        for (const snapshotsAuto of ['off', false]) {
            assert.equal(snapshotsNotifyOn({ snapshotsAuto, snapshotsNotify: true }), false, String(snapshotsAuto));
        }
    });
});

describe('snapshots — untrusted restore', () => {
    it('round-trips a valid store', () => {
        const store = storeOf(snapshot('b', 5), snapshot('a', 0, { kept: true, name: 'Home' }));
        assert.deepEqual(restoreStore(raw(store)), store);
    });

    it('returns an empty store for a broken envelope', () => {
        for (const input of [null, '', '{oops', raw([]), raw({ v: 99, snapshots: [] }),
            raw({ v: SNAPSHOTS_STORE_VERSION }), raw({ v: SNAPSHOTS_STORE_VERSION, snapshots: {} })]) {
            assert.deepEqual(restoreStore(input), createEmptyStore());
        }
    });

    it('a full count-mode store fits the size cap and restores whole', () => {
        // 8 IPv6 cards with every field, 72 connectivity targets, 8 WebRTC
        // servers and 8 DNS providers: a busy snapshot, 100 unkept + 20 kept.
        const v6 = (i) => `2001:db8:85a3:1234:5678:8a2e:370:${(0x7000 + i).toString(16)}`;
        const full = (id, i) => snapshot(id, i, {
            name: 'n'.repeat(SNAPSHOT_NAME_MAX), kept: i < MAX_KEPT_SNAPSHOTS,
            sections: {
                ipinfo: { testedAt: T0, cards: Array.from({ length: 8 }, (_, c) => ({
                    id: `ipchecking_v64_${c}`.padEnd(SNAPSHOT_LABEL_CARD_ID_MAX, 'x'),
                    source: `source-${c}`, ip: v6(c), countryCode: 'SG', region: 'Central Singapore',
                    city: 'Singapore', timezone: 'Asia/Singapore', asn: 'AS4294967295',
                    isp: 'Example Telecommunications Holdings Pte Ltd', anonymity: 'suspected_residential',
                    ipType: 'residential', nativeIP: true, qualityScore: 87.5,
                    anonymityProtocol: 'WireGuard', anonymityProvider: 'Example VPN Provider',
                })) },
                connectivity: { testedAt: T0, targets: Array.from({ length: 72 }, (_, t) => ({
                    id: `custom-target-${t}`, name: `Custom target ${t}`, status: 'unreachable',
                    timeMs: 123456, minTimeMs: 123456, custom: true,
                })) },
                webrtc: { testedAt: T0, servers: Array.from({ length: 8 }, (_, w) => ({
                    id: `stun-${w}`, url: `stun:stun${w}.example-telecommunications.com:3478`, ip: v6(w),
                    natType: 'srflx', countryCode: 'SG', org: 'Example Telecommunications Holdings Pte Ltd',
                })) },
                dnsleak: { testedAt: T0, providers: Array.from({ length: 8 }, (_, d) => ({
                    id: `dns-${d}`, name: `DNS provider ${d}`, ip: v6(d), countryCode: 'SG',
                    org: 'Example Telecommunications Holdings Pte Ltd',
                })) },
            },
        });
        const input = raw(storeOf(...Array.from({ length: 100 + MAX_KEPT_SNAPSHOTS }, (_, i) => full(`s${i}`, i))));
        assert.ok(input.length < SNAPSHOTS_MAX_BYTES / 1.5, `${input.length} leaves headroom`);
        assert.equal(restoreStore(input).snapshots.length, 100 + MAX_KEPT_SNAPSHOTS);
    });

    it('rejects oversized input without parsing it', () => {
        const huge = raw(storeOf(snapshot('a', 0))) + ' '.repeat(SNAPSHOTS_MAX_BYTES);
        assert.deepEqual(restoreStore(huge), createEmptyStore());
    });

    it('drops a snapshot built with another schema version', () => {
        const store = restoreStore(raw(storeOf(snapshot('b', 5), { ...snapshot('a', 0), v: REPORT_VERSION - 1 })));
        assert.deepEqual(store.snapshots.map((s) => s.id), ['b']);
    });

    it('drops snapshots with missing or mistyped fields', () => {
        const good = snapshot('ok', 9);
        const bad = [
            (s) => { delete s.id; },
            (s) => { s.id = 'has space'; },
            (s) => { s.firstSeenAt = 'yesterday'; },
            (s) => { delete s.lastSeenAt; },
            (s) => { s.name = 42; },
            (s) => { s.name = 'x'.repeat(SNAPSHOT_NAME_MAX + 1); },
            (s) => { s.kept = 'yes'; },
            (s) => { s.labelCardId = 7; },
            (s) => { s.labelCardId = 'x'.repeat(SNAPSHOT_LABEL_CARD_ID_MAX + 1); },
            (s) => { delete s.sections; },
            (s) => { s.sections = { connectivity }; }, // no ipinfo
            (s) => { s.sections.pingtest = { testedAt: T0, target: '1.1.1.1', probes: [] }; }, // not a homepage section
            (s) => { s.sections.connectivity = { testedAt: T0, targets: [{ id: 'x', name: 'X', status: 'down' }] }; },
            (s) => { s.sections.ipinfo.cards[0].extra = 1; },
        ].map((mutate, i) => {
            const s = structuredClone(snapshot(`bad${i}`, i));
            mutate(s);
            return s;
        });
        for (const s of bad) assert.equal(sanitizeSnapshot(s), null, JSON.stringify(s));
        const store = restoreStore(raw(storeOf(good, ...bad, 'junk', null)));
        assert.deepEqual(store.snapshots.map((s) => s.id), ['ok']);
    });

    it('keeps a stored labelCardId, which is optional', () => {
        const withId = snapshot('a', 0, { labelCardId: 'card0' });
        assert.equal(sanitizeSnapshot(withId).labelCardId, 'card0');
        const without = snapshot('b', 0);
        delete without.labelCardId;
        const clean = sanitizeSnapshot(without);
        assert.ok(clean);
        assert.equal('labelCardId' in clean, false);
    });

    it('keeps scenario friction, which only Snapshots hold', () => {
        const sections = { ipinfo: ipinfo('8.8.8.8') };
        sections.ipinfo.cards[0].scenarios = { signup: 'low', email: 'high' };
        const clean = sanitizeSnapshot(snapshot('a', 0, { sections }));
        assert.deepEqual(clean.sections.ipinfo.cards[0].scenarios, { signup: 'low', email: 'high' });
        sections.ipinfo.cards[0].scenarios = { signup: 'blocked' };
        assert.equal(sanitizeSnapshot(snapshot('b', 0, { sections })), null);
    });

    it('drops unknown keys, duplicate ids, and orders newest first', () => {
        const store = restoreStore(raw(storeOf(
            { ...snapshot('a', 0), extra: true }, snapshot('c', 10), snapshot('a', 20), snapshot('b', 5),
        )));
        assert.deepEqual(store.snapshots.map((s) => s.id), ['c', 'b', 'a']);
        assert.equal('extra' in store.snapshots[2], false);
    });

    it('unkeeps the oldest kept snapshots past the cap', () => {
        const many = Array.from({ length: MAX_KEPT_SNAPSHOTS + 2 }, (_, i) => snapshot(`k${i}`, 100 - i, { kept: true }));
        const store = restoreStore(raw(storeOf(...many)));
        assert.equal(keptCountOf(store), MAX_KEPT_SNAPSHOTS);
        assert.equal(store.snapshots.at(-1).kept, false);
        assert.equal(store.snapshots[0].kept, true);
    });
});

describe('snapshots — sections and updates', () => {
    it('creates a snapshot with equal timestamps and no legacy fields', () => {
        const s = createSnapshot({ id: 'a', now: T0 });
        assert.equal(s.firstSeenAt, T0);
        assert.equal(s.lastSeenAt, T0);
        for (const key of ['ips', 'visits', 'sealed']) assert.equal(key in s, false, key);
    });

    it('applies sections latest-wins and ignores non-homepage ids', () => {
        let s = createSnapshot({ id: 'a', now: T0 });
        s = applySection(s, 'connectivity', connectivity);
        const newer = { ...connectivity, testedAt: at(1) };
        s = applySection(s, 'connectivity', newer);
        assert.equal(s.sections.connectivity, newer);
        assert.equal(applySection(s, 'pingtest', { testedAt: T0 }), s);
    });

    it('touches a snapshot: lastSeenAt moves, nothing else', () => {
        const s = snapshot('a', 0);
        const touched = touchSnapshot(s, at(5));
        assert.equal(touched.lastSeenAt, at(5));
        assert.deepEqual({ ...touched, lastSeenAt: s.lastSeenAt }, s);
        assert.equal(s.lastSeenAt, at(0), 'input untouched');
    });
});

describe('snapshots — retention', () => {
    const series = (n, kept = () => false) =>
        Array.from({ length: n }, (_, i) => snapshot(`s${i}`, 100 - i, { kept: kept(i) })); // s0 newest

    it('clamps keepLast to the options', () => {
        assert.equal(clampKeepLast(100), 100);
        assert.equal(clampKeepLast('10'), SNAPSHOTS_KEEP_LAST_DEFAULT);
        assert.equal(clampKeepLast(undefined), SNAPSHOTS_KEEP_LAST_DEFAULT);
    });

    it('count: prunes unkept snapshots past keepLast, oldest first', () => {
        const { store, removed } = pruneStore(storeOf(...series(12)), 10);
        assert.deepEqual(store.snapshots.map((s) => s.id), series(10).map((s) => s.id));
        assert.deepEqual(removed, ['s10', 's11']);
    });

    it('count: allows many per day; never prunes kept snapshots, nor counts them', () => {
        const { store, removed } = pruneStore(storeOf(...series(13, (i) => i === 11 || i === 0)), 10);
        assert.deepEqual(removed, ['s12']);
        assert.ok(findSnapshot(store, 's11'));
        assert.equal(store.snapshots.length, 12);
    });

    it('returns the same store when nothing goes', () => {
        const input = storeOf(...series(3));
        assert.equal(pruneStore(input, 10).store, input);
    });

    it('count: falls back to the default for an invalid keepLast', () => {
        assert.equal(pruneStore(storeOf(...series(60)), 3).store.snapshots.length, SNAPSHOTS_KEEP_LAST_DEFAULT);
    });
});

describe('snapshots — labels', () => {
    const names = { SG: 'Singapore', JP: 'Japan', NL: 'Netherlands' };
    const fmt = { countryName: (code) => names[code] };
    const cards = [
        { id: 'masked', source: 'Masked', ip: '1.2.3.x', isp: 'Masked', countryCode: 'US' },
        { id: 'b', source: 'Cloudflare IPv4', ip: '1.1.1.1', isp: 'Cloudflare', countryCode: 'JP' },
        { id: 'c', source: 'IPCheck.ing IPv4', ip: '185.107.56.201', isp: 'NForce', countryCode: 'NL' },
    ];
    const withCards = (fields = {}) => snapshot('a', 0, { sections: { ipinfo: { testedAt: T0, cards } }, ...fields });

    it('picks the label card at its 1-based position, else the first card with a valid IP', () => {
        assert.equal(labelCardIdOf(cards, 3), 'c');
        assert.equal(labelCardIdOf(cards, 2), 'b');
        assert.equal(labelCardIdOf(cards, 1), 'b', 'card 1 has no valid IP');
        assert.equal(labelCardIdOf(cards), 'b', 'defaults to card 1');
        assert.equal(labelCardIdOf(cards, 9), 'b', 'out of range');
        assert.equal(labelCardIdOf(cards, 0), 'b');
        assert.equal(labelCardIdOf(cards, '3'), 'b', 'not an integer');
        assert.equal(labelCardIdOf([cards[0]], 1), '', 'no valid IP anywhere');
        assert.equal(labelCardIdOf([], 1), '');
        assert.equal(labelCardIdOf(undefined, 1), '');
        assert.equal(labelCardIdOf([{ source: 'IPCheck.ing IPv4', ip: '9.9.9.9' }]), '', 'no id');
        assert.equal(labelCardIdOf([{ id: 'x'.repeat(80), ip: '9.9.9.9' }]).length, SNAPSHOT_LABEL_CARD_ID_MAX);
    });

    it('createSnapshot records the labelCardId', () => {
        assert.equal(createSnapshot({ id: 'a', now: T0, labelCardId: 'c' }).labelCardId, 'c');
        assert.equal(createSnapshot({ id: 'a', now: T0 }).labelCardId, '');
    });

    it('uses the labelCardId card, else the first card with a valid IP', () => {
        assert.equal(primaryCardOf(withCards()).id, 'b');
        assert.equal(labelCardOf(withCards({ labelCardId: 'c' })).id, 'c');
        assert.equal(labelCardOf(withCards({ labelCardId: 'gone' })).id, 'b');
        assert.equal(labelCardOf(withCards({ labelCardId: 'masked' })).id, 'b', 'its IP is not valid');
        assert.equal(labelCardOf(withCards({ labelCardId: undefined })).id, 'b');
    });

    it('matches the label card by id, whichever provider answered it', () => {
        const fallback = cards.map((card) => (card.id === 'c' ? { ...card, source: 'Fallback provider' } : card));
        const snap = snapshot('a', 0, { sections: { ipinfo: { testedAt: T0, cards: fallback } }, labelCardId: 'c' });
        assert.equal(labelCardOf(snap).ip, '185.107.56.201');
        assert.equal(labelCardOf(withCards({ labelCardId: 'IPCheck.ing IPv4' })).id, 'b', 'a source is not an id');
    });

    it('autoLabel returns the country and IP of the label card', () => {
        assert.deepEqual(autoLabel(withCards({ labelCardId: 'c' })), { countryCode: 'NL', ip: '185.107.56.201' });
        assert.deepEqual(autoLabel(withCards()), { countryCode: 'JP', ip: '1.1.1.1' });
        assert.deepEqual(autoLabel(createSnapshot({ id: 'e', now: T0 })), { countryCode: '', ip: '' });
        assert.equal(autoLabel(null), null);
    });

    it('formats "country · IP", leaving out empty parts', () => {
        assert.equal(formatAutoLabel({ countryCode: 'NL', ip: '185.107.56.201' }, fmt), 'Netherlands · 185.107.56.201');
        assert.equal(formatAutoLabel({ countryCode: 'ZZ', ip: '9.9.9.9' }, fmt), 'ZZ · 9.9.9.9');
        assert.equal(formatAutoLabel({ countryCode: '', ip: '9.9.9.9' }, fmt), '9.9.9.9');
        assert.equal(formatAutoLabel({ countryCode: 'SG', ip: '' }, fmt), 'Singapore');
        assert.equal(formatAutoLabel({ countryCode: '', ip: '' }, fmt), '');
        assert.equal(formatAutoLabel(null, fmt), '');
    });

    it('a given name replaces the whole label', () => {
        assert.equal(snapshotLabel(withCards({ name: 'Office VPN', labelCardId: 'c' }), fmt), 'Office VPN');
        assert.equal(snapshotLabel(withCards({ name: '  ', labelCardId: 'c' }), fmt), 'Netherlands · 185.107.56.201');
    });
});

describe('snapshots — user actions', () => {
    it('adds new snapshots at the front', () => {
        const store = addSnapshot(storeOf(snapshot('a', 0)), snapshot('b', 5));
        assert.deepEqual(store.snapshots.map((s) => s.id), ['b', 'a']);
    });

    it('renames with trimming and a length cap; blank restores the auto label', () => {
        let store = storeOf(snapshot('a', 0));
        store = renameSnapshot(store, 'a', `  ${'n'.repeat(80)}  `);
        assert.equal(store.snapshots[0].name.length, SNAPSHOT_NAME_MAX);
        assert.equal(renameSnapshot(store, 'a', '   ').snapshots[0].name, '');
        assert.equal(renameSnapshot(store, 'missing', 'x'), store);
    });

    it('keeps up to the cap, then refuses with the store unchanged', () => {
        const full = storeOf(
            ...Array.from({ length: MAX_KEPT_SNAPSHOTS }, (_, i) => snapshot(`k${i}`, 50 - i, { kept: true })),
            snapshot('free', 0),
        );
        const refused = keepSnapshot(full, 'free');
        assert.equal(refused.ok, false);
        assert.equal(refused.store, full);

        const released = keepSnapshot(full, 'k3', false);
        assert.equal(released.ok, true);
        const kept = keepSnapshot(released.store, 'free');
        assert.equal(kept.ok, true);
        assert.equal(findSnapshot(kept.store, 'free').kept, true);
        assert.equal(keptCountOf(kept.store), MAX_KEPT_SNAPSHOTS);
    });

    it('keeping an already kept snapshot is a no-op success; unknown ids fail', () => {
        const store = storeOf(snapshot('a', 0, { kept: true }));
        assert.deepEqual(keepSnapshot(store, 'a'), { store, ok: true });
        assert.equal(keepSnapshot(store, 'nope').ok, false);
    });

    it('removes by id', () => {
        const store = removeSnapshot(storeOf(snapshot('b', 5), snapshot('a', 0)), 'b');
        assert.deepEqual(store.snapshots.map((s) => s.id), ['a']);
    });
});

describe('snapshots — legacy fields', () => {
    it('loads snapshots stored with ips / visits / sealed, valid or not, and drops them', () => {
        const legacy = [
            snapshot('a', 0, { ips: ['8.8.8.8'], visits: 3, sealed: true }),
            snapshot('b', 1, { ips: 'junk', visits: 0, sealed: 'yes' }),
        ];
        for (const s of legacy) {
            const clean = sanitizeSnapshot(s);
            assert.ok(clean, s.id);
            for (const key of ['ips', 'visits', 'sealed']) assert.equal(key in clean, false, key);
        }
    });

    it('loads snapshots stored with a `seq` and drops it', () => {
        const store = restoreStore(raw(storeOf(snapshot('b', 5, { seq: 2 }), snapshot('a', 0, { seq: 'x' }))));
        assert.deepEqual(store.snapshots.map((s) => s.id), ['b', 'a']);
        assert.equal(store.snapshots.some((s) => 'seq' in s), false);
    });

    it('adds a new snapshot as given, newest first', () => {
        const store = addSnapshot(storeOf(snapshot('a', 0)), snapshot('b', 5));
        assert.deepEqual(store.snapshots.map((s) => s.id), ['b', 'a']);
        assert.deepEqual(store.snapshots[0], snapshot('b', 5));
    });
});
