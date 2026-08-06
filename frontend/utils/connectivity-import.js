// Pure logic for the Connectivity "import a curated list" flow: planning an
// import (dedupe against existing targets + shared cap) and removing a
// previously imported list.

import { CONNECTIVITY_TARGET_LIMIT, faviconPath } from '../data/connectivity-import-lists.js';

const hostnameOf = (url) => {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return null;
    }
};

// Decide what an import would actually add. `existingUrls` covers built-in
// targets plus every current custom/imported one; `currentCount` is the
// stored customConnectivityTargets length (built-ins don't count against
// the cap). Returns preference-shaped entries ready to persist.
export const planImport = (list, { existingUrls = [], currentCount = 0, limit = CONNECTIVITY_TARGET_LIMIT } = {}) => {
    const existingHosts = new Set(existingUrls.map(hostnameOf).filter(Boolean));
    const fresh = list.members.filter((m) => !existingHosts.has(hostnameOf(m.url)));
    const skippedCount = list.members.length - fresh.length;
    const capacity = Math.max(0, limit - currentCount);
    const additions = fresh.slice(0, capacity).map((m) => ({
        id: `import-${m.id}`,
        name: m.name,
        url: m.url,
        listId: list.id,
        favicon: faviconPath(m.id),
    }));
    return { additions, skippedCount, overflowCount: fresh.length - additions.length };
};

// Ids of lists that currently have at least one imported member standing.
export const importedListIds = (customTargets = []) => new Set(
    customTargets.map((t) => t.listId).filter(Boolean),
);

// Drop every remaining member of one imported list, keep everything else.
export const withoutList = (customTargets = [], listId) => customTargets.filter(
    (t) => t.listId !== listId,
);
