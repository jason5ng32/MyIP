// Guards frontend/utils/ip-calc.js — the classifier and its rule order, the
// IANA block tables, the IPv6 decoders, PTR names, obfuscated / embedded
// forms, count formatting, and the never-throws contract of `calculate()`.
// MAC input is asserted absent (MAC Lookup's job).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    IPV4_SPECIAL_BLOCKS, IPV6_SPECIAL_BLOCKS, IPV6_MULTICAST_SCOPES, lookupBlocks,
    classifyInput, calculate,
    analyzeIPv4, analyzeIPv6, analyzeCidr, analyzeRange, analyzeList, analyzeInteger,
    extractEmbeddedIPv4, decodeTeredo, iidToMac, solicitedNode,
    ptrName, ptrZone, obfuscatedForms, ipv4ToEmbeddedForms, formatCount, countLabel,
} from '../frontend/utils/ip-calc.js';
import { parseIp, parseCidr, formatIPv4 } from '../common/ip-math.js';

const v = (ip) => parseIp(ip).value;

describe('special-purpose tables', () => {
    for (const [name, table] of [['IPv4', IPV4_SPECIAL_BLOCKS], ['IPv6', IPV6_SPECIAL_BLOCKS]]) {
        it(`${name} rows parse, are aligned, and have unique ids`, () => {
            const ids = new Set();
            for (const row of table) {
                const cidr = parseCidr(row.cidr);
                assert.ok(cidr, `${row.cidr} must parse`);
                assert.equal(cidr.aligned, true, `${row.cidr} must be a network address`);
                assert.ok(row.rfc.length > 0, `${row.id} cites an RFC`);
                assert.equal(typeof row.global, 'boolean');
                assert.ok(!ids.has(row.id), `duplicate id ${row.id}`);
                ids.add(row.id);
            }
        });
    }
});

describe('IPv4 blocks', () => {
    const cases = [
        ['10.1.2.3', 'private-10'], ['172.15.255.255', null], ['172.16.0.0', 'private-172'],
        ['172.31.255.255', 'private-172'], ['172.32.0.0', null], ['100.63.255.255', null],
        ['100.64.0.0', 'shared-cgnat'], ['100.127.255.255', 'shared-cgnat'], ['100.128.0.0', null],
        ['127.0.0.1', 'loopback'], ['127.255.255.255', 'loopback'], ['169.254.1.1', 'link-local'],
        ['192.0.0.1', 'ds-lite'], ['192.0.0.8', 'dummy'], ['192.0.0.9', 'pcp-anycast'], ['192.0.0.10', 'turn-anycast'],
        ['192.0.0.170', 'nat64-discovery'], ['192.0.0.171', 'nat64-discovery'], ['192.0.0.200', 'ietf-protocol'],
        ['192.0.2.1', 'test-net-1'], ['192.88.99.1', '6to4-relay'], ['198.18.0.1', 'benchmarking'],
        ['198.19.255.255', 'benchmarking'], ['198.20.0.0', null], ['198.51.100.1', 'test-net-2'],
        ['203.0.113.1', 'test-net-3'], ['224.0.0.1', 'mcast-local-control'], ['232.1.1.1', 'mcast-ssm'],
        ['239.1.1.1', 'mcast-admin'], ['225.0.0.1', 'multicast'], ['240.0.0.1', 'reserved-240'],
        ['255.255.255.255', 'broadcast'], ['0.0.0.0', 'this-host'], ['0.1.2.3', 'this-network'], ['8.8.8.8', null],
    ];
    for (const [ip, id] of cases) {
        it(`${ip} → ${id ?? 'global'}`, () => {
            const r = analyzeIPv4(v(ip));
            assert.equal(r.block?.id ?? null, id);
            if (id === null) {
                assert.equal(r.scope, 'global');
                assert.equal(r.isGlobal, true);
                assert.deepEqual(r.blocks, []);
            }
        });
    }
    it('lists every containing block, most specific first', () => {
        assert.deepEqual(analyzeIPv4(v('192.0.0.1')).blocks.map((b) => b.id), ['ds-lite', 'ietf-protocol']);
        assert.deepEqual(analyzeIPv4(v('255.255.255.255')).blocks.map((b) => b.id), ['broadcast', 'reserved-240']);
        assert.deepEqual(analyzeIPv4(v('224.0.0.1')).blocks.map((b) => b.id), ['mcast-local-control', 'multicast']);
    });
    it('classes A–E by first octet', () => {
        const cls = (ip) => analyzeIPv4(v(ip)).class;
        assert.equal(cls('1.0.0.0'), 'A'); assert.equal(cls('127.255.255.255'), 'A');
        assert.equal(cls('128.0.0.0'), 'B'); assert.equal(cls('191.255.255.255'), 'B');
        assert.equal(cls('192.0.0.0'), 'C'); assert.equal(cls('223.255.255.255'), 'C');
        assert.equal(cls('224.0.0.0'), 'D'); assert.equal(cls('240.0.0.0'), 'E');
    });
    it('renders representations and PTR', () => {
        const r = analyzeIPv4(v('127.0.0.1'));
        assert.equal(r.canonical, '127.0.0.1');
        assert.equal(r.integer, '2130706433');
        assert.equal(r.hex, '0x7f000001');
        assert.equal(r.octal, '017700000001');
        assert.equal(r.binary, '01111111.00000000.00000000.00000001');
        assert.equal(r.ptr, '1.0.0.127.in-addr.arpa');
        assert.equal(analyzeIPv4(2n ** 32n), null);
    });
});

