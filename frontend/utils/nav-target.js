// What a click on a site-navigation entry does on the current route. The Nav
// (every route), the mobile nav sheet and the page breadcrumb share it:
//
//   resolveNavTarget({ item: { section: 'Connectivity' }, routeName: 'home' })
//     → { kind: 'scroll', section }            — scroll the homepage
//   resolveNavTarget({ item: { section: 'Connectivity' }, routeName: 'tool' })
//     → { kind: 'home-then-scroll', section }  — go home, then scroll
//   resolveNavTarget({ item: { tool: 'whois' }, routeName })
//     → { kind: 'tool', slug: 'whois' }        — open the tool's page
//
// Anything else resolves to null. composables/use-nav-target.js carries the
// result out.
//
// isPlainClick(event) — false for a click the browser should keep (modified
// or non-primary: new tab / window), so link handlers let those through.

export const resolveNavTarget = ({ item, routeName } = {}) => {
    if (typeof item?.tool === 'string' && item.tool) return { kind: 'tool', slug: item.tool };
    if (typeof item?.section === 'string' && item.section) {
        const kind = routeName === 'home' ? 'scroll' : 'home-then-scroll';
        return { kind, section: item.section };
    }
    return null;
};

export const isPlainClick = (event) => !(
    event.defaultPrevented || event.button !== 0
    || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
);
