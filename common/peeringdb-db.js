// Local PeeringDB lookup: a network's self-reported peering profile (types,
// website, scope, traffic, ratio, policy, IRR as-set), the exchanges it is
// on and the facilities it is in. common/datasets.js downloads CAIDA's
// daily mirror of the full PeeringDB dump and distills it
// (common/peeringdb-distill.js → buildPeeringdbIndex below); only the
// compact per-ASN index ever lands in this directory. Contact data (poc,
// org addresses) is never read.
//
// Index file (JSON):
//   { v: 1,
//     ix:   { <ix id>:  [name, city, country] },
//     fac:  { <fac id>: [name, city, country] },
//     nets: { <asn>: { website, types[], scope, traffic, ratio, policy, irr,
//                      ix: [[ix id, Mbps summed over ports, rs peer 1|0]],
//                      fac: [fac id] } } }
// Empty / "Not Disclosed" fields are omitted; a network with nothing left
// is dropped. IX and facility rows are stored once and referenced by id.
//
// Sources: https://publicdata.caida.org/datasets/peeringdb/ (CAIDA AUA) ·
// https://www.peeringdb.com

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PEERINGDB_DB_DIR = path.join(__dirname, 'peeringdb-db');
export const PEERINGDB_FILE = 'peeringdb-index.json';
export const PEERINGDB_INDEX_VERSION = 1;

// The four dump tables the index is built from.
export const PEERINGDB_TABLES = ['net', 'ix', 'netixlan', 'netfac'];

/* ------------------------------------------------------------------ */
/* Distill: dump rows → index                                          */
/* ------------------------------------------------------------------ */

const UNDISCLOSED = 'not disclosed';

// Trimmed text, or undefined for empty / "Not Disclosed".
export const cleanText = (value) => {
    if (typeof value !== 'string') return undefined;
    const text = value.trim();
    return text && text.toLowerCase() !== UNDISCLOSED ? text : undefined;
};

// http(s) URLs only, and none with userinfo — "name@host" is how an
// e-mail address typed into the field would otherwise pass as a link.
const cleanWebsite = (value) => {
    const text = cleanText(value);
    if (!text) return undefined;
    try {
        const url = new URL(text);
        const web = url.protocol === 'http:' || url.protocol === 'https:';
        return web && !url.username && !url.password ? text : undefined;
    } catch {
        return undefined;
    }
};

const isLive = (row) => !row.status || row.status === 'ok';

// Per-table projection to the fields the index needs, applied to each row
// as it is scanned so nothing else is kept.
export const projectRow = {
    net: (r) => ({
        id: r.id,
        asn: Number(r.asn),
        website: cleanWebsite(r.website),
        types: Array.isArray(r.info_types) ? r.info_types.map(cleanText).filter(Boolean) : [],
        scope: cleanText(r.info_scope),
        traffic: cleanText(r.info_traffic),
        ratio: cleanText(r.info_ratio),
        policy: cleanText(r.policy_general),
        irr: cleanText(r.irr_as_set),
        live: isLive(r),
    }),
    ix: (r) => ({ id: r.id, name: cleanText(r.name), city: cleanText(r.city), country: cleanText(r.country), live: isLive(r) }),
    netixlan: (r) => ({
        asn: Number(r.asn),
        ixId: r.ix_id,
        speed: Number(r.speed) || 0,
        rs: r.is_rs_peer === true,
        live: isLive(r) && r.operational !== false,
    }),
    netfac: (r) => ({
        netId: r.net_id,
        facId: r.fac_id,
        name: cleanText(r.name),
        city: cleanText(r.city),
        country: cleanText(r.country),
        live: isLive(r),
    }),
};

const place = (row) => [row.name, row.city || '', row.country || ''];

/**
 * Projected rows of the four tables → index object (shape in the header).
 * Pure; the streaming distiller and the tests share it.
 */