describe('IPv6 blocks', () => {
    const cases = [
        ['::', 'unspecified'], ['::1', 'loopback'], ['::2', 'ipv4-compatible'], ['::ffff:192.0.2.1', 'ipv4-mapped'],
        ['::ffff:c000:201', 'ipv4-mapped'], ['64:ff9b::c000:201', 'nat64-wkp'], ['64:ff9b:1::c000:201', 'nat64-local'],
        ['100::1', 'discard'], ['2001::1', 'teredo'], ['2001:1::1', 'pcp-anycast-v6'], ['2001:1::2', 'turn-anycast-v6'],
        ['2001:1::3', 'dnssd-srp-anycast'], ['2001:1::4', 'ietf-protocol-v6'], ['2001:2::1', 'benchmarking-v6'],
        ['2001:3::1', 'amt-v6'], ['2001:4:112::1', 'as112-v6'], ['2001:10::1', 'orchid'], ['2001:20::1', 'orchid-v2'],
        ['2001:2f:ffff::1', 'orchid-v2'], ['2001:30::1', 'drone-rid'], ['2001:db8::1', 'documentation-v6'],
        ['2001:db9::1', 'global-unicast'], ['2002:c000:201::1', '6to4'], ['2620:4f:8000::1', 'as112-direct-v6'],
        ['3fff::1', 'documentation-3fff'], ['3fff:fff::1', 'documentation-3fff'], ['3fff:1000::1', 'global-unicast'],
        ['5f00::1', 'srv6'], ['2600::1', 'global-unicast'], ['4000::1', 'reserved-ietf'], ['fbff::1', 'reserved-ietf'],
        ['fc00::1', 'ula'], ['fd12:3456:789a:1::1', 'ula'], ['fe80::1', 'link-local-v6'], ['febf::1', 'link-local-v6'],
        ['fec0::1', 'site-local'], ['ff02::1', 'multicast-v6'], ['ff02::1:ff00:1', 'solicited-node'],
    ];
    for (const [ip, id] of cases) {
        it(`${ip} → ${id}`, () => assert.equal(analyzeIPv6(v(ip)).block.id, id));
    }
    it('global flag follows the block', () => {
        assert.equal(analyzeIPv6(v('2600::1')).isGlobal, true);
        assert.equal(analyzeIPv6(v('2002:c000:201::1')).isGlobal, true);
        assert.equal(analyzeIPv6(v('fd00::1')).isGlobal, false);
        assert.equal(analyzeIPv6(v('4000::1')).scope, 'reserved');
        assert.equal(analyzeIPv6(v('4000::1')).blocks.length, 1);
    });
    it('renders compressed / expanded / hex / PTR', () => {
        const r = analyzeIPv6(v('2001:db8::1'));
        assert.equal(r.compressed, '2001:db8::1');
        assert.equal(r.expanded, '2001:0db8:0000:0000:0000:0000:0000:0001');
        assert.equal(r.hex, '0x20010db8000000000000000000000001');
        assert.equal(r.ptr, '1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa');
        assert.equal(analyzeIPv6(2n ** 128n), null);
    });
});

