// One engine for every offline snapshot the backend serves — the rows in
// server/datasets/datasets.js. A row supplies the domain part: where the newest
// remote version is, how to fetch and distill it into the files it
// publishes, how to validate them, how to reload them. The engine owns the
// rest:
//   - a cross-process lock per dataset directory (proper-lockfile: the lock
//     carries a heartbeat, so a crashed holder's lock goes stale on its own);
//   - a state file per dataset, written atomically (write-file-atomic);
//   - publishing a row's files together, rolled back if any rename fails;
//   - the boot download of a snapshot that is missing, unusable or left
//     half-published, under a timeout;
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
//   isLoaded()        optional; whether the reader holds a usable snapshot —
//                     it may accept more than the published names (a
//                     hand-named CAIDA file) or refuse a file it can't parse.
//                     The boot download skips a loaded row. Default: every
//                     published file is present
//   legacyState       optional { file, toState(json) → { identifier, updatedAt } }:
//                     the state file an earlier updater wrote, read once so
//                     an upgrade doesn't re-download
//   legacyAutoUpdateEnv  optional env var name that used to gate this row's
//                     schedule (see isAutoUpdateEnabled)
//
// State file (`.dataset-state.json`): { identifier, updatedAt, checkedAt } —
// the published version, when it was published, when the remote was last
// asked about it — plus `publishing: true` while files are in flux.

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
import logger from '../logger.js';
import { withCronMonitor } from '../sentry-cron.js';
import { createDecompressor } from './decompress.js';
import { fetchUpstream } from '../../common/fetch-with-timeout.js';

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

// Whether the boot download can skip the row: its reader has something.
const isLoaded = (row) => (row.isLoaded ? row.isLoaded() : isPresent(row));

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
// Rows this process is publishing right now: from the first file move until
// the reload has recorded the new fingerprints, the watcher must not take
// the changing files for someone else's — it defers its check instead.
const ownPublishes = new Set();
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
// file restored from its backup, or a target that didn't exist removed.
// `signal` (a timeout, or the lock lost) is checked before every step and
// rolls back like a failed rename. Only `lockLost` stops the cleanup too:
// another process may be publishing into the same paths, so this one
// touches nothing more and leaves the half-done set to the next holder
// (updateDataset marked the state in flux first).
const publish = async (row, staged, { signal, lockLost }) => {
    const ownsFiles = () => !lockLost?.aborted;
    const plan = row.files.map((file) => {
        const target = path.join(row.dir, file);
        return { source: staged[file], target, next: `${target}.next`, backup: `${target}.bak`, existed: false, renamed: false };
    });
    try {
        for (const step of plan) {
            signal?.throwIfAborted();
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
                signal?.throwIfAborted();
                await fsp.rename(step.next, step.target);
                step.renamed = true;
            }
        } catch (error) {
            if (ownsFiles()) {
                for (const step of plan.filter((s) => s.renamed)) {
                    await (step.existed ? fsp.copyFile(step.backup, step.target) : fsp.rm(step.target, { force: true }))
                        .catch(() => {});
                }
            }
            throw error;
        }
    } finally {
        if (ownsFiles()) {
            for (const step of plan) {
                await fsp.rm(step.next, { force: true });
                await fsp.rm(step.backup, { force: true });
            }
        }
    }
};

// ---------- update ----------

/**
 * One locked update of `row`: ask the remote, and when it has a version the
 * state doesn't (or a file is missing) fetch, validate, publish, record and
 * reload. Resolves { updated: true, identifier } or { updated: false, reason:
 * 'not-modified' | 'locked' }; throws when a step fails (nothing published).
 * `wait` waits out another holder of the lock instead of answering 'locked';
 * `force` fetches even when the state already records the remote's version.
 */
