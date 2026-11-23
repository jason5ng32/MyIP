// The account-sync commands app code awaits without importing the composable: the popup sign-in's step before its
// reload, the sign-out's flush-then-clear, and saving the account's choice of what syncs.
import { dispatchAppCommand } from '../app-commands.js';

// All owned by composables/use-account-sync.js.
export const BEFORE_RELOAD_COMMAND = 'account-sync:before-reload'; // `{ userId }`
export const SIGN_OUT_COMMAND = 'account-sync:sign-out'; // `{ userId }`
export const SET_SYNC_COLLECTIONS_COMMAND = 'account-sync:set-collections'; // `{ collections }`
export const SIGN_IN_SYNC_TIMEOUT_MS = 3000;
// The owner's flush is bounded at SIGN_OUT_FLUSH_MS; this caps the whole step.
export const SIGN_OUT_FLUSH_MS = 3000;
export const SIGN_OUT_TIMEOUT_MS = 5000;
export const SET_SYNC_COLLECTIONS_TIMEOUT_MS = 10000;

// The account's settings fetched and its enabled collections pulled → true; false on a timeout, an error or no
// owner; never rejects.
export const syncBeforeReload = (userId, {
    dispatch = dispatchAppCommand, timeoutMs = SIGN_IN_SYNC_TIMEOUT_MS,
} = {}) => dispatch(BEFORE_RELOAD_COMMAND, { userId }, { timeoutMs })
    .then((result) => result === true, () => false);

// Resolves with the number of collections cleared off this device (0 on a timeout, an error or no owner); never rejects.
export const clearAccountDataBeforeSignOut = (userId, {
    dispatch = dispatchAppCommand, timeoutMs = SIGN_OUT_TIMEOUT_MS,
} = {}) => dispatch(SIGN_OUT_COMMAND, { userId }, { timeoutMs })
    .then((cleared) => (Number.isInteger(cleared) ? cleared : 0), () => 0);

// The account's new choice saved → true; false otherwise; never rejects.
export const saveSyncCollections = (collections, {
    dispatch = dispatchAppCommand, timeoutMs = SET_SYNC_COLLECTIONS_TIMEOUT_MS,
} = {}) => dispatch(SET_SYNC_COLLECTIONS_COMMAND, { collections }, { timeoutMs })
    .then((result) => result === true, () => false);