describe('IPv6 decoders', () => {
    it('extracts embedded IPv4 per mechanism', () => {
        assert.equal(extractEmbeddedIPv4(v('::ffff:192.0.2.1')), '192.0.2.1');
        assert.equal(extractEmbeddedIPv4(v('::2')), '0.0.0.2');
        assert.equal(extractEmbeddedIPv4(v('64:ff9b::c000:201')), '192.0.2.1');
        assert.equal(extractEmbeddedIPv4(v('64:ff9b:1::c000:201')), '192.0.2.1');
        assert.equal(extractEmbeddedIPv4(v('2002:c000:201::1')), '192.0.2.1');
        assert.equal(extractEmbeddedIPv4(v('::1')), null);
        assert.equal(extractEmbeddedIPv4(v('2001:db8::1')), null);
        assert.equal(extractEmbeddedIPv4('nope'), null);
        assert.equal(analyzeIPv6(v('::ffff:192.0.2.1'), { embeddedV4: true }).embeddedV4Notation, true);
    });
    it('decodes Teredo', () => {
        const t = decodeTeredo(v('2001:0:4136:e378:8000:63bf:3fff:fdd2'));
        assert.deepEqual(t, { server: '65.54.227.120', client: '192.0.2.45', port: 40000, cone: true });
        assert.equal(decodeTeredo(v('2001:db8::1')), null);
        assert.equal(analyzeIPv6(v('2001:db8::1')).teredo, null);
        assert.equal(analyzeIPv6(v('2001:0:4136:e378:8000:63bf:3fff:fdd2')).teredo.port, 40000);
    });
    it('recovers a MAC from a modified EUI-64 interface id', () => {
        const universal = analyzeIPv6(v('fe80::211:22ff:fe33:4455')).iid;
        assert.equal(universal.isEui64, true);
        assert.equal(universal.mac, '00:11:22:33:44:55');
        assert.equal(universal.universal, true);
        assert.equal(universal.hex, '0211:22ff:fe33:4455');
        assert.equal(universal.solicitedNode, 'ff02::1:ff33:4455');
        const local = analyzeIPv6(v('fe80::11:22ff:fe33:4455')).iid;
        assert.equal(local.mac, '02:11:22:33:44:55');
        assert.equal(local.universal, false);
        const plain = analyzeIPv6(v('2001:db8::1')).iid;
        assert.equal(plain.isEui64, false);
        assert.equal(plain.mac, null);
        assert.equal(plain.isSubnetRouterAnycast, false);
        assert.equal(analyzeIPv6(v('2001:db8::')).iid.isSubnetRouterAnycast, true);
        assert.equal(analyzeIPv6(v('::ffff:1.2.3.4')).iid, null);
        assert.equal(analyzeIPv6(v('2001:0:4136:e378:8000:63bf:3fff:fdd2')).iid, null);
        assert.equal(analyzeIPv6(v('2002:c000:201::211:22ff:fe33:4455')).iid.mac, '00:11:22:33:44:55');
        assert.equal(iidToMac(-1n), null);
        assert.equal(iidToMac(0n), null);
    });
    it('iidToMac on a bare interface id', () => {
        assert.deepEqual(iidToMac(0x021122fffe334455n), { mac: '00:11:22:33:44:55', universal: true });
        assert.deepEqual(iidToMac(0x001122fffe334455n), { mac: '02:11:22:33:44:55', universal: false });
        assert.equal(iidToMac(0x0011223344556677n), null);
    });
    it('solicited-node multicast', () => {
        assert.equal(solicitedNode(v('fe80::211:22ff:fe33:4455')), 'ff02::1:ff33:4455');
        assert.equal(solicitedNode(v('2001:db8::1')), 'ff02::1:ff00:1');
        assert.equal(solicitedNode(5), null);
    });
    it('multicast flags and scopes', () => {
        const link = analyzeIPv6(v('ff02::1')).multicast;
        assert.deepEqual(link.flags, { T: false, P: false, R: false });
        assert.deepEqual(link.scope, { id: 2, name: 'link-local' });
        assert.equal(link.solicitedNodeSuffix, null);
        assert.equal(analyzeIPv6(v('ff02::1:ff00:1')).multicast.solicitedNodeSuffix, '00:00:01');
        assert.equal(analyzeIPv6(v('ff05::2')).multicast.scope.name, 'site-local');
        const transient = analyzeIPv6(v('ff1e::1')).multicast;
        assert.equal(transient.flags.T, true);
        assert.equal(transient.scope.name, 'global');
        const prefixBased = analyzeIPv6(v('ff3e:40:2001:db8::1')).multicast.flags;
        assert.deepEqual(prefixBased, { T: true, P: true, R: false });
        assert.equal(analyzeIPv6(v('ff0f::1')).multicast.scope.name, 'reserved');
        assert.equal(analyzeIPv6(v('ff06::1')).multicast.scope.name, 'unassigned');
        assert.equal(analyzeIPv6(v('2001:db8::1')).multicast, null);
        assert.equal(IPV6_MULTICAST_SCOPES[14], 'global');
    });
    it('ULA fields', () => {
        const random = analyzeIPv6(v('fd12:3456:789a:1::1')).ula;
        assert.deepEqual(random, { locallyAssigned: true, globalId: '12:3456:789a', subnetId: '0001' });
        assert.equal(analyzeIPv6(v('fc00::1')).ula.locallyAssigned, false);
        assert.equal(analyzeIPv6(v('2001:db8::1')).ula, null);
    });
});

