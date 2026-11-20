// Tests for server/sign-in-token.js: token checks, verdict caching, the certificate key source and the unconfigured path; keys are generated here, nothing is fetched.

import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { rootCertificates } from 'node:tls';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
    certificatesTtlMs, createCertificateKeySource, createTokenVerifier, verifySignIn,
} from '../server/sign-in-token.js';
import { AUTH_REASON } from '../common/codes/service-errors.js';
import logger from '../server/logger.js';

const PROJECT = 'demo-project';
const KID = 'key-1';
const NOW_MS = 1_800_000_000_000;
const NOW = NOW_MS / 1000;

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = generateKeyPairSync('rsa', { modulusLength: 2048 });

const SIGNED_OUT = { reason: AUTH_REASON.SIGN_IN_REQUIRED };
const INVALID = { reason: AUTH_REASON.INVALID_TOKEN };

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

const claims = (overrides = {}) => ({
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    auth_time: NOW - 600,
    iat: NOW - 60,
    exp: NOW + 3000,
    sub: 'user-123',
    ...overrides,
});

// A compact JWS over `payload`, signed RS256 with `key` unless `alg` says otherwise.
const mint = ({ payload = claims(), header = {}, key = privateKey } = {}) => {
    const head = encode({ alg: 'RS256', kid: KID, typ: 'JWT', ...header });
    const body = encode(payload);
    const signature = sign('sha256', Buffer.from(`${head}.${body}`), key).toString('base64url');
    return `${head}.${body}.${signature}`;
};

const bearer = (token) => `Bearer ${token}`;

// A verifier over a fixed clock and the test key; `lookups` counts key fetches.
const setup = ({ getKey, now = () => NOW_MS, ...rest } = {}) => {
    const lookups = [];
    const verify = createTokenVerifier({
        projectId: PROJECT,
        now,
        getKey: async (kid) => {
            lookups.push(kid);
            return getKey ? getKey(kid) : (kid === KID ? publicKey : null);
        },
        ...rest,
    });
    return { verify, lookups };
};

