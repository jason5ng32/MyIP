// Tests for syncMaxMindDatabases (common/maxmind-updater.js) — the branches
// `pnpm fetch-offline-data` decides before any network call: the credential
// gate and the 24-hour freshness skip. Paths point at a temp dir.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, afterEach, describe, it } from 'node:test';

import { syncMaxMindDatabases } from '../common/maxmind-updater.js';

const saved = { id: process.env.MAXMIND_ACCOUNT_ID, key: process.env.MAXMIND_LICENSE_KEY };
const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
    for (const [name, value] of [['MAXMIND_ACCOUNT_ID', saved.id], ['MAXMIND_LICENSE_KEY', saved.key]]) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
    }
});

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'myip-maxmind-test-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

const HOUR = 60 * 60 * 1000;
const now = Date.parse('2026-10-05T12:00:00Z');

// A db dir holding both files (or not) and a state file with per-edition ages.
const makeDir = ({ files = true, ages = {} } = {}) => {
    const dbDir = fs.mkdtempSync(path.join(root, 'db-'));
    const dbPaths = {
        dbDir,
        cityDbPath: path.join(dbDir, 'GeoLite2-City.mmdb'),
        asnDbPath: path.join(dbDir, 'GeoLite2-ASN.mmdb'),
    };
    if (files) {
        fs.writeFileSync(dbPaths.cityDbPath, 'x');
        fs.writeFileSync(dbPaths.asnDbPath, 'x');
    }
    const state = Object.fromEntries(Object.entries(ages).map(([edition, age]) => [
        edition, { updatedAt: new Date(now - age).toISOString() },
    ]));
    fs.writeFileSync(path.join(dbDir, '.maxmind-update-state.json'), JSON.stringify(state));
    return dbPaths;
};

const noNetwork = () => {
    globalThis.fetch = async () => { throw new Error('unexpected network call'); };
};

describe('syncMaxMindDatabases', () => {
    it('without credentials reports what is on disk and fetches nothing', async () => {
        delete process.env.MAXMIND_ACCOUNT_ID;
        delete process.env.MAXMIND_LICENSE_KEY;
        noNetwork();
        assert.equal((await syncMaxMindDatabases({ now, dbPaths: makeDir() })).status, 'present');
        assert.equal((await syncMaxMindDatabases({ now, dbPaths: makeDir({ files: false }) })).status, 'missing-credentials');
    });

    it('skips when both editions were published within a day', async () => {
        process.env.MAXMIND_ACCOUNT_ID = 'id';
        process.env.MAXMIND_LICENSE_KEY = 'key';
        noNetwork();
        const dbPaths = makeDir({ ages: { 'GeoLite2-City': 3 * HOUR, 'GeoLite2-ASN': 5 * HOUR } });
        assert.equal((await syncMaxMindDatabases({ now, dbPaths })).status, 'fresh');
    });

    it('is not fresh when one edition is stale or unrecorded', async () => {
        process.env.MAXMIND_ACCOUNT_ID = 'id';
        process.env.MAXMIND_LICENSE_KEY = 'key';
        noNetwork();
        // Past the freshness check the update runs, inside the injected dir;
        // the stub proves it was reached.
        for (const ages of [{ 'GeoLite2-City': 3 * HOUR, 'GeoLite2-ASN': 30 * HOUR }, { 'GeoLite2-City': 3 * HOUR }]) {
            const dbPaths = makeDir({ ages });
            await assert.rejects(syncMaxMindDatabases({ now, dbPaths }), /unexpected network call/);
            assert.equal(fs.existsSync(path.join(dbPaths.dbDir, '.maxmind-update.lock')), false, 'lock released');
        }
    });
});
