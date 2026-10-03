// Tests for common/peeringdb-db.js — the pure distill from projected dump
// rows to the per-ASN index (IX join, non-operational ports dropped, port
// speeds summed per IX, "Not Disclosed" as empty, multiple network types,
// no contact data), and reading an index file back into lookups.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it, mock } from 'node:test';

import {
    PEERINGDB_DB_DIR, PEERINGDB_FILE, PEERINGDB_INDEX_VERSION, cleanText, projectRow, buildPeeringdbIndex,
    readPeeringdbIndex, expandNet, reloadPeeringdbDatabase, isPeeringdbLoaded, lookupPeeringdb,
} from '../common/peeringdb-db.js';

// Raw rows as the dump has them (only a few of their many fields).
const RAW = {
    net: [
        {
            id: 1, asn: 64500, name: 'Example Net', website: 'https://www.example.net',
            info_types: ['Content', 'NSP'], info_scope: 'Global', info_traffic: '1-5Tbps',
            info_ratio: 'Not Disclosed', policy_general: 'Open', irr_as_set: 'AS-EXAMPLE',
            looking_glass: 'https://lg.example.net', policy_url: 'https://example.net/peering',
            route_server: 'rs.example.net', status: 'ok',
        },
        // Only undisclosed / empty fields and no presence → dropped.
        { id: 2, asn: 64501, name: 'Quiet Net', info_types: [], info_scope: 'Not Disclosed', info_ratio: '', website: '', status: 'ok' },
        // Facilities only; a non-http website is dropped.
        { id: 3, asn: 64502, name: 'Fac Net', website: 'javascript:alert(1)', info_types: ['Enterprise'], status: 'ok' },
        // An e-mail address typed as a website (URL userinfo) is dropped too.
        { id: 5, asn: 64504, name: 'Mail Net', website: 'http://noc.isp@mail.example', policy_general: 'Open', status: 'ok' },
        // Deleted record → ignored.
        { id: 4, asn: 64503, name: 'Gone', policy_general: 'Open', status: 'deleted' },
    ],
    ix: [
        { id: 10, name: 'DE-CIX Frankfurt', city: 'Frankfurt', country: 'DE', status: 'ok' },
        { id: 11, name: 'IX.br (PTT.br) São Paulo', city: 'São Paulo/SP', country: 'BR', status: 'ok' },
        { id: 12, name: 'Unused IX', city: 'Nowhere', country: 'US', status: 'ok' },
    ],
    netixlan: [
        // Two ports at DE-CIX: speeds sum, the RS flag sticks.
        { net_id: 1, ix_id: 10, asn: 64500, speed: 100000, is_rs_peer: false, operational: true, status: 'ok' },
        { net_id: 1, ix_id: 10, asn: 64500, speed: 100000, is_rs_peer: true, operational: true, status: 'ok' },
        { net_id: 1, ix_id: 11, asn: 64500, speed: 400000, is_rs_peer: false, operational: true, status: 'ok' },
        // Non-operational port and unknown IX are dropped.
        { net_id: 1, ix_id: 11, asn: 64500, speed: 100000, is_rs_peer: true, operational: false, status: 'ok' },
        { net_id: 1, ix_id: 99, asn: 64500, speed: 100000, is_rs_peer: false, operational: true, status: 'ok' },
    ],
    netfac: [
        { net_id: 1, fac_id: 20, name: 'Equinix FR5', city: 'Frankfurt', country: 'DE', status: 'ok' },
        { net_id: 1, fac_id: 21, name: 'Equinix SP4', city: 'São Paulo', country: 'BR', status: 'ok' },
        { net_id: 3, fac_id: 20, name: 'Equinix FR5', city: 'Frankfurt', country: 'DE', status: 'ok' },
        { net_id: 3, fac_id: 22, name: 'Old Site', city: 'Paris', country: 'FR', status: 'deleted' },
    ],
    // Contact data the projection must never carry.
    poc: [{ net_id: 1, email: 'noc@example.net', phone: '+1 555 0100' }],
};

const project = (raw) => Object.fromEntries(
    ['net', 'ix', 'netixlan', 'netfac'].map((table) => [table, raw[table].map(projectRow[table])]),
);

const index = buildPeeringdbIndex(project(RAW));

describe('cleanText', () => {
    it('treats empty and "Not Disclosed" as absent', () => {
        assert.equal(cleanText('  Open '), 'Open');
        assert.equal(cleanText('Not Disclosed'), undefined);
        assert.equal(cleanText('not disclosed'), undefined);
        assert.equal(cleanText(''), undefined);
        assert.equal(cleanText(null), undefined);
    });
});

