// Specs for the optional user storage (server/db/): env gate, lazy loading, migrations, readiness, the repositories and the feature-use counter, over fakes.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { isUserStorageConfigured, accountSetupGap, createUserStorage, isConnectionLoss } from '../server/db/user-storage.js';
import { MIGRATIONS_DIR, MIGRATION_LOCK_KEY, orderMigrations, readMigrationFiles, runMigrations } from '../server/db/migrate.js';
import { ensureUser } from '../server/db/users.js';
import { listAchievements, unlockAchievement } from '../server/db/achievements.js';
import { FEATURE_USES, recordFeatureUse, sumFeatureUses } from '../server/db/feature-uses.js';
import { countFeatureUse } from '../server/count-feature-use.js';
import { fakeUserDb, fakeStorage } from './fake-user-db.js';
import configsHandler from '../api/configs.js';

const CONFIGURED = { DATABASE_URL: 'postgres://fake' };
const MIGRATIONS = [
    { name: '0001_a', sql: 'CREATE TABLE a ()' },
    { name: '0002_b', sql: 'CREATE TABLE b ()' },
    { name: '0003_c', sql: 'CREATE TABLE c ()' },
];

// A logger spy with pino's (context, message) shape.
const fakeLogger = () => {
    const lines = [];
    const at = (level) => (ctx, msg) => lines.push({ level, ctx, msg });
    return { lines, info: at('info'), warn: at('warn'), error: at('error'), debug: at('debug') };
};

// One connection to an in-memory database that understands the runner's
// statements; `fail` names migration SQL that throws, `down` refuses everything.
const fakeDatabase = ({ recorded = [], fail = new Set(), down = false } = {}) => {
    const state = { committed: new Set(recorded), executed: [], log: [], lockHeld: false, inTx: null };
    const query = async (text, params = []) => {
        state.log.push(text);
        if (down) throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
        if (text.startsWith('SELECT pg_advisory_lock')) {
            assert.equal(params[0], MIGRATION_LOCK_KEY);
            state.lockHeld = true;
            return { rows: [] };
        }
        if (text.startsWith('SELECT pg_advisory_unlock')) {
            state.lockHeld = false;
            return { rows: [] };
        }
        assert.equal(state.lockHeld, true, `ran without the lock: ${text}`);
        if (text.startsWith('CREATE TABLE IF NOT EXISTS myip_migrations')) return { rows: [] };
        if (text === 'SELECT name FROM myip_migrations') return { rows: [...state.committed].map((name) => ({ name })) };
        if (text === 'BEGIN') { state.inTx = { inserted: [], executed: [] }; return { rows: [] }; }
        if (text === 'COMMIT') {
            state.inTx.inserted.forEach((name) => state.committed.add(name));
            state.executed.push(...state.inTx.executed);
            state.inTx = null;
            return { rows: [] };
        }
        if (text === 'ROLLBACK') { state.inTx = null; return { rows: [] }; }
        if (text.startsWith('INSERT INTO myip_migrations')) { state.inTx.inserted.push(params[0]); return { rows: [] }; }
        if (fail.has(text)) throw Object.assign(new Error('syntax error'), { severity: 'ERROR', code: '42601' });
        assert.ok(state.inTx, `migration SQL outside a transaction: ${text}`);
        state.inTx.executed.push(text);
        return { rows: [] };
    };
    return { query, state };
};

// A pg.Pool stand-in over fakeDatabase; `calls` counts loads, pools and released clients.
const fakePg = (dbOptions) => {
    const db = fakeDatabase(dbOptions);
    const calls = { loads: 0, pools: 0, options: null, released: [], errorListeners: 0, ended: 0 };
    class Pool {
        constructor(options) { calls.pools += 1; calls.options = options; }
        on(event) { if (event === 'error') calls.errorListeners += 1; }
        async connect() {
            if (dbOptions?.down) throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
            return { query: db.query, release: (destroy) => calls.released.push(Boolean(destroy)) };
        }
        query(text, params) { return db.query(text, params); }
        async end() { calls.ended += 1; }
    }
    const load = async () => { calls.loads += 1; return Pool; };
    return { load, calls, db };
};

const storageOver = (pg, extra = {}) => createUserStorage({
    env: CONFIGURED, load: pg.load, readMigrations: async () => MIGRATIONS, ...extra,
});

