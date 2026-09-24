// Specs for fitAll in composables/use-fit-text.js — the batched tier picker
// behind FitText. Fake elements stand in for the DOM: rendered width comes
// from the current tier, and every read of scrollWidth / scrollHeight is
// counted so the batching (reads grouped per pass) is observable.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fitAll, INLINE_TIERS } from '../frontend/composables/use-fit-text.js';

const WIDTH = { 'text-base': 300, 'text-sm': 260, 'text-xs': 220 };

// A fake element whose content width depends on its tier class.
const fakeEl = (clientWidth, log, { connected = true, extra = [] } = {}) => {
    const classes = new Set(extra);
    const tier = () => INLINE_TIERS.find((t) => classes.has(t));
    return {
        isConnected: connected,
        clientWidth,
        clientHeight: 20,
        classList: {
            add: (c) => { log.push(`w:${c}`); classes.add(c); },
            remove: (c) => { classes.delete(c); },
            contains: (c) => classes.has(c),
        },
        get scrollWidth() { log.push('r'); return WIDTH[tier()]; },
        get scrollHeight() { log.push('r'); return 20; },
        classes,
    };
};

const job = (el, results, maxLines = 1) => ({
    el, tiers: INLINE_TIERS, maxLines, onFit: (t) => results.push(t),
});

describe('fitAll', () => {
    it('picks the largest tier that fits', () => {
        const log = [];
        const results = [];
        const wide = fakeEl(400, log);
        const mid = fakeEl(270, log);
        const narrow = fakeEl(100, log);
        fitAll([job(wide, results), job(mid, results), job(narrow, results)]);
        assert.deepEqual([...wide.classes], ['text-base']);
        assert.deepEqual([...mid.classes], ['text-sm']);
        // Nothing fits: floor at the last tier.
        assert.deepEqual([...narrow.classes], ['text-xs']);
        assert.deepEqual(results.sort(), ['text-base', 'text-sm', 'text-xs']);
    });

    it('groups reads per pass instead of interleaving them with writes', () => {
        const log = [];
        const jobs = Array.from({ length: 50 }, () => job(fakeEl(100, log), []));
        fitAll(jobs);
        // Collapse runs: each pass is one block of reads followed by writes.
        const runs = log.map((e) => (e === 'r' ? 'r' : 'w'))
            .filter((e, i, all) => e !== all[i - 1]);
        const readBlocks = runs.filter((e) => e === 'r').length;
        assert.equal(readBlocks, INLINE_TIERS.length);
    });

    it('strips stale tiers left on the element', () => {
        const el = fakeEl(400, [], { extra: ['text-xs', 'text-sm'] });
        fitAll([job(el, [])]);
        assert.deepEqual([...el.classes], ['text-base']);
    });

    it('skips detached elements', () => {
        const results = [];
        fitAll([job(fakeEl(400, [], { connected: false }), results), job(null, results)]);
        assert.deepEqual(results, []);
    });

    it('checks height in multi-line mode', () => {
        const results = [];
        // Narrow width but content height fits: first tier wins.
        fitAll([job(fakeEl(10, []), results, 2)]);
        assert.deepEqual(results, ['text-base']);
    });
});
