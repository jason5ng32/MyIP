// api/dns-resolver.js — GET /api/dnsresolver: resolve a hostname against every
// resolver in api/data/dns-resolvers.js (UDP DNS + DoH) in parallel and return
// one flat, country-annotated result list the frontend groups by country.
import { Resolver } from 'dns';
import { promisify } from 'util';
import { fetchUpstream } from '../common/fetch-with-timeout.js';
import logger from '../common/logger.js';
import { DNS_RESOLVERS } from './data/dns-resolvers.js';

// Bound each upstream lookup so the slowest server doesn't pin the
// overall response. 3s for UDP DNS (`Resolver` rejects on first
// timeout because `tries: 1`); 5s for DoH via fetchUpstream's per-call
// override.
const DNS_TIMEOUT_MS = 3000;
const DOH_TIMEOUT_MS = 5000;

// Resolve via classic UDP DNS. Returns the raw result value: an array of
// strings, a joined MX string, or 'N/A' on empty/failure.
const resolveDns = async (hostname, type, name, server) => {
    const resolver = new Resolver({ timeout: DNS_TIMEOUT_MS, tries: 1 });
    resolver.setServers([server]);
    const resolve4Async = promisify(resolver.resolve4.bind(resolver));
    const resolve6Async = promisify(resolver.resolve6.bind(resolver));
    const resolveTxtAsync = promisify(resolver.resolveTxt.bind(resolver));
    const resolveCnameAsync = promisify(resolver.resolveCname.bind(resolver));
    const resolveNSAsync = promisify(resolver.resolveNs.bind(resolver));
    const resolveMXAsync = promisify(resolver.resolveMx.bind(resolver));
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
            default:
                throw new Error('Unsupported type');
        }

        if (addresses.length === 0 || addresses === '' || addresses === null) {
            return 'N/A';
        }

        return addresses;
    } catch (error) {
        // Per-server timeouts are expected (some DNS hosts are unreachable
        // from a given network); demote to debug so they don't spam the
        // terminal during normal operation.
        logger.debug({ err: error, server: name }, 'DNS resolver: lookup failed, returning N/A');
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
        const data = await response.json();
        const addresses = data.Answer ? data.Answer.map(answer => answer.data) : ['N/A'];
        if (addresses.length === 0 || addresses === '' || addresses === null) {
            return 'N/A';
        }
        return addresses;
    } catch (error) {
        logger.debug({ err: error, server: name }, 'DoH resolver: lookup failed, returning N/A');
        return 'N/A';
    }
};

const dnsResolver = async (req, res) => {

    // Limit request method — defensive; app.get() in backend-server.js already gates method,
    // but a dedicated smoke test asserts this 405 branch directly against the handler.
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { hostname, type } = req.query;

    if (typeof hostname !== 'string') {
        return res.status(400).send({ error: 'Hostname parameter must be a string' });
    }

    if (!hostname) {
        return res.status(400).send({ error: 'Missing hostname parameter' });
    }

    if (!hostname.includes('.')) {
        return res.status(400).send({ error: 'Invalid hostname' });
    }

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
        res.status(500).send({ error: error.message });
    }
};

export default dnsResolver;
