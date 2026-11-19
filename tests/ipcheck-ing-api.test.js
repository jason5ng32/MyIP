// Tests for server/ipcheck-ing-api.js: header picking, URL building, the
// unconfigured short-circuit, what a request sends and returns, and the coded
// error body. fetch is stubbed.

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { setUpstreamUserAgent } from '../common/fetch-with-timeout.js';
import {
    FORWARDED_HEADERS, buildIpCheckingUrl, ipCheckingApiErrorBody, isIpCheckingApiConfigured, pickForwardedHeaders,
    requestIpCheckingApi,
} from '../server/ipcheck-ing-api.js';
import { SERVICE_ERROR_CODE, AUTH_REASON } from '../common/codes/service-errors.js';

const ENV_KEYS = ['IPCHECKING_API_KEY', 'IPCHECKING_API_ENDPOINT'];
const originalFetch = globalThis.fetch;
let envBackup;

const configure = () => {
    process.env.IPCHECKING_API_KEY = 'test-key';
    process.env.IPCHECKING_API_ENDPOINT = 'https://upstream.invalid';
};

// Records each fetch call and answers `response`.
const stubFetch = (response = () => new Response('{}', { status: 200 })) => {
    const calls = [];
    globalThis.fetch = async (url, init) => {
        calls.push({ url: new URL(String(url)), init });
        return response();
    };
    return calls;
};

const VISITOR_HEADERS = {
    host: 'ipcheck.example',
    cookie: 'session=1',
    referer: 'https://ipcheck.example/',
    origin: 'https://ipcheck.example',
    'content-length': '999',
    'content-type': 'application/json',
    'accept-encoding': 'gzip',
    connection: 'keep-alive',
    'sentry-trace': 'abc-def-1',
    baggage: 'sentry-release=x',
    authorization: 'Bearer t',
    'accept-language': 'ja-JP,ja;q=0.9',
    'user-agent': 'VisitorBrowser/1.0',
    'cf-connecting-ip': '203.0.113.7',
    'x-forwarded-for': '203.0.113.7, 198.51.100.1',
};

beforeEach(() => {
    envBackup = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
});
afterEach(() => {
    globalThis.fetch = originalFetch;
    setUpstreamUserAgent(null);
    for (const k of ENV_KEYS) {
        if (envBackup[k] === undefined) delete process.env[k];
        else process.env[k] = envBackup[k];
    }
});

describe('pickForwardedHeaders', () => {
    it('keeps exactly the listed headers', () => {
        assert.deepEqual(pickForwardedHeaders(VISITOR_HEADERS), {
            authorization: 'Bearer t',
            'accept-language': 'ja-JP,ja;q=0.9',
            'user-agent': 'VisitorBrowser/1.0',
            'cf-connecting-ip': '203.0.113.7',
            'x-forwarded-for': '203.0.113.7, 198.51.100.1',
        });
        assert.deepEqual(FORWARDED_HEADERS.toSorted(),
            ['accept-language', 'authorization', 'cf-connecting-ip', 'user-agent', 'x-forwarded-for']);
    });

    it('matches names in any casing and keys them in lower case', () => {
        assert.deepEqual(
            pickForwardedHeaders({ Authorization: 'Bearer t', 'Accept-Language': 'de', 'X-Forwarded-For': '203.0.113.7', Host: 'x' }),
            { authorization: 'Bearer t', 'accept-language': 'de', 'x-forwarded-for': '203.0.113.7' },
        );
    });

    it('leaves absent headers out', () => {
        assert.deepEqual(pickForwardedHeaders({ 'accept-language': 'en', authorization: undefined }), { 'accept-language': 'en' });
        assert.deepEqual(pickForwardedHeaders({}), {});
        assert.deepEqual(pickForwardedHeaders(undefined), {});
    });
});

