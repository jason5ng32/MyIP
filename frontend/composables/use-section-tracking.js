// Scroll tracking: when page scrolls
//   1) capture the first partially visible section, write to store.changeSection() (for Nav highlighting)
//   2) send one JNScroll event when each section first fully enters the viewport (only once, deduplicated)

import { onMounted, onBeforeUnmount } from 'vue';
import { useMainStore } from '@/store';
import { trackEvent } from '@/utils/use-analytics';
import { SECTION_IDS } from '@/data/sections';

const isElementFullyInViewport = (el) => {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
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

        SECTION_IDS.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section && isElementFullyInViewport(section) && !trackedSections.has(sectionId)) {
                trackEvent(sectionId, 'JNScroll', sectionId);
                trackedSections.add(sectionId);
            }
        });
    };

    onMounted(() => {
        window.addEventListener('scroll', checkSectionsAndTrack);
    });

    onBeforeUnmount(() => {
        window.removeEventListener('scroll', checkSectionsAndTrack);
    });
}
