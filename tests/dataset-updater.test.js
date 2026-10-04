// Tests for common/dataset-updater.js — the engine, over synthetic rows in a
// temp dir: publish + state + reload, not-modified, refusals, the earlier
// updaters' state, the cross-process lock, the boot download, the schedule's
// env resolution and catch-up, and the watcher. No network: rows fetch from
// local strings.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, afterEach, describe, it } from 'node:test';
import lockfile from 'proper-lockfile';

import {
    STATE_FILE, LOCK_FILE, updateDataset, bootstrapDataset, readState, isPresent,
    isAutoUpdateEnabled, startDatasetScheduler, DEFAULT_UPDATE_CRON, rowsMissingACheck, watchDatasets,
    updateDatasets, downloadToFile,
} from '../common/dataset-updater.js';
import logger from '../common/logger.js';
import { setUpstreamUserAgent } from '../common/fetch-with-timeout.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'myip-dataset-test-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

const savedEnv = { auto: process.env.DATASET_AUTO_UPDATE, cron: process.env.DATASET_UPDATE_CRON };
afterEach(() => {
    for (const [name, value] of [['DATASET_AUTO_UPDATE', savedEnv.auto], ['DATASET_UPDATE_CRON', savedEnv.cron]]) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
    }
});

// A two-file row whose remote is `version`; records fetches and reloads.
const makeRow = (overrides = {}) => {
    const log = { fetches: 0, reloads: [] };
    const row = {
        id: 'test',
        dir: fs.mkdtempSync(path.join(root, 'row-')),
        files: ['a.txt', 'b.txt'],
        version: 'v1',
        findRemote: async () => ({ identifier: row.version }),
        fetch: async ({ remote, tempDir }) => {
            log.fetches++;
            const staged = {};
            for (const file of row.files) {
                staged[file] = path.join(tempDir, file);
                fs.writeFileSync(staged[file], `${file} ${remote.identifier}\n`);
            }
            return staged;
        },
        validate: async () => {},
        reload: async (reason) => { log.reloads.push(reason); },
        ...overrides,
    };
    return { row, log };
};
const read = (row, file) => fs.readFileSync(path.join(row.dir, file), 'utf8');
const state = (row) => JSON.parse(fs.readFileSync(path.join(row.dir, STATE_FILE), 'utf8'));

describe('updateDataset', () => {
    it('publishes every file, records the version and reloads', async () => {
        const { row, log } = makeRow();
        assert.deepEqual(await updateDataset(row), { updated: true, identifier: 'v1' });
        assert.equal(read(row, 'a.txt'), 'a.txt v1\n');
        assert.equal(read(row, 'b.txt'), 'b.txt v1\n');
        assert.equal(state(row).identifier, 'v1');
        assert.deepEqual(log.reloads, ['auto update']);
        // Only the published files, the state and no leftovers (lock released).
        assert.deepEqual(fs.readdirSync(row.dir).sort(), [STATE_FILE, 'a.txt', 'b.txt']);
    });

    it('an unchanged remote only records the check', async () => {
        const { row, log } = makeRow();
        await updateDataset(row);
        const first = state(row);
        assert.deepEqual(await updateDataset(row), { updated: false, reason: 'not-modified' });
        assert.equal(log.fetches, 1);
        assert.equal(state(row).updatedAt, first.updatedAt);
        assert.ok(state(row).checkedAt >= first.checkedAt);
    });

    it('a new remote version, or a missing file, is fetched again', async () => {
        const { row, log } = makeRow();
        await updateDataset(row);
        row.version = 'v2';
        assert.equal((await updateDataset(row)).updated, true);
        assert.equal(read(row, 'b.txt'), 'b.txt v2\n');
        fs.rmSync(path.join(row.dir, 'a.txt'));
        assert.equal((await updateDataset(row)).updated, true);
        assert.equal(log.fetches, 3);
    });

    it('a remote that names no version is always fetched, never taken for unchanged', async () => {
        const { row, log } = makeRow({ findRemote: async () => ({ identifier: null }) });
        await updateDataset(row);
        assert.equal((await updateDataset(row)).updated, true);
        assert.equal(log.fetches, 2);
    });

    it('publishes nothing when validation refuses or a file is not produced', async () => {
        const refused = makeRow({ validate: async () => { throw new Error('too small'); } });
        await assert.rejects(updateDataset(refused.row), /too small/);
        assert.deepEqual(fs.readdirSync(refused.row.dir), []);
        assert.deepEqual(refused.log.reloads, []);

        const { row } = makeRow();
        row.fetch = async ({ tempDir }) => {
            const a = path.join(tempDir, 'a.txt');
            fs.writeFileSync(a, 'a');
            return { 'a.txt': a };
        };
        await assert.rejects(updateDataset(row), /fetch produced no b\.txt/);
        assert.deepEqual(fs.readdirSync(row.dir), []);
    });

    it('reads an earlier updater\'s state, so an upgrade does not re-download', async () => {
        const { row, log } = makeRow({
            legacyState: { file: '.old-state.json', toState: (json) => ({ identifier: json.version }) },
        });
        for (const file of row.files) fs.writeFileSync(path.join(row.dir, file), 'old');
        fs.writeFileSync(path.join(row.dir, '.old-state.json'), JSON.stringify({ version: 'v1' }));
        assert.equal((await readState(row)).identifier, 'v1');
        assert.deepEqual(await updateDataset(row), { updated: false, reason: 'not-modified' });
        assert.equal(log.fetches, 0);
        assert.equal(state(row).identifier, 'v1', 'carried into the new state file');
    });

    it('answers locked while another holder has the lock', async () => {
        const { row, log } = makeRow();
        const release = await lockfile.lock(row.dir, { lockfilePath: path.join(row.dir, LOCK_FILE) });
        try {
            assert.deepEqual(await updateDataset(row), { updated: false, reason: 'locked' });
            assert.equal(log.fetches, 0);
        } finally {
            await release();
        }
        assert.equal((await updateDataset(row)).updated, true);
    });
});

