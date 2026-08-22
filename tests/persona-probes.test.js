// Coverage for the active browser probes. Most of what they touch (canvas,
// speechSynthesis, navigator.keyboard) has no Node equivalent, so what is
// asserted here is the pure classification logic and — just as important —
// that an unavailable API degrades to "not measured" instead of throwing or
// silently reporting an empty result as a finding.

import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';

import { probeFonts, scriptsWithFonts } from '../frontend/utils/persona/probe-fonts.js';
import { layoutOf, probeVoices, probeKeyboard } from '../frontend/utils/persona/probe-locale.js';
import { isValidBin, BIN_MAX_LENGTH } from '../frontend/utils/persona/card-bin.js';
import { FONTS_BY_SCRIPT } from '../frontend/data/persona-tables.js';

describe('font probe', () => {
    it('reports unavailable — not "no fonts" — without a canvas to measure on', async () => {
        const probe = await probeFonts();
        assert.equal(probe.available, false);
        assert.deepEqual(probe.scripts, {});
    });

    it('lists the scripts that have at least one marker font', () => {
        const probe = {
            scripts: {
                Jpan: { present: ['Yu Gothic'], probed: 6 },
                Hans: { present: [], probed: 5 },
                Kore: { present: ['Malgun Gothic', 'Batang'], probed: 5 },
            },
        };
        assert.deepEqual(scriptsWithFonts(probe), ['Jpan', 'Kore']);
    });

    it('treats a missing probe as no scripts rather than throwing', () => {
        assert.deepEqual(scriptsWithFonts(null), []);
        assert.deepEqual(scriptsWithFonts({}), []);
    });

    it('probes only script-marker fonts, never Latin or Cyrillic', () => {
        // The whole point of the table: fonts every OS ships prove nothing.
        assert.equal(FONTS_BY_SCRIPT.Latn, undefined);
        assert.equal(FONTS_BY_SCRIPT.Cyrl, undefined);
        assert.ok(Object.keys(FONTS_BY_SCRIPT).length >= 20);
    });
});

describe('keyboard layout classification', () => {
    it('recognizes AZERTY by its swapped A and Q', () => {
        assert.equal(layoutOf({ KeyA: 'q', KeyQ: 'a', KeyW: 'z', KeyZ: 'w' }), 'azerty');
    });

    it('recognizes QWERTZ by its swapped Y and Z', () => {
        assert.equal(layoutOf({ KeyQ: 'q', KeyW: 'w', KeyZ: 'y', KeyY: 'z' }), 'qwertz');
    });

    it('recognizes plain QWERTY', () => {
        assert.equal(layoutOf({ KeyQ: 'q', KeyW: 'w', KeyZ: 'z', KeyY: 'y' }), 'qwerty');
    });

    it('recognizes JIS by the two keys no other layout has', () => {
        // IntlRo / IntlYen are physically present only on Japanese keyboards,
        // which is a stronger statement than the alphabetic arrangement.
        assert.equal(layoutOf({ KeyQ: 'q', KeyW: 'w', IntlRo: '\\', IntlYen: '¥' }), 'jis');
    });

    it('falls back to "other" for layouts it cannot name', () => {
        // A Cyrillic keyboard reports the characters its keys produce.
        assert.equal(layoutOf({ KeyQ: 'й', KeyW: 'ц' }), 'other');
    });

    it('returns null with nothing to classify', () => {
        assert.equal(layoutOf(null), null);
        assert.equal(layoutOf({}), null);
    });
});

describe('probe availability', () => {
    const originalNavigator = globalThis.navigator;
    afterEach(() => {
        Object.defineProperty(globalThis, 'navigator', {
            value: originalNavigator, configurable: true, writable: true,
        });
    });

    it('returns null for voices when speechSynthesis is absent', async () => {
        assert.equal(await probeVoices(), null);
    });

    it('returns null for the keyboard when the Keyboard API is absent', async () => {
        Object.defineProperty(globalThis, 'navigator', {
            value: {}, configurable: true, writable: true,
        });
        assert.equal(await probeKeyboard(), null);
    });


});

describe('card prefix input', () => {
    it('accepts the full 6-8 digit span and nothing shorter or longer', () => {
        for (const good of ['123456', '1234567', '12345678']) {
            assert.equal(isValidBin(good), true);
        }
        for (const bad of ['12345', '123456789', 'abcdef', '', '1234 56', null]) {
            assert.equal(isValidBin(bad), false, `should reject ${JSON.stringify(bad)}`);
        }
    });

    it('renders exactly one slot per allowed digit', () => {
        // BIN_MAX_LENGTH boxes make the cap structural — a full card number
        // has nowhere to go.
        assert.equal(BIN_MAX_LENGTH, 8);
        assert.equal(isValidBin('9'.repeat(BIN_MAX_LENGTH)), true);
        assert.equal(isValidBin('9'.repeat(BIN_MAX_LENGTH + 1)), false);
    });
});
