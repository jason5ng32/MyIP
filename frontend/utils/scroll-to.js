// Smooth scroll to specified element (supports passing element or id string).
//
// SECTION_SCROLL_OFFSET is the one offset every homepage section scroll uses
// (nav links, breadcrumb, keyboard shortcuts): room for the fixed Nav (h-14)
// plus a little air, so all of them land a section at the same spot.
export const SECTION_SCROLL_OFFSET = 70;

export function scrollToElement(el, offset = 0) {
    const element = typeof el === 'string' ? document.getElementById(el) : el;
    if (!element) return;
    const y = element.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: y, behavior: 'smooth' });
}
