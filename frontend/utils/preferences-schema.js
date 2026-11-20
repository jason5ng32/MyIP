// Re-export of common/preferences-schema.js, the synced preferences contract shared with the backend.
export {
    PREFERENCES_VERSION, SYNCED_PREFERENCE_KEYS, isSyncedPreferenceKey, isValidPreferenceValue,
    IP_CARDS_OPTIONS, SNAPSHOTS_KEEP_LAST_OPTIONS, SNAPSHOTS_AUTO_MODES, THEME_OPTIONS,
    isValidConnectivityLists, isValidConnectivityListId,
    CONNECTIVITY_LISTS_SCHEMA_VERSION, CONNECTIVITY_TARGET_LIMIT, CONNECTIVITY_LIST_LIMIT, CONNECTIVITY_LIST_NAME_LIMIT,
} from '../../common/preferences-schema.js';
