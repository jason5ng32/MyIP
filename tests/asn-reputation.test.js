// Tests for common/asn-reputation.js — the private-API request behind the
// /api/asn-profile reputation section: no upstream call without a key or
// endpoint, asn + system key + caller headers forwarded, upstream status and
// body handed back, network failures thrown. fetch is stubbed.

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { requestAsnReputation } from '../common/asn-reputation.js';

const ENV_KEYS = ['IPCHECKING_API_KEY', 'IPCHECKING_API_ENDPOINT'];
const originalFetch = globalThis.fetch;
let envBackup;

beforeEach(() => {
    envBackup = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
});
afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const k of ENV_KEYS) {
        if (envBackup[k] === undefined) delete process.env[k];
        else process.env[k] = envBackup[k];
    }
});

describe('requestAsnReputation', () => {
    it('resolves null without calling out when the key or endpoint is missing', async () => {
        globalThis.fetch = async () => { throw new Error('unexpected upstream call'); };
        for (const env of [{ key: undefined, endpoint: 'https://upstream.invalid' }, { key: 'test-key', endpoint: undefined }]) {
            if (env.key) process.env.IPCHECKING_API_KEY = env.key;
            else delete process.env.IPCHECKING_API_KEY;
            if (env.endpoint) process.env.IPCHECKING_API_ENDPOINT = env.endpoint;
            else delete process.env.IPCHECKING_API_ENDPOINT;
            assert.equal(await requestAsnReputation(13335, {}), null);
        }
    });

    it('forwards asn, key and caller headers; returns status and payload', async () => {
        process.env.IPCHECKING_API_KEY = 'test-key';
        process.env.IPCHECKING_API_ENDPOINT = 'https://upstream.invalid';
        const payload = { asn: 64511, found: false, size: 0 };
        let requested;
        globalThis.fetch = async (url, options) => {
            requested = { url: new URL(String(url)), options };
            return { status: 200, ok: true, json: async () => payload };
        };
        const result = await requestAsnReputation(64511, { 'accept-language': 'de-DE' });
        assert.deepEqual(result, { status: 200, data: payload });
        assert.equal(requested.url.pathname, '/asnreputation');
        assert.equal(requested.url.searchParams.get('asn'), '64511');
        assert.equal(requested.url.searchParams.get('key'), 'test-key');
        assert.equal(requested.options.headers['accept-language'], 'de-DE');
    });

    it('hands an upstream error status back, and throws on a network failure', async () => {
        process.env.IPCHECKING_API_KEY = 'test-key';
        process.env.IPCHECKING_API_ENDPOINT = 'https://upstream.invalid';
        globalThis.fetch = async () => ({ status: 503, ok: false, json: async () => ({ error: 'ASN data not loaded' }) });
        assert.deepEqual(await requestAsnReputation(13335, {}), { status: 503, data: { error: 'ASN data not loaded' } });
        globalThis.fetch = async () => { throw new Error('network down'); };
        await assert.rejects(requestAsnReputation(13335, {}), /network down/);
    });
});
