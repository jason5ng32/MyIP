// Keeps the database driver optional: only server/db/ may name pg, only through dynamic import(), and no ORM rides the manifests.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Tracked code only: gitignored deploy-time data (banners, dataset dirs) stays out of the scan.
const SCAN_DIRS = ['frontend', 'api', 'server', 'common', 'tests'];
const SKIP = new Set(['node_modules', 'frontend/locales', 'frontend/data/banners']);
const SKIP_DIR = /^common\/[^/]+-db$/;
const SOURCE_EXT = /\.(js|mjs|cjs|vue)$/;
const DB_DIR = 'server/db/';
const DRIVER_PACKAGES = /^pg(-[a-z-]+)?(\/|$)/;

const toPosix = (path) => path.split(sep).join('/');

const listSources = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = toPosix(join(dir, entry.name));
    if (entry.isDirectory()) {
        return SKIP.has(path) || SKIP.has(entry.name) || SKIP_DIR.test(path) ? [] : listSources(path);
    }
    return SOURCE_EXT.test(entry.name) ? [path] : [];
});

const rootSources = () => readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && SOURCE_EXT.test(entry.name))
    .map((entry) => entry.name);

// Whole-line comments only, like tests/dependency-direction.test.js.
const stripComments = (source) => source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n');

const STATIC_PATTERNS = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];
const DYNAMIC_PATTERN = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const specifiers = (source, patterns) => patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((m) => m[1]));

// `{ file, specifier, dynamic }` for every driver import in the scan.
const driverImports = () => [...SCAN_DIRS.flatMap(listSources), ...rootSources()].flatMap((file) => {
    const source = stripComments(readFileSync(join(ROOT, file), 'utf8'));
    return [
        ...specifiers(source, STATIC_PATTERNS).map((specifier) => ({ file, specifier, dynamic: false })),
        ...specifiers(source, [DYNAMIC_PATTERN]).map((specifier) => ({ file, specifier, dynamic: true })),
    ].filter(({ specifier }) => DRIVER_PACKAGES.test(specifier));
});

describe('pg boundary', () => {
    const found = driverImports();

    it('no file outside server/db/ imports pg', () => {
        assert.deepEqual(found.filter(({ file }) => !file.startsWith(DB_DIR)), []);
    });

    it('server/db/ reaches it only through dynamic import()', () => {
        assert.deepEqual(found.filter(({ dynamic }) => !dynamic), []);
    });

    it('the scan sees the dynamic import it guards', () => {
        assert.deepEqual(found.map(({ specifier }) => specifier), ['pg']);
    });
});

describe('no ORM in the manifests', () => {
    const ORM = /prisma/i;
    const read = (file) => readFileSync(join(ROOT, file), 'utf8');

    it('package.json declares no such dependency or script', () => {
        const pkg = JSON.parse(read('package.json'));
        const names = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
        assert.deepEqual(names.filter((name) => ORM.test(name)), []);
        assert.deepEqual(Object.entries(pkg.scripts ?? {}).filter(([, cmd]) => ORM.test(cmd)), []);
    });

    it('pnpm-workspace.yaml and pnpm-lock.yaml carry none of its packages', () => {
        for (const file of ['pnpm-workspace.yaml', 'pnpm-lock.yaml']) {
            assert.equal(ORM.test(read(file)), false, file);
        }
    });
});
