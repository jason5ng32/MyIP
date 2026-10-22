// Streaming distiller: full PeeringDB dump (CAIDA mirror, ~116 MB JSON) →
// the compact per-ASN index server/datasets/peeringdb-db.js serves. Built for small
// instances: the dump is never parsed whole. A byte-level scanner walks the
// dump's fixed envelope
//   { "<table>": { "data": [ {row}, {row}, … ], "meta": {…} }, … }
// and JSON.parses one row at a time, only inside the wanted tables' "data"
// arrays, projecting it to the needed fields at once; every other table
// (poc, org, fac, …) is skipped byte by byte and never materialized. The
// index is written in batches rather than as one string.
//
// Scanning raw bytes is UTF-8 safe: continuation bytes (0x80–0xBF) never
// equal '"', '\', ':', ',' or a bracket. Reads are async, one reused 1 MB
// buffer at a time, so a running server keeps serving between chunks.

import fsp from 'fs/promises';
import { PEERINGDB_TABLES, projectRow, buildPeeringdbIndex } from './peeringdb-db.js';

const QUOTE = 0x22;
const BACKSLASH = 0x5c;
const COLON = 0x3a;
const COMMA = 0x2c;
const OPEN_OBJECT = 0x7b;
const CLOSE_OBJECT = 0x7d;
const OPEN_ARRAY = 0x5b;
const CLOSE_ARRAY = 0x5d;

const CHUNK_BYTES = 1 << 20;
const WRITE_BATCH_CHARS = 1 << 20;

/**
 * Stream `filePath` and call `onRow(table, row)` for every row object in
 * the "data" array of each table named in `wanted`. Resolves the number of
 * rows seen; throws on a truncated document or when `signal` aborts.
 */
export const scanDumpRows = async (filePath, wanted, onRow, { signal } = {}) => {
    let depth = 0;
    let inString = false;
    let escaped = false;
    // Container kind per depth ('o' / 'a') and whether the next string at
    // depth 1 or 2 is a key; only those two levels name tables / fields.
    const kinds = [];
    let expectKey = false;
    let keyParts = null;
    let keyStart = -1;
    let topKey = null;
    let tableKey = null;
    let rowParts = null;
    let rowStart = -1;
    let rows = 0;
    let sawDocument = false;

    const buf = Buffer.allocUnsafe(CHUNK_BYTES);
    const handle = await fsp.open(filePath, 'r');
    try {
        for (;;) {
            signal?.throwIfAborted();
            const { bytesRead } = await handle.read(buf, 0, buf.length, null);
            if (bytesRead === 0) break;
            const chunk = buf.subarray(0, bytesRead);
            for (let i = 0; i < chunk.length; i++) {
                const b = chunk[i];
                if (inString) {
                    if (escaped) escaped = false;
                    else if (b === BACKSLASH) escaped = true;
                    else if (b === QUOTE) {
                        inString = false;
                        if (keyParts) {
                            keyParts.push(chunk.subarray(keyStart, i));
                            const key = Buffer.concat(keyParts).toString('utf8');
                            if (depth === 1) {
                                topKey = key;
                                tableKey = null;
                            } else {
                                tableKey = key;
                            }
                            keyParts = null;
                        }
                    }
                    continue;
                }
                if (b === QUOTE) {
                    inString = true;
                    if ((depth === 1 || depth === 2) && kinds[depth] === 'o' && expectKey) {
                        keyParts = [];
                        keyStart = i + 1;
                    }
                } else if (b === COLON) {
                    if (depth <= 2) expectKey = false;
                } else if (b === COMMA) {
                    if (depth <= 2) expectKey = kinds[depth] === 'o';
                } else if (b === OPEN_OBJECT || b === OPEN_ARRAY) {
                    depth++;
                    sawDocument = true;
                    if (depth <= 3) kinds[depth] = b === OPEN_OBJECT ? 'o' : 'a';
                    if (depth <= 2) expectKey = b === OPEN_OBJECT;
                    if (depth === 4 && b === OPEN_OBJECT && kinds[3] === 'a'
                        && tableKey === 'data' && wanted.has(topKey)) {
                        rowParts = [];
                        rowStart = i;
                    }
                } else if (b === CLOSE_OBJECT || b === CLOSE_ARRAY) {
                    if (depth === 4 && rowParts) {
                        const text = rowParts.length
                            ? Buffer.concat([...rowParts, chunk.subarray(rowStart, i + 1)]).toString('utf8')
                            : chunk.toString('utf8', rowStart, i + 1);
                        onRow(topKey, JSON.parse(text));
                        rows++;
                        rowParts = null;
                    }
                    depth--;
                }
            }
            // A row or key straddling the boundary outlives the reused buffer.
            if (rowParts) {
                rowParts.push(Buffer.from(chunk.subarray(rowStart)));
                rowStart = 0;
            }
            if (keyParts) {
                keyParts.push(Buffer.from(chunk.subarray(keyStart)));
                keyStart = 0;
            }
        }
    } finally {
        await handle.close();
    }
    if (!sawDocument || depth !== 0 || inString) {
        throw new Error(`truncated PeeringDB dump (depth ${depth})`);
    }
    return rows;
};

/** Write an index object as JSON in ~1 MB batches; same bytes as JSON.stringify. */
export const writeIndexFile = async (outPath, index) => {
    const handle = await fsp.open(outPath, 'w');
    try {
        let pending = `{"v":${JSON.stringify(index.v)},"ix":${JSON.stringify(index.ix)},"fac":${JSON.stringify(index.fac)},"nets":{`;
        let first = true;
        for (const asn of Object.keys(index.nets)) {
            pending += `${first ? '' : ','}${JSON.stringify(asn)}:${JSON.stringify(index.nets[asn])}`;
            first = false;
            if (pending.length >= WRITE_BATCH_CHARS) {
                await handle.write(pending);
                pending = '';
            }
        }
        await handle.write(`${pending}}}`);
    } finally {
        await handle.close();
    }
};

/**
 * Dump file → index file. Resolves counts for the log; throws when the dump
 * lacks one of the four tables (a schema change must not publish).
 */
export const distillPeeringdbDump = async (dumpPath, outPath, { signal } = {}) => {
    const wanted = new Set(PEERINGDB_TABLES);
    const tables = Object.fromEntries(PEERINGDB_TABLES.map((name) => [name, []]));
    const rows = await scanDumpRows(dumpPath, wanted, (table, row) => {
        tables[table].push(projectRow[table](row));
    }, { signal });
    for (const name of PEERINGDB_TABLES) {
        if (!tables[name].length) throw new Error(`PeeringDB dump has no ${name} rows`);
    }
    const index = buildPeeringdbIndex(tables);
    for (const name of PEERINGDB_TABLES) tables[name] = null; // garbage before the write
    await writeIndexFile(outPath, index);
    return {
        rows,
        networks: Object.keys(index.nets).length,
        exchanges: Object.keys(index.ix).length,
        facilities: Object.keys(index.fac).length,
    };
};
