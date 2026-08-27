// Tests for the multi-list Connectivity model
// (frontend/utils/connectivity-lists.js): boot-time sanitize/migration from
// both legacy eras, list CRUD guard rules, member add/remove guards, import
// planning (per-list hostname dedupe + all-or-nothing cap), the combined
// import ops, and the card's open-website link derivation.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    sanitizeLists,
    createList,
    renameList,
    moveList,
    deleteList,
    addMember,
    removeMember,
    planImport,
    isListFullyPresent,
    importIntoList,
    importAsNewList,
    siteUrlOf,
} from '../frontend/utils/connectivity-lists.js';
import {
    CONNECTIVITY_TARGET_LIMIT,
    CONNECTIVITY_LIST_LIMIT,
    CONNECTIVITY_LIST_NAME_LIMIT,
    MINE_LIST_ID,
    DEFAULT_LIST_MEMBERS,
} from '../frontend/data/connectivity-import-lists.js';

const member = (id, host = `${id}.example`) => ({ id, name: id, url: `https://${host}/favicon.ico` });

const makeLists = (...lists) => lists.map((l) => ({ members: [], ...l }));

const mineWith = (members) => makeLists({ id: MINE_LIST_ID, name: null, members });

describe('sanitizeLists', () => {
    it('adopts the flat connectivityTargets era as Mine, untouched', () => {
        const flat = [member('a'), member('b')];
        const model = sanitizeLists(null, flat, []);
        assert.equal(model.schemaVersion, 1);
        assert.equal(model.lists.length, 1);
        assert.equal(model.lists[0].id, MINE_LIST_ID);
        assert.equal(model.lists[0].name, null);
        assert.deepEqual(model.lists[0].members.map((m) => m.id), ['a', 'b']);
    });

    it('falls back to defaults + oldest-era customs when the flat set is empty', () => {
        const legacy = [
            { id: 'custom-1', name: 'Probe', url: 'https://probe.example/health' },
            { id: 'import-ozon', name: 'Ozon', url: 'https://www.ozon.ru/favicon.ico', listId: 'russia', favicon: '/favicons/ozon.png' },
        ];
        const mine = sanitizeLists(null, [], legacy).lists[0];
        assert.equal(mine.members.length, DEFAULT_LIST_MEMBERS.length + 2);
        // Defaults carry their committed favicon and any siteUrl override.
        const cloudflare = mine.members.find((m) => m.id === 'cloudflare');
        assert.equal(cloudflare.favicon, '/favicons/cloudflare.png');
        assert.equal(cloudflare.siteUrl, 'https://www.cloudflare.com');
        // Legacy entries keep their favicon but lose the listId tag.
        const ozon = mine.members.find((m) => m.id === 'import-ozon');
        assert.equal(ozon.favicon, '/favicons/ozon.png');
        assert.equal('listId' in ozon, false);
    });

    it('never drops migrated sites, even past the per-list cap', () => {
        const flat = Array.from({ length: CONNECTIVITY_TARGET_LIMIT + 5 }, (_, i) => member(`m${i}`));
        const mine = sanitizeLists(null, flat, []).lists[0];
        assert.equal(mine.members.length, CONNECTIVITY_TARGET_LIMIT + 5);
    });

    it('passes a well-formed stored model through untouched', () => {
        const stored = {
            schemaVersion: 1,
            lists: [
                { id: MINE_LIST_ID, name: null, members: [member('a')] },
                { id: 'list-1', name: 'Work', members: [] },
            ],
        };
        const model = sanitizeLists(stored, [], []);
        assert.deepEqual(model.lists.map((l) => l.id), [MINE_LIST_ID, 'list-1']);
        assert.deepEqual(model.lists[0].members.map((m) => m.id), ['a']);
    });

    it('drops junk lists and junk members but keeps the valid rest', () => {
        const stored = {
            lists: [
                { id: MINE_LIST_ID, name: null, members: [member('a'), { id: 42 }, null] },
                { id: 'list-1', name: '', members: [] }, // empty name → junk
                { id: 'list-2', name: 'Ok', members: 'nope' }, // members not array → junk
                { id: 'list-3', name: 'Kept', members: [member('b')] },
            ],
        };
        const model = sanitizeLists(stored, [], []);
        assert.deepEqual(model.lists.map((l) => l.id), [MINE_LIST_ID, 'list-3']);
        assert.deepEqual(model.lists[0].members.map((m) => m.id), ['a']);
    });

    it('re-seeds a missing or hand-emptied Mine with the defaults', () => {
        const noMine = sanitizeLists({ lists: [{ id: 'list-1', name: 'Work', members: [] }] }, [], []);
        assert.equal(noMine.lists[0].id, MINE_LIST_ID);
        assert.equal(noMine.lists[0].members.length, DEFAULT_LIST_MEMBERS.length);

        const emptyMine = sanitizeLists({ lists: [{ id: MINE_LIST_ID, name: null, members: [] }] }, [], []);
        assert.equal(emptyMine.lists[0].members.length, DEFAULT_LIST_MEMBERS.length);
    });

    it("nulls out a stored name on Mine (its display name is localized)", () => {
        const model = sanitizeLists({ lists: [{ id: MINE_LIST_ID, name: 'Hacked', members: [member('a')] }] }, [], []);
        assert.equal(model.lists[0].name, null);
    });

    it('treats non-object stored values (missing key, corruption) as absent', () => {
        for (const stored of [null, undefined, 'junk', 42, { lists: 'nope' }]) {
            const model = sanitizeLists(stored, [member('a')], []);
            assert.deepEqual(model.lists[0].members.map((m) => m.id), ['a'], String(stored));
        }
    });
});