describe('isUserStorageConfigured / accountSetupGap', () => {
    it('is configured only with DATABASE_URL', () => {
        assert.equal(isUserStorageConfigured({}), false);
        assert.equal(isUserStorageConfigured({ DATABASE_URL: '' }), false);
        assert.equal(isUserStorageConfigured(CONFIGURED), true);
    });

    it('names the missing half when exactly one of sign-in and storage is set', () => {
        assert.equal(accountSetupGap({}), null);
        assert.equal(accountSetupGap({ ...CONFIGURED, VITE_FIREBASE_PROJECT_ID: 'p' }), null);
        assert.equal(accountSetupGap({ VITE_FIREBASE_PROJECT_ID: 'p' }), 'DATABASE_URL');
        assert.equal(accountSetupGap(CONFIGURED), 'VITE_FIREBASE_PROJECT_ID');
    });
});

describe('orderMigrations / readMigrationFiles', () => {
    it('orders by numeric prefix and names without the extension', () => {
        const names = orderMigrations(['0010_j.sql', '0002_b.sql', '0001_a.sql', '10000_big.sql']).map(({ name }) => name);
        assert.deepEqual(names, ['0001_a', '0002_b', '0010_j', '10000_big']);
    });

    it('rejects a malformed filename or a repeated number', () => {
        for (const bad of ['users.sql', '1_users.sql', '0001-users.sql', '0001_Users.sql', '0001_.sql']) {
            assert.throws(() => orderMigrations([bad]), /Malformed migration filename/, bad);
        }
        assert.throws(() => orderMigrations(['0001_a.sql', '0001_b.sql']), /Duplicate migration number/);
    });

    it('the shipped directory is well-formed: contiguous from 0001, unique, non-empty', async () => {
        const files = readdirSync(MIGRATIONS_DIR);
        assert.deepEqual(files.filter((name) => !name.endsWith('.sql')), []);
        const ordered = orderMigrations(files);
        ordered.forEach(({ filename, number }, i) => {
            assert.equal(number, i + 1, filename);
            assert.match(filename, /^\d{4}_/);
            assert.ok(readFileSync(join(MIGRATIONS_DIR, filename), 'utf8').trim().length > 0, filename);
        });
        assert.equal(new Set(ordered.map(({ name }) => name)).size, ordered.length);
        const read = await readMigrationFiles();
        assert.deepEqual(read.map(({ name }) => name), ordered.map(({ name }) => name));
        assert.equal(read[0].name, '0001_users');
    });
});

describe('runMigrations', () => {
    it('applies every migration in order, each in its own transaction, under the lock', async () => {
        const { query, state } = fakeDatabase();
        const logger = fakeLogger();
        const applied = await runMigrations({ query, migrations: [MIGRATIONS[2], MIGRATIONS[0], MIGRATIONS[1]], logger });
        assert.deepEqual(applied, ['0001_a', '0002_b', '0003_c']);
        assert.deepEqual(state.executed, MIGRATIONS.map(({ sql }) => sql));
        assert.ok(state.log[0].startsWith('SELECT pg_advisory_lock'));
        assert.ok(state.log.at(-1).startsWith('SELECT pg_advisory_unlock'));
        assert.equal(state.lockHeld, false);
        assert.equal(state.log.filter((text) => text === 'BEGIN').length, 3);
        assert.equal(logger.lines.filter(({ level }) => level === 'info').length, 3);
    });

    it('skips recorded migrations, and a second run applies nothing', async () => {
        const { query, state } = fakeDatabase({ recorded: ['0001_a'] });
        const logger = fakeLogger();
        assert.deepEqual(await runMigrations({ query, migrations: MIGRATIONS, logger }), ['0002_b', '0003_c']);
        assert.deepEqual(await runMigrations({ query, migrations: MIGRATIONS, logger }), []);
        assert.deepEqual(state.executed, ['CREATE TABLE b ()', 'CREATE TABLE c ()']);
        assert.equal(state.lockHeld, false);
    });

    it('a failing file rolls back, stops, leaves later files untouched and releases the lock', async () => {
        const { query, state } = fakeDatabase({ fail: new Set([MIGRATIONS[1].sql]) });
        await assert.rejects(
            runMigrations({ query, migrations: MIGRATIONS, logger: fakeLogger() }),
            (err) => err.migration === '0002_b',
        );
        assert.deepEqual([...state.committed], ['0001_a']);
        assert.deepEqual(state.executed, ['CREATE TABLE a ()']);
        assert.ok(!state.log.includes(MIGRATIONS[2].sql));
        assert.ok(state.log.includes('ROLLBACK'));
        assert.equal(state.lockHeld, false);
    });

    it('a recorded migration missing from disk only warns', async () => {
        const { query, state } = fakeDatabase({ recorded: ['0001_a', '0002_b', '0003_c', '0004_newer'] });
        const logger = fakeLogger();
        assert.deepEqual(await runMigrations({ query, migrations: MIGRATIONS, logger }), []);
        const warnings = logger.lines.filter(({ level }) => level === 'warn');
        assert.equal(warnings.length, 1);
        assert.equal(warnings[0].ctx.migration, '0004_newer');
        assert.equal(state.lockHeld, false);
    });

    it('takes the lock before its first read and releases it when the bookkeeping read fails', async () => {
        const { query: inner, state } = fakeDatabase();
        const query = async (text, params) => {
            if (text === 'SELECT name FROM myip_migrations') throw new Error('read failed');
            return inner(text, params);
        };
        await assert.rejects(runMigrations({ query, migrations: MIGRATIONS, logger: fakeLogger() }), /read failed/);
        assert.ok(state.log[0].startsWith('SELECT pg_advisory_lock'));
        assert.equal(state.lockHeld, false);
    });

    it('rejects a malformed migration name before touching the database', async () => {
        const { query, state } = fakeDatabase();
        await assert.rejects(
            runMigrations({ query, migrations: [{ name: 'users', sql: 'x' }], logger: fakeLogger() }),
            /Malformed migration filename/,
        );
        assert.equal(state.log.length, 0);
    });
});