describe('buildIpCheckingUrl', () => {
    it('appends the path to the endpoint and sets the key under the given name', () => {
        const withKey = buildIpCheckingUrl('https://upstream.invalid/v1', '/userinfo', { key: 'k' });
        assert.equal(withKey.pathname, '/v1/userinfo');
        assert.equal(withKey.searchParams.get('key'), 'k');
        const withApikey = buildIpCheckingUrl('https://upstream.invalid', '/getpdresult/abc', { key: 'k', keyParam: 'apikey' });
        assert.equal(withApikey.searchParams.get('apikey'), 'k');
        assert.equal(withApikey.searchParams.has('key'), false);
    });

    it('encodes query values instead of letting them add parameters', () => {
        const url = buildIpCheckingUrl('https://upstream.invalid', '/ipinfo', {
            key: 'k', query: { ip: '1.1.1.1', lang: 'en&ip=10.0.0.1' },
        });
        assert.deepEqual(url.searchParams.getAll('ip'), ['1.1.1.1']);
        assert.equal(url.searchParams.get('lang'), 'en&ip=10.0.0.1');
        assert.deepEqual([...url.searchParams.keys()], ['key', 'ip', 'lang']);
    });

    it('skips undefined query values', () => {
        const url = buildIpCheckingUrl('https://upstream.invalid', '/x', { key: 'k', query: { lang: undefined } });
        assert.equal(url.searchParams.has('lang'), false);
    });
});

describe('requestIpCheckingApi', () => {
    it('sends nothing and resolves null when the key or endpoint is missing', async () => {
        const calls = stubFetch();
        for (const [key, endpoint] of [[undefined, 'https://upstream.invalid'], ['test-key', undefined], [undefined, undefined]]) {
            if (key) process.env.IPCHECKING_API_KEY = key;
            else delete process.env.IPCHECKING_API_KEY;
            if (endpoint) process.env.IPCHECKING_API_ENDPOINT = endpoint;
            else delete process.env.IPCHECKING_API_ENDPOINT;
            assert.equal(isIpCheckingApiConfigured(), false);
            assert.equal(await requestIpCheckingApi('/userinfo', { forwardFrom: { headers: VISITOR_HEADERS } }), null);
        }
        assert.equal(calls.length, 0);
        configure();
        assert.equal(isIpCheckingApiConfigured(), true);
    });

    it('forwards only the listed visitor headers', async () => {
        configure();
        const calls = stubFetch();
        await requestIpCheckingApi('/userinfo', { forwardFrom: { headers: VISITOR_HEADERS } });
        const { url, init } = calls[0];
        assert.equal(url.pathname, '/userinfo');
        assert.equal(url.searchParams.get('key'), 'test-key');
        assert.deepEqual(init.headers, pickForwardedHeaders(VISITOR_HEADERS));
        for (const name of ['host', 'cookie', 'referer', 'origin', 'content-length', 'content-type', 'sentry-trace', 'baggage']) {
            assert.equal(name in init.headers, false, name);
        }
        assert.equal(init.method, undefined);
        assert.equal(init.body, undefined);
    });

    it('sends a JSON body with its own content-type and no content-length', async () => {
        configure();
        const calls = stubFetch();
        const body = { name: 'X', nested: { a: 1 } };
        await requestIpCheckingApi('/updateuserachievements', {
            method: 'PUT', body, forwardFrom: { headers: VISITOR_HEADERS },
        });
        const { init } = calls[0];
        assert.equal(init.method, 'PUT');
        assert.equal(init.body, JSON.stringify(body));
        assert.equal(init.headers['content-type'], 'application/json');
        assert.equal(Object.keys(init.headers).filter((name) => name.toLowerCase() === 'content-type').length, 1);
        assert.equal('content-length' in init.headers, false);
        assert.equal(init.headers['accept-language'], 'ja-JP,ja;q=0.9');
    });

    it('keeps the visitor user-agent as the only one, else the default applies', async () => {
        configure();
        setUpstreamUserAgent('MyIP/v0.0.0/https://example.test');
        const calls = stubFetch();
        await requestIpCheckingApi('/userinfo', { forwardFrom: { headers: { 'User-Agent': 'VisitorBrowser/1.0' } } });
        const visitor = Object.entries(calls[0].init.headers).filter(([name]) => name.toLowerCase() === 'user-agent');
        assert.deepEqual(visitor, [['user-agent', 'VisitorBrowser/1.0']]);
        await requestIpCheckingApi('/asnreputation', { query: { asn: 13335 } });
        const fallback = Object.entries(calls[1].init.headers).filter(([name]) => name.toLowerCase() === 'user-agent');
        assert.deepEqual(fallback, [['User-Agent', 'MyIP/v0.0.0/https://example.test']]);
    });

    it('sends no visitor header without forwardFrom', async () => {
        configure();
        const calls = stubFetch();
        await requestIpCheckingApi('/asnreputation', { query: { asn: 13335 } });
        assert.deepEqual(calls[0].init.headers, {});
    });

    it('hands back the upstream response untouched, a 202 included', async () => {
        configure();
        stubFetch(() => new Response(JSON.stringify({ status: 'pending' }), { status: 202 }));
        const response = await requestIpCheckingApi('/getpdresult/abc', { keyParam: 'apikey' });
        assert.equal(response.status, 202);
        assert.equal(response.ok, true);
        assert.deepEqual(await response.json(), { status: 'pending' });
    });
});

