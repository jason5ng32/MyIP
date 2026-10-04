// Tests for common/update-lock.js — telling a live lock owner from a crashed
// one, and waiting a live one out. Lock files live in a temp dir.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, describe, it } from 'node:test';

import { isLockOwnerAlive, waitForUnlock } from '../common/update-lock.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'myip-lock-test-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

let n = 0;
const lockWith = (content) => {
    const lockPath = path.join(root, `lock-${n++}`);
    fs.writeFileSync(lockPath, content);
    return lockPath;
};
// A pid that existed and has exited.
const deadPid = () => spawnSync(process.execPath, ['-e', '']).pid;

describe('isLockOwnerAlive', () => {
    it('is true for a running owner other than this process', async () => {
        assert.equal(await isLockOwnerAlive(lockWith(JSON.stringify({ pid: process.ppid }))), true);
    });

    it('is false for no lock, an exited owner, or this very process', async () => {
        assert.equal(await isLockOwnerAlive(path.join(root, 'absent')), false);
        assert.equal(await isLockOwnerAlive(lockWith(JSON.stringify({ pid: deadPid() }))), false);
        assert.equal(await isLockOwnerAlive(lockWith(JSON.stringify({ pid: process.pid }))), false);
    });

    it('treats a pid-less lock as being written while fresh, abandoned once old', async () => {
        const lockPath = lockWith('');
        assert.equal(await isLockOwnerAlive(lockPath), true);
        const old = new Date(Date.now() - 60 * 1000);
        fs.utimesSync(lockPath, old, old);
        assert.equal(await isLockOwnerAlive(lockPath), false);
    });
});

describe('waitForUnlock', () => {
    it('resolves once the owner releases the lock', async () => {
        const lockPath = lockWith(JSON.stringify({ pid: process.ppid }));
        setTimeout(() => fs.rmSync(lockPath), 30);
        await waitForUnlock(lockPath, { intervalMs: 10 });
        assert.equal(fs.existsSync(lockPath), false);
    });

    it('returns at once for a dead owner; rejects on abort', async () => {
        await waitForUnlock(lockWith(JSON.stringify({ pid: deadPid() })), { intervalMs: 10 });
        const controller = new AbortController();
        const waiting = waitForUnlock(lockWith(JSON.stringify({ pid: process.ppid })),
            { intervalMs: 10, signal: controller.signal });
        controller.abort();
        await assert.rejects(waiting, { name: 'AbortError' });
    });
});
