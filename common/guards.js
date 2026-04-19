// Express middleware that factors out the boilerplate every api/ handler
// used to repeat at the top of its function body: referer check, IP presence
// check, IP validity check. Mount once in backend-server.js; handlers stop
// carrying the defensive checks and can't accidentally forget them.

import { refererCheck } from './referer-check.js';
import { isValidIP } from './valid-ip.js';

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
