import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import * as tar from 'tar';
import maxmind from 'maxmind';
import {
    getMaxMindDbPaths,
    MAXMIND_ASN_DB,
    MAXMIND_CITY_DB,
} from './maxmind-service.js';

const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const INITIAL_UPDATE_DELAY_MS = 60 * 1000;
const LOCK_STALE_MS = 2 * 60 * 60 * 1000;
const STATE_FILE = '.maxmind-update-state.json';
const LOCK_FILE = '.maxmind-update.lock';
const MAXMIND_UPDATE_ENV_KEYS = [
    'MAXMIND_ACCOUNT_ID',
    'MAXMIND_LICENSE_KEY',
    'MAXMIND_AUTO_UPDATE',
];

const editions = [
    {
        editionId: 'GeoLite2-City',
        fileName: MAXMIND_CITY_DB,
    },
    {
        editionId: 'GeoLite2-ASN',
        fileName: MAXMIND_ASN_DB,
    },
];

let schedulerStarted = false;
let updateInProgress = false;

/**
 * Start the periodic MaxMind updater when credentials and opt-in env vars are present.
 */
export function startMaxMindAutoUpdate({ reload } = {}) {
    if (schedulerStarted) {
        return;
    }

    schedulerStarted = true;

    if (!hasAnyUpdateEnvironment()) {
        return;
    }

    if (!isAutoUpdateEnabled()) {
        console.log('MaxMind auto update plan: disabled');
        return;
    }

    if (!hasDownloadCredentials()) {
        console.log('MaxMind auto update skipped: MAXMIND_ACCOUNT_ID or MAXMIND_LICENSE_KEY is missing');
        return;
    }

    // Run one update cycle and keep the scheduler alive if that cycle fails.
    const run = () => {
        updateMaxMindDatabases({ reload }).catch(error => {
            console.error('MaxMind auto update failed:', error.message);
        });
    };

    const initialTimer = setTimeout(run, INITIAL_UPDATE_DELAY_MS);
    initialTimer.unref?.();

    const intervalTimer = setInterval(run, UPDATE_INTERVAL_MS);
    intervalTimer.unref?.();

    logUpdatePlan();
}

/**
 * Run one locked update cycle and reload readers only after a successful publish.
 */
export async function updateMaxMindDatabases({ reload } = {}) {
    if (updateInProgress) {
        return { updated: false, reason: 'already-running' };
    }

    updateInProgress = true;

    const { dbDir } = getMaxMindDbPaths();
    await fsp.mkdir(dbDir, { recursive: true });

    const lock = await acquireUpdateLock(dbDir);
    if (!lock) {
        updateInProgress = false;
        return { updated: false, reason: 'locked' };
    }

    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'myip-maxmind-'));

    try {
        const result = await downloadAndReplaceDatabases(dbDir, tempDir);

        if (result.updated && reload) {
            await reload('auto update');
        }

        return result;
    } finally {
        updateInProgress = false;
        await fsp.rm(tempDir, { recursive: true, force: true });
        await lock.release();
    }
}

/**
 * Check the explicit opt-in flag for automatic MaxMind updates.
 */
function isAutoUpdateEnabled() {
    return process.env.MAXMIND_AUTO_UPDATE === 'true';
}

/**
 * Check whether both MaxMind download credential variables are configured.
 */
function hasDownloadCredentials() {
    return Boolean(process.env.MAXMIND_ACCOUNT_ID && process.env.MAXMIND_LICENSE_KEY);
}

/**
 * Check whether the deployment has any MaxMind update-related environment config.
 */
function hasAnyUpdateEnvironment() {
    return MAXMIND_UPDATE_ENV_KEYS.some(key => Object.hasOwn(process.env, key));
}

/**
 * Print the next MaxMind update check and repeat interval.
 */
function logUpdatePlan() {
    const nextRunAt = new Date(Date.now() + INITIAL_UPDATE_DELAY_MS);
    console.log(`MaxMind auto update plan: next check at ${formatScheduleTime(nextRunAt)}, then every ${formatDuration(UPDATE_INTERVAL_MS)}`);
}

