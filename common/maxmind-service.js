import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import maxmind from 'maxmind';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const MAXMIND_DB_DIR = path.resolve(__dirname, './maxmind-db');
export const MAXMIND_CITY_DB = 'GeoLite2-City.mmdb';
export const MAXMIND_ASN_DB = 'GeoLite2-ASN.mmdb';

const cityDbPath = path.join(MAXMIND_DB_DIR, MAXMIND_CITY_DB);
const asnDbPath = path.join(MAXMIND_DB_DIR, MAXMIND_ASN_DB);

let cityLookup = null;
let asnLookup = null;
let reloadPromise = null;
let watchersStarted = false;
let reloadDebounceTimer = null;

/**
 * Return the canonical MaxMind database paths used by the backend and updater.
 */
export function getMaxMindDbPaths() {
    return {
        dbDir: MAXMIND_DB_DIR,
        cityDbPath,
        asnDbPath,
    };
}

/**
 * Report whether both City and ASN readers are ready to serve lookups.
 */
export function isMaxMindReady() {
    return Boolean(cityLookup && asnLookup);
}

/**
 * Open fresh MaxMind readers from the provided database paths.
 */
export async function openMaxMindReaders(dbPaths = getMaxMindDbPaths()) {
    const [city, asn] = await Promise.all([
        maxmind.open(dbPaths.cityDbPath),
        maxmind.open(dbPaths.asnDbPath),
    ]);

    return { city, asn };
}

/**
 * Replace the active MaxMind readers after both databases are opened successfully.
 */
export async function reloadMaxMindDatabases(reason = 'manual') {
    if (reloadPromise) {
        return reloadPromise;
    }

    reloadPromise = openMaxMindReaders()
        .then(({ city, asn }) => {
            cityLookup = city;
            asnLookup = asn;
            logger.info(`📦 MaxMind databases loaded (${reason})`);
            return true;
        })
        .catch(error => {
            logger.error({ err: error, reason }, 'Failed to load MaxMind databases');
            throw error;
        })
        .finally(() => {
            reloadPromise = null;
        });

    return reloadPromise;
}

/**
 * Watch database files and reload readers when another process publishes new files.
 */
export function startMaxMindFileWatcher() {
    if (watchersStarted) {
        return;
    }

    watchersStarted = true;

    // Debounce file events so City and ASN replacements are handled as one reload.
    const scheduleReload = () => {
        clearTimeout(reloadDebounceTimer);
        reloadDebounceTimer = setTimeout(() => {
            reloadMaxMindDatabases('file change').catch(() => {
                // Keep the existing readers when a newly written database is invalid.
            });
        }, 1000);
        reloadDebounceTimer.unref?.();
    };

    for (const filePath of [cityDbPath, asnDbPath]) {
        fs.watchFile(filePath, { interval: 5000, persistent: false }, (current, previous) => {
            if (current.mtimeMs !== previous.mtimeMs || current.size !== previous.size) {
                scheduleReload();
            }
        });
    }
}

/**
 * Look up an IP address and return the API response shape expected by the frontend.
 */
export function lookupMaxMind(ip, lang = 'en') {
    if (!isMaxMindReady()) {
        const error = new Error('MaxMind database is not ready');
        error.statusCode = 503;
        throw error;
    }

    const city = cityLookup.get(ip);
    const asn = asnLookup.get(ip);

    return formatMaxMindResult(ip, lang, city, asn);
}

/**
 * Pick the requested localized name with English and N/A fallbacks.
 */
function getLocalizedName(names, lang) {
    if (!names) {
        return 'N/A';
    }

    return names[lang] || names.en || 'N/A';
}

/**
 * Normalize MaxMind City and ASN records into this API's stable JSON format.
 */
function formatMaxMindResult(ip, lang, city, asn) {
    city = city || {};
    asn = asn || {};

    return {
        ip,
        city: city.city ? getLocalizedName(city.city.names, lang) : 'N/A',
        region: city.subdivisions?.[0] ? getLocalizedName(city.subdivisions[0].names, lang) : 'N/A',
        country: city.country ? city.country.iso_code : 'N/A',
        country_name: city.country ? getLocalizedName(city.country.names, lang) : 'N/A',
        country_code: city.country ? city.country.iso_code : 'N/A',
        latitude: city.location ? city.location.latitude : 'N/A',
        longitude: city.location ? city.location.longitude : 'N/A',
        asn: asn.autonomous_system_number ? `AS${asn.autonomous_system_number}` : 'N/A',
        org: asn.autonomous_system_organization ? asn.autonomous_system_organization : 'N/A',
    };
}
