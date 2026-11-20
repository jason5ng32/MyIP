// Specs for synced preferences: the shared schema (common/preferences-schema.js), its Connectivity lists checks and its agreement with the front end.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
    PREFERENCES_VERSION, SYNCED_PREFERENCE_KEYS, isSyncedPreferenceKey, isValidPreferenceValue,
    isValidConnectivityLists, isValidConnectivityListId,
    IP_CARDS_OPTIONS, SNAPSHOTS_KEEP_LAST_OPTIONS, SNAPSHOTS_AUTO_MODES,
    CONNECTIVITY_LISTS_SCHEMA_VERSION, CONNECTIVITY_TARGET_LIMIT, CONNECTIVITY_LIST_LIMIT, CONNECTIVITY_LIST_NAME_LIMIT,
} from '../common/preferences-schema.js';
import * as bridge from '../frontend/utils/preferences-schema.js';
import { DEFAULT_PREFERENCES, PREFS_STORAGE_KEY } from '../frontend/data/default-preferences.js';
import * as connectivityDefaults from '../frontend/data/connectivity-defaults.js';
import { sanitizeLists, CONNECTIVITY_LISTS_SCHEMA_VERSION as LISTS_VERSION_FRONTEND } from '../frontend/utils/features/connectivity-lists.js';
import * as snapshots from '../frontend/utils/features/snapshots.js';

const LEGACY_KEYS = ['connectivityTargets', 'customConnectivityTargets'];
// Synced as their own collection (common/sync-collections.js), not as preferences.
const CONNECTIVITY_KEYS = ['connectivityLists', 'connectivityDefaultListId'];

const member = (over = {}) => ({ id: 'custom-1', name: 'Example', url: 'https://example.com/favicon.ico', ...over });
const lists = (over = {}) => ({
    schemaVersion: CONNECTIVITY_LISTS_SCHEMA_VERSION,
    lists: [{ id: 'mine', name: null, members: [member()] }],
    ...over,
});

describe('synced preference keys', () => {
    it('are every default preference but the legacy and Connectivity list ones, frozen', () => {
        assert.ok(Object.isFrozen(SYNCED_PREFERENCE_KEYS));
        const expected = Object.keys(DEFAULT_PREFERENCES)
            .filter((key) => ![...LEGACY_KEYS, ...CONNECTIVITY_KEYS].includes(key));
        assert.deepEqual([...SYNCED_PREFERENCE_KEYS].sort(), expected.sort());
        for (const key of [...LEGACY_KEYS, ...CONNECTIVITY_KEYS, 'constructor', '__proto__', 'toString']) {
            assert.equal(isSyncedPreferenceKey(key), false, key);
            assert.equal(isValidPreferenceValue(key, true), false, key);
        }
    });

    it('every default value passes its own check; so do the sanitized lists and the default list id', () => {
        for (const key of SYNCED_PREFERENCE_KEYS) assert.ok(isValidPreferenceValue(key, DEFAULT_PREFERENCES[key]), key);
        assert.ok(isValidConnectivityLists(sanitizeLists(null, null, [])));
        assert.ok(isValidConnectivityListId(DEFAULT_PREFERENCES.connectivityDefaultListId));
    });
});

describe('the front end agrees with the shared schema', () => {
    it('the storage key carries PREFERENCES_VERSION', () => {
        assert.equal(PREFS_STORAGE_KEY, `userPreferences_v${PREFERENCES_VERSION}`);
    });

    it('the bridge, snapshots and Connectivity lists read the very same values', () => {
        assert.equal(bridge.SYNCED_PREFERENCE_KEYS, SYNCED_PREFERENCE_KEYS);
        assert.equal(bridge.isValidPreferenceValue, isValidPreferenceValue);
        assert.equal(bridge.isValidConnectivityLists, isValidConnectivityLists);
        assert.equal(bridge.isValidConnectivityListId, isValidConnectivityListId);
        assert.equal(snapshots.SNAPSHOTS_KEEP_LAST_OPTIONS, SNAPSHOTS_KEEP_LAST_OPTIONS);
        assert.equal(snapshots.SNAPSHOTS_AUTO_MODES, SNAPSHOTS_AUTO_MODES);
        assert.equal(LISTS_VERSION_FRONTEND, CONNECTIVITY_LISTS_SCHEMA_VERSION);
    });

    it('the Connectivity caps match frontend/data/connectivity-defaults.js', () => {
        assert.equal(connectivityDefaults.CONNECTIVITY_TARGET_LIMIT, CONNECTIVITY_TARGET_LIMIT);
        assert.equal(connectivityDefaults.CONNECTIVITY_LIST_LIMIT, CONNECTIVITY_LIST_LIMIT);
        assert.equal(connectivityDefaults.CONNECTIVITY_LIST_NAME_LIMIT, CONNECTIVITY_LIST_NAME_LIMIT);
        assert.equal(connectivityDefaults.MINE_LIST_ID, 'mine');
    });

    it('the IP card counts match the Preferences panel', () => {
        const source = readFileSync(new URL('../frontend/components/widgets/Preferences.vue', import.meta.url), 'utf8');
        const match = /v-for="num in \[([\d,\s]+)\]"/.exec(source);
        assert.ok(match, 'IP card options not found in Preferences.vue');
        assert.deepEqual(match[1].split(',').map(Number), [...IP_CARDS_OPTIONS]);
    });
});

