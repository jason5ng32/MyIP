// Guards frontend/utils/features/bulk-lookup-extract.js — IP extraction from
// pasted lists and raw logs: separators, ports, defanged notation, IPv6
// canonicalization, CIDR / reserved skips, firstPerLine, and the false
// positives logs are full of (UA versions, timestamps, MACs, hashes).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { extractIPs, canonicalIP } from '../frontend/utils/features/bulk-lookup-extract.js';
import { isUsablePublicIP } from '../common/valid-ip.js';

const ipsOf = (text, options) => extractIPs(text, options).entries.map((e) => e.ip);

describe('bulk-lookup-extract — separators', () => {
    it('scans any separator instead of splitting by format', () => {
        const text = '1.1.1.1\n8.8.8.8,9.9.9.9 4.4.4.4\t5.5.5.5;"6.6.6.6" [7.7.7.7] (2.2.2.2) ip=3.3.3.3';
        assert.deepEqual(ipsOf(text), [
            '1.1.1.1', '8.8.8.8', '9.9.9.9', '4.4.4.4', '5.5.5.5', '6.6.6.6', '7.7.7.7', '2.2.2.2', '3.3.3.3',
        ]);
    });

    it('takes a key glued on with a colon, hex-lettered keys included', () => {
        assert.deepEqual(ipsOf('ip:1.1.1.1 src:8.8.8.8 id:9.9.9.9'), ['1.1.1.1', '8.8.8.8', '9.9.9.9']);
    });

    it('accepts a sentence-ending dot', () => {
        assert.deepEqual(ipsOf('Blocked 1.1.1.1.'), ['1.1.1.1']);
    });
});

describe('bulk-lookup-extract — ports', () => {
    it('strips an IPv4 port', () => {
        assert.deepEqual(ipsOf('1.2.3.4:443 8.8.8.8:53'), ['1.2.3.4', '8.8.8.8']);
    });

    it('strips a bracketed IPv6 port', () => {
        assert.deepEqual(ipsOf('[2606:4700:4700::1111]:443'), ['2606:4700:4700::1111']);
    });

    it('reads ip/port when the number is past the prefix range', () => {
        assert.deepEqual(ipsOf('outside:8.8.8.8/443'), ['8.8.8.8']);
    });
});

describe('bulk-lookup-extract — defanged notation', () => {
    it('refangs [.] (.) {.} and [:]', () => {
        assert.deepEqual(ipsOf('1.2.3[.]4 8[.]8[.]8[.]8 9(.)9(.)9(.)9 2606[:]4700[:]4700::1111'),
            ['1.2.3.4', '8.8.8.8', '9.9.9.9', '2606:4700:4700::1111']);
    });
});

describe('bulk-lookup-extract — IPv6', () => {
    it('canonicalizes so spellings of one IP dedupe', () => {
        const { entries } = extractIPs('2606:4700:4700:0000:0000:0000:0000:1111\n2606:4700:4700::1111\n2606:4700:4700:0::1111');
        assert.deepEqual(entries, [{ ip: '2606:4700:4700::1111', count: 3 }]);
    });

    it('lowercases hex', () => {
        assert.equal(canonicalIP('2A00:1450:4001:80B::200E'), '2a00:1450:4001:80b::200e');
    });

    it('normalizes ::ffff:a.b.c.d to the IPv4', () => {
        assert.deepEqual(ipsOf('::ffff:1.2.3.4 ::FFFF:1.2.3.4'), ['1.2.3.4']);
        assert.equal(extractIPs('::ffff:1.2.3.4 ::FFFF:1.2.3.4').entries[0].count, 2);
    });

    it('never reads timestamps, MACs or hashes as IPv6', () => {
        const text = '10:12:01 23:59:59.999 aa:bb:cc:dd:ee:ff 00-1A-2B-3C-4D-5E 00:1a:2b:3c:4d:5e '
            + 'd41d8cd98f00b204e9800998ecf8427e da39a3ee5e6b4b0d3255bfef95601890afd80709';
        assert.deepEqual(extractIPs(text).summary, { found: 0, unique: 0, reserved: 0, cidr: 0 });
    });
});

