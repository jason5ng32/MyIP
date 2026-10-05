// Tests for common/mac-input.js — the MAC Lookup query parser shared by
// /api/macchecker and the MacChecker form (through
// frontend/utils/features/mac-input.js).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeMacQuery } from '../common/mac-input.js';
import { normalizeMacQuery as bridged } from '../frontend/utils/features/mac-input.js';

describe('normalizeMacQuery', () => {
    it('accepts a full address in every common notation, as upper-case bare hex', () => {
        for (const input of ['f0:2f:4b:01:0a:aa', 'F0-2F-4B-01-0A-AA', 'f02f.4b01.0aaa', 'F02F4B010AAA', ' f0 2f 4b 01 0a aa ']) {
            assert.equal(normalizeMacQuery(input), 'F02F4B010AAA', input);
        }
    });

    it('accepts any prefix from a 24-bit vendor prefix up', () => {
        assert.equal(normalizeMacQuery('3c:5a:b4'), '3C5AB4');
        assert.equal(normalizeMacQuery('F0:40:AF:9'), 'F040AF9');
        assert.equal(normalizeMacQuery('8C-1F-64-34-A'), '8C1F6434A');
    });

    it('rejects too short, too long, non-hex and non-string input', () => {
        for (const input of ['3C:5A', '', 'F0:2F:4B:01:0A:AA:BB', 'G0:2F:4B', 'F0_2F_4B', 'not-a-mac', null, undefined, 42]) {
            assert.equal(normalizeMacQuery(input), null, String(input));
        }
    });

    it('is what the front-end bridge re-exports', () => {
        assert.equal(bridged, normalizeMacQuery);
    });
});