describe('isValidPreferenceValue', () => {
    const cases = {
        theme: { ok: ['auto', 'light', 'dark'], bad: ['system', '', null, 1] },
        lang: { ok: ['auto', 'en', 'zh-CN', 'zh-Hant-TW', 'fil'], bad: ['', 'english', 'e', 'en_US', 'en-', `en-${'a'.repeat(40)}`, 7, null] },
        ipCardsToShow: { ok: [2, 4, 6], bad: [1, 3, 8, '2', null] },
        ipGeoSource: { ok: [0, 1, 6, 63], bad: [-1, 64, 1.5, '0', null] },
        snapshotsAuto: { ok: ['smart', 'every', 'off'], bad: [false, true, 'never', null] },
        snapshotsLabelCard: { ok: [1, 3, 6], bad: [0, 7, 1.5, '1'] },
        snapshotsKeepLast: { ok: [10, 50, 100], bad: [20, 0, '50'] },
    };
    const booleans = ['connectivityMultipleTests', 'connectivityDiscardFirstResult', 'simpleMode', 'autoRunConnectivity',
        'autoRunWebRTC', 'autoRunDnsLeak', 'popupConnectivityNotifications', 'snapshotsNotify', 'connectivityCardTitleOpensSite'];
    for (const key of booleans) cases[key] = { ok: [true, false], bad: [0, 1, 'true', null, undefined] };

    it('covers every synced key here', () => {
        assert.deepEqual(Object.keys(cases).sort(), [...SYNCED_PREFERENCE_KEYS].sort());
    });

    for (const [key, { ok, bad }] of Object.entries(cases)) {
        it(key, () => {
            for (const value of ok) assert.equal(isValidPreferenceValue(key, value), true, JSON.stringify(value));
            for (const value of bad) assert.equal(isValidPreferenceValue(key, value), false, JSON.stringify(value));
        });
    }

    it('connectivityDefaultListId: a bounded non-empty string', () => {
        for (const value of ['mine', 'list-1700000000000']) assert.equal(isValidConnectivityListId(value), true, value);
        for (const value of ['', 'x'.repeat(65), 3, null]) assert.equal(isValidConnectivityListId(value), false, JSON.stringify(value));
    });

    it('connectivityLists: accepts the stored shape', () => {
        assert.ok(isValidConnectivityLists(lists()));
        assert.ok(isValidConnectivityLists(lists({
            lists: [
                { id: 'mine', name: null, members: [member({ siteUrl: 'https://example.com', favicon: '/favicons/example.png' })] },
                { id: 'list-1', name: 'Work', members: [] },
            ],
        })));
        const full = Array.from({ length: CONNECTIVITY_TARGET_LIMIT }, (_, i) => member({ id: `m${i}` }));
        assert.ok(isValidConnectivityLists(lists({ lists: [{ id: 'mine', name: null, members: full }] })));
    });

    it('connectivityLists: rejects anything else', () => {
        const mine = (members) => ({ id: 'mine', name: null, members });
        const bad = [
            null, [], 'x',
            lists({ schemaVersion: 2 }),
            { lists: lists().lists },
            { ...lists(), extra: 1 },
            lists({ lists: 'x' }),
            lists({ lists: Array.from({ length: CONNECTIVITY_LIST_LIMIT + 1 }, (_, i) => ({ id: `l${i}`, name: 'L', members: [] })) }),
            lists({ lists: [mine([]), mine([])] }),
            lists({ lists: [{ id: 'mine', name: 'Mine', members: [] }] }),
            lists({ lists: [{ id: 'l1', name: null, members: [] }] }),
            lists({ lists: [{ id: 'l1', name: '   ', members: [] }] }),
            lists({ lists: [{ id: 'l1', name: 'x'.repeat(CONNECTIVITY_LIST_NAME_LIMIT + 1), members: [] }] }),
            lists({ lists: [{ id: '', name: 'L', members: [] }] }),
            lists({ lists: [{ id: 'l1', name: 'L', members: [], color: 'red' }] }),
            lists({ lists: [{ id: 'l1', name: 'L' }] }),
            lists({ lists: [mine(Array.from({ length: CONNECTIVITY_TARGET_LIMIT + 1 }, (_, i) => member({ id: `m${i}` })))] }),
            lists({ lists: [mine([member({ url: 'javascript:alert(1)' })])] }),
            lists({ lists: [mine([member({ url: 'ftp://example.com/' })])] }),
            lists({ lists: [mine([member({ url: 'not a url' })])] }),
            lists({ lists: [mine([member({ url: `https://example.com/${'a'.repeat(2048)}` })])] }),
            lists({ lists: [mine([member({ siteUrl: 'data:text/html,x' })])] }),
            lists({ lists: [mine([member({ favicon: 'https://evil.example/x.png' })])] }),
            lists({ lists: [mine([member({ name: '' })])] }),
            lists({ lists: [mine([member({ name: 'x'.repeat(101) })])] }),
            lists({ lists: [mine([member({ id: 7 })])] }),
            lists({ lists: [mine([member({ source: 'import' })])] }),
            lists({ lists: [mine([null])] }),
        ];
        for (const value of bad) assert.equal(isValidConnectivityLists(value), false, JSON.stringify(value)?.slice(0, 120));
    });
});
