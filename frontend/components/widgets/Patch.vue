<template>
</template>

<script setup>
import { onMounted } from 'vue';
import { trackEvent } from '@/utils/use-analytics';
import { Offcanvas } from 'bootstrap';

let trackedSections = new Set();

const listenOffcanvas = () => {
    const offcanvasElements = document.querySelectorAll('.offcanvas');
    const navElements = document.getElementById('navbarNavAltMarkup');
    const navElementsButton = document.querySelector('.navbar-toggler');
    offcanvasElements.forEach((element) => {
        const instance = Offcanvas.getOrCreateInstance(element); // 确保实例创建成功
        element.addEventListener('show.bs.offcanvas', () => {
            // 存在 Offcanvas 时关闭导航栏
            navElements.classList.remove('show');
            navElementsButton.setAttribute('aria-expanded', 'false');
            navElementsButton.classList.add('collapsed');
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

    sectionIds.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section && isElementInViewport(section) && !trackedSections.has(sectionId)) {
            trackEvent(sectionId, 'JNScroll', sectionId);
            trackedSections.add(sectionId);
        }
    });
};

// 判断元素是否在视窗内
const isElementInViewport = (el) => {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
};

onMounted(() => {
    listenOffcanvas();
    window.addEventListener('scroll', checkSectionsAndTrack);
});
</script>

<style scoped></style>