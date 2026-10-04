// The offline datasets the backend serves, as rows for the engine in
// common/dataset-updater.js (row shape documented there). Each row holds
// only the dataset's own logic: where its newest remote version is, how to
// turn the download into the published files, a validator that refuses a
// truncated or corrupt download, and the reload of its in-memory copy.
//
//   maxmind   GeoLite2 City + ASN, published    common/maxmind-service.js
//             together; only with MaxMind credentials
//   as2org    CAIDA AS → org name               common/as-org-db.js
//   as-rel    CAIDA AS relationships            common/as-rel-db.js
//   peeringdb PeeringDB dump (CAIDA mirror),    common/peeringdb-db.js
//             distilled to a per-ASN index; only with the Cloudflare key,
//             as the ASN Profile is hidden without it
//
// Sources: https://dev.maxmind.com/geoip/geolite2-free-geolocation-data ·
// https://publicdata.caida.org/datasets/ (CAIDA AUA) · https://www.peeringdb.com

import fsp from 'fs/promises';
import path from 'path';
import * as tar from 'tar';
import maxmind from 'maxmind';
import logger from './logger.js';
import { fetchUpstream } from './fetch-with-timeout.js';
import { downloadToFile, decompressFile } from './dataset-updater.js';
import { AS_ORG_DB_DIR, AS_ORG_FILE, reloadAsOrgDatabase } from './as-org-db.js';
import { AS_REL_DB_DIR, AS_REL_FILE, reloadAsRelDatabase } from './as-rel-db.js';
import { PEERINGDB_DB_DIR, PEERINGDB_FILE, readPeeringdbIndex, reloadPeeringdbDatabase } from './peeringdb-db.js';
import { distillPeeringdbDump } from './peeringdb-distill.js';
import { hasRadarApiKey } from './cf-radar.js';
import { MAXMIND_DB_DIR, MAXMIND_CITY_DB, MAXMIND_ASN_DB, reloadMaxMindDatabases } from './maxmind-service.js';

// The pre-engine CAIDA updater's state: same { identifier, updatedAt } shape.
const CAIDA_LEGACY_STATE = { file: '.caida-update-state.json', toState: (json) => json };

// Download an archive and decompress it to the one file a row publishes.
const fetchCompressed = (file, format) => async ({ remote, tempDir, signal }) => {
    const archive = path.join(tempDir, 'archive');
    const staged = path.join(tempDir, file);
    await downloadToFile(remote.url, archive, { signal });
    await decompressFile(archive, staged, format);
    return { [file]: staged };
};

// ---------- validators ----------

// Healthy as2org resolves ~110k ASNs; <50k indicates truncation or schema change.
const validateAsOrg = async ({ [AS_ORG_FILE]: stagedPath }) => {
    const MIN_VALID = 50000;
    const text = await fsp.readFile(stagedPath, 'utf8');
    const orgs = new Map();
    const pending = [];
    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const parts = line.split('|');
        if (parts.length === 5 && parts[0] && parts[2]) {
            orgs.set(parts[0], parts[2]);
        } else if (parts.length === 6 && Number(parts[0]) && parts[3]) {
            pending.push(parts[3]);
        }
    }
    let resolved = 0;
    for (const orgId of pending) if (orgs.has(orgId)) resolved++;
    if (resolved < MIN_VALID) {
        throw new Error(`Staged as2org has only ${resolved} resolvable ASNs; refusing to publish`);
    }
};

// Healthy as-rel2 has ~400k p2c rows; <100k indicates truncation.
const validateAsRel = async ({ [AS_REL_FILE]: stagedPath }) => {
    const MIN_VALID = 100000;
    const text = await fsp.readFile(stagedPath, 'utf8');
    let p2cRows = 0;
    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const parts = line.split('|');
        if (parts.length >= 3 && parts[2] === '-1') p2cRows++;
    }
    if (p2cRows < MIN_VALID) {
        throw new Error(`Staged as-rel has only ${p2cRows} p2c rows; refusing to publish`);
    }
};