/**
 * Format scheduler timestamps for startup logs.
 */
function formatScheduleTime(date) {
    return date.toLocaleString('en-US', { hour12: false });
}

/**
 * Format millisecond durations into compact hour or minute text.
 */
function formatDuration(milliseconds) {
    const hours = milliseconds / (60 * 60 * 1000);
    if (Number.isInteger(hours)) {
        return `${hours} hour${hours === 1 ? '' : 's'}`;
    }

    const minutes = milliseconds / (60 * 1000);
    if (Number.isInteger(minutes)) {
        return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    }

    return `${milliseconds} ms`;
}

/**
 * Download all required newer editions, validate them, then publish them together.
 */
async function downloadAndReplaceDatabases(dbDir, tempDir) {
    const state = await readUpdateState(dbDir);
    const plannedUpdates = [];

    for (const edition of editions) {
        const remoteInfo = await getRemoteInfo(edition);
        const targetPath = path.join(dbDir, edition.fileName);

        if (!shouldDownloadDatabase(targetPath, state, edition.editionId, remoteInfo.lastModified)) {
            continue;
        }

        const downloadedPath = await downloadAndExtractDatabase(edition, tempDir);
        plannedUpdates.push({
            ...edition,
            lastModified: remoteInfo.lastModified,
            sourcePath: downloadedPath,
            targetPath,
        });
    }

    if (plannedUpdates.length === 0) {
        return { updated: false, reason: 'not-modified' };
    }

    await validatePlannedDatabases(dbDir, plannedUpdates);

    await publishDatabases(plannedUpdates);

    for (const update of plannedUpdates) {
        state[update.editionId] = {
            lastModified: update.lastModified,
            updatedAt: new Date().toISOString(),
        };
    }

    await writeUpdateState(dbDir, state);
    console.log(`MaxMind databases updated: ${plannedUpdates.map(update => update.editionId).join(', ')}`);

    return {
        updated: true,
        editions: plannedUpdates.map(update => update.editionId),
    };
}

/**
 * Fetch remote metadata for a MaxMind edition without downloading the archive.
 */
async function getRemoteInfo(edition) {
    const response = await fetch(getDownloadUrl(edition.editionId), {
        method: 'HEAD',
        headers: getAuthHeaders(),
        redirect: 'follow',
    });

    if (!response.ok) {
        throw new Error(`Failed to check ${edition.editionId}: HTTP ${response.status}`);
    }

    return {
        lastModified: response.headers.get('last-modified'),
    };
}

/**
 * Decide whether the local database should be refreshed from MaxMind.
 */
function shouldDownloadDatabase(targetPath, state, editionId, lastModified) {
    if (!fs.existsSync(targetPath)) {
        return true;
    }

    if (!lastModified) {
        return true;
    }

    const lastRemoteUpdate = Date.parse(lastModified);
    if (Number.isNaN(lastRemoteUpdate)) {
        return true;
    }

    if (!state[editionId]?.lastModified) {
        return true;
    }

    const recordedUpdate = Date.parse(state[editionId].lastModified);
    return Number.isNaN(recordedUpdate) || lastRemoteUpdate > recordedUpdate;
}

/**
 * Download a MaxMind archive, extract it, and return the matching .mmdb file path.
 */
async function downloadAndExtractDatabase(edition, tempDir) {
    const editionDir = path.join(tempDir, edition.editionId);
    const archivePath = path.join(tempDir, `${edition.editionId}.tar.gz`);

    await fsp.mkdir(editionDir, { recursive: true });

    const response = await fetch(getDownloadUrl(edition.editionId), {
        headers: getAuthHeaders(),
        redirect: 'follow',
    });

    if (!response.ok || !response.body) {
        throw new Error(`Failed to download ${edition.editionId}: HTTP ${response.status}`);
    }

    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(archivePath));
    await tar.x({ file: archivePath, cwd: editionDir });

    const mmdbPath = await findExtractedDatabase(editionDir, edition.fileName);
    if (!mmdbPath) {
        throw new Error(`Downloaded ${edition.editionId} archive did not contain ${edition.fileName}`);
    }

    return mmdbPath;
}

