// scripts/i18n-scaffold.js — creates and maintains the empty-value skeletons
// that locale packs are built from. Committed contributor tooling:
//
//   pnpm i18n-new <code>   scaffold frontend/locales/<code>.json (every key of
//                          en.json, every value "") and register the locale
//   pnpm i18n-new <code> --privacy --checklist
//                          the same for the two optional datasets, once the
//                          language is registered
//   pnpm i18n-sync         realign the main packs with en (new keys as "",
//                          dead ones dropped, en's order); the optional files
//                          are reported, not written — they ship whole
//
// The convention both serve: an untranslated string is "", never a missing
// key, so a translation PR reads as `"" → text`. tests/locale-packs.test.js
// enforces the shape; vite.config.js drops the empties on the way into the
// bundle. The pure half below is exported for its spec; the CLI is a shell.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LOCALES, LOCALE_CODES, FALLBACK_LOCALE } from '../common/locale-registry.js';
import { flattenPack } from '../common/locale-pack.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = path.join(repoRoot, 'frontend', 'locales');
const registryFile = path.join(repoRoot, 'common', 'locale-registry.js');

// A locale code is `xx`, `xx-YY` (region) or `xx-Xxxx` (script).
const CODE_SHAPE = /^[a-z]{2}(-([A-Z]{2}|[A-Z][a-z]{3}))?$/;

// Languages whose flag isn't derivable from the code. Only the ones a
// contributor is likely to reach for — anything else prints a "check this".
const LANGUAGE_FLAGS = {
    ar: 'sa', cs: 'cz', da: 'dk', el: 'gr', en: 'us', fa: 'ir', he: 'il', hi: 'in',
    ja: 'jp', ko: 'kr', ms: 'my', nb: 'no', sv: 'se', uk: 'ua', vi: 'vn', zh: 'cn',
};

/* ------------------------------------------------------------------ */
/* Pure half                                                           */
/* ------------------------------------------------------------------ */

// Checklist slugs and priorities are data — the gate requires them to match
// en, so a skeleton hands them over already filled in.
export const isChecklistDataKey = (key) => key === 'slug' || key === 'priority';

// en's structure with every string blanked, except the keys `keepKey` claims.
// Non-string leaves are data too, so they are carried over as they are.
export const buildSkeleton = (reference, keepKey = () => false) => {
    const walk = (node, key) => {
        if (typeof node === 'string') return keepKey(key) ? node : '';
        if (Array.isArray(node)) return node.map((child) => walk(child, key));
        if (node && typeof node === 'object') {
            return Object.fromEntries(Object.entries(node).map(([child_key, child]) => [child_key, walk(child, child_key)]));
        }
        return node;
    };
    return walk(reference, '');
};

// Rebuild `existing` against `reference`: en's keys in en's order, existing
// translations kept, new keys blank, keys en dropped gone. Reports both sides
// of the diff by path so the CLI can say what it did.
export const syncPack = (reference, existing, prefix = '', report = { added: [], removed: [] }) => {
    const source = existing && typeof existing === 'object' ? existing : {};
    const at = (key) => (prefix ? `${prefix}.${key}` : key);

    for (const key of Object.keys(source)) {
        if (Array.isArray(reference) ? Number(key) < reference.length : key in reference) continue;
        report.removed.push(at(key));
    }

    const merge = (key, child) => {
        const current = source[key];
        if (child && typeof child === 'object') return syncPack(child, current, at(key), report).pack;
        if (typeof child !== 'string') return child;      // non-copy leaf: keep en's value
        if (typeof current === 'string') return current;  // the translation, or a "" already there
        report.added.push(at(key));
        return '';
    };

    const pack = Array.isArray(reference)
        ? reference.map((child, index) => merge(String(index), child))
        : Object.fromEntries(Object.entries(reference).map(([key, child]) => [key, merge(key, child)]));

    return { pack, added: report.added, removed: report.removed };
};

// The locale's own name for itself, capitalized the way the registry writes it.
export const nativeNameFor = (code) => {
    let name = code;
    try {
        name = new Intl.DisplayNames([code], { type: 'language' }).of(code) || code;
    } catch { /* no data for this tag — the caller is told to fill it in */ }
    return name.charAt(0).toUpperCase() + name.slice(1);
};

// circle-flags code: the region subtag if there is one, else a known mapping.
// `guessed: false` means the caller has to check it by hand.
export const flagFor = (code) => {
    const region = code.split('-')[1];
    if (region && /^[A-Z]{2}$/.test(region)) return { flag: region.toLowerCase(), guessed: true };
    const known = LANGUAGE_FLAGS[code.split('-')[0]];
    return known ? { flag: known, guessed: true } : { flag: code.toLowerCase(), guessed: false };
};