// Healthy index has ~33k networks; <20k indicates truncation or schema change.
const validatePeeringdb = async ({ [PEERINGDB_FILE]: stagedPath }) => {
    const MIN_VALID = 20000;
    const { nets } = readPeeringdbIndex(stagedPath);
    if (nets.size < MIN_VALID) {
        throw new Error(`Staged PeeringDB index has only ${nets.size} networks; refusing to publish`);
    }
};

// ---------- remote lookups ----------

// CAIDA mirrors the full PeeringDB dump daily (a day late) under YYYY/MM/.
// List the current UTC month, then the previous one for the days before the
// month's first dump lands; the newest filename wins. Exported for tests.
export const findPeeringdbDump = async ({ signal, now = new Date() } = {}) => {
    const base = 'https://publicdata.caida.org/datasets/peeringdb/';
    for (const back of [0, 1]) {
        const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
        const dir = `${base}${month.getUTCFullYear()}/${String(month.getUTCMonth() + 1).padStart(2, '0')}/`;
        const res = await fetchUpstream(dir, { signal });
        if (res.status === 404) continue;
        if (!res.ok) throw new Error(`Directory listing failed: HTTP ${res.status}`);
        const html = await res.text();
        const names = [...html.matchAll(/\bpeeringdb_2_dump_\d{4}_\d{2}_\d{2}\.json\b/g)].map((m) => m[0]);
        if (names.length === 0) continue;
        names.sort((a, b) => b.localeCompare(a));
        return { url: dir + names[0], identifier: names[0] };
    }
    throw new Error('No PeeringDB dump in the current or previous month listing');
};

// ---------- MaxMind ----------

// The two editions, published together: one version identifier covers both.
const MAXMIND_EDITIONS = [
    { editionId: 'GeoLite2-City', file: MAXMIND_CITY_DB },
    { editionId: 'GeoLite2-ASN', file: MAXMIND_ASN_DB },
];

export const hasMaxMindCredentials = () =>
    Boolean(process.env.MAXMIND_ACCOUNT_ID && process.env.MAXMIND_LICENSE_KEY);

const maxmindUrl = (editionId) => `https://download.maxmind.com/geoip/databases/${editionId}/download?suffix=tar.gz`;
const maxmindAuth = () => ({
    Authorization: `Basic ${Buffer.from(`${process.env.MAXMIND_ACCOUNT_ID}:${process.env.MAXMIND_LICENSE_KEY}`).toString('base64')}`,
});

// Last-Modified of each edition, joined: either edition changing is a new
// version. Exported for tests (and the legacy-state mapping below).
export const maxmindIdentifier = (lastModifieds) => lastModifieds.map((value) => value || '?').join(' | ');

// The pre-engine MaxMind updater kept { [editionId]: { lastModified, updatedAt } }.
const MAXMIND_LEGACY_STATE = {
    file: '.maxmind-update-state.json',
    toState: (json) => ({
        identifier: maxmindIdentifier(MAXMIND_EDITIONS.map(({ editionId }) => json[editionId]?.lastModified)),
        updatedAt: json['GeoLite2-City']?.updatedAt,
    }),
};

// The archive nests the .mmdb in a dated directory; find it by name.
const findFile = async (dir, name) => {
    for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isFile() && entry.name === name) return entryPath;
        if (entry.isDirectory()) {
            const found = await findFile(entryPath, name);
            if (found) return found;
        }
    }
    return null;
};

// ---------- rows ----------

