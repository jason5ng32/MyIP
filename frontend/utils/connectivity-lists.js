// Pure logic for the multi-list Connectivity model stored in the
// `connectivityLists` preference: boot-time sanitize/migration, list CRUD
// guards, member add/remove, curated-list import planning, and the card's
// open-website link. Immutable — callers persist the returned `lists`.

import {
    CONNECTIVITY_TARGET_LIMIT,
    CONNECTIVITY_LIST_LIMIT,
    CONNECTIVITY_LIST_NAME_LIMIT,
    MINE_LIST_ID,
    DEFAULT_LIST_MEMBERS,
    faviconPath,
} from '../data/connectivity-import-lists.js';

export const CONNECTIVITY_LISTS_SCHEMA_VERSION = 1;

const hostnameOf = (url) => {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return null;
    }
};

// The card's open-website link: explicit override, else the test URL's origin.
export const siteUrlOf = (target) => {
    if (target?.siteUrl) return target.siteUrl;
    try {
        return new URL(target.url).origin;
    } catch {
        return null;
    }
};

// Stored member shape: { id, name, url, siteUrl?, favicon? }.
const toStoredMember = (m) => ({
    id: m.id,
    name: m.name,
    url: m.url,
    ...(m.siteUrl ? { siteUrl: m.siteUrl } : {}),
    ...(m.favicon ? { favicon: m.favicon } : {}),
});

// localStorage is user-editable, so stored entries can be arbitrary junk.
const isValidMember = (m) => Boolean(m)
    && typeof m.id === 'string'
    && typeof m.name === 'string'
    && typeof m.url === 'string';

const validMembers = (list) => (Array.isArray(list) ? list.filter(isValidMember) : []);

// Defaults plus legacy entries (provenance tags dropped). No cap here —
// migration must never drop sites; an over-cap set just can't grow.
const buildInitialMembers = (legacyTargets = []) => [
    ...DEFAULT_LIST_MEMBERS.map((m) => toStoredMember({ ...m, favicon: faviconPath(m.id) })),
    ...legacyTargets.map(toStoredMember),
];

// Boot-time guard, idempotent. A missing/corrupted model rebuilds around
// one "Mine" list seeded from the legacy keys (connectivityTargets, then
// customConnectivityTargets + defaults); junk entries drop, and a missing
// or hand-emptied Mine is re-seeded with the defaults.
export const sanitizeLists = (stored, legacyFlatTargets, legacyCustomTargets) => {
    const legacyMembers = () => {
        const flat = validMembers(legacyFlatTargets);
        if (flat.length > 0) return flat.map(toStoredMember);
        return buildInitialMembers(validMembers(legacyCustomTargets));
    };

    const isValidList = (l) => Boolean(l)
        && typeof l.id === 'string'
        && (l.id === MINE_LIST_ID || (typeof l.name === 'string' && l.name.trim().length > 0))
        && Array.isArray(l.members);

    const storedLists = Array.isArray(stored?.lists) ? stored.lists.filter(isValidList) : [];
    const lists = storedLists.map((l) => ({
        id: l.id,
        // Mine's display name is localized, never stored.
        name: l.id === MINE_LIST_ID ? null : l.name,
        members: l.members.filter(isValidMember).map(toStoredMember),
    }));

    const mine = lists.find((l) => l.id === MINE_LIST_ID);
    if (!mine) {
        lists.unshift({ id: MINE_LIST_ID, name: null, members: legacyMembers() });
    } else if (mine.members.length === 0) {
        mine.members = buildInitialMembers();
    }
    return { schemaVersion: CONNECTIVITY_LISTS_SCHEMA_VERSION, lists };
};

const listById = (lists, id) => lists.find((l) => l.id === id);

const replaceList = (lists, updated) => lists.map((l) => (l.id === updated.id ? updated : l));

// ── List CRUD ──────────────────────────────────────────────────────────────
// Each op returns { lists } or { error: '<code>' }; guards live here, not
// in the UI, so the rules hold for every caller.

export const createList = (lists, name) => {
    const trimmed = (name || '').trim().slice(0, CONNECTIVITY_LIST_NAME_LIMIT);
    if (!trimmed) return { error: 'name-required' };
    if (lists.length >= CONNECTIVITY_LIST_LIMIT) return { error: 'list-limit' };
    return { lists: [...lists, { id: `list-${Date.now()}`, name: trimmed, members: [] }] };
};

