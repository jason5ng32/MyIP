<template>
</template>

<script setup>
import { onMounted } from 'vue';
import { trackEvent } from '@/utils/use-analytics';
import { Offcanvas } from 'bootstrap';
import { useMainStore } from '@/store';

const store = useMainStore();

let trackedSections = new Set();

const listenOffcanvas = () => {
    const offcanvasElements = document.querySelectorAll('.offcanvas');
    offcanvasElements.forEach((element) => {
        const instance = Offcanvas.getOrCreateInstance(element); // 确保实例创建成功
        element.addEventListener('show.bs.offcanvas', () => {
            // 关闭所有其他的 offcanvas
            offcanvasElements.forEach((offcanvas) => {
                if (offcanvas !== element) {
                    const offcanvasInstance = Offcanvas.getInstance(offcanvas);
                    if (offcanvasInstance) { // 确保实例有效
                        offcanvasInstance.hide();
                    }
                }
            });
        });
    });
};

//
// 统计相关
//
// 滚动到指定元素并记录事件
const checkSectionsAndTrack = () => {
    const sectionIds = ['IPInfo', 'Connectivity', 'WebRTC', 'DNSLeakTest', 'SpeedTest', 'AdvancedTools'];
    const firstVisibleSectionId = firstElementInViewport(sectionIds);

    // 捕捉第一个可见的元素
    if (firstVisibleSectionId) {
        store.changeSection(firstVisibleSectionId);
    }

    // 统计访问过的元素
    sectionIds.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section && isElementFullyInViewport(section) && !trackedSections.has(sectionId)) {
            trackEvent(sectionId, 'JNScroll', sectionId);
            trackedSections.add(sectionId);
        }
    });
};

// 判断元素是否完全在视窗内
const isElementFullyInViewport = (el) => {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
};

// 判断元素是否部分在视窗内 (顶部或底部在视窗内)
const isElementPartiallyInViewport = (el) => {
    const rect = el.getBoundingClientRect();
    const viewportHeight = (window.innerHeight || document.documentElement.clientHeight);
    return rect.bottom > 0 && rect.top < viewportHeight;
};

// 找出第一个在视窗内的元素 ID
const firstElementInViewport = (elementIds) => {
    for (const elementId of elementIds) {
        const element = document.getElementById(elementId);
        if (element && isElementPartiallyInViewport(element)) {
            return elementId;
        }
    }
    return null;
};

onMounted(() => {
    listenOffcanvas();
    window.addEventListener('scroll', checkSectionsAndTrack);
});
</script>

<style scoped></style>