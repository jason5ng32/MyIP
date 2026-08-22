// Data-integrity tests for the curated Connectivity import lists
// (frontend/data/connectivity-import-lists.js): shape, uniqueness, size
// floor, HTTPS-only URLs, and a committed favicon PNG for every member,
// built-in target, and tile-preview reference.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    IMPORT_LISTS,
    BUILTIN_FAVICONS,
    DEFAULT_LIST_MEMBERS,
    SYSTEM_IMPORT_LIST,
    TILE_PREVIEW,
    faviconPath,
    CONNECTIVITY_TARGET_LIMIT,
} from '../frontend/data/connectivity-import-lists.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const faviconFile = (id) => path.join(repoRoot, 'public', 'favicons', `${id}.png`);
const allMembers = IMPORT_LISTS.flatMap((l) => l.members);

describe('import lists data integrity', () => {
    it('list ids are unique and every list carries an emoji icon', () => {
        const ids = IMPORT_LISTS.map((l) => l.id);
        assert.equal(new Set(ids).size, ids.length);
        for (const list of IMPORT_LISTS) {
            assert.ok(typeof list.emoji === 'string' && list.emoji.length > 0,
                `${list.id} needs an emoji`);
        }
    });

    it('every list has at least 10 members', () => {
        for (const list of IMPORT_LISTS) {
            assert.ok(list.members.length >= 10, `${list.id} has ${list.members.length}`);
        }
    });

    it('member ids are globally unique (import-entry ids derive from them)', () => {
        const ids = allMembers.map((m) => m.id);
        assert.equal(new Set(ids).size, ids.length);
    });

    it('member hostnames are unique within each list (import dedupe is by hostname)', () => {
        // Cross-list overlap is deliberate — themed lists stay semantically
        // complete even where they intersect the defaults (AI ⊃ ChatGPT).
        for (const list of IMPORT_LISTS) {
            const hosts = list.members.map((m) => new URL(m.url).hostname);
            assert.equal(new Set(hosts).size, hosts.length, list.id);
        }
    });

    it('members shared with the defaults reuse the exact default definition', () => {
        // Overlapping entries are references into DEFAULT_LIST_MEMBERS, so
        // url / iconDomain can never drift between the two.
        const defaults = new Map(DEFAULT_LIST_MEMBERS.map((m) => [m.id, m]));
        let shared = 0;
        for (const m of allMembers) {
            if (!defaults.has(m.id)) continue;
            assert.equal(m, defaults.get(m.id), m.id);
            shared += 1;
        }
        assert.ok(shared > 0, 'expected some default members inside themed lists');
    });

    it('the system import list re-exposes the defaults under a non-clashing id', () => {
        assert.equal(SYSTEM_IMPORT_LIST.members, DEFAULT_LIST_MEMBERS);
        assert.ok(SYSTEM_IMPORT_LIST.emoji.length > 0);
        assert.ok(!IMPORT_LISTS.some((l) => l.id === SYSTEM_IMPORT_LIST.id));
    });

    it('default list members are well-formed and favicon-backed', () => {
        const ids = DEFAULT_LIST_MEMBERS.map((m) => m.id);
        assert.equal(new Set(ids).size, ids.length);
        for (const m of DEFAULT_LIST_MEMBERS) {
            assert.equal(new URL(m.url).protocol, 'https:', m.id);
            assert.ok(existsSync(faviconFile(m.id)), `missing public/favicons/${m.id}.png`);
        }
    });

    it('every member URL is HTTPS and parseable', () => {
        for (const m of allMembers) {
            assert.equal(new URL(m.url).protocol, 'https:', m.id);
        }
    });

    it('every member and built-in target has a committed favicon PNG', () => {
        const builtinIds = BUILTIN_FAVICONS.map((b) => b.id);
        for (const id of [...allMembers.map((m) => m.id), ...builtinIds]) {
            assert.ok(existsSync(faviconFile(id)), `missing public/favicons/${id}.png`);
        }
    });

    it('faviconPath points into the committed directory', () => {
        assert.equal(faviconPath('telegram'), '/favicons/telegram.png');
    });

    it('tile preview references resolve to emoji or real members', () => {
        const memberIds = new Set(allMembers.map((m) => m.id));
        for (const item of TILE_PREVIEW) {
            if (item.type === 'emoji') assert.ok(item.emoji, 'emoji item needs a char');
            else assert.ok(memberIds.has(item.id), item.id);
        }
    });

    it('no single list exceeds the shared target cap', () => {
        for (const list of IMPORT_LISTS) {
            assert.ok(list.members.length <= CONNECTIVITY_TARGET_LIMIT, list.id);
        }
    });
});