describe('createTokenVerifier', () => {
    it('accepts a valid token and yields its subject as the id', async () => {
        const { verify } = setup();
        assert.deepEqual(await verify(bearer(mint())), { id: 'user-123' });
    });

    it('reads a missing header as signed out', async () => {
        const { verify, lookups } = setup();
        assert.deepEqual(await verify(undefined), SIGNED_OUT);
        assert.deepEqual(await verify(''), SIGNED_OUT);
        assert.equal(lookups.length, 0);
    });

    it('rejects a malformed header or token without a key lookup', async () => {
        const { verify, lookups } = setup();
        const token = mint();
        for (const header of [
            token, `Basic ${token}`, `bearer ${token}`, `Bearer ${token} extra`, 'Bearer ',
            bearer('a.b'), bearer('a.b.c.d'), bearer(`${token.split('.').slice(0, 2).join('.')}.`),
            bearer(`${encode([1])}.${encode(claims())}.sig`), bearer(`notjson.${encode(claims())}.sig`),
            bearer(`${encode({ alg: 'RS256', kid: KID })}.e30+.sig`),
        ]) {
            assert.deepEqual(await verify(header), INVALID, header);
        }
        assert.equal(lookups.length, 0);
    });

    it('rejects any algorithm but RS256, and a missing kid', async () => {
        const { verify } = setup();
        for (const header of [{ alg: 'none' }, { alg: 'HS256' }, { alg: 'RS512' }, { alg: 'rs256' }, { kid: undefined }, { kid: 7 }]) {
            assert.deepEqual(await verify(bearer(mint({ header }))), INVALID, JSON.stringify(header));
        }
        const unsigned = `${encode({ alg: 'none', kid: KID })}.${encode(claims())}.`;
        assert.deepEqual(await verify(bearer(unsigned)), INVALID);
    });

    it('rejects an expired token, and one issued or authenticated in the future', async () => {
        const { verify } = setup();
        for (const payload of [
            claims({ exp: NOW - 1 }), claims({ exp: NOW }), claims({ exp: undefined }), claims({ exp: '9999999999' }),
            claims({ iat: NOW + 61 }), claims({ iat: undefined }),
            claims({ auth_time: NOW + 61 }), claims({ auth_time: undefined }),
        ]) {
            assert.deepEqual(await verify(bearer(mint({ payload }))), INVALID, JSON.stringify(payload));
        }
    });

    it('accepts a token issued up to a minute ahead of this server\'s clock', async () => {
        const { verify } = setup();
        const payload = claims({ iat: NOW + 60, auth_time: NOW + 60 });
        assert.deepEqual(await verify(bearer(mint({ payload }))), { id: 'user-123' });
    });

    it('rejects a wrong audience or issuer', async () => {
        const { verify } = setup();
        for (const payload of [
            claims({ aud: 'other-project' }), claims({ aud: [PROJECT] }), claims({ aud: undefined }),
            claims({ iss: 'https://securetoken.google.com/other-project' }),
            claims({ iss: `https://accounts.google.com/${PROJECT}` }), claims({ iss: undefined }),
        ]) {
            assert.deepEqual(await verify(bearer(mint({ payload }))), INVALID, JSON.stringify(payload));
        }
    });

    it('takes a subject of 1–128 visible ASCII characters only', async () => {
        const { verify } = setup();
        assert.deepEqual(await verify(bearer(mint({ payload: claims({ sub: 'x'.repeat(128) }) }))), { id: 'x'.repeat(128) });
        for (const sub of ['', 'x'.repeat(129), 'has space', 'tab\t', 'naïve', 42, undefined]) {
            assert.deepEqual(await verify(bearer(mint({ payload: claims({ sub }) }))), INVALID, String(sub));
        }
    });

    it('rejects a wrong signature, an unknown kid and a non-RSA key', async () => {
        const { verify } = setup();
        assert.deepEqual(await verify(bearer(mint({ key: other.privateKey }))), INVALID);
        const [head, body] = mint().split('.');
        const tampered = encode(claims({ sub: 'someone-else' }));
        assert.deepEqual(await verify(bearer(`${head}.${tampered}.${mint().split('.')[2]}`)), INVALID);
        assert.deepEqual(await verify(bearer(`${head}.${body}.AAAA`)), INVALID);
        assert.deepEqual(await verify(bearer(mint({ header: { kid: 'unknown' } }))), INVALID);

        const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' });
        const { verify: ecVerify } = setup({ getKey: () => ec.publicKey });
        assert.deepEqual(await ecVerify(bearer(mint())), INVALID);
    });

    it('serves a repeated token from the verdict cache, failures included', async () => {
        let now = NOW_MS;
        const { verify, lookups } = setup({ now: () => now });
        const good = bearer(mint());
        const forged = bearer(mint({ key: other.privateKey }));
        assert.deepEqual(await verify(good), { id: 'user-123' });
        assert.deepEqual(await verify(forged), INVALID);
        now += 4 * 60 * 1000;
        assert.deepEqual(await verify(good), { id: 'user-123' });
        assert.deepEqual(await verify(forged), INVALID);
        assert.equal(lookups.length, 2);
        now += 2 * 60 * 1000;
        await verify(good);
        await verify(forged);
        assert.equal(lookups.length, 4);
    });

    it('never serves a cached verdict past the token expiry', async () => {
        let now = NOW_MS;
        const { verify } = setup({ now: () => now });
        const token = bearer(mint({ payload: claims({ exp: NOW + 60 }) }));
        assert.deepEqual(await verify(token), { id: 'user-123' });
        now += 61 * 1000;
        assert.deepEqual(await verify(token), INVALID);
    });

    it('caches nothing when the key lookup fails', async () => {
        let fail = true;
        const { verify, lookups } = setup({
            getKey: () => {
                if (fail) throw new Error('certificates down');
                return publicKey;
            },
        });
        const token = bearer(mint());
        await assert.rejects(verify(token), /certificates down/);
        fail = false;
        assert.deepEqual(await verify(token), { id: 'user-123' });
        assert.equal(lookups.length, 2);
    });

    it('keeps at most maxVerdicts entries, dropping the oldest', async () => {
        const { verify, lookups } = setup({ maxVerdicts: 2 });
        const tokens = ['a', 'b', 'c'].map((sub) => bearer(mint({ payload: claims({ sub }) })));
        for (const token of tokens) await verify(token);
        assert.equal(lookups.length, 3);
        await verify(tokens[2]);
        await verify(tokens[1]);
        assert.equal(lookups.length, 3);
        await verify(tokens[0]);
        assert.equal(lookups.length, 4);
    });
});

