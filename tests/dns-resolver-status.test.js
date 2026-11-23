// Covers the DNS Resolver failure classification: the backend's UDP / DoH
// classifiers and the frontend's status → locale-key helper. No real lookups.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
    classifyDnsError, classifyDohEnvelope, classifyDohFetchError, classifyDohHttpStatus,
} from '../api/dns-resolver.js';
import { DNS_FAILURE_STATUSES, dnsFailureKeys, dnsRowStatus } from '../frontend/utils/features/dns-resolver-status.js';

const dnsError = (code) => Object.assign(new Error(`query ${code} private.example.test`), { code });

describe('classifyDnsError (UDP)', () => {
    const cases = [
        ['ENODATA', 'nodata', 'NODATA'],
        ['ENOTFOUND', 'nxdomain', 'NXDOMAIN'],
        ['ESERVFAIL', 'servfail', 'SERVFAIL'],
        ['EREFUSED', 'refused', 'REFUSED'],
        ['ENOTIMP', 'refused', 'NOTIMP'],
        ['ETIMEOUT', 'timeout', 'TIMEOUT'],
        ['ECONNREFUSED', 'unavailable', 'ECONNREFUSED'],
        ['ECANCELLED', 'unavailable', 'ECANCELLED'],
        ['EBADRESP', 'malformed', 'EBADRESP'],
        ['EFORMERR', 'malformed', 'FORMERR'],
        ['EOF', 'malformed', 'EOF'],
        ['EBADQUERY', 'malformed', 'EBADQUERY'],
    ];
    for (const [code, status, display] of cases) {
        it(`maps ${code} to ${status}`, () => {
            assert.deepEqual(classifyDnsError(dnsError(code)), { status, code: display });
        });
    }

    it('treats a code-less error as unavailable', () => {
        assert.deepEqual(classifyDnsError(new Error('boom')), { status: 'unavailable', code: 'ERROR' });
        assert.deepEqual(classifyDnsError(undefined), { status: 'unavailable', code: 'ERROR' });
    });
});

describe('classifyDohEnvelope', () => {
    it('answers ok with the selected records', () => {
        const records = [{ type: 1, data: '192.0.2.1' }];
        assert.deepEqual(classifyDohEnvelope({ Status: 0, Answer: records }, 'A'), { status: 'ok', records });
    });

    it('keeps the SOA authority fallback', () => {
        const soa = { type: 6, data: 'ns1.example.com. hostmaster.example.com. 1 2 3 4 5' };
        assert.deepEqual(classifyDohEnvelope({ Status: 0, Authority: [soa] }, 'SOA'), { status: 'ok', records: [soa] });
    });

    it('reads NOERROR without records as nodata', () => {
        assert.deepEqual(classifyDohEnvelope({ Status: 0 }, 'A'), { status: 'nodata', code: 'NODATA' });
        assert.deepEqual(classifyDohEnvelope({ Status: 0, Answer: [] }, 'A'), { status: 'nodata', code: 'NODATA' });
        assert.deepEqual(
            classifyDohEnvelope({ Status: 0, Authority: [{ type: 6, data: 'soa' }] }, 'A'),
            { status: 'nodata', code: 'NODATA' },
        );
    });

    const rcodes = [
        [1, 'malformed', 'FORMERR'],
        [2, 'servfail', 'SERVFAIL'],
        [3, 'nxdomain', 'NXDOMAIN'],
        [4, 'refused', 'NOTIMP'],
        [5, 'refused', 'REFUSED'],
        [9, 'unavailable', 'RCODE 9'],
    ];
    for (const [rcode, status, code] of rcodes) {
        it(`maps Status ${rcode} to ${status}, even with records present`, () => {
            const data = { Status: rcode, Answer: [{ type: 1, data: '192.0.2.1' }] };
            assert.deepEqual(classifyDohEnvelope(data, 'A'), { status, code });
        });
    }

    it('rejects unusable envelopes as malformed', () => {
        const malformed = { status: 'malformed', code: 'BADRESP' };
        for (const data of [
            null, 'text', 42, [], {},
            { Status: '0' },
            { Status: 0.5 },
            { Status: 0, Answer: 'x' },
            { Status: 0, Answer: [null] },
            { Status: 0, Authority: {} },
            { Status: 0, Answer: [{ type: 1 }] },
            { Status: 0, Answer: [{ type: 1, data: 7 }] },
        ]) {
            assert.deepEqual(classifyDohEnvelope(data, 'A'), malformed, JSON.stringify(data));
        }
    });
});

describe('classifyDohHttpStatus / classifyDohFetchError', () => {
    it('reads any non-2xx as unavailable with the HTTP status', () => {
        assert.deepEqual(classifyDohHttpStatus(503), { status: 'unavailable', code: 'HTTP 503' });
        assert.deepEqual(classifyDohHttpStatus(404), { status: 'unavailable', code: 'HTTP 404' });
    });

    it('reads fetchUpstream and undici timeouts as timeout', () => {
        const abort = Object.assign(new Error('Timed out after 5000ms: doh.example.test'), { name: 'AbortError' });
        assert.deepEqual(classifyDohFetchError(abort), { status: 'timeout', code: 'TIMEOUT' });
        const connect = new TypeError('fetch failed', { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } });
        assert.deepEqual(classifyDohFetchError(connect), { status: 'timeout', code: 'TIMEOUT' });
    });

    it('reads other transport failures as unavailable', () => {
        const refused = new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
        assert.deepEqual(classifyDohFetchError(refused), { status: 'unavailable', code: 'ECONNREFUSED' });
        assert.deepEqual(classifyDohFetchError(new Error('socket reset')), { status: 'unavailable', code: 'FETCH' });
    });
});

describe('frontend status helpers', () => {
    it('takes the row status, tolerating the shape without one', () => {
        assert.equal(dnsRowStatus({ status: 'servfail', result: 'N/A' }), 'servfail');
        assert.equal(dnsRowStatus({ status: 'ok', result: ['192.0.2.1'] }), 'ok');
        assert.equal(dnsRowStatus({ result: 'N/A' }), 'unavailable');
        assert.equal(dnsRowStatus({ result: ['192.0.2.1'] }), 'ok');
    });

    it('maps each failure class to its own keys and ok to none', () => {
        assert.equal(dnsFailureKeys('ok'), null);
        for (const status of DNS_FAILURE_STATUSES) {
            assert.deepEqual(dnsFailureKeys(status), {
                label: `dnsresolver.Failure.${status}.Label`,
                hint: `dnsresolver.Failure.${status}.Hint`,
            });
        }
        assert.deepEqual(dnsFailureKeys('future-class'), dnsFailureKeys('unavailable'));
    });

    it('has every key in the English pack', () => {
        const en = JSON.parse(readFileSync(new URL('../frontend/locales/en.json', import.meta.url), 'utf8'));
        for (const status of DNS_FAILURE_STATUSES) {
            const entry = en.dnsresolver.Failure[status];
            assert.ok(entry?.Label && entry?.Hint, status);
        }
    });
});
