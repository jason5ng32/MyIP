// Tests for common/datasets.js — the dataset rows run through the engine
// (common/dataset-updater.js): the MaxMind row (two editions published
// together; the credential gate), the PeeringDB row (no decompression; a
// distill step; the Cloudflare-key gate), a decompressing CAIDA row, and the
// rows reading the pre-engine updaters' state. Every row is re-pointed at a temp dir
// and `fetch` is stubbed: no network, nothing written into the repo's
// dataset directories.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { after, afterEach, describe, it } from 'node:test';

import * as tar from 'tar';

import { datasets, findPeeringdbDump, maxmindIdentifier, hasMaxMindCredentials } from '../common/datasets.js';
import { updateDataset, isRowEnabled } from '../common/dataset-updater.js';
import { PEERINGDB_FILE, readPeeringdbIndex, expandNet } from '../common/peeringdb-db.js';
import { setUpstreamUserAgent } from '../common/fetch-with-timeout.js';

const realFetch = globalThis.fetch;
const ENV_KEYS = ['CLOUDFLARE_API_KEY', 'CLOUDFLARE_API', 'MAXMIND_ACCOUNT_ID', 'MAXMIND_LICENSE_KEY'];
const savedEnv = Object.fromEntries(ENV_KEYS.map((name) => [name, process.env[name]]));
afterEach(() => {
    globalThis.fetch = realFetch;
    for (const name of ENV_KEYS) {
        if (savedEnv[name] === undefined) delete process.env[name];
        else process.env[name] = savedEnv[name];
    }
});

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'myip-datasets-test-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

const row = (id) => datasets.find((dataset) => dataset.id === id);

// A row re-pointed at its own temp dir, with a recording reload.
const tempRow = (id, overrides = {}) => {
    const reloads = [];
    const dataset = {
        ...row(id),
        dir: fs.mkdtempSync(path.join(root, `${id}-`)),
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
        assert.equal(isRowEnabled(row('peeringdb')), false);
        assert.equal(isRowEnabled(row('as2org')), true);
        assert.equal(isRowEnabled(row('as-rel')), true);
        process.env.CLOUDFLARE_API_KEY = 'k';
        assert.equal(isRowEnabled(row('peeringdb')), true);
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

        const files = fs.readdirSync(dataset.dir).sort();
        assert.deepEqual(files, ['.dataset-state.json', PEERINGDB_FILE]);
        const published = fs.readFileSync(path.join(dataset.dir, PEERINGDB_FILE), 'utf8');
        assert.equal(published.includes('@'), false, 'no contact data');
        const record = expandNet(readPeeringdbIndex(path.join(dataset.dir, PEERINGDB_FILE)), 64500);
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
        assert.deepEqual(fs.readdirSync(dataset.dir), []);
        assert.deepEqual(reloads, []);
    });

    it('reports a dump that cannot be distilled', async () => {
        stubFetch({ ...peeringdbRoutes(), [`${BASE}2026/10/peeringdb_2_dump_2026_10_02.json`]: [200, DUMP.slice(0, 200)] });
        const { dataset } = tempRow('peeringdb', {
            findRemote: (opts) => findPeeringdbDump({ ...opts, now: new Date('2026-10-20T00:00:00Z') }),
        });
        await assert.rejects(updateDataset(dataset), /peeringdb distill failed: truncated/);
    });
});

describe('CAIDA rows', () => {
    it('a decompressing row downloads, decompresses and publishes the text snapshot', async () => {
        const text = '# as2org fixture\n1|20260101|Example|US|ARIN\n';
        stubFetch({ 'https://example.invalid/latest.txt.gz': [200, zlib.gzipSync(text)] });
        const { dataset, reloads } = tempRow('as2org', {
            findRemote: async () => ({ url: 'https://example.invalid/latest.txt.gz', identifier: 'v1' }),
            validate: async () => {},
        });
        assert.deepEqual(await updateDataset(dataset), { updated: true, identifier: 'v1' });
        assert.equal(fs.readFileSync(path.join(dataset.dir, dataset.files[0]), 'utf8'), text);
        assert.deepEqual(reloads, ['auto update']);
    });

    it('read the pre-engine CAIDA state, so an upgrade does not re-download', async () => {
        const requested = stubFetch({});
        const { dataset } = tempRow('as-rel', {
            findRemote: async () => ({ url: 'https://example.invalid/x.bz2', identifier: '20260901.as-rel2.txt.bz2' }),
        });
        fs.writeFileSync(path.join(dataset.dir, dataset.files[0]), 'snapshot');
        fs.writeFileSync(path.join(dataset.dir, '.caida-update-state.json'),
            JSON.stringify({ identifier: '20260901.as-rel2.txt.bz2', updatedAt: '2026-09-06T00:32:40.420Z' }));
        assert.deepEqual(await updateDataset(dataset), { updated: false, reason: 'not-modified' });
        assert.deepEqual(requested, []);
    });

    it('keep the pre-engine CAIDA_AUTO_UPDATE as their legacy schedule flag', () => {
        for (const id of ['as2org', 'as-rel', 'peeringdb']) {
            assert.equal(row(id).legacyAutoUpdateEnv, 'CAIDA_AUTO_UPDATE', id);
        }
    });
});

