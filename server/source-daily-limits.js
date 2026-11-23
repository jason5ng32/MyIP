// A daily ceiling on successful answers per IP-geolocation source, set by IP_SOURCE_DAILY_LIMITS.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import writeFileAtomic from 'write-file-atomic';
import logger from './logger.js';

// `code` of the 429 a source answers once its day is used up.
export const SOURCE_DAILY_LIMIT_CODE = 'source_daily_limit';

export const STATE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)),
    '../common/source-limits-db/daily-counts.json');

const SAVE_DELAY_MS = 5000;
const PAIR = /^([a-z0-9]+)\s*=\s*(\d+)$/i;

// `key=number` pairs, comma-separated, `key` one of `keys` (the geo routes'
// last path segment); 0 drops the key (unlimited).
// Returns the limits and the raw items it ignored.
export const parseSourceDailyLimits = (value, keys) => {
    const limits = {};
    const ignored = [];
    const seen = new Set();
    for (const raw of String(value ?? '').split(',')) {
        const item = raw.trim();
        if (!item) continue;
        const match = PAIR.exec(item);
        const key = match?.[1].toLowerCase();
        const limit = match ? Number(match[2]) : NaN;
        if (!match || !keys.includes(key) || seen.has(key) || !Number.isSafeInteger(limit)) {
            ignored.push(item);
            continue;
        }
        seen.add(key);
        if (limit > 0) limits[key] = limit;
    }
    return { limits, ignored };
};

const pad = (n) => String(n).padStart(2, '0');

// The server's local calendar day, `YYYY-MM-DD`.
export const localDayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Today's counts of `keys` from a stored state; null for another day or a bad shape.
export const restoreCounts = (state, day, keys) => {
    if (!state || typeof state !== 'object' || state.day !== day) return null;
    const { counts } = state;
    if (!counts || typeof counts !== 'object' || Array.isArray(counts)) return null;
    const entries = Object.entries(counts);
    if (!entries.every(([, n]) => Number.isSafeInteger(n) && n >= 0)) return null;
    return Object.fromEntries(entries.filter(([key]) => keys.includes(key)));
};

// Per-day counters with reserve / release. `load()` returns the stored state
// (or throws), `save(state)` persists it (may reject); both are optional.
// `keys` are the sources a stored state restores (default: the limited ones).
export const createDailyCounter = ({
    limits, keys = Object.keys(limits), now = () => new Date(), load, save, saveDelayMs = SAVE_DELAY_MS, onCeiling, onLoadError, onSaveError,
}) => {
    let day = localDayKey(now());
    let counts = {};
    let refused = new Set();
    let timer = null;
    let saveFailed = false;

    if (load) {
        try {
            counts = restoreCounts(load(), day, keys) ?? {};
        } catch (error) {
            if (error?.code !== 'ENOENT') onLoadError?.(error);
        }
    }

    const roll = () => {
        const today = localDayKey(now());
        if (today === day) return;
        day = today;
        counts = {};
        refused = new Set();
    };

    const flush = async () => {
        if (timer) clearTimeout(timer);
        timer = null;
        if (!save) return;
        try {
            await save({ day, counts: { ...counts } });
        } catch (error) {
            if (!saveFailed) onSaveError?.(error);
            saveFailed = true;
        }
    };

    const scheduleSave = () => {
        if (!save || timer) return;
        timer = setTimeout(flush, saveDelayMs);
        timer.unref?.();
    };

    // Admits a request: `{ ok: true, day }` holds a slot of that day.
    const reserve = (key) => {
        roll();
        const limit = limits[key];
        if (!limit) return { ok: true, day: null };
        const used = counts[key] ?? 0;
        if (used >= limit) {
            if (!refused.has(key)) {
                refused.add(key);
                onCeiling?.(key, limit);
                flush();
            }
            return { ok: false };
        }
        counts[key] = used + 1;
        scheduleSave();
        return { ok: true, day };
    };

    // Returns a slot; one reserved on an earlier day is already gone.
    const release = (key, reservedDay) => {
        roll();
        if (reservedDay !== day || !counts[key]) return;
        counts[key] -= 1;
        scheduleSave();
    };

    const count = (key) => {
        roll();
        return counts[key] ?? 0;
    };

    return { reserve, release, flush, count, limitOf: (key) => limits[key] ?? 0 };
};

const passThrough = (req, res, next) => next();

// 429 once the source's day is used up; otherwise holds a slot that an error
// status or an aborted connection gives back, once.
export const sourceDailyLimitMiddleware = (counter, key) => {
    if (!counter?.limitOf(key)) return passThrough;
    return (req, res, next) => {
        const slot = counter.reserve(key);
        if (!slot.ok) {
            return res.status(429).json({ error: 'Daily limit reached for this source', code: SOURCE_DAILY_LIMIT_CODE });
        }
        let settled = false;
        const settle = () => {
            if (settled) return;
            settled = true;
            if (!res.writableFinished || res.statusCode >= 400) counter.release(key, slot.day);
        };
        res.once('finish', settle);
        res.once('close', settle);
        next();
    };
};

const readStateFile = () => JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

const writeStateFile = async (state) => {
    await fs.promises.mkdir(path.dirname(STATE_FILE), { recursive: true });
    await writeFileAtomic(STATE_FILE, `${JSON.stringify(state)}\n`);
};

let active = null;
let knownKeys = null;

// Takes the geo routes' keys and reads the env value, once; logs the active
// limits and ignored pairs.
export const initSourceDailyLimits = (keys, value = process.env.IP_SOURCE_DAILY_LIMITS) => {
    if (active) return active;
    knownKeys = [...keys];
    const { limits, ignored } = parseSourceDailyLimits(value, knownKeys);
    if (ignored.length) {
        logger.warn(`⚠️  IP_SOURCE_DAILY_LIMITS ignores ${ignored.map((item) => `"${item}"`).join(', ')}: `
            + `expected <source>=<whole number>, source one of ${knownKeys.join(', ')}`);
    }
    const limited = Object.keys(limits);
    if (!limited.length) {
        active = { limitOf: () => 0 };
        return active;
    }
    logger.info(`🛡️  IP source daily limits (per process, server-local day): ${limited.map((k) => `${k}=${limits[k]}`).join(', ')}`);
    active = createDailyCounter({
        limits,
        keys: knownKeys,
        load: readStateFile,
        save: writeStateFile,
        onCeiling: (source, limit) => logger.warn({ source, limit },
            `IP source "${source}" reached its daily limit of ${limit}; it answers 429 until the server's local day ends`),
        onLoadError: (err) => logger.warn({ err, file: STATE_FILE },
            '⚠️  IP source daily counts could not be read; counting from zero'),
        onSaveError: (err) => logger.warn({ err, file: STATE_FILE },
            'IP source daily counts could not be saved; counting in memory only'),
    });
    return active;
};

// The route middleware for one source, over the process-wide counters.
export const sourceDailyLimit = (key) => {
    if (!active) throw new Error('sourceDailyLimit() called before initSourceDailyLimits()');
    if (!knownKeys.includes(key)) throw new Error(`Unknown IP source key: ${key}`);
    return sourceDailyLimitMiddleware(active, key);
};
