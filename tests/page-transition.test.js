// Spec for utils/page-transition.js, the router hook-up driven by a fake
// router and View Transitions document.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    transitionDirection,
    shouldAnimate,
    installPageTransitions,
} from '../frontend/utils/page-transition.js';

const home = { name: 'home', path: '/' };
const whois = { name: 'tool', path: '/tools/whois' };
const calc = { name: 'tool', path: '/tools/ipcalculator' };
const privacy = { name: 'privacy', path: '/privacy' };
const start = { name: undefined, path: '/', matched: [] };

describe('transitionDirection()', () => {
    it('slides forward from the homepage to any page', () => {
        assert.equal(transitionDirection(home, whois), 'forward');
        assert.equal(transitionDirection(home, privacy), 'forward');
    });

    it('slides back to the homepage from any page', () => {
        assert.equal(transitionDirection(whois, home), 'back');
        assert.equal(transitionDirection(privacy, home), 'back');
    });

    it('cross-fades between two pages that are not the homepage', () => {
        assert.equal(transitionDirection(whois, calc), 'fade');
        assert.equal(transitionDirection(calc, privacy), 'fade');
    });

    it('does not animate a query-only change on the same page', () => {
        assert.equal(transitionDirection(calc, { ...calc, query: { q: '10.0.0.0/22' } }), null);
        assert.equal(transitionDirection(home, { ...home, hash: '#x' }), null);
    });

    it('does not animate the first navigation', () => {
        assert.equal(transitionDirection(start, whois), null);
        assert.equal(transitionDirection({ path: '/' }, whois), null);
        assert.equal(transitionDirection({ name: 'home', path: '/x', matched: [] }, whois), null);
    });

    it('tolerates missing locations', () => {
        assert.equal(transitionDirection(undefined, whois), null);
        assert.equal(transitionDirection(home, null), null);
    });
});

describe('shouldAnimate()', () => {
    const base = { direction: 'forward', supported: true, reducedMotion: false, inFlight: false, uaTransition: false };

    it('animates a page change in a supporting browser', () => {
        assert.equal(shouldAnimate(base), true);
    });

    it('stays instant without a direction, support, or motion', () => {
        assert.equal(shouldAnimate({ ...base, direction: null }), false);
        assert.equal(shouldAnimate({ ...base, supported: false }), false);
        assert.equal(shouldAnimate({ ...base, reducedMotion: true }), false);
    });

    it('never stacks on a running transition or a browser-animated history step', () => {
        assert.equal(shouldAnimate({ ...base, inFlight: true }), false);
        assert.equal(shouldAnimate({ ...base, uaTransition: true }), false);
    });
});

// startViewTransition runs the update on the next task, as a browser does after the snapshot.
const setup = ({ supported = true, reducedMotion = false, timeoutMs = 1000 } = {}) => {
    const hooks = { beforeResolve: null, afterEach: null, onError: null };
    const router = {
        beforeResolve: (fn) => { hooks.beforeResolve = fn; },
        afterEach: (fn) => { hooks.afterEach = fn; },
        onError: (fn) => { hooks.onError = fn; },
    };
    const calls = [];
    const doc = { documentElement: { dataset: {} } };
    if (supported) {
        doc.startViewTransition = (update) => {
            const call = { skipped: false, updateDone: null, attr: doc.documentElement.dataset.pageTransition };
            let finish;
            const finished = new Promise((resolve) => { finish = resolve; });
            call.started = new Promise((resolve) => setTimeout(() => {
                call.updateDone = Promise.resolve(update());
                resolve();
            }, 0));
            call.finish = async () => { await call.started; await call.updateDone; finish(); await finished; await null; };
            calls.push(call);
            return {
                ready: Promise.reject(new Error('skipped')),
                finished,
                skipTransition: () => { call.skipped = true; },
            };
        };
    }
    let popstate = null;
    const win = {
        matchMedia: () => ({ matches: reducedMotion }),
        addEventListener: (type, fn) => { if (type === 'popstate') popstate = fn; },
    };
    installPageTransitions(router, { doc, win, nextTick: () => Promise.resolve(), timeoutMs });
    return { hooks, calls, doc, popstate: (event) => popstate(event) };
};

const settled = async (promise) => {
    let done = false;
    promise.then(() => { done = true; });
    await new Promise((r) => setTimeout(r, 5));
    return done;
};

describe('installPageTransitions()', () => {
    it('snapshots, lets the navigation proceed, and ends the update after it', async () => {
        const { hooks, calls, doc } = setup();
        const guard = hooks.beforeResolve(whois, home);
        assert.ok(guard instanceof Promise);
        await guard;
        assert.equal(calls.length, 1);
        assert.equal(calls[0].attr, 'forward');
        assert.equal(await settled(calls[0].updateDone), false, 'update waits for afterEach');
        await hooks.afterEach(whois, home);
        assert.equal(await settled(calls[0].updateDone), true);
        await calls[0].finish();
        assert.equal(doc.documentElement.dataset.pageTransition, undefined);
    });

    it('ends the update when the navigation fails (afterEach with a failure)', async () => {
        const { hooks, calls } = setup();
        await hooks.beforeResolve(home, whois);
        assert.equal(calls[0].attr, 'back');
        await hooks.afterEach(home, whois, { type: 'aborted' });
        assert.equal(await settled(calls[0].updateDone), true);
    });

    it('ends the update on a router error', async () => {
        const { hooks, calls } = setup();
        await hooks.beforeResolve(calc, whois);
        hooks.onError(new Error('chunk failed'));
        assert.equal(await settled(calls[0].updateDone), true);
    });

    it('caps a stuck update with the timeout', async () => {
        const { hooks, calls } = setup({ timeoutMs: 20 });
        await hooks.beforeResolve(calc, whois);
        assert.equal(await settled(calls[0].updateDone), false);
        await new Promise((r) => setTimeout(r, 30));
        assert.equal(await settled(calls[0].updateDone), true);
    });

    it('switches instantly without support, under reduced motion, or on a query-only change', () => {
        assert.equal(setup({ supported: false }).hooks.beforeResolve(whois, home), undefined);
        const reduced = setup({ reducedMotion: true });
        assert.equal(reduced.hooks.beforeResolve(whois, home), undefined);
        assert.equal(reduced.calls.length, 0);
        const query = setup();
        assert.equal(query.hooks.beforeResolve({ ...calc, query: { q: '1' } }, calc), undefined);
        assert.equal(query.calls.length, 0);
    });

    it('skips a running transition on the next page change and does not start another', async () => {
        const { hooks, calls, doc } = setup();
        await hooks.beforeResolve(whois, home);
        await hooks.afterEach(whois, home);
        assert.equal(hooks.beforeResolve({ ...whois, query: { q: 'x' } }, whois), undefined);
        assert.equal(calls[0].skipped, false, 'a query-only change leaves it running');
        assert.equal(hooks.beforeResolve(home, whois), undefined);
        assert.equal(calls[0].skipped, true);
        assert.equal(calls.length, 1);
        await calls[0].finish();
        assert.equal(doc.documentElement.dataset.pageTransition, undefined);
        assert.ok(hooks.beforeResolve(whois, home) instanceof Promise, 'animates again once finished');
    });

    it('leaves a history step the browser animated itself alone', () => {
        const { hooks, calls, popstate } = setup();
        popstate({ hasUAVisualTransition: true });
        assert.equal(hooks.beforeResolve(home, whois), undefined);
        assert.equal(calls.length, 0);
        popstate({ hasUAVisualTransition: false });
        assert.ok(hooks.beforeResolve(home, whois) instanceof Promise);
    });
});