describe('siteUrlOf', () => {
    it('prefers the explicit override', () => {
        assert.equal(siteUrlOf({ url: 'https://res.wx.qq.com/x.ico', siteUrl: 'https://wx.qq.com' }), 'https://wx.qq.com');
    });

    it('falls back to the test URL origin', () => {
        assert.equal(siteUrlOf({ url: 'https://www.github.com/favicon.ico' }), 'https://www.github.com');
    });

    it('returns null for an unparseable URL', () => {
        assert.equal(siteUrlOf({ url: 'not-a-url' }), null);
    });
});

describe('createList', () => {
    it('appends a trimmed, capped-length list with a fresh id', () => {
        const { lists } = createList(mineWith([member('a')]), '  Work  ');
        assert.equal(lists.length, 2);
        assert.equal(lists[1].name, 'Work');
        assert.match(lists[1].id, /^list-\d+$/);
        assert.deepEqual(lists[1].members, []);
    });

    it('rejects an empty name', () => {
        assert.equal(createList(mineWith([]), '   ').error, 'name-required');
    });

    it('caps the name at the length limit', () => {
        const { lists } = createList(mineWith([]), 'x'.repeat(CONNECTIVITY_LIST_NAME_LIMIT + 10));
        assert.equal(lists[1].name.length, CONNECTIVITY_LIST_NAME_LIMIT);
    });

    it('rejects creation past the list cap', () => {
        const full = makeLists(...Array.from({ length: CONNECTIVITY_LIST_LIMIT }, (_, i) => ({ id: `l${i}`, name: `L${i}` })));
        assert.equal(createList(full, 'One more').error, 'list-limit');
    });
});

describe('renameList', () => {
    it('renames a user list', () => {
        const lists = makeLists({ id: MINE_LIST_ID, name: null }, { id: 'l1', name: 'Old' });
        assert.equal(renameList(lists, 'l1', 'New').lists[1].name, 'New');
    });

    it('refuses to rename Mine', () => {
        assert.equal(renameList(mineWith([]), MINE_LIST_ID, 'Anything').error, 'immutable');
    });

    it('requires a non-empty name', () => {
        const lists = makeLists({ id: MINE_LIST_ID, name: null }, { id: 'l1', name: 'Old' });
        assert.equal(renameList(lists, 'l1', ' ').error, 'name-required');
    });
});

