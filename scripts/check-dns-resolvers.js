// Check the curated UDP DNS resolvers for recursive availability.

import { execFile } from 'node:child_process';
import process from 'node:process';
import { promisify } from 'node:util';

import { DNS_RESOLVERS } from '../api/data/dns-resolvers.js';

const execFileAsync = promisify(execFile);

export const DEFAULT_QUERY_NAME = 'example.com';
export const DEFAULT_NXDOMAIN_NAME = 'resolver-health-check.invalid';
export const DEFAULT_ATTEMPTS = 2;
export const DEFAULT_TIMEOUT_MS = 8000;
export const DEFAULT_RETRY_DELAY_MS = 250;

const DIG_ARGUMENTS = ['+noall', '+comments', '+answer'];

const sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

const parseAttempts = (value) => {
    const attempts = Number.parseInt(value, 10);
    if (!Number.isInteger(attempts) || attempts < 1) {
        throw new Error(`--attempts must be a positive integer (received: ${value})`);
    }
    return attempts;
};

const parseCliArgs = (argv) => {
    const options = { json: false, attempts: DEFAULT_ATTEMPTS };

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--json') {
            options.json = true;
            continue;
        }
        if (argument === '--attempts') {
            index += 1;
            if (index >= argv.length) throw new Error('--attempts needs a value');
            options.attempts = parseAttempts(argv[index]);
            continue;
        }
        if (argument.startsWith('--attempts=')) {
            options.attempts = parseAttempts(argument.slice('--attempts='.length));
            continue;
        }
        throw new Error(`Unknown option: ${argument}`);
    }

    return options;
};

const normalizeResponse = (response = {}) => ({
    code: response.code ?? 0,
    stdout: typeof response.stdout === 'string' ? response.stdout : '',
    stderr: typeof response.stderr === 'string' ? response.stderr : '',
});

const responseFailure = (response) => {
    if (response.stderr.trim()) {
        const lastLine = response.stderr.trim().split('\n').at(-1)?.trim();
        if (lastLine) return lastLine;
    }
    return `dig exited with code ${String(response.code)}`;
};

/**
 * Parse the stable status, recursion, and answer-count fields from dig output.
 * Keeping this separate makes the network runner replaceable in unit tests.
 */
export const parseDigResponse = (output, { expectedStatus, requireAnswer }) => {
    const text = typeof output === 'string' ? output : '';
    const status = text.match(/\bstatus:\s*([A-Z]+)\b/i)?.[1]?.toUpperCase();
    const flagsText = text.match(/\bflags:\s*([^;]*);/i)?.[1] ?? '';
    const flags = flagsText.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const answerCountMatch = text.match(/\bANSWER:\s*(\d+)/i);
    const answerCount = answerCountMatch ? Number.parseInt(answerCountMatch[1], 10) : undefined;
    const expected = expectedStatus.toUpperCase();

    if (!status) return { ok: false, reason: 'no DNS status in dig output' };
    if (status !== expected) return { ok: false, reason: `expected ${expected}, got ${status}`, status, flags, answerCount };
    if (!flags.includes('ra')) return { ok: false, reason: 'response is missing the ra flag', status, flags, answerCount };
    if (answerCount === undefined) return { ok: false, reason: 'no DNS answer count in dig output', status, flags };
    if (requireAnswer && answerCount < 1) return { ok: false, reason: 'NOERROR response has no answers', status, flags, answerCount };
    if (!requireAnswer && answerCount !== 0) return { ok: false, reason: `NXDOMAIN response has ${answerCount} answers`, status, flags, answerCount };

    return { ok: true, status, flags, answerCount };
};

/** Run one UDP dig query without invoking a shell. */
export const runDig = async (resolverIp, name, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) => {
    const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
    const args = [`+time=${timeoutSeconds}`, '+tries=1', ...DIG_ARGUMENTS, `@${resolverIp}`, name, 'A'];

    try {
        const result = await execFileAsync('dig', args, { timeout: timeoutMs, maxBuffer: 64 * 1024 });
        return normalizeResponse({ ...result, code: 0 });
    } catch (error) {
        return normalizeResponse({
            code: error.code ?? 1,
            stdout: error.stdout,
            stderr: error.stderr,
        });
    }
};

const checkQuery = async (resolverIp, name, expectedStatus, requireAnswer, runner, timeoutMs) => {
    let response;
    try {
        response = normalizeResponse(await runner(resolverIp, name, { timeoutMs }));
    } catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : String(error), status: undefined, answerCount: undefined };
    }
    if (response.code !== 0) {
        return { ok: false, reason: responseFailure(response), status: undefined, answerCount: undefined };
    }
    return parseDigResponse(response.stdout, { expectedStatus, requireAnswer });
};

