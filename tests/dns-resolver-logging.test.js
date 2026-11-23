// Verifies DNS resolver telemetry without contacting real upstream servers.

import assert from 'node:assert/strict';
import { Resolver } from 'node:dns/promises';
import { afterEach, describe, it } from 'node:test';

import { resolveDns, resolveDoh } from '../api/dns-resolver.js';
import logger from '../server/logger.js';

const originalResolve4 = Resolver.prototype.resolve4;
const originalFetch = globalThis.fetch;
const originalWarn = logger.warn;
const originalDebug = logger.debug;

afterEach(() => {
    Resolver.prototype.resolve4 = originalResolve4;
    globalThis.fetch = originalFetch;
    logger.warn = originalWarn;
    logger.debug = originalDebug;
});

describe('DNS resolver logging', () => {
    it('promotes availability errors to warn without logging the hostname', async () => {
        const warnCalls = [];
        const debugCalls = [];
        logger.warn = (...args) => warnCalls.push(args);
        logger.debug = (...args) => debugCalls.push(args);
        Resolver.prototype.resolve4 = async () => {
            const error = new Error('resolver timed out');
            error.code = 'ETIMEOUT';
            throw error;
        };

        assert.deepEqual(
            await resolveDns('private.example.test', 'A', 'Example DNS', '192.0.2.1'),
            { result: 'N/A', status: 'timeout', code: 'TIMEOUT' },
        );
        assert.equal(warnCalls.length, 1);
        assert.equal(debugCalls.length, 0);
        assert.equal(warnCalls[0][0].server, '192.0.2.1');
        assert.equal(warnCalls[0][0].provider, 'Example DNS');
        assert.equal(warnCalls[0][0].code, 'ETIMEOUT');
        assert.doesNotMatch(JSON.stringify(warnCalls[0]), /private\.example\.test/);
        assert.equal('private.example.test' in warnCalls[0][0], false);
    });

    it('keeps non-availability UDP failures at debug level', async () => {
        const warnCalls = [];
        const debugCalls = [];
        logger.warn = (...args) => warnCalls.push(args);
        logger.debug = (...args) => debugCalls.push(args);
        Resolver.prototype.resolve4 = async () => {
            const error = new Error('missing record');
            error.code = 'ENOTFOUND';
            throw error;
        };

        assert.deepEqual(
            await resolveDns('private.example.test', 'A', 'Example DNS', '192.0.2.1'),
            { result: 'N/A', status: 'nxdomain', code: 'NXDOMAIN' },
        );
        assert.equal(warnCalls.length, 0);
        assert.equal(debugCalls.length, 1);
        assert.equal(debugCalls[0][0].server, '192.0.2.1');
        assert.equal(debugCalls[0][0].code, 'ENOTFOUND');
    });

    it('warns on non-2xx DoH responses', async () => {
        const warnCalls = [];
        logger.warn = (...args) => warnCalls.push(args);
        logger.debug = () => assert.fail('non-2xx DoH response should not be debug-only');
        globalThis.fetch = async () => new Response('', { status: 503 });

        assert.deepEqual(
            await resolveDoh('private.example.test', 'A', 'Example DoH', 'https://doh.example.test/resolve?'),
            { result: 'N/A', status: 'unavailable', code: 'HTTP 503' },
        );
        assert.equal(warnCalls.length, 1);
        assert.equal(warnCalls[0][0].server, 'Example DoH');
        assert.equal(warnCalls[0][0].code, 'HTTP 503');
    });

    it('warns on DoH transport failures', async () => {
        const warnCalls = [];
        logger.warn = (...args) => warnCalls.push(args);
        globalThis.fetch = async () => { throw new Error('socket reset'); };

        assert.deepEqual(
            await resolveDoh('private.example.test', 'A', 'Example DoH', 'https://doh.example.test/resolve?'),
            { result: 'N/A', status: 'unavailable', code: 'FETCH' },
        );
        assert.equal(warnCalls.length, 1);
        assert.equal(warnCalls[0][0].server, 'Example DoH');
        assert.match(warnCalls[0][0].err.message, /socket reset/);
    });

    for (const [label, body, expected] of [
        ['SERVFAIL', { Status: 2 }, { status: 'servfail', code: 'SERVFAIL' }],
        ['NXDOMAIN', { Status: 3 }, { status: 'nxdomain', code: 'NXDOMAIN' }],
        ['an empty NOERROR', { Status: 0, Answer: [] }, { status: 'nodata', code: 'NODATA' }],
        ['a non-JSON body', '<html>', { status: 'malformed', code: 'BADJSON' }],
        ['an unusable envelope', { Answer: [] }, { status: 'malformed', code: 'BADRESP' }],
    ]) {
        it(`keeps ${label} DoH answers at debug level`, async () => {
            const debugCalls = [];
            logger.warn = () => assert.fail(`${label} should not warn`);
            logger.debug = (...args) => debugCalls.push(args);
            globalThis.fetch = async () => new Response(
                typeof body === 'string' ? body : JSON.stringify(body), { status: 200 },
            );

            assert.deepEqual(
                await resolveDoh('private.example.test', 'A', 'Example DoH', 'https://doh.example.test/resolve?'),
                { result: 'N/A', ...expected },
            );
            assert.equal(debugCalls.length, 1);
            assert.equal(debugCalls[0][0].code, expected.code);
        });
    }
});
