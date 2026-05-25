// Local CAIDA AS Relationships lookup. Snapshot is downloaded
// by common/caida-updater.js; this module parses and serves.
//
// CAIDA as-rel2 row format: `<a>|<b>|<rel>|<source>`
//   rel = -1 → p2c (a is provider of b)   ← we keep these
//   rel =  0 → p2p (peering)              ← skipped
//   rel =  1 → s2s (sibling)              ← skipped
//
// Source: https://publicdata.caida.org/datasets/as-relationships/serial-2/

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const AS_REL_DB_DIR = path.join(__dirname, 'as-rel-db');
export const AS_REL_FILE = 'as-rel2.txt';

// customer ASN → Set<provider ASN>. Hot path of asn-connectivity.
const providersIndex = new Map();

// ASN → number of distinct customers it provides transit for. Ranking
// signal when an intermediate has more providers than MAX_INTERMEDIATE_BRANCH
// can show; roughly correlates with customer-cone size.
const customerCount = new Map();

// Tier 1 set, derived from the snapshot rather than hardcoded:
//   (a) the AS has no providers in CAIDA's p2c topology (nobody sells
//       transit to it ≈ CAIDA's clique notion), AND
//   (b) it provides transit to at least TIER1_MIN_CUSTOMERS ASes — filters
//       out defunct ASNs that look settlement-free only because they're
//       inactive (e.g. AS1239 Sprint after the T-Mobile merger).
// 100 is the empirical sweet spot: captures Telxius/Orange/Liberty
// (customer cones 110-340) without admitting clearly defunct ASNs.
const TIER1_MIN_CUSTOMERS = 100;
const tier1Set = new Set();

let loadedFrom = null;

function findSnapshot() {
    if (!fs.existsSync(AS_REL_DB_DIR)) return null;
    const txts = fs.readdirSync(AS_REL_DB_DIR).filter(f => f.endsWith('.txt'));
    if (txts.length === 0) return null;
    const withMtime = txts.map(f => {
        const full = path.join(AS_REL_DB_DIR, f);
        return { full, mtimeMs: fs.statSync(full).mtimeMs };
    });
    withMtime.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return withMtime[0].full;
}

function parsePipeText(text) {
    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const parts = line.split('|');
        if (parts.length < 3 || parts[2] !== '-1') continue;
        const provider = Number(parts[0]);
        const customer = Number(parts[1]);
        if (!provider || !customer) continue;
        let set = providersIndex.get(customer);
        if (!set) {
            set = new Set();
            providersIndex.set(customer, set);
        }
        set.add(provider);
        customerCount.set(provider, (customerCount.get(provider) || 0) + 1);
    }
}

function rebuildTier1Set() {
    tier1Set.clear();
    for (const [asn, count] of customerCount) {
        if (providersIndex.has(asn)) continue; // has upstream → not Tier 1
        if (count >= TIER1_MIN_CUSTOMERS) tier1Set.add(asn);
    }
}

function loadDatabase() {
    const filePath = findSnapshot();
    if (!filePath) {
        logger.warn({ dir: AS_REL_DB_DIR }, '⚠️  CAIDA as-rel snapshot not found; asn-connectivity will return empty graphs until the updater downloads one');
        providersIndex.clear();
        customerCount.clear();
        tier1Set.clear();
        loadedFrom = null;
        return;
    }
    const start = Date.now();
    try {
        const text = fs.readFileSync(filePath, 'utf8');
        providersIndex.clear();
        customerCount.clear();
        parsePipeText(text);
        rebuildTier1Set();
        loadedFrom = path.basename(filePath);
        logger.info(`📦 CAIDA as-rel loaded (${loadedFrom}) — ${providersIndex.size} customers, ${customerCount.size} providers, ${tier1Set.size} Tier 1s in ${Date.now() - start}ms`);
    } catch (error) {
        logger.warn({ err: error, path: filePath }, '⚠️  Failed to parse CAIDA as-rel snapshot');
    }
}

loadDatabase();

/** Reload the snapshot after caida-updater publishes a fresh file. */
export function reloadAsRelDatabase(reason = 'reload') {
    logger.info(`🔄 Reloading CAIDA as-rel snapshot (${reason})`);
    loadDatabase();
}

/** Providers (transit upstreams) of an ASN. Empty array when not in dataset. */
export function providersOf(asn) {
    const set = providersIndex.get(Number(asn));
    return set ? [...set] : [];
}

/** How many distinct ASes this one provides transit for. 0 when never a provider. */
export function customerCountOf(asn) {
    return customerCount.get(Number(asn)) || 0;
}

/** Whether this ASN is in the CAIDA-derived Tier 1 set. */
export function isTier1(asn) {
    return tier1Set.has(Number(asn));
}
