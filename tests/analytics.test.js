// Tests for frontend/utils/analytics.js: pre-mount event buffering without
// injecting gtag.js, deferred script injection via startAnalytics(), FIFO
// queue flush on script load, retry after load failure, and no-op guards
// when unconfigured or outside a browser.

import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { createAnalytics } from '../frontend/utils/analytics.js';

const installDomStub = ({ existingScript = false } = {}) => {
    const headChildren = existingScript
        ? [{ tag: 'script', src: 'https://www.googletagmanager.com/gtag/js?id=GTM-EXT' }]
        : [];
    const appendedScripts = [];
    globalThis.window = {};
    globalThis.document = {
        querySelector: (selector) => {
            if (selector === 'script[src*="googletagmanager.com/gtag/js"]') {
                return headChildren.find(
                    (el) => el.tag === 'script' && el.src.includes('googletagmanager.com/gtag/js')
                ) ?? null;
            }
            return null;
        },
        createElement: (tag) => {
            const el = {
                tag,
                async: false,
                src: '',
                onload: null,
                onerror: null,
                remove() {
                    const idx = headChildren.indexOf(el);
                    if (idx !== -1) headChildren.splice(idx, 1);
                },
            };
            return el;
        },
        head: {
            appendChild: (el) => {
                headChildren.push(el);
                appendedScripts.push(el);
            },
        },
    };
    return { appendedScripts, headChildren };
};

const teardownDomStub = () => {
    delete globalThis.window;
    delete globalThis.document;
};

describe('analytics', () => {
    beforeEach(() => {
        teardownDomStub();
    });

    afterEach(() => {
        teardownDomStub();
    });

    it('buffers boot events without injecting gtag.js until startAnalytics() runs', () => {
        const { appendedScripts: scripts } = installDomStub();
        const { analytics, trackEvent, startAnalytics, isAnalyticsEnabled } = createAnalytics({
            measurementId: 'G-TEST123',
            isDev: false,
        });

        assert.equal(isAnalyticsEnabled, true);

        // Pre-mount calls mirror main.js boot sequence.
        analytics.page('/tools/whois');
        analytics.setUserProperties({ app_mode: 'web', timezone: 'UTC' });
        trackEvent('Section', 'StartClick', 'SpeedTest');

        // Nothing injected yet — zero network competition before first paint.
        assert.equal(scripts.length, 0);
        assert.equal(globalThis.window.gtag, undefined);

        // Post-mount trigger injects exactly one async gtag.js script.
        startAnalytics();
        startAnalytics(); // idempotent
        assert.equal(scripts.length, 1);
        assert.equal(scripts[0].async, true);
        assert.equal(scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-TEST123');

        // Events arriving while gtag.js is still downloading also queue.
        analytics.identify('uid-1', { plan: 'free' });
        assert.equal(globalThis.window.dataLayer, undefined);

        // Simulate gtag.js onload → initializes dataLayer + flushes FIFO.
        scripts[0].onload();
        assert.equal(typeof globalThis.window.gtag, 'function');

        const calls = Array.from(globalThis.window.dataLayer, (entry) => Array.from(entry));
        assert.equal(calls.length, 6);
        assert.equal(calls[0][0], 'js');
        assert.ok(calls[0][1] instanceof Date);
        assert.deepEqual(calls[1], ['config', 'G-TEST123', { debug_mode: false }]);
        assert.deepEqual(calls[2], ['config', 'G-TEST123', { page_path: '/tools/whois' }]);
        assert.deepEqual(calls[3], ['set', 'user_properties', { app_mode: 'web', timezone: 'UTC' }]);
        assert.deepEqual(calls[4], ['event', 'StartClick', {
            event_category: 'Section',
            event_label: 'SpeedTest',
            category: 'Section',
            label: 'SpeedTest',
        }]);
        assert.deepEqual(calls[5], ['config', 'G-TEST123', { user_id: 'uid-1', plan: 'free' }]);

        // Subsequent events forward directly without re-flushing old items.
        trackEvent('Nav', 'NavClick', 'Pulse');
        assert.equal(globalThis.window.dataLayer.length, 7);
    });

    it('retries script injection on the next event after an onerror failure', () => {
        const { appendedScripts: scripts, headChildren } = installDomStub();
        const origWarn = console.warn;
        console.warn = () => {};
        try {
            const { trackEvent, startAnalytics } = createAnalytics({ measurementId: 'G-RETRY1' });
            startAnalytics();
            assert.equal(scripts.length, 1);
            assert.equal(headChildren.length, 1);

            scripts[0].onerror();
            assert.equal(headChildren.length, 0, 'failed script tag is removed so querySelector will not reuse it');

            trackEvent('Section', 'RetryClick', 'Connectivity');
            assert.equal(scripts.length, 2);
            assert.equal(headChildren.length, 1);

            scripts[1].onload();
            const calls = Array.from(globalThis.window.dataLayer, (entry) => Array.from(entry));
            assert.equal(calls.length, 3); // js + config + queued event
            assert.equal(calls[2][1], 'RetryClick');
        } finally {
            console.warn = origWarn;
        }
    });

    it('reuses an already-present gtag script tag without appending another', () => {
        const { appendedScripts: scripts } = installDomStub({ existingScript: true });
        const { analytics, startAnalytics } = createAnalytics({ measurementId: 'G-EXISTING', isDev: true });

        analytics.page('/');
        startAnalytics();

        assert.equal(scripts.length, 0);
        const calls = Array.from(globalThis.window.dataLayer, (entry) => Array.from(entry));
        assert.deepEqual(calls[1], ['config', 'G-EXISTING', { debug_mode: true }]);
        assert.deepEqual(calls[2], ['config', 'G-EXISTING', { page_path: '/' }]);
    });

    it('is a complete no-op when measurementId is empty or window is absent', () => {
        // Unconfigured with DOM present
        const { appendedScripts: scripts } = installDomStub();
        const disabled = createAnalytics({ measurementId: '' });
        assert.equal(disabled.isAnalyticsEnabled, false);
        disabled.analytics.page('/');
        disabled.startAnalytics();
        disabled.trackEvent('Nav', 'Click', 'Home');
        assert.equal(scripts.length, 0);
        assert.equal(globalThis.window.gtag, undefined);

        // Configured without window (Node / SSR)
        teardownDomStub();
        const ssr = createAnalytics({ measurementId: 'G-SSR' });
        assert.doesNotThrow(() => {
            ssr.analytics.page('/');
            ssr.startAnalytics();
            ssr.trackEvent('Nav', 'Click', 'Home');
        });
    });
});
