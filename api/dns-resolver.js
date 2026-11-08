// api/dns-resolver.js — GET /api/dnsresolver: resolve a hostname against every
// resolver in api/data/dns-resolvers.js (UDP DNS + DoH) in parallel and return
// one flat, country-annotated result list the frontend groups by country.
import { Resolver } from 'node:dns/promises';
import { fetchUpstream } from '../common/fetch-with-timeout.js';
import logger from '../server/logger.js';
import { DNS_RESOLVERS } from './data/dns-resolvers.js';
import { NAME_VALUED_TYPES } from '../common/dns-record-types.js';

// Bound each upstream lookup so the slowest server doesn't pin the
// overall response. 3s for UDP DNS (`Resolver` rejects on first
// timeout because `tries: 1`); 5s for DoH via fetchUpstream's per-call
// override.
const DNS_TIMEOUT_MS = 3000;
const DOH_TIMEOUT_MS = 5000;
const DNS_AVAILABILITY_ERRORS = new Set(['ETIMEOUT', 'ECONNREFUSED', 'EREFUSED']);

// A row with no answer: `result` stays 'N/A' for existing consumers, `status`
// is the failure class the UI labels, `code` the raw identifier it shows.
const failure = ({ status, code }) => ({ result: 'N/A', status, code });

// c-ares error code → failure class. Codes that are DNS RCODEs display under
// their RCODE name; the rest show the Node code as-is.
const UDP_ERROR_CLASSES = {
    ENODATA: { status: 'nodata', code: 'NODATA' },
    ENOTFOUND: { status: 'nxdomain', code: 'NXDOMAIN' },
    ESERVFAIL: { status: 'servfail', code: 'SERVFAIL' },
    EREFUSED: { status: 'refused', code: 'REFUSED' },
    ENOTIMP: { status: 'refused', code: 'NOTIMP' },
    ETIMEOUT: { status: 'timeout', code: 'TIMEOUT' },
    EFORMERR: { status: 'malformed', code: 'FORMERR' },
    EBADRESP: { status: 'malformed', code: 'EBADRESP' },
    EOF: { status: 'malformed', code: 'EOF' },
    EBADQUERY: { status: 'malformed', code: 'EBADQUERY' },
    EBADNAME: { status: 'malformed', code: 'EBADNAME' },
    EBADSTR: { status: 'malformed', code: 'EBADSTR' },
};

// Anything unlisted (ECONNREFUSED, ECANCELLED, a code-less throw) means the
// resolver itself couldn't serve the query.
export const classifyDnsError = (error) => {
    const code = typeof error?.code === 'string' ? error.code : '';
    return UDP_ERROR_CLASSES[code] ?? { status: 'unavailable', code: code || 'ERROR' };
};

// DoH JSON `Status` (the DNS RCODE) → failure class. Status 0 is decided by
// whether records came back (see classifyDohEnvelope); RCODEs outside this
// table (YXDOMAIN, NOTAUTH, …) never answer a plain query, so they read as
// the resolver misbehaving.
const DOH_RCODE_CLASSES = {
    1: { status: 'malformed', code: 'FORMERR' },
    2: { status: 'servfail', code: 'SERVFAIL' },
    3: { status: 'nxdomain', code: 'NXDOMAIN' },
    4: { status: 'refused', code: 'NOTIMP' },
    5: { status: 'refused', code: 'REFUSED' },
};

export const classifyDohHttpStatus = (httpStatus) => ({ status: 'unavailable', code: `HTTP ${httpStatus}` });