describe('PTR', () => {
    it('names', () => {
        assert.equal(ptrName(parseIp('192.0.2.1')), '1.2.0.192.in-addr.arpa');
        assert.equal(ptrName(parseIp('::ffff:192.0.2.1')), '1.0.2.0.0.0.0.c.f.f.f.f.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.ip6.arpa');
        assert.equal(ptrName(null), null);
        assert.equal(ptrName({ family: 6, value: -1n }), null);
    });
    it('zones', () => {
        assert.equal(ptrZone('192.0.2.0/24'), '2.0.192.in-addr.arpa');
        assert.equal(ptrZone('10.0.0.0/8'), '10.in-addr.arpa');
        assert.equal(ptrZone('0.0.0.0/0'), 'in-addr.arpa');
        assert.equal(ptrZone('192.0.2.0/23'), null);
        assert.equal(ptrZone('2001:db8::/32'), '8.b.d.0.1.0.0.2.ip6.arpa');
        assert.equal(ptrZone('2001:db8::/48'), '0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa');
        assert.equal(ptrZone('::/0'), 'ip6.arpa');
        assert.equal(ptrZone('2001:db8::/33'), null);
        assert.equal(ptrZone('junk'), null);
    });
});

describe('IPv4 forms', () => {
    it('obfuscated forms', () => {
        const f = obfuscatedForms(v('127.0.0.1'));
        assert.equal(f.decimal, '2130706433');
        assert.equal(f.hex, '0x7f000001');
        assert.equal(f.octal, '017700000001');
        assert.equal(f.dottedHex, '0x7f.0x0.0x0.0x1');
        assert.equal(f.dottedOctal, '0177.00.00.01');
        assert.deepEqual(f.short, ['127.0.1', '127.1']);
        assert.deepEqual(obfuscatedForms(v('192.168.1.1')).short, ['192.168.257', '192.11010305']);
        assert.deepEqual(obfuscatedForms(v('0.0.0.0')).short, ['0.0.0', '0.0']);
        assert.equal(obfuscatedForms(-1n), null);
    });
    it('every obfuscated form re-parses to the same address', () => {
        for (const ip of ['127.0.0.1', '192.168.1.1', '10.0.0.255', '255.255.255.255', '0.0.0.0', '8.8.8.8']) {
            const f = obfuscatedForms(v(ip));
            for (const form of [f.decimal, f.hex, f.octal, f.dottedHex, f.dottedOctal, ...f.short]) {
                const r = calculate(form);
                assert.equal(r.analysis?.address?.canonical, ip, `${form} should read as ${ip}`);
            }
        }
    });
    it('embedded forms', () => {
        assert.deepEqual(ipv4ToEmbeddedForms(v('192.0.2.1')), {
            mapped: '::ffff:192.0.2.1',
            mappedHex: '::ffff:c000:201',
            compat: '::192.0.2.1',
            nat64: '64:ff9b::192.0.2.1',
            sixToFour: '2002:c000:201::/48',
        });
        assert.equal(ipv4ToEmbeddedForms(2n ** 32n), null);
    });
});