describe('bootstrapDataset', () => {
    it('skips a disabled row and a present one', async () => {
        const disabled = makeRow({ enabled: () => false });
        assert.equal((await bootstrapDataset(disabled.row)).status, 'disabled');
        const { row, log } = makeRow();
        await updateDataset(row);
        assert.equal((await bootstrapDataset(row)).status, 'present');
        assert.equal(log.fetches, 1);
    });

    it('downloads a missing dataset and reloads it as a bootstrap', async () => {
        const { row, log } = makeRow();
        assert.equal((await bootstrapDataset(row)).status, 'downloaded');
        assert.ok(isPresent(row));
        assert.deepEqual(log.reloads, ['bootstrap']);
    });

    it('waits out another holder of the lock, then loads what it published', async () => {
        const { row, log } = makeRow();
        const release = await lockfile.lock(row.dir, { lockfilePath: path.join(row.dir, LOCK_FILE) });
        // The other process publishes v1 and its state, then lets go.
        setTimeout(async () => {
            for (const file of row.files) fs.writeFileSync(path.join(row.dir, file), `${file} v1\n`);
            fs.writeFileSync(path.join(row.dir, STATE_FILE), JSON.stringify({ identifier: 'v1' }));
            await release();
        }, 100);
        assert.equal((await bootstrapDataset(row)).status, 'loaded');
        assert.equal(log.fetches, 0, 'no second download');
        assert.deepEqual(log.reloads, ['bootstrap']);
    });

    it('never throws: a failing or slow download is reported as failed', async () => {
        const broken = makeRow({ findRemote: async () => { throw new Error('listing 503'); } });
        const failed = await bootstrapDataset(broken.row);
        assert.equal(failed.status, 'failed');
        assert.match(failed.error.message, /listing 503/);

        const slow = makeRow({
            findRemote: ({ signal }) => new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => reject(signal.reason));
            }),
        });
        assert.equal((await bootstrapDataset(slow.row, { timeoutMs: 50 })).status, 'failed');
    });
});

describe('isAutoUpdateEnabled', () => {
    const row = { legacyAutoUpdateEnv: 'OLD_FLAG' };

    it('is on by default', () => {
        assert.equal(isAutoUpdateEnabled(row, {}), true);
        assert.equal(isAutoUpdateEnabled({}, {}), true);
    });

    it('DATASET_AUTO_UPDATE decides when set, over the legacy flag', () => {
        assert.equal(isAutoUpdateEnabled(row, { DATASET_AUTO_UPDATE: 'false', OLD_FLAG: 'true' }), false);
        assert.equal(isAutoUpdateEnabled(row, { DATASET_AUTO_UPDATE: 'true', OLD_FLAG: 'false' }), true);
    });

    it('otherwise an existing .env\'s legacy flag keeps its choice', () => {
        assert.equal(isAutoUpdateEnabled(row, { OLD_FLAG: 'false' }), false);
        assert.equal(isAutoUpdateEnabled(row, { OLD_FLAG: 'true' }), true);
    });
});

describe('startDatasetScheduler', () => {
    it('schedules nothing when no row auto-updates', () => {
        process.env.DATASET_AUTO_UPDATE = 'false';
        assert.equal(startDatasetScheduler([makeRow().row]), null);
    });

    it('runs at DATASET_UPDATE_CRON, defaulting to 04:30', () => {
        assert.equal(DEFAULT_UPDATE_CRON, '30 4 * * *');
        process.env.DATASET_AUTO_UPDATE = 'true';
        process.env.DATASET_UPDATE_CRON = '15 5 * * *';
        const job = startDatasetScheduler([makeRow().row]);
        try {
            assert.equal(job.getPattern(), '15 5 * * *');
            const next = job.nextRun();
            assert.equal(next.getHours(), 5);
            assert.equal(next.getMinutes(), 15);
        } finally {
            job.stop();
        }
    });
});