describe('buildPeeringdbIndex', () => {
    it('keeps the profile fields, drops undisclosed and unused ones', () => {
        const net = index.nets[64500];
        assert.equal(index.v, PEERINGDB_INDEX_VERSION);
        assert.equal(net.website, 'https://www.example.net');
        assert.deepEqual(net.types, ['Content', 'NSP']);
        assert.equal(net.scope, 'Global');
        assert.equal(net.traffic, '1-5Tbps');
        assert.equal(net.policy, 'Open');
        assert.equal(net.irr, 'AS-EXAMPLE');
        assert.equal('ratio' in net, false);
        for (const dropped of ['looking_glass', 'policy_url', 'route_server', 'name']) assert.equal(dropped in net, false, dropped);
    });

    it('joins IX names from the ix table, sums ports, skips non-operational ones', () => {
        // Capacity first: São Paulo 400G, then DE-CIX 2 × 100G with RS.
        assert.deepEqual(index.nets[64500].ix, [[11, 400000, 0], [10, 200000, 1]]);
        assert.deepEqual(index.ix[10], ['DE-CIX Frankfurt', 'Frankfurt', 'DE']);
        assert.deepEqual(index.ix[11], ['IX.br (PTT.br) São Paulo', 'São Paulo/SP', 'BR']);
        assert.equal(index.ix[12], undefined, 'unreferenced IX not stored');
    });

    it('lists live facilities by country, then city', () => {
        assert.deepEqual(index.nets[64500].fac, [21, 20]);
        assert.deepEqual(index.nets[64502].fac, [20]);
        assert.equal(index.fac[22], undefined);
    });

    it('drops networks with nothing to show and deleted records', () => {
        assert.equal(index.nets[64501], undefined);
        assert.equal(index.nets[64503], undefined);
        assert.equal(index.nets[64502].website, undefined, 'non-http website dropped');
        assert.deepEqual(index.nets[64504], { policy: 'Open' }, 'userinfo website dropped');
    });

    it('carries no contact data', () => {
        const text = JSON.stringify(index);
        assert.equal(text.includes('@'), false);
        assert.equal(text.includes('555'), false);
    });
});

describe('readPeeringdbIndex / expandNet', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'myip-pdb-test-'));
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('round-trips an index file into the API record', () => {
        const file = path.join(dir, 'index.json');
        fs.writeFileSync(file, JSON.stringify(index));
        const tables = readPeeringdbIndex(file);
        assert.equal(tables.nets.size, 3);
        assert.deepEqual(expandNet(tables, 64500), {
            website: 'https://www.example.net',
            types: ['Content', 'NSP'],
            scope: 'Global',
            traffic: '1-5Tbps',
            ratio: null,
            policy: 'Open',
            irrAsSet: 'AS-EXAMPLE',
            ixs: [
                { name: 'IX.br (PTT.br) São Paulo', city: 'São Paulo/SP', country: 'BR', speed: 400000, rsPeer: false },
                { name: 'DE-CIX Frankfurt', city: 'Frankfurt', country: 'DE', speed: 200000, rsPeer: true },
            ],
            facilities: [
                { name: 'Equinix SP4', city: 'São Paulo', country: 'BR' },
                { name: 'Equinix FR5', city: 'Frankfurt', country: 'DE' },
            ],
        });
        assert.equal(expandNet(tables, '64502').types[0], 'Enterprise');
        assert.equal(expandNet(tables, 64501), null);
        assert.equal(expandNet(null, 64500), null);
    });

    it('rejects a file of another version', () => {
        const file = path.join(dir, 'old.json');
        fs.writeFileSync(file, JSON.stringify({ nets: {} }));
        assert.throws(() => readPeeringdbIndex(file), /unsupported/);
    });
});

// The module's own file, faked through `fs` (as tests/as-rel-db.test.js
// does), so the result holds whether or not this checkout has an index.
describe('module state', () => {
    const INDEX_PATH = path.join(PEERINGDB_DB_DIR, PEERINGDB_FILE);
    const real = { existsSync: fs.existsSync, readFileSync: fs.readFileSync };
    const serve = (content) => {
        mock.method(fs, 'existsSync', (p, ...rest) => (p === INDEX_PATH ? content !== null : real.existsSync(p, ...rest)));
        mock.method(fs, 'readFileSync', (p, ...rest) => (p === INDEX_PATH ? content : real.readFileSync(p, ...rest)));
        reloadPeeringdbDatabase('test');
    };
    after(() => {
        mock.restoreAll();
        reloadPeeringdbDatabase('test cleanup');
    });

    it('without an index file nothing is loaded and lookups are null', () => {
        serve(null);
        assert.equal(isPeeringdbLoaded(), false);
        assert.equal(lookupPeeringdb(64500), null);
    });

    it('serves records from the index file', () => {
        serve(JSON.stringify(index));
        assert.equal(isPeeringdbLoaded(), true);
        assert.equal(lookupPeeringdb(64500).policy, 'Open');
        assert.equal(lookupPeeringdb(64501), null);
    });

    it('a corrupt file keeps the previous index', () => {
        serve('{"v":1,"nets":');
        assert.equal(isPeeringdbLoaded(), true);
        assert.equal(lookupPeeringdb(64500).policy, 'Open');
        mock.restoreAll();
    });
});
