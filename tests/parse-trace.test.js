// Tests for frontend/utils/parse-trace.js — the shared /cdn-cgi/trace parser
// used by the getips/ sources, SpeedTest and RuleTest.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseTrace } from '../frontend/utils/parse-trace.js';

// Shape of a real trace response (LF-joined below where a test needs it).
const TRACE_LINES = [
    'fl=633f90',
    'h=speed.cloudflare.com',
    'ip=203.0.113.7',
    'ts=1785340826.000',
    'colo=SIN',
    'loc=SG',
];

describe('parseTrace', () => {
    it('parses a plain LF trace body into a key/value map', () => {
        const out = parseTrace(TRACE_LINES.join('\n'));
        assert.equal(out.ip, '203.0.113.7');
        assert.equal(out.colo, 'SIN');
        assert.equal(out.loc, 'SG');
    });

    it('tolerates CRLF line endings from rewriting middleboxes', () => {
        // A TLS-decrypting proxy can re-serialize the body with \r\n; the
        // trailing \r must not survive into the value (it would fail
        // isValidIP downstream).
        const out = parseTrace(TRACE_LINES.join('\r\n'));
        assert.equal(out.ip, '203.0.113.7');
        assert.equal(out.loc, 'SG');
    });

    it('splits on the first = only, keeping later ones in the value', () => {
        const out = parseTrace('uag=Mozilla/5.0 (a=b; c=d)\nkex=X25519');
        assert.equal(out.uag, 'Mozilla/5.0 (a=b; c=d)');
        assert.equal(out.kex, 'X25519');
    });

    it('keeps an empty value distinct from an absent key', () => {
        const out = parseTrace('ip=\ncolo=SIN');
        assert.equal(out.ip, '');
        assert.equal(out.loc, undefined);
    });

    it('skips blank lines and lines without a key', () => {
        const out = parseTrace('\nip=1.2.3.4\n\n=orphan\nnokey\n');
        assert.deepEqual(out, { ip: '1.2.3.4' });
    });

    it('returns an empty map for non-string input', () => {
        assert.deepEqual(parseTrace(undefined), {});
        assert.deepEqual(parseTrace(null), {});
        assert.deepEqual(parseTrace(42), {});
    });
});
