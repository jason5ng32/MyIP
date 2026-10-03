// Tests for common/caida-updater.js — the PeeringDB row and the two
// capabilities it adds (no decompression; a distill step), the Cloudflare-key
// gate, and that a decompressing row still publishes as before. Every row is
// re-pointed at a temp dir and `fetch` is stubbed: no network, nothing
// written into the repo's dataset directories.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { after, afterEach, describe, it } from 'node:test';

import {
    datasets, updateDataset, bootstrapDataset, findPeeringdbDump, isDatasetEnabled,
} from '../common/caida-updater.js';
import { PEERINGDB_FILE, readPeeringdbIndex, expandNet } from '../common/peeringdb-db.js';
import { setUpstreamUserAgent } from '../common/fetch-with-timeout.js';

const realFetch = globalThis.fetch;
const savedEnv = { key: process.env.CLOUDFLARE_API_KEY, legacy: process.env.CLOUDFLARE_API };
afterEach(() => {
    globalThis.fetch = realFetch;
    for (const [name, value] of [['CLOUDFLARE_API_KEY', savedEnv.key], ['CLOUDFLARE_API', savedEnv.legacy]]) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
    }
});

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'myip-caida-test-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

const row = (id) => datasets.find((dataset) => dataset.id === id);

// A row re-pointed at its own temp dir, with a recording reload.
const tempRow = (id, overrides = {}) => {
    const reloads = [];
    const dataset = {
        ...row(id),
        dbDir: fs.mkdtempSync(path.join(root, `${id}-`)),
        reload: (reason) => reloads.push(reason),
        ...overrides,
    };
    return { dataset, reloads };
};

// Minimal PeeringDB dump with a contact table beside the four wanted ones.
const DUMP = JSON.stringify({
    poc: { data: [{ net_id: 1, email: 'noc@example.net' }], meta: {} },
    net: { data: [{ id: 1, asn: 64500, policy_general: 'Open', info_types: ['NSP'], status: 'ok' }], meta: {} },
    ix: { data: [{ id: 10, name: 'AMS-IX', city: 'Amsterdam', country: 'NL', status: 'ok' }], meta: {} },
    netixlan: { data: [{ asn: 64500, ix_id: 10, speed: 100000, is_rs_peer: true, operational: true, status: 'ok' }], meta: {} },
    netfac: { data: [{ net_id: 1, fac_id: 20, name: 'NIKHEF', city: 'Amsterdam', country: 'NL', status: 'ok' }], meta: {} },
});

const LISTING = `<a href="md5.md5">md5.md5</a>
<a href="peeringdb_2_dump_2026_10_01.json">peeringdb_2_dump_2026_10_01.json</a>
<a href="peeringdb_2_dump_2026_10_02.json">peeringdb_2_dump_2026_10_02.json</a>`;

const BASE = 'https://publicdata.caida.org/datasets/peeringdb/';

// fetch stub over a URL → [status, body] map; records what was asked.
const stubFetch = (routes) => {
    const requested = [];
    globalThis.fetch = async (url) => {
        requested.push(String(url));
        const [status, body] = routes[String(url)] || [404, 'not found'];
        return new Response(body, { status });
    };
    return requested;
};

const peeringdbRoutes = () => ({
    [`${BASE}2026/10/`]: [200, LISTING],
    [`${BASE}2026/10/peeringdb_2_dump_2026_10_02.json`]: [200, DUMP],
});

describe('findPeeringdbDump', () => {
    it('takes the newest dump of the current UTC month', async () => {
        stubFetch(peeringdbRoutes());
        const remote = await findPeeringdbDump({ now: new Date('2026-10-20T00:00:00Z') });
        assert.deepEqual(remote, {
            url: `${BASE}2026/10/peeringdb_2_dump_2026_10_02.json`,
            identifier: 'peeringdb_2_dump_2026_10_02.json',
        });
    });

    it('falls back to the previous month before the first dump lands', async () => {
        const requested = stubFetch({ ...peeringdbRoutes(), [`${BASE}2026/11/`]: [200, '<html>empty</html>'] });
        const remote = await findPeeringdbDump({ now: new Date('2026-11-01T03:00:00Z') });
        assert.equal(remote.identifier, 'peeringdb_2_dump_2026_10_02.json');
        assert.deepEqual(requested, [`${BASE}2026/11/`, `${BASE}2026/10/`]);
        // Missing month directory (404) also falls back, across a year boundary.
        stubFetch({ [`${BASE}2025/12/`]: [200, LISTING.replaceAll('2026_10', '2025_12')] });
        assert.equal((await findPeeringdbDump({ now: new Date('2026-01-01T00:00:00Z') })).identifier,
            'peeringdb_2_dump_2025_12_02.json');
    });

    it('lists through fetchUpstream: project User-Agent, caller abort still honoured', async () => {
        const seen = [];
        globalThis.fetch = async (url, init = {}) => {
            seen.push(init);
            return new Response(LISTING);
        };
        setUpstreamUserAgent('MyIP/test');
        try {
            const caller = new AbortController();
            await findPeeringdbDump({ signal: caller.signal, now: new Date('2026-10-20T00:00:00Z') });
            assert.equal(seen.length, 1);
            assert.equal(seen[0].headers['User-Agent'], 'MyIP/test');
            assert.ok(seen[0].signal instanceof AbortSignal, 'a timeout-bearing signal is attached');
            assert.equal(seen[0].signal.aborted, false);
            caller.abort();
            assert.equal(seen[0].signal.aborted, true, 'aborting the caller aborts the listing');
        } finally {
            setUpstreamUserAgent(null);
        }
    });

    it('fails on a server error or when neither month has a dump', async () => {
        stubFetch({ [`${BASE}2026/10/`]: [503, 'busy'] });
        await assert.rejects(findPeeringdbDump({ now: new Date('2026-10-20T00:00:00Z') }), /HTTP 503/);
        stubFetch({});
        await assert.rejects(findPeeringdbDump({ now: new Date('2026-10-20T00:00:00Z') }), /No PeeringDB dump/);
    });
});

