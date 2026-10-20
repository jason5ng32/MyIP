// Specs for navLinksFit in composables/use-nav-overflow.js — the width check
// that decides whether the site nav's link row fits or collapses into the
// hamburger. The ResizeObserver half of the composable is out of scope.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { navLinksFit } from '../frontend/composables/use-nav-overflow.js';

const sizes = (over = {}) => ({
    navWidth: 1200, brandWidth: 130, actionsWidth: 320, linksWidth: 700, gap: 8, ...over,
});

describe('navLinksFit', () => {
    it('fits with room to spare', () => {
        assert.equal(navLinksFit(sizes()), true);
    });

    it('treats an exact fit as a fit', () => {
        // 1200 - 130 - 320 - 2 * 8 = 734
        assert.equal(navLinksFit(sizes({ linksWidth: 734 })), true);
    });

    it('overflows one pixel past the room left', () => {
        assert.equal(navLinksFit(sizes({ linksWidth: 735 })), false);
    });

    it('counts the gap twice (brand · links · actions)', () => {
        // 1000 - 100 - 200 = 700 before gaps; one gap would leave 690, two leave 680.
        const base = { navWidth: 1000, brandWidth: 100, actionsWidth: 200, gap: 10 };
        assert.equal(navLinksFit({ ...base, linksWidth: 680 }), true);
        assert.equal(navLinksFit({ ...base, linksWidth: 681 }), false);
        assert.equal(navLinksFit({ ...base, linksWidth: 690 }), false);
    });

    it('fits when a measurement is missing', () => {
        for (const key of ['navWidth', 'brandWidth', 'actionsWidth', 'linksWidth', 'gap']) {
            assert.equal(navLinksFit(sizes({ linksWidth: 5000, [key]: undefined })), true, key);
            assert.equal(navLinksFit(sizes({ linksWidth: 5000, [key]: NaN })), true, key);
        }
        assert.equal(navLinksFit({}), true);
    });

    it('fits while the nav has no width yet', () => {
        assert.equal(navLinksFit(sizes({ navWidth: 0, linksWidth: 5000 })), true);
    });
});