/**
 * Open the staged database set to ensure both City and ASN files are valid.
 */
async function validatePlannedDatabases(dbDir, plannedUpdates) {
    const stagedPaths = new Map(plannedUpdates.map(update => [update.fileName, update.sourcePath]));

    const cityPath = stagedPaths.get(MAXMIND_CITY_DB) || path.join(dbDir, MAXMIND_CITY_DB);
    const asnPath = stagedPaths.get(MAXMIND_ASN_DB) || path.join(dbDir, MAXMIND_ASN_DB);

    await Promise.all([
        maxmind.open(cityPath),
        maxmind.open(asnPath),
    ]);
}

/**
 * Atomically publish prepared databases while keeping backups for rollback.
 */
async function publishDatabases(plannedUpdates) {
    const preparedUpdates = plannedUpdates.map(update => ({
        ...update,
        nextPath: `${update.targetPath}.next`,
        backupPath: `${update.targetPath}.bak`,
    }));

    for (const update of preparedUpdates) {
        await fsp.copyFile(update.sourcePath, update.nextPath);
        await fsp.copyFile(update.targetPath, update.backupPath).catch(error => {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        });
    }

    try {
        for (const update of preparedUpdates) {
            await fsp.rename(update.nextPath, update.targetPath);
        }
    } catch (error) {
        for (const update of preparedUpdates) {
            await fsp.copyFile(update.backupPath, update.targetPath).catch(() => {});
        }
        throw error;
    } finally {
        for (const update of preparedUpdates) {
            await Promise.all([
                fsp.rm(update.nextPath, { force: true }),
                fsp.rm(update.backupPath, { force: true }),
            ]);
        }
    }
}

/**
 * Recursively find the expected .mmdb file inside an extracted MaxMind archive.
 */
async function findExtractedDatabase(dir, fileName) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);

        if (entry.isFile() && entry.name === fileName) {
            return entryPath;
        }

        if (entry.isDirectory()) {
            const found = await findExtractedDatabase(entryPath, fileName);
            if (found) {
                return found;
            }
        }
    }

    return null;
}

/**
 * Build the MaxMind permalink download URL for an edition archive.
 */
function getDownloadUrl(editionId) {
    return `https://download.maxmind.com/geoip/databases/${editionId}/download?suffix=tar.gz`;
}

/**
 * Build the Basic Auth header required by MaxMind downloads.
 */
function getAuthHeaders() {
    const auth = Buffer.from(`${process.env.MAXMIND_ACCOUNT_ID}:${process.env.MAXMIND_LICENSE_KEY}`).toString('base64');
    return {
        Authorization: `Basic ${auth}`,
    };
}

/**
 * Read the updater state file that records previously downloaded remote versions.
 */
async function readUpdateState(dbDir) {
    try {
        const content = await fsp.readFile(path.join(dbDir, STATE_FILE), 'utf8');
        return JSON.parse(content);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {};
        }
        throw error;
    }
}

/**
 * Persist the updater state after a successful database publish.
 */
async function writeUpdateState(dbDir, state) {
    await fsp.writeFile(path.join(dbDir, STATE_FILE), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

/**
 * Acquire a filesystem lock so multiple pm2 processes do not update concurrently.
 */
async function acquireUpdateLock(dbDir) {
    const lockPath = path.join(dbDir, LOCK_FILE);

    try {
        const handle = await fsp.open(lockPath, 'wx');
        await handle.writeFile(JSON.stringify({
            pid: process.pid,
            startedAt: new Date().toISOString(),
        }));

        return {
            // Release the inter-process lock after this update cycle finishes.
            release: async () => {
                await handle.close();
                await fsp.rm(lockPath, { force: true });
            },
        };
    } catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }

        const stat = await fsp.stat(lockPath).catch(() => null);
        if (stat && Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
            await fsp.rm(lockPath, { force: true });
            return acquireUpdateLock(dbDir);
        }

        console.log('MaxMind update skipped: another process is updating databases');
        return null;
    }
}
