// Specs for frontend/utils/ip/source-fields.js: the IP card's source metric cells, plus the data-source sentence's copy.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readFileSync } from 'node:fs';

import { listSourceMetrics } from '../frontend/utils/ip/source-fields.js';
import { transformDataFromIPapi } from '../frontend/utils/ip/transform-ip-data.js';
import { SOURCE_METRIC_IDS } from '../frontend/utils/ip/ip-extended.js';
import { FULL_LOCALE_CODES } from '../common/locale-registry.js';

const t = (key) => key;

// A card as transform-ip-data.js builds it from an invented answer.
const cardOf = (extended) => ({
    ...transformDataFromIPapi({ ip: '203.0.113.7', country: 'NL', org: 'Example Net', asn: 'AS64500', extended }, t, 'en'),
    ip: '203.0.113.7',
});

describe('listSourceMetrics()', () => {
    it('draws a value out of max as a ratio and any other value as it is, in order', () => {
        const card = cardOf({ metrics: [{ id: 'abuserScore', value: '0.0021 (Low)' }, { id: 'fraudScore', value: 12, max: 100 }] });
        assert.deepEqual(listSourceMetrics(card), [
            { id: 'abuserScore', text: '0.0021 (Low)', ratio: false },
            { id: 'fraudScore', text: '12/100', ratio: true },
        ]);
        assert.deepEqual(listSourceMetrics(cardOf({ metrics: [{ id: 'fraudScore', value: 0 }] })),
            [{ id: 'fraudScore', text: '0', ratio: false }]);
    });

    it('skips unknown ids and has nothing without metrics', () => {
        assert.deepEqual(listSourceMetrics({ sourceMetrics: [{ id: 'trustScore', value: 3 }, null, { id: 'fraudScore', value: 5 }] }),
            [{ id: 'fraudScore', text: '5', ratio: false }]);
        for (const card of [cardOf({ lineType: 'hosting' }), cardOf({ gate: 'auth' }), null, undefined]) {
            assert.deepEqual(listSourceMetrics(card), []);
        }
    });

    it('every full locale names every metric', () => {
        for (const code of FULL_LOCALE_CODES) {
            const pack = JSON.parse(readFileSync(new URL(`../frontend/locales/${code}.json`, import.meta.url), 'utf8'));
            const labels = pack.ipInfos.sourceMetrics;
            assert.deepEqual(Object.keys(labels).sort(), [...SOURCE_METRIC_IDS].sort(), code);
            for (const id of SOURCE_METRIC_IDS) assert.ok(labels[id].trim(), `${code}: ${id}`);
        }
    });
});

describe('data-source sentence copy', () => {
    it('every full locale has the label, the switch and the sentence with both slots', () => {
        for (const code of FULL_LOCALE_CODES) {
            const pack = JSON.parse(readFileSync(new URL(`../frontend/locales/${code}.json`, import.meta.url), 'utf8'));
            assert.deepEqual(Object.keys(pack.ipInfos.sourceFields).sort(), ['sentence', 'source', 'switch'], code);
            for (const key of ['sentence', 'source', 'switch']) assert.ok(pack.ipInfos.sourceFields[key].trim(), `${code}: ${key}`);
            for (const slot of ['{source}', '{switch}']) assert.ok(pack.ipInfos.sourceFields.sentence.includes(slot), `${code}: ${slot}`);
        }
    });
});
