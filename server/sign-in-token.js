// Verifies the visitor's Firebase ID token against Google's public certificates and yields the signed-in user id.

import { X509Certificate, createHash, verify as verifySignature } from 'node:crypto';
import logger from './logger.js';
import { fetchUpstream } from '../common/fetch-with-timeout.js';
import { AUTH_REASON } from '../common/codes/service-errors.js';

export const CERTIFICATES_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

const FALLBACK_CERTIFICATES_TTL_MS = 60 * 60 * 1000;
// Floor between two refetches forced by an unknown `kid`.
const REFETCH_COOLDOWN_MS = 60 * 1000;
const VERDICT_TTL_MS = 5 * 60 * 1000;
const MAX_VERDICTS = 10_000;
// How far this server's clock may trail the issuer's.
const CLOCK_SKEW_SECONDS = 60;

// The id travels upstream as a header value: 1–128 visible ASCII characters.
const USER_ID = /^[\x21-\x7E]{1,128}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const BEARER = /^Bearer (\S+)$/;

const SIGNED_OUT = Object.freeze({ reason: AUTH_REASON.SIGN_IN_REQUIRED });
const INVALID = Object.freeze({ reason: AUTH_REASON.INVALID_TOKEN });

// The certificates cannot answer right now: an error, never a verdict.
const unavailable = (message, cause) => Object.assign(new Error(message, { cause }), { name: 'SignInCheckUnavailable' });

// Milliseconds a certificate list stays fresh, from its Cache-Control header.
export const certificatesTtlMs = (cacheControl) => {
    const maxAge = /(?:^|[\s,])max-age=(\d+)/i.exec(cacheControl ?? '')?.[1];
    return maxAge === undefined ? FALLBACK_CERTIFICATES_TTL_MS : Number(maxAge) * 1000;
};

// `kid` → public key, from the certificate list cached until its max-age runs
// out; an unknown `kid` refetches once (outside the cooldown), then is null.
export const createCertificateKeySource = ({
    fetchCertificates = () => fetchUpstream(CERTIFICATES_URL),
    now = Date.now,
} = {}) => {
    let keys = null;
    let fetchedAt = -Infinity;
    let expiresAt = -Infinity;
    let inFlight = null;

    const fetchKeys = async () => {
        try {
            const response = await fetchCertificates();
            if (!response.ok) throw new Error(`Certificate list answered ${response.status}`);
            const parsed = new Map(Object.entries(await response.json() ?? {})
                .map(([kid, pem]) => [kid, new X509Certificate(pem).publicKey]));
            if (!parsed.size) throw new Error('Certificate list is empty');
            keys = parsed;
            fetchedAt = now();
            expiresAt = fetchedAt + certificatesTtlMs(response.headers.get('cache-control'));
        } catch (err) {
            logger.warn({ err }, 'Sign-in certificate fetch failed');
            throw unavailable('Sign-in certificates unavailable', err);
        }
    };
    const load = () => {
        inFlight ??= fetchKeys().finally(() => { inFlight = null; });
        return inFlight;
    };

    return async (kid) => {
        const stale = !keys || now() >= expiresAt;
        if (stale) await load();
        if (keys.has(kid)) return keys.get(kid);
        if (stale) return null;
        if (now() - fetchedAt < REFETCH_COOLDOWN_MS) throw unavailable('Unknown key id during the refetch cooldown');
        await load();
        return keys.get(kid) ?? null;
    };
};

const decodeSegment = (segment) => {
    try {
        const value = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
        return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    } catch {
        return null;
    }
};

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

// `{ id, expiresAtMs }` for a valid token, else INVALID; throws
// an error when the key cannot be looked up. Claims are checked
// before the key lookup, so a stale or foreign token never causes a fetch.
const checkToken = async (token, { projectId, getKey, now }) => {
    const segments = token.split('.');
    if (segments.length !== 3 || !segments.every((s) => BASE64URL.test(s))) return INVALID;
    const [headerPart, payloadPart, signaturePart] = segments;
    const header = decodeSegment(headerPart);
    const payload = decodeSegment(payloadPart);
    if (!header || !payload) return INVALID;
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return INVALID;

    // `exp` is strict; a fresh token may read as issued up to the skew ahead.
    const nowSeconds = now() / 1000;
    const { exp, iat, auth_time: authTime, aud, iss, sub } = payload;
    if (!isNumber(exp) || exp <= nowSeconds) return INVALID;
    if (!isNumber(iat) || iat > nowSeconds + CLOCK_SKEW_SECONDS) return INVALID;
    if (!isNumber(authTime) || authTime > nowSeconds + CLOCK_SKEW_SECONDS) return INVALID;
    if (aud !== projectId) return INVALID;
    if (iss !== `https://securetoken.google.com/${projectId}`) return INVALID;
    if (typeof sub !== 'string' || !USER_ID.test(sub)) return INVALID;

    const key = await getKey(header.kid);
    if (key?.asymmetricKeyType !== 'rsa') return INVALID;
    let signed = false;
    try {
        signed = verifySignature('sha256', Buffer.from(`${headerPart}.${payloadPart}`),
            key, Buffer.from(signaturePart, 'base64url'));
    } catch {
        signed = false;
    }
    return signed ? { id: sub, expiresAtMs: exp * 1000 } : INVALID;
};

// `authorization` header → `{ id }` or `{ reason }` (AUTH_REASON); verdicts
// are cached per token for `verdictTtlMs`, never past its `exp`.
export const createTokenVerifier = ({
    projectId, getKey, now = Date.now, verdictTtlMs = VERDICT_TTL_MS, maxVerdicts = MAX_VERDICTS,
}) => {
    const verdicts = new Map();

    const remember = (cacheKey, verdict, until) => {
        verdicts.delete(cacheKey);
        if (verdicts.size >= maxVerdicts) verdicts.delete(verdicts.keys().next().value);
        verdicts.set(cacheKey, { verdict, until });
    };

    return async (authorization) => {
        if (!authorization) return SIGNED_OUT;
        const token = BEARER.exec(authorization)?.[1];
        if (!token) return INVALID;

        const cacheKey = createHash('sha256').update(token).digest('hex');
        const cached = verdicts.get(cacheKey);
        if (cached && cached.until > now()) return cached.verdict;

        const result = await checkToken(token, { projectId, getKey, now });
        const verdict = result.id ? Object.freeze({ id: result.id }) : result;
        remember(cacheKey, verdict, Math.min(now() + verdictTtlMs, result.expiresAtMs ?? Infinity));
        return verdict;
    };
};

let defaultVerifier = null;
let defaultProjectId = null;

// The deployment's verifier; without VITE_FIREBASE_PROJECT_ID sign-in is not
// configured and every request is signed out.
export const verifySignIn = async (authorization) => {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
    if (!projectId) return SIGNED_OUT;
    if (defaultProjectId !== projectId) {
        defaultVerifier = createTokenVerifier({ projectId, getKey: createCertificateKeySource() });
        defaultProjectId = projectId;
    }
    return defaultVerifier(authorization);
};
