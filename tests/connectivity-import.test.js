// Tests for frontend/utils/connectivity-import.js: initial build, import
// planning, the "fully present" check, and removal with its guard.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    buildInitialTargets,
    planImport,
    isListFullyPresent,
    removeTarget,
} from '../frontend/utils/connectivity-import.js';
import {
    CONNECTIVITY_TARGET_LIMIT,
    DEFAULT_LIST_MEMBERS,
} from '../frontend/data/connectivity-import-lists.js';

const target = (id, host = `${id}.example`) => ({ id, name: id, url: `https://${host}/favicon.ico` });

const sampleList = {
    id: 'sample',
    members: [
        { id: 'alpha', name: 'Alpha', url: 'https://alpha.example/favicon.ico' },
        { id: 'beta', name: 'Beta', url: 'https://www.beta.example/favicon.ico' },
        { id: 'gamma', name: 'Gamma', url: 'https://gamma.example/favicon.ico' },
    ],
};

describe('buildInitialTargets', () => {
    it('seeds the defaults plus legacy targets, dropping provenance tags', () => {
        const legacy = [
            { id: 'custom-1', name: 'Probe', url: 'https://probe.example/health' },
            { id: 'import-ozon', name: 'Ozon', url: 'https://www.ozon.ru/favicon.ico', listId: 'russia', favicon: '/favicons/ozon.png' },
        ];
        const targets = buildInitialTargets(legacy);
        assert.equal(targets.length, DEFAULT_LIST_MEMBERS.length + 2);
        // Defaults carry their committed favicon.
        const github = targets.find((m) => m.id === 'github');
        assert.equal(github.favicon, '/favicons/github.png');
        // Legacy entries keep their favicon but lose the listId tag.
        const ozon = targets.find((m) => m.id === 'import-ozon');
        assert.equal(ozon.favicon, '/favicons/ozon.png');
        assert.equal('listId' in ozon, false);
    });

    it('never drops legacy sites, even past the cap', () => {
        const legacy = Array.from({ length: CONNECTIVITY_TARGET_LIMIT }, (_, i) => target(`custom-${i}`));
        const targets = buildInitialTargets(legacy);
        assert.equal(targets.length, DEFAULT_LIST_MEMBERS.length + CONNECTIVITY_TARGET_LIMIT);
    });
});

describe('planImport', () => {
    it('materializes members with import ids and favicons', () => {
        const { additions, skippedCount, overflowCount } = planImport(sampleList, []);
        assert.equal(additions.length, 3);
        assert.equal(skippedCount, 0);
        assert.equal(overflowCount, 0);
        assert.deepEqual(additions[0], {
            id: 'import-alpha',
            name: 'Alpha',
            url: 'https://alpha.example/favicon.ico',
            favicon: '/favicons/alpha.png',
        });
    });

    it('skips members whose hostname is already present', () => {
        const { additions, skippedCount } = planImport(sampleList, [
            target('x', 'www.beta.example'),
            target('y', 'unrelated.example'),
        ]);
        assert.deepEqual(additions.map((a) => a.id), ['import-alpha', 'import-gamma']);
        assert.equal(skippedCount, 1);
    });

    it('refuses a partial import when the list does not fully fit (all-or-nothing)', () => {
        const existing = Array.from({ length: CONNECTIVITY_TARGET_LIMIT - 1 }, (_, i) => target(`m${i}`));
        const { additions, overflowCount, freshCount, capacity } = planImport(sampleList, existing);
        assert.equal(additions.length, 0);
        assert.equal(overflowCount, 2);
        assert.equal(freshCount, 3);
        assert.equal(capacity, 1);
    });

    it('imports in full when the list exactly fits the remaining capacity', () => {
        const existing = Array.from({ length: CONNECTIVITY_TARGET_LIMIT - 3 }, (_, i) => target(`m${i}`));
        const { additions, overflowCount } = planImport(sampleList, existing);
        assert.equal(additions.length, 3);
        assert.equal(overflowCount, 0);
    });

    it('an over-cap set (legacy migration) can only shed, never gain', () => {
        const existing = Array.from({ length: CONNECTIVITY_TARGET_LIMIT + 5 }, (_, i) => target(`m${i}`));
        const { additions, overflowCount, capacity } = planImport(sampleList, existing);
        assert.equal(additions.length, 0);
        assert.equal(capacity, 0);
        assert.equal(overflowCount, 3);
    });
});

describe('isListFullyPresent', () => {
    it('is true when every member hostname exists in the target set', () => {
        const targets = [target('x', 'alpha.example'), target('y', 'www.beta.example'), target('z', 'gamma.example')];
        assert.equal(isListFullyPresent(sampleList, targets), true);
    });

    it('is false while any member is missing', () => {
        assert.equal(isListFullyPresent(sampleList, [target('x', 'alpha.example')]), false);
    });
});

describe('removeTarget', () => {
    it('removes the matching target', () => {
        const { targets } = removeTarget([target('a'), target('b')], 'a');
        assert.deepEqual(targets.map((m) => m.id), ['b']);
    });

    it('refuses to remove the last remaining target', () => {
        assert.equal(removeTarget([target('a')], 'a').error, 'last-target');
    });
});