describe('formatCount', () => {
    it('exact / grouped / pow2 / approx', () => {
        assert.deepEqual(formatCount(1n), { exact: '1', grouped: '1', pow2: 0, approx: null });
        assert.deepEqual(formatCount(254n), { exact: '254', grouped: '254', pow2: null, approx: null });
        assert.equal(formatCount(256n).pow2, 8);
        assert.deepEqual(formatCount(2n ** 32n), { exact: '4294967296', grouped: '4,294,967,296', pow2: 32, approx: null });
        const big = formatCount(2n ** 64n);
        assert.equal(big.exact, '18446744073709551616');
        assert.equal(big.pow2, 64);
        assert.equal(big.approx, '1.84×10^19');
        const huge = formatCount(2n ** 128n);
        assert.equal(huge.exact, '340282366920938463463374607431768211456');
        assert.equal(huge.pow2, 128);
        assert.equal(huge.approx, '3.40×10^38');
        assert.deepEqual(formatCount(0n), { exact: '0', grouped: '0', pow2: null, approx: null });
        assert.equal(formatCount(5), null);
        assert.equal(formatCount(-1n), null);
    });
    it('countLabel', () => {
        assert.equal(countLabel(formatCount(254n)), '254');
        assert.equal(countLabel(formatCount(256n)), '256');
        assert.equal(countLabel(formatCount(1024n)), '1,024 (2^10)');
        assert.equal(countLabel(formatCount(2n ** 64n)), '18,446,744,073,709,551,616 (2^64)');
        assert.equal(countLabel(null), '');
    });
});

describe('analyzeCidr', () => {
    it('returns strings only, with zone and presets', () => {
        const r = analyzeCidr('192.168.1.130/26');
        assert.equal(r.cidr, '192.168.1.128/26');
        assert.equal(r.address, '192.168.1.130');
        assert.equal(r.network, '192.168.1.128');
        assert.equal(r.broadcast, '192.168.1.191');
        assert.equal(r.first, '192.168.1.129');
        assert.equal(r.last, '192.168.1.190');
        assert.equal(r.mask, '255.255.255.192');
        assert.equal(r.maskHex, '0xffffffc0');
        assert.equal(r.wildcard, '0.0.0.63');
        assert.equal(r.count.exact, '64');
        assert.equal(r.usable.exact, '62');
        assert.equal(r.aligned, false);
        assert.equal(r.ptrZone, null);
        assert.equal(r.block.id, 'private-192');
        assert.deepEqual(r.splitPresets, [27, 28, 29, 30, 31, 32]);
        assert.equal(r.slash64s, null);
        for (const value of Object.values(r)) assert.notEqual(typeof value, 'bigint');
    });
    it('IPv6 prefixes count /64s and offer nibble presets', () => {
        const r = analyzeCidr('2001:db8::/48');
        assert.equal(r.network, '2001:db8::');
        assert.equal(r.broadcast, null);
        assert.equal(r.mask, 'ffff:ffff:ffff::');
        assert.equal(r.maskHex, '0xffffffffffff00000000000000000000');
        assert.equal(r.count.pow2, 80);
        assert.equal(r.slash64s.exact, '65536');
        assert.equal(r.ptrZone, '0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa');
        assert.deepEqual(r.splitPresets, [52, 56, 60, 64]);
        assert.deepEqual(analyzeCidr('2001:db8::/64').splitPresets, [68, 72, 76, 80]);
        assert.deepEqual(analyzeCidr('2001:db8::/126').splitPresets, [128]);
        assert.equal(analyzeCidr('2001:db8::/65').slash64s, null);
        assert.equal(analyzeCidr('junk'), null);
    });
});