describe('moveList', () => {
    const lists = makeLists({ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' });

    it('swaps with the neighbor in the given direction', () => {
        assert.deepEqual(moveList(lists, 'b', -1).lists.map((l) => l.id), ['b', 'a', 'c']);
        assert.deepEqual(moveList(lists, 'b', 1).lists.map((l) => l.id), ['a', 'c', 'b']);
    });

    it('is a no-op at the edges', () => {
        assert.deepEqual(moveList(lists, 'a', -1).lists.map((l) => l.id), ['a', 'b', 'c']);
        assert.deepEqual(moveList(lists, 'c', 1).lists.map((l) => l.id), ['a', 'b', 'c']);
    });
});

describe('deleteList', () => {
    it('deletes an empty user list', () => {
        const lists = makeLists({ id: MINE_LIST_ID, name: null, members: [member('a')] }, { id: 'l1', name: 'Empty' });
        assert.deepEqual(deleteList(lists, 'l1').lists.map((l) => l.id), [MINE_LIST_ID]);
    });

    it('refuses to delete Mine', () => {
        assert.equal(deleteList(mineWith([]), MINE_LIST_ID).error, 'immutable');
    });

    it('refuses to delete a non-empty list', () => {
        const lists = makeLists({ id: MINE_LIST_ID, name: null }, { id: 'l1', name: 'Full', members: [member('a')] });
        assert.equal(deleteList(lists, 'l1').error, 'not-empty');
    });
});

describe('addMember', () => {
    it('appends to the target list only', () => {
        const lists = makeLists({ id: MINE_LIST_ID, name: null, members: [member('a')] }, { id: 'l1', name: 'Work' });
        const result = addMember(lists, 'l1', member('b'));
        assert.equal(result.lists[0].members.length, 1);
        assert.deepEqual(result.lists[1].members.map((m) => m.id), ['b']);
    });

    it('allows two endpoints on the same hostname (hand-adds do not dedupe)', () => {
        const lists = mineWith([member('a', 'probe.example')]);
        const result = addMember(lists, MINE_LIST_ID, member('b', 'probe.example'));
        assert.equal(result.lists[0].members.length, 2);
    });

    it('rejects once the per-list cap is reached', () => {
        const members = Array.from({ length: CONNECTIVITY_TARGET_LIMIT }, (_, i) => member(`m${i}`));
        assert.equal(addMember(mineWith(members), MINE_LIST_ID, member('extra')).error, 'list-full');
    });
});

describe('removeMember', () => {
    it('removes from the target list', () => {
        const lists = mineWith([member('a'), member('b')]);
        assert.deepEqual(removeMember(lists, MINE_LIST_ID, 'a').lists[0].members.map((m) => m.id), ['b']);
    });

    it("refuses to remove Mine's last member", () => {
        assert.equal(removeMember(mineWith([member('a')]), MINE_LIST_ID, 'a').error, 'last-of-mine');
    });

    it('lets any other list be emptied (deletion requires it)', () => {
        const lists = makeLists({ id: MINE_LIST_ID, name: null, members: [member('a')] }, { id: 'l1', name: 'Work', members: [member('b')] });
        assert.deepEqual(removeMember(lists, 'l1', 'b').lists[1].members, []);
    });
});

describe('planImport', () => {
    const curated = {
        id: 'sample',
        members: [
            { id: 'alpha', name: 'Alpha', url: 'https://alpha.example/favicon.ico' },
            { id: 'beta', name: 'Beta', url: 'https://www.beta.example/favicon.ico', siteUrl: 'https://beta.example' },
            { id: 'gamma', name: 'Gamma', url: 'https://gamma.example/favicon.ico' },
        ],
    };

    it('materializes members with import ids, favicons and siteUrl overrides', () => {
        const { additions, skippedCount, overflowCount } = planImport(curated, { members: [] });
        assert.equal(additions.length, 3);
        assert.equal(skippedCount, 0);
        assert.equal(overflowCount, 0);
        assert.deepEqual(additions[0], {
            id: 'import-alpha',
            name: 'Alpha',
            url: 'https://alpha.example/favicon.ico',
            favicon: '/favicons/alpha.png',
        });
        assert.equal(additions[1].siteUrl, 'https://beta.example');
    });

    it('dedupes by hostname within the target list only', () => {
        const target = { members: [member('x', 'www.beta.example')] };
        const { additions, skippedCount } = planImport(curated, target);
        assert.deepEqual(additions.map((a) => a.id), ['import-alpha', 'import-gamma']);
        assert.equal(skippedCount, 1);
    });

    it('refuses a partial import when the list does not fully fit (all-or-nothing)', () => {
        const target = { members: Array.from({ length: CONNECTIVITY_TARGET_LIMIT - 1 }, (_, i) => member(`m${i}`)) };
        const { additions, overflowCount, freshCount, capacity } = planImport(curated, target);
        assert.equal(additions.length, 0);
        assert.equal(overflowCount, 2);
        assert.equal(freshCount, 3);
        assert.equal(capacity, 1);
    });

    it('imports in full when the list exactly fits the remaining capacity', () => {
        const target = { members: Array.from({ length: CONNECTIVITY_TARGET_LIMIT - 3 }, (_, i) => member(`m${i}`)) };
        const { additions, overflowCount } = planImport(curated, target);
        assert.equal(additions.length, 3);
        assert.equal(overflowCount, 0);
    });

    it('an over-cap list (legacy migration) can only shed, never gain', () => {
        const target = { members: Array.from({ length: CONNECTIVITY_TARGET_LIMIT + 5 }, (_, i) => member(`m${i}`)) };
        const { additions, overflowCount, capacity } = planImport(curated, target);
        assert.equal(additions.length, 0);
        assert.equal(capacity, 0);
        assert.equal(overflowCount, 3);
    });
});

describe('isListFullyPresent', () => {
    const curated = {
        members: [
            { id: 'alpha', name: 'Alpha', url: 'https://alpha.example/favicon.ico' },
            { id: 'beta', name: 'Beta', url: 'https://beta.example/favicon.ico' },
        ],
    };

    it('is true when every member hostname exists in the target', () => {
        const target = { members: [member('x', 'alpha.example'), member('y', 'beta.example'), member('z')] };
        assert.equal(isListFullyPresent(curated, target), true);
    });

    it('is false while any member is missing', () => {
        const target = { members: [member('x', 'alpha.example')] };
        assert.equal(isListFullyPresent(curated, target), false);
    });
});

describe('importIntoList / importAsNewList', () => {
    const curated = {
        id: 'sample',
        members: [
            { id: 'alpha', name: 'Alpha', url: 'https://alpha.example/favicon.ico' },
            { id: 'beta', name: 'Beta', url: 'https://beta.example/favicon.ico' },
        ],
    };

    it('imports into an existing list, other lists untouched', () => {
        const lists = makeLists({ id: MINE_LIST_ID, name: null, members: [member('a')] }, { id: 'l1', name: 'Work' });
        const result = importIntoList(lists, 'l1', curated);
        assert.equal(result.lists[0].members.length, 1);
        assert.deepEqual(result.lists[1].members.map((m) => m.id), ['import-alpha', 'import-beta']);
    });

    it('surfaces a capacity error with the plan attached, storing nothing', () => {
        const members = Array.from({ length: CONNECTIVITY_TARGET_LIMIT - 1 }, (_, i) => member(`m${i}`));
        const result = importIntoList(mineWith(members), MINE_LIST_ID, curated);
        assert.equal(result.error, 'capacity');
        assert.equal(result.plan.freshCount, 2);
        assert.equal('lists' in result, false);
    });

    it('creates a new list named after the curated one and fills it', () => {
        const result = importAsNewList(mineWith([member('a')]), curated, 'Sample Pack');
        assert.equal(result.lists.length, 2);
        const created = result.lists[1];
        assert.equal(created.id, result.listId);
        assert.equal(created.name, 'Sample Pack');
        assert.deepEqual(created.members.map((m) => m.id), ['import-alpha', 'import-beta']);
    });

    it('propagates the list-cap error from creation', () => {
        const full = makeLists(...Array.from({ length: CONNECTIVITY_LIST_LIMIT }, (_, i) => ({ id: `l${i}`, name: `L${i}` })));
        assert.equal(importAsNewList(full, curated, 'One more').error, 'list-limit');
    });
});
