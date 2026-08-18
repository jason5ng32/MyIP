// /api/monitoring — first-party relay ("tunnel") for frontend Sentry
// envelopes, so ad/privacy blockers that block *.ingest.sentry.io don't
// silence error reporting. The browser SDK posts envelopes here (see
// `tunnel` in frontend/sentry-init.js); we validate that the envelope is
// addressed to OUR project, stamp the visitor's real IP onto event items
// (see injectUserIp), and forward it. backend-server.js mounts the route
// only when VITE_SENTRY_DSN_FRONTEND is set.
import { fetchUpstream } from '../common/fetch-with-timeout.js';
import { isValidIP } from '../common/valid-ip.js';
import logger from '../common/logger.js';

// The envelope header is the first newline-delimited JSON line and carries
// the DSN the SDK was configured with. Returns a URL or null. Exported for
// tests.
export const parseEnvelopeDsn = (rawBody) => {
    if (!Buffer.isBuffer(rawBody)) return null;
    try {
        const text = rawBody.toString('utf8');
        const newline = text.indexOf('\n');
        const header = JSON.parse(newline === -1 ? text : text.slice(0, newline));
        return header?.dsn ? new URL(header.dsn) : null;
    } catch {
        return null;
    }
};

// Resolves the visitor's real IP from the incoming tunnel request.
export const visitorIpFrom = (headers) => {
    const ip = headers?.['cf-connecting-ip'];
    return isValidIP(ip) ? ip : null;
};

// Envelope item types whose payload is an event-shaped JSON object carrying
// a `user` field. Other items (attachments, replay recordings, sessions…)
// must pass through byte-identical.
const USER_ITEM_TYPES = new Set(['event', 'transaction', 'replay_event', 'feedback']);

// Writes the visitor's IP into event items as `user.ip_address`. The browser
// SDK can't know the visitor's public IP, and once the envelope leaves this
// relay Sentry only sees OUR server's address — Sentry's forwarded-for
// headers are ignored by its SaaS edge (verified empirically), so rewriting
// the envelope is the only reliable path. `ip_address` is always overwritten (the SDK can
// only ever hold a worse guess); other `user` fields are preserved. Any
// parse trouble returns the body unchanged: losing an IP is acceptable,
// losing the event is not. Exported for tests.
export const injectUserIp = (rawBody, ip) => {
    if (!Buffer.isBuffer(rawBody)) return rawBody;
    const NL = 0x0a;
    try {
        const headerEnd = rawBody.indexOf(NL);
        if (headerEnd === -1) return rawBody;
        const out = [rawBody.subarray(0, headerEnd + 1)];
        let pos = headerEnd + 1;
        while (pos < rawBody.length) {
            const headerNl = rawBody.indexOf(NL, pos);
            if (headerNl === -1) {
                out.push(rawBody.subarray(pos));
                break;
            }
            const headerBytes = rawBody.subarray(pos, headerNl);
            const itemHeader = JSON.parse(headerBytes.toString('utf8'));
            const payloadStart = headerNl + 1;
            // With an explicit `length` the payload is that many bytes (and
            // may contain newlines); without one it runs to the next newline.
            const payloadEnd = typeof itemHeader.length === 'number'
                ? Math.min(payloadStart + itemHeader.length, rawBody.length)
                : (() => {
                    const nl = rawBody.indexOf(NL, payloadStart);
                    return nl === -1 ? rawBody.length : nl;
                })();
            const payloadBytes = rawBody.subarray(payloadStart, payloadEnd);
            if (USER_ITEM_TYPES.has(itemHeader.type)) {
                const payload = JSON.parse(payloadBytes.toString('utf8'));
                payload.user = { ...payload.user, ip_address: ip };
                const newPayload = Buffer.from(JSON.stringify(payload));
                if (typeof itemHeader.length === 'number') {
                    itemHeader.length = newPayload.length;
                }
                out.push(Buffer.from(JSON.stringify(itemHeader)), Buffer.from('\n'), newPayload);
            } else {
                out.push(headerBytes, Buffer.from('\n'), payloadBytes);
            }
            pos = payloadEnd;
            if (rawBody[pos] === NL) {
                out.push(Buffer.from('\n'));
                pos += 1;
            }
        }
        return Buffer.concat(out);
    } catch {
        return rawBody;
    }
};

export default async (req, res) => {
    // Defensive method gate (route already POST-only) — covered by tests.
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Only the DSN this deployment was built with may be relayed — anything
    // else would make us an open proxy to arbitrary Sentry accounts.
    const allowedDsn = process.env.VITE_SENTRY_DSN_FRONTEND;
    if (!allowedDsn) {
        return res.status(404).json({ error: 'Tunnel not configured' });
    }

    // express.raw always yields a Buffer here, but guard anyway so a
    // misconfigured parser (string / array body) can't reach the byte-level
    // envelope walk below.
    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody)) {
        return res.status(400).json({ error: 'Invalid envelope' });
    }

    const dsn = parseEnvelopeDsn(rawBody);
    if (!dsn) {
        return res.status(400).json({ error: 'Invalid envelope' });
    }
    if (dsn.href !== new URL(allowedDsn).href) {
        return res.status(403).json({ error: 'DSN not allowed' });
    }

    const visitorIp = visitorIpFrom(req.headers);

    const body = visitorIp ? injectUserIp(rawBody, visitorIp) : rawBody;

    try {
        const projectId = dsn.pathname.replace(/^\//, '');
        const upstream = `https://${dsn.host}/api/${projectId}/envelope/`;
        const apiRes = await fetchUpstream(upstream, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-sentry-envelope' },
            body,
        });
        const relayed = await apiRes.text();
        if (!apiRes.ok) {
            // Ingest refuses an envelope for reasons the browser can do
            // nothing about — most often size, since replay recordings travel
            // uncompressed here. Without this line the rejection is visible
            // only in the visitor's devtools.
            logger.warn({
                statusCode: apiRes.status,
                envelopeBytes: body.length,
                bodyPreview: relayed.slice(0, 200),
            }, 'sentry tunnel upstream rejected the envelope');
        }
        res.status(apiRes.status).send(relayed);
    } catch (error) {
        // warn, not error: a transient relay failure is infra noise, not an
        // application defect worth a grouped Issue of its own.
        logger.warn({ err: error }, 'sentry tunnel forward failed');
        res.status(502).json({ error: 'Relay failed' });
    }
};