describe('createUserStorage', () => {
    it('with DATABASE_URL unset, boot, request checks and the guard path load nothing', async () => {
        const pg = fakePg();
        let reads = 0;
        const storage = createUserStorage({ env: {}, load: pg.load, readMigrations: async () => { reads += 1; return []; } });
        assert.equal(await storage.bootCheck(), false);
        assert.equal(await storage.ensureReady(), false);
        await assert.rejects(storage.getDb(), /not configured/);
        assert.equal(storage.isReady(), false);
        assert.equal(pg.calls.loads, 0);
        assert.equal(reads, 0);
    });

    it('boot migrates on a dedicated connection it then closes, and builds one small bounded pool', async () => {
        const pg = fakePg();
        const storage = storageOver(pg);
        assert.equal(storage.isReady(), false);
        assert.equal(await storage.bootCheck(), true);
        assert.equal(storage.isReady(), true);
        assert.equal(await storage.ensureReady(), true);
        assert.deepEqual([...pg.db.state.committed], ['0001_a', '0002_b', '0003_c']);
        assert.deepEqual(pg.calls.released, [true]);
        assert.equal(pg.calls.pools, 1);
        assert.equal(pg.calls.errorListeners, 1);
        assert.equal(pg.calls.options.connectionString, CONFIGURED.DATABASE_URL);
        assert.ok(pg.calls.options.max < 10);
        assert.ok(pg.calls.options.connectionTimeoutMillis > 0);
    });

    it('the db handle exposes query and transaction, not the pool', async () => {
        const pg = fakePg();
        const storage = storageOver(pg);
        await storage.bootCheck();
        const db = await storage.getDb();
        assert.deepEqual(Object.keys(db).sort(), ['query', 'transaction']);
        assert.equal(await storage.getDb(), db);
    });

    it('a transaction commits, or rolls back and rethrows', async () => {
        const seen = [];
        const client = { query: async (text) => { seen.push(text); return { rows: [] }; }, release: () => {} };
        const Pool = class { on() {} async connect() { return client; } };
        const storage = createUserStorage({ env: CONFIGURED, load: async () => Pool, readMigrations: async () => [] });
        const db = await storage.getDb();
        assert.equal(await db.transaction(async (query) => { await query('SELECT 1'); return 'done'; }), 'done');
        assert.deepEqual(seen, ['BEGIN', 'SELECT 1', 'COMMIT']);
        seen.length = 0;
        await assert.rejects(db.transaction(async () => { throw new Error('nope'); }), /nope/);
        assert.deepEqual(seen, ['BEGIN', 'ROLLBACK']);
    });

    it('a failed migration leaves storage not ready, without throwing', async () => {
        const pg = fakePg({ fail: new Set([MIGRATIONS[1].sql]) });
        const storage = storageOver(pg);
        assert.equal(await storage.bootCheck(), false);
        assert.equal(storage.isReady(), false);
        assert.deepEqual(pg.calls.released, [true]);
    });

    it('an unreachable database or a failing loader leaves storage not ready, without throwing', async () => {
        assert.equal(await storageOver(fakePg({ down: true })).bootCheck(), false);
        const storage = createUserStorage({ env: CONFIGURED, load: async () => { throw new Error('no driver'); } });
        assert.equal(await storage.bootCheck(), false);
    });

    it('re-runs the boot sequence only after the cooldown', async () => {
        let clock = 1_000;
        const pg = fakePg({ fail: new Set([MIGRATIONS[1].sql]) });
        const storage = storageOver(pg, { now: () => clock, retryMs: 30_000 });
        assert.equal(await storage.bootCheck(), false);
        pg.db.state.log.length = 0;
        clock += 29_999;
        assert.equal(await storage.ensureReady(), false);
        assert.equal(pg.db.state.log.length, 0);
        clock += 1;
        assert.equal(await storage.ensureReady(), false);
        assert.ok(pg.db.state.log.length > 0);
    });

    it('recovers on a later re-check once the database answers', async () => {
        let clock = 0;
        let up = false;
        const pg = fakePg();
        const storage = createUserStorage({
            env: CONFIGURED, load: pg.load, now: () => clock,
            readMigrations: async () => { if (!up) throw new Error('down'); return MIGRATIONS; },
        });
        assert.equal(await storage.bootCheck(), false);
        up = true;
        clock += 30_000;
        assert.equal(await storage.ensureReady(), true);
    });

    it('concurrent checks share one run', async () => {
        const pg = fakePg();
        const storage = storageOver(pg);
        const results = await Promise.all([storage.ensureReady(), storage.ensureReady(), storage.bootCheck()]);
        assert.deepEqual(results, [true, true, true]);
        assert.equal(pg.db.state.log.filter((text) => text.startsWith('SELECT pg_advisory_lock')).length, 1);
    });

    it('a lost connection on a query sends the guard back to its cooldown; an SQL error does not', async () => {
        let clock = 0;
        // Migrations (on connect) succeed; pool queries throw `queryError`.
        const storageThrowing = (queryError) => createUserStorage({
            env: CONFIGURED, now: () => clock, readMigrations: async () => [],
            load: async () => class {
                on() {}
                async connect() { return { query: async () => ({ rows: [] }), release: () => {} }; }
                async query() { throw queryError; }
            },
        });

        const sqlError = storageThrowing(Object.assign(new Error('duplicate key'), { severity: 'ERROR', code: '23505' }));
        assert.equal(await sqlError.bootCheck(), true);
        await assert.rejects((await sqlError.getDb()).query('SELECT 1'));
        assert.equal(sqlError.isReady(), true);

        const lost = storageThrowing(new Error('Connection terminated unexpectedly'));
        assert.equal(await lost.bootCheck(), true);
        await assert.rejects((await lost.getDb()).query('SELECT 1'));
        assert.equal(lost.isReady(), false);
        assert.equal(await lost.ensureReady(), false);
        clock += 30_000;
        assert.equal(await lost.ensureReady(), true);
    });

    it('close ends the pool', async () => {
        const pg = fakePg();
        const storage = storageOver(pg);
        await storage.bootCheck();
        await storage.close();
        assert.equal(pg.calls.ended, 1);
        assert.equal(storage.isReady(), false);
    });
});

