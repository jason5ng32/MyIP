// Passthrough behavior of server/sentry-cron.js when no backend DSN is set —
// the wrapper must be a transparent no-op (result and rejection both flow
// through) so periodic jobs behave identically on Sentry-less deployments.
// Also covers server/logger.js's flattenLogAttributes (the pino-context →
// Sentry-log-attributes normalizer used by the forwarding hook).
import { test } from 'node:test';
import assert from 'node:assert';

// Ensure the gate is closed regardless of the shell environment, then import
// (both modules evaluate the gate once at load).
delete process.env.SENTRY_DSN_BACKEND;
const { withCronMonitor } = await import('../server/sentry-cron.js');
const { flattenLogAttributes } = await import('../server/logger.js');

test('returns the job result unchanged when Sentry is not configured', async () => {
    const result = await withCronMonitor('test-job', async () => 42, {
        schedule: { type: 'interval', value: 5, unit: 'minute' },
    });
    assert.strictEqual(result, 42);
});

test('propagates a rejected job to the caller', async () => {
    await assert.rejects(
        () => withCronMonitor('test-job', async () => { throw new Error('boom'); }, {}),
        /boom/,
    );
});

test('runs the job exactly once', async () => {
    let calls = 0;
    await withCronMonitor('test-job', async () => { calls += 1; }, {});
    assert.strictEqual(calls, 1);
});

test('flattens Error values into message + stack attributes', () => {
    const err = new Error('kaput');
    const attrs = flattenLogAttributes({ err, ip: '1.2.3.4' });
    assert.strictEqual(attrs['err.message'], 'kaput');
    assert.ok(attrs['err.stack'].includes('kaput'));
    assert.strictEqual(attrs.ip, '1.2.3.4');
    assert.strictEqual('err' in attrs, false);
});

test('serializes nested objects and passes primitives through', () => {
    const attrs = flattenLogAttributes({
        req: { method: 'GET', url: '/api/x' },
        count: 3,
        flag: true,
        nothing: null,
    });
    assert.strictEqual(attrs.req, '{"method":"GET","url":"/api/x"}');
    assert.strictEqual(attrs.count, 3);
    assert.strictEqual(attrs.flag, true);
    assert.strictEqual(attrs.nothing, null);
});
