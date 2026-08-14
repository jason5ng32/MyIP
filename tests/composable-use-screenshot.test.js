// Tests for the screenshot composable's font-embedding fallback
// (frontend/composables/use-screenshot.js): a SecurityError from
// html-to-image's webfont embedding retries once with skipFonts, any other
// failure propagates untouched.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toPngWithFontFallback, slugifyForFilename } from '../frontend/composables/use-screenshot.js';

const securityError = () => {
    const err = new Error("Failed to read the 'cssRules' property from 'CSSStyleSheet': Cannot access rules");
    err.name = 'SecurityError';
    return err;
};

describe('toPngWithFontFallback', () => {
    it('returns the first result when toPng succeeds', async () => {
        const calls = [];
        const toPng = async (el, opts) => { calls.push(opts); return 'data:png'; };
        const result = await toPngWithFontFallback(toPng, {}, { pixelRatio: 2 });
        assert.equal(result, 'data:png');
        assert.equal(calls.length, 1);
        assert.equal(calls[0].skipFonts, undefined);
    });

    it('retries with skipFonts on SecurityError, keeping other options', async () => {
        const calls = [];
        const toPng = async (el, opts) => {
            calls.push(opts);
            if (calls.length === 1) throw securityError();
            return 'data:png-nofonts';
        };
        const result = await toPngWithFontFallback(toPng, {}, { pixelRatio: 2, cacheBust: true });
        assert.equal(result, 'data:png-nofonts');
        assert.equal(calls.length, 2);
        assert.deepEqual(calls[1], { pixelRatio: 2, cacheBust: true, skipFonts: true });
    });

    it('propagates non-SecurityError failures without retrying', async () => {
        let calls = 0;
        const toPng = async () => { calls += 1; throw new Error('render failed'); };
        await assert.rejects(
            () => toPngWithFontFallback(toPng, {}, {}),
            { message: 'render failed' },
        );
        assert.equal(calls, 1);
    });

    it('propagates a SecurityError thrown again by the retry', async () => {
        let calls = 0;
        const toPng = async () => { calls += 1; throw securityError(); };
        await assert.rejects(
            () => toPngWithFontFallback(toPng, {}, {}),
            { name: 'SecurityError' },
        );
        assert.equal(calls, 2);
    });
});

describe('slugifyForFilename', () => {
    it('lowercases and hyphenates arbitrary text', () => {
        assert.equal(slugifyForFilename('My IP — Report! 2026'), 'my-ip-report-2026');
    });

    it('falls back when nothing usable remains', () => {
        assert.equal(slugifyForFilename('***', 'image'), 'image');
        assert.equal(slugifyForFilename('', 'shot'), 'shot');
    });
});