describe('isConnectionLoss', () => {
    it('counts errors without a server answer and connection-class SQLSTATEs', () => {
        assert.equal(isConnectionLoss(Object.assign(new Error('x'), { code: 'ECONNRESET' })), true);
        assert.equal(isConnectionLoss(new Error('timeout exceeded when trying to connect')), true);
        assert.equal(isConnectionLoss({ severity: 'FATAL', code: '57P01' }), true);
        assert.equal(isConnectionLoss({ severity: 'FATAL', code: '08006' }), true);
        assert.equal(isConnectionLoss({ severity: 'ERROR', code: '23505' }), false);
        assert.equal(isConnectionLoss({ severity: 'ERROR', code: '42P01' }), false);
    });
});

describe('ensureUser', () => {
    // An in-memory users table answering the repository's two statements.
    const fakeQuery = () => {
        const rows = new Map();
        const calls = [];
        const query = async (text, params) => {
            calls.push({ text, params });
            if (text === 'INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING') {
                if (!rows.has(params[0])) rows.set(params[0], { id: params[0], created_at: new Date() });
                return { rows: [] };
            }
            if (text === 'SELECT id, created_at FROM users WHERE id = $1') {
                return { rows: rows.has(params[0]) ? [rows.get(params[0])] : [] };
            }
            throw new Error(`unexpected SQL: ${text}`);
        };
        return { query, rows, calls };
    };

    it('creates the row once and returns the same row afterwards', async () => {
        const db = fakeQuery();
        const first = await ensureUser(db.query, 'user-1');
        const second = await ensureUser(db.query, 'user-1');
        assert.equal(first.id, 'user-1');
        assert.deepEqual(second, first);
        assert.equal(db.rows.size, 1);
    });

    it('passes the id only as a parameter', async () => {
        const db = fakeQuery();
        const id = "x'); DROP TABLE users; --";
        await ensureUser(db.query, id);
        assert.ok(db.calls.every(({ text, params }) => !text.includes(id) && params[0] === id));
    });

    it('returns only the id and creation time', async () => {
        const row = await ensureUser(fakeQuery().query, 'user-2');
        assert.deepEqual(Object.keys(row).sort(), ['createdAt', 'id']);
        assert.ok(row.createdAt instanceof Date);
    });

    it('rejects a missing or non-string id before touching the db', async () => {
        const db = fakeQuery();
        for (const id of [undefined, '', 42]) {
            await assert.rejects(ensureUser(db.query, id), TypeError);
        }
        assert.equal(db.calls.length, 0);
    });
});

