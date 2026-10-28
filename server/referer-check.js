// dotenv.config() is called once in backend-server.js before any handler
// imports this module, so process.env.ALLOWED_DOMAINS is already populated.
// Avoid the duplicate call to keep this a pure, fast function.

// The Referer's hostname, or null when it is missing or unparseable —
// scanners send garbage Referer headers, never a thrown 500.
const refererHostname = (referer) => {
    if (!referer) return null;
    try {
        return new URL(referer).hostname;
    } catch {
        return null;
    }
};

function refererCheck(referer) {
    const allowedDomains = ['localhost', ...(process.env.ALLOWED_DOMAINS || '').split(',')];
    const domain = refererHostname(referer);
    return domain !== null && allowedDomains.includes(domain);
}

// Startup diagnostics for ALLOWED_DOMAINS: the entries as matched, plus the
// ones that can never equal a Referer hostname (which URL parsing lowercases
// and strips of scheme, port and path). Empty entries are ignored.
const inspectAllowedDomains = (raw = '') => {
    const domains = raw.split(',').filter((entry) => entry.trim() !== '');
    const problems = domains.flatMap((entry) => {
        if (entry !== entry.trim()) return [{ entry, reason: 'remove the surrounding spaces' }];
        if (entry.includes('://')) return [{ entry, reason: 'drop the scheme (https://)' }];
        if (entry.includes('/')) return [{ entry, reason: 'drop the path' }];
        if (/:\d+$/.test(entry)) return [{ entry, reason: 'drop the port' }];
        if (entry !== entry.toLowerCase()) return [{ entry, reason: 'write it in lowercase' }];
        return [];
    });
    return { domains, problems };
};

export { refererCheck, refererHostname, inspectAllowedDomains };
