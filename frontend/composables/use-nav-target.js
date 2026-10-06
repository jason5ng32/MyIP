// Carries out a site-navigation click (utils/nav-target.js decides what it
// means on the current route): scroll the homepage, go home then scroll, or
// open a tool's page. Going home, the scroll waits a tick and a frame so it
// runs after the router's scrollBehavior; then, as a freshly mounted homepage
// is still resizing above the section, it re-aims while #mainpart resizes,
// for SETTLE_MS or until the visitor scrolls or presses a key.

import { nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { resolveNavTarget } from '../utils/nav-target.js';
import { scrollToElement, SECTION_SCROLL_OFFSET } from '../utils/scroll-to.js';

const SETTLE_MS = 5000;
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'];

const nextFrame = () => new Promise((resolve) => { requestAnimationFrame(() => resolve()); });

const scrollWhileSettling = (section) => {
    const main = document.getElementById('mainpart');
    if (!main || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => scrollToElement(section, SECTION_SCROLL_OFFSET));
    let timer;
    const stop = () => {
        observer.disconnect();
        clearTimeout(timer);
        USER_SCROLL_EVENTS.forEach((type) => window.removeEventListener(type, stop));
    };
    USER_SCROLL_EVENTS.forEach((type) => window.addEventListener(type, stop, { passive: true }));
    timer = setTimeout(stop, SETTLE_MS);
    observer.observe(main);
};

export const useNavTarget = ({ route = useRoute(), router = useRouter() } = {}) => {
    const navigateTo = async (item) => {
        const target = resolveNavTarget({ item, routeName: route.name });
        if (!target) return;
        if (target.kind === 'tool') {
            await router.push(`/tools/${target.slug}`);
            return;
        }
        if (target.kind === 'scroll') {
            scrollToElement(target.section, SECTION_SCROLL_OFFSET);
            return;
        }
        const failure = await router.push('/');
        if (failure) return;
        await nextTick();
        await nextFrame();
        scrollToElement(target.section, SECTION_SCROLL_OFFSET);
        scrollWhileSettling(target.section);
    };

    return { navigateTo };
};