describe('rowsMissingACheck', () => {
    const at = (day, hour, minute) => new Date(2026, 9, day, hour, minute); // local time, like the cron
    const pattern = '30 4 * * *';
    const withState = (stateBody) => {
        const { row } = makeRow();
        if (stateBody) fs.writeFileSync(path.join(row.dir, STATE_FILE), JSON.stringify(stateBody));
        return row;
    };

    it('picks rows whose scheduled check fell inside a downtime, or that were never checked', async () => {
        const now = at(5, 5, 5);
        // Checked at 04:35 yesterday, down over today's 04:30: due, though only 24.5 h ago.
        const missed = withState({ checkedAt: at(4, 4, 35).toISOString() });
        const fresh = withState({ checkedAt: at(5, 4, 31).toISOString() });
        const never = withState(null);
        // A pre-engine state has no checkedAt: its publish time stands in.
        const legacy = withState({ updatedAt: at(5, 4, 40).toISOString() });
        const stale = await rowsMissingACheck([missed, fresh, never, legacy], { pattern, now });
        assert.deepEqual(stale, [missed, never]);
    });

    it('is not due before the next scheduled time comes round', async () => {
        const row = withState({ checkedAt: at(4, 4, 35).toISOString() });
        assert.deepEqual(await rowsMissingACheck([row], { pattern, now: at(5, 4, 29) }), []);
    });
});

describe('updateDatasets', () => {
    it('aborts a stalled row at its timeout and goes on to the next', async () => {
        const originalError = logger.error;
        const logged = [];
        logger.error = (ctx) => logged.push(ctx.dataset);
        try {
            const stalled = makeRow({
                id: 'stalled',
                findRemote: ({ signal }) => new Promise((resolve, reject) => {
                    signal.addEventListener('abort', () => reject(signal.reason));
                }),
            });
            const next = makeRow();
            await updateDatasets([stalled.row, next.row], { timeoutMs: 50 });
            assert.deepEqual(logged, ['stalled']);
            assert.ok(isPresent(next.row));
        } finally {
            logger.error = originalError;
        }
    });
});

describe('downloadToFile', () => {
    it('goes through fetchUpstream: the project User-Agent, the caller\'s headers kept', async () => {
        const realFetch = globalThis.fetch;
        let seen;
        globalThis.fetch = async (url, init) => { seen = init; return new Response('body'); };
        setUpstreamUserAgent('MyIP/test');
        try {
            const dest = path.join(root, 'download.bin');
            await downloadToFile('https://example.invalid/x', dest, { headers: { Authorization: 'Basic x' } });
            assert.equal(fs.readFileSync(dest, 'utf8'), 'body');
            assert.equal(seen.headers['User-Agent'], 'MyIP/test');
            assert.equal(seen.headers.Authorization, 'Basic x');
        } finally {
            globalThis.fetch = realFetch;
            setUpstreamUserAgent(null);
        }
    });
});

describe('watchDatasets', () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const fast = { intervalMs: 20, settleMs: 30 };

    it('reloads when someone else changes the files, not after its own publish', async () => {
        const { row, log } = makeRow();
        await updateDataset(row);
        const stop = watchDatasets([row], fast);
        try {
            row.version = 'v2';
            await updateDataset(row); // this process: reloads once, by itself
            await sleep(150);
            assert.deepEqual(log.reloads, ['auto update', 'auto update']);

            // Another process (or a hand) replaces the files.
            for (const file of row.files) fs.writeFileSync(path.join(row.dir, file), `${file} by hand, longer\n`);
            await sleep(150);
            assert.deepEqual(log.reloads, ['auto update', 'auto update', 'file change']);
        } finally {
            stop();
        }
    });

    it('picks up files dropped into an empty dataset, once all are there', async () => {
        const { row, log } = makeRow({ enabled: () => false }); // no credentials: hand-placed only
        const stop = watchDatasets([row], fast);
        try {
            fs.writeFileSync(path.join(row.dir, 'a.txt'), 'a');
            await sleep(150);
            assert.deepEqual(log.reloads, [], 'not while a file is still missing');
            fs.writeFileSync(path.join(row.dir, 'b.txt'), 'b');
            await sleep(150);
            assert.deepEqual(log.reloads, ['file change']);
        } finally {
            stop();
        }
    });

    it('retries a reload that failed on the files\' next change, even with the same content', async () => {
        let fail = true;
        const { row, log } = makeRow({
            reload: async (reason) => {
                log.reloads.push(reason);
                if (fail) throw new Error('cannot open');
            },
        });
        const stop = watchDatasets([row], fast);
        try {
            for (const file of row.files) fs.writeFileSync(path.join(row.dir, file), `${file}\n`);
            await sleep(150);
            assert.equal(log.reloads.length, 1, 'tried once, failed');
            fail = false;
            // Fix permissions: mtime and size unchanged, ctime moves.
            fs.chmodSync(path.join(row.dir, 'a.txt'), 0o600);
            await sleep(150);
            assert.equal(log.reloads.length, 2, 'retried');
        } finally {
            stop();
        }
    });
});
