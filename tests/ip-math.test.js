// Guards common/ip-math.js — the BigInt address arithmetic behind the IP
// Calculator and rdap's CIDR containment: strict parsers, RFC 5952
// formatting, mask / count math, containment, and the set operations
// (split, aggregate, range → CIDR). Also pins the frontend bridge to the
// same functions.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as common from '../common/ip-math.js';
import * as bridge from '../frontend/utils/ip-math.js';

const {
    parseIPv4, parseIPv6, parseIp, ipToBigInt, parseCidr,
    formatIPv4, formatIPv6, formatIp, formatCidr, toOctets, toHextets,
    prefixToMask, maskToPrefix, wildcardMask, addressCount, usableCount, smallestPrefixFor,
    cidrInfo, prefixContains, cidrContains, cidrOverlaps, compareIps,
    splitCidr, aggregateCidrs, rangeToCidrs, cidrToRange,
} = common;

const v4 = (str) => parseIPv4(str).value;
const v6 = (str) => parseIPv6(str).value;

describe('frontend bridge', () => {
    it('re-exports every common export unchanged', () => {
        for (const [name, fn] of Object.entries(common)) {
            assert.equal(bridge[name], fn, `bridge is missing or diverges on ${name}`);
        }
    });
});

describe('parseIPv4', () => {
    const accept = [
        ['192.0.2.1', 0xc0000201n],
        ['0.0.0.0', 0n],
        ['255.255.255.255', 4294967295n],
        ['10.0.0.1', 0x0a000001n],
    ];
    for (const [input, value] of accept) {
        it(`parses ${input}`, () => assert.deepEqual(parseIPv4(input), { family: 4, value }));
    }
    const reject = ['256.0.0.1', '01.2.3.4', '1.2.3', '1.2.3.4.5', '1.2.3.4 ', ' 1.2.3.4',
        '127.1', '0x7f.0.0.1', '', '1.2.3.-4', '1.2.3.4/24', 'a.b.c.d', 42, null, undefined];
    for (const input of reject) {
        it(`rejects ${JSON.stringify(input)}`, () => assert.equal(parseIPv4(input), null));
    }
});

describe('parseIPv6', () => {
    const accept = [
        ['::1', 1n, false],
        ['::', 0n, false],
        ['2001:db8::1', 0x20010db8000000000000000000000001n, false],
        ['2001:DB8::1', 0x20010db8000000000000000000000001n, false],
        ['2001:0db8:0000:0000:0000:0000:0000:0001', 0x20010db8000000000000000000000001n, false],
        ['::ffff:192.0.2.1', 0xffffc0000201n, true],
        ['::192.0.2.1', 0xc0000201n, true],
        ['64:ff9b::192.0.2.1', 0x0064ff9b0000000000000000c0000201n, true],
        ['0:0:0:0:0:ffff:1.2.3.4', 0xffff01020304n, true],
        ['1::', 1n << 112n, false],
        ['fe80::1', 0xfe800000000000000000000000000001n, false],
    ];
    for (const [input, value, embeddedV4] of accept) {
        it(`parses ${input}`, () => assert.deepEqual(parseIPv6(input), { family: 6, value, embeddedV4 }));
    }
    const reject = ['1:2:3:4:5:6:7:1.2.3.4', '::1.2.3', '::01.2.3.4', '1.2.3.4::', '1.2.3.4', ':::',
        '1::2::3', ':1', '1:', '12345::', 'fe80::1%eth0', '[::1]', '1:2:3:4:5:6:7', '1:2:3:4:5:6:7:8:9',
        '::1:', 'g::1', '', '::/64', 7, null];
    for (const input of reject) {
        it(`rejects ${JSON.stringify(input)}`, () => assert.equal(parseIPv6(input), null));
    }
});

describe('parseIp / ipToBigInt', () => {
    it('dispatches by family', () => {
        assert.equal(parseIp('10.0.0.1').family, 4);
        assert.equal(parseIp('::1').family, 6);
        assert.equal(parseIp('nope'), null);
        assert.equal(ipToBigInt('10.0.0.1'), 0x0a000001n);
        assert.equal(ipToBigInt('junk'), null);
    });
});

