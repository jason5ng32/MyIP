// Tests for the festival theme: the VITE_FESTIVAL_SKINS switch, which Pulse
// festival is active (most recently opened wins), and that every skin folder under
// components/festival/ names a Pulse festival and holds only known parts.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';

import { FESTIVAL_STATUSES } from '../frontend/data/pulse-statuses.js';
import {
    SKIN_SLOTS,
    activeFestivalAt,
    parseSkinSwitch,
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
        assert.equal(activeFestivalAt(new Date('2026-10-31T12:00:00Z'))?.id, 'halloween');
        assert.equal(activeFestivalAt(new Date('2026-10-30T10:00:00Z'))?.id, 'halloween');
        assert.equal(activeFestivalAt(new Date('2026-11-01T12:00:00Z')), null);
        assert.equal(activeFestivalAt(new Date('2026-07-01T00:00:00Z')), null);
    });

    it('overlapping windows → the most recently opened', () => {
        // internetday (Oct 29) runs until Oct 31 12:00Z, past Halloween's start.
        assert.equal(activeFestivalAt(new Date('2026-10-30T09:59:59Z'))?.id, 'internetday');
        assert.equal(activeFestivalAt(new Date('2026-10-30T10:00:00Z'))?.id, 'halloween');
        // birthday (Nov 6) and diwali (Nov 8, 2026) overlap from Nov 7 10:00Z.
        assert.equal(activeFestivalAt(new Date('2026-11-07T09:59:59Z'))?.id, 'birthday');
        assert.equal(activeFestivalAt(new Date('2026-11-07T10:00:00Z'))?.id, 'diwali');
    });

    it('same-day festivals → the first listed', () => {
        // valentine and eid both open on Feb 14, 2029.
        assert.equal(activeFestivalAt(new Date('2029-02-14T12:00:00Z'))?.id, 'valentine');
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
