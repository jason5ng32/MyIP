// Vendor-scoped CAIDA auto-updater. Each dataset is a row in `datasets`
// below; the orchestration (lock / state / atomic publish / validation /
// reload) is shared. Mirrors common/maxmind-updater.js's editions-array
// pattern.
//
// Registered datasets:
//   - as2org   (AS → org-name mapping)    common/as-org-db
//   - as-rel   (AS relationships, p2c)    common/as-rel-db
//
// Both share CAIDA_AUTO_UPDATE=true to gate the periodic scheduler
// (off by default); bootstrap always runs so a fresh checkout works.

import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import logger from './logger.js';
import { createDecompressor } from './decompress.js';
import { AS_ORG_DB_DIR, AS_ORG_FILE, reloadAsOrgDatabase } from './as-org-db.js';
import { AS_REL_DB_DIR, AS_REL_FILE, reloadAsRelDatabase } from './as-rel-db.js';

const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const INITIAL_UPDATE_DELAY_MS = 60 * 1000;
const LOCK_STALE_MS = 2 * 60 * 60 * 1000;
const BOOTSTRAP_TIMEOUT_MS = 2 * 60 * 1000;
const STATE_FILE = '.caida-update-state.json';
const LOCK_FILE = '.caida-update.lock';

const datasets = [
    {
        id: 'as2org',
        dbDir: AS_ORG_DB_DIR,
        canonicalFile: AS_ORG_FILE,
        archiveExt: '.txt.gz',
        decompress: 'gzip',
        // Stable 'latest' symlink server-side → HEAD + Last-Modified is enough.
        findRemote: async ({ signal } = {}) => {
            const url = 'https://publicdata.caida.org/datasets/as-organizations/latest.as-org2info.txt.gz';
            const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal });
            if (!res.ok) throw new Error(`HEAD failed: HTTP ${res.status}`);
            return { url, identifier: res.headers.get('last-modified') };
        },
        validate: validateAsOrg,
        reload: reloadAsOrgDatabase,
    },
    {
        id: 'as-rel',
        dbDir: AS_REL_DB_DIR,
        canonicalFile: AS_REL_FILE,
        archiveExt: '.txt.bz2',
        decompress: 'bzip2',
        // No 'latest' symlink — scrape directory listing, lex-sort YYYYMMDD
        // filenames (= chrono), take the newest.
        findRemote: async ({ signal } = {}) => {
            const dir = 'https://publicdata.caida.org/datasets/as-relationships/serial-2/';
            const res = await fetch(dir, { signal });
            if (!res.ok) throw new Error(`Directory listing failed: HTTP ${res.status}`);
            const html = await res.text();
            const matches = [...html.matchAll(/\b(\d{8})\.as-rel2\.txt\.bz2\b/g)];
            if (matches.length === 0) throw new Error('No as-rel2.txt.bz2 found in listing');
            matches.sort((a, b) => b[1].localeCompare(a[1]));
            const filename = matches[0][0];
            return { url: dir + filename, identifier: filename };
        },
        validate: validateAsRel,
        reload: reloadAsRelDatabase,
    },
];

let schedulerStarted = false;
const updateInProgress = new Set();

// ---------- Public API ----------

/**
 * Download any missing CAIDA snapshots at boot. Always runs regardless of
 * CAIDA_AUTO_UPDATE — a missing snapshot at boot means the operator wants
 * one. Each dataset is independent; one failing doesn't abort others.
 * Never throws.
 */
export async function bootstrapCaidaIfMissing() {
    for (const dataset of datasets) {
        try {
            await bootstrapDataset(dataset);
        } catch (error) {
            logger.warn({ err: error, dataset: dataset.id }, '⚠️  CAIDA bootstrap failed');
        }
    }
}