describe('formatIPv6', () => {
    const cases = [
        ['2001:0db8:0000:0000:0000:0000:0000:0001', '2001:db8::1'],
        ['0:0:0:0:0:0:0:0', '::'],
        ['0:0:0:0:0:0:0:1', '::1'],
        ['1:0:0:0:0:0:0:0', '1::'],
        ['2001:db8:0:0:1:0:0:1', '2001:db8::1:0:0:1'],
        ['1:0:0:1:0:0:0:1', '1:0:0:1::1'],
        ['2001:db8:0:1:1:1:1:1', '2001:db8:0:1:1:1:1:1'],
        ['::ffff:192.0.2.1', '::ffff:c000:201'],
        ['ABCD:EF01::', 'abcd:ef01::'],
    ];
    for (const [input, expected] of cases) {
        it(`${input} → ${expected}`, () => assert.equal(formatIPv6(v6(input)), expected));
    }
    it('expands to eight zero-padded groups', () => {
        assert.equal(formatIPv6(1n, { expanded: true }), '0000:0000:0000:0000:0000:0000:0000:0001');
        assert.equal(formatIPv6(v6('2001:db8::1'), { expanded: true }), '2001:0db8:0000:0000:0000:0000:0000:0001');
    });
    it('rejects out-of-range values', () => {
        assert.equal(formatIPv6(2n ** 128n), null);
        assert.equal(formatIPv6(-1n), null);
        assert.equal(formatIPv6(5), null);
    });
});

describe('formatIPv4 / formatIp / formatCidr / octets', () => {
    it('round-trips', () => {
        assert.equal(formatIPv4(0xc0000201n), '192.0.2.1');
        assert.equal(formatIPv4(0n), '0.0.0.0');
        assert.equal(formatIPv4(4294967295n), '255.255.255.255');
        assert.equal(formatIPv4(-1n), null);
        assert.equal(formatIPv4(2n ** 32n), null);
        assert.equal(formatIp(parseIp('::1')), '::1');
        assert.equal(formatIp(parseIp('1.2.3.4')), '1.2.3.4');
        assert.equal(formatIp(null), null);
    });
    it('formatCidr renders network by default, address on request', () => {
        const cidr = parseCidr('10.0.0.1/8');
        assert.equal(formatCidr(cidr), '10.0.0.0/8');
        assert.equal(formatCidr(cidr, { network: false }), '10.0.0.1/8');
        assert.equal(formatCidr(null), null);
    });
    it('splits into octets / hextets', () => {
        assert.deepEqual(toOctets(v4('192.168.1.130')), [192, 168, 1, 130]);
        assert.deepEqual(toHextets(v6('2001:db8::1')), [0x2001, 0xdb8, 0, 0, 0, 0, 0, 1]);
        assert.equal(toOctets(2n ** 32n), null);
    });
});

describe('parseCidr', () => {
    it('accepts prefix lengths and dotted masks', () => {
        assert.deepEqual(parseCidr('10.0.0.0/8'), { family: 4, prefix: 8, address: v4('10.0.0.0'), network: v4('10.0.0.0'), aligned: true });
        const host = parseCidr('10.0.0.1/8');
        assert.equal(host.aligned, false);
        assert.equal(formatIPv4(host.network), '10.0.0.0');
        assert.equal(parseCidr('10.0.0.0/255.0.0.0').prefix, 8);
        assert.equal(parseCidr('10.0.0.0/0.0.0.0').prefix, 0);
        assert.equal(parseCidr('10.0.0.0/024').prefix, 24);
        assert.equal(parseCidr('2001:db8::/32').prefix, 32);
        assert.equal(parseCidr('::ffff:1.2.3.4/120').prefix, 120);
        assert.equal(parseCidr('2001:db8::/128').prefix, 128);
    });
    const reject = ['10.0.0.0/255.0.255.0', '10.0.0.0/33', '10.0.0.0/-1', '10.0.0.0/ 24', '10.0.0.0/24/25',
        '10.0.0.0/', '/8', '127.1/8', '2001:db8::/129', '2001:db8::/255.255.0.0', '10.0.0.0', '', null];
    for (const input of reject) {
        it(`rejects ${JSON.stringify(input)}`, () => assert.equal(parseCidr(input), null));
    }
});

