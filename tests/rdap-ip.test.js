// Coverage for the IP half of common/rdap.js — bootstrap endpoint
// selection (longest-prefix CIDR match), the RDAP-JSON → WHOIS-like
// `__raw` text formatter, and rdapIp's query-URL shape (fetch stubbed;
// real network stays out of scope).

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { findIpEndpoint, formatIpNetwork, rdapIp } from '../common/rdap.js';

// Shaped like IANA's ipv4.json / ipv6.json `services` arrays:
// [[cidr, …], [url, …]] per registry.
const SERVICES = [
    [['41.0.0.0/8', '102.0.0.0/8'], ['https://rdap.afrinic.net/rdap/', 'http://rdap.afrinic.net/rdap/']],
    [['204.0.0.0/8', '198.0.0.0/8'], ['https://rdap.arin.net/registry/']],
    // Overlapping, more-specific entry — must win over 204.0.0.0/8.
    [['204.1.0.0/16'], ['https://rdap.example.net/most-specific/']],
    [['2001:4200::/23'], ['https://rdap.afrinic.net/rdap/']],
    [['2c00::/12'], ['http://insecure.example/', 'https://rdap.afrinic.net/rdap/']],
];

describe('findIpEndpoint — longest-prefix match', () => {
    it('matches a plain IPv4 block', () => {
        assert.equal(findIpEndpoint(SERVICES, '41.1.2.3'), 'https://rdap.afrinic.net/rdap/');
    });

    it('prefers the most specific overlapping prefix', () => {
        assert.equal(findIpEndpoint(SERVICES, '204.1.92.8'), 'https://rdap.example.net/most-specific/');
        assert.equal(findIpEndpoint(SERVICES, '204.2.0.1'), 'https://rdap.arin.net/registry/');
    });

    it('matches IPv6 blocks against v6 entries only', () => {
        assert.equal(findIpEndpoint(SERVICES, '2001:4200::1'), 'https://rdap.afrinic.net/rdap/');
        // /23: 2001:43ff::… still inside, 2001:4400::… outside.
        assert.equal(findIpEndpoint(SERVICES, '2001:43ff::1'), 'https://rdap.afrinic.net/rdap/');
        assert.equal(findIpEndpoint(SERVICES, '2001:4400::1'), null);
    });

    it('prefers an https URL when the entry lists several', () => {
        assert.equal(findIpEndpoint(SERVICES, '2c00::1'), 'https://rdap.afrinic.net/rdap/');
    });

    it('returns null when nothing matches', () => {
        assert.equal(findIpEndpoint(SERVICES, '8.8.8.8'), null);
        assert.equal(findIpEndpoint(SERVICES, '::1'), null);
    });

    it('never cross-matches families', () => {
        // 204.x as v6 entry / 2001:… as v4 entry would both be nonsense.
        assert.equal(findIpEndpoint([[['204.0.0.0/8'], ['https://v4.example/']]], '2001:db8::1'), null);
        assert.equal(findIpEndpoint([[['2001:db8::/32'], ['https://v6.example/']]], '204.1.92.8'), null);
    });
});

// Frozen, trimmed-down ARIN-style RDAP IP-network response.
const ARIN_FIXTURE = {
    handle: 'NET-204-1-92-0-1',
    startAddress: '204.1.92.0',
    endAddress: '204.1.95.255',
    ipVersion: 'v4',
    name: 'NTT-EXAMPLE',
    type: 'DIRECT ALLOCATION',
    parentHandle: 'NET-204-0-0-0-0',
    country: 'US',
    cidr0_cidrs: [{ v4prefix: '204.1.92.0', length: 22 }],
    status: ['active'],
    events: [
        { eventAction: 'registration', eventDate: '1994-05-06T00:00:00-04:00' },
        { eventAction: 'last changed', eventDate: '2021-12-14T09:29:04-05:00' },
    ],
    entities: [
        {
            handle: 'NTTAM-1',
            roles: ['registrant'],
            vcardArray: ['vcard', [
                ['version', {}, 'text', '4.0'],
                ['fn', {}, 'text', 'NTT America, Inc.'],
            ]],
            entities: [
                {
                    handle: 'NTTAM-ABUSE',
                    roles: ['abuse'],
                    vcardArray: ['vcard', [
                        ['version', {}, 'text', '4.0'],
                        ['fn', {}, 'text', 'NTT Abuse Desk'],
                        ['email', {}, 'text', 'abuse@example.net'],
                    ]],
                },
            ],
        },
    ],
    remarks: [
        { title: 'Registration Comments', description: ['Peering requests via example.net'] },
    ],
};

describe('formatIpNetwork', () => {
    const raw = formatIpNetwork(ARIN_FIXTURE);

    it('renders the network header fields', () => {
        assert.match(raw, /^NetRange: 204\.1\.92\.0 - 204\.1\.95\.255$/m);
        assert.match(raw, /^CIDR: 204\.1\.92\.0\/22$/m);
        assert.match(raw, /^NetName: NTT-EXAMPLE$/m);
        assert.match(raw, /^Handle: NET-204-1-92-0-1$/m);
        assert.match(raw, /^Parent: NET-204-0-0-0-0$/m);
        assert.match(raw, /^NetType: DIRECT ALLOCATION$/m);
        assert.match(raw, /^Country: US$/m);
        assert.match(raw, /^Created: 1994-05-06/m);
        assert.match(raw, /^Updated: 2021-12-14/m);
    });

    it('surfaces nested contact entities, not just the top-level org', () => {
        assert.match(raw, /^Registrant:$/m);
        assert.match(raw, /Name: NTT America, Inc\./);
        assert.match(raw, /^Abuse:$/m);
        assert.match(raw, /Email: abuse@example\.net/);
    });

    it('renders remarks as titled sections', () => {
        assert.match(raw, /^Registration Comments:$/m);
        assert.match(raw, /^ {2}Peering requests via example\.net$/m);
    });

    it('degrades gracefully on a minimal object', () => {
        const minimal = formatIpNetwork({ startAddress: '10.0.0.0', endAddress: '10.255.255.255' });
        assert.match(minimal, /^NetRange: 10\.0\.0\.0 - 10\.255\.255\.255$/m);
        assert.ok(!minimal.includes('undefined'));
        assert.equal(formatIpNetwork({}).startsWith('NetRange: N/A - N/A'), true);
    });
});

describe('rdapIp — query URL shape', () => {
    it('keeps IPv6 colons literal in the path (some RIR delegates 400 on %3A)', async () => {
        const jsonResponse = (body) => ({ ok: true, status: 200, json: async () => body });
        const fetchMock = mock.method(globalThis, 'fetch', async (url) => {
            if (String(url).startsWith('https://data.iana.org/rdap/')) {
                return jsonResponse({ services: [[['2400::/12'], ['https://rdap.apnic.net/']]] });
            }
            return jsonResponse({ startAddress: '2404::', endAddress: '2404:ffff::' });
        });
        try {
            await rdapIp('2404:c0:2520::1');
            const queried = fetchMock.mock.calls
                .map((c) => String(c.arguments[0]))
                .find((u) => u.includes('/ip/'));
            assert.equal(queried, 'https://rdap.apnic.net/ip/2404:c0:2520::1');
        } finally {
            fetchMock.mock.restore();
        }
    });
});
