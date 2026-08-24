// api/dns-resolver.js — GET /api/dnsresolver: resolve a hostname against every
// resolver in api/data/dns-resolvers.js (UDP DNS + DoH) in parallel and return
// one flat, country-annotated result list the frontend groups by country.
import { Resolver } from 'dns';
import { promisify } from 'util';
import { fetchUpstream } from '../common/fetch-with-timeout.js';
import logger from '../common/logger.js';
import { DNS_RESOLVERS } from './data/dns-resolvers.js';
import { NAME_VALUED_TYPES } from '../common/dns-record-types.js';

// Bound each upstream lookup so the slowest server doesn't pin the
// overall response. 3s for UDP DNS (`Resolver` rejects on first
// timeout because `tries: 1`); 5s for DoH via fetchUpstream's per-call
// override.
const DNS_TIMEOUT_MS = 3000;
const DOH_TIMEOUT_MS = 5000;
const DNS_AVAILABILITY_ERRORS = new Set(['ETIMEOUT', 'ECONNREFUSED', 'EREFUSED']);

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

// Resolve via classic UDP DNS. Returns the raw result value: an array of
// strings, a formatted record string, or 'N/A' on empty/failure.
const resolveDns = async (hostname, type, name, server) => {
    const resolver = new Resolver({ timeout: DNS_TIMEOUT_MS, tries: 1 });
    resolver.setServers([server]);
    const resolve4Async = promisify(resolver.resolve4.bind(resolver));
    const resolve6Async = promisify(resolver.resolve6.bind(resolver));
    const resolveTxtAsync = promisify(resolver.resolveTxt.bind(resolver));
    const resolveCnameAsync = promisify(resolver.resolveCname.bind(resolver));
    const resolveNSAsync = promisify(resolver.resolveNs.bind(resolver));
    const resolveMXAsync = promisify(resolver.resolveMx.bind(resolver));
    const resolveSoaAsync = promisify(resolver.resolveSoa.bind(resolver));
    const resolveCaaAsync = promisify(resolver.resolveCaa.bind(resolver));
    try {
        let addresses;

        // Select different parsing methods based on the type parameter
        switch (type) {
            case 'A':
                addresses = await resolve4Async(hostname);
                break;
            case 'AAAA':
                addresses = await resolve6Async(hostname);
                break;
            case 'TXT':
                addresses = await resolveTxtAsync(hostname);
                // TXT record parsing results is a two-dimensional array, here we flatten the result
                addresses = addresses.flat();
                break;
            case 'CNAME':
                addresses = await resolveCnameAsync(hostname);
                break;
            case 'NS':
                addresses = await resolveNSAsync(hostname);
                break;
            case 'MX':
                addresses = await resolveMXAsync(hostname);
                addresses = addresses.map(item => `${item.priority} ${item.exchange}.`)
                .join(', ');
                break;
            case 'SOA':
                addresses = formatSoaRecord(await resolveSoaAsync(hostname));
                break;
            case 'CAA':
                addresses = formatCaaRecords(await resolveCaaAsync(hostname));
                break;
            default:
                throw new Error('Unsupported type');
        }

        if (NAME_VALUED_TYPES.has(type)) addresses = addresses.map(withRootDot);

        if (addresses.length === 0 || addresses === '' || addresses === null) {
            return 'N/A';
        }

        return addresses;
    } catch (error) {
        logDnsFailure(error, server, name);
        return 'N/A';
    }
};

// Resolve via the DNS-over-HTTPS JSON API. Same return semantics as
// resolveDns. `url` is a prefix ending in '?' or '&' (see the data file).
const resolveDoh = async (hostname, type, name, url) => {
    try {
        const response = await fetchUpstream(`${url}name=${hostname}&type=${type}`, {
            timeoutMs: DOH_TIMEOUT_MS,
            headers: { 'Accept': 'application/dns-json' }
        });
        if (!response.ok) {
            logger.warn({ server: name, code: response.status }, 'DoH resolver: upstream returned a non-2xx response');
            return 'N/A';
        }
        const records = dohRecords(await response.json(), type);
        if (records.length === 0) return 'N/A';
        const addresses = records.map((record) => record.data);
        return NAME_VALUED_TYPES.has(type) ? addresses.map(withRootDot) : addresses;
    } catch (error) {
        logger.warn({ err: error, server: name, code: error?.code }, 'DoH resolver: lookup failed, returning N/A');
        return 'N/A';
    }
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
    // response; failures collapse to result 'N/A' inside the resolvers, so
    // Promise.all never rejects here.
    const lookups = DNS_RESOLVERS.flatMap((server) => {
        const tasks = [];
        if (server.udp) {
            tasks.push(resolveDns(hostname, type, server.name, server.udp).then((result) => ({
                id: server.id,
                provider: server.name,
                country: server.country,
                type: 'udp',
                result,
            })));
        }
        if (server.doh) {
            tasks.push(resolveDoh(hostname, type, server.name, server.doh).then((result) => ({
                id: server.id,
                provider: server.name,
                country: server.country,
                type: 'doh',
                result,
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
