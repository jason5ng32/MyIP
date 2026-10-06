// Firebase Auth handler proxy: `/__/auth/*` on the site's own origin →
// `<projectId>.firebaseapp.com`, mounted by frontend-server.js (production)
// and vite.config.js (dev). Why: api/AGENTS.md "Firebase Auth handler proxy".

export const FIREBASE_AUTH_PROXY_PATH = '/__/auth';

// null without a project id: no Firebase, no proxy.
export const firebaseAuthProxyTarget = (projectId) => {
    const id = typeof projectId === 'string' ? projectId.trim() : '';
    return id ? `https://${id}.firebaseapp.com` : null;
};
