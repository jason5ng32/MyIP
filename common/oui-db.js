// Local IEEE MAC address block lookup for /api/macchecker. common/datasets.js
// downloads the five public IEEE registries as published (CSV, one per
// block size); this module parses them into one map keyed by assignment
// hex and answers the longest assignment covering a query.
//
//   MA-L  oui.csv     24-bit vendor prefix (the classic OUI)
//   MA-M  mam.csv     28-bit block
//   MA-S  oui36.csv   36-bit block
//   IAB   iab.csv     36-bit block (retired; existing assignments remain)
//   CID   cid.csv     24-bit Company ID (locally administered space)
//
// MA-M / MA-S / IAB blocks sit inside MA-L prefixes registered to "IEEE
// Registration Authority", so the longest assignment wins. Each CSV row is
// `Registry,Assignment,Organization Name,Organization Address`; the country
// is not a column, it is read off the end of the address.
//
// Source: https://standards.ieee.org/products-programs/regauth/

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';
import { MAC_HEX_LENGTH } from './mac-input.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const OUI_DB_DIR = path.join(__dirname, 'oui-db');

const IEEE_BASE = 'https://standards-oui.ieee.org';

// `min` is the row floor below which a download counts as truncated
// (roughly 70% of the 2026 sizes; IAB is frozen at ~4.6k).
export const OUI_REGISTRIES = [
    { registry: 'MA-L', file: 'oui.csv', url: `${IEEE_BASE}/oui/oui.csv`, hexLength: 6, min: 28000 },
    { registry: 'MA-M', file: 'mam.csv', url: `${IEEE_BASE}/oui28/mam.csv`, hexLength: 7, min: 4500 },
    { registry: 'MA-S', file: 'oui36.csv', url: `${IEEE_BASE}/oui36/oui36.csv`, hexLength: 9, min: 5000 },
    { registry: 'IAB', file: 'iab.csv', url: `${IEEE_BASE}/iab/iab.csv`, hexLength: 9, min: 3200 },
    { registry: 'CID', file: 'cid.csv', url: `${IEEE_BASE}/cid/cid.csv`, hexLength: 6, min: 150 },
];
export const OUI_FILES = OUI_REGISTRIES.map(({ file }) => file);

// Longest first: a sub-block beats the IEEE RA prefix holding it.
const HEX_LENGTHS = [...new Set(OUI_REGISTRIES.map(({ hexLength }) => hexLength))].sort((a, b) => b - a);

const CSV_HEADER = 'Registry,Assignment,Organization Name,Organization Address';

/* ------------------------------------------------------------------ */
/* Parse                                                               */
/* ------------------------------------------------------------------ */

/**
 * RFC 4180 CSV text → rows of fields (quoted fields may hold commas, `""`,
 * newlines). Throws on text that ends inside a quoted field.
 */
export const parseCsv = (text) => {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c !== '"') field += c;
            else if (text[i + 1] === '"') { field += '"'; i++; }
            else quoted = false;
        } else if (c === '"') quoted = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c !== '\r') field += c;
    }
    if (quoted) throw new Error('CSV ends inside a quoted field');
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows;
};

const regionNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
const isCountryCode = (token) => /^[A-Z]{2}$/.test(token || '') && Boolean(regionNames.of(token));
const hasDigit = (token) => /\d/.test(token || '');

// Countries whose postal code is followed by letters that can read as a
// country code: Dutch postcodes ("5633 AD"), Italian CAP + province ("10077 TO").
const LETTERED_POSTCODE = new Set(['NL', 'IT']);

/**
 * ISO country code at the end of an IEEE address, or null. The address ends
 * `… <country> <postal code>`, where the postal code is zero to two tokens
 * of free text ("94568", "5633 AD", "R.O.C."). A code followed by a token
 * with a digit is the country — unless another code trails the postal code
 * ("Dover DE 19901 US", a state before the country), which then wins, save
 * after a lettered-postcode country. Otherwise the rightmost code.
 */
export const countryFromAddress = (address) => {
    const tokens = String(address || '').trim().split(/\s+/).slice(-3);
    for (let i = 0; i < tokens.length - 1; i++) {
        if (!isCountryCode(tokens[i]) || !hasDigit(tokens[i + 1])) continue;
        const trailing = tokens.slice(i + 2).find(isCountryCode);
        return trailing && !LETTERED_POSTCODE.has(tokens[i]) ? trailing : tokens[i];
    }
    for (let i = tokens.length - 1; i >= 0; i--) {
        if (isCountryCode(tokens[i])) return tokens[i];
    }
    return null;
};

/**
 * One registry's CSV text → [assignment, { registry, company, address,
 * country }] entries. Throws on a file that isn't an IEEE registry CSV, or
 * one cut short.
 */
export const parseRegistry = (text, { registry, hexLength }) => {
    const rows = parseCsv(text.replace(/^\uFEFF/, ''));
    if (rows[0]?.join(',').trim() !== CSV_HEADER) throw new Error(`${registry}: unexpected CSV header`);
    // IEEE ends every row, the last included, with CRLF: a file that stops
    // mid-row was cut short.
    if (!text.endsWith('\n')) throw new Error(`${registry}: file ends mid-row (truncated)`);
    const entries = [];
    for (const [rowRegistry, assignment, company, address] of rows.slice(1)) {
        const hex = (assignment || '').trim().toUpperCase();
        if (rowRegistry?.trim() !== registry || hex.length !== hexLength || !/^[0-9A-F]+$/.test(hex)) continue;
        const cleanAddress = (address || '').trim().replace(/\s+/g, ' ');
        entries.push([hex, {
            registry,
            company: (company || '').trim(),
            address: cleanAddress,
            country: countryFromAddress(cleanAddress),
        }]);
    }
    return entries;
};

