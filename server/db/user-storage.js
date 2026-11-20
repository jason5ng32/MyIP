// Optional Postgres user storage: the env gate, a lazily loaded pg pool, boot migrations and readiness state.
import logger from '../logger.js';
import { readMigrationFiles, runMigrations } from './migrate.js';

// Pure env check: storage exists only when DATABASE_URL is set.
export const isUserStorageConfigured = (env = process.env) => Boolean(env.DATABASE_URL);

// Which half of the account setup is missing when exactly one is configured, else null.
export const accountSetupGap = (env = process.env) => {
    const signIn = Boolean(env.VITE_FIREBASE_PROJECT_ID);
    const storage = isUserStorageConfigured(env);
    if (signIn === storage) return null;
    return signIn ? 'DATABASE_URL' : 'VITE_FIREBASE_PROJECT_ID';
};

// The only way pg is reached: dynamically, on first use.
const loadPool = async () => (await import('pg')).default.Pool;

const POOL_MAX = 5;
const CONNECT_TIMEOUT_MS = 5_000;

// No answer from the server (network, timeout) or a connection-class SQLSTATE.
export const isConnectionLoss = (err) => !err?.severity || /^(08|57P0)/.test(err.code ?? '');

// One storage instance; `load`, `readMigrations` and `now` are the seams specs replace.
export const createUserStorage = ({
    env = process.env, load = loadPool, readMigrations = readMigrationFiles, now = Date.now, retryMs = 30_000,
} = {}) => {
    let pool = null;
    let handle = null;
    let ready = false;
    let checking = null;
    let lastCheckAt = -Infinity;

    const isConfigured = () => isUserStorageConfigured(env);

    // Creating the pool opens no connection; a bounded connect keeps a blackholed host from hanging a request.
    const getPool = async () => {
        if (!isConfigured()) throw new Error('User storage is not configured');
        if (!pool) {
            const Pool = await load();
            pool = new Pool({ connectionString: env.DATABASE_URL, max: POOL_MAX, connectionTimeoutMillis: CONNECT_TIMEOUT_MS });
            pool.on('error', (err) => logger.warn({ err }, 'User storage: idle connection error'));
        }
        return pool;
    };

    // A lost connection sends the guard back to its cooldown re-check.
    const noteFailure = (err) => {
        if (!ready || !isConnectionLoss(err)) return;
        ready = false;
        lastCheckAt = now();
        logger.warn({ err }, 'User storage: connection lost; account data features answer 503 until a re-check succeeds');
    };

    // Runs a database call, noting a lost connection on the way out.
    const watched = async (call) => {
        try {
            return await call();
        } catch (err) {
            noteFailure(err);
            throw err;
        }
    };

    // `fn(query)` on one pooled connection; one that failed (or `discard`) is closed, not reused.
    const withClient = async (fn, { discard = false } = {}) => {
        const connectedPool = await getPool();
        const client = await watched(() => connectedPool.connect());
        let failed = false;
        try {
            return await fn((text, params) => watched(() => client.query(text, params)));
        } catch (err) {
            failed = true;
            throw err;
        } finally {
            client.release(discard || failed);
        }
    };

    // What repositories get: parameterised queries and transactions, never the pool.
    const getDb = async () => {
        const current = await getPool();
        handle ??= {
            query: (text, params) => watched(() => current.query(text, params)),
            transaction: (fn) => withClient(async (query) => {
                await query('BEGIN');
                try {
                    const result = await fn(query);
                    await query('COMMIT');
                    return result;
                } catch (err) {
                    await query('ROLLBACK').catch(() => {});
                    throw err;
                }
            }),
        };
        return handle;
    };

    // Pending migrations on a dedicated connection, closed afterwards so no session lock outlives the run.
    const migrate = async () => {
        const migrations = await readMigrations();
        return withClient((query) => runMigrations({ query, migrations, logger }), { discard: true });
    };

    // Migrations up to date, which also proves the connection; resolves with the readiness verdict.
    const runCheck = async ({ boot }) => {
        lastCheckAt = now();
        try {
            await migrate();
            ready = true;
            logger.info(boot ? '📦 User storage ready' : 'User storage ready');
        } catch (err) {
            ready = false;
            if (!boot) {
                logger.debug({ err }, 'User storage still not ready');
            } else if (err.migration) {
                logger.error({ err, migration: err.migration }, `❌ User storage: migration ${err.migration} failed and was rolled back; account data features answer 503 until it applies`);
            } else {
                logger.warn({ err }, '⚠️  User storage not ready (check DATABASE_URL and the database); account data features answer 503 until it is');
            }
        }
        return ready;
    };

    const check = (opts) => {
        checking ??= runCheck(opts).finally(() => { checking = null; });
        return checking;
    };

    // Boot: migrate when configured; never throws, never loads pg otherwise.
    const bootCheck = async () => (isConfigured() ? check({ boot: true }) : false);

    // Request path: ready, or re-check once the cooldown has passed.
    const ensureReady = async () => {
        if (!isConfigured()) return false;
        if (ready) return true;
        if (checking) return checking;
        if (now() - lastCheckAt < retryMs) return false;
        return check({ boot: false });
    };

    // Ends the pool (specs and shutdown).
    const close = async () => {
        const current = pool;
        pool = null;
        handle = null;
        ready = false;
        if (current) await current.end();
    };

    return { isConfigured, isReady: () => ready, getDb, migrate, bootCheck, ensureReady, close };
};

// The deployment's storage, reading process.env live.
export const userStorage = createUserStorage();
