// resolveNavTarget() — what a site-navigation click does on the current route
// (Nav, mobile nav sheet, page breadcrumb) — and isPlainClick(), which lets a
// link's modified / non-primary clicks through to the browser.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveNavTarget, isPlainClick } from '../frontend/utils/nav-target.js';

describe('resolveNavTarget()', () => {
    it('scrolls the homepage to a section when it is the page on screen', () => {
        assert.deepEqual(
            resolveNavTarget({ item: { section: 'Connectivity' }, routeName: 'home' }),
            { kind: 'scroll', section: 'Connectivity' },
        );
    });

    it('goes home first from any other page', () => {
        for (const routeName of ['tool', 'privacy', 'report', undefined]) {
            assert.deepEqual(
                resolveNavTarget({ item: { section: 'AdvancedTools' }, routeName }),
                { kind: 'home-then-scroll', section: 'AdvancedTools' },
            );
        }
    });

    it("opens a tool's page from every route", () => {
        for (const routeName of ['home', 'tool', 'privacy', 'report']) {
            assert.deepEqual(
                resolveNavTarget({ item: { tool: 'macchecker' }, routeName }),
                { kind: 'tool', slug: 'macchecker' },
            );
        }
    });

    it('resolves anything else to null', () => {
        assert.equal(resolveNavTarget({ item: null, routeName: 'home' }), null);
        assert.equal(resolveNavTarget({ item: {}, routeName: 'tool' }), null);
        assert.equal(resolveNavTarget({ item: { section: '' }, routeName: 'home' }), null);
        assert.equal(resolveNavTarget({ item: { tool: 42 }, routeName: 'home' }), null);
        assert.equal(resolveNavTarget(), null);
    });
});

describe('isPlainClick()', () => {
    const click = (overrides = {}) => ({
        defaultPrevented: false, button: 0,
        metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
        ...overrides,
    });

    it('accepts a plain primary click', () => {
        assert.equal(isPlainClick(click()), true);
    });

    it('leaves modified, non-primary and handled clicks to the browser', () => {
        for (const overrides of [
            { metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true },
            { button: 1 }, { defaultPrevented: true },
        ]) {
            assert.equal(isPlainClick(click(overrides)), false, JSON.stringify(overrides));
        }
    });
});
