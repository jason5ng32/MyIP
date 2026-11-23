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
import { KeepAlive, createRenderer, defineComponent, effectScope, h, nextTick, ref } from 'vue';

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

    it('immediately closes an overlay that mounts late inside a deactivated KeepAlive branch', async () => {
        const { createApp } = createRenderer({
            createElement: (type) => ({ type, children: [], parentNode: null }),
            createText: (text) => ({ text, parentNode: null }),
            createComment: (comment) => ({ comment, parentNode: null }),
            setText: () => {},
            setElementText: () => {},
            insert: (el, parent) => {
                el.parentNode = parent;
                parent.children.push(el);
            },
            remove: (el) => {
                if (!el.parentNode) return;
                const idx = el.parentNode.children.indexOf(el);
                if (idx !== -1) el.parentNode.children.splice(idx, 1);
                el.parentNode = null;
            },
            parentNode: (node) => node.parentNode ?? null,
            nextSibling: () => null,
            patchProp: () => {},
        });

        const showPageA = ref(true);
        const mountLazyDialog = ref(false);
        const dialogOpen = ref(false);

        const LazyOverlayRoot = defineComponent({
            name: 'LazyOverlayRoot',
            props: { open: { type: Boolean, default: false } },
            emits: ['update:open'],
            setup(props) {
                useOverlayShortcuts(() => props.open);
                return () => h('div');
            },
        });

        const PageA = defineComponent({
            name: 'PageA',
            setup() {
                return () => h('section', [
                    mountLazyDialog.value
                        ? h(LazyOverlayRoot, {
                            open: dialogOpen.value,
                            'onUpdate:open': (val) => { dialogOpen.value = val; },
                        })
                        : null,
                ]);
            },
        });

        const PageB = defineComponent({
            name: 'PageB',
            setup: () => () => h('section'),
        });

        const Root = defineComponent({
            setup: () => () => h(KeepAlive, null, {
                default: () => [showPageA.value ? h(PageA, { key: 'a' }) : h(PageB, { key: 'b' })],
            }),
        });

        const container = { type: 'root', children: [], parentNode: null };
        const app = createApp(Root);
        app.mount(container);

        // User triggers open on PageA, then navigates to PageB before the async chunk mounts.
        dialogOpen.value = true;
        showPageA.value = false;
        await nextTick();

        // Now the async overlay chunk finishes loading inside deactivated PageA.
        mountLazyDialog.value = true;
        await nextTick();

        assert.equal(dialogOpen.value, false, 'late-mounted overlay emits update:open -> false');
        assert.equal(isOverlayOpen(), false, 'deactivated overlay never suspends active-page shortcuts');

        app.unmount();
    });
});
