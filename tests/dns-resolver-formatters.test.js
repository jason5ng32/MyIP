// Offline unit coverage for DNS record shapes returned by Node's Resolver.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatCaaRecords, formatSoaRecord } from '../api/dns-resolver.js';

describe('DNS resolver record formatting', () => {
    it('formats an SOA object in DNS presentation order', () => {
        assert.equal(formatSoaRecord({
            nsname: 'ns1.example.com',
            hostmaster: 'hostmaster.example.com',
            serial: 2026082301,
            refresh: 3600,
            retry: 600,
            expire: 1209600,
            minttl: 300,
        }), 'ns1.example.com hostmaster.example.com 2026082301 3600 600 1209600 300');
    });

    it('recovers a tag whose name collides with Node\'s metadata fields', () => {
        // Node writes the tag onto the record under its own name, so a record
        // tagged `type` arrives with no key outside the metadata set. Without
        // recovery the destructure throws and the whole answer becomes N/A.
        assert.equal(formatCaaRecords([
            { critical: 1, type: 'hello' },
        ]), '1 type "hello"');

        // A tag named `critical` displaces the flag; 0 is the documented default.
        assert.equal(formatCaaRecords([
            { critical: 'ca.example', type: 'CAA' },
        ]), '0 critical "ca.example"');
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
});
