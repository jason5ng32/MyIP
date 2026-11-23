// Firebase Auth bootstrap — env-gated AND lazy: the SDK chunk only loads on
// the first loadFirebaseAuth() call (signed-in boot, sign-in click, or the
// background auth probe), never on the visitor-critical path.
const env = import.meta.env ?? {};

const isFireBaseSet = !!env.VITE_FIREBASE_API_KEY && !!env.VITE_FIREBASE_AUTH_DOMAIN && !!env.VITE_FIREBASE_PROJECT_ID;

let authModulePromise = null;

// Resolves to the firebase/auth namespace plus the initialized `auth`
// instance (memoized), or null when the env isn't configured.
const loadFirebaseAuth = () => {
    if (!isFireBaseSet) return Promise.resolve(null);
    authModulePromise ??= Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
    ]).then(([appModule, authModule]) => {
        // Defensive check: a failed chunk load rejects the import, so this
        // should not fire; if a module ever arrives without these exports,
        // fail with a readable rejection so the retry path below runs.
        if (!appModule?.initializeApp || !authModule?.getAuth) {
            throw new Error('Firebase modules resolved without expected exports');
        }
        return {
            ...authModule,
            auth: authModule.getAuth(appModule.initializeApp({
                apiKey: env.VITE_FIREBASE_API_KEY,
                authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
                projectId: env.VITE_FIREBASE_PROJECT_ID,
            })),
        };
    }).catch((error) => {
        // Don't memoize a transient chunk-load failure — the next auth
        // action should retry the import instead of replaying the rejection.
        authModulePromise = null;
        throw error;
    });
    return authModulePromise;
};

export { isFireBaseSet, loadFirebaseAuth };
