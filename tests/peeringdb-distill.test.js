// Tests for server/datasets/peeringdb-distill.js — the streaming dump scanner and the
// batched index writer, over synthetic dumps written to a temp dir: only the
// four wanted tables are read (contact tables never reach the index), rows
// and keys straddling the 1 MB read boundary, escaped quotes / brackets /
// UTF-8 inside strings, scalar values beside table keys, and the refusals
// (truncated dump, missing table, abort).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import { scanDumpRows, writeIndexFile, distillPeeringdbDump } from '../server/datasets/peeringdb-distill.js';
import { buildPeeringdbIndex, projectRow, readPeeringdbIndex, expandNet } from '../server/datasets/peeringdb-db.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'myip-pdb-distill-'));
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const CHUNK = 1 << 20;

// The four wanted tables (plus a scalar beside a table key).
const tables = () => ({
    net: {
        generated: 'string value at table level',
        data: [
            {
                id: 1, asn: 64500, name: 'Example "Net" {a} [b]', website: 'https://example.net',
                info_types: ['Content'], info_scope: 'Europe', info_traffic: '1-5Gbps',
                info_ratio: 'Balanced', policy_general: 'Selective', irr_as_set: 'AS-EX', status: 'ok',
                notes: 'escaped \\" quote and } brace',
            },
            { id: 2, asn: 64501, name: 'Second', policy_general: 'Open', status: 'ok' },
        ],
        meta: { note: 'ignored' },
    },
    ix: { data: [{ id: 10, name: 'IX "Quoted" São Paulo', city: 'São Paulo/SP', country: 'BR', status: 'ok' }], meta: {} },
    netixlan: {
        data: [
            { net_id: 1, ix_id: 10, asn: 64500, speed: 10000, is_rs_peer: true, operational: true, status: 'ok' },
            { net_id: 1, ix_id: 10, asn: 64500, speed: 10000, is_rs_peer: false, operational: true, status: 'ok' },
        ],
        meta: {},
    },
    netfac: { data: [{ net_id: 2, fac_id: 20, name: 'Fac [1]', city: 'Zürich', country: 'CH', status: 'ok' }], meta: {} },
});

// A dump as CAIDA serves it: other tables (incl. contacts) around the four.
const dumpText = ({ omit, padBefore = '' } = {}) => {
    const wanted = tables();
    if (omit) delete wanted[omit];
    const body = {
        version: '2',
        api: { data: [{ net: 'https://www.peeringdb.com/api/net' }], meta: {} },
        org: { data: [{ id: 1, name: 'Org', address1: 'Main Street 1', phone: '+1 555 0100' }], meta: {} },
        poc: { data: [{ net_id: 1, email: 'noc@example.net', phone: '+1 555 0199' }], meta: {} },
        ...wanted,
    };
    const text = JSON.stringify(body, null, 1);
    return padBefore ? `{"pad": {"data": [{"x": "${padBefore}"}], "meta": {}},${text.slice(1)}` : text;
};

const writeDump = (name, text) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, text);
    return file;
};

const collect = async (file, wanted = new Set(['net', 'ix', 'netixlan', 'netfac'])) => {
    const seen = [];
    await scanDumpRows(file, wanted, (table, row) => seen.push([table, row]));
    return seen;
};

describe('scanDumpRows', () => {
    it('yields the wanted tables\' rows only, parsed intact', async () => {
        const seen = await collect(writeDump('plain.json', dumpText()));
        assert.deepEqual(seen.map(([table]) => table), ['net', 'net', 'ix', 'netixlan', 'netixlan', 'netfac']);
        assert.equal(seen[0][1].name, 'Example "Net" {a} [b]');
        assert.equal(seen[0][1].notes, 'escaped \\" quote and } brace');
        assert.equal(seen[2][1].city, 'São Paulo/SP');
        assert.equal(seen.some(([, row]) => 'email' in row || 'address1' in row), false);
    });

    it('reassembles a row larger than the read buffer', async () => {
        const body = JSON.parse(dumpText());
        body.net.data[1].notes = 'x'.repeat(CHUNK + CHUNK / 2);
        const seen = await collect(writeDump('big-row.json', JSON.stringify(body)));
        assert.equal(seen[1][1].notes.length, CHUNK + CHUNK / 2);
        assert.equal(seen.length, 6);
    });

    it('reassembles a table key split across reads', async () => {
        // Pad so the "netixlan" key's quote sits 4 bytes before the 1 MB boundary.
        const unpadded = dumpText({ padBefore: 'p' });
        const keyAt = Buffer.byteLength(unpadded.slice(0, unpadded.indexOf('"netixlan"')));
        const text = dumpText({ padBefore: 'p'.repeat(1 + CHUNK - 4 - keyAt) });
        const keyByte = Buffer.byteLength(text.slice(0, text.indexOf('"netixlan"')));
        assert.ok(keyByte < CHUNK && keyByte + 10 > CHUNK, `key at ${keyByte}`);
        const seen = await collect(writeDump('split-key.json', text));
        assert.equal(seen.filter(([table]) => table === 'netixlan').length, 2);
    });

    it('rejects a truncated dump', async () => {
        const text = dumpText();
        await assert.rejects(collect(writeDump('cut.json', text.slice(0, text.length - 40))), /truncated/);
        await assert.rejects(collect(writeDump('empty.json', '')), /truncated/);
    });

    it('stops when the signal aborts', async () => {
        const file = writeDump('abort.json', dumpText());
        await assert.rejects(scanDumpRows(file, new Set(['net']), () => {}, { signal: AbortSignal.abort() }));
    });
});

describe('writeIndexFile', () => {
    it('writes the same bytes as JSON.stringify, across batches', async () => {
        const index = { v: 1, ix: { 1: ['A "x"', '', 'DE'] }, fac: {}, nets: {} };
        for (let asn = 1; asn <= 30000; asn++) index.nets[asn] = { policy: 'Open', irr: `AS-SET-${asn}`, ix: [[1, 1000, 1]] };
        const file = path.join(dir, 'written.json');
        await writeIndexFile(file, index);
        assert.equal(fs.readFileSync(file, 'utf8'), JSON.stringify(index));
    });
});

describe('distillPeeringdbDump', () => {
    it('turns a dump into a loadable index without contact data', async () => {
        const out = path.join(dir, 'index.json');
        const counts = await distillPeeringdbDump(writeDump('full.json', dumpText()), out);
        assert.deepEqual(counts, { rows: 6, networks: 2, exchanges: 1, facilities: 1 });

        const text = fs.readFileSync(out, 'utf8');
        assert.equal(text.includes('@'), false);
        assert.equal(text.includes('555'), false);
        assert.equal(text.includes('Main Street'), false);

        const raw = tables();
        const expected = buildPeeringdbIndex(Object.fromEntries(
            Object.entries(raw).map(([table, { data }]) => [table, data.map(projectRow[table])]),
        ));
        assert.equal(text, JSON.stringify(expected));

        const net = expandNet(readPeeringdbIndex(out), 64500);
        assert.deepEqual(net.ixs, [{ name: 'IX "Quoted" São Paulo', city: 'São Paulo/SP', country: 'BR', speed: 20000, rsPeer: true }]);
        assert.equal(net.ratio, 'Balanced');
    });

    it('refuses a dump missing one of the four tables', async () => {
        await assert.rejects(
            distillPeeringdbDump(writeDump('no-netfac.json', dumpText({ omit: 'netfac' })), path.join(dir, 'x.json')),
            /no netfac rows/,
        );
    });
});