const checkResolverAttempt = async (resolver, runner, options) => {
    const positive = await checkQuery(
        resolver.udp,
        options.queryName,
        'NOERROR',
        true,
        runner,
        options.timeoutMs,
    );
    if (!positive.ok) return { ok: false, phase: 'recursive answer', reason: positive.reason };

    const negative = await checkQuery(
        resolver.udp,
        options.nxdomainName,
        'NXDOMAIN',
        false,
        runner,
        options.timeoutMs,
    );
    if (!negative.ok) return { ok: false, phase: 'NXDOMAIN check', reason: negative.reason };

    return { ok: true };
};

/** Check one resolver, retrying transient failures before reporting it down. */
export const checkResolver = async (resolver, {
    attempts = DEFAULT_ATTEMPTS,
    queryName = DEFAULT_QUERY_NAME,
    nxdomainName = DEFAULT_NXDOMAIN_NAME,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    runner = runDig,
    wait = sleep,
} = {}) => {
    const normalizedAttempts = Number.isFinite(attempts)
        ? Math.max(1, Math.trunc(attempts))
        : DEFAULT_ATTEMPTS;
    const failures = [];

    for (let attempt = 1; attempt <= normalizedAttempts; attempt += 1) {
        const result = await checkResolverAttempt(resolver, runner, {
            queryName,
            nxdomainName,
            timeoutMs,
        });
        if (result.ok) {
            return {
                id: resolver.id,
                name: resolver.name,
                country: resolver.country,
                udp: resolver.udp,
                ok: true,
                attempts: attempt,
            };
        }

        failures.push({ attempt, ...result });
        if (attempt < normalizedAttempts) await wait(retryDelayMs);
    }

    const lastFailure = failures.at(-1);
    return {
        id: resolver.id,
        name: resolver.name,
        country: resolver.country,
        udp: resolver.udp,
        ok: false,
        attempts: normalizedAttempts,
        phase: lastFailure.phase,
        reason: lastFailure.reason,
        failures,
    };
};

/** Check every UDP entry concurrently and retain the DoH-only count for reporting. */
export const checkDnsResolvers = async (resolvers = DNS_RESOLVERS, options = {}) => {
    const udpResolvers = resolvers.filter((resolver) => resolver.udp);
    const results = await Promise.all(udpResolvers.map((resolver) => checkResolver(resolver, options)));
    const failed = results.filter((result) => !result.ok);

    return {
        checkedAt: (options.now ?? (() => new Date().toISOString()))(),
        ok: failed.length === 0,
        checked: results.length,
        passed: results.length - failed.length,
        failed: failed.length,
        dohOnly: resolvers.filter((resolver) => !resolver.udp).length,
        resolvers: results,
    };
};

const escapeMarkdown = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');

export const formatMarkdown = (report) => {
    const lines = [
        '## DNS resolver health',
        '',
        `Checked ${report.checkedAt}: **${report.passed}/${report.checked} UDP resolvers passed**.`,
        '',
        '| Status | Resolver | UDP | Details |',
        '| --- | --- | --- | --- |',
    ];

    for (const resolver of report.resolvers) {
        const status = resolver.ok ? 'PASS' : 'FAIL';
        const details = resolver.ok
            ? `passed after ${resolver.attempts} attempt${resolver.attempts === 1 ? '' : 's'}`
            : `${resolver.phase}: ${resolver.reason} (after ${resolver.attempts} attempts)`;
        lines.push(`| ${status} | ${escapeMarkdown(resolver.name)} (${resolver.country}) | \`${resolver.udp}\` | ${escapeMarkdown(details)} |`);
    }

    if (report.dohOnly > 0) {
        lines.push('', `_${report.dohOnly} DoH-only entr${report.dohOnly === 1 ? 'y was' : 'ies were'} not checked by this UDP probe._`);
    }
    return lines.join('\n');
};

const main = async () => {
    const options = parseCliArgs(process.argv.slice(2));
    const report = await checkDnsResolvers(DNS_RESOLVERS, { attempts: options.attempts });
    const output = options.json ? { ...report, markdown: formatMarkdown(report) } : formatMarkdown(report);
    process.stdout.write(`${options.json ? JSON.stringify(output, null, 2) : output}\n`);
    if (!report.ok) process.exitCode = 1;
};

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 2;
    });
}