/** Start the periodic updater. Opt-in via CAIDA_AUTO_UPDATE=true. */
export function startCaidaAutoUpdate() {
    if (schedulerStarted) return;
    schedulerStarted = true;
    if (!isAutoUpdateEnabled()) return;

    const run = () => {
        runAllUpdates().catch(error => {
            logger.error({ err: error }, 'CAIDA auto update tick failed');
        });
    };
    setTimeout(run, INITIAL_UPDATE_DELAY_MS).unref?.();
    setInterval(run, UPDATE_INTERVAL_MS).unref?.();

    const nextRunAt = new Date(Date.now() + INITIAL_UPDATE_DELAY_MS);
    logger.info(`🗓️  CAIDA auto update plan: next check at ${nextRunAt.toLocaleString('en-US', { hour12: false })}, then every 24 hours (${datasets.length} datasets)`);
}

// ---------- Orchestration ----------

async function runAllUpdates() {
    for (const dataset of datasets) {
        try {
            await updateDataset(dataset);
        } catch (error) {
            logger.error({ err: error, dataset: dataset.id }, 'CAIDA update failed');
        }
    }
}

async function bootstrapDataset(dataset) {
    await fsp.mkdir(dataset.dbDir, { recursive: true });
    await clearOrphanedLock(dataset);

    if (snapshotExists(dataset)) return { status: 'present' };

    const timeoutMinutes = BOOTSTRAP_TIMEOUT_MS / 60000;
    logger.warn(`📥 CAIDA ${dataset.id} snapshot missing; attempting initial download (timeout ${timeoutMinutes} min)...`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('bootstrap timed out')), BOOTSTRAP_TIMEOUT_MS);
    timer.unref?.();

    try {
        const result = await updateDataset(dataset, {
            signal: controller.signal,
            reloadReason: 'bootstrap',
        });
        if (result.updated) {
            logger.warn(`✅ CAIDA ${dataset.id} snapshot downloaded and ready`);
            return { status: 'downloaded' };
        }
        logger.warn(`⚠️  CAIDA ${dataset.id} bootstrap did not publish (${result.reason}).`);
        return { status: 'no-op', reason: result.reason };
    } catch (error) {
        const reason = controller.signal.aborted
            ? `download did not complete within ${timeoutMinutes} min`
            : error.message;
        logger.warn(`⚠️  CAIDA ${dataset.id} initial download failed: ${reason}`);
        return { status: 'failed', error };
    } finally {
        clearTimeout(timer);
    }
}

async function updateDataset(dataset, { signal, reloadReason = 'auto update' } = {}) {
    if (updateInProgress.has(dataset.id)) {
        return { updated: false, reason: 'already-running' };
    }
    updateInProgress.add(dataset.id);

    await fsp.mkdir(dataset.dbDir, { recursive: true });

    const lock = await acquireUpdateLock(dataset);
    if (!lock) {
        updateInProgress.delete(dataset.id);
        return { updated: false, reason: 'locked' };
    }

    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), `myip-caida-${dataset.id}-`));

    try {
        const result = await downloadAndPublish(dataset, tempDir, { signal });
        if (result.updated && dataset.reload) {
            dataset.reload(reloadReason);
        }
        return result;
    } finally {
        updateInProgress.delete(dataset.id);
        await fsp.rm(tempDir, { recursive: true, force: true });
        await lock.release();
    }
}

async function downloadAndPublish(dataset, tempDir, { signal } = {}) {
    const state = await readUpdateState(dataset);
    const remote = await dataset.findRemote({ signal });
    const targetPath = path.join(dataset.dbDir, dataset.canonicalFile);

    if (fs.existsSync(targetPath) && state.identifier && state.identifier === remote.identifier) {
        return { updated: false, reason: 'not-modified' };
    }

    const stagedPath = await downloadAndDecompress(dataset, remote.url, tempDir, { signal });
    await dataset.validate(stagedPath);
    await publishFile(stagedPath, targetPath);

    await writeUpdateState(dataset, {
        identifier: remote.identifier,
        updatedAt: new Date().toISOString(),
    });

    logger.info({ dataset: dataset.id, identifier: remote.identifier }, 'CAIDA snapshot updated');
    return { updated: true, identifier: remote.identifier };
}

