// The keydown dispatcher in frontend/utils/shortcut.js: what a keystroke
// actually runs, and when it runs nothing.
//
// The module attaches its listener at import time, so the document stub below
// captures the handler and the tests drive it with synthetic events.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

let keydown = null;
globalThis.document = {
    addEventListener(type, handler) { if (type === 'keydown') keydown = handler; },
};
globalThis.window = {};

const {
    registerShortcuts,
    openOverlay,
    closeOverlay,
    isOverlayOpen,
    collectShortcutActions,
    keyMap,
} = await import('../frontend/utils/shortcut.js');

// Actions record here; `press()` drains it so each assertion sees only what
// the keystrokes it just sent triggered.
let log = [];
const record = (label) => (...args) => log.push(args.length ? [label, ...args] : label);

// Sends keystrokes and waits out the dispatcher's 10ms key-pool window.
const press = async (...keys) => {
    log = [];
    for (const key of keys) {
        keydown({ key, target: { tagName: 'DIV' }, preventDefault() {} });
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
    return log;
};

// Same, but the keystroke lands in the given element instead of the page.
const pressInto = async (key, target) => {
    log = [];
    keydown({ key, target, preventDefault() {} });
    await new Promise((resolve) => setTimeout(resolve, 40));
    return log;
};

describe('shortcut dispatcher', () => {
    beforeEach(() => {
        while (isOverlayOpen()) closeOverlay();
        registerShortcuts([]);
    });

    it('runs the action registered for the typed key', async () => {
        registerShortcuts([{ keys: 's', action: record('speedtest') }]);
        assert.deepEqual(await press('s'), ['speedtest']);
        assert.deepEqual(await press('x'), [], 'unregistered keys do nothing');
    });

    it('stays silent while an overlay is open, whatever the key', async () => {
        registerShortcuts([
            { keys: 's', action: record('speedtest') },
            { keys: '?', action: record('help') },
            { keys: 'j', action: record('next-card') },
        ]);
        openOverlay();
        assert.deepEqual(await press('s'), [], 'no bandwidth spent behind a dialog');
        assert.deepEqual(await press('?'), []);
        assert.deepEqual(await press('j'), []);
        closeOverlay();
        assert.deepEqual(await press('s'), ['speedtest'], 'live again once it closes');
    });

    it('needs every stacked overlay to close before shortcuts come back', async () => {
        registerShortcuts([{ keys: 's', action: record('speedtest') }]);
        openOverlay();
        openOverlay();
        closeOverlay();
        assert.deepEqual(await press('s'), [], 'one overlay is still covering the page');
        closeOverlay();
        assert.deepEqual(await press('s'), ['speedtest']);
    });

    it('an unbalanced close cannot leave the count negative', async () => {
        registerShortcuts([{ keys: 's', action: record('speedtest') }]);
        closeOverlay();
        closeOverlay();
        openOverlay();
        assert.deepEqual(await press('s'), [], 'the next overlay still suspends shortcuts');
        closeOverlay();
    });

    it('drops an action still queued when an overlay opens mid-window', async () => {
        registerShortcuts([{ keys: 's', action: record('speedtest') }]);
        log = [];
        keydown({ key: 's', target: { tagName: 'DIV' }, preventDefault() {} });
        openOverlay(); // lands inside the 10ms key-pool window
        await new Promise((resolve) => setTimeout(resolve, 40));
        assert.deepEqual(log, [], 'the queued action must not fire behind the overlay');
        closeOverlay();
        assert.deepEqual(await press('s'), ['speedtest'], 'and the pool was cleared, not replayed');
    });

    it('ignores keystrokes typed into a field', async () => {
        registerShortcuts([{ keys: 's', action: record('speedtest') }]);
        assert.deepEqual(await pressInto('s', { tagName: 'INPUT' }), []);
        assert.deepEqual(await pressInto('s', { tagName: 'TEXTAREA' }), []);
        assert.deepEqual(await pressInto('s', { tagName: 'DIV', isContentEditable: true }), []);
    });

    it('passes regex captures to the action', async () => {
        registerShortcuts([{ keys: '([1-6])', type: 'regex', action: record('ipcard') }]);
        assert.deepEqual(await press('3'), [['ipcard', '3']]);
        assert.deepEqual(await press('9'), [], 'outside the range, nothing matches');
    });

    it('registering again replaces the map instead of stacking a second copy', async () => {
        const entry = { keys: 'w', action: record('webrtc') };
        registerShortcuts([entry]);
        registerShortcuts([entry]);
        assert.deepEqual(await press('w'), ['webrtc'], 'a remount must not double-fire actions');
    });

    it('keeps the exported keyMap identity across registrations (Help holds a reference)', () => {
        const before = keyMap;
        registerShortcuts([{ keys: 'g', action: () => {}, description: 'top' }]);
        assert.equal(keyMap, before);
        assert.deepEqual(keyMap.map((e) => e.keys), ['g']);
        registerShortcuts([]);
        assert.deepEqual(keyMap, []);
    });

    it('collectShortcutActions matches without running anything', () => {
        registerShortcuts([{ keys: 'g', action: record('top') }]);
        log = [];
        assert.equal(collectShortcutActions('g').length, 1);
        assert.deepEqual(log, [], 'matching is separate from running');
    });
});
