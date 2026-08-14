// Contract tests for common/ip-timezone — the coordinate → IANA zone
// derivation behind the withTimeZone() middleware. Distinct from
// frontend/utils/time-utils.js, which reads the visitor's own browser timezone.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { lookupTimeZone, attachTimeZone, withTimeZone } from '../common/ip-timezone.js';

// Minimal res stub — enough to observe what the res.json hook does, and to
// prove the original json() still runs and still returns res for chaining.
function makeRes(statusCode = 200) {
    return {
        statusCode,
        body: null,
        json(payload) { this.body = payload; return this; },
    };
}

describe('lookupTimeZone — resolving coordinates', () => {
    it('resolves land coordinates to their IANA zone', () => {
        assert.equal(lookupTimeZone(1.3521, 103.8198), 'Asia/Singapore');
        assert.equal(lookupTimeZone(-33.8688, 151.2093), 'Australia/Sydney');
        assert.equal(lookupTimeZone(37.7749, -122.4194), 'America/Los_Angeles');
    });

    it('accepts numeric strings, which some sources return instead of numbers', () => {
        assert.equal(lookupTimeZone('1.3521', '103.8198'), 'Asia/Singapore');
    });
});

describe('lookupTimeZone — coordinates that carry no timezone', () => {
    it("returns '' for the 'N/A' placeholder sources use for a missing location", () => {
        assert.equal(lookupTimeZone('N/A', 'N/A'), '');
    });

    it("returns '' rather than coercing null/undefined/empty to the 0,0 null island", () => {
        assert.equal(lookupTimeZone(null, null), '');
        assert.equal(lookupTimeZone(undefined, undefined), '');
        assert.equal(lookupTimeZone('', ''), '');
        // The dangerous half-missing case: a real longitude beside a null
        // latitude would otherwise be read as a point on the equator.
        assert.equal(lookupTimeZone(null, 103.8198), '');
        assert.equal(lookupTimeZone(1.3521, null), '');
    });

    it("returns '' for open water, where the lookup answers with an Etc/* zone", () => {
        assert.equal(lookupTimeZone(0, 0), '');
    });

    it("returns '' for out-of-range coordinates instead of throwing", () => {
        assert.equal(lookupTimeZone(91, 0), '');
        assert.equal(lookupTimeZone(0, 181), '');
        assert.equal(lookupTimeZone(NaN, NaN), '');
    });
});

describe('attachTimeZone — enriching a geo payload', () => {
    it('adds the zone derived from the payload own coordinates', () => {
        const payload = { ip: '1.1.1.1', city: 'Singapore', latitude: 1.3521, longitude: 103.8198 };
        attachTimeZone(payload);
        assert.equal(payload.timezone, 'Asia/Singapore');
    });

    it("always defines the field, so the frontend has one falsy check", () => {
        const payload = { ip: '1.1.1.1', city: 'N/A', latitude: 'N/A', longitude: 'N/A' };
        attachTimeZone(payload);
        assert.equal(payload.timezone, '');
    });

    it('recomputes rather than trusting a timezone the upstream already sent', () => {
        const payload = { latitude: 1.3521, longitude: 103.8198, timezone: 'America/New_York' };
        attachTimeZone(payload);
        assert.equal(payload.timezone, 'Asia/Singapore');
    });

    it('mutates in place and returns the same object', () => {
        const payload = { latitude: 35.6895, longitude: 139.6917 };
        assert.equal(attachTimeZone(payload), payload);
    });

    it('leaves non-object bodies untouched', () => {
        assert.equal(attachTimeZone(null), null);
        assert.equal(attachTimeZone('a string body'), 'a string body');
        const list = [{ latitude: 1.3521, longitude: 103.8198 }];
        attachTimeZone(list);
        assert.equal(list[0].timezone, undefined);
    });

    it('does not invent coordinates for a payload that has none', () => {
        const payload = { error: 'Upstream responded 502' };
        attachTimeZone(payload);
        assert.equal(payload.timezone, '');
    });
});

describe('withTimeZone — route middleware', () => {
    it('calls next() so the handler still runs', () => {
        let nextCalled = false;
        withTimeZone()({}, makeRes(), () => { nextCalled = true; });
        assert.equal(nextCalled, true);
    });

    it('enriches a 2xx body on its way out', () => {
        const res = makeRes(200);
        withTimeZone()({}, res, () => { });
        res.json({ city: 'Tokyo', latitude: 35.6895, longitude: 139.6917 });
        assert.equal(res.body.timezone, 'Asia/Tokyo');
    });

    it('leaves error bodies alone, matching cacheable()s 2xx-only rule', () => {
        for (const code of [400, 500]) {
            const res = makeRes(code);
            withTimeZone()({}, res, () => { });
            res.json({ error: 'nope', latitude: 35.6895, longitude: 139.6917 });
            assert.equal(res.body.timezone, undefined);
        }
    });

    it('preserves the original json() return value for chaining', () => {
        const res = makeRes(200);
        withTimeZone()({}, res, () => { });
        assert.equal(res.json({ latitude: 1.3521, longitude: 103.8198 }), res);
    });
});