describe('classifyInput', () => {
    const table = [
        ['', 'invalid', 'empty'], ['   ', 'invalid', 'empty'],
        ['192.0.2.1', 'ipv4'], [' 192.0.2.1 ', 'ipv4'], ['1.2.3.4,', 'ipv4'],
        ['192.0.2.0/24', 'ipv4-cidr'], ['192.0.2.0/255.255.255.0', 'ipv4-cidr'],
        ['192.0.2.0/33', 'invalid', 'cidr-prefix'], ['foo/24', 'invalid', 'cidr-address'], ['1.2.3.4/24/25', 'invalid', 'cidr-prefix'],
        ['2001:db8::1', 'ipv6'], ['[2001:db8::1]', 'ipv6'], ['2001:db8::/32', 'ipv6-cidr'], ['::ffff:192.0.2.1/120', 'ipv6-cidr'],
        ['2001:db8:::1', 'invalid', 'ipv6-syntax'], ['00:11:22:33:44:55:66:77', 'ipv6'],
        ['2130706433', 'integer'], ['0', 'integer'], ['340282366920938463463374607431768211456', 'invalid', 'integer-too-large'],
        ['0177', 'ipv4'], ['089', 'invalid', 'bad-octal'], ['123456789012', 'integer'],
        ['0x7f000001', 'hex'], ['0x1', 'hex'], ['0x100000000', 'hex'], ['0x' + 'f'.repeat(33), 'invalid', 'hex-too-large'],
        ['0x', 'invalid', 'unrecognized'], ['20010db8000000000000000000000001', 'hex'],
        ['127.1', 'ipv4'], ['0177.0.0.1', 'ipv4'], ['0x7f.0.0.1', 'ipv4'], ['1.2.3.256', 'invalid', 'unrecognized'],
        ['300.1', 'invalid', 'unrecognized'], ['1.2.3.4.5', 'invalid', 'unrecognized'], ['08.1.1.1', 'invalid', 'unrecognized'],
        ['192.0.2.1 - 192.0.2.100', 'range'], ['192.0.2.1-100', 'range'], ['2001:db8::1-2001:db8::ff', 'range'],
        ['192.0.2.1-2001:db8::1', 'invalid', 'range'], ['192.0.2.1-300', 'invalid', 'range'],
        ['10.0.0.0/8 10.1.0.0/16', 'cidr-list'], ['10.0.0.0/8,10.1.0.0/16', 'cidr-list'], ['10.0.0.0/8\n10.1.0.0/16', 'cidr-list'],
        ['10.0.0.0/8;1.2.3.4', 'cidr-list'], ['10.0.0.0/8, foo', 'cidr-list'], ['foo bar', 'invalid', 'list-no-valid'],
        // MACs are not an input here — the MAC Lookup tool owns them.
        ['00:11:22:33:44:55', 'invalid', 'ipv6-syntax'], ['00-11-22-33-44-55', 'invalid', 'unrecognized'],
        ['0011.2233.4455', 'invalid', 'unrecognized'], ['00112233aabb', 'invalid', 'unrecognized'],
        ['001122334455', 'ipv4'], ['00:11:22:33:44', 'invalid', 'ipv6-syntax'], ['hello', 'invalid', 'unrecognized'],
    ];
    for (const [input, kind, reason] of table) {
        it(`${JSON.stringify(input)} → ${kind}${reason ? `/${reason}` : ''}`, () => {
            const r = classifyInput(input);
            assert.equal(r.kind, kind);
            if (reason) assert.equal(r.reason, reason);
        });
    }

    it('carries kind-specific fields', () => {
        assert.equal(classifyInput('fe80::1%eth0').zone, 'eth0');
        assert.equal(classifyInput('fe80::1%eth0').kind, 'ipv6');
        assert.equal(classifyInput('1.2.3.4,').input, '1.2.3.4');
        assert.equal(classifyInput('192.0.2.5/24').cidr.aligned, false);
        assert.equal(classifyInput('192.0.2.0/255.255.255.0').cidr.prefix, 24);
        assert.equal(classifyInput('::ffff:192.0.2.1').embeddedV4, true);
        assert.equal(classifyInput('192.0.2.1').notation, 'dotted');
        assert.equal(classifyInput('127.1').notation, 'shorthand');
        assert.equal(classifyInput('0177.0.0.1').notation, 'octal');
        assert.equal(classifyInput('0x7f.0x0.0x0.0x1').notation, 'hex');
        assert.equal(classifyInput('0177.0x0.0.1').notation, 'mixed');
        assert.equal(classifyInput('0177').notation, 'octal');
        assert.equal(formatIPv4(classifyInput('0177').value), '0.0.0.127');
        assert.equal(formatIPv4(classifyInput('127.1.1').value), '127.1.0.1');
        assert.equal(formatIPv4(classifyInput('1.2.515').value), '1.2.2.3');
        assert.equal(formatIPv4(classifyInput('1.256').value), '1.0.1.0');
        assert.equal(classifyInput('0177.0.0.1').obfuscated, true);
        assert.equal(classifyInput('192.0.2.1').obfuscated, false);
    });

    it('sizes integers and hex by family', () => {
        assert.equal(classifyInput('2130706433').family, 4);
        assert.equal(classifyInput('4294967295').family, 4);
        assert.equal(classifyInput('4294967296').family, 6);
        assert.equal(classifyInput('0x7f000001').family, 4);
        assert.equal(classifyInput('0x100000000').family, 6);
        assert.equal(classifyInput('0x20010db8000000000000000000000001').family, 6);
        assert.equal(classifyInput('20010db8000000000000000000000001').prefixed, false);
        assert.equal(classifyInput('0x1').prefixed, true);
    });

    it('twelve bare digits with a leading zero read as octal', () => {
        assert.equal(classifyInput('001122334455').notation, 'octal');
        assert.equal(classifyInput('123456789012').kind, 'integer');
    });

    it('normalises ranges', () => {
        const r = classifyInput('192.0.2.100-192.0.2.1');
        assert.equal(r.reversed, true);
        assert.equal(formatIPv4(r.start.value), '192.0.2.1');
        assert.equal(formatIPv4(classifyInput('192.0.2.1-100').end.value), '192.0.2.100');
        assert.equal(classifyInput('192.0.2.1 - 192.0.2.100').reversed, false);
    });

    it('lists keep their invalid tokens', () => {
        const r = classifyInput('10.0.0.0/8, foo, 1.2.3.4');
        assert.deepEqual(r.tokens, ['10.0.0.0/8', 'foo', '1.2.3.4']);
        assert.deepEqual(r.invalid, ['foo']);
    });
});

