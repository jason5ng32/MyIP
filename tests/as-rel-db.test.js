// Coverage for common/as-rel-db.js lookups over a fixture snapshot. The module
// reads its snapshot directory through `fs` at load/reload time, so the test
// points those calls at an in-memory fixture and reloads — no files written.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, it, mock } from 'node:test';

import {
    AS_REL_DB_DIR, reloadAsRelDatabase,
    providersOf, peersOf, customersOf, customerCountOf, isTier1,
} from '../common/as-rel-db.js';

const FIXTURE_FILE = path.join(AS_REL_DB_DIR, 'fixture.txt');

// AS1 sells transit to AS2 and 100 others (≥ TIER1_MIN_CUSTOMERS, no
// providers → Tier 1). AS2 sells to AS10 / AS11 and peers with AS3.
const FIXTURE = [
    '# source:topology|BGP',
    '1|2|-1|bgp',
    ...Array.from({ length: 100 }, (_, i) => `1|${100 + i}|-1|bgp`),
    '2|10|-1|bgp',
    '2|11|-1|bgp',
    '2|3|0|bgp',
    '2|4|1|bgp',
].join('\n');

before(() => {
    const real = {
        existsSync: fs.existsSync, readdirSync: fs.readdirSync,
        statSync: fs.statSync, readFileSync: fs.readFileSync,
    };
    mock.method(fs, 'existsSync', (p, ...rest) => (p === AS_REL_DB_DIR ? true : real.existsSync(p, ...rest)));
    mock.method(fs, 'readdirSync', (p, ...rest) => (p === AS_REL_DB_DIR ? ['fixture.txt'] : real.readdirSync(p, ...rest)));
    mock.method(fs, 'statSync', (p, ...rest) => (p === FIXTURE_FILE ? { mtimeMs: 1 } : real.statSync(p, ...rest)));
    mock.method(fs, 'readFileSync', (p, ...rest) => (p === FIXTURE_FILE ? FIXTURE : real.readFileSync(p, ...rest)));
    reloadAsRelDatabase('test fixture');
});

after(() => mock.restoreAll());

describe('as-rel-db lookups', () => {
    it('customersOf lists transit downstreams', () => {
        assert.deepEqual(customersOf(2).sort((a, b) => a - b), [10, 11]);
        assert.deepEqual(customersOf('2').sort((a, b) => a - b), [10, 11]);
        assert.equal(customersOf(1).length, 101);
    });

    it('customersOf is empty for stubs and unknown ASNs', () => {
        assert.deepEqual(customersOf(10), []);
        assert.deepEqual(customersOf(99999), []);
    });

    it('keeps the existing lookups unchanged', () => {
        assert.deepEqual(providersOf(10), [2]);
        assert.deepEqual(providersOf(2), [1]);
        assert.deepEqual(peersOf(3), [2]);
        assert.deepEqual(peersOf(2), [3]);
        assert.equal(customerCountOf(1), 101);
        assert.equal(customerCountOf(2), 2);
    });

    it('skips sibling rows', () => {
        assert.deepEqual(customersOf(4), []);
        assert.equal(customersOf(2).includes(4), false);
        assert.equal(peersOf(2).includes(4), false);
    });

    it('derives Tier 1 as before: no providers and ≥ 100 customers', () => {
        assert.equal(isTier1(1), true);
        assert.equal(isTier1(2), false);
    });
});