export const updateDataset = async (row, { signal, reason = 'auto update', wait = false, force = false } = {}) => {
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
        if (!force && remote.identifier && isPresent(row) && state.identifier === remote.identifier) {
            work.throwIfAborted();
            await writeState(row, { ...state, checkedAt: now });
            return { updated: false, reason: 'not-modified' };
        }
        const staged = await row.fetch({ remote, tempDir, signal: work });
        const missing = row.files.filter((file) => !staged[file]);
        if (missing.length) throw new Error(`${row.id} fetch produced no ${missing.join(', ')}`);
        await row.validate(staged);
        // Files in flux: until the final state below, the record names no
        // version, so a run that dies or loses the lock mid-publish leaves
        // nothing the next holder would take for current — it re-fetches and
        // publishes a whole set, and the next boot does so before trusting
        // the files.
        work.throwIfAborted();
        ownPublishes.add(row.id);
        await writeState(row, { ...state, identifier: null, publishing: true });
        await publish(row, staged, { signal: work, lockLost: lock.lost });
        // A whole set is in place: record it unless the lock went meanwhile.
        lock.lost.throwIfAborted();
        await writeState(row, { identifier: remote.identifier, updatedAt: now, checkedAt: now });
        logger.info({ dataset: row.id, identifier: remote.identifier }, 'dataset updated');
        await reloadRow(row, reason);
        return { updated: true, identifier: remote.identifier };
    } finally {
        ownPublishes.delete(row.id);
        await fsp.rm(tempDir, { recursive: true, force: true });
        await lock.release().catch(() => {});
    }
};

// Whether a run died or lost its lock mid-publish: the files on disk may
// mix two versions. An unreadable state is not taken for one.
const wasInterrupted = (row) => readState(row).then((state) => Boolean(state.publishing), () => false);

/**
 * Boot: download `row` under a timeout unless its reader already holds a
 * usable snapshot and no publish was interrupted. Another process (another
 * backend, a manual run) holding the lock is waited out, and what it
 * published is loaded. Never throws; resolves { status: 'disabled' |
 * 'present' | 'downloaded' | 'loaded' | 'no-op' | 'failed' }.
 */
export const bootstrapDataset = async (row, { timeoutMs = BOOTSTRAP_TIMEOUT_MS } = {}) => {
    if (!isRowEnabled(row)) return { status: 'disabled' };
    const interrupted = await wasInterrupted(row);
    if (isLoaded(row) && !interrupted) return { status: 'present' };
    // Files already under the published names are unusable or half-published:
    // a state naming the remote's version is no reason to keep them.
    const force = isPresent(row);

    const minutes = Math.round(timeoutMs / 60000);
    const why = interrupted ? 'publish was interrupted' : force ? 'unusable' : 'missing';
    logger.warn(`📥 Dataset ${row.id} ${why}; downloading (timeout ${minutes} min)...`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('bootstrap timed out')), timeoutMs);
    timer.unref?.();
    try {
        const result = await updateDataset(row, { signal: controller.signal, reason: 'bootstrap', wait: true, force });
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
        const cause = controller.signal.aborted ? `did not complete within ${minutes} min` : error.message;
        logger.warn({ err: error }, `⚠️  Dataset ${row.id} initial download failed: ${cause}`);
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

// What a scheduled run logs for a row it left alone (a publish logs itself).
const SKIP_MESSAGES = {
    'not-modified': 'dataset up to date; nothing to download',
    locked: 'dataset update skipped: another process holds the lock',
};

/**
 * Update each row in turn, each under `timeoutMs`; one failing or stalling
 * doesn't stop the rest. Every row logs its outcome, so a run that changed
 * nothing still shows it ran. `timeoutMs` is injectable for tests.
 */
export const updateDatasets = async (rows, { timeoutMs = UPDATE_TIMEOUT_MS } = {}) => {
    logger.info({ datasets: rows.map((row) => row.id) }, 'dataset update run started');
    for (const row of rows) {
        try {
            const result = await updateDataset(row, { signal: AbortSignal.timeout(timeoutMs) });
            if (!result.updated) logger.info({ dataset: row.id }, SKIP_MESSAGES[result.reason]);
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

/**
 * Sentry Crons settings for a run updating `rowCount` datasets in turn: its
 * longest legitimate run is every row at its timeout, plus a margin, so a
 * healthy run is never marked failed. Exported for tests.
 */
export const monitorConfigFor = (pattern, rowCount, timezone) => ({
    schedule: { type: 'crontab', value: pattern },
    timezone,
    checkinMargin: 60,
    maxRuntime: Math.ceil((rowCount * UPDATE_TIMEOUT_MS) / 60000) + 10,
});

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
        monitorConfigFor(pattern, scheduled.length, timezone),
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
            // This process's own publish records its files once reloaded;
            // look again after it, so a change made meanwhile still counts.
            if (ownPublishes.has(row.id)) {
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
