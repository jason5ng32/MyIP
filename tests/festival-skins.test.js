// Tests for the festival theme: the VITE_FESTIVAL_SKINS switch, which Pulse
// festival is active (most recently opened wins), and that every skin folder under
// components/festival/ names a Pulse festival and holds only known parts.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';

import { FESTIVAL_STATUSES, festivalsActiveAt } from '../frontend/data/pulse-statuses.js';
import {
    SKIN_SLOTS,
    activeFestivalAt,
    festivalsForComposer,
    parseSkinSwitch,
    previewFestivalFrom,
    skinPartPath,
} from '../frontend/utils/features/festival-skin.js';

const SKINS_DIR = new URL('../frontend/components/festival/', import.meta.url);

describe('parseSkinSwitch()', () => {
    it('only "true" turns it on', () => {
        assert.equal(parseSkinSwitch('true'), true);
        assert.equal(parseSkinSwitch(' TRUE '), true);
        for (const raw of [undefined, '', 'false', '1', 'yes', 'halloween']) {
            assert.equal(parseSkinSwitch(raw), false, String(raw));
        }
    });
});

describe('activeFestivalAt()', () => {
    it('follows the Pulse festival window', () => {
        assert.equal(activeFestivalAt(new Date('2026-10-31T09:00:00Z'))?.id, 'halloween');
        assert.equal(activeFestivalAt(new Date('2026-10-30T10:00:00Z'))?.id, 'halloween');
        assert.equal(activeFestivalAt(new Date('2026-11-03T12:00:00Z')), null);
        assert.equal(activeFestivalAt(new Date('2026-07-01T00:00:00Z')), null);
    });

    it('overlapping windows → the most recently opened', () => {
        // internetday (Oct 29) runs until Oct 31 12:00Z, past Halloween's start.
        assert.equal(activeFestivalAt(new Date('2026-10-30T09:59:59Z'))?.id, 'internetday');
        assert.equal(activeFestivalAt(new Date('2026-10-30T10:00:00Z'))?.id, 'halloween');
        // dayofdead (Nov 1–2) opens Oct 31 10:00Z, while Halloween is still on.
        assert.equal(activeFestivalAt(new Date('2026-10-31T09:59:59Z'))?.id, 'halloween');
        assert.equal(activeFestivalAt(new Date('2026-10-31T10:00:00Z'))?.id, 'dayofdead');
        // birthday (Nov 6) and diwali (Nov 8, 2026) overlap from Nov 7 10:00Z.
        assert.equal(activeFestivalAt(new Date('2026-11-07T09:59:59Z'))?.id, 'birthday');
        assert.equal(activeFestivalAt(new Date('2026-11-07T10:00:00Z'))?.id, 'diwali');
    });

    it('a skinned festival is not displaced by an unskinned one', () => {
        const at = (iso, hasSkin) => activeFestivalAt(new Date(iso), hasSkin)?.id ?? null;
        const halloweenOnly = (id) => id === 'halloween';
        assert.equal(at('2026-10-31T10:00:00Z', halloweenOnly), 'halloween');
        assert.equal(at('2026-11-01T11:59:59Z', halloweenOnly), 'halloween');
        // No skinned festival left → the unskinned one still sets the Pulse emoji.
        assert.equal(at('2026-11-01T12:00:00Z', halloweenOnly), 'dayofdead');
        assert.equal(at('2026-11-03T12:00:00Z', halloweenOnly), null);
        // Both skinned → the most recently opened wins.
        assert.equal(at('2026-10-31T10:00:00Z', () => true), 'dayofdead');
        assert.equal(at('2026-11-01T11:59:59Z', () => true), 'dayofdead');
    });

    it('same-day festivals → the first listed', () => {
        // valentine and eid both open on Feb 14, 2029.
        assert.equal(activeFestivalAt(new Date('2029-02-14T12:00:00Z'))?.id, 'valentine');
    });
});

describe('previewFestivalFrom()', () => {
    it('a known id in DEV → that festival', () => {
        const thanksgiving = FESTIVAL_STATUSES.find((f) => f.id === 'thanksgiving');
        assert.equal(previewFestivalFrom('?festival=thanksgiving', true), thanksgiving);
    });

    it('unknown id, non-DEV or no query → null', () => {
        assert.equal(previewFestivalFrom('?festival=nope', true), null);
        assert.equal(previewFestivalFrom('?festival=thanksgiving', false), null);
        assert.equal(previewFestivalFrom('?festival=thanksgiving', undefined), null);
        assert.equal(previewFestivalFrom('', true), null);
    });
});

describe('festivalsForComposer()', () => {
    const byId = (id) => FESTIVAL_STATUSES.find((f) => f.id === id);
    const halloweenNight = new Date('2026-10-31T09:00:00Z');

    it('an out-of-window preview goes first, the active ones stay', () => {
        const ids = festivalsForComposer(halloweenNight, byId('thanksgiving')).map((f) => f.id);
        assert.deepEqual(ids, ['thanksgiving', ...festivalsActiveAt(halloweenNight).map((f) => f.id)]);
        assert.ok(ids.includes('halloween'));
    });

    it('an active preview is not duplicated', () => {
        assert.deepEqual(festivalsForComposer(halloweenNight, byId('halloween')), festivalsActiveAt(halloweenNight));
    });

    it('no preview → exactly the active ones', () => {
        assert.deepEqual(festivalsForComposer(halloweenNight, null), festivalsActiveAt(halloweenNight));
    });
});

describe('skin folders', () => {
    const festivalIds = new Set(FESTIVAL_STATUSES.map((f) => f.id));
    const folders = fs.readdirSync(SKINS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());

    it('each folder is a Pulse festival id with only known parts', () => {
        assert.ok(folders.length > 0);
        for (const dir of folders) {
            assert.ok(festivalIds.has(dir.name), `unknown festival folder: ${dir.name}`);
            for (const file of fs.readdirSync(new URL(`${dir.name}/`, SKINS_DIR))) {
                assert.ok(SKIN_SLOTS.includes(file.replace(/\.vue$/, '')), `${dir.name}/${file}`);
            }
        }
    });

    it('part paths match the composable\'s glob keys', () => {
        assert.equal(skinPartPath('halloween', 'Logo'), '../components/festival/halloween/Logo.vue');
        assert.ok(fs.existsSync(new URL('halloween/Logo.vue', SKINS_DIR)));
    });
});
