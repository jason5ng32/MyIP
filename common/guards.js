// Express middleware that factors out the boilerplate every api/ handler
// used to repeat at the top of its function body: referer check, IP presence
// check, IP validity check. Mount once in backend-server.js; handlers stop
// carrying the defensive checks and can't accidentally forget them.

import { refererCheck } from './referer-check.js';
import { isValidIP } from './valid-ip.js';
import { isValidBgpPrefix } from './bgp-prefix.js';

// Reject requests without an allowed referer. The error message variant
// preserves the existing user-facing wording.
export const requireReferer = (req, res, next) => {
    const referer = req.headers.referer;
    if (!refererCheck(referer)) {
        return res.status(403).json({
            error: referer ? 'Access denied' : 'What are you doing?',
        });
    }
    next();
};

// Reject requests without a valid IP in the specified query param.
// Factory so handlers that use a non-default param name (none today, but
// leaving the door open) can say `requireValidIP('query')` etc.
export const requireValidIP = (paramName = 'ip') => (req, res, next) => {
    const ip = req.query[paramName];
    if (!ip) {
        return res.status(400).json({ error: 'No IP address provided' });
    }
    if (!isValidIP(ip)) {
        return res.status(400).json({ error: 'Invalid IP address' });
    }
    next();
};

// Reject requests without a valid CIDR prefix in the specified query param.
// Accepts any well-formed CIDR — the quantization policy (e.g. /24 for v4,
// /48 for v6) is the frontend's job, not the guard's.
export const requireValidPrefix = (paramName = 'prefix') => (req, res, next) => {
    const prefix = req.query[paramName];
    if (!prefix) {
        return res.status(400).json({ error: 'No prefix provided' });
    }
    if (!isValidBgpPrefix(prefix)) {
        return res.status(400).json({ error: 'Invalid prefix' });
    }
    next();
};

// Reject requests without a valid ASN (numeric, with optional 'AS' prefix).
// Used by /api/asn-connectivity; other ASN-taking handlers (cf-radar) still
// validate inline for historical reasons.
export const requireValidASN = (paramName = 'asn') => (req, res, next) => {
    const raw = req.query[paramName];
    if (!raw) {
        return res.status(400).json({ error: 'No ASN provided' });
    }
    const numeric = String(raw).replace(/^AS/i, '');
    if (!/^[0-9]+$/.test(numeric)) {
        return res.status(400).json({ error: 'Invalid ASN' });
    }
    req.query[paramName] = numeric;
    next();
};
