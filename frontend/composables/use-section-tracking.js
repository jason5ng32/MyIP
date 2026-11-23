// Scroll tracking: when page scrolls
//   1) capture the first partially visible section, write to store.changeSection() (for Nav highlighting)
//   2) send one JNScroll event per section the first time it is reached (deduplicated): its top
//      edge reaches the viewport's upper half while it is still on screen, or it is fully visible
// Listens only while the (kept-alive) homepage is on screen.

import { useActiveEventListener } from './use-route-active.js';
import { useMainStore } from '../store.js';
import { trackEvent } from '../utils/analytics.js';
import { SECTION_IDS } from '../data/sections.js';

// Fraction of the viewport height a section's top edge must rise above to count as reached.
const REACH_LINE = 0.5;

// rect: a getBoundingClientRect()-like { top, bottom }. The fully-visible branch
// keeps short sections near the page end countable.
export const hasReachedSection = (rect, viewportHeight) => {
    if (rect.bottom <= 0) return false;
    return rect.top <= viewportHeight * REACH_LINE
        || (rect.top >= 0 && rect.bottom <= viewportHeight);
};

const isElementPartiallyInViewport = (el) => {
    const rect = el.getBoundingClientRect();
    const viewportHeight = (window.innerHeight || document.documentElement.clientHeight);
    return rect.bottom > 0 && rect.top < viewportHeight;
};

const firstElementInViewport = (elementIds) => {
    for (const elementId of elementIds) {
        const element = document.getElementById(elementId);
        if (element && isElementPartiallyInViewport(element)) return elementId;
    }
    return null;
};

export function useSectionTracking() {
    const store = useMainStore();
    const trackedSections = new Set();

    const checkSectionsAndTrack = () => {
        const firstVisibleSectionId = firstElementInViewport(SECTION_IDS);
        if (firstVisibleSectionId) store.changeSection(firstVisibleSectionId);

        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        SECTION_IDS.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section && hasReachedSection(section.getBoundingClientRect(), viewportHeight) && !trackedSections.has(sectionId)) {
                trackEvent(sectionId, 'JNScroll', sectionId);
                trackedSections.add(sectionId);
            }
        });
    };

    useActiveEventListener(window, 'scroll', checkSectionsAndTrack);
}