// Exported for tests (rows are re-pointed at a temp dir there).
export const datasets = [
    {
        id: 'maxmind',
        dir: MAXMIND_DB_DIR,
        files: MAXMIND_EDITIONS.map(({ file }) => file),
        enabled: hasMaxMindCredentials,
        legacyState: MAXMIND_LEGACY_STATE,
        legacyAutoUpdateEnv: 'MAXMIND_AUTO_UPDATE',
        findRemote: async ({ signal } = {}) => {
            const lastModifieds = [];
            for (const { editionId } of MAXMIND_EDITIONS) {
                const res = await fetchUpstream(maxmindUrl(editionId), { method: 'HEAD', headers: maxmindAuth(), signal });
                if (!res.ok) throw new Error(`Failed to check ${editionId}: HTTP ${res.status}`);
                lastModifieds.push(res.headers.get('last-modified'));
            }
            return { identifier: maxmindIdentifier(lastModifieds) };
        },
        fetch: async ({ tempDir, signal }) => {
            const staged = {};
            for (const { editionId, file } of MAXMIND_EDITIONS) {
                const archive = path.join(tempDir, `${editionId}.tar.gz`);
                const extractDir = path.join(tempDir, editionId);
                await fsp.mkdir(extractDir);
                await downloadToFile(maxmindUrl(editionId), archive, { signal, headers: maxmindAuth() });
                await tar.x({ file: archive, cwd: extractDir });
                staged[file] = await findFile(extractDir, file);
                if (!staged[file]) throw new Error(`${editionId} archive did not contain ${file}`);
            }
            return staged;
        },
        // Both must open as MaxMind databases.
        validate: async (staged) => {
            await Promise.all(MAXMIND_EDITIONS.map(({ file }) => maxmind.open(staged[file])));
        },
        reload: reloadMaxMindDatabases,
    },
    {
        id: 'as2org',
        dir: AS_ORG_DB_DIR,
        files: [AS_ORG_FILE],
        legacyState: CAIDA_LEGACY_STATE,
        legacyAutoUpdateEnv: 'CAIDA_AUTO_UPDATE',
        // Stable 'latest' symlink server-side → HEAD + Last-Modified is enough.
        findRemote: async ({ signal } = {}) => {
            const url = 'https://publicdata.caida.org/datasets/as-organizations/latest.as-org2info.txt.gz';
            const res = await fetchUpstream(url, { method: 'HEAD', signal });
            if (!res.ok) throw new Error(`HEAD failed: HTTP ${res.status}`);
            return { url, identifier: res.headers.get('last-modified') };
        },
        fetch: fetchCompressed(AS_ORG_FILE, 'gzip'),
        validate: validateAsOrg,
        reload: reloadAsOrgDatabase,
    },
    {
        id: 'as-rel',
        dir: AS_REL_DB_DIR,
        files: [AS_REL_FILE],
        legacyState: CAIDA_LEGACY_STATE,
        legacyAutoUpdateEnv: 'CAIDA_AUTO_UPDATE',
        // No 'latest' symlink — scrape the directory listing; YYYYMMDD
        // filenames sort chronologically, the newest wins.
        findRemote: async ({ signal } = {}) => {
            const dir = 'https://publicdata.caida.org/datasets/as-relationships/serial-2/';
            const res = await fetchUpstream(dir, { signal });
            if (!res.ok) throw new Error(`Directory listing failed: HTTP ${res.status}`);
            const html = await res.text();
            const matches = [...html.matchAll(/\b(\d{8})\.as-rel2\.txt\.bz2\b/g)];
            if (matches.length === 0) throw new Error('No as-rel2.txt.bz2 found in listing');
            matches.sort((a, b) => b[1].localeCompare(a[1]));
            const filename = matches[0][0];
            return { url: dir + filename, identifier: filename };
        },
        fetch: fetchCompressed(AS_REL_FILE, 'bzip2'),
        validate: validateAsRel,
        reload: reloadAsRelDatabase,
    },
    {
        id: 'peeringdb',
        dir: PEERINGDB_DB_DIR,
        files: [PEERINGDB_FILE],
        enabled: hasRadarApiKey,
        legacyState: CAIDA_LEGACY_STATE,
        legacyAutoUpdateEnv: 'CAIDA_AUTO_UPDATE',
        findRemote: findPeeringdbDump,
        // ~116 MB raw dump → ~6 MB index; only the index is published.
        fetch: async ({ remote, tempDir, signal }) => {
            const raw = path.join(tempDir, 'dump.json');
            const staged = path.join(tempDir, PEERINGDB_FILE);
            await downloadToFile(remote.url, raw, { signal });
            try {
                const counts = await distillPeeringdbDump(raw, staged, { signal });
                logger.info({ dataset: 'peeringdb', ...counts }, 'PeeringDB dump distilled');
            } catch (error) {
                throw new Error(`peeringdb distill failed: ${error.message}`);
            } finally {
                await fsp.rm(raw, { force: true });
            }
            return { [PEERINGDB_FILE]: staged };
        },
        validate: validatePeeringdb,
        reload: reloadPeeringdbDatabase,
    },
];
