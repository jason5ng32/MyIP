// Local CAIDA as2org lookup. Snapshot file is auto-downloaded by
// common/caida-updater.js; this module just parses and serves.
//
// We use CAIDA's pipe-delimited TXT (~12MB) rather than the equivalent
// JSONL (~28MB): identical content but split('|') beats JSON.parse per
// line by ~40%.
//
// Source: https://publicdata.caida.org/datasets/as-organizations/

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const AS_ORG_DB_DIR = path.join(__dirname, 'as-org-db');

// Canonical filename the updater writes to. Manual downloads can use any
// *.txt name — findSnapshot picks the newest by mtime regardless.
export const AS_ORG_FILE = 'as-org2info.txt';

const asnToOrgName = new Map();
let loadedFrom = null;

function findSnapshot() {
    if (!fs.existsSync(AS_ORG_DB_DIR)) return null;
    const txts = fs.readdirSync(AS_ORG_DB_DIR).filter(f => f.endsWith('.txt'));
    if (txts.length === 0) return null;
    const withMtime = txts.map(f => {
        const full = path.join(AS_ORG_DB_DIR, f);
        return { full, mtimeMs: fs.statSync(full).mtimeMs };
    });
    withMtime.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return withMtime[0].full;
}

// CAIDA TXT has two sections: org records (5 fields) and ASN records (6
// fields). Orgs may appear after ASNs in the stream, so we collect ASN
// rows into `pending` first and resolve them after a full scan.
function parsePipeText(text) {
    const orgs = new Map(); // org_id → name
    const pending = [];     // [{asn, org_id}]
    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const parts = line.split('|');
        if (parts.length === 5) {
            // org_id | changed | name | country | source
            if (parts[0] && parts[2]) orgs.set(parts[0], parts[2]);
        } else if (parts.length === 6) {
            // aut | changed | aut_name | org_id | opaque_id | source
            const asn = Number(parts[0]);
            if (asn && parts[3]) pending.push({ asn, org_id: parts[3] });
        }
    }
    for (const { asn, org_id } of pending) {
        const name = orgs.get(org_id);
        if (name) asnToOrgName.set(asn, name);
    }
}

function loadDatabase() {
    const filePath = findSnapshot();
    if (!filePath) {
        logger.warn({ dir: AS_ORG_DB_DIR }, '⚠️  CAIDA as2org snapshot not found; ASN org-name lookups will fall back to RIPEstat');
        asnToOrgName.clear();
        loadedFrom = null;
        return;
    }
    const start = Date.now();
    try {
        const text = fs.readFileSync(filePath, 'utf8');
        asnToOrgName.clear();
        parsePipeText(text);
        loadedFrom = path.basename(filePath);
        logger.info(`📦 CAIDA as2org loaded (${loadedFrom}) — ${asnToOrgName.size} ASNs in ${Date.now() - start}ms`);
    } catch (error) {
        logger.warn({ err: error, path: filePath }, '⚠️  Failed to parse CAIDA as2org snapshot');
    }
}

loadDatabase();

/** Reload the snapshot after caida-updater publishes a fresh file. */
export function reloadAsOrgDatabase(reason = 'reload') {
    logger.info(`🔄 Reloading CAIDA as2org snapshot (${reason})`);
    loadDatabase();
}

/** Org name for an ASN, or null when the snapshot doesn't have it. */
export function lookupAsOrgName(asn) {
    return asnToOrgName.get(Number(asn)) || null;
}
