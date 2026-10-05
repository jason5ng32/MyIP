// Spec for utils/revive-animations.js: which animations are restarted, that
// their time is kept, and that only history steps schedule the passes.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { reviveAnimations, installAnimationRevival } from '../frontend/utils/revive-animations.js';

const fakeAnimation = ({ css = true, playState = 'running', currentTime = 1234 } = {}) => {
    const log = [];
    const animation = {
        playState,
        currentTime,
        cancel: () => log.push('cancel'),
        play: () => log.push('play'),
        log,
    };
    if (css) animation.animationName = 'spin';
    return animation;
};

describe('reviveAnimations()', () => {
    it('cancels, replays and restores the time of running CSS animations only', () => {
        const spin = fakeAnimation();
        const paused = fakeAnimation({ playState: 'paused' });
        const waapi = fakeAnimation({ css: false });
        const doc = { getAnimations: () => [spin, paused, waapi] };
        assert.equal(reviveAnimations(doc), 1);
        assert.deepEqual(spin.log, ['cancel', 'play']);
        assert.equal(spin.currentTime, 1234);
        assert.deepEqual(paused.log, []);
        assert.deepEqual(waapi.log, []);
    });

    it('tolerates a document without getAnimations', () => {
        assert.equal(reviveAnimations({}), 0);
        assert.equal(reviveAnimations(undefined), 0);
    });
});

describe('installAnimationRevival()', () => {
    const setup = () => {
        const hooks = {};
        const router = { afterEach: (fn) => { hooks.afterEach = fn; } };
        const listeners = {};
        const win = { addEventListener: (type, fn) => { listeners[type] = fn; } };
        const spin = fakeAnimation();
        const doc = { getAnimations: () => [spin] };
        const scheduled = [];
        installAnimationRevival(router, { win, doc, schedule: (fn, delayMs) => scheduled.push({ fn, delayMs }) });
        return { hooks, listeners, spin, scheduled };
    };

    it('schedules the passes only for a navigation that came from popstate', () => {
        const { hooks, listeners, scheduled, spin } = setup();
        hooks.afterEach();
        assert.equal(scheduled.length, 0, 'a push schedules nothing');
        listeners.popstate();
        hooks.afterEach();
        assert.deepEqual(scheduled.map((s) => s.delayMs), [0, 400, 1200]);
        scheduled.forEach((s) => s.fn());
        assert.equal(spin.log.filter((l) => l === 'play').length, 3);
        hooks.afterEach();
        assert.equal(scheduled.length, 3, 'the flag is consumed');
    });
});
