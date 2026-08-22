// The hard gate for translations: what a locale pack may and may not do.
// Every rule is expressed against en, the reference pack — a translation may
// lag behind it, never contradict it.
//
// Packs are skeletons: a main pack has exactly en's keys, and an untranslated
// string is "" rather than a missing key, so a review diff reads `"" → text`
// and nothing can hide between "not translated yet" and "forgot". `pnpm
// i18n-new` writes the skeleton, `pnpm i18n-sync` keeps it aligned, and
// vite.config.js strips the empties on the way into the bundle.
//
// The main pack is the one that ships half-done: beta locales may leave any
// value "". The two optional files are all-or-nothing — they render as a
// whole, so a beta locale either finishes one or leaves it out, and a full
// locale ships all three. Coverage progress is not a failure: run
// `pnpm i18n-status` to see how far along a language is.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';

import {
    LOCALE_CODES,
    FULL_LOCALE_CODES,
    FALLBACK_LOCALE,
} from '../common/locale-registry.js';

const localesDir = new URL('../frontend/locales/', import.meta.url);

// The three per-locale datasets. `optional` ones may be left out by a beta
// locale — but never left half-translated: neither has a per-key fallback of
// its own, so what ships is one file's worth of language.
const DATASETS = [
    { name: 'main pack', dir: '', optional: false },
    { name: 'privacy copy', dir: 'privacy/', optional: true },
    { name: 'security checklist', dir: 'security-checklist/', optional: true },
];

const packUrl = (dir, code) => new URL(`${dir}${code}.json`, localesDir);
const packExists = (dir, code) => fs.existsSync(packUrl(dir, code));
const readPack = (dir, code) => JSON.parse(fs.readFileSync(packUrl(dir, code), 'utf8'));

// path → leaf value. Arrays flatten by index, so an entry added or dropped
// mid-array reads as a changed key rather than a silent re-alignment.
const flatten = (value, prefix = '', out = new Map()) => {
    for (const [key, child] of Object.entries(value)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (child && typeof child === 'object') flatten(child, path, out);
        else out.set(path, child);
    }
    return out;
};

const isBlank = (value) => String(value ?? '').trim() === '';
const placeholders = (value) => new Set(String(value).match(/\{[^}]*\}/g) ?? []);

const reference = new Map(DATASETS.map(({ dir }) => [dir, flatten(readPack(dir, FALLBACK_LOCALE))]));
const translations = LOCALE_CODES.filter((code) => code !== FALLBACK_LOCALE);
const isFull = (code) => FULL_LOCALE_CODES.includes(code);

describe('locale packs — registry and files agree', () => {
    it('every registered locale ships a main pack', () => {
        for (const code of LOCALE_CODES) {
            assert.ok(packExists('', code),
                `frontend/locales/${code}.json is missing — scaffold it with \`pnpm i18n-new ${code}\``);
        }
    });

    it('every main pack in the folder is a registered locale', () => {
        const onDisk = fs.readdirSync(localesDir)
            .filter((name) => name.endsWith('.json'))
            .map((name) => name.replace(/\.json$/, ''));
        for (const code of onDisk) {
            assert.ok(LOCALE_CODES.includes(code),
                `frontend/locales/${code}.json has no entry in common/locale-registry.js`);
        }
    });

    it('en ships all three datasets — it is what everything falls back to', () => {
        for (const { name, dir } of DATASETS) {
            assert.ok(packExists(dir, FALLBACK_LOCALE), `en is missing its ${name}`);
        }
    });
});

describe('locale packs — rules every translation follows', () => {
    for (const { name, dir, optional } of DATASETS) {
        for (const code of translations) {
            if (!packExists(dir, code)) continue;
            const en = reference.get(dir);
            const pack = flatten(readPack(dir, code));
            const label = `${dir}${code}.json`;

            // Every pack that exists is a skeleton of en: same keys, no more,
            // no fewer. What may be left "" is what differs below.
            it(`${label} (${name}) has exactly en's keys`, () => {
                const extra = [...pack.keys()].filter((key) => !en.has(key));
                assert.deepEqual(extra, [], `${label}: keys absent from en — a typo'd path is the usual cause`);
                const missing = [...en.keys()].filter((key) => !pack.has(key));
                assert.deepEqual(missing, [], optional
                    ? `${label}: keys missing against en — finish the file or leave it out entirely`
                    : `${label}: keys missing against en — run \`pnpm i18n-sync\`, untranslated values are ""`);
            });

            it(`${label} (${name}) invents no placeholder en doesn't have`, () => {
                for (const [key, value] of pack) {
                    if (isBlank(value)) continue; // untranslated: nothing to check
                    const allowed = placeholders(en.get(key) ?? '');
                    for (const token of placeholders(value)) {
                        assert.ok(allowed.has(token),
                            `${label}: ${key} uses ${token}, which en doesn't provide`);
                    }
                }
            });

            // The optional files load whole, with no per-key fallback inside
            // them, so one that exists must be finished.
            if (optional) {
                it(`${label} (${name}) is complete — it ships whole or not at all`, () => {
                    for (const [key, value] of pack) {
                        if (!isBlank(value) || isBlank(en.get(key))) continue;
                        assert.fail(`${label}: ${key} is empty — finish the file or leave it out entirely`);
                    }
                });
            }

            if (!optional && isFull(code)) {
                it(`${label} (${name}) leaves nothing untranslated — ${code} is a full locale`, () => {
                    for (const [key, value] of pack) {
                        if (!isBlank(value) || isBlank(en.get(key))) continue;
                        assert.fail(`${label}: ${key} is empty — a full locale translates everything`);
                    }
                });
            }
        }
    }

    // Slugs are URLs and priorities drive the badge colors — both are data, not
    // copy, and the tool reads them positionally against every locale's file.
    for (const code of translations) {
        if (!packExists('security-checklist/', code)) continue;
        it(`security-checklist/${code}.json keeps en's slugs and priorities`, () => {
            const en = reference.get('security-checklist/');
            const pack = flatten(readPack('security-checklist/', code));
            for (const [key, value] of en) {
                if (!/(^|\.)(slug|priority)$/.test(key)) continue;
                assert.equal(pack.get(key), value, `security-checklist/${code}.json: ${key} was translated`);
            }
        });
    }
});

describe('locale packs — full locales are complete', () => {
    for (const code of FULL_LOCALE_CODES) {
        if (code === FALLBACK_LOCALE) continue;
        for (const { name, dir } of DATASETS) {
            it(`${dir}${code}.json (${name}) covers every en key`, () => {
                assert.ok(packExists(dir, code),
                    `${code} is a full locale but has no ${name} — ship the file or mark it beta`);
                const pack = flatten(readPack(dir, code));
                const missing = [...reference.get(dir).keys()].filter((key) => !pack.has(key));
                assert.deepEqual(missing, [], `${dir}${code}.json: keys missing against en`);
            });
        }
    }
});
