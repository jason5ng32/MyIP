// Coverage for the persona collector: bus payloads → the observation shape,
// the "what hasn't run yet" bookkeeping, and the opt-in inputs travelling
// raw. The collector never re-runs a test.

import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';

import { emitAppEvent } from '../frontend/utils/app-events.js';
import {
    buildObservation,
    useAppPersonaCollector,
    usePersonaSnapshots,
    resetPersonaSnapshots,
    normalizeIpinfo,
    normalizeWebrtc,
    normalizeDnsleak,
    PERSONA_SOURCES,
} from '../frontend/composables/use-persona-collector.js';
import { observeBrowser } from '../frontend/utils/persona/observe-browser.js';

describe('payload normalization', () => {
    it('maps IP cards to the check-facing shape and tags the IP version', () => {
        const normalized = normalizeIpinfo({
            cards: [
                { source: 'ipinfo.io', ip: '203.0.113.9', country_code: 'jp', asn: 'AS1', ipTypeCode: 'residential' },
                { source: 'ip.sb', ip: '2001:db8::1', country_code: 'JP' },
            ],
        });
        assert.equal(normalized.cards.length, 2);
        assert.equal(normalized.cards[0].countryCode, 'JP', 'country codes are uppercased');
        assert.equal(normalized.cards[0].version, 4);
        assert.equal(normalized.cards[1].version, 6);
        assert.equal(normalized.cards[0].ipType, 'residential');
    });

    it('drops IP cards whose address never resolved', () => {
        const normalized = normalizeIpinfo({
            cards: [{ ip: 'Not available' }, { ip: '203.0.113.9', country_code: 'JP' }],
        });
        assert.equal(normalized.cards.length, 1);
    });

    it('returns an empty slice when a run produced nothing usable', () => {
        // Empty, never null: the slice is what tells the evaluator the test
        // ran, which is what separates "not applicable" from "not measured".
        assert.deepEqual(normalizeIpinfo({ cards: [] }), { cards: [] });
        assert.deepEqual(normalizeIpinfo({}), { cards: [] });
        assert.deepEqual(normalizeWebrtc({ servers: [{ ip: 'n/a' }] }), { servers: [] });
        assert.deepEqual(normalizeDnsleak({ providers: [] }), { providers: [] });
    });

    it('maps WebRTC servers, keeping the NAT type the check needs', () => {
        const normalized = normalizeWebrtc({
            servers: [{ ip: '198.51.100.4', natTypeCode: 'srflx', country_code: 'it', org: 'X' }],
        });
        assert.deepEqual(normalized.servers[0], {
            ip: '198.51.100.4', natType: 'srflx', countryCode: 'IT', org: 'X',
        });
    });

    it('maps DNS resolvers', () => {
        const normalized = normalizeDnsleak({
            providers: [{ name: 'Cloudflare', ip: '1.1.1.1', country_code: 'us' }],
        });
        assert.equal(normalized.providers[0].countryCode, 'US');
        assert.equal(normalized.providers[0].name, 'Cloudflare');
    });
});

describe('collector subscription', () => {
    // Subscribed once for the whole suite: onScopeDispose is a no-op outside a
    // Vue scope, so re-subscribing per test would just stack listeners.
    useAppPersonaCollector();

    beforeEach(resetPersonaSnapshots);
    afterEach(resetPersonaSnapshots);

    it('starts with every source missing', () => {
        const { missingSources, hasAnySource } = usePersonaSnapshots();
        assert.deepEqual(missingSources.value, PERSONA_SOURCES);
        assert.equal(hasAnySource.value, false);
    });

    it('records a snapshot when a test finishes and drops it from the missing list', () => {
        emitAppEvent('ipinfo:finished', { cards: [{ ip: '203.0.113.9', country_code: 'JP' }] });
        const { snapshots, missingSources, hasAnySource } = usePersonaSnapshots();
        assert.equal(snapshots.ipinfo.cards.length, 1);
        assert.ok(!missingSources.value.includes('ipinfo'));
        assert.equal(hasAnySource.value, true);
    });

    it('does not let a later empty run erase a good snapshot', () => {
        emitAppEvent('ipinfo:finished', { cards: [{ ip: '203.0.113.9', country_code: 'JP' }] });
        emitAppEvent('ipinfo:finished', { cards: [] });
        const { snapshots } = usePersonaSnapshots();
        assert.equal(snapshots.ipinfo.cards.length, 1, 'the earlier usable result must survive');
    });

    it('overwrites with the newer result when a re-run produces data', () => {
        emitAppEvent('ipinfo:finished', { cards: [{ ip: '203.0.113.9', country_code: 'JP' }] });
        emitAppEvent('ipinfo:finished', { cards: [{ ip: '203.0.113.9', country_code: 'IT' }] });
        const { snapshots } = usePersonaSnapshots();
        assert.equal(snapshots.ipinfo.cards[0].countryCode, 'IT');
    });

    it('collects every source the checks read from', () => {
        emitAppEvent('ipinfo:finished', { cards: [{ ip: '203.0.113.9', country_code: 'JP' }] });
        emitAppEvent('webrtc:finished', { servers: [{ ip: '198.51.100.4', natTypeCode: 'srflx' }] });
        emitAppEvent('dnsleak:finished', { providers: [{ ip: '1.1.1.1', country_code: 'US' }] });
        const { missingSources } = usePersonaSnapshots();
        assert.deepEqual(missingSources.value, []);
    });

    it('counts a source that ran and found nothing as no longer missing', () => {
        // A browser that blocks WebRTC, or a resolver test that comes back
        // empty, must not lock the tool away from the visitor.
        emitAppEvent('dnsleak:finished', { providers: [{ ip: 'error' }] });
        const { snapshots, missingSources } = usePersonaSnapshots();
        assert.deepEqual(snapshots.dnsleak, { providers: [] });
        assert.ok(!missingSources.value.includes('dnsleak'));
    });
});

