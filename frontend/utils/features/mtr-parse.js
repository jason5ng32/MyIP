// Parse the raw text output of an MTR run (as returned by Globalping) into
// structured hop objects for the diagnostic report. Structuring matters
// beyond display: it keeps free-form text out of the shared report payload
// (see common/report-schema.js) and lets the report page render a proper
// table. The parser is deliberately tolerant — mtr builds differ in their
// numeric columns, so the header row drives the column mapping and any line
// that doesn't look like a hop is skipped, never an error.

import { isValidIP } from '../ip/valid-ip.js';

// Header token → hop field. Tokens not listed here (and their values) are
// dropped so the output always fits the report schema whitelist.
const COLUMN_FIELDS = {
    'loss%': 'lossPct',
    loss: 'lossPct',
    drop: 'drop',
    rcv: 'rcv',
    snt: 'sntCount',
    last: 'lastMs',
    avg: 'avgMs',
    best: 'bestMs',
    wrst: 'worstMs',
    stdev: 'stdevMs',
    javg: 'javgMs',
};

// A hop line starts with an index like " 2." or "10.|--".
const HOP_LINE_PATTERN = /^\s*(\d{1,2})\.(?:\|--)?\s+(.*)$/;

const parseHeaderColumns = (line) => line
    .trim()
    .split(/\s+/)
    .slice(1) // first token is the "Host" label
    .map((token) => COLUMN_FIELDS[token.toLowerCase()] ?? null);

// Split a hop line's remainder into the host part and trailing numeric
// tokens. Numbers are consumed from the end so host names containing digits
// stay intact.
const splitHostAndNumbers = (rest) => {
    const tokens = rest.trim().split(/\s+/);
    const numbers = [];
    while (tokens.length > 0) {
        const tail = tokens[tokens.length - 1];
        if (!/^\d+(?:\.\d+)?%?$/.test(tail)) break;
        numbers.unshift(parseFloat(tail));
        tokens.pop();
    }
    return { hostTokens: tokens, numbers };
};

const parseHostTokens = (hostTokens) => {
    const hop = {};
    let tokens = [...hostTokens];

    // Leading AS number: "AS15169" or the unknown marker "AS???".
    if (tokens[0]?.startsWith('AS')) {
        const asnDigits = tokens[0].slice(2);
        hop.asn = /^\d+$/.test(asnDigits) ? parseInt(asnDigits, 10) : null;
        tokens = tokens.slice(1);
    }

    // Trailing "(1.2.3.4)" — the resolved address next to a hostname.
    const last = tokens[tokens.length - 1];
    if (last?.startsWith('(') && last.endsWith(')')) {
        const inner = last.slice(1, -1);
        if (isValidIP(inner)) {
            hop.ip = inner;
            tokens = tokens.slice(0, -1);
        }
    }

    const host = tokens.join(' ');
    if (host && host !== '???' && !host.startsWith('(waiting')) {
        if (isValidIP(host)) {
            hop.ip = hop.ip ?? host;
        } else {
            hop.host = host.slice(0, 128);
        }
    }
    return hop;
};

// Parse one raw MTR output into an array of hop objects matching the
// report schema's mtr hop shape. Returns [] for anything unrecognizable.
export const parseMtrOutput = (rawOutput) => {
    if (typeof rawOutput !== 'string' || rawOutput.trim() === '') return [];

    let columns = null;
    const hops = [];
    const seen = new Set();

    for (const line of rawOutput.split('\n')) {
        if (columns === null && /host/i.test(line) && !HOP_LINE_PATTERN.test(line)) {
            columns = parseHeaderColumns(line);
            continue;
        }
        const match = line.match(HOP_LINE_PATTERN);
        if (!match) continue;

        const n = parseInt(match[1], 10);
        if (n < 1 || n > 64 || seen.has(n)) continue; // extra path lines repeat an index
        const { hostTokens, numbers } = splitHostAndNumbers(match[2]);
        const hop = { n, ...parseHostTokens(hostTokens) };

        if (columns) {
            // Numeric tokens align to the tail of the header columns (the
            // host column soaks up any leading variance).
            const offset = columns.length - numbers.length;
            numbers.forEach((value, i) => {
                const field = offset + i >= 0 ? columns[offset + i] : null;
                if (field && Number.isFinite(value)) hop[field] = value;
            });
        }

        seen.add(n);
        hops.push(hop);
    }
    return hops;
};
