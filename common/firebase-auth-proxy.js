// Firebase Auth handler proxy target.
//
// Firebase's redirect sign-in runs its handler page (`/__/auth/handler`, plus
// the `iframe` / `*.js` files it loads) on `authDomain`. Serving those paths
// from the site's own origin — a reverse proxy to the project's
// `<projectId>.firebaseapp.com` host — keeps the handler first-party, so the
// sign-in result lands in the same storage the app reads it back from (the
// installed iOS PWA and Safari's storage partitioning otherwise lose it).
// Mounted by frontend-server.js (production) and vite.config.js (dev).

export const FIREBASE_AUTH_PROXY_PATH = '/__/auth';

// Origin the proxy forwards to, or null when no project is configured
// (no Firebase → no proxy).
export const firebaseAuthProxyTarget = (projectId) => {
    const id = typeof projectId === 'string' ? projectId.trim() : '';
    return id ? `https://${id}.firebaseapp.com` : null;
};
