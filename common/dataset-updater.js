// One engine for every offline snapshot the backend serves — the rows in
// common/datasets.js. A row supplies the domain part: where the newest
// remote version is, how to fetch and distill it into the files it
// publishes, how to validate them, how to reload them. The engine owns the
// rest:
//   - a cross-process lock per dataset directory (proper-lockfile: the lock
//     carries a heartbeat, so a crashed holder's lock goes stale on its own);
//   - a state file per dataset, written atomically (write-file-atomic);
//   - publishing a row's files together, rolled back if any rename fails;
//   - the boot download of a missing snapshot, under a timeout;
//   - the daily schedule (croner), at a fixed wall-clock time, plus a
//     catch-up run at boot for datasets a downtime kept from their check;
//   - reloading files published by anyone else — another process, or an
//     operator dropping files in by hand (watchDatasets).
//
// Row shape:
//   id                short name, used in logs
//   dir               directory holding the published files, state and lock
//   files             published file names, relative to `dir`
//   enabled()         optional; false skips the row everywhere (a missing key
//                     or credential), as if it weren't registered
//   findRemote({ signal }) → { identifier, … } — identifier names the remote
//                     version (null when the remote doesn't say: always
//                     fetched); the whole object is handed on to fetch
//   fetch({ remote, tempDir, signal }) → { [file]: stagedPath } for every
//                     name in `files`
//   validate(staged)  throws to refuse a truncated or corrupt download
//   reload(reason)    swaps the in-memory copy for the published files
//   legacyState       optional { file, toState(json) → { identifier, updatedAt } }:
//                     the state file an earlier updater wrote, read once so
//                     an upgrade doesn't re-download
//   legacyAutoUpdateEnv  optional env var name that used to gate this row's
//                     schedule (see isAutoUpdateEnabled)
//
// State file (`.dataset-state.json`): { identifier, updatedAt, checkedAt } —
// the published version, when it was published, when the remote was last
// asked about it.

import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { setTimeout as sleep } from 'timers/promises';
import lockfile from 'proper-lockfile';
import writeFileAtomic from 'write-file-atomic';
import { Cron } from 'croner';
import logger from './logger.js';
import { withCronMonitor } from './sentry-cron.js';
import { createDecompressor } from './decompress.js';
import { fetchUpstream } from './fetch-with-timeout.js';

export const STATE_FILE = '.dataset-state.json';
export const LOCK_FILE = '.dataset.lock';

// A holder refreshes its lock every minute; one untouched for ten is dead.
const LOCK_OPTIONS = { stale: 10 * 60 * 1000, update: 60 * 1000 };
const LOCK_RETRY_MS = 2000;
const BOOTSTRAP_TIMEOUT_MS = 5 * 60 * 1000;
// A scheduled or catch-up update of one dataset, download included; past
// this it is aborted so a stalled upstream can't hold up the rest.
const UPDATE_TIMEOUT_MS = 30 * 60 * 1000;
export const DEFAULT_UPDATE_CRON = '30 4 * * *';
const CATCH_UP_DELAY_MS = 60 * 1000;

// ---------- download helpers for rows ----------

/**
 * Stream `url` into `destPath`. fetchUpstream (project User-Agent) times out
 * the wait for a response; the body — a large archive — is bounded by the
 * caller's signal instead.
 */
