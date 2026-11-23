// Tests for frontend/utils/extension-noise.js: extension URL patterns and the
// unhandled-rejection-through-an-extension-frame check.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EXTENSION_URL_PATTERNS, isExtensionRejection } from '../frontend/utils/extension-noise.js';

const REJECTION = 'auto.browser.global_handlers.onunhandledrejection';
const ONERROR = 'auto.browser.global_handlers.onerror';
const CONSOLE = 'auto.core.capture_console';

const OUR = 'https://ipcheck.ing/assets/x.js';

const frame = (filename) => ({ filename, function: 'fn', lineno: 1, colno: 1 });

const eventWith = (mechanismType, filenames) => ({
    exception: {
        values: [{
            type: 'TypeError',
            value: 'Failed to fetch',
            mechanism: { type: mechanismType, handled: false },
            stacktrace: { frames: filenames.map(frame) },
        }],
    },
});

const matchesAny = (url) => EXTENSION_URL_PATTERNS.some((re) => re.test(url));

describe('isExtensionRejection', () => {
    it('drops a rejection whose stack holds an extension frame among ours', () => {
        const event = eventWith(REJECTION, [OUR, OUR, 'chrome-extension://abc/frame_ant.js', OUR]);
        assert.equal(isExtensionRejection(event), true);
    });

    it('keeps onerror and console events with an extension frame', () => {
        assert.equal(isExtensionRejection(
            eventWith(ONERROR, [OUR, 'chrome-extension://abc/frame_ant.js', OUR]),
        ), false);
        assert.equal(isExtensionRejection(
            eventWith(CONSOLE, [OUR, 'moz-extension://abc/content.js', OUR]),
        ), false);
    });

    it('keeps a rejection with only our frames', () => {
        assert.equal(isExtensionRejection(eventWith(REJECTION, [OUR, OUR])), false);
    });

    it('matches moz / safari-web / webkit-masked-url frames', () => {
        for (const url of [
            'moz-extension://abc/content.js',
            'safari-web-extension://abc/content.js',
            'webkit-masked-url://hidden/',
        ]) {
            assert.equal(isExtensionRejection(eventWith(REJECTION, [OUR, url])), true, url);
        }
    });

    it('checks every exception value of a chained error', () => {
        const event = {
            exception: {
                values: [
                    { type: 'Error', stacktrace: { frames: [frame('chrome-extension://abc/x.js')] } },
                    {
                        type: 'TypeError',
                        mechanism: { type: REJECTION },
                        stacktrace: { frames: [frame(OUR)] },
                    },
                ],
            },
        };
        assert.equal(isExtensionRejection(event), true);
    });

    it('returns false on malformed events', () => {
        assert.equal(isExtensionRejection(undefined), false);
        assert.equal(isExtensionRejection({}), false);
        assert.equal(isExtensionRejection({ exception: {} }), false);
        assert.equal(isExtensionRejection({ exception: { values: [{ mechanism: { type: REJECTION } }] } }), false);
        assert.equal(isExtensionRejection({
            exception: { values: [{ mechanism: { type: REJECTION }, stacktrace: {} }] },
        }), false);
        assert.equal(isExtensionRejection({
            exception: { values: [{ mechanism: { type: REJECTION }, stacktrace: { frames: [{}, null] } }] },
        }), false);
    });
});

describe('EXTENSION_URL_PATTERNS', () => {
    it('matches every extension scheme', () => {
        for (const url of [
            'chrome-extension://abc/x.js',
            'moz-extension://abc/x.js',
            'safari-extension://abc/x.js',
            'safari-web-extension://abc/x.js',
            'ms-browser-extension://abc/x.js',
            'webkit-masked-url://hidden/',
        ]) {
            assert.equal(matchesAny(url), true, url);
        }
    });

    it('does not match our scripts or non-URL frames', () => {
        for (const url of [
            'https://ipcheck.ing/assets/index.js',
            '[native code]',
            '<anonymous>',
            'https://ipcheck.ing/?q=chrome-extension://x',
        ]) {
            assert.equal(matchesAny(url), false, url);
        }
    });
});
