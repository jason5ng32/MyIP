// Pure logic for the connectivityTargets preference: one-time build,
// import planning (hostname dedupe + all-or-nothing cap), the dialog's
// "fully present" check, and removal. Immutable — callers persist results.

import { CONNECTIVITY_TARGET_LIMIT, DEFAULT_LIST_MEMBERS, faviconPath } from '../data/connectivity-import-lists.js';

const hostnameOf = (url) => {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return null;
    }
};

// Stored target shape: { id, name, url, favicon? }.
const toStoredTarget = (m) => ({
    id: m.id,
    name: m.name,
    url: m.url,
    ...(m.favicon ? { favicon: m.favicon } : {}),
});

// Defaults plus the legacy customConnectivityTargets entries (listId tags
// dropped). No cap here — migration must never drop sites; an over-cap
// set just can't grow.
export const buildInitialTargets = (legacyTargets = []) => [
    ...DEFAULT_LIST_MEMBERS.map((m) => toStoredTarget({ ...m, favicon: faviconPath(m.id) })),
    ...legacyTargets.map(toStoredTarget),
];

// localStorage is user-editable, so a stored target can be arbitrary junk.
const isValidTarget = (t) => Boolean(t)
    && typeof t.id === 'string'
    && typeof t.name === 'string'
    && typeof t.url === 'string';

// Boot-time guard for the stored preference: keeps the well-formed entries,
// and when none remain (missing key, emptied array, all junk) rebuilds from
// the defaults plus any legacy flat targets — the grid must never come up
// empty. Idempotent; runs on every load.
export const sanitizeTargets = (stored, legacy) => {
    const valid = (list) => (Array.isArray(list) ? list.filter(isValidTarget) : []);
    const targets = valid(stored);
    if (targets.length > 0) return targets;
    return buildInitialTargets(valid(legacy));
};

// What importing a curated list would add. Dedupe is by hostname, so lists
// may overlap each other and the defaults. All-or-nothing: if the fresh
// members don't all fit under the cap, nothing is added and overflowCount
// reports the shortfall — a partial import would sit behind a full ✓.
export const planImport = (list, targets = [], { limit = CONNECTIVITY_TARGET_LIMIT } = {}) => {
    const existingHosts = new Set(targets.map((t) => hostnameOf(t.url)).filter(Boolean));
    const fresh = list.members.filter((m) => !existingHosts.has(hostnameOf(m.url)));
    const skippedCount = list.members.length - fresh.length;
    const capacity = Math.max(0, limit - targets.length);
    if (fresh.length > capacity) {
        return { additions: [], skippedCount, overflowCount: fresh.length - capacity, freshCount: fresh.length, capacity };
    }
    const additions = fresh.map((m) => toStoredTarget({
        ...m,
        id: `import-${m.id}`,
        favicon: faviconPath(m.id),
    }));
    return { additions, skippedCount, overflowCount: 0, freshCount: fresh.length, capacity };
};

// True when every member of the curated list is already present (by
// hostname) — the dialog shows a check instead of the import button then.
export const isListFullyPresent = (list, targets = []) => {
    const existingHosts = new Set(targets.map((t) => hostnameOf(t.url)).filter(Boolean));
    return list.members.every((m) => existingHosts.has(hostnameOf(m.url)));
};

// Remove one target; the set always keeps at least one site (the UI
// toasts on the last one — this guard holds for any caller).
export const removeTarget = (targets = [], id) => {
    if (targets.length <= 1) return { error: 'last-target' };
    return { targets: targets.filter((t) => t.id !== id) };
};
