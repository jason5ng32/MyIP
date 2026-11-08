// Guards the import direction between the repo's layers (see "Dependency
// direction" in AGENTS.md): scans every source file's relative and `@/`
// imports and fails on an edge the rules forbid. Known exceptions live in
// ALLOWED_EDGES, each with its reason; one that no longer exists fails too.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['frontend', 'common', 'server', 'api'];
const SKIP_DIRS = new Set(['node_modules', join('frontend', 'locales')]);
const SOURCE_EXT = /\.(js|mjs|vue)$/;
const RESOLVE_SUFFIXES = ['', '.js', '.mjs', '.vue', '/index.js'];

// --- scan -------------------------------------------------------------------

const toPosix = (path) => path.split(sep).join('/');

const listSources = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIP_DIRS.has(path) || SKIP_DIRS.has(entry.name) ? [] : listSources(path);
    return SOURCE_EXT.test(entry.name) ? [toPosix(path)] : [];
});

// Whole-line comments only: a `//` inside a string (a URL) stays put.
const stripComments = (source) => source
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n');

const SPECIFIER_PATTERNS = [
    /\bfrom\s*['"]([^'"]+)['"]/g, // import … from / export … from
    /\bimport\s*['"]([^'"]+)['"]/g, // side-effect import
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // dynamic import()
    /\bimport\.meta\.glob\(\s*['"]([^'"]+)['"]/g, // Vite glob
];

// Repo-relative target of a local specifier, or null for a package.
const resolveSpecifier = (from, specifier) => {
    const bare = specifier.split('?')[0];
    let base;
    if (bare.startsWith('@/')) base = join(ROOT, 'frontend', bare.slice(2));
    else if (bare.startsWith('.')) base = resolve(ROOT, dirname(from), bare);
    else return null;
    const hit = RESOLVE_SUFFIXES.map((suffix) => base + suffix)
        .find((path) => existsSync(path) && statSync(path).isFile());
    return toPosix(relative(ROOT, hit ?? base));
};

const collectEdges = () => SCAN_DIRS.flatMap(listSources).flatMap((from) => {
    const source = stripComments(readFileSync(join(ROOT, from), 'utf8'));
    const targets = new Set();
    for (const pattern of SPECIFIER_PATTERNS) {
        for (const match of source.matchAll(pattern)) {
            const to = resolveSpecifier(from, match[1]);
            if (to) targets.add(to);
        }
    }
    return [...targets].map((to) => ({ from, to }));
});

// --- rules ------------------------------------------------------------------

const under = (path, dir) => path === dir || path.startsWith(`${dir}/`);

const UTILS_FORBIDDEN = [
    'frontend/composables', 'frontend/components', 'frontend/router', 'frontend/store.js',
    'frontend/App.vue', 'frontend/main.js', 'frontend/firebase-init.js', 'frontend/sentry-init.js',
];

// Each rule: which importers it covers, and whether a target breaks it.
const RULES = [
    {
        name: 'common/ imports only common/',
        applies: (from) => under(from, 'common'),
        breaks: (to) => !under(to, 'common'),
    },
    {
        name: 'common/codes/ imports nothing',
        applies: (from) => under(from, 'common/codes'),
        breaks: () => true,
    },
    {
        name: 'server/ imports nothing from api/ or frontend/',
        applies: (from) => under(from, 'server'),
        breaks: (to) => under(to, 'api') || under(to, 'frontend'),
    },
    {
        name: 'only frontend/utils/ imports common/ (through bridges)',
        applies: (from) => under(from, 'frontend') && !under(from, 'frontend/utils'),
        breaks: (to) => under(to, 'common'),
    },
    {
        name: 'frontend/utils/ imports no app layer (composables, components, store, router, entry points)',
        applies: (from) => under(from, 'frontend/utils'),
        breaks: (to) => UTILS_FORBIDDEN.some((dir) => under(to, dir)),
    },
    {
        name: 'frontend/utils/codes/ imports only common/codes/ and utils/codes/',
        applies: (from) => under(from, 'frontend/utils/codes'),
        breaks: (to) => !under(to, 'common/codes') && !under(to, 'frontend/utils/codes'),
    },
    {
        name: 'frontend/data/ imports only frontend/data/',
        applies: (from) => under(from, 'frontend/data'),
        breaks: (to) => !under(to, 'frontend/data'),
    },
    {
        name: 'frontend/utils/ip/ imports nothing from utils/features/ or utils/report/',
        applies: (from) => under(from, 'frontend/utils/ip'),
        breaks: (to) => under(to, 'frontend/utils/features') || under(to, 'frontend/utils/report'),
    },
    {
        name: 'frontend/utils/report/ imports nothing from utils/features/',
        applies: (from) => under(from, 'frontend/utils/report'),
        breaks: (to) => under(to, 'frontend/utils/features'),
    },
    {
        name: 'frontend/components/ui/ imports nothing from the store',
        applies: (from) => under(from, 'frontend/components/ui'),
        breaks: (to) => under(to, 'frontend/store.js'),
    },
];

// Known exceptions: `to` matches the target exactly or as a directory prefix.
const ALLOWED_EDGES = [
    {
        from: 'frontend/utils/authenticated-fetch.js', to: 'frontend/store.js',
        reason: 'reads the signed-in user\'s token from the store',
    },
    {
        from: 'frontend/data/tools.js', to: 'frontend/components/advanced-tools',
        reason: 'the tool registry carries each page\'s lazy component loader',
    },
    {
        from: 'frontend/components/ui/tooltip/JnTooltip.vue', to: 'frontend/store.js',
        reason: 'project-specific tooltip reads the mobile flag from the store',
    },
    {
        from: 'frontend/components/ui/sonner/Sonner.vue', to: 'frontend/store.js',
        reason: 'toaster follows the store\'s dark mode',
    },
];

const allows = (entry, edge) => edge.from === entry.from && under(edge.to, entry.to);

// --- tests ------------------------------------------------------------------

describe('dependency direction', () => {
    const edges = collectEdges();

    it('scans the source tree', () => {
        assert.ok(edges.length > 100, `only ${edges.length} local imports found`);
    });

    // An unresolved path would slip past every rule below; globs excepted.
    it('every local import resolves to a file', () => {
        const missing = edges.filter(({ to }) => !to.includes('*')
            && !(existsSync(join(ROOT, to)) && statSync(join(ROOT, to)).isFile()))
            .map((edge) => `${edge.from} → ${edge.to}`);
        assert.deepEqual(missing, []);
    });

    for (const rule of RULES) {
        it(rule.name, () => {
            const violations = edges
                .filter((edge) => rule.applies(edge.from) && rule.breaks(edge.to))
                .filter((edge) => !ALLOWED_EDGES.some((entry) => allows(entry, edge)))
                .map((edge) => `${edge.from} → ${edge.to}`);
            assert.deepEqual(violations, []);
        });
    }

    it('every allowlisted edge still exists and still breaks a rule', () => {
        const stale = ALLOWED_EDGES.filter((entry) => !edges.some((edge) => allows(entry, edge)
            && RULES.some((rule) => rule.applies(edge.from) && rule.breaks(edge.to))))
            .map((entry) => `${entry.from} → ${entry.to}`);
        assert.deepEqual(stale, []);
    });
});