describe('ipCheckingApiErrorBody', () => {
    const answer = (status, body) => new Response(body === undefined ? '' : JSON.stringify(body), { status });

    it('reads the auth reason from the upstream code, never from its text', async () => {
        for (const [code, reason] of [
            ['invalid_token', AUTH_REASON.INVALID_TOKEN],
            ['sign_in_required', AUTH_REASON.SIGN_IN_REQUIRED],
        ]) {
            for (const status of [401, 403]) {
                assert.deepEqual(await ipCheckingApiErrorBody(answer(status, { error: 'Sign in required', code })),
                    { error: 'Sign in required', code: SERVICE_ERROR_CODE.AUTH, reason }, `${status} ${code}`);
            }
        }
        const textOnly = await ipCheckingApiErrorBody(answer(403, { error: 'Invalid token' }));
        assert.deepEqual(textOnly, { error: 'Invalid token', code: SERVICE_ERROR_CODE.AUTH, reason: AUTH_REASON.SIGN_IN_REQUIRED });
    });

    it('reads an unknown or missing code as sign_in_required', async () => {
        for (const upstream of [
            { error: 'Sign in required', code: 'auth/id-token-expired' },
            { error: 'Sign in required', code: 401 },
            { message: 'Authorization header is missing.' },
            {},
        ]) {
            const body = await ipCheckingApiErrorBody(answer(403, upstream));
            assert.equal(body.code, SERVICE_ERROR_CODE.AUTH);
            assert.equal(body.reason, AUTH_REASON.SIGN_IN_REQUIRED);
            assert.equal(typeof body.error, 'string');
        }
    });

    it('codes a 429 as quota, whatever the upstream code field says', async () => {
        assert.deepEqual(
            await ipCheckingApiErrorBody(answer(429, { error: 'Monthly quota exceeded', code: 'anything' })),
            { error: 'Monthly quota exceeded', code: SERVICE_ERROR_CODE.QUOTA },
        );
    });

    it('gives other statuses no code, and drops the upstream code field', async () => {
        assert.deepEqual(await ipCheckingApiErrorBody(answer(400, { error: 'Invalid country', code: 'x' })), { error: 'Invalid country' });
        assert.deepEqual(await ipCheckingApiErrorBody(answer(500, {})), { error: 'Upstream status 500' });
    });

    it('treats a 401 like a 403', async () => {
        assert.deepEqual(await ipCheckingApiErrorBody(answer(401, { error: 'Unauthorized' })),
            { error: 'Unauthorized', code: SERVICE_ERROR_CODE.AUTH, reason: AUTH_REASON.SIGN_IN_REQUIRED });
    });

    it('keeps the code of a non-JSON body', async () => {
        const html = (status) => new Response('<html>blocked</html>', { status });
        assert.deepEqual(await ipCheckingApiErrorBody(html(403)),
            { error: 'Sign in required', code: SERVICE_ERROR_CODE.AUTH, reason: AUTH_REASON.SIGN_IN_REQUIRED });
        assert.deepEqual(await ipCheckingApiErrorBody(html(401)),
            { error: 'Sign in required', code: SERVICE_ERROR_CODE.AUTH, reason: AUTH_REASON.SIGN_IN_REQUIRED });
        assert.deepEqual(await ipCheckingApiErrorBody(html(429)), { error: 'Monthly quota exceeded', code: SERVICE_ERROR_CODE.QUOTA });
        assert.deepEqual(await ipCheckingApiErrorBody(html(502)), { error: 'Upstream status 502' });
    });
});