describe('/api/configs userStorage', () => {
    const run = () => {
        const res = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(b) { this.body = b; return this; } };
        configsHandler({ method: 'GET' }, res);
        return res.body;
    };

    it('reports configured, not ready', () => {
        const saved = process.env.DATABASE_URL;
        try {
            delete process.env.DATABASE_URL;
            assert.equal(run().userStorage, false);
            process.env.DATABASE_URL = 'postgres://fake';
            assert.equal(run().userStorage, true);
        } finally {
            if (saved === undefined) delete process.env.DATABASE_URL;
            else process.env.DATABASE_URL = saved;
        }
    });
});

describe('achievement and feature-use migrations', () => {
    // Pinned: the shapes other tooling (data migrations) is written against.
    const tableOf = (sql) => sql.split('\n').filter((line) => !line.startsWith('--')).join(' ').replace(/\s+/g, ' ').trim();

    it('0002 creates achievements and 0003 feature_uses, exactly', async () => {
        const byName = Object.fromEntries((await readMigrationFiles()).map(({ name, sql }) => [name, sql]));
        assert.equal(tableOf(byName['0002_achievements']), 'CREATE TABLE achievements ( user_id text NOT NULL REFERENCES users(id), '
            + 'name text NOT NULL, achieved_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, name) );');
        assert.equal(tableOf(byName['0003_feature_uses']), 'CREATE TABLE feature_uses ( user_id text NOT NULL REFERENCES users(id), '
            + 'feature text NOT NULL, times integer NOT NULL DEFAULT 0, PRIMARY KEY (user_id, feature) );');
    });
});

describe('achievements repository', () => {
    it('unlocks once, keeps the first time on a repeat, and lists in unlock order', async () => {
        const stamps = [new Date(1000), new Date(2000), new Date(3000)];
        const db = fakeUserDb({ now: () => stamps.shift() });
        await ensureUser(db.query, 'u');
        const first = await unlockAchievement(db.query, 'u', 'CuriousCat');
        const repeat = await unlockAchievement(db.query, 'u', 'CuriousCat');
        await unlockAchievement(db.query, 'u', 'IAmHuman');
        assert.deepEqual(first, { name: 'CuriousCat', achievedAt: new Date(2000) });
        assert.deepEqual(repeat, first);
        assert.deepEqual(await listAchievements(db.query, 'u'), [
            { name: 'CuriousCat', achievedAt: new Date(2000) },
            { name: 'IAmHuman', achievedAt: new Date(3000) },
        ]);
        assert.deepEqual(await listAchievements(db.query, 'other'), []);
    });

    it('passes values only as parameters', async () => {
        const db = fakeUserDb();
        const id = "x'); DROP TABLE achievements; --";
        await ensureUser(db.query, id);
        await unlockAchievement(db.query, id, 'IAmHuman');
        await listAchievements(db.query, id);
        assert.ok(db.calls.every(({ text }) => !text.includes(id)));
    });
});