describe('createCertificateKeySource', () => {
    // A public certificate shipped with Node, so no fixture or private key is needed.
    const PEM = rootCertificates[0];

    const silenced = async (run) => {
        const level = logger.level;
        logger.level = 'silent';
        try { return await run(); } finally { logger.level = level; }
    };

    const source = ({ answers, now }) => {
        const calls = [];
        const getKey = createCertificateKeySource({
            now,
            fetchCertificates: async () => {
                calls.push(1);
                const next = answers.shift();
                if (next instanceof Error) throw next;
                return next;
            },
        });
        return { getKey, calls };
    };
    const certificates = (body, maxAge = 3600) => new Response(JSON.stringify(body), {
        status: 200, headers: { 'cache-control': `public, max-age=${maxAge}, must-revalidate` },
    });

    it('reads max-age from Cache-Control, with a fallback', () => {
        assert.equal(certificatesTtlMs('public, max-age=19800, must-revalidate, no-transform'), 19_800_000);
        assert.equal(certificatesTtlMs('public, s-maxage=10'), 3_600_000);
        assert.equal(certificatesTtlMs(null), 3_600_000);
    });

    it('parses each certificate and caches the list until max-age runs out', async () => {
        let now = 0;
        const { getKey, calls } = source({ now: () => now, answers: [certificates({ [KID]: PEM }, 100), certificates({ [KID]: PEM }, 100)] });
        const key = await getKey(KID);
        assert.equal(key.type, 'public');
        now = 99_000;
        assert.equal(await getKey(KID), key);
        assert.equal(calls.length, 1);
        now = 100_000;
        await getKey(KID);
        assert.equal(calls.length, 2);
    });

    it('refetches once for an unknown kid, then answers null', async () => {
        let now = 0;
        const { getKey, calls } = source({
            now: () => now,
            answers: [certificates({ [KID]: PEM }), certificates({ [KID]: PEM }), certificates({ 'key-2': PEM })],
        });
        assert.equal(await getKey('missing'), null);
        assert.equal(calls.length, 1);
        now = 61_000;
        assert.equal(await getKey('missing'), null);
        assert.equal(calls.length, 2);
        now = 200_000;
        assert.equal((await getKey('key-2')).type, 'public');
        assert.equal(calls.length, 3);
    });

    it('throws for an unknown kid inside the refetch cooldown, without fetching', async () => {
        let now = 0;
        const { getKey, calls } = source({ now: () => now, answers: [certificates({ [KID]: PEM })] });
        await getKey(KID);
        now = 1000;
        await assert.rejects(getKey('missing'), { name: 'SignInCheckUnavailable' });
        assert.equal(calls.length, 1);
    });

    it('throws on a failed fetch and keeps nothing from it', async () => {
        await silenced(async () => {
            const { getKey, calls } = source({
                now: () => 0,
                answers: [
                    new Error('network down'),
                    new Response('busy', { status: 503 }),
                    certificates({}),
                    new Response('not json', { status: 200 }),
                    certificates({ [KID]: PEM }),
                ],
            });
            for (let i = 0; i < 4; i++) await assert.rejects(getKey(KID), { name: 'SignInCheckUnavailable' });
            assert.equal((await getKey(KID)).type, 'public');
            assert.equal(calls.length, 5);
        });
    });

    it('shares one fetch between concurrent lookups', async () => {
        const { getKey, calls } = source({ now: () => 0, answers: [certificates({ [KID]: PEM })] });
        await Promise.all([getKey(KID), getKey(KID), getKey(KID)]);
        assert.equal(calls.length, 1);
    });
});

describe('verifySignIn', () => {
    let saved;
    const originalFetch = globalThis.fetch;
    beforeEach(() => { saved = process.env.VITE_FIREBASE_PROJECT_ID; });
    afterEach(() => {
        globalThis.fetch = originalFetch;
        if (saved === undefined) delete process.env.VITE_FIREBASE_PROJECT_ID;
        else process.env.VITE_FIREBASE_PROJECT_ID = saved;
    });

    it('treats every request as signed out when sign-in is not configured, fetching nothing', async () => {
        delete process.env.VITE_FIREBASE_PROJECT_ID;
        globalThis.fetch = async () => assert.fail('no certificate fetch');
        assert.deepEqual(await verifySignIn(bearer(mint())), SIGNED_OUT);
        assert.deepEqual(await verifySignIn('garbage'), SIGNED_OUT);
        assert.deepEqual(await verifySignIn(undefined), SIGNED_OUT);
    });

    it('rejects a token for another project before any fetch when configured', async () => {
        process.env.VITE_FIREBASE_PROJECT_ID = 'another-project';
        globalThis.fetch = async () => assert.fail('no certificate fetch');
        assert.deepEqual(await verifySignIn(bearer(mint())), INVALID);
    });
});