describe('maxmind row', () => {
    const MM = 'https://download.maxmind.com/geoip/databases/';

    // A tar.gz holding `<dated dir>/<file>`, as MaxMind ships it.
    const archiveOf = async (file, body) => {
        const dir = fs.mkdtempSync(path.join(root, 'mm-src-'));
        fs.mkdirSync(path.join(dir, 'GeoLite2_20261003'));
        fs.writeFileSync(path.join(dir, 'GeoLite2_20261003', file), body);
        const out = path.join(dir, 'archive.tar.gz');
        await tar.c({ gzip: true, cwd: dir, file: out }, ['GeoLite2_20261003']);
        return fs.readFileSync(out);
    };

    // Answers HEAD with each edition's Last-Modified, GET with its archive;
    // records the requests.
    const stubMaxMind = (archives, lastModified = { City: 'Fri, 02 Oct 2026 16:46:10 GMT', ASN: 'Sun, 04 Oct 2026 08:30:32 GMT' }) => {
        const requested = [];
        globalThis.fetch = async (url, init = {}) => {
            const edition = String(url).includes('GeoLite2-City') ? 'City' : 'ASN';
            requested.push(`${init.method || 'GET'} ${edition} ${init.headers?.Authorization ? 'auth' : 'anon'}`);
            if (init.method === 'HEAD') return new Response(null, { headers: { 'last-modified': lastModified[edition] } });
            return new Response(archives[edition]);
        };
        return requested;
    };

    it('is gated on both credentials', () => {
        delete process.env.MAXMIND_ACCOUNT_ID;
        process.env.MAXMIND_LICENSE_KEY = 'key';
        assert.equal(hasMaxMindCredentials(), false);
        assert.equal(isRowEnabled(row('maxmind')), false);
        process.env.MAXMIND_ACCOUNT_ID = 'id';
        assert.equal(isRowEnabled(row('maxmind')), true);
    });

    it('downloads both editions with auth, extracts and publishes them together', async () => {
        process.env.MAXMIND_ACCOUNT_ID = 'id';
        process.env.MAXMIND_LICENSE_KEY = 'key';
        const requested = stubMaxMind({
            City: await archiveOf('GeoLite2-City.mmdb', 'city-db'),
            ASN: await archiveOf('GeoLite2-ASN.mmdb', 'asn-db'),
        });
        const { dataset, reloads } = tempRow('maxmind', { validate: async () => {} }); // real mmdb check needs real files
        const result = await updateDataset(dataset);
        assert.equal(result.identifier, maxmindIdentifier(['Fri, 02 Oct 2026 16:46:10 GMT', 'Sun, 04 Oct 2026 08:30:32 GMT']));
        assert.equal(fs.readFileSync(path.join(dataset.dir, 'GeoLite2-City.mmdb'), 'utf8'), 'city-db');
        assert.equal(fs.readFileSync(path.join(dataset.dir, 'GeoLite2-ASN.mmdb'), 'utf8'), 'asn-db');
        assert.deepEqual(reloads, ['auto update']);
        assert.ok(requested.every((entry) => entry.endsWith('auth')), 'every request authenticated');
    });

    it('reads the pre-engine MaxMind state, so an upgrade does not re-download', async () => {
        process.env.MAXMIND_ACCOUNT_ID = 'id';
        process.env.MAXMIND_LICENSE_KEY = 'key';
        const requested = stubMaxMind({});
        const { dataset } = tempRow('maxmind');
        for (const file of dataset.files) fs.writeFileSync(path.join(dataset.dir, file), 'db');
        fs.writeFileSync(path.join(dataset.dir, '.maxmind-update-state.json'), JSON.stringify({
            'GeoLite2-City': { lastModified: 'Fri, 02 Oct 2026 16:46:10 GMT', updatedAt: '2026-10-03T03:55:12.165Z' },
            'GeoLite2-ASN': { lastModified: 'Sun, 04 Oct 2026 08:30:32 GMT', updatedAt: '2026-10-04T16:27:03.986Z' },
        }));
        assert.deepEqual(await updateDataset(dataset), { updated: false, reason: 'not-modified' });
        assert.deepEqual(requested, ['HEAD City auth', 'HEAD ASN auth'], 'only the version checks');
    });

    it('keeps MAXMIND_AUTO_UPDATE as its legacy schedule flag', () => {
        assert.equal(row('maxmind').legacyAutoUpdateEnv, 'MAXMIND_AUTO_UPDATE');
    });
});
