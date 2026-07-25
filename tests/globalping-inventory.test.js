// Unit tests for the Globalping probe inventory aggregation
// (common/globalping-inventory.js). Fixtures mirror the raw /v1/probes
// shape: one entry per online probe with location.country / .continent.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildProbeInventory } from '../common/globalping-inventory.js';

const probe = (country, continent) => ({ location: { country, continent } });

describe('buildProbeInventory', () => {
    it('returns empty shapes for empty or non-array input', () => {
        assert.deepEqual(buildProbeInventory([]), { countries: [], continents: [] });
        assert.deepEqual(buildProbeInventory(null), { countries: [], continents: [] });
    });

    it('dedupes countries and sorts codes alphabetically', () => {
        const result = buildProbeInventory([
            probe('DE', 'EU'), probe('DE', 'EU'), probe('AT', 'EU'), probe('CH', 'EU'),
        ]);
        assert.deepEqual(result.countries, ['AT', 'CH', 'DE']);
        assert.deepEqual(result.continents, [{ key: 'europe', countries: ['AT', 'CH', 'DE'] }]);
    });

    it('merges NA and SA into the americas bucket', () => {
        const result = buildProbeInventory([
            probe('US', 'NA'), probe('BR', 'SA'), probe('CA', 'NA'),
        ]);
        assert.deepEqual(result.continents, [{ key: 'americas', countries: ['BR', 'CA', 'US'] }]);
    });

    it('keeps continents in display order (asia → europe → africa → americas → oceania)', () => {
        const result = buildProbeInventory([
            probe('AU', 'OC'), probe('US', 'NA'), probe('ZA', 'AF'), probe('DE', 'EU'), probe('JP', 'AS'),
        ]);
        assert.deepEqual(result.continents.map((c) => c.key), ['asia', 'europe', 'africa', 'americas', 'oceania']);
    });

    it('skips probes without a country; unknown continents still count as available', () => {
        const result = buildProbeInventory([
            probe(undefined, 'EU'),
            probe('AQ', 'AN'),          // Antarctica: no display bucket
            { location: null },
            probe('JP', 'AS'),
        ]);
        assert.deepEqual(result.countries, ['AQ', 'JP']);
        assert.deepEqual(result.continents, [{ key: 'asia', countries: ['JP'] }]);
    });
});
