// Firebase Auth bootstrap — env-gated AND lazy: the SDK chunk only loads on
// the first loadFirebaseAuth() call (signed-in boot, sign-in click, or the
// background auth probe), never on the visitor-critical path.
const env = import.meta.env ?? {};
const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
};

const isFireBaseSet = !!firebaseConfig.apiKey && !!firebaseConfig.authDomain && !!firebaseConfig.projectId;

let authModulePromise = null;

// Resolves to the firebase/auth namespace plus the initialized `auth`
// instance (memoized), or null when the env isn't configured.
const loadFirebaseAuth = () => {
    if (!isFireBaseSet) return Promise.resolve(null);
    authModulePromise ??= Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
    ]).then(([appModule, authModule]) => {
        // Hostile client environments (extensions, filtered networks) can
        // resolve a dynamic import to undefined instead of rejecting —
        // convert that to a readable rejection so the retry path below runs.
        if (!appModule?.initializeApp || !authModule?.getAuth) {
            throw new Error('Firebase modules resolved without expected exports');
        }
        return {
            ...authModule,
            auth: authModule.getAuth(appModule.initializeApp(firebaseConfig)),
        };
    }).catch((error) => {
        // Don't memoize a transient chunk-load failure — the next auth
        // action should retry the import instead of replaying the rejection.
        authModulePromise = null;
        throw error;
    });
    return authModulePromise;
};

export { loadFirebaseAuth };