// Stream archive to disk, then decompress to staged .txt. Split so errors
// clearly identify which phase failed (network vs decompression).
async function downloadAndDecompress(dataset, url, tempDir, { signal } = {}) {
    const archivePath = path.join(tempDir, `archive${dataset.archiveExt}`);
    const stagedPath = path.join(tempDir, dataset.canonicalFile);

    const response = await fetch(url, { redirect: 'follow', signal });
    if (!response.ok || !response.body) {
        throw new Error(`Failed to download ${dataset.id}: HTTP ${response.status}`);
    }
    try {
        await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(archivePath), { signal });
    } catch (error) {
        throw new Error(`${dataset.id} download phase failed: ${error.message}`);
    }

    try {
        await pipeline(
            fs.createReadStream(archivePath),
            createDecompressor(dataset.decompress),
            fs.createWriteStream(stagedPath),
        );
    } catch (error) {
        throw new Error(`${dataset.id} ${dataset.decompress} decompression phase failed: ${error.message}`);
    }

    return stagedPath;
}

// ---------- Validators (per-dataset, refuse partial / corrupt downloads) ----------

// Healthy as2org resolves ~110k ASNs; <50k indicates truncation or schema change.
async function validateAsOrg(stagedPath) {
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
}

// Healthy as-rel2 has ~400k p2c rows; <100k indicates truncation.
async function validateAsRel(stagedPath) {
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
}

// ---------- Generic helpers ----------

async function publishFile(stagedPath, targetPath) {
    const nextPath = `${targetPath}.next`;
    const backupPath = `${targetPath}.bak`;
    await fsp.copyFile(stagedPath, nextPath);
    await fsp.copyFile(targetPath, backupPath).catch(error => {
        if (error.code !== 'ENOENT') throw error;
    });
    try {
        await fsp.rename(nextPath, targetPath);
    } catch (error) {
        await fsp.copyFile(backupPath, targetPath).catch(() => {});
        throw error;
    } finally {
        await Promise.all([
            fsp.rm(nextPath, { force: true }),
            fsp.rm(backupPath, { force: true }),
        ]);
    }
}

function isAutoUpdateEnabled() {
    return process.env.CAIDA_AUTO_UPDATE === 'true';
}

function snapshotExists(dataset) {
    if (!fs.existsSync(dataset.dbDir)) return false;
    return fs.readdirSync(dataset.dbDir).some(f => f.endsWith('.txt'));
}

// At boot, any pre-existing lock is necessarily from a previous crashed run
// (we just started, no in-process updater can hold it). Clear it so a dead
// Ctrl+C doesn't block restart for LOCK_STALE_MS.
async function clearOrphanedLock(dataset) {
    const lockPath = path.join(dataset.dbDir, LOCK_FILE);
    if (fs.existsSync(lockPath)) {
        await fsp.rm(lockPath, { force: true });
        logger.warn(`🧹 Cleared orphaned CAIDA ${dataset.id} lock from previous boot`);
    }
}

async function readUpdateState(dataset) {
    try {
        const content = await fsp.readFile(path.join(dataset.dbDir, STATE_FILE), 'utf8');
        return JSON.parse(content);
    } catch (error) {
        if (error.code === 'ENOENT') return {};
        throw error;
    }
}

async function writeUpdateState(dataset, state) {
    await fsp.writeFile(
        path.join(dataset.dbDir, STATE_FILE),
        `${JSON.stringify(state, null, 2)}\n`,
        'utf8',
    );
}

async function acquireUpdateLock(dataset) {
    const lockPath = path.join(dataset.dbDir, LOCK_FILE);
    try {
        const handle = await fsp.open(lockPath, 'wx');
        await handle.writeFile(JSON.stringify({
            pid: process.pid,
            dataset: dataset.id,
            startedAt: new Date().toISOString(),
        }));
        return {
            release: async () => {
                await handle.close();
                await fsp.rm(lockPath, { force: true });
            },
        };
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const stat = await fsp.stat(lockPath).catch(() => null);
        if (stat && Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
            await fsp.rm(lockPath, { force: true });
            return acquireUpdateLock(dataset);
        }
        logger.info(`CAIDA ${dataset.id} update skipped: another process is updating`);
        return null;
    }
}
