// api/data/dns-resolvers.js — the curated resolver list behind /api/dnsresolver.
//
// 👋 Contributors: this file is THE place to add a public DNS resolver.
// Add one object to DNS_RESOLVERS below; no other backend change is needed
// (the frontend groups results by `country` automatically). Entry shape:
//
//   {
//       id: 'google',                             // unique lowercase slug, [a-z0-9-]
//       name: 'Google',                           // display name shown in the UI
//       country: 'US',                            // ISO 3166-1 alpha-2, UPPERCASE
//                                                 // ('EU' allowed for EU-wide services)
//       udp: '8.8.8.8',                           // optional — public UDP resolver IPv4
//       doh: 'https://dns.google/resolve?',       // optional — DoH JSON endpoint prefix
//   }
//
// Rules (enforced by tests/dns-resolvers-data.test.js — run `pnpm test`):
// - At least one of `udp` / `doh` per entry.
// - `doh` must be an https:// URL prefix ending in '?' or '&' — the handler
//   appends `name=<host>&type=<type>` directly, so a prefix that already
//   carries query params ends in '&' (see Cloudflare's `ct=…&`). The endpoint
//   must speak the DNS-over-HTTPS JSON API (`Accept: application/dns-json`),
//   not just RFC 8484 wire format.
// - `country` is where the operator is based (headquarters), not where the
//   anycast nodes are.
//
// ⚠️ Keep this list curated, not exhaustive: EVERY resolver here adds one
// parallel upstream query per protocol to EVERY /api/dnsresolver request.
// Prefer well-known, stable, globally reachable services — and resolvers
// from countries not yet represented over a fifth US entry.
//
// Result ordering is stable: data-file order, and for providers with both
// protocols the udp lookup comes right before the doh one.

export const DNS_RESOLVERS = [
    { id: 'google', name: 'Google', country: 'US', udp: '8.8.8.8', doh: 'https://dns.google/resolve?' },
    { id: 'cloudflare', name: 'Cloudflare', country: 'US', udp: '1.1.1.1', doh: 'https://cloudflare-dns.com/dns-query?ct=application/dns-json&' },
    { id: 'opendns', name: 'OpenDNS', country: 'US', udp: '208.67.222.222' },
    { id: 'quad9', name: 'Quad9', country: 'CH', udp: '9.9.9.9' },
    { id: 'controld', name: 'ControlD', country: 'CA', udp: '76.76.2.0' },
    { id: 'adguard', name: 'AdGuard', country: 'CY', udp: '94.140.14.14', doh: 'https://dns.adguard.com/resolve?' },
    { id: 'yandex', name: 'Yandex.DNS', country: 'RU', udp: '77.88.8.8' },
    { id: 'alidns', name: 'AliDNS', country: 'CN', udp: '223.5.5.5', doh: 'https://dns.alidns.com/resolve?' },
    { id: 'dnspod', name: 'DNSPod', country: 'CN', udp: '119.29.29.29' },
    { id: '114dns', name: '114DNS', country: 'CN', udp: '114.114.114.114' },
    { id: 'dns4eu', name: 'DNS4EU', country: 'EU', udp: '86.54.11.1' },
];