export const downloadToFile = async (url, destPath, { signal, headers } = {}) => {
    const response = await fetchUpstream(url, { signal, headers, timeoutMs: 30 * 1000 });
    if (!response.ok || !response.body) throw new Error(`download failed: HTTP ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(destPath), { signal });
};

/** Decompress `srcPath` ('gzip' | 'bzip2') into `destPath`. */
export const decompressFile = async (srcPath, destPath, format) => {
    await pipeline(fs.createReadStream(srcPath), createDecompressor(format), fs.createWriteStream(destPath));
};

// ---------- row state ----------

export const isRowEnabled = (row) => !row.enabled || Boolean(row.enabled());

/** Whether every file the row publishes is on disk. */
export const isPresent = (row) => row.files.every((file) => fs.existsSync(path.join(row.dir, file)));

/** The row's state, falling back to an earlier updater's state file; {} when neither exists. */
export const readState = async (row) => {
    const read = async (file) => JSON.parse(await fsp.readFile(path.join(row.dir, file), 'utf8'));
    try {
        return await read(STATE_FILE);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    if (!row.legacyState) return {};
    try {
        return row.legacyState.toState(await read(row.legacyState.file)) || {};
    } catch {
        return {};
    }
};

const writeState = (row, state) =>
    writeFileAtomic(path.join(row.dir, STATE_FILE), `${JSON.stringify(state, null, 2)}\n`);

// The published files as this process last loaded them (mtime + size per
// file), so the watcher can tell someone else's publish from its own.
const loadedFingerprints = new Map();
const fingerprint = (row) => row.files.map((file) => {
    try {
        const stat = fs.statSync(path.join(row.dir, file));
        return `${stat.mtimeMs}:${stat.size}`;
    } catch {
        return '-';
    }
}).join('|');
// Recorded only once the reload succeeds, so a failed load is retried on
// the files' next change.
const reloadRow = async (row, reason) => {
    const current = fingerprint(row);
    await row.reload(reason);
    loadedFingerprints.set(row.id, current);
};

// ---------- lock ----------

// Resolves { release, lost } — `lost` an AbortSignal that fires if the lock
// is compromised mid-update (its heartbeat failed; another process may take
// it over) — or null when another process holds the lock and `wait` is off.
// With `wait`, polls until the lock frees or `signal` aborts (which rejects).
const acquireLock = async (row, { wait = false, signal } = {}) => {
    for (;;) {
        const lost = new AbortController();
        try {
            const release = await lockfile.lock(row.dir, {
                ...LOCK_OPTIONS,
                lockfilePath: path.join(row.dir, LOCK_FILE),
                // Never throw (that would kill the server): abort the update
                // holding the lock instead, before it publishes.
                onCompromised: (error) => {
                    logger.warn({ err: error, dataset: row.id }, 'dataset lock compromised; aborting the update');
                    lost.abort(error);
                },
            });
            return { release, lost: lost.signal };
        } catch (error) {
            if (error.code !== 'ELOCKED') throw error;
            if (!wait) return null;
            await sleep(LOCK_RETRY_MS, undefined, { signal });
        }
    }
};

// ---------- publish ----------

// Copy every staged file next to its target, then rename them all into
// place. A failed rename rolls back the ones already done: the previous
// file restored from its backup, or a target that didn't exist removed —
// never a half-published dataset.
const publish = async (row, staged) => {
    const plan = row.files.map((file) => {
        const target = path.join(row.dir, file);
        return { source: staged[file], target, next: `${target}.next`, backup: `${target}.bak`, existed: false, renamed: false };
    });
    try {
        for (const step of plan) {
            await fsp.copyFile(step.source, step.next);
            try {
                await fsp.copyFile(step.target, step.backup);
                step.existed = true;
            } catch (error) {
                if (error.code !== 'ENOENT') throw error;
            }
        }
        try {
            for (const step of plan) {
                await fsp.rename(step.next, step.target);
                step.renamed = true;
            }
        } catch (error) {
            for (const step of plan.filter((s) => s.renamed)) {
                await (step.existed ? fsp.copyFile(step.backup, step.target) : fsp.rm(step.target, { force: true }))
                    .catch(() => {});
            }
            throw error;
        }
    } finally {
        for (const step of plan) {
            await fsp.rm(step.next, { force: true });
            await fsp.rm(step.backup, { force: true });
        }
    }
};

// ---------- update ----------

/**
 * One locked update of `row`: ask the remote, and when it has a version the
 * state doesn't (or a file is missing) fetch, validate, publish, record and
 * reload. Resolves { updated: true, identifier } or { updated: false, reason:
 * 'not-modified' | 'locked' }; throws when a step fails (nothing published).
 * `wait` waits out another holder of the lock instead of answering 'locked'.
 */
export const updateDataset = async (row, { signal, reason = 'auto update', wait = false } = {}) => {
    await fsp.mkdir(row.dir, { recursive: true });
    const lock = await acquireLock(row, { wait, signal });
    if (!lock) return { updated: false, reason: 'locked' };
    // Losing the lock stops the download as well as the publish.
    const work = signal ? AbortSignal.any([signal, lock.lost]) : lock.lost;
    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), `myip-dataset-${row.id}-`));
    try {
        const state = await readState(row);
        const remote = await row.findRemote({ signal: work });
        const now = new Date().toISOString();
        if (remote.identifier && isPresent(row) && state.identifier === remote.identifier) {
            work.throwIfAborted();
            await writeState(row, { ...state, checkedAt: now });
            return { updated: false, reason: 'not-modified' };
        }
        const staged = await row.fetch({ remote, tempDir, signal: work });
        const missing = row.files.filter((file) => !staged[file]);
        if (missing.length) throw new Error(`${row.id} fetch produced no ${missing.join(', ')}`);
        await row.validate(staged);
        work.throwIfAborted();
        await publish(row, staged);
        await writeState(row, { identifier: remote.identifier, updatedAt: now, checkedAt: now });
        logger.info({ dataset: row.id, identifier: remote.identifier }, 'dataset updated');
        await reloadRow(row, reason);
        return { updated: true, identifier: remote.identifier };
    } finally {
        await fsp.rm(tempDir, { recursive: true, force: true });
        await lock.release().catch(() => {});
    }
};

/**
 * Boot: download `row` if a file it publishes is missing, under a timeout.
 * Another process (another backend, a manual run) holding the lock is waited
 * out, and what it published is loaded. Never throws; resolves { status:
 * 'disabled' | 'present' | 'downloaded' | 'loaded' | 'no-op' | 'failed' }.
 */
export const bootstrapDataset = async (row, { timeoutMs = BOOTSTRAP_TIMEOUT_MS } = {}) => {
    if (!isRowEnabled(row)) return { status: 'disabled' };
    if (isPresent(row)) return { status: 'present' };

    const minutes = Math.round(timeoutMs / 60000);
    logger.warn(`📥 Dataset ${row.id} missing; downloading (timeout ${minutes} min)...`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('bootstrap timed out')), timeoutMs);
    timer.unref?.();
    try {
        const result = await updateDataset(row, { signal: controller.signal, reason: 'bootstrap', wait: true });
        if (result.updated) {
            logger.warn(`✅ Dataset ${row.id} downloaded and ready`);
            return { status: 'downloaded' };
        }
        // The remote matched what another process published while we waited.
        if (isPresent(row)) {
            await reloadRow(row, 'bootstrap');
            logger.warn(`✅ Dataset ${row.id} published by another process; loaded`);
            return { status: 'loaded' };
        }
        logger.warn(`⚠️  Dataset ${row.id} bootstrap did not publish (${result.reason})`);
        return { status: 'no-op' };
    } catch (error) {
        const why = controller.signal.aborted ? `did not complete within ${minutes} min` : error.message;
        logger.warn({ err: error }, `⚠️  Dataset ${row.id} initial download failed: ${why}`);
        return { status: 'failed', error };
    } finally {
        clearTimeout(timer);
    }
};

/** Bootstrap every row in parallel; never throws. */
export const bootstrapDatasets = (rows) => Promise.all(rows.map((row) => bootstrapDataset(row)));

// ---------- schedule ----------

/**
 * Whether the schedule updates `row`. DATASET_AUTO_UPDATE decides when set
 * ('false' = off); otherwise the row's pre-engine flag when set, so an
 * existing .env keeps its choice; otherwise on.
 */
export const isAutoUpdateEnabled = (row, env = process.env) => {
    const flag = env.DATASET_AUTO_UPDATE;
    if (flag) return flag !== 'false';
    const legacy = row.legacyAutoUpdateEnv && env[row.legacyAutoUpdateEnv];
    if (legacy) return legacy === 'true';
    return true;
};

/**
 * Update each row in turn, each under `timeoutMs`; one failing or stalling
 * doesn't stop the rest. `timeoutMs` is injectable for tests.
 */
export const updateDatasets = async (rows, { timeoutMs = UPDATE_TIMEOUT_MS } = {}) => {
    for (const row of rows) {
        try {
            await updateDataset(row, { signal: AbortSignal.timeout(timeoutMs) });
        } catch (error) {
            logger.error({ err: error, dataset: row.id }, 'dataset update failed');
        }
    }
};

/**
 * The rows of `rows` a downtime kept from their check: a run of `pattern`
 * fell between the last check (or publish, for a state from before checks
 * were recorded) and `now` — or there was never one. Exported for tests.
 */
export const rowsMissingACheck = async (rows, { pattern, now = new Date() }) => {
    const cron = new Cron(pattern, { paused: true });
    const stale = [];
    for (const row of rows) {
        const { checkedAt, updatedAt } = await readState(row).catch(() => ({}));
        const last = new Date(checkedAt || updatedAt);
        const due = Number.isNaN(last.getTime()) ? null : cron.nextRun(last);
        if (!due || due <= now) stale.push(row);
    }
    return stale;
};

let scheduler = null;

/**
 * Run the auto-updating rows daily at DATASET_UPDATE_CRON (server-local time,
 * default 04:30). `protect` skips a tick while the previous run is still
 * going. Sentry Crons sees the run as one 'dataset-update' check-in.
 */
export const startDatasetScheduler = (rows) => {
    if (scheduler) return scheduler;
    const scheduled = rows.filter((row) => isRowEnabled(row) && isAutoUpdateEnabled(row));
    if (!scheduled.length) {
        logger.info('🗓️  Dataset auto update: off');
        return null;
    }
    const pattern = process.env.DATASET_UPDATE_CRON || DEFAULT_UPDATE_CRON;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    scheduler = new Cron(pattern, { protect: true, unref: true }, () => withCronMonitor(
        'dataset-update',
        () => updateDatasets(scheduled),
        { schedule: { type: 'crontab', value: pattern }, timezone, checkinMargin: 60, maxRuntime: 60 },
    ).catch((error) => logger.error({ err: error }, 'dataset update run failed')));
    const next = scheduler.nextRun()?.toLocaleString('en-US', { hour12: false });
    logger.info(`🗓️  Dataset auto update: ${scheduled.map((row) => row.id).join(', ')} at cron ${pattern} (next ${next})`);

    rowsMissingACheck(scheduled, { pattern }).then((stale) => {
        if (!stale.length) return;
        logger.info(`🗓️  Dataset catch-up in ${CATCH_UP_DELAY_MS / 1000}s: ${stale.map((row) => row.id).join(', ')}`);
        setTimeout(() => updateDatasets(stale), CATCH_UP_DELAY_MS).unref?.();
    });
    return scheduler;
};

// ---------- watch ----------

/**
 * Reload a row when its published files change under it — another process
 * published, or someone dropped files in by hand — but not after this
 * process's own publish (already reloaded). Polls every `intervalMs`; the
 * files must then hold still for `settleMs` (a copy still being written
 * keeps moving) and pass the row's validator before the reload, so a
 * partial or corrupt file never replaces healthy in-memory data. Watches
 * every row, enabled or not: hand-placed files need no credentials. Returns
 * a stop function. Options are injectable for tests.
 */
export const watchDatasets = (rows, { intervalMs = 5000, settleMs = 1000 } = {}) => {
    const stops = [];
    for (const row of rows) {
        if (!loadedFingerprints.has(row.id)) loadedFingerprints.set(row.id, fingerprint(row));
        let timer = null;
        let seen = null;
        const settle = async () => {
            const current = fingerprint(row);
            if (current !== seen) {
                seen = current;
                timer = setTimeout(settle, settleMs);
                timer.unref?.();
                return;
            }
            if (current === loadedFingerprints.get(row.id) || !isPresent(row)) return;
            const published = Object.fromEntries(row.files.map((file) => [file, path.join(row.dir, file)]));
            try {
                await row.validate(published);
            } catch (error) {
                logger.warn({ err: error, dataset: row.id }, 'dataset files changed on disk but failed validation; not reloading');
                return;
            }
            logger.info({ dataset: row.id }, 'dataset files changed on disk; reloading');
            await reloadRow(row, 'file change').catch((error) => {
                logger.warn({ err: error, dataset: row.id }, 'dataset reload after a file change failed');
            });
        };
        const check = () => {
            clearTimeout(timer);
            seen = fingerprint(row);
            timer = setTimeout(settle, settleMs);
            timer.unref?.();
        };
        for (const file of row.files) {
            const target = path.join(row.dir, file);
            fs.watchFile(target, { interval: intervalMs, persistent: false }, check);
            stops.push(() => fs.unwatchFile(target, check));
        }
        stops.push(() => clearTimeout(timer));
    }
    return () => stops.forEach((stop) => stop());
};
