// Unit tests for the pure transform pipeline in common/cf-radar.js:
// the outage feed (Radar payload → flat event shape, anomaly-vs-outage
// dedupe, sort and cap) and the country-traffic matrix aggregation.
// Fixtures mirror real /radar/annotations/outages and /radar/traffic_anomalies
// responses (see the field names — they are the upstream contract).
// Dispatch behavior of the /api/cfradar route lives in api-handlers.test.js.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    normalizeOutages,
    normalizeAnomalies,
    mergeEvents,
    buildTrafficMatrix,
} from '../common/cf-radar.js';

const outageFixture = {
    id: '1645',
    dataSource: 'ALL',
    description: 'A 7.4-magnitude earthquake in western Colombia',
    scope: null,
    startDate: '2026-08-10T12:30:00Z',
    endDate: null,
    locations: ['CO'],
    asns: [],
    eventType: 'OUTAGE',
    linkedUrl: null,
    asnsDetails: [],
    locationsDetails: [{ name: 'Colombia', code: 'CO' }],
    outage: { outageCause: 'NATURAL_DISASTER', outageType: 'NATIONWIDE' },
};

const anomalyFixture = {
    uuid: '7dbd7c69-6fe3-4090-ab64-de4194c283b7',
    type: 'LOCATION',
    status: 'VERIFIED',
    startDate: '2026-08-08T17:00:00Z',
    endDate: '2026-08-08T20:15:00Z',
    locationDetails: { code: 'GA', name: 'Gabon' },
    asnDetails: null,
    originDetails: null,
};

describe('normalizeOutages', () => {
    it('maps a Radar outage annotation to the flat event shape', () => {
        const [event] = normalizeOutages([outageFixture]);
        assert.deepEqual(event, {
            kind: 'outage',
            id: 'o-1645',
            startDate: '2026-08-10T12:30:00Z',
            endDate: null,
            locations: ['CO'],
            asns: [],
            cause: 'NATURAL_DISASTER',
            level: 'NATIONWIDE',
            description: 'A 7.4-magnitude earthquake in western Colombia',
            scope: null,
            linkedUrl: null,
        });
    });

    it('numbers stringly-typed ASNs and survives a missing outage object', () => {
        const [event] = normalizeOutages([{
            ...outageFixture,
            outage: undefined,
            asnsDetails: [{ asn: '27725', name: 'ETECSA' }],
        }]);
        assert.deepEqual(event.asns, [{ asn: 27725, name: 'ETECSA' }]);
        assert.equal(event.cause, 'UNKNOWN');
        assert.equal(event.level, null);
    });
});

describe('normalizeAnomalies', () => {
    it('maps a location anomaly, leaving outage-only fields null', () => {
        const [event] = normalizeAnomalies([anomalyFixture]);
        assert.equal(event.kind, 'anomaly');
        assert.equal(event.id, 'a-7dbd7c69-6fe3-4090-ab64-de4194c283b7');
        assert.deepEqual(event.locations, ['GA']);
        assert.deepEqual(event.asns, []);
        assert.equal(event.cause, null);
        assert.equal(event.level, null);
    });

    it('keeps every anomaly status (the exclusion blocklist ships empty)', () => {
        const events = normalizeAnomalies([
            { ...anomalyFixture, uuid: 'u-1', status: 'UNVERIFIED' },
            { ...anomalyFixture, uuid: 'u-2', status: 'TP' },
            { ...anomalyFixture, uuid: 'u-3', status: 'VERIFIED' },
        ]);
        assert.deepEqual(events.map((e) => e.id), ['a-u-1', 'a-u-2', 'a-u-3']);
    });

    it('maps an AS anomaly to an asns entry with no locations', () => {
        const [event] = normalizeAnomalies([{
            ...anomalyFixture,
            type: 'AS',
            locationDetails: null,
            asnDetails: { asn: 27653, name: 'Comteco' },
        }]);
        assert.deepEqual(event.locations, []);
        assert.deepEqual(event.asns, [{ asn: 27653, name: 'Comteco' }]);
    });
});