export const buildRegistryEntry = (code) => ({
    code,
    nativeName: nativeNameFor(code),
    flag: flagFor(code).flag,
    apiTag: code,
    htmlLang: code,
    status: 'beta',
});

export const formatRegistryLine = (entry) => `    { code: '${entry.code}', `
    + `nativeName: '${entry.nativeName}', flag: '${entry.flag}', apiTag: '${entry.apiTag}', `
    + `htmlLang: '${entry.htmlLang}', status: '${entry.status}' },`;

// Append the line to the LOCALES array in the registry's source text.
export const insertRegistryLine = (source, line) => {
    const marker = source.match(/export const LOCALES = \[\n[\s\S]*?\n(\];)/);
    if (!marker) throw new Error('could not find the LOCALES array in common/locale-registry.js');
    const closing = marker.index + marker[0].length - marker[1].length;
    return `${source.slice(0, closing)}${line}\n${source.slice(closing)}`;
};

// Everything that makes a code unusable, plus the softer "are you sure".
export const validateNewCode = (code, registered = LOCALE_CODES) => {
    const errors = [];
    const warnings = [];
    if (!CODE_SHAPE.test(code)) {
        errors.push(`"${code}" is not a locale code — use xx (zh), xx-YY (pt-BR) or xx-Xxxx (sr-Latn)`);
        return { errors, warnings };
    }
    if (registered.includes(code)) errors.push(`"${code}" is already registered`);

    const [base, region] = code.split('-');
    if (region && !registered.some((other) => other === base || other.startsWith(`${base}-`))) {
        warnings.push(`"${code}" is the first ${base} pack. The default variant of a language `
            + `takes the bare code ("${base}") — keep the region only if this is genuinely a variant.`);
    }
    if (!flagFor(code).guessed) warnings.push(`no flag known for "${code}" — check the flag column by hand`);
    return { errors, warnings };
};

// An optional dataset rides on an already-registered language, and the script
// never writes over copy somebody may have translated.
export const validateExtraPack = (code, dir, { registered, hasMainPack, exists }) => {
    const errors = [];
    if (!registered || !hasMainPack) {
        errors.push(`"${code}" has no main pack yet — run \`pnpm i18n-new ${code}\` first`);
    }
    if (exists) errors.push(`frontend/locales/${dir}${code}.json already exists — i18n-new never overwrites a pack`);
    return errors;
};

// The three per-locale datasets. Only the main pack is scaffolded by default;
// the other two are opt-in flags.
const DATASETS = {
    main: { dir: '', label: 'main pack', sync: 'write' },
    privacy: { dir: 'privacy/', label: 'privacy copy', sync: 'report' },
    checklist: { dir: 'security-checklist/', label: 'security checklist', sync: 'report', keepKey: isChecklistDataKey },
};

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

const packPath = (dir, code) => path.join(localesDir, dir, `${code}.json`);
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

const runNew = (code, flags) => {
    if (!code) throw new Error('usage: pnpm i18n-new <code> [--privacy] [--checklist]');
    const extras = ['privacy', 'checklist'].filter((name) => flags.has(`--${name}`));
    if (extras.length > 0) addExtraPacks(code, extras);
    else createLocale(code);
};

// Default run: the main pack plus the registry line, for a language that has
// neither yet.
const createLocale = (code) => {
    const { errors, warnings } = validateNewCode(code);
    if (fs.existsSync(packPath('', code))) errors.push(`frontend/locales/${code}.json already exists`);
    if (errors.length > 0) throw new Error(errors.join('\n'));

    const entry = buildRegistryEntry(code);
    const skeleton = buildSkeleton(readJson(packPath('', FALLBACK_LOCALE)));
    writeJson(packPath('', code), skeleton);
    fs.writeFileSync(registryFile, insertRegistryLine(fs.readFileSync(registryFile, 'utf8'), formatRegistryLine(entry)));

    console.log(`\n📦 frontend/locales/${code}.json — ${flattenPack(skeleton).size} keys, all ""`);
    console.log(`🗂  common/locale-registry.js — ${formatRegistryLine(entry).trim()}`);
    for (const warning of warnings) console.log(`⚠️  ${warning}`);
    console.log(`
Next:
  1. Translate what you like in frontend/locales/${code}.json — leave the rest "".
     Check the registry line above reads right (nativeName, flag, apiTag).
  2. pnpm test          the gate: keys must match en exactly, "" is a fine value
  3. pnpm i18n-status   how far along you are, and what to do next
  4. pnpm dev           pick the language in Preferences and look at it
  The privacy policy and the security checklist are separate, optional files —
  each ships finished or not at all. \`pnpm i18n-new ${code} --privacy --checklist\`
  scaffolds them when you are ready to do one in a sitting.
  Conventions and the answers to "why is this still English": TRANSLATING.md\n`);
};

