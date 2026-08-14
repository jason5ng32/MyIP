// Sanity checks for the ISO 3166-1 alpha-2 → numeric map that joins pulse
// country data onto world-atlas TopoJSON features.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ALPHA2_TO_NUMERIC, NUMERIC_TO_ALPHA2 } from '../frontend/data/country-numeric.js';

describe('country-numeric map', () => {
    it('covers the full ISO 3166-1 set', () => {
        assert.ok(Object.keys(ALPHA2_TO_NUMERIC).length >= 240,
            'expected at least 240 alpha-2 entries');
    });

    it('every key is an uppercase alpha-2 code and every value a 3-digit string', () => {
        for (const [alpha2, numeric] of Object.entries(ALPHA2_TO_NUMERIC)) {
            assert.match(alpha2, /^[A-Z]{2}$/, `bad alpha-2 key: ${alpha2}`);
            assert.match(numeric, /^\d{3}$/, `bad numeric value for ${alpha2}: ${numeric}`);
        }
    });

    it('numeric codes are unique and the reverse map round-trips', () => {
        const values = Object.values(ALPHA2_TO_NUMERIC);
        assert.equal(new Set(values).size, values.length, 'duplicate numeric codes');
        for (const [alpha2, numeric] of Object.entries(ALPHA2_TO_NUMERIC)) {
            assert.equal(NUMERIC_TO_ALPHA2[numeric], alpha2);
        }
    });

    it('spot-checks well-known codes', () => {
        assert.equal(ALPHA2_TO_NUMERIC.US, '840');
        assert.equal(ALPHA2_TO_NUMERIC.CN, '156');
        assert.equal(ALPHA2_TO_NUMERIC.DE, '276');
        assert.equal(ALPHA2_TO_NUMERIC.SG, '702');
        assert.equal(ALPHA2_TO_NUMERIC.AQ, '010'); // Antarctica — filtered from the map render
    });
});
