// Cross-process update locks of the dataset updaters (common/maxmind-updater.js,
// common/caida-updater.js). A lock file holds its owner's pid as JSON. These
// helpers tell a live owner — the offline-data CLI, another backend process —
// from one that crashed, and wait a live one out.

import fsp from 'fs/promises';
import { setTimeout as sleep } from 'timers/promises';

// An owner opens the lock, then writes its pid: a pid-less lock this young
// is one being written, not one left behind.
const FRESH_LOCK_MS = 10 * 1000;

/**
 * Whether the lock at `lockPath` is held by a running process other than
 * this one. False when there is no lock, or its owner is gone (a crash, or
 * a pid recycled into this very process).
 */
export const isLockOwnerAlive = async (lockPath) => {
    let text;
    try {
        text = await fsp.readFile(lockPath, 'utf8');
    } catch {
        return false;
    }
    let pid;
    try {
        ({ pid } = JSON.parse(text));
    } catch {
        const stat = await fsp.stat(lockPath).catch(() => null);
        return Boolean(stat && Date.now() - stat.mtimeMs < FRESH_LOCK_MS);
    }
    if (!Number.isInteger(pid) || pid === process.pid) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error.code === 'EPERM'; // alive, owned by another user
    }
};

/**
 * Resolve once the lock is released, or its owner turns out to be dead;
 * rejects when `signal` aborts.
 */
export const waitForUnlock = async (lockPath, { signal, intervalMs = 1000 } = {}) => {
    while (await isLockOwnerAlive(lockPath)) {
        await sleep(intervalMs, undefined, { signal });
    }
};