export const renameList = (lists, listId, name) => {
    if (listId === MINE_LIST_ID) return { error: 'immutable' };
    const trimmed = (name || '').trim().slice(0, CONNECTIVITY_LIST_NAME_LIMIT);
    if (!trimmed) return { error: 'name-required' };
    const list = listById(lists, listId);
    if (!list) return { error: 'not-found' };
    return { lists: replaceList(lists, { ...list, name: trimmed }) };
};

// direction: -1 moves toward the front, +1 toward the back. Out-of-range
// moves are no-ops (the UI disables the buttons at the edges anyway).
export const moveList = (lists, listId, direction) => {
    const from = lists.findIndex((l) => l.id === listId);
    const to = from + direction;
    if (from === -1 || to < 0 || to >= lists.length) return { lists };
    const next = [...lists];
    [next[from], next[to]] = [next[to], next[from]];
    return { lists: next };
};

export const deleteList = (lists, listId) => {
    if (listId === MINE_LIST_ID) return { error: 'immutable' };
    const list = listById(lists, listId);
    if (!list) return { error: 'not-found' };
    if (list.members.length > 0) return { error: 'not-empty' };
    return { lists: lists.filter((l) => l.id !== listId) };
};

// ── Members ────────────────────────────────────────────────────────────────
// Hand-adds don't hostname-dedupe: probing two endpoints on one host is a
// legitimate custom setup. Only curated imports dedupe (below).

export const addMember = (lists, listId, member) => {
    const list = listById(lists, listId);
    if (!list) return { error: 'not-found' };
    if (list.members.length >= CONNECTIVITY_TARGET_LIMIT) return { error: 'list-full' };
    return { lists: replaceList(lists, { ...list, members: [...list.members, toStoredMember(member)] }) };
};

export const removeMember = (lists, listId, memberId) => {
    const list = listById(lists, listId);
    if (!list) return { error: 'not-found' };
    // Mine — the grid's fallback list — always keeps at least one site.
    if (listId === MINE_LIST_ID && list.members.length <= 1) return { error: 'last-of-mine' };
    return { lists: replaceList(lists, { ...list, members: list.members.filter((m) => m.id !== memberId) }) };
};

// ── Curated-list import ────────────────────────────────────────────────────

// What importing a curated list into `targetList` would add. Dedupe is by
// hostname within the target list only. All-or-nothing: when the fresh
// members don't all fit under the cap, nothing is added and `overflowCount`
// reports the shortfall.
export const planImport = (curatedList, targetList, { limit = CONNECTIVITY_TARGET_LIMIT } = {}) => {
    const existingHosts = new Set(targetList.members.map((m) => hostnameOf(m.url)).filter(Boolean));
    const fresh = curatedList.members.filter((m) => !existingHosts.has(hostnameOf(m.url)));
    const skippedCount = curatedList.members.length - fresh.length;
    const capacity = Math.max(0, limit - targetList.members.length);
    if (fresh.length > capacity) {
        return { additions: [], skippedCount, overflowCount: fresh.length - capacity, freshCount: fresh.length, capacity };
    }
    const additions = fresh.map((m) => toStoredMember({
        ...m,
        id: `import-${m.id}`,
        favicon: faviconPath(m.id),
    }));
    return { additions, skippedCount, overflowCount: 0, freshCount: fresh.length, capacity };
};

// True when every member of the curated list is already present (by
// hostname) in the target list — its menu entry goes inert then.
export const isListFullyPresent = (curatedList, targetList) => {
    const existingHosts = new Set(targetList.members.map((m) => hostnameOf(m.url)).filter(Boolean));
    return curatedList.members.every((m) => existingHosts.has(hostnameOf(m.url)));
};

// Import a curated list into an existing list. `capacity` failures carry
// the plan for the error message.
export const importIntoList = (lists, listId, curatedList) => {
    const list = listById(lists, listId);
    if (!list) return { error: 'not-found' };
    const plan = planImport(curatedList, list);
    if (plan.overflowCount) return { error: 'capacity', plan };
    return { lists: replaceList(lists, { ...list, members: [...list.members, ...plan.additions] }), plan };
};

// Create a fresh list named after the curated one and import into it.
// Curated lists all fit the per-list cap, so only the list-count guard
// can fail here.
export const importAsNewList = (lists, curatedList, name) => {
    const created = createList(lists, name);
    if (created.error) return created;
    const newList = created.lists[created.lists.length - 1];
    const plan = planImport(curatedList, newList);
    return {
        lists: replaceList(created.lists, { ...newList, members: plan.additions }),
        listId: newList.id,
        plan,
    };
};