describe('masks', () => {
    it('prefixToMask', () => {
        assert.equal(prefixToMask(24, 4), 0xffffff00n);
        assert.equal(prefixToMask(0, 4), 0n);
        assert.equal(prefixToMask(32, 4), 0xffffffffn);
        assert.equal(prefixToMask(64, 6), 0xffffffffffffffff0000000000000000n);
        assert.equal(prefixToMask(33, 4), null);
        assert.equal(prefixToMask(24, 5), null);
        assert.equal(prefixToMask(1.5, 4), null);
    });
    it('maskToPrefix', () => {
        assert.equal(maskToPrefix(0xffffff00n, 4), 24);
        assert.equal(maskToPrefix(0xff00ff00n, 4), null);
        assert.equal(maskToPrefix(0n, 4), 0);
        assert.equal(maskToPrefix(0xffffffffn, 4), 32);
        assert.equal(maskToPrefix(2n ** 32n, 4), null);
    });
    it('wildcardMask', () => {
        assert.equal(wildcardMask(26, 4), 63n);
        assert.equal(wildcardMask(0, 4), 0xffffffffn);
        assert.equal(wildcardMask(129, 6), null);
    });
});

describe('counts', () => {
    it('addressCount / usableCount', () => {
        assert.equal(addressCount(24, 4), 256n);
        assert.equal(addressCount(0, 6), 2n ** 128n);
        assert.equal(usableCount(24, 4), 254n);
        assert.equal(usableCount(31, 4), 2n);
        assert.equal(usableCount(32, 4), 1n);
        assert.equal(usableCount(0, 4), 2n ** 32n - 2n);
        assert.equal(usableCount(64, 6), 2n ** 64n);
        assert.equal(usableCount(128, 6), 1n);
        assert.equal(usableCount(33, 4), null);
    });
    it('smallestPrefixFor', () => {
        assert.equal(smallestPrefixFor(1, 4), 32);
        assert.equal(smallestPrefixFor(2, 4), 31);
        assert.equal(smallestPrefixFor(300, 4), 23);
        assert.equal(smallestPrefixFor(2n ** 32n, 4), 0);
        assert.equal(smallestPrefixFor(2n ** 32n + 1n, 4), null);
        assert.equal(smallestPrefixFor(0, 4), null);
        assert.equal(smallestPrefixFor('nope', 4), null);
        assert.equal(smallestPrefixFor(2n ** 64n, 6), 64);
    });
});

describe('cidrInfo', () => {
    it('192.168.1.130/26', () => {
        const info = cidrInfo('192.168.1.130/26');
        assert.equal(info.cidr, '192.168.1.128/26');
        assert.equal(formatIPv4(info.network), '192.168.1.128');
        assert.equal(formatIPv4(info.broadcast), '192.168.1.191');
        assert.equal(formatIPv4(info.first), '192.168.1.129');
        assert.equal(formatIPv4(info.last), '192.168.1.190');
        assert.equal(formatIPv4(info.mask), '255.255.255.192');
        assert.equal(formatIPv4(info.wildcard), '0.0.0.63');
        assert.equal(info.count, 64n);
        assert.equal(info.usable, 62n);
        assert.equal(info.aligned, false);
        assert.equal(formatIPv4(info.address), '192.168.1.130');
    });
    it('/31 and /32 keep the whole block as host range', () => {
        const p2p = cidrInfo('10.0.0.1/31');
        assert.equal(formatIPv4(p2p.first), '10.0.0.0');
        assert.equal(formatIPv4(p2p.last), '10.0.0.1');
        assert.equal(p2p.usable, 2n);
        const host = cidrInfo('10.0.0.1/32');
        assert.equal(host.first, host.last);
        assert.equal(host.first, host.network);
        assert.equal(host.usable, 1n);
    });
    it('0.0.0.0/0 spans everything', () => {
        const all = cidrInfo('0.0.0.0/0');
        assert.equal(formatIPv4(all.broadcast), '255.255.255.255');
        assert.equal(all.count, 2n ** 32n);
    });
    it('IPv6 has no broadcast and no reserved endpoints', () => {
        const info = cidrInfo('2001:db8::1/64');
        assert.equal(formatIPv6(info.network), '2001:db8::');
        assert.equal(formatIPv6(info.lastAddress), '2001:db8::ffff:ffff:ffff:ffff');
        assert.equal(info.broadcast, null);
        assert.equal(info.first, info.network);
        assert.equal(info.last, info.lastAddress);
        assert.equal(info.count, 2n ** 64n);
        assert.equal(info.usable, 2n ** 64n);
        assert.equal(cidrInfo('::/0').count, 2n ** 128n);
    });
    it('returns null on junk', () => {
        assert.equal(cidrInfo('nope/8'), null);
        assert.equal(cidrInfo('10.0.0.0'), null);
    });
});

