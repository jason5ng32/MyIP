// Unit tests for the DNS resolver health probe; all dig calls are mocked.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    checkDnsResolvers,
    checkResolver,
    formatMarkdown,
    parseDigResponse,
} from '../scripts/check-dns-resolvers.js';

const positiveResponse = (answerCount = 2, flags = 'qr rd ra') => [
    `;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 1`,
    `;; flags: ${flags}; QUERY: 1, ANSWER: ${answerCount}, AUTHORITY: 0, ADDITIONAL: 1`,
].join('\n');

const nxdomainResponse = (flags = 'qr rd ra') => [
    ';; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, id: 2',
    `;; flags: ${flags}; QUERY: 1, ANSWER: 0, AUTHORITY: 1, ADDITIONAL: 1`,
].join('\n');

const resolver = { id: 'test', name: 'Test Resolver', country: 'ZZ', udp: '192.0.2.1' };

describe('parseDigResponse', () => {
    it('accepts a recursive NOERROR response with an answer', () => {
        assert.deepEqual(parseDigResponse(positiveResponse(), { expectedStatus: 'NOERROR', requireAnswer: true }), {
            ok: true,
            status: 'NOERROR',
            flags: ['qr', 'rd', 'ra'],
            answerCount: 2,
        });
    });

    it('accepts a recursive NXDOMAIN response with no answers', () => {
        assert.equal(parseDigResponse(nxdomainResponse(), { expectedStatus: 'NXDOMAIN', requireAnswer: false }).ok, true);
    });

    it('rejects a response without recursion available', () => {
        const result = parseDigResponse(positiveResponse(1, 'qr rd'), { expectedStatus: 'NOERROR', requireAnswer: true });
        assert.equal(result.ok, false);
        assert.match(result.reason, /ra flag/);
    });

    it('rejects a NOERROR response with no answer', () => {
        const result = parseDigResponse(positiveResponse(0), { expectedStatus: 'NOERROR', requireAnswer: true });
        assert.equal(result.ok, false);
        assert.match(result.reason, /no answers/);
    });

    it('rejects an NXDOMAIN response that contains answers', () => {
        const result = parseDigResponse(nxdomainResponse().replace('ANSWER: 0', 'ANSWER: 1'), {
            expectedStatus: 'NXDOMAIN',
            requireAnswer: false,
        });
        assert.equal(result.ok, false);
        assert.match(result.reason, /answers/);
    });
});

describe('checkResolver', () => {
    it('retries a failed attempt and passes when the resolver recovers', async () => {
        let calls = 0;
        const runner = async () => {
            calls += 1;
            if (calls === 1) return { code: 1, stderr: ';; communications error' };
            return { code: 0, stdout: calls === 2 ? positiveResponse() : nxdomainResponse() };
        };

        const result = await checkResolver(resolver, { attempts: 2, retryDelayMs: 0, runner, wait: async () => {} });
        assert.equal(result.ok, true);
        assert.equal(result.attempts, 2);
        assert.equal(calls, 3);
    });

    it('reports the final failure after all attempts', async () => {
        const result = await checkResolver(resolver, {
            attempts: 2,
            retryDelayMs: 0,
            runner: async () => ({ code: 1, stderr: 'timeout' }),
            wait: async () => {},
        });
        assert.equal(result.ok, false);
        assert.equal(result.attempts, 2);
        assert.equal(result.failures.length, 2);
        assert.equal(result.reason, 'timeout');
    });

    it('fails when the resolver rewrites the NXDOMAIN probe', async () => {
        const result = await checkResolver(resolver, {
            attempts: 1,
            runner: async (_ip, name) => ({
                code: 0,
                stdout: name === 'example.com' ? positiveResponse() : positiveResponse(1),
            }),
        });
        assert.equal(result.ok, false);
        assert.equal(result.phase, 'NXDOMAIN check');
        assert.match(result.reason, /expected NXDOMAIN, got NOERROR/);
    });

    it('turns a thrown runner error into a failed resolver result', async () => {
        const result = await checkResolver(resolver, {
            attempts: 1,
            runner: async () => {
                throw new Error('network unavailable');
            },
        });
        assert.equal(result.ok, false);
        assert.equal(result.reason, 'network unavailable');
    });
});

describe('checkDnsResolvers and formatMarkdown', () => {
    it('checks UDP entries and reports DoH-only entries as skipped', async () => {
        const report = await checkDnsResolvers([
            resolver,
            { id: 'doh', name: 'DoH only', country: 'US', doh: 'https://example.test/resolve?' },
        ], {
            attempts: 1,
            runner: async (_ip, name) => ({ code: 0, stdout: name === 'example.com' ? positiveResponse() : nxdomainResponse() }),
            now: () => '2026-08-24T00:00:00.000Z',
        });

        assert.deepEqual({ ok: report.ok, checked: report.checked, passed: report.passed, failed: report.failed, dohOnly: report.dohOnly }, {
            ok: true,
            checked: 1,
            passed: 1,
            failed: 0,
            dohOnly: 1,
        });
        assert.match(formatMarkdown(report), /DoH-only entry was not checked/);
    });
});