export const buildPeeringdbIndex = ({ net = [], ix = [], netixlan = [], netfac = [] }) => {
    const ixById = new Map(ix.filter((r) => r.live && r.name).map((r) => [r.id, r]));
    const asnByNetId = new Map(net.map((r) => [r.id, r.asn]));
    const ixTable = {};
    const facTable = {};

    // asn → Map<ix id, [ix id, speed, rs]>; several ports at one IX sum.
    const portsByAsn = new Map();
    for (const row of netixlan) {
        if (!row.live || !row.asn) continue;
        const exchange = ixById.get(row.ixId);
        if (!exchange) continue;
        let atIx = portsByAsn.get(row.asn);
        if (!atIx) portsByAsn.set(row.asn, (atIx = new Map()));
        const entry = atIx.get(exchange.id);
        if (entry) {
            entry[1] += row.speed;
            entry[2] = entry[2] || (row.rs ? 1 : 0);
        } else {
            atIx.set(exchange.id, [exchange.id, row.speed, row.rs ? 1 : 0]);
            ixTable[exchange.id] ??= place(exchange);
        }
    }

    // netfac carries the facility's own name / city / country.
    const facsByAsn = new Map();
    for (const row of netfac) {
        if (!row.live || !row.name) continue;
        const asn = asnByNetId.get(row.netId);
        if (!asn) continue;
        let ids = facsByAsn.get(asn);
        if (!ids) facsByAsn.set(asn, (ids = new Set()));
        ids.add(row.facId);
        facTable[row.facId] ??= place(row);
    }

    const byPlace = (a, b) => a[2].localeCompare(b[2]) || a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]);
    const nets = {};
    for (const row of net) {
        if (!row.live || !row.asn || nets[row.asn]) continue;
        const entry = {};
        for (const key of ['website', 'scope', 'traffic', 'ratio', 'policy', 'irr']) {
            if (row[key]) entry[key] = row[key];
        }
        if (row.types.length) entry.types = row.types;
        const ports = [...(portsByAsn.get(row.asn)?.values() || [])]
            .sort((a, b) => b[1] - a[1] || ixTable[a[0]][0].localeCompare(ixTable[b[0]][0]));
        if (ports.length) entry.ix = ports;
        const facs = [...(facsByAsn.get(row.asn) || [])].sort((a, b) => byPlace(facTable[a], facTable[b]));
        if (facs.length) entry.fac = facs;
        if (Object.keys(entry).length) nets[row.asn] = entry;
    }

    // Keep only the IX / facility rows some network still references.
    const used = (table, key) => {
        const ids = new Set();
        for (const entry of Object.values(nets)) {
            for (const item of entry[key] || []) ids.add(key === 'ix' ? item[0] : item);
        }
        return Object.fromEntries(Object.entries(table).filter(([id]) => ids.has(Number(id))));
    };
    return { v: PEERINGDB_INDEX_VERSION, ix: used(ixTable, 'ix'), fac: used(facTable, 'fac'), nets };
};

/* ------------------------------------------------------------------ */
/* Load + lookup                                                       */
/* ------------------------------------------------------------------ */

const toPlaceMap = (table) => new Map(Object.entries(table || {}).map(([id, [name, city, country]]) => [
    Number(id), { name, city: city || null, country: country || null },
]));

/**
 * Read an index file into lookup tables { nets, ix, fac } (Maps keyed by
 * number). The file text and the parsed object stay local, so only the
 * Maps outlive the call. Throws on a malformed or wrong-version file.
 */
export const readPeeringdbIndex = (filePath) => {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (parsed?.v !== PEERINGDB_INDEX_VERSION || !parsed.nets) {
        throw new Error(`unsupported PeeringDB index (v=${parsed?.v})`);
    }
    const nets = new Map();
    for (const asn of Object.keys(parsed.nets)) nets.set(Number(asn), parsed.nets[asn]);
    return { nets, ix: toPlaceMap(parsed.ix), fac: toPlaceMap(parsed.fac) };
};

/** One network's record from loaded tables, expanded for the API; null when absent. */
export const expandNet = (tables, asn) => {
    const entry = tables?.nets.get(Number(asn));
    if (!entry) return null;
    return {
        website: entry.website || null,
        types: entry.types || [],
        scope: entry.scope || null,
        traffic: entry.traffic || null,
        ratio: entry.ratio || null,
        policy: entry.policy || null,
        irrAsSet: entry.irr || null,
        ixs: (entry.ix || []).flatMap(([id, speed, rs]) => {
            const exchange = tables.ix.get(id);
            return exchange ? [{ ...exchange, speed, rsPeer: rs === 1 }] : [];
        }),
        facilities: (entry.fac || []).flatMap((id) => {
            const facility = tables.fac.get(id);
            return facility ? [{ ...facility }] : [];
        }),
    };
};

let tables = null;
let loadedFrom = null;

const loadDatabase = () => {
    const filePath = path.join(PEERINGDB_DB_DIR, PEERINGDB_FILE);
    if (!fs.existsSync(filePath)) {
        // Info, not warn: deployments without a Cloudflare key never fetch one.
        logger.info({ dir: PEERINGDB_DB_DIR }, '⚠️  PeeringDB index not present; ASN Profile shows no peering data');
        tables = null;
        loadedFrom = null;
        return;
    }
    const start = Date.now();
    try {
        tables = readPeeringdbIndex(filePath);
        loadedFrom = PEERINGDB_FILE;
        logger.info(`📦 PeeringDB index loaded — ${tables.nets.size} networks, ${tables.ix.size} exchanges, ${tables.fac.size} facilities in ${Date.now() - start}ms`);
    } catch (error) {
        logger.warn({ err: error, path: filePath }, '⚠️  Failed to parse PeeringDB index');
    }
};

loadDatabase();

/** Reload the index after the dataset updater publishes a fresh one. */
export const reloadPeeringdbDatabase = (reason = 'reload') => {
    logger.info(`🔄 Reloading PeeringDB index (${reason})`);
    loadDatabase();
};

/** Whether an index is loaded (false until the updater has built one). */
export const isPeeringdbLoaded = () => loadedFrom !== null;

/** The network's PeeringDB record (see expandNet), or null. */
export const lookupPeeringdb = (asn) => expandNet(tables, asn);
