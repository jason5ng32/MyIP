// useOverlayShortcuts() — the hook the ui/ overlay roots use to tell the
// dispatcher that they are covering the page.
//
// shortcut.js attaches a document listener at import time, so a stub goes in
// before the dynamic import. A resolve hook rewrites the composable's
// `@/utils/shortcut.js` import, since the Vite alias doesn't exist in the
// Node runner.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { registerHooks } from 'node:module';
import { effectScope, ref } from 'vue';

globalThis.document = { addEventListener() {} };
globalThis.window = {};

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === '@/utils/shortcut.js') {
            return nextResolve('../utils/shortcut.js', context);
        }
        return nextResolve(specifier, context);
    },
});

const { isOverlayOpen } = await import('../frontend/utils/shortcut.js');
const { useOverlayShortcuts } = await import('../frontend/composables/use-overlay-shortcuts.js');

describe('useOverlayShortcuts()', () => {
    it('counts the overlay while open and releases it on close', () => {
        const open = ref(false);
        const scope = effectScope();
        scope.run(() => useOverlayShortcuts(() => open.value));

        assert.equal(isOverlayOpen(), false);
        open.value = true;
        assert.equal(isOverlayOpen(), true, 'sync flush — no tick to wait for');
        open.value = false;
        assert.equal(isOverlayOpen(), false);
        scope.stop();
    });

    it('counts an overlay that mounts already open', () => {
        const scope = effectScope();
        scope.run(() => useOverlayShortcuts(() => true));
        assert.equal(isOverlayOpen(), true);
        scope.stop();
        assert.equal(isOverlayOpen(), false, 'no leak after the overlay is torn down while open');
    });

    it('a dialog over a drawer keeps the page suspended until both close', () => {
        const dialog = ref(true);
        const drawer = ref(true);
        const scope = effectScope();
        scope.run(() => {
            useOverlayShortcuts(() => drawer.value);
            useOverlayShortcuts(() => dialog.value);
        });

        dialog.value = false;
        assert.equal(isOverlayOpen(), true, 'the drawer underneath is still covering the page');
        drawer.value = false;
        assert.equal(isOverlayOpen(), false);
        scope.stop();
    });

    it('repeated identical states count the overlay only once', () => {
        const open = ref(true);
        const scope = effectScope();
        scope.run(() => useOverlayShortcuts(() => open.value));
        open.value = true;
        open.value = false;
        assert.equal(isOverlayOpen(), false, 'one open ⇒ one close');
        scope.stop();
    });
});
