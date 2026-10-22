// Sign-in hint: a synchronously readable localStorage flag that lets boot
// decide whether Firebase Auth is worth loading before first render.
// '1' = signed in last we knew · '0' = known signed-out · null = unknown
// (first visit since the flag shipped, or storage cleared/disabled).
const AUTH_HINT_KEY = 'authHint';

export const readAuthHint = () => {
    try {
        const value = localStorage.getItem(AUTH_HINT_KEY);
        return value === '1' || value === '0' ? value : null;
    } catch {
        return null;
    }
};

export const writeAuthHint = (signedIn) => {
    try {
        localStorage.setItem(AUTH_HINT_KEY, signedIn ? '1' : '0');
    } catch {
        /* storage disabled — every boot stays on the unknown path */
    }
};

// Last account id signed in on this browser.
const ACCOUNT_ID_KEY = 'lastAccountId';
const ACCOUNT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export const readAccountId = () => {
    try {
        const value = localStorage.getItem(ACCOUNT_ID_KEY);
        return value && ACCOUNT_ID_PATTERN.test(value) ? value : null;
    } catch {
        return null;
    }
};

export const rememberAccountId = (uid) => {
    if (typeof uid !== 'string' || !ACCOUNT_ID_PATTERN.test(uid)) return;
    try {
        localStorage.setItem(ACCOUNT_ID_KEY, uid);
    } catch {
        /* storage disabled — Firebase errors just go without an account id */
    }
};
