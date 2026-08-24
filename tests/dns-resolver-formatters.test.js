// Offline coverage for turning each transport's raw DNS answer into the one
// display string a result row shows — Node's Resolver objects and the DoH JSON
// envelope alike. No test performs a real lookup.

import assert from 'node:assert/strict';
import { Resolver } from 'node:dns';
import { afterEach, describe, it } from 'node:test';

import { dohRecords, formatCaaRecords, formatSoaRecord, resolveDns, resolveDoh, withRootDot } from '../api/dns-resolver.js';

const originalResolveCname = Resolver.prototype.resolveCname;
const originalFetch = globalThis.fetch;

afterEach(() => {
    Resolver.prototype.resolveCname = originalResolveCname;
    globalThis.fetch = originalFetch;
});

describe('DNS resolver record formatting', () => {
    it('formats an SOA object in DNS presentation order, with the root dots the DoH path returns', () => {
        assert.equal(formatSoaRecord({
            nsname: 'ns1.example.com',
            hostmaster: 'hostmaster.example.com',
            serial: 2026082301,
            refresh: 3600,
            retry: 600,
            expire: 1209600,
            minttl: 300,
        }), 'ns1.example.com. hostmaster.example.com. 2026082301 3600 600 1209600 300');
    });

    it('formats standard and provider-specific CAA tags from each record shape', () => {
        assert.equal(formatCaaRecords([
            { critical: 0, type: 'CAA', issue: 'letsencrypt.org' },
            { critical: 128, type: 'CAA', issuewild: ';' },
            { critical: 0, type: 'CAA', iodef: 'mailto:security@example.com' },
            { critical: 1, type: 'CAA', customprovider: 'ca.example' },
        ]), [
            '0 issue "letsencrypt.org"',
            '128 issuewild ";"',
            '0 iodef "mailto:security@example.com"',
            '1 customprovider "ca.example"',
        ].join(', '));
    });

    it('drops a CAA record carrying no tag rather than rendering an undefined one', () => {
        assert.equal(formatCaaRecords([
            { critical: 0, type: 'CAA' },
            { critical: 0, type: 'CAA', issue: 'ca.example' },
        ]), '0 issue "ca.example"');
    });
});

describe('DoH answer selection', () => {
    it('prefers the answer section', () => {
        const data = {
            Answer: [{ type: 1, data: '192.0.2.1' }],
            Authority: [{ type: 6, data: 'ns1.example.com. hostmaster.example.com. 1 2 3 4 5' }],
        };
        assert.deepEqual(dohRecords(data, 'A'), data.Answer);
    });

    it('skips a CNAME answer and takes the authority SOA for a SOA query on an aliased name', () => {
        const soa = { type: 6, data: 'ns1.example.com. hostmaster.example.com. 1 2 3 4 5' };
        assert.deepEqual(dohRecords({
            Answer: [{ type: 5, data: 'target.example.net.' }],
            Authority: [soa],
        }, 'SOA'), [soa]);
    });

    it('keeps a SOA answer at the zone apex', () => {
        const soa = { type: 6, data: 'ns1.example.com. hostmaster.example.com. 1 2 3 4 5' };
        assert.deepEqual(dohRecords({ Answer: [soa] }, 'SOA'), [soa]);
    });

    it('falls back to the authority SOA for a name below the zone apex', () => {
        const soa = { type: 6, data: 'ns1.example.com. hostmaster.example.com. 1 2 3 4 5' };
        assert.deepEqual(dohRecords({ Authority: [{ type: 2, data: 'ns1.example.com.' }, soa] }, 'SOA'), [soa]);
    });

    it('leaves the authority section alone for every other record type', () => {
        const data = { Authority: [{ type: 6, data: 'ns1.example.com. hostmaster.example.com. 1 2 3 4 5' }] };
        assert.deepEqual(dohRecords(data, 'A'), []);
        assert.deepEqual(dohRecords(data, 'MX'), []);
    });

    it('reports nothing when neither section carries an answer', () => {
        assert.deepEqual(dohRecords({}, 'SOA'), []);
        assert.deepEqual(dohRecords({ Answer: [] }, 'A'), []);
    });
});

describe('root-dot normalization', () => {
    it('adds the dot only when it is missing', () => {
        assert.equal(withRootDot('dns.google'), 'dns.google.');
        assert.equal(withRootDot('dns.google.'), 'dns.google.');
    });

    it('normalizes the UDP side, which Node returns bare', async () => {
        Resolver.prototype.resolveCname = (_hostname, callback) => callback(null, ['github.com']);
        assert.deepEqual(
            await resolveDns('www.github.com', 'CNAME', 'Example DNS', '192.0.2.1'),
            ['github.com.'],
        );
    });

    it('normalizes the DoH side, whichever way the endpoint writes it', async () => {
        globalThis.fetch = async () => new Response(JSON.stringify({
            Answer: [{ type: 5, data: 'github.com' }, { type: 5, data: 'other.example.' }],
        }), { status: 200 });
        assert.deepEqual(
            await resolveDoh('www.github.com', 'CNAME', 'Example DoH', 'https://doh.example.test/resolve?'),
            ['github.com.', 'other.example.'],
        );
    });

    it('leaves address- and text-valued answers untouched', async () => {
        globalThis.fetch = async () => new Response(JSON.stringify({
            Answer: [{ type: 1, data: '192.0.2.1' }],
        }), { status: 200 });
        assert.deepEqual(
            await resolveDoh('example.com', 'A', 'Example DoH', 'https://doh.example.test/resolve?'),
            ['192.0.2.1'],
        );
    });
});