describe('feature-uses repository', () => {
    it('names the five counted features', () => {
        assert.deepEqual(Object.values(FEATURE_USES).sort(), ['ipdb:ipchecking', 'tool:dnsleaktest', 'tool:invisibility', 'tool:ipblocklist', 'tool:persona']);
        assert.ok(Object.isFrozen(FEATURE_USES));
    });

    it('counts per user and feature, creating the users row, and sums over features', async () => {
        const db = fakeUserDb();
        assert.equal(await sumFeatureUses(db.query, 'u'), 0);
        await recordFeatureUse(db.query, 'u', FEATURE_USES.persona);
        await recordFeatureUse(db.query, 'u', FEATURE_USES.persona);
        await recordFeatureUse(db.query, 'u', FEATURE_USES.ipblocklist);
        await recordFeatureUse(db.query, 'v', FEATURE_USES.persona);
        assert.ok(db.users.has('u') && db.users.has('v'));
        assert.equal(await sumFeatureUses(db.query, 'u'), 3);
        assert.equal(await sumFeatureUses(db.query, 'v'), 1);
        assert.ok(db.calls.every(({ text }) => !text.includes("'u'")));
    });

    it('rejects a feature outside the list before touching the db', async () => {
        const db = fakeUserDb();
        await assert.rejects(recordFeatureUse(db.query, 'u', 'invisibility_' + 'test'), TypeError);
        assert.equal(db.calls.length, 0);
    });
});

describe('countFeatureUse middleware', () => {
    // Runs the middleware, then "answers" with `status` and emits finish.
    const answer = (middleware, { status = 200, userId = 'u' } = {}) => {
        const res = new EventEmitter();
        res.locals = userId ? { userId } : {};
        let advanced = false;
        middleware({}, res, () => { advanced = true; });
        assert.equal(advanced, true, 'next() runs at once');
        res.statusCode = status;
        res.emit('finish');
    };
    const settle = () => new Promise((resolve) => setImmediate(resolve));

    it('counts a signed-in answer below 400, once per answer', async () => {
        const db = fakeUserDb();
        const middleware = countFeatureUse(FEATURE_USES.invisibility, { storage: fakeStorage(db) });
        answer(middleware);
        answer(middleware, { status: 304 });
        await settle();
        assert.equal(db.uses.get(`u\u0000${FEATURE_USES.invisibility}`), 2);
    });

    it('never counts a guest, a failed answer, or without ready storage', async () => {
        const db = fakeUserDb();
        answer(countFeatureUse(FEATURE_USES.persona, { storage: fakeStorage(db) }), { userId: null });
        for (const status of [400, 403, 429, 500, 502]) {
            answer(countFeatureUse(FEATURE_USES.persona, { storage: fakeStorage(db) }), { status });
        }
        answer(countFeatureUse(FEATURE_USES.persona, { storage: fakeStorage(db, { configured: false }) }));
        answer(countFeatureUse(FEATURE_USES.persona, { storage: fakeStorage(db, { ready: false }) }));
        await settle();
        assert.equal(db.calls.length, 0);
    });

    it('a failing write never throws; it is only logged', async () => {
        const failing = { query: async () => { throw new Error('connection reset'); } };
        const middleware = countFeatureUse(FEATURE_USES.ipblocklist, { storage: fakeStorage(failing) });
        const rejections = [];
        const onRejection = (err) => rejections.push(err);
        process.on('unhandledRejection', onRejection);
        try {
            answer(middleware);
            await settle();
            await settle();
        } finally {
            process.off('unhandledRejection', onRejection);
        }
        assert.deepEqual(rejections, []);
    });

    it('refuses an unknown feature when the route is built', () => {
        assert.throws(() => countFeatureUse('ipinfo'), TypeError);
    });
});
