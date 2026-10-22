// What a click on a site-navigation entry (Nav, mobile nav sheet, breadcrumb)
// does on the current route: `{ tool }` → { kind: 'tool', slug }; `{ section }`
// → 'scroll' on Home, 'home-then-scroll' elsewhere; anything else → null.
// composables/use-nav-target.js carries it out.

export const resolveNavTarget = ({ item, routeName } = {}) => {
    if (typeof item?.tool === 'string' && item.tool) return { kind: 'tool', slug: item.tool };
    if (typeof item?.section === 'string' && item.section) {
        const kind = routeName === 'home' ? 'scroll' : 'home-then-scroll';
        return { kind, section: item.section };
    }
    return null;
};

// False for a click the browser should keep (modified or non-primary: new tab / window).
export const isPlainClick = (event) => !(
    event.defaultPrevented || event.button !== 0
    || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
);