describe('containment & ordering', () => {
    it('cidrContains', () => {
        assert.equal(cidrContains('10.0.0.0/8', '10.255.255.255'), true);
        assert.equal(cidrContains('10.0.0.0/8', '11.0.0.0'), false);
        assert.equal(cidrContains('::ffff:0:0/96', '::ffff:1.2.3.4'), true);
        assert.equal(cidrContains('0.0.0.0/0', '203.0.113.9'), true);
        assert.equal(cidrContains('10.0.0.0/8', '::1'), null);
        assert.equal(cidrContains('junk', '1.1.1.1'), null);
    });
    it('prefixContains guards its inputs', () => {
        assert.equal(prefixContains(v4('10.0.0.0'), 8, 4, v4('10.1.2.3')), true);
        assert.equal(prefixContains(v4('10.0.0.0'), 8, 4, 5), false);
        assert.equal(prefixContains(v4('10.0.0.0'), 33, 4, v4('10.1.2.3')), false);
    });
    it('cidrOverlaps', () => {
        assert.equal(cidrOverlaps('10.0.0.0/8', '10.1.0.0/16'), true);
        assert.equal(cidrOverlaps('10.1.0.0/16', '10.0.0.0/8'), true);
        assert.equal(cidrOverlaps('10.0.0.0/9', '10.128.0.0/9'), false);
        assert.equal(cidrOverlaps('10.0.0.0/8', '2001:db8::/32'), null);
    });
    it('compareIps orders v4 before v6, then numerically', () => {
        assert.equal(compareIps(parseIp('1.1.1.1'), parseIp('1.1.1.2')), -1);
        assert.equal(compareIps(parseIp('1.1.1.2'), parseIp('1.1.1.1')), 1);
        assert.equal(compareIps(parseIp('1.1.1.1'), parseIp('1.1.1.1')), 0);
        assert.equal(compareIps(parseIp('255.255.255.255'), parseIp('::')), -1);
        assert.equal(compareIps(parseIp('::'), parseIp('255.255.255.255')), 1);
    });
});

describe('splitCidr', () => {
    it('splits a /24 into /26s', () => {
        const r = splitCidr('10.0.0.0/24', 26);
        assert.deepEqual(r.subnets, ['10.0.0.0/26', '10.0.0.64/26', '10.0.0.128/26', '10.0.0.192/26']);
        assert.equal(r.total, 4n);
        assert.equal(r.truncated, false);
        assert.equal(r.prefix, 26);
    });
    it('same prefix yields the block itself; shorter or out-of-range prefixes are null', () => {
        assert.deepEqual(splitCidr('10.0.0.5/24', 24).subnets, ['10.0.0.0/24']);
        assert.equal(splitCidr('10.0.0.0/24', 23), null);
        assert.equal(splitCidr('10.0.0.0/24', 33), null);
        assert.equal(splitCidr('10.0.0.0/24', 25.5), null);
        assert.equal(splitCidr('junk', 25), null);
    });
    it('caps emitted subnets but reports the exact total', () => {
        const r = splitCidr('10.0.0.0/8', 32, { limit: 10 });
        assert.equal(r.subnets.length, 10);
        assert.equal(r.total, 16777216n);
        assert.equal(r.truncated, true);
        assert.equal(r.subnets[9], '10.0.0.9/32');
    });
    it('IPv6 /32 → /48 uses the default cap', () => {
        const r = splitCidr('2001:db8::/32', 48);
        assert.equal(r.total, 65536n);
        assert.equal(r.subnets.length, 1024);
        assert.equal(r.truncated, true);
        assert.equal(r.subnets[0], '2001:db8::/48');
        assert.equal(r.subnets[1023], '2001:db8:3ff::/48');
    });
});

