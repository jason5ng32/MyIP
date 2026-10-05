// Which Firebase auth domain this session signs in through, and which
// providers that leaves usable.
// The default domain (VITE_FIREBASE_AUTH_DOMAIN) is a login host shared with
// other services, so browsers keep it. The installed PWA needs the auth
// handler on the site's own origin (served by the /__/auth proxy) for the
// redirect result to survive, so it may use VITE_FIREBASE_PWA_AUTH_DOMAIN
// instead. GitHub's OAuth App allows a single callback URL, on the default
// domain — a PWA on a different domain can only offer Google.

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
