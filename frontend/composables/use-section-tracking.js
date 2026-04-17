// 滚动跟踪：页面 scroll 时
//   1) 捕捉第一个部分可见的 section，写入 store.changeSection()（供 Nav 高亮用）
//   2) 各 section 首次完全进入视窗时发一次 JNScroll 事件（仅触发一次，去重）
//
// 原实现在 widgets/Patch.vue 里——空 template 的 Vue 组件纯粹用来挂 onMounted 副作用，
// 角色严重错配。抽成 composable，调用侧在 setup() 里用一次即可。

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
