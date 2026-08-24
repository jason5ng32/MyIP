// Guards the one list behind the record-type picker, the requireValidRecordType
// allowlist and the resolver switch — including that the frontend bridge has
// not regrown its own copy.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DNS_RECORD_TYPES, DNS_RECORD_TYPE_SET, NAME_VALUED_TYPES } from '../common/dns-record-types.js';
import { DNS_RECORD_TYPES as bridgedTypes } from '../frontend/utils/dns-record-types.js';

describe('DNS record types', () => {
    it('re-exports the same list through the frontend bridge', () => {
        assert.deepEqual(bridgedTypes, DNS_RECORD_TYPES);
    });

    it('keeps the lookup set in step with the ordered list', () => {
        assert.deepEqual([...DNS_RECORD_TYPE_SET].sort(), [...DNS_RECORD_TYPES].sort());
    });

    it('only marks types the resolver actually answers for as name-valued', () => {
        // A name-valued type missing from the list would never reach
        // withRootDot, so the drift would show up as punctuation noise in the
        // results table rather than as an error.
        for (const type of NAME_VALUED_TYPES) {
            assert.ok(DNS_RECORD_TYPE_SET.has(type), `${type} is not a supported record type`);
        }
    });

    it('holds uppercase types, which is the form the guard normalizes to', () => {
        for (const type of DNS_RECORD_TYPES) assert.equal(type, type.toUpperCase());
    });
});
