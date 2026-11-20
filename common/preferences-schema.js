// The synced preferences contract both halves read: the schema version, the synced keys and each key's value check, plus the Connectivity lists model's checks.

// The preferences schema version; the front end's storage key carries it as its suffix.
export const PREFERENCES_VERSION = 7;

// Option lists the Preferences panel offers.
export const IP_CARDS_OPTIONS = Object.freeze([2, 4, 6]);
export const SNAPSHOTS_KEEP_LAST_OPTIONS = Object.freeze([10, 50, 100]);
export const SNAPSHOTS_AUTO_MODES = Object.freeze(['smart', 'every', 'off']);
export const THEME_OPTIONS = Object.freeze(['auto', 'light', 'dark']);

// The `connectivityLists` model: its version and caps (mirrored in frontend/data/connectivity-defaults.js).
export const CONNECTIVITY_LISTS_SCHEMA_VERSION = 1;
export const CONNECTIVITY_TARGET_LIMIT = 60;
export const CONNECTIVITY_LIST_LIMIT = 10;
export const CONNECTIVITY_LIST_NAME_LIMIT = 40;
const MINE_LIST_ID = 'mine';

// String bounds for stored list and member fields.
const ID_MAX = 64;
const MEMBER_NAME_MAX = 100;
const URL_MAX = 2048;
const FAVICON_PATTERN = /^\/favicons\/[A-Za-z0-9._-]{1,64}\.png$/;

// Source ids are small integers; the bound only rejects nonsense.
const IP_GEO_SOURCE_MAX = 64;
const LANG_PATTERN = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const LANG_MAX = 35;

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isBoundedString = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;
const hasOnlyKeys = (object, allowed) => Object.keys(object).every((key) => allowed.includes(key));

const isHttpUrl = (value) => {
    if (!isBoundedString(value, URL_MAX)) return false;
    try {
        const { protocol } = new URL(value);
        return protocol === 'http:' || protocol === 'https:';
    } catch {
        return false;
    }
};

const MEMBER_KEYS = Object.freeze(['id', 'name', 'url', 'siteUrl', 'favicon']);

// A stored member: { id, name, url, siteUrl?, favicon? }, nothing else.
const isValidMember = (member) => isPlainObject(member)
    && hasOnlyKeys(member, MEMBER_KEYS)
    && isBoundedString(member.id, ID_MAX)
    && isBoundedString(member.name, MEMBER_NAME_MAX)
    && isHttpUrl(member.url)
    && (!('siteUrl' in member) || isHttpUrl(member.siteUrl))
    && (!('favicon' in member) || (typeof member.favicon === 'string' && FAVICON_PATTERN.test(member.favicon)));

const LIST_KEYS = Object.freeze(['id', 'name', 'members']);

// A list: { id, name, members }; Mine's name is null, any other's a bounded non-empty string.
const isValidList = (list) => isPlainObject(list)
    && hasOnlyKeys(list, LIST_KEYS)
    && isBoundedString(list.id, ID_MAX)
    && (list.id === MINE_LIST_ID
        ? list.name === null
        : isBoundedString(list.name, CONNECTIVITY_LIST_NAME_LIMIT) && list.name.trim().length > 0)
    && Array.isArray(list.members)
    && list.members.length <= CONNECTIVITY_TARGET_LIMIT
    && list.members.every(isValidMember);

// The whole `connectivityLists` model: versioned, at most CONNECTIVITY_LIST_LIMIT lists with distinct ids.
export const isValidConnectivityLists = (value) => isPlainObject(value)
    && hasOnlyKeys(value, ['schemaVersion', 'lists'])
    && value.schemaVersion === CONNECTIVITY_LISTS_SCHEMA_VERSION
    && Array.isArray(value.lists)
    && value.lists.length <= CONNECTIVITY_LIST_LIMIT
    && value.lists.every(isValidList)
    && new Set(value.lists.map((list) => list.id)).size === value.lists.length;

// A `connectivityDefaultListId`: any bounded non-empty id.
export const isValidConnectivityListId = (value) => isBoundedString(value, ID_MAX);

const isBoolean = (value) => typeof value === 'boolean';
const oneOf = (options) => (value) => options.includes(value);

// One check per synced key.
const VALIDATORS = Object.freeze({
    theme: oneOf(THEME_OPTIONS),
    lang: (value) => value === 'auto' || (typeof value === 'string' && value.length <= LANG_MAX && LANG_PATTERN.test(value)),
    connectivityMultipleTests: isBoolean,
    connectivityDiscardFirstResult: isBoolean,
    simpleMode: isBoolean,
    autoRunConnectivity: isBoolean,
    autoRunWebRTC: isBoolean,
    autoRunDnsLeak: isBoolean,
    popupConnectivityNotifications: isBoolean,
    snapshotsNotify: isBoolean,
    connectivityCardTitleOpensSite: isBoolean,
    ipCardsToShow: oneOf(IP_CARDS_OPTIONS),
    ipGeoSource: (value) => Number.isInteger(value) && value >= 0 && value < IP_GEO_SOURCE_MAX,
    snapshotsAuto: oneOf(SNAPSHOTS_AUTO_MODES),
    snapshotsLabelCard: (value) => Number.isInteger(value) && value >= 1 && value <= Math.max(...IP_CARDS_OPTIONS),
    snapshotsKeepLast: oneOf(SNAPSHOTS_KEEP_LAST_OPTIONS),
});

export const SYNCED_PREFERENCE_KEYS = Object.freeze(Object.keys(VALIDATORS));

export const isSyncedPreferenceKey = (key) => Object.hasOwn(VALIDATORS, key);

// True when `value` is an accepted value of the synced preference `key`.
export const isValidPreferenceValue = (key, value) => isSyncedPreferenceKey(key) && VALIDATORS[key](value);
