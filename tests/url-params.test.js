// Guards the global URL parameter registry (frontend/data/url-params.js):
// every query parameter the front end reads by name — `URLSearchParams(…)
// .get('<name>')` or `route.query.<name>` — is either registered there or a
// page-scoped one (a tool's shareable input), and the two never share a name.
// index.html and vite.config.js carry inline readers, so they are scanned too.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { URL_PARAMS } from '../frontend/data/url-params.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXTRA_FILES = ['index.html', 'vite.config.js'];

// Page-scoped parameters: read by one page only, never global.
const PAGE_PARAMS = ['q', 'vs'];

const READ_PATTERNS = [
    /URLSearchParams\([^)]*\)\.get\(\s*['"]([\w-]+)['"]\s*\)/g,
    /\broute\.query\.([A-Za-z_$][\w$]*)/g,
    /\broute\.query\[\s*['"]([\w-]+)['"]\s*\]/g,
];

// Every parameter name `source` reads.
const readsOf = (source) => [...new Set(READ_PATTERNS.flatMap((pattern) =>
    [...source.matchAll(pattern)].map((match) => match[1])))];

const listSources = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : listSources(path);
    return /\.(js|vue)$/.test(entry.name) ? [path] : [];
});

// `{ name → [files] }` over the front end and the inline readers.
const collectReads = () => {
    const reads = new Map();
    for (const path of [...listSources('frontend'), ...EXTRA_FILES]) {
        const file = path.split(sep).join('/');
        for (const name of readsOf(readFileSync(join(ROOT, path), 'utf8'))) {
            reads.set(name, [...(reads.get(name) ?? []), file]);
        }
    }
    return reads;
};

describe('global URL parameters', () => {
    const registered = URL_PARAMS.map((param) => param.name);
    const reads = collectReads();

    it('reads every form of a named parameter read', () => {
        const source = [
            "const a = new URLSearchParams(window.location.search).get('hl');",
            'const b = new URLSearchParams(search).get("festival");',
            'const c = route.query.q;',
            "const d = route.query['vs'];",
            'const e = params.get(name); const f = route.query;',
        ].join('\n');
        assert.deepEqual(readsOf(source).sort(), ['festival', 'hl', 'q', 'vs']);
    });

    it('scans the front end', () => {
        assert.ok(reads.has('hl') && reads.has('q'), `found only ${[...reads.keys()]}`);
        assert.ok(reads.get('hl').includes('index.html') && reads.get('hl').includes('vite.config.js'));
        assert.ok(reads.get('theme')?.includes('index.html'), 'index.html no longer reads ?theme=');
    });

    it('registers every parameter read outside a page', () => {
        for (const [name, files] of reads) {
            assert.ok(registered.includes(name) || PAGE_PARAMS.includes(name),
                `?${name}= is read in ${files.join(', ')} but not in frontend/data/url-params.js`);
        }
    });

    it('keeps page parameters out of the registry', () => {
        for (const name of PAGE_PARAMS) assert.ok(!registered.includes(name), `?${name}= is page-scoped`);
    });
});