// Opt-in run: a skeleton for one or both optional datasets of a language that
// is already registered.
const addExtraPacks = (code, names) => {
    const registered = LOCALE_CODES.includes(code);
    const hasMainPack = fs.existsSync(packPath('', code));
    const errors = names.flatMap((name) => validateExtraPack(code, DATASETS[name].dir, {
        registered,
        hasMainPack,
        exists: fs.existsSync(packPath(DATASETS[name].dir, code)),
    }));
    if (errors.length > 0) throw new Error([...new Set(errors)].join('\n'));

    for (const name of names) {
        const { dir, label, keepKey } = DATASETS[name];
        const skeleton = buildSkeleton(readJson(packPath(dir, FALLBACK_LOCALE)), keepKey);
        writeJson(packPath(dir, code), skeleton);
        console.log(`\n📦 frontend/locales/${dir}${code}.json — ${flattenPack(skeleton).size} keys (${label})`);
        console.log('   ⚠️  This file has no per-key fallback, so the gate rejects a "" in it.');
        console.log('   ⚠️  pnpm test stays RED until every value is filled in — do not commit a');
        console.log('       half-done file: delete it again if you are not finishing it now.');
    }
    console.log(`\nThen: pnpm test  ·  pnpm i18n-status --locale ${code}  ·  TRANSLATING.md\n`);
};

const listKeys = (sign, keys) => {
    for (const key of keys.slice(0, 10)) console.log(`      ${sign} ${key}`);
    if (keys.length > 10) console.log(`      ${sign} …${keys.length - 10} more`);
};

// Rewrite one pack against en. The optional files are report-only: they have
// no per-key fallback, so an auto-added "" would ship a half-English page and
// fail the gate — the translator decides what to do about it.
const syncOne = (code, status, name) => {
    const { dir, label, sync } = DATASETS[name];
    if (!fs.existsSync(packPath(dir, code))) return 0;

    const reference = readJson(packPath(dir, FALLBACK_LOCALE));
    const before = fs.readFileSync(packPath(dir, code), 'utf8');
    const { pack, added, removed } = syncPack(reference, readJson(packPath(dir, code)));
    const after = `${JSON.stringify(pack, null, 2)}\n`;
    const where = `${code} ${label}`;

    if (sync === 'report') {
        if (added.length === 0 && removed.length === 0) return 0;
        console.log(`🔍 ${where} — en moved: ${added.length} new key(s), ${removed.length} gone. Not written:`);
        listKeys('+', added);
        listKeys('-', removed);
        console.log('      this file ships finished or not at all — translate or drop it');
        return 0;
    }

    if (after === before) {
        console.log(`✅ ${where} — already aligned with en`);
        return 0;
    }
    fs.writeFileSync(packPath(dir, code), after);
    console.log(`✏️  ${where} — +${added.length} new key(s) as "", -${removed.length} dropped, order realigned`);
    listKeys('+', added);
    listKeys('-', removed);
    if (status === 'full' && added.length > 0) {
        console.log(`      ⚠️  ${code} is a full locale: those "" will fail pnpm test until translated`);
    }
    return added.length + 1;
};

const runSync = () => {
    let written = 0;
    let addedTotal = 0;
    for (const { code, status } of LOCALES) {
        if (code === FALLBACK_LOCALE) continue;
        for (const name of ['main', 'privacy', 'checklist']) {
            const result = syncOne(code, status, name);
            if (result === 0) continue;
            written += 1;
            addedTotal += result - 1;
        }
    }
    if (written === 0) console.log('\nNothing to do.\n');
    else if (addedTotal === 0) console.log(`\n${written} pack(s) rewritten — key order only.\n`);
    else console.log(`\n${written} pack(s) rewritten. Translate the new "" values, then pnpm test.\n`);
};

// Only when run as a CLI — importing the module (tests) must have no effect.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const flags = new Set(args.filter((arg) => arg.startsWith('--')));
    const [command, argument] = args.filter((arg) => !arg.startsWith('--'));
    try {
        if (command === 'new') runNew(argument, flags);
        else if (command === 'sync') runSync();
        else throw new Error('usage: pnpm i18n-new <code> | pnpm i18n-sync');
    } catch (error) {
        console.error(`\n❌ ${error.message}\n`);
        process.exit(1);
    }
}