describe('mergeEvents', () => {
    const outages = normalizeOutages([outageFixture]);

    it('drops an anomaly that shares a location and start window with an outage', () => {
        const anomalies = normalizeAnomalies([{
            ...anomalyFixture,
            locationDetails: { code: 'CO', name: 'Colombia' },
            startDate: '2026-08-10T12:30:00Z',
        }]);
        const merged = mergeEvents(outages, anomalies);
        assert.equal(merged.length, 1);
        assert.equal(merged[0].kind, 'outage');
    });

    it('drops an anomaly that shares an ASN with an outage', () => {
        const cubaOutage = normalizeOutages([{
            ...outageFixture,
            id: '1611',
            locationsDetails: [{ name: 'Cuba', code: 'CU' }],
            asnsDetails: [{ asn: '27725', name: 'ETECSA' }],
            startDate: '2026-08-03T02:45:00Z',
        }]);
        const anomalies = normalizeAnomalies([{
            ...anomalyFixture,
            type: 'AS',
            locationDetails: null,
            asnDetails: { asn: 27725, name: 'ETECSA' },
            startDate: '2026-08-03T02:45:00Z',
        }]);
        const merged = mergeEvents(cubaOutage, anomalies);
        assert.equal(merged.length, 1);
        assert.equal(merged[0].kind, 'outage');
    });

    it('keeps an anomaly whose subject matches but starts outside the window', () => {
        const anomalies = normalizeAnomalies([{
            ...anomalyFixture,
            locationDetails: { code: 'CO', name: 'Colombia' },
            startDate: '2026-08-01T00:00:00Z',
        }]);
        assert.equal(mergeEvents(outages, anomalies).length, 2);
    });

    it('orders ongoing before ended, newest-first inside each group', () => {
        // Ended CO outage is newer than everything; the older ongoing events
        // must still lead, themselves in reverse start order.
        const endedOutage = normalizeOutages([{
            ...outageFixture, id: '1', endDate: '2026-08-10T18:00:00Z',
        }]);
        const ongoingOld = normalizeAnomalies([{
            ...anomalyFixture, uuid: 'u-old', startDate: '2026-08-01T00:00:00Z', endDate: null,
        }]);
        const ongoingNew = normalizeAnomalies([{
            ...anomalyFixture,
            uuid: 'u-new',
            locationDetails: { code: 'GN', name: 'Guinea' },
            startDate: '2026-08-05T00:00:00Z',
            endDate: null,
        }]);
        const merged = mergeEvents(endedOutage, [...ongoingOld, ...ongoingNew]);
        assert.deepEqual(merged.map((e) => e.id), ['a-u-new', 'a-u-old', 'o-1']);
    });

    it('caps the merged feed at 30 events', () => {
        const many = normalizeOutages(Array.from({ length: 40 }, (_, i) => ({
            ...outageFixture,
            id: String(i),
            startDate: `2026-07-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
        })));
        assert.equal(mergeEvents(many, []).length, 30);
    });
});

describe('buildTrafficMatrix', () => {
    // 28 days of hourly points from Monday 2024-01-01T00:00Z, Radar-style
    // string values. `valueAt` receives the point's UTC date.
    const makeSerie = (valueAt) => {
        const start = Date.UTC(2024, 0, 1);
        const timestamps = [];
        const values = [];
        for (let i = 0; i < 28 * 24; i++) {
            const date = new Date(start + i * 60 * 60 * 1000);
            timestamps.push(date.toISOString());
            values.push(String(valueAt(date)));
        }
        return { timestamps, values };
    };

    it('returns null for a missing or malformed serie', () => {
        assert.equal(buildTrafficMatrix(undefined), null);
        assert.equal(buildTrafficMatrix({}), null);
        assert.equal(buildTrafficMatrix({ timestamps: [], values: [] }), null);
    });

    it('returns null when the serie covers less than a full week', () => {
        const serie = makeSerie(() => 0.5);
        serie.timestamps = serie.timestamps.slice(0, 100);
        serie.values = serie.values.slice(0, 100);
        assert.equal(buildTrafficMatrix(serie), null);
    });

    it('aggregates into a Monday-first 7×24 matrix scaled to a max of 1', () => {
        // Baseline 0.1 with a spike every Tuesday at 05:00 UTC.
        const serie = makeSerie((date) => (date.getUTCDay() === 2 && date.getUTCHours() === 5 ? 1 : 0.1));
        const matrix = buildTrafficMatrix(serie);
        assert.equal(matrix.length, 7);
        assert.ok(matrix.every((row) => row.length === 24));
        assert.equal(matrix[1][5], 1); // Tuesday is row 1 when Monday-first
        assert.equal(matrix[0][0], 0.1);
        assert.equal(Math.max(...matrix.flat()), 1);
    });

    it('skips unparsable points without breaking the aggregate', () => {
        const serie = makeSerie(() => 0.5);
        serie.values[0] = 'not-a-number';
        const matrix = buildTrafficMatrix(serie);
        assert.equal(matrix.length, 7);
        assert.equal(Math.max(...matrix.flat()), 1);
    });
});