// undici's own timeouts surface as a `fetch failed` TypeError whose cause
// carries one of these; fetchUpstream's deadline is an AbortError.
const FETCH_TIMEOUT_CODES = new Set(['UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'ETIMEDOUT']);

export const classifyDohFetchError = (error) => {
    const code = error?.cause?.code ?? error?.code;
    if (error?.name === 'AbortError' || FETCH_TIMEOUT_CODES.has(code)) return { status: 'timeout', code: 'TIMEOUT' };
    return { status: 'unavailable', code: typeof code === 'string' && code ? code : 'FETCH' };
};

const logDnsFailure = (error, server, provider) => {
    // warn+ mirrors to telemetry and a DNS err.message carries the queried
    // hostname, so the availability branch logs the code alone; the local-only
    // debug branch keeps the full error.
    if (DNS_AVAILABILITY_ERRORS.has(error?.code)) {
        logger.warn({ server, provider, code: error?.code }, 'DNS resolver: availability lookup failed, returning N/A');
        return;
    }
    logger.debug({ err: error, server, provider, code: error?.code }, 'DNS resolver: lookup failed, returning N/A');
};

// Node's resolveSoa strips the trailing root dot from both names; the DoH JSON
// path returns them in presentation form. Re-add them so the two rows a single
// provider contributes read identically — the MX branch below does the same.
export const formatSoaRecord = (record) => [
    `${record.nsname}.`,
    `${record.hostmaster}.`,
    record.serial,
    record.refresh,
    record.retry,
    record.expire,
    record.minttl,
].join(' ');

// Node returns each CAA record as { critical, type: 'CAA', <tag>: value }, so
// the tag is whichever key is neither piece of metadata. Reading it that way
// renders a provider-specific tag as itself instead of dropping it.
const CAA_META_KEYS = new Set(['critical', 'type']);

export const formatCaaRecords = (records) => records.flatMap((record) => {
    const tagged = Object.entries(record).find(([key]) => !CAA_META_KEYS.has(key));
    if (!tagged) return [];
    const [tag, value] = tagged;
    return `${record.critical ?? 0} ${tag} ${JSON.stringify(value)}`;
}).join(', ');

// Both transports run name-valued answers through this: Node's resolver
// returns `dns.google`, a DoH endpoint returns `dns.google.`, and that lone
// dot would read as two providers disagreeing.
export const withRootDot = (name) => (name.endsWith('.') ? name : `${name}.`);

// DNS numeric type for SOA, used to pick the zone's SOA out of a DoH authority
// section (see dohRecords).
const SOA_RECORD_TYPE = 6;

// The records a DoH envelope actually answers with. A SOA query for a name
// below the zone apex carries the zone's own SOA in the authority section
// instead, so fall back to it — otherwise any hostname that isn't itself a zone
// reports N/A on every DoH row. SOA answers are filtered by type because a
// CNAME name puts the chain in Answer with the SOA in Authority, and the CNAME
// target must not render as the SOA result.
export const dohRecords = (data, type) => {
    if (type !== 'SOA') return data.Answer ?? [];
    const answers = (data.Answer ?? []).filter((record) => record.type === SOA_RECORD_TYPE);
    if (answers.length) return answers;
    return (data.Authority ?? []).filter((record) => record.type === SOA_RECORD_TYPE);
};

const isSection = (value) => value === undefined
    || (Array.isArray(value) && value.every((record) => record && typeof record === 'object'));

// A parsed DoH JSON body → `{ status: 'ok', records }` or a failure class.
// A body that isn't a JSON-API envelope (no numeric Status, sections that
// aren't arrays of records, answers without a `data` string) is `malformed`.
export const classifyDohEnvelope = (data, type) => {
    const malformed = { status: 'malformed', code: 'BADRESP' };
    if (!data || typeof data !== 'object' || Array.isArray(data)
        || !Number.isInteger(data.Status) || !isSection(data.Answer) || !isSection(data.Authority)) {
        return malformed;
    }
    if (data.Status !== 0) {
        return DOH_RCODE_CLASSES[data.Status] ?? { status: 'unavailable', code: `RCODE ${data.Status}` };
    }
    const records = dohRecords(data, type);
    if (!records.every((record) => typeof record?.data === 'string')) return malformed;
    return records.length ? { status: 'ok', records } : { status: 'nodata', code: 'NODATA' };
};

// Resolve via classic UDP DNS. Resolves to `{ result, status: 'ok' }` with an
// array of strings or a formatted record string, or a failure row.
const resolveDns = async (hostname, type, name, server) => {
    const resolver = new Resolver({ timeout: DNS_TIMEOUT_MS, tries: 1 });
    resolver.setServers([server]);
    try {
        let addresses;

        // Select different parsing methods based on the type parameter
        switch (type) {
            case 'A':
                addresses = await resolver.resolve4(hostname);
                break;
            case 'AAAA':
                addresses = await resolver.resolve6(hostname);
                break;
            case 'TXT':
                addresses = await resolver.resolveTxt(hostname);
                // TXT record parsing results is a two-dimensional array, here we flatten the result
                addresses = addresses.flat();
                break;
            case 'CNAME':
                addresses = await resolver.resolveCname(hostname);
                break;
            case 'NS':
                addresses = await resolver.resolveNs(hostname);
                break;
            case 'MX':
                addresses = await resolver.resolveMx(hostname);
                addresses = addresses.map(item => `${item.priority} ${item.exchange}.`)
                .join(', ');
                break;
            case 'SOA':
                addresses = formatSoaRecord(await resolver.resolveSoa(hostname));
                break;
            case 'CAA':
                addresses = formatCaaRecords(await resolver.resolveCaa(hostname));
                break;
            default:
                throw new Error('Unsupported type');
        }

        if (NAME_VALUED_TYPES.has(type)) addresses = addresses.map(withRootDot);

        if (addresses.length === 0 || addresses === '' || addresses === null) {
            return failure({ status: 'nodata', code: 'NODATA' });
        }

        return { result: addresses, status: 'ok' };
    } catch (error) {
        logDnsFailure(error, server, name);
        return failure(classifyDnsError(error));
    }
};

// Resolve via the DNS-over-HTTPS JSON API. Same return shape as resolveDns.
// `url` is a prefix ending in '?' or '&' (see the data file). Only transport
// failures warn; an RCODE or unreadable body depends on the queried name or is
// the provider's own answer, so it stays at debug.
const resolveDoh = async (hostname, type, name, url) => {
    let body;
    try {
        const response = await fetchUpstream(`${url}name=${hostname}&type=${type}`, {
            timeoutMs: DOH_TIMEOUT_MS,
            headers: { 'Accept': 'application/dns-json' }
        });
        if (!response.ok) {
            const outcome = classifyDohHttpStatus(response.status);
            logger.warn({ server: name, code: outcome.code }, 'DoH resolver: upstream returned a non-2xx response');
            return failure(outcome);
        }
        body = await response.text();
    } catch (error) {
        const outcome = classifyDohFetchError(error);
        logger.warn({ err: error, server: name, code: outcome.code }, 'DoH resolver: lookup failed, returning N/A');
        return failure(outcome);
    }

    let data;
    try {
        data = JSON.parse(body);
    } catch {
        logger.debug({ server: name, code: 'BADJSON' }, 'DoH resolver: response is not JSON, returning N/A');
        return failure({ status: 'malformed', code: 'BADJSON' });
    }
    const outcome = classifyDohEnvelope(data, type);
    if (outcome.status !== 'ok') {
        logger.debug({ server: name, code: outcome.code }, 'DoH resolver: no answer, returning N/A');
        return failure(outcome);
    }
    const addresses = outcome.records.map((record) => record.data);
    return { result: NAME_VALUED_TYPES.has(type) ? addresses.map(withRootDot) : addresses, status: 'ok' };
};

const dnsResolver = async (req, res) => {

    // Limit request method — defensive; app.get() in backend-server.js already gates method,
    // but a dedicated smoke test asserts this 405 branch directly against the handler.
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // Hostname presence, shape and lowercasing are guaranteed by requireValidDomain.
    const { hostname, type } = req.query;

    // One lookup task per entry × protocol, in stable order: data-file order,
    // udp before doh within a provider. Each task resolves to one row of the
    // response; failures become a classified 'N/A' row inside the resolvers,
    // so Promise.all never rejects here.
    const lookups = DNS_RESOLVERS.flatMap((server) => {
        const tasks = [];
        if (server.udp) {
            tasks.push(resolveDns(hostname, type, server.name, server.udp).then((outcome) => ({
                id: server.id,
                provider: server.name,
                country: server.country,
                type: 'udp',
                ...outcome,
            })));
        }
        if (server.doh) {
            tasks.push(resolveDoh(hostname, type, server.name, server.doh).then((outcome) => ({
                id: server.id,
                provider: server.name,
                country: server.country,
                type: 'doh',
                ...outcome,
            })));
        }
        return tasks;
    });

    try {
        const results = await Promise.all(lookups);
        res.json({ hostname, results });
    } catch (error) {
        logger.error({ err: error }, 'DNS resolver handler failed');
        res.status(500).send({ error: error.message });
    }
};

export { resolveDns, resolveDoh };
export default dnsResolver;