describe('calculate', () => {
    it('ipv4 host defaults to /32, cidr keeps its prefix', () => {
        const host = calculate('192.0.2.1');
        assert.equal(host.analysis.address.canonical, '192.0.2.1');
        assert.equal(host.analysis.cidr.prefix, 32);
        const cidr = calculate('192.0.2.5/24');
        assert.equal(cidr.analysis.cidr.network, '192.0.2.0');
        assert.equal(cidr.analysis.address.canonical, '192.0.2.5');
    });
    it('ipv6 host defaults to /64', () => {
        const r = calculate('2001:db8::1');
        assert.equal(r.analysis.cidr.prefix, 64);
        assert.equal(r.analysis.cidr.network, '2001:db8::');
    });
    it('integer / hex add a number view', () => {
        const r = calculate('0x7f000001');
        assert.equal(r.analysis.address.canonical, '127.0.0.1');
        assert.deepEqual(r.analysis.number, analyzeInteger(0x7f000001n, 4));
        assert.equal(r.analysis.number.asIPv4, '127.0.0.1');
        assert.equal(r.analysis.number.asIPv6, '::7f00:1');
        assert.equal(r.analysis.number.bits, 31);
        const big = calculate('4294967296');
        assert.equal(big.analysis.number.asIPv4, null);
        assert.equal(big.analysis.number.asIPv6, '::1:0:0');
        assert.equal(analyzeInteger(0n, 4).bits, 0);
        assert.equal(analyzeInteger(2n ** 32n, 4), null);
    });
    it('range', () => {
        const r = calculate('10.0.0.1-10.0.0.254');
        assert.equal(r.analysis.cidrs.length, 14);
        assert.equal(r.analysis.count.exact, '254');
        assert.equal(r.analysis.aggregated, null);
        assert.equal(calculate('10.0.0.0-10.0.0.255').analysis.aggregated, '10.0.0.0/24');
        assert.equal(analyzeRange('x', 'y'), null);
    });
    it('cidr list', () => {
        const r = calculate('192.168.0.0/24 192.168.1.0/24 2001:db8::1 foo');
        assert.deepEqual(r.analysis.v4.input, ['192.168.0.0/24', '192.168.1.0/24']);
        assert.deepEqual(r.analysis.v4.aggregated, ['192.168.0.0/23']);
        assert.equal(r.analysis.v4.count.exact, '512');
        assert.deepEqual(r.analysis.v6.input, ['2001:db8::1/128']);
        assert.deepEqual(r.analysis.v6.aggregated, ['2001:db8::1/128']);
        assert.deepEqual(r.analysis.invalid, ['foo']);
        assert.equal(analyzeList('nope'), null);
    });
    it('never throws on junk', () => {
        const junk = ['/', '::/', '0x', '-', ' - ', '1.2.3.4-', '%', '[]', '[', ' ', '..', '...', ':', '::::',
            '1.2.3.4/', '/32', '1-2-3', '10.0.0.0/8 -', 'a'.repeat(10000), '9'.repeat(200), '1.2.3.4%eth0',
            'fe80::1%', '%eth0', '0x0x1', '0177.0177.0177.0177.0177', '256', '1..2', '.1.2.3', '1.2.3.',
            ',', ';;', '00:00:00:00:00:00:00', '::ffff:256.1.1.1', null, undefined, 42, {}, [], true];
        for (const input of junk) {
            let r;
            assert.doesNotThrow(() => { r = calculate(input); }, `threw on ${JSON.stringify(input)}`);
            assert.ok(r && typeof r.kind === 'string', `no kind for ${JSON.stringify(input)}`);
        }
        assert.equal(calculate('256').kind, 'integer');
        assert.equal(calculate('9'.repeat(200)).kind, 'invalid');
    });
    it('lookupBlocks is exported and sorted', () => {
        assert.deepEqual(lookupBlocks(4, v('192.0.0.9')).map((b) => b.id), ['pcp-anycast', 'ietf-protocol']);
        assert.deepEqual(lookupBlocks(4, v('192.0.0.1')).map((b) => b.id), ['ds-lite', 'ietf-protocol']);
        assert.deepEqual(lookupBlocks(6, v('ff02::1:ff00:1')).map((b) => b.id), ['solicited-node', 'multicast-v6']);
    });
});
