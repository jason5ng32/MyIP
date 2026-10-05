// useNavTarget() — carries out a site-navigation click. With an injected
// route and router: the order of going home and scrolling (the router's own
// scroll to the top of a pushed page runs after the next tick, so the section
// scroll must come after that tick and a frame), the plain scroll on the
// homepage, tool pages, a refused navigation scrolling nothing, and the
// re-aiming while a freshly mounted homepage resizes.

import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { nextTick } from 'vue';
import { useNavTarget } from '../frontend/composables/use-nav-target.js';
import { SECTION_SCROLL_OFFSET } from '../frontend/utils/scroll-to.js';

let log;
let sectionTop;
let withMain;
const saved = {};

beforeEach(() => {
    log = [];
    sectionTop = 1000;
    withMain = false;
    for (const key of ['window', 'document', 'requestAnimationFrame', 'ResizeObserver']) saved[key] = globalThis[key];
    const listeners = new Map();
    globalThis.window = {
        scrollY: 500,
        scrollTo: (opts) => log.push(['scrollTo', opts]),
        addEventListener: (type, fn) => listeners.set(type, fn),
        removeEventListener: (type) => listeners.delete(type),
        listeners,
    };
    globalThis.document = {
        getElementById: (id) => {
            if (id === 'Connectivity') return { getBoundingClientRect: () => ({ top: sectionTop }) };
            if (id === 'mainpart' && withMain) return { id };
            return null;
        },
    };
    globalThis.requestAnimationFrame = (cb) => {
        log.push(['frame']);
        setTimeout(cb, 0);
    };
});

afterEach(() => {
    for (const [key, value] of Object.entries(saved)) globalThis[key] = value;
});

const fakeRouter = (failure) => ({
    push: async (to) => {
        log.push(['push', to]);
        // The router schedules its own scroll for after the next tick.
        nextTick(() => log.push(['router-scroll']));
        return failure;
    },
});

describe('useNavTarget()', () => {
    it('scrolls straight to the section on the homepage', async () => {
        const { navigateTo } = useNavTarget({ route: { name: 'home' }, router: fakeRouter() });
        await navigateTo({ section: 'Connectivity' });
        assert.deepEqual(log, [
            ['scrollTo', { top: 1500 - SECTION_SCROLL_OFFSET, behavior: 'smooth' }],
        ]);
    });

    it('goes home, lets the router scroll, then scrolls to the section', async () => {
        const { navigateTo } = useNavTarget({ route: { name: 'tool' }, router: fakeRouter() });
        await navigateTo({ section: 'Connectivity' });
        assert.deepEqual(log.map(([step]) => step), ['push', 'router-scroll', 'frame', 'scrollTo']);
        assert.equal(log[0][1], '/');
    });

    it('scrolls nothing when going home is refused', async () => {
        const router = fakeRouter(new Error('aborted'));
        const { navigateTo } = useNavTarget({ route: { name: 'privacy' }, router });
        await navigateTo({ section: 'Connectivity' });
        assert.deepEqual(log.map(([step]) => step), ['push', 'router-scroll']);
    });

    it("pushes a tool's page and scrolls nothing", async () => {
        const { navigateTo } = useNavTarget({ route: { name: 'home' }, router: fakeRouter() });
        await navigateTo({ tool: 'whois' });
        await nextTick();
        assert.deepEqual(log, [['push', '/tools/whois'], ['router-scroll']]);
    });

    it('ignores an unknown item', async () => {
        const { navigateTo } = useNavTarget({ route: { name: 'home' }, router: fakeRouter() });
        await navigateTo({});
        assert.deepEqual(log, []);
    });

    it('re-aims while the homepage resizes, until the visitor scrolls', async () => {
        withMain = true;
        const observers = [];
        globalThis.ResizeObserver = class {
            constructor(cb) { this.cb = cb; this.on = false; observers.push(this); }
            observe() { this.on = true; }
            disconnect() { this.on = false; }
        };
        const { navigateTo } = useNavTarget({ route: { name: 'tool' }, router: fakeRouter() });
        await navigateTo({ section: 'Connectivity' });
        const [observer] = observers;
        assert.equal(observer.on, true);

        sectionTop = 1100; // content above the section grew
        observer.cb();
        assert.deepEqual(log.at(-1), ['scrollTo', { top: 1600 - SECTION_SCROLL_OFFSET, behavior: 'smooth' }]);

        window.listeners.get('wheel')();
        assert.equal(observer.on, false, 'stops on the first user scroll');
        assert.equal(window.listeners.size, 0, 'and drops its listeners');
    });
});
