// The account's sync settings (which collections sync, and whether the user has decided): their state, this device's
// cache of them, the choice the dialog and Preferences send, and the one-time dialog's show rule.
import { SYNC_COLLECTION_IDS } from '../sync-collections.js';

// `{ user, decided, collections }` of the last answer, so a later load can start before the fetch returns.
export const SYNC_SETTINGS_CACHE_KEY = 'accountSyncSettings';

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

// status: 'unknown' (nothing yet) | 'cached' (this device's copy) | 'fresh' (the server's answer this page load).
export const createSyncSettings = () => ({ user: null, status: 'unknown', decided: false, collections: [] });

// Registry ids only, in registry order.
const cleanCollections = (ids) => SYNC_COLLECTION_IDS.filter((id) => Array.isArray(ids) && ids.includes(id));

// A GET / PUT /api/sync answer → `{ decided, collections }`, or null when its shape is off.
export const readSyncSettingsAnswer = (answer) => {
    if (!isPlainObject(answer) || typeof answer.decided !== 'boolean' || !Array.isArray(answer.collections)) return null;
    return { decided: answer.decided, collections: cleanCollections(answer.collections) };
};

export const readCachedSyncSettings = (storage, userId) => {
    try {
        const cached = JSON.parse(storage?.getItem(SYNC_SETTINGS_CACHE_KEY) ?? 'null');
        const answer = readSyncSettingsAnswer(cached);
        if (!answer || !userId || cached.user !== userId) return null;
        return { user: userId, status: 'cached', ...answer };
    } catch {
        return null;
    }
};

export const writeCachedSyncSettings = (storage, { user, decided, collections }) => {
    try {
        storage?.setItem(SYNC_SETTINGS_CACHE_KEY, JSON.stringify({ user, decided, collections }));
    } catch { /* storage full or blocked: the next load fetches first */ }
};

export const clearCachedSyncSettings = (storage) => {
    try {
        storage?.removeItem(SYNC_SETTINGS_CACHE_KEY);
    } catch { /* blocked: nothing to clear */ }
};

// Whether `id` syncs for `userId`: 'on' | 'off', or 'unknown' while the settings are not this user's.
export const collectionSyncState = (settings, userId, id) => {
    if (!userId || settings?.user !== userId || settings.status === 'unknown') return 'unknown';
    return settings.collections.includes(id) ? 'on' : 'off';
};

// The sync controls' state: `{ master, <collection id>: boolean }`. Every collection starts on, for the next Enable.
export const defaultSyncChoice = () => ({ master: false, ...Object.fromEntries(SYNC_COLLECTION_IDS.map((id) => [id, true])) });

// The account's enabled collections → the controls' state; none enabled shows the default.
export const syncChoiceOf = (collections) => (collections?.length
    ? { master: true, ...Object.fromEntries(SYNC_COLLECTION_IDS.map((id) => [id, collections.includes(id)])) }
    : defaultSyncChoice());

// The dialog's and the panel's switches → the list PUT /api/sync takes: nothing while the master is off.
export const chosenCollections = (choice) => (choice?.master
    ? SYNC_COLLECTION_IDS.filter((id) => choice[id])
    : []);

// One switch or checkbox of the sync controls → the next choice: the master on turns every collection on;
// unchecking the last one turns the master off.
export const applySyncToggle = (choice, field, value) => {
    if (field === 'master') return value ? { ...defaultSyncChoice(), master: true } : { ...choice, master: false };
    const next = { ...choice, [field]: Boolean(value) };
    return SYNC_COLLECTION_IDS.some((id) => next[id]) ? next : { ...next, master: false };
};

/**
 * The one-time dialog: signed in with sync available, the settings fetched from the server this page load and still
 * undecided, Home's tests done or off Home, nothing else on screen (no other overlay, no sign-in or sign-out under
 * way), and not shown yet this page load.
 */
export const shouldShowSyncDialog = ({
    available, userId, settings, allHasLoaded, offHome, overlayOpen, authPending, shown,
}) => Boolean(available && userId && settings?.user === userId && settings.status === 'fresh'
    && settings.decided === false && (allHasLoaded || offHome) && !overlayOpen && !authPending && !shown);
