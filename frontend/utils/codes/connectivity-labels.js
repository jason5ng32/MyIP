// Connectivity status code → the section's own i18n key, for every view of a
// recorded status (report page, Snapshots diff).
export const CONNECTIVITY_STATUS_KEYS = Object.freeze({
    ok: 'connectivity.StatusAvailable',
    unreachable: 'connectivity.StatusUnavailable',
    timeout: 'connectivity.StatusTimeout',
});