describe('bulk-lookup-extract — skipped input', () => {
    it('skips CIDRs without expanding them, counting distinct ones', () => {
        const { entries, summary } = extractIPs('1.2.3.0/24 1.2.3.0/24 2606:4700::/32 8.8.8.8');
        assert.deepEqual(entries.map((e) => e.ip), ['8.8.8.8']);
        assert.equal(summary.cidr, 2);
    });

    it('rejects IPv4 with leading zeros', () => {
        assert.deepEqual(ipsOf('010.1.1.1 8.8.08.8 1.1.1.1'), ['1.1.1.1']);
    });

    it('skips private and reserved space, counting distinct ones', () => {
        const { entries, summary } = extractIPs('10.0.0.1 10.0.0.1 192.168.1.1 127.0.0.1 ::1 fe80::1 2001:db8::1 1.1.1.1');
        assert.deepEqual(entries.map((e) => e.ip), ['1.1.1.1']);
        assert.equal(summary.reserved, 6);
        assert.ok(entries.every((e) => isUsablePublicIP(e.ip)));
    });

    it('never throws on junk', () => {
        for (const junk of [undefined, null, 42, '', ':::', '....', '::', '[', '1.2.3.4/']) {
            assert.doesNotThrow(() => extractIPs(junk));
        }
        assert.equal(canonicalIP(undefined), null);
    });
});

describe('bulk-lookup-extract — User-Agent false positives', () => {
    it('ignores version strings after / . a letter or a digit', () => {
        const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) '
            + 'Chrome/120.0.0.0 Safari/537.36 Version/17.4.1.2 v1.2.3.4 Build17.4.1.2 x.1.2.3.4 1.2.3.4.5';
        assert.deepEqual(extractIPs(ua).summary, { found: 0, unique: 0, reserved: 0, cidr: 0 });
    });
});

describe('bulk-lookup-extract — real log lines', () => {
    it('reads a combined-format access log', () => {
        const log = [
            '203.0.113.9 - - [27/Oct/2026:10:12:01 +0800] "GET / HTTP/1.1" 200 512 "-" "Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36"',
            '8.8.8.8 - - [27/Oct/2026:10:12:02 +0800] "GET /a HTTP/2.0" 404 0 "https://example.com/" "curl/8.4.0"',
            '8.8.8.8 - - [27/Oct/2026:10:12:03 +0800] "POST /b HTTP/1.1" 200 12 "-" "Version/17.4.1.2"',
            '2606:4700:4700::1111 - - [27/Oct/2026:10:12:04 +0800] "GET / HTTP/1.1" 200 1 "-" "-"',
        ].join('\n');
        const { entries, summary } = extractIPs(log);
        assert.deepEqual(entries, [
            { ip: '8.8.8.8', count: 2 },
            { ip: '2606:4700:4700::1111', count: 1 },
        ]);
        assert.deepEqual(summary, { found: 3, unique: 2, reserved: 1, cidr: 0 });
    });

    it('reads a JSON log line', () => {
        const line = '{"time":"2026-10-27T10:12:01.123Z","remote_addr":"1.1.1.1","xff":"9.9.9.9, 10.0.0.2","upstream":"[2606:4700:4700::1001]:8080","ua":"Chrome/120.0.0.0"}';
        assert.deepEqual(ipsOf(line), ['1.1.1.1', '9.9.9.9', '2606:4700:4700::1001']);
    });

    it('reads an X-Forwarded-For chain', () => {
        assert.deepEqual(ipsOf('X-Forwarded-For: 1.1.1.1, 172.16.0.1, 8.8.8.8'), ['1.1.1.1', '8.8.8.8']);
    });

    it('counts every occurrence', () => {
        const log = Array.from({ length: 600 }, () => '8.8.8.8 - - "GET / HTTP/1.1" 200').join('\n');
        assert.deepEqual(extractIPs(log).entries, [{ ip: '8.8.8.8', count: 600 }]);
    });

    it('firstPerLine keeps only the first public IP of each line', () => {
        const log = '10.0.0.1 1.1.1.1 8.8.8.8\n9.9.9.9 8.8.8.8\n1.1.1.1';
        const { entries, summary } = extractIPs(log, { firstPerLine: true });
        assert.deepEqual(entries, [{ ip: '1.1.1.1', count: 2 }, { ip: '9.9.9.9', count: 1 }]);
        assert.equal(summary.found, 3);
        assert.equal(summary.reserved, 1);
    });
});
