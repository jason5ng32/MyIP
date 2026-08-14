// Tests for the Connectivity import-list logic
// (frontend/utils/connectivity-import.js): import planning (dedupe + cap),
// list removal, and imported-list detection.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    planImport,
    importedListIds,
    withoutList,
} from '../frontend/utils/connectivity-import.js';
import { CONNECTIVITY_TARGET_LIMIT } from '../frontend/data/connectivity-import-lists.js';

const sampleList = {
    id: 'sample',
    members: [
        { id: 'alpha', name: 'Alpha', url: 'https://alpha.example/favicon.ico' },
        { id: 'beta', name: 'Beta', url: 'https://www.beta.example/favicon.ico' },
        { id: 'gamma', name: 'Gamma', url: 'https://gamma.example/favicon.ico' },
    ],
};

describe('planImport', () => {
    it('materializes members as preference entries tagged with the list id', () => {
        const { additions, skippedCount, overflowCount } = planImport(sampleList, {});
        assert.equal(additions.length, 3);
        assert.equal(skippedCount, 0);
        assert.equal(overflowCount, 0);
        assert.deepEqual(additions[0], {
            id: 'import-alpha',
            name: 'Alpha',
            url: 'https://alpha.example/favicon.ico',
            listId: 'sample',
            favicon: '/favicons/alpha.png',
        });
    });

    it('skips members whose hostname already exists (built-in or custom)', () => {
        const { additions, skippedCount } = planImport(sampleList, {
            existingUrls: [
                'https://www.beta.example/some/other/path.ico',
                'https://unrelated.example/favicon.ico',
            ],
        });
        assert.deepEqual(additions.map((a) => a.id), ['import-alpha', 'import-gamma']);
        assert.equal(skippedCount, 1);
    });

    it('refuses a partial import when the list does not fully fit (all-or-nothing)', () => {
        const { additions, overflowCount, freshCount, capacity } = planImport(sampleList, {
            currentCount: CONNECTIVITY_TARGET_LIMIT - 1,
        });
        assert.equal(additions.length, 0);
        assert.equal(overflowCount, 2);
        assert.equal(freshCount, 3);
        assert.equal(capacity, 1);
    });

    it('imports in full when the list exactly fits the remaining capacity', () => {
        const { additions, overflowCount } = planImport(sampleList, {
            currentCount: CONNECTIVITY_TARGET_LIMIT - 3,
        });
        assert.equal(additions.length, 3);
        assert.equal(overflowCount, 0);
    });

    it('adds nothing when the cap is already reached', () => {
        const { additions, overflowCount } = planImport(sampleList, {
            currentCount: CONNECTIVITY_TARGET_LIMIT,
        });
        assert.equal(additions.length, 0);
        assert.equal(overflowCount, 3);
    });

    it('counts only fresh members against capacity — deduped ones do not block', () => {
        // 1 slot left, 2 of 3 members already present: the single fresh one fits.
        const { additions, overflowCount, skippedCount } = planImport(sampleList, {
            existingUrls: ['https://alpha.example/x', 'https://www.beta.example/x'],
            currentCount: CONNECTIVITY_TARGET_LIMIT - 1,
        });
        assert.deepEqual(additions.map((a) => a.id), ['import-gamma']);
        assert.equal(overflowCount, 0);
        assert.equal(skippedCount, 2);
    });

    it('ignores malformed existing URLs instead of throwing', () => {
        const { additions } = planImport(sampleList, { existingUrls: ['not a url'] });
        assert.equal(additions.length, 3);
    });
});

describe('importedListIds / withoutList', () => {
    const prefs = [
        { id: 'custom-1', name: 'Mine', url: 'https://mine.example/favicon.ico' },
        { id: 'import-alpha', listId: 'sample', url: 'https://alpha.example/favicon.ico' },
        { id: 'import-yandex', listId: 'russia', url: 'https://yandex.ru/favicon.ico' },
    ];

    it('collects listIds from imported entries only', () => {
        assert.deepEqual([...importedListIds(prefs)].sort(), ['russia', 'sample']);
    });

    it('removes every member of one list, keeps customs and other lists', () => {
        const left = withoutList(prefs, 'sample');
        assert.deepEqual(left.map((t) => t.id), ['custom-1', 'import-yandex']);
    });
});

