// Legacy `/?tool=<slug>` links (the drawer era; still in bookmarks, shares and
// search results) → the tool's page, via the router's beforeEach. A known slug
// lands on /tools/<slug>, an unknown or malformed one on the homepage; other
// query params and the hash ride along. Returns null when there is nothing to
// rewrite. The redirect keeps the navigation's mode: a page load or history
// step replaces the entry, an in-app push stays a push.

import { TOOL_BY_SLUG } from '../data/tools.js';

const HOME_PATH = '/';

export const resolveLegacyToolLink = ({ path, query = {}, hash = '' } = {}) => {
    if (path !== HOME_PATH || !query || !Object.hasOwn(query, 'tool')) return null;
    const { tool, ...rest } = query;
    const known = typeof tool === 'string' && TOOL_BY_SLUG.has(tool);
    const location = { path: known ? `/tools/${tool}` : HOME_PATH, query: rest };
    if (hash) location.hash = hash;
    return location;
};
