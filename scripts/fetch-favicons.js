// scripts/fetch-favicons.js — favicon fetcher for the Connectivity import
// lists (frontend/data/connectivity-import-lists.js). Committed tooling with
// two entry points: `pnpm fetch-favicons` runs the CLI, and
// tests/connectivity-import-lists.test.js imports fetchFavicons() to
// auto-download any icons missing locally. The PNGs it writes into
// public/favicons/ are committed, so the steady state needs no network.
// Tries the favicon services in order, accepts PNG payloads only, and
// detects each service's "unknown domain" default image by byte-comparison
// against a probe of a nonexistent domain — probed lazily, only once a
// fetch is actually attempted, so importing the module costs no network.
// Whatever still fails gets hand-sourced into public/favicons/<id>.png:
// any 64px PNG source works (on macOS, sips/qlmanage convert ICO/SVG).
//
// Usage: node scripts/fetch-favicons.js [--only id1,id2] [--force]
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { IMPORT_LISTS, BUILTIN_FAVICONS } from '../frontend/data/connectivity-import-lists.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(repoRoot, 'public', 'favicons');

// Every icon the site needs: built-in targets + all import-list members.
const buildTargets = () => [
    ...BUILTIN_FAVICONS,
    ...IMPORT_LISTS.flatMap((list) => list.members.map((m) => ({
        id: m.id,
        iconDomain: m.iconDomain || new URL(m.url).hostname,
    }))),
];

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const isPng = (buf) => buf.length > 8 && buf.subarray(0, 4).equals(PNG_MAGIC);

const fetchBuf = async (url) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
};

// Three tiers, PNG-only: s2 converts to PNG reliably; favicon.im passes the
// site's original format through (accepted only when that happens to be
// PNG); DDG serves PNGs for well-known domains. Non-PNG payloads (ICO/SVG)
// are rejected — hand-convert those.
const s2Url = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
const faviconImUrl = (domain) => `https://favicon.im/${domain}?larger=true`;
const ddgUrl = (domain) => `https://icons.duckduckgo.com/ip3/${domain}.ico`;

// Domain that cannot exist — each service's response for it is its
// "unknown" default image, recognizable afterwards by byte equality.
const PROBE_DOMAIN = 'nonexistent-domain-probe-4c1d2e.invalid';

// Fetch favicons for the given member ids (all targets when ids is null);
// existing files are kept unless `force`. Returns { written, skipped,
// failures } — failures carry { id, iconDomain, reason }.
export const fetchFavicons = async ({ ids = null, force = false, log = console.log } = {}) => {
    const only = new Set(ids || []);
    const queue = buildTargets().filter((t) => !only.size || only.has(t.id));

    await mkdir(outDir, { recursive: true });

    // Per-service default-image probe, memoized and lazy: first attempted
    // fetch per service triggers it, a fully-skipped run never touches
    // the network.
    const serviceDefaults = new Map();
    const defaultFor = (toUrl) => {
        if (!serviceDefaults.has(toUrl)) {
            serviceDefaults.set(toUrl, fetchBuf(toUrl(PROBE_DOMAIN)).catch(() => null));
        }
        return serviceDefaults.get(toUrl);
    };

    const failures = [];
    let written = 0;
    let skipped = 0;

    const fetchIcon = async ({ id, iconDomain }) => {
        const outPath = path.join(outDir, `${id}.png`);
        if (!force && existsSync(outPath)) {
            // Keep manually curated replacements; --force refetches everything.
            skipped += 1;
            return;
        }
        try {
            for (const toUrl of [s2Url, faviconImUrl, ddgUrl]) {
                const [buf, defaultBuf] = await Promise.all([
                    fetchBuf(toUrl(iconDomain)).catch(() => null),
                    defaultFor(toUrl),
                ]);
                if (buf && isPng(buf) && !(defaultBuf && buf.equals(defaultBuf))) {
                    await writeFile(outPath, buf);
                    written += 1;
                    return;
                }
            }
            failures.push({ id, iconDomain, reason: 'no usable PNG from s2/favicon.im/ddg' });
        } catch (err) {
            failures.push({ id, iconDomain, reason: err.message });
        }
    };

    // Small worker pool — polite to the icon services, still quick for ~140 ids.
    const CONCURRENCY = 6;
    let cursor = 0;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
        while (cursor < queue.length) {
            const next = queue[cursor];
            cursor += 1;
            await fetchIcon(next);
        }
    }));

    log(`favicons: ${written} written, ${skipped} kept, ${failures.length} failed (of ${queue.length})`);
    for (const f of failures) log(`  MISSING ${f.id} (${f.iconDomain}): ${f.reason}`);
    return { written, skipped, failures };
};

// CLI flow — only when executed directly, never on import.
const runCli = async () => {
    const { values: opts } = parseArgs({
        options: {
            only: { type: 'string', default: '' },
            force: { type: 'boolean', default: false },
        },
    });

    const ids = opts.only ? opts.only.split(',').map((s) => s.trim()) : null;
    const { failures } = await fetchFavicons({ ids, force: opts.force });
    if (failures.length) {
        console.log('Hand-source the missing ones into public/favicons/<id>.png (64px PNG).');
        process.exitCode = 1;
    }

    // Sanity: verify every list member now has an icon on disk.
    const targets = buildTargets();
    const missingOnDisk = targets.filter((t) => !existsSync(path.join(outDir, `${t.id}.png`)));
    if (!failures.length && missingOnDisk.length) {
        console.log(`On-disk check: ${missingOnDisk.map((t) => t.id).join(', ')} missing`);
        process.exitCode = 1;
    }

    // Guard against accidentally committing oversized icons (s2 64px PNGs are
    // a few KB each; anything huge means a service change worth eyeballing).
    const big = [];
    for (const t of targets) {
        const p = path.join(outDir, `${t.id}.png`);
        if (!existsSync(p)) continue;
        const buf = await readFile(p);
        if (buf.length > 30 * 1024) big.push(`${t.id} (${Math.round(buf.length / 1024)}KB)`);
    }
    if (big.length) console.log(`Large icons worth reviewing: ${big.join(', ')}`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await runCli();
}