describe('aggregateCidrs', () => {
    const cases = [
        [['192.168.0.0/24', '192.168.1.0/24'], ['192.168.0.0/23']],
        [['192.168.1.0/24', '192.168.2.0/24'], ['192.168.1.0/24', '192.168.2.0/24']],
        [['10.0.0.0/8', '10.1.0.0/16'], ['10.0.0.0/8']],
        [['10.1.0.0/16', '10.0.0.0/8'], ['10.0.0.0/8']],
        [['10.0.0.192/26', '10.0.0.0/26', '10.0.0.128/26', '10.0.0.64/26'], ['10.0.0.0/24']],
        [['0.0.0.0/1', '128.0.0.0/1'], ['0.0.0.0/0']],
        [['10.0.0.1/24'], ['10.0.0.0/24']],
        [['1.2.3.4'], ['1.2.3.4/32']],
        [['1.2.3.4/32', '1.2.3.5/32'], ['1.2.3.4/31']],
        [['1.2.3.5/32', '1.2.3.6/32'], ['1.2.3.5/32', '1.2.3.6/32']],
        [['10.0.0.0/24', '10.0.0.0/24', ' 10.0.0.0/24 '], ['10.0.0.0/24']],
        [['10.0.0.0/24', '10.0.1.0/24', '10.0.2.0/24'], ['10.0.0.0/23', '10.0.2.0/24']],
    ];
    for (const [input, expected] of cases) {
        it(`${input.join(' ')} → ${expected.join(' ')}`, () => {
            const r = aggregateCidrs(input);
            assert.deepEqual(r.v4, expected);
            assert.deepEqual(r.v6, []);
            assert.deepEqual(r.invalid, []);
        });
    }
    it('handles IPv6 and mixed families', () => {
        assert.deepEqual(aggregateCidrs(['2001:db8::/33', '2001:db8:8000::/33']).v6, ['2001:db8::/32']);
        const mixed = aggregateCidrs(['10.0.0.0/8', '2001:db8::1', 'foo', '1.2.3.4/33']);
        assert.deepEqual(mixed.v4, ['10.0.0.0/8']);
        assert.deepEqual(mixed.v6, ['2001:db8::1/128']);
        assert.deepEqual(mixed.invalid, ['foo', '1.2.3.4/33']);
    });
    it('tolerates empty and non-array input', () => {
        assert.deepEqual(aggregateCidrs([]), { v4: [], v6: [], invalid: [] });
        assert.deepEqual(aggregateCidrs('nope'), { v4: [], v6: [], invalid: [] });
        assert.deepEqual(aggregateCidrs([null, 3]).invalid, [null, 3]);
    });
});

describe('rangeToCidrs / cidrToRange', () => {
    it('covers aligned ranges with one block', () => {
        assert.deepEqual(rangeToCidrs('10.0.0.0', '10.0.0.255').cidrs, ['10.0.0.0/24']);
        assert.deepEqual(rangeToCidrs('0.0.0.0', '255.255.255.255').cidrs, ['0.0.0.0/0']);
        assert.deepEqual(rangeToCidrs('1.1.1.1', '1.1.1.1').cidrs, ['1.1.1.1/32']);
    });
    it('builds the classic ladder for .1–.254', () => {
        const r = rangeToCidrs('10.0.0.1', '10.0.0.254');
        assert.equal(r.family, 4);
        assert.equal(r.cidrs.length, 14);
        assert.deepEqual(r.cidrs.slice(0, 3), ['10.0.0.1/32', '10.0.0.2/31', '10.0.0.4/30']);
        assert.deepEqual(r.cidrs.slice(-2), ['10.0.0.252/31', '10.0.0.254/32']);
    });
    it('IPv6 ranges', () => {
        assert.deepEqual(rangeToCidrs('::', '::ffff').cidrs, ['::/112']);
        assert.deepEqual(rangeToCidrs('2001:db8::1', '2001:db8::2').cidrs, ['2001:db8::1/128', '2001:db8::2/128']);
    });
    it('rejects reversed, cross-family and junk ranges', () => {
        assert.equal(rangeToCidrs('10.0.0.5', '10.0.0.1'), null);
        assert.equal(rangeToCidrs('1.1.1.1', '::1'), null);
        assert.equal(rangeToCidrs('x', '1.1.1.1'), null);
    });
    it('cidrToRange', () => {
        const r = cidrToRange('10.0.0.0/30');
        assert.equal(formatIPv4(r.start), '10.0.0.0');
        assert.equal(formatIPv4(r.end), '10.0.0.3');
        assert.equal(cidrToRange('nope'), null);
    });
});
