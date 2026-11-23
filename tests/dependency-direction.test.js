// Guards the import direction between the repo's layers (see "Dependency
// direction" in AGENTS.md): scans every source file's imports — relative,
// `@/` and package ones — and fails on an edge the rules forbid. Package
// edges count only for rules marked `packages`. Known exceptions live in
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

// HTML comments (an unterminated one runs to the end), cut by index.
const stripHtmlComments = (source) => {
    let out = '';
    let at = 0;
    for (let open = source.indexOf('<!--'); open !== -1; open = source.indexOf('<!--', at)) {
        out += source.slice(at, open);
        const close = source.indexOf('-->', open + 4);
        if (close === -1) return out;
        at = close + 3;
    }
    return out + source.slice(at);
};

// Whole-line JS comments only: a `//` inside a string (a URL) stays put.
const stripComments = (source) => stripHtmlComments(source)
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n');

const SPECIFIER_PATTERNS = [
    /\bfrom\s*['"]([^'"]+)['"]/g, // import … from / export … from
    /\bimport\s*['"]([^'"]+)['"]/g, // side-effect import
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // dynamic import()
    /\bimport\.meta\.glob\(\s*['"]([^'"]+)['"]/g, // Vite glob
];

// Every import specifier a source names, comments aside.
const specifiersOf = (source) => {
    const clean = stripComments(source);
    return [...new Set(SPECIFIER_PATTERNS.flatMap((pattern) => [...clean.matchAll(pattern)].map((match) => match[1])))];
};

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

// `{ from, to, pkg }` per import: `to` is the repo path, or the bare
// specifier of a package (`pkg: true`).
const edgesOf = (from, source) => specifiersOf(source).map((specifier) => {
    const to = resolveSpecifier(from, specifier);
    return to ? { from, to, pkg: false } : { from, to: specifier, pkg: true };
});

const collectEdges = () => SCAN_DIRS.flatMap(listSources)
    .flatMap((from) => edgesOf(from, readFileSync(join(ROOT, from), 'utf8')));

// --- rules ------------------------------------------------------------------

const under = (path, dir) => path === dir || path.startsWith(`${dir}/`);

const UTILS_FORBIDDEN = [
    'frontend/composables', 'frontend/components', 'frontend/router', 'frontend/store.js',
    'frontend/App.vue', 'frontend/main.js', 'frontend/firebase-init.js', 'frontend/sentry-init.js',
];

// Each rule: which importers it covers, whether a target breaks it, and
// whether package imports count (`packages`).
const RULES = [
    {
        name: 'common/ imports only common/',
        applies: (from) => under(from, 'common'),
        breaks: (to) => !under(to, 'common'),
    },
    {
        name: 'common/codes/ imports nothing, packages included',
        applies: (from) => under(from, 'common/codes'),
        breaks: () => true,
        packages: true,
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
        name: 'frontend/utils/codes/ imports only common/codes/ and utils/codes/, no packages',
        applies: (from) => under(from, 'frontend/utils/codes'),
        breaks: (to) => !under(to, 'common/codes') && !under(to, 'frontend/utils/codes'),
        packages: true,
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

const allows = (entry, edge) => !edge.pkg && edge.from === entry.from && under(edge.to, entry.to);

const breaksRule = (rule, edge) => (rule.packages || !edge.pkg) && rule.applies(edge.from) && rule.breaks(edge.to);

const violationsOf = (rule, edges) => edges
    .filter((edge) => breaksRule(rule, edge))
    .filter((edge) => !ALLOWED_EDGES.some((entry) => allows(entry, edge)))
    .map((edge) => `${edge.from} → ${edge.to}`);

// --- tests ------------------------------------------------------------------

describe('dependency direction', () => {
    const edges = collectEdges();

    it('scans the source tree', () => {
        const local = edges.filter((edge) => !edge.pkg).length;
        assert.ok(local > 100, `only ${local} local imports found`);
        assert.ok(edges.some((edge) => edge.pkg), 'no package imports found');
    });

    it('reads every specifier form, packages included, comments aside', () => {
        const source = [
            '<!-- import gone from \'./html.js\' -->',
            "import { ref } from 'vue';",
            '// import gone from \'./line.js\';',
            "export { x } from './x.js';",
            "import './side.css';",
            "const lazy = () => import('@/lazy.vue');",
            "const parts = import.meta.glob('./parts/*.vue');",
            '<!-- unterminated',
            "import gone from './after.js';",
        ].join('\n');
        assert.deepEqual(specifiersOf(source).sort(),
            ['./parts/*.vue', './side.css', './x.js', '@/lazy.vue', 'vue'].sort());
    });

    it('a package import breaks a `packages` rule only', () => {
        const fake = edgesOf('common/codes/fake.js', "import { ref } from 'vue';\nimport { x } from '../valid-ip.js';");
        assert.deepEqual(fake.map((edge) => edge.pkg), [true, false]);
        const codesRule = RULES.find((rule) => rule.applies('common/codes/fake.js') && rule.packages);
        assert.deepEqual(violationsOf(codesRule, fake), ['common/codes/fake.js → vue', 'common/codes/fake.js → common/valid-ip.js']);
        const commonRule = RULES.find((rule) => rule.name === 'common/ imports only common/');
        assert.deepEqual(violationsOf(commonRule, fake), []);
    });

    // An unresolved path would slip past every rule below; globs excepted.
    it('every local import resolves to a file', () => {
        const missing = edges.filter(({ to, pkg }) => !pkg && !to.includes('*')
            && !(existsSync(join(ROOT, to)) && statSync(join(ROOT, to)).isFile()))
            .map((edge) => `${edge.from} → ${edge.to}`);
        assert.deepEqual(missing, []);
    });

    for (const rule of RULES) {
        it(rule.name, () => {
            assert.deepEqual(violationsOf(rule, edges), []);
        });
    }

    it('every allowlisted edge still exists and still breaks a rule', () => {
        const stale = ALLOWED_EDGES.filter((entry) => !edges.some((edge) => allows(entry, edge)
            && RULES.some((rule) => breaksRule(rule, edge))))
            .map((entry) => `${entry.from} → ${entry.to}`);
        assert.deepEqual(stale, []);
    });
});
