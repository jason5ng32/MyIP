// Applies the numbered SQL migrations in server/db/migrations/ once each, one process at a time.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIGRATIONS_DIR = fileURLToPath(new URL('./migrations/', import.meta.url));

// Session-level advisory lock key: 'myipmigr' read as a bigint.
export const MIGRATION_LOCK_KEY = '7888452153909012338';

const MIGRATION_FILE = /^(\d{4,})_[a-z0-9_]+\.sql$/;

// Migration names (`0001_users`) from `.sql` filenames, in numeric-prefix order; a malformed or repeated number throws.
export const orderMigrations = (filenames) => {
    const parsed = filenames.map((filename) => {
        const match = MIGRATION_FILE.exec(filename);
        if (!match) throw new Error(`Malformed migration filename: ${filename}`);
        return { filename, number: Number(match[1]), name: filename.slice(0, -'.sql'.length) };
    });
    parsed.sort((a, b) => a.number - b.number);
    parsed.forEach((entry, i) => {
        if (i > 0 && entry.number === parsed[i - 1].number) {
            throw new Error(`Duplicate migration number: ${parsed[i - 1].filename}, ${entry.filename}`);
        }
    });
    return parsed;
};

// `[{ name, sql }]` for every `.sql` file in the directory, in order.
export const readMigrationFiles = async (dir = MIGRATIONS_DIR) => {
    const filenames = (await readdir(dir)).filter((name) => name.endsWith('.sql'));
    return Promise.all(orderMigrations(filenames).map(async ({ filename, name }) => ({
        name,
        sql: await readFile(join(dir, filename), 'utf8'),
    })));
};

/**
 * Runs the pending migrations over `query`, which must stay on one connection
 * (the advisory lock and each transaction belong to it). Each file commits
 * together with its bookkeeping row; a failure rolls that file back and
 * throws, leaving later files untouched. Resolves with the applied names.
 */
export const runMigrations = async ({ query, migrations, logger }) => {
    const ordered = orderMigrations(migrations.map(({ name }) => `${name}.sql`));
    const sqlByName = new Map(migrations.map(({ name, sql }) => [name, sql]));
    const applied = [];

    await query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    try {
        await query(`CREATE TABLE IF NOT EXISTS myip_migrations (
            name text PRIMARY KEY,
            applied_at timestamptz NOT NULL DEFAULT now()
        )`);
        const { rows } = await query('SELECT name FROM myip_migrations');
        const recorded = new Set(rows.map((row) => row.name));

        for (const name of recorded) {
            if (!sqlByName.has(name)) {
                logger.warn({ migration: name }, `⚠️  User storage: migration ${name} is recorded in the database but missing here; the database is newer than this code`);
            }
        }

        for (const { name } of ordered) {
            if (recorded.has(name)) continue;
            await query('BEGIN');
            try {
                await query(sqlByName.get(name));
                await query('INSERT INTO myip_migrations (name) VALUES ($1)', [name]);
                await query('COMMIT');
            } catch (err) {
                await query('ROLLBACK').catch(() => {});
                err.migration = name;
                throw err;
            }
            applied.push(name);
            logger.info({ migration: name }, `📦 User storage: applied migration ${name}`);
        }
    } finally {
        await query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch(() => {});
    }
    return applied;
};