describe('observeBrowser', () => {
    const originalNavigator = globalThis.navigator;

    const stubNavigator = (value) =>
        Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true });

    beforeEach(() => stubNavigator({
        languages: ['ja-JP', 'en-US'],
        language: 'ja-JP',
        platform: 'MacIntel',
        maxTouchPoints: 0,
    }));

    afterEach(() => stubNavigator(originalNavigator));

    it('reports the UTC offset east-positive, opposite to getTimezoneOffset', () => {
        const observed = observeBrowser();
        assert.equal(observed.offsetMinutes, -new Date().getTimezoneOffset());
    });

    it('samples four historical instants across two years for the DST check', () => {
        const { historicalOffsets } = observeBrowser();
        assert.equal(historicalOffsets.length, 4);
        for (const sample of historicalOffsets) {
            assert.equal(typeof sample.ts, 'number');
            assert.equal(typeof sample.offsetMinutes, 'number');
        }
        const years = new Set(historicalOffsets.map((s) => new Date(s.ts).getUTCFullYear()));
        assert.equal(years.size, 2, 'samples must span two years to catch rule changes');
    });

    it('reads the language list straight off navigator', () => {
        assert.deepEqual(observeBrowser().languages, ['ja-JP', 'en-US']);
    });

    it('falls back to navigator.language when languages is unavailable', () => {
        stubNavigator({ language: 'fr-FR', platform: 'Linux x86_64' });
        assert.deepEqual(observeBrowser().languages, ['fr-FR']);
    });


});

describe('buildObservation', () => {
    const originalNavigator = globalThis.navigator;
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        Object.defineProperty(globalThis, 'navigator', {
            value: { languages: ['ja-JP'], language: 'ja-JP' }, configurable: true, writable: true,
        });
        // No document / speechSynthesis / keyboard in Node: every probe has to
        // degrade rather than throw, which is the point of asserting it here.
        globalThis.fetch = async () => { throw new TypeError('offline'); };
        resetPersonaSnapshots();
    });

    afterEach(() => {
        Object.defineProperty(globalThis, 'navigator', {
            value: originalNavigator, configurable: true, writable: true,
        });
        globalThis.fetch = originalFetch;
        resetPersonaSnapshots();
    });

    it('assembles what it has and omits what has not run', async () => {
        emitAppEvent('ipinfo:finished', { cards: [{ ip: '203.0.113.9', country_code: 'JP' }] });
        emitAppEvent('webrtc:finished', { servers: [] });
        const observation = await buildObservation();
        assert.equal(observation.ip.cards.length, 1);
        // Ran-and-empty travels as an empty slice; never-run is left out
        // entirely — the evaluator reads the difference.
        assert.deepEqual(observation.webrtc, { servers: [] });
        assert.equal(observation.dns, undefined, 'a test that never ran must not be reported as empty');
        assert.equal(observation.trace, undefined, 'an unreachable trace endpoint is left out');
        assert.ok(observation.browser.languages.includes('ja-JP'));
        // No canvas in Node: the probe reports "could not measure" rather than
        // "no fonts installed", which the scorer reads as unmeasured.
        assert.equal(observation.fonts.available, false);
    });

    it('sends the opt-in inputs raw, never resolved locally', async () => {
        const observation = await buildObservation({
            geolocation: { available: true, latitude: 35.69, longitude: 139.69 },
            cardBin: '353011',
        });
        assert.deepEqual(observation.card, { bin: '353011' });
        assert.equal(observation.geolocation.latitude, 35.69);
        assert.equal(observation.geolocation.country, undefined, 'the country is named where the data lives');
    });

    it('leaves both opt-in inputs out when the visitor skipped them', async () => {
        const observation = await buildObservation({ cardBin: '' });
        assert.equal(observation.card, undefined);
        assert.equal(observation.geolocation, undefined);
    });
});
