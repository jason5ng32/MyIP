// Which Firebase auth domain this session signs in through, and which
// providers that leaves: browsers keep the shared default, the installed PWA
// may use VITE_FIREBASE_PWA_AUTH_DOMAIN (why: api/AGENTS.md "Firebase Auth
// handler proxy"). GitHub's single callback URL is on the default domain, so a
// PWA on another domain offers only Google.

const ALL_PROVIDERS = ['google', 'github'];
const DEFAULT_DOMAIN_ONLY = new Set(['github']);

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

// The domain to initialise Firebase with; a blank PWA value means unset.
export const resolveAuthDomain = ({ runningAsPwa, authDomain, pwaAuthDomain }) => {
    const fallback = clean(authDomain);
    if (!runningAsPwa) return fallback;
    return clean(pwaAuthDomain) || fallback;
};

// Sign-in provider keys (store.js SIGN_IN_PROVIDERS) usable on that domain.
export const signInProvidersFor = (inputs) => {
    const domain = resolveAuthDomain(inputs);
    if (domain === clean(inputs.authDomain)) return [...ALL_PROVIDERS];
    return ALL_PROVIDERS.filter((key) => !DEFAULT_DOMAIN_ONLY.has(key));
};
