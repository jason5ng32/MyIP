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

    it('member hostnames are unique across all lists (import dedupe assumes it)', () => {
        const hosts = allMembers.map((m) => new URL(m.url).hostname);
        assert.equal(new Set(hosts).size, hosts.length);
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