describe('peeringdb row', () => {
    it('is gated on the Cloudflare key; the CAIDA rows are not', () => {
        delete process.env.CLOUDFLARE_API_KEY;
        delete process.env.CLOUDFLARE_API;
        assert.equal(isDatasetEnabled(row('peeringdb')), false);
        assert.equal(isDatasetEnabled(row('as2org')), true);
        assert.equal(isDatasetEnabled(row('as-rel')), true);
        process.env.CLOUDFLARE_API_KEY = 'k';
        assert.equal(isDatasetEnabled(row('peeringdb')), true);
    });

    it('downloads without decompressing, distills, publishes only the index', async () => {
        stubFetch(peeringdbRoutes());
        const { dataset, reloads } = tempRow('peeringdb', {
            findRemote: (opts) => findPeeringdbDump({ ...opts, now: new Date('2026-10-20T00:00:00Z') }),
            validate: async () => {}, // the real floor (20k networks) is tested below
        });
        const result = await updateDataset(dataset);
        assert.deepEqual(result, { updated: true, identifier: 'peeringdb_2_dump_2026_10_02.json' });
        assert.deepEqual(reloads, ['auto update']);

        const files = fs.readdirSync(dataset.dbDir).sort();
        assert.deepEqual(files, ['.caida-update-state.json', PEERINGDB_FILE]);
        const published = fs.readFileSync(path.join(dataset.dbDir, PEERINGDB_FILE), 'utf8');
        assert.equal(published.includes('@'), false, 'no contact data');
        const record = expandNet(readPeeringdbIndex(path.join(dataset.dbDir, PEERINGDB_FILE)), 64500);
        assert.deepEqual(record.ixs, [{ name: 'AMS-IX', city: 'Amsterdam', country: 'NL', speed: 100000, rsPeer: true }]);

        // Same dump again → nothing to do.
        assert.deepEqual(await updateDataset(dataset), { updated: false, reason: 'not-modified' });
    });

    it('refuses to publish an index below the network floor', async () => {
        stubFetch(peeringdbRoutes());
        const { dataset, reloads } = tempRow('peeringdb', {
            findRemote: (opts) => findPeeringdbDump({ ...opts, now: new Date('2026-10-20T00:00:00Z') }),
        });
        await assert.rejects(updateDataset(dataset), /only 1 networks/);
        assert.deepEqual(fs.readdirSync(dataset.dbDir), []);
        assert.deepEqual(reloads, []);
    });

    it('reports a dump that cannot be distilled', async () => {
        stubFetch({ ...peeringdbRoutes(), [`${BASE}2026/10/peeringdb_2_dump_2026_10_02.json`]: [200, DUMP.slice(0, 200)] });
        const { dataset } = tempRow('peeringdb', {
            findRemote: (opts) => findPeeringdbDump({ ...opts, now: new Date('2026-10-20T00:00:00Z') }),
        });
        await assert.rejects(updateDataset(dataset), /peeringdb distill phase failed: truncated/);
    });

    it('bootstrap skips a present index but not a directory holding only state files', async () => {
        const requested = stubFetch({});
        const { dataset } = tempRow('peeringdb');
        fs.writeFileSync(path.join(dataset.dbDir, '.caida-update-state.json'), '{}');
        assert.equal((await bootstrapDataset(dataset)).status, 'failed');
        assert.ok(requested.length > 0, 'a state file alone is not a snapshot');

        requested.length = 0;
        fs.writeFileSync(path.join(dataset.dbDir, PEERINGDB_FILE), '{}');
        assert.equal((await bootstrapDataset(dataset)).status, 'present');
        assert.deepEqual(requested, []);
    });
});

describe('decompressing rows', () => {
    it('still download, decompress and publish the text snapshot', async () => {
        const text = '# as2org fixture\n1|20260101|Example|US|ARIN\n';
        stubFetch({ 'https://example.invalid/latest.txt.gz': [200, zlib.gzipSync(text)] });
        const { dataset, reloads } = tempRow('as2org', {
            findRemote: async () => ({ url: 'https://example.invalid/latest.txt.gz', identifier: 'v1' }),
            validate: async () => {},
        });
        assert.deepEqual(await updateDataset(dataset), { updated: true, identifier: 'v1' });
        assert.equal(fs.readFileSync(path.join(dataset.dbDir, dataset.canonicalFile), 'utf8'), text);
        assert.deepEqual(reloads, ['auto update']);
    });
});
