// Legacy Advanced Tools links: tools once opened as a homepage drawer driven
// by `/?tool=<slug>`, and those links live on in bookmarks, shares and search
// results. The router's beforeEach (router/index.js) sends them to the tool's
// page. The redirect keeps the navigation's own mode: a page load (the router's
// first navigation) and a history step replace the entry, so back never
// returns to the old URL; an in-app push stays a push, keeping the page it
// left in history.
//
//   resolveLegacyToolLink({ path, query, hash })
//     → null                 nothing to rewrite
//     → { path, query, hash? }
//
// Only the homepage carries the param. A known slug lands on /tools/<slug>;
// an unknown (or malformed: repeated, empty) one lands on the homepage. Every
// other query param (e.g. `q`, utm tags) and the hash ride along.

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
