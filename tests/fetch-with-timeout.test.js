import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';

import { fetchWithTimeout } from '../frontend/utils/fetch-with-timeout.js';

// Stub global fetch per-test so we can control whether it resolves, rejects,
// or stays pending (and observe whether it was aborted via the signal we receive).
const originalFetch = globalThis.fetch;

function installFetch(impl) {
    globalThis.fetch = (input, init) => impl(input, init);
}

function restoreFetch() {
    globalThis.fetch = originalFetch;
}

// Helper that returns { promise, resolve, reject } — a deferred.
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
        const res = await fetchWithTimeout('https://example.test', {}, 100);
        assert.equal(await res.text(), 'ok');
    });

    it('aborts the fetch when the timeout elapses, surfacing an AbortError', async () => {
        let sawAbort = false;
        installFetch((_input, init) => {
            const { promise, reject } = deferred();
            init.signal.addEventListener('abort', () => {
                sawAbort = true;
                // Match real fetch's abort behavior.
                const err = new Error('aborted');
                err.name = 'AbortError';
                reject(err);
            });
            return promise;
        });

        await assert.rejects(
            () => fetchWithTimeout('https://example.test', {}, 20),
            (err) => err.name === 'AbortError',
        );
        assert.equal(sawAbort, true, 'fetch received the abort signal from the timeout');
    });

    it('clears the timer and does not abort when fetch resolves quickly', async () => {
        let sawAbortAfterResolve = false;
        installFetch((_input, init) => {
            // Register listener first — we want to know if the timer still fires.
            init.signal.addEventListener('abort', () => { sawAbortAfterResolve = true; });
            return Promise.resolve(new Response('fast'));
        });

        const res = await fetchWithTimeout('https://example.test', {}, 20);
        assert.equal(await res.text(), 'fast');

        // Wait past the original timeout to prove it did not fire.
        await new Promise((r) => setTimeout(r, 40));
        assert.equal(sawAbortAfterResolve, false, 'timer was cleared after fetch resolved');
    });

    it('propagates errors from fetch itself without waiting for the timeout', async () => {
        installFetch(() => Promise.reject(new Error('network down')));
        await assert.rejects(
            () => fetchWithTimeout('https://example.test', {}, 1000),
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
            () => fetchWithTimeout('https://example.test', { signal: outer.signal }, 1000),
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
        const p = fetchWithTimeout('https://example.test', { signal: outer.signal }, 10000);

        // Abort via the caller's signal on the next tick.
        queueMicrotask(() => outer.abort());

        await assert.rejects(p, (err) => err.name === 'AbortError');
        assert.equal(sawAbort, true);
    });
});
