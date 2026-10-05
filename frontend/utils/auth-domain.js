// Which Firebase auth domain this session signs in through: browsers keep
// the shared default, the installed PWA may use VITE_FIREBASE_PWA_AUTH_DOMAIN
// (why: api/AGENTS.md "Firebase Auth handler proxy").

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

// The domain to initialise Firebase with; a blank PWA value means unset.
export const resolveAuthDomain = ({ runningAsPwa, authDomain, pwaAuthDomain }) => {
    const fallback = clean(authDomain);
    if (!runningAsPwa) return fallback;
    return clean(pwaAuthDomain) || fallback;
};
