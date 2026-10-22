// Exercises the MTR raw-output parser that structures Globalping MTR text
// into report-schema hop objects. Fixtures cover the Globalping column set,
// the classic mtr --report layout, unresolved hops, and garbage input.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseMtrOutput } from '../frontend/utils/features/mtr-parse.js';

// Globalping-style output: Loss% Drop Rcv Avg StDev Javg columns, AS-number
// prefixes, hostname (ip) pairs, and an unresolved hop.
const GLOBALPING_OUTPUT = `Host                                      Loss% Drop Rcv  Avg StDev Javg
 1. AS??? _gateway (172.17.0.1)            0.0%    0   3  0.3   0.0  0.3
 2. AS??? (waiting for reply)            100.0%    3   0  0.0   0.0  0.0
 3. AS24940 core1.fsn1.hetzner.com (88.198.0.1)   0.0%    0   3  1.2   0.1  1.4
 4. AS15169 dns.google (8.8.8.8)           0.0%    0   3  5.6   0.2  5.8`;

// Classic `mtr --report` layout: HOST: header with Snt/Last/Best/Wrst/StDev.
const CLASSIC_OUTPUT = `HOST: probe-host                  Loss%   Snt   Last   Avg  Best  Wrst StDev
  1.|-- 192.168.1.1                0.0%    10    0.4   0.4   0.3   0.5   0.0
  2.|-- 10.0.0.1                   0.0%    10    1.1   1.3   1.0   2.2   0.4
  3.|-- ???                       100.0    10    0.0   0.0   0.0   0.0   0.0`;

describe('parseMtrOutput', () => {
    it('parses Globalping-style output with AS numbers and host (ip) pairs', () => {
        const hops = parseMtrOutput(GLOBALPING_OUTPUT);
        assert.equal(hops.length, 4);

        assert.deepEqual(hops[0], {
            n: 1, asn: null, host: '_gateway', ip: '172.17.0.1',
            lossPct: 0, drop: 0, rcv: 3, avgMs: 0.3, stdevMs: 0, javgMs: 0.3,
        });

        // Unresolved hop: no host/ip, 100% loss preserved.
        assert.equal(hops[1].n, 2);
        assert.equal(hops[1].host, undefined);
        assert.equal(hops[1].ip, undefined);
        assert.equal(hops[1].lossPct, 100);

        assert.equal(hops[2].asn, 24940);
        assert.equal(hops[2].host, 'core1.fsn1.hetzner.com');
        assert.equal(hops[2].ip, '88.198.0.1');

        assert.equal(hops[3].asn, 15169);
        assert.equal(hops[3].ip, '8.8.8.8');
        assert.equal(hops[3].avgMs, 5.6);
    });

    it('parses classic mtr --report output with |-- markers', () => {
        const hops = parseMtrOutput(CLASSIC_OUTPUT);
        assert.equal(hops.length, 3);

        // Bare-IP hops land in `ip`, not `host`.
        assert.equal(hops[0].ip, '192.168.1.1');
        assert.equal(hops[0].host, undefined);
        assert.equal(hops[0].sntCount, 10);
        assert.equal(hops[0].lastMs, 0.4);
        assert.equal(hops[0].bestMs, 0.3);
        assert.equal(hops[0].worstMs, 0.5);

        // '???' hop keeps stats but no host/ip.
        assert.equal(hops[2].host, undefined);
        assert.equal(hops[2].ip, undefined);
        assert.equal(hops[2].lossPct, 100);
    });

    it('skips duplicate hop indexes (alternate-path lines)', () => {
        const output = `Host        Loss% Drop Rcv  Avg StDev Javg
 1. AS100 a.example (1.1.1.1)  0.0% 0 3 1.0 0.0 1.0
 1. AS200 b.example (2.2.2.2)  0.0% 0 3 2.0 0.0 2.0`;
        const hops = parseMtrOutput(output);
        assert.equal(hops.length, 1);
        assert.equal(hops[0].ip, '1.1.1.1');
    });

    it('returns [] for garbage, empty and non-string input', () => {
        assert.deepEqual(parseMtrOutput(''), []);
        assert.deepEqual(parseMtrOutput('no hops here\njust text'), []);
        assert.deepEqual(parseMtrOutput(null), []);
        assert.deepEqual(parseMtrOutput(undefined), []);
        assert.deepEqual(parseMtrOutput(12345), []);
    });

    it('tolerates missing header by keeping host/ip and dropping stats', () => {
        const hops = parseMtrOutput(' 1. AS15169 dns.google (8.8.8.8)  0.0% 0 3 5.6 0.2 5.8');
        assert.equal(hops.length, 1);
        assert.equal(hops[0].ip, '8.8.8.8');
        assert.equal(hops[0].avgMs, undefined);
    });
});