/**
 * Read every registry file into one Map; `pathOf(file)` locates each.
 * Throws when a file is missing, malformed or below its row floor.
 */
export const readOuiRegistries = (pathOf) => {
    const blocks = new Map();
    for (const spec of OUI_REGISTRIES) {
        const entries = parseRegistry(fs.readFileSync(pathOf(spec.file), 'utf8'), spec);
        if (entries.length < spec.min) {
            throw new Error(`${spec.registry} has only ${entries.length} assignments (expected ≥ ${spec.min})`);
        }
        for (const [hex, block] of entries) blocks.set(hex, block);
    }
    return blocks;
};

/* ------------------------------------------------------------------ */
/* Lookup                                                              */
/* ------------------------------------------------------------------ */

const NA = 'N/A';
const pairs = (hex) => hex.match(/.{1,2}/g).join(':');

/**
 * Bits the first octet carries, valid for any query of at least two hex
 * digits. `isRand` is a likely-randomized address (Wi-Fi privacy, VMs):
 * locally administered unicast, the only mark randomization leaves on an
 * address. describeMac clears it for a registered Company ID's range.
 */
export const macFlags = (hex) => {
    const firstOctet = parseInt(hex.slice(0, 2), 16);
    const isMulticast = (firstOctet & 0x01) === 0x01;
    const isLocal = (firstOctet & 0x02) === 0x02;
    return {
        isMulticast,
        isUnicast: !isMulticast,
        isLocal,
        isGlobal: !isLocal,
        isRand: isLocal && !isMulticast,
    };
};

/**
 * The /api/macchecker answer for normalized hex `hex` (see
 * common/mac-input.js) against `blocks`: the longest assignment that
 * covers it, its address range, and the first-octet flags. The group bit is
 * not part of an assignment, so a multicast address (01:00:5E:…) resolves
 * to the block it derives from (00:00:5E, IANA), shown as that block's
 * multicast range (01:00:5E:00:00:00–01:00:5E:FF:FF:FF). An address no
 * block covers is still answered (`found: false`) — its flags are the point
 * for a randomized one.
 */
export const describeMac = (blocks, hex) => {
    const firstOctet = (parseInt(hex.slice(0, 2), 16) & 0xfe).toString(16).toUpperCase().padStart(2, '0');
    const key = firstOctet + hex.slice(2);
    let assignment = null;
    for (const length of HEX_LENGTHS) {
        if (key.length >= length && blocks.has(key.slice(0, length))) {
            assignment = key.slice(0, length);
            break;
        }
    }
    const block = assignment ? blocks.get(assignment) : null;
    const flags = macFlags(hex);
    if (!block) {
        return {
            success: true, found: false, macPrefix: pairs(hex.slice(0, 6)),
            company: NA, address: NA, country: NA,
            blockStart: NA, blockEnd: NA, blockSize: NA, blockType: NA,
            isPrivate: false, ...flags,
        };
    }
    // Shown in the query's own form: a multicast query gets its block's
    // multicast range, which holds the address asked about.
    const shown = hex.slice(0, 2) + assignment.slice(2);
    const hostDigits = MAC_HEX_LENGTH - assignment.length;
    return {
        success: true,
        found: true,
        macPrefix: pairs(shown),
        company: block.company || NA,
        address: block.address || NA,
        country: block.country || NA,
        blockStart: pairs(shown + '0'.repeat(hostDigits)),
        blockEnd: pairs(shown + 'F'.repeat(hostDigits)),
        blockSize: 16 ** hostDigits,
        blockType: block.registry,
        isPrivate: block.company.toLowerCase() === 'private',
        ...flags,
        // A CID range is assigned local space (IEEE 802c ELI), not random.
        isRand: flags.isRand && block.registry !== 'CID',
    };
};

/* ------------------------------------------------------------------ */
/* Load                                                                */
/* ------------------------------------------------------------------ */

let blocks = null;

const loadDatabase = () => {
    if (!OUI_FILES.every((file) => fs.existsSync(path.join(OUI_DB_DIR, file)))) {
        // Info, not warn: a first boot downloads them right after.
        logger.info({ dir: OUI_DB_DIR }, '⚠️  IEEE MAC registries not present; MAC Lookup waits for the download');
        blocks = null;
        return;
    }
    const start = Date.now();
    try {
        blocks = readOuiRegistries((file) => path.join(OUI_DB_DIR, file));
        logger.info(`📦 IEEE MAC registries loaded — ${blocks.size} assignments in ${Date.now() - start}ms`);
    } catch (error) {
        // A previously loaded copy keeps serving.
        logger.warn({ err: error, dir: OUI_DB_DIR }, '⚠️  Failed to parse IEEE MAC registries');
    }
};

loadDatabase();

/** Reload the registries after the dataset updater publishes fresh files. */
export const reloadOuiDatabase = (reason = 'reload') => {
    logger.info(`🔄 Reloading IEEE MAC registries (${reason})`);
    loadDatabase();
};

/** Whether all five registries are loaded. */
export const isOuiLoaded = () => blocks !== null;

/** describeMac against the loaded registries; null when none are loaded. */
export const lookupMac = (hex) => (blocks ? describeMac(blocks, hex) : null);
