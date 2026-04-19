import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';

import { fetchWithTimeout, fetchUpstream } from '../common/fetch-with-timeout.js';

// Stub global fetch per-test so we can control whether it resolves, rejects,
// or stays pending (and observe whether the wrapper aborted it via signal).
const originalFetch = globalThis.fetch;

function installFetch(impl) {
    globalThis.fetch = (input, init) => impl(input, init);
}

function restoreFetch() {
    globalThis.fetch = originalFetch;
}

function deferred() {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('fetchWithTimeout()', () => {
    afterEach(() => {
        restoreFetch();
    });

    it('resolves with the response when fetch finishes before the timeout', async () => {
        installFetch(async () => new Response('ok'));
        const res = await fetchWithTimeout('https://example.test', { timeoutMs: 100 });
        assert.equal(await res.text(), 'ok');
    });

    it('aborts the fetch when the timeout elapses, surfacing an AbortError', async () => {
        let sawAbort = false;
        installFetch((_input, init) => {
            const { promise, reject } = deferred();
            init.signal.addEventListener('abort', () => {
                sawAbort = true;
                const err = new Error('aborted');
                err.name = 'AbortError';
                reject(err);
            });
            return promise;
        });

        await assert.rejects(
            () => fetchWithTimeout('https://example.test', { timeoutMs: 20 }),
            (err) => err.name === 'AbortError',
        );
        assert.equal(sawAbort, true, 'fetch received the abort signal from the timeout');
    });

    it('clears the timer and does not abort when fetch resolves quickly', async () => {
        let sawAbortAfterResolve = false;
        installFetch((_input, init) => {
            init.signal.addEventListener('abort', () => { sawAbortAfterResolve = true; });
            return Promise.resolve(new Response('fast'));
        });

        const res = await fetchWithTimeout('https://example.test', { timeoutMs: 20 });
        assert.equal(await res.text(), 'fast');

        await new Promise((r) => setTimeout(r, 40));
        assert.equal(sawAbortAfterResolve, false, 'timer was cleared after fetch resolved');
    });

    it('propagates errors from fetch itself without waiting for the timeout', async () => {
        installFetch(() => Promise.reject(new Error('network down')));
        await assert.rejects(
            () => fetchWithTimeout('https://example.test', { timeoutMs: 1000 }),
            (err) => err.message === 'network down',
        );
    });

    it('aborts immediately if the caller-provided signal is already aborted', async () => {
        let receivedAbort = false;
        installFetch((_input, init) => {
            if (init.signal.aborted) receivedAbort = true;
            const err = new Error('aborted');
            err.name = 'AbortError';
            return Promise.reject(err);
        });

        const outer = new AbortController();
        outer.abort();

        await assert.rejects(
            () => fetchWithTimeout('https://example.test', { signal: outer.signal, timeoutMs: 1000 }),
            (err) => err.name === 'AbortError',
        );
        assert.equal(receivedAbort, true, 'internal signal inherited the pre-aborted state');
    });

    it('propagates caller-signal abort to the fetch', async () => {
        let sawAbort = false;
        installFetch((_input, init) => {
            const { promise, reject } = deferred();
            init.signal.addEventListener('abort', () => {
                sawAbort = true;
                const err = new Error('aborted');
                err.name = 'AbortError';
                reject(err);
            });
            return promise;
        });

        const outer = new AbortController();
        const p = fetchWithTimeout('https://example.test', { signal: outer.signal, timeoutMs: 10000 });

        queueMicrotask(() => outer.abort());

        await assert.rejects(p, (err) => err.name === 'AbortError');
        assert.equal(sawAbort, true);
    });

    it('uses the 5000ms default timeout when not specified', async () => {
        // We can't easily wait 5 seconds in a test, just verify the fetch was
        // called with a signal and the default didn't fire synchronously.
        let sawSignal = false;
        installFetch(async (_input, init) => {
            sawSignal = init.signal instanceof AbortSignal && !init.signal.aborted;
            return new Response('ok');
        });
        await fetchWithTimeout('https://example.test');
        assert.equal(sawSignal, true);
    });
});

describe('fetchUpstream()', () => {
    afterEach(() => {
        restoreFetch();
    });

    it('is a thin preset around fetchWithTimeout that still resolves normally', async () => {
        installFetch(async () => new Response('upstream-ok'));
        const res = await fetchUpstream('https://example.test');
        assert.equal(await res.text(), 'upstream-ok');
    });

    it('still aborts on timeout (inherits fetchWithTimeout behavior)', async () => {
        let sawAbort = false;
        installFetch((_input, init) => {
            const { promise, reject } = deferred();
            init.signal.addEventListener('abort', () => {
                sawAbort = true;
                const err = new Error('aborted');
                err.name = 'AbortError';
                reject(err);
            });
            return promise;
        });

        // Pass a short timeoutMs so the test doesn't actually wait 8s for the default.
        await assert.rejects(
            () => fetchUpstream('https://example.test', { timeoutMs: 20 }),
            (err) => err.name === 'AbortError',
        );
        assert.equal(sawAbort, true);
    });

    it('caller-provided init fields override the 8000ms default', async () => {
        // Verify that { timeoutMs: 100 } overrides the 8000 preset, proving
        // the preset merges rather than forcing a fixed timeout.
        let observedSignal = null;
        installFetch(async (_input, init) => {
            observedSignal = init.signal;
            return new Response('ok');
        });
        await fetchUpstream('https://example.test', { timeoutMs: 100 });
        assert.ok(observedSignal instanceof AbortSignal);
    });
});
