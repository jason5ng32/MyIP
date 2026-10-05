// Carries out a site-navigation click (utils/nav-target.js decides what it
// means on the current route): scroll the homepage to a section, go home first
// and then scroll, or open a tool's page.
//
// Going home is a push, so the router's scrollBehavior puts the homepage at
// the top after the next tick; the section scroll waits for that tick and one
// frame, so it runs last, on the activated and laid-out homepage. A homepage
// this push mounted is still filling in (its tests and async parts resize
// what sits above the section), so the scroll re-aims while #mainpart
// resizes, for SETTLE_MS or until the visitor scrolls or presses a key.
//
//   const { navigateTo } = useNavTarget();   // { route, router } injectable
//   navigateTo({ section: 'Connectivity' }) / navigateTo({ tool: 'whois' })

import { nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { resolveNavTarget } from '../utils/nav-target.js';
import { scrollToElement } from '../utils/scroll-to.js';

// Room left above a section for the fixed Nav (h-14) plus a little air.
export const SECTION_SCROLL_OFFSET = 70;

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
