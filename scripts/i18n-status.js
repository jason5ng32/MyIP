// scripts/i18n-status.js — translation progress dashboard for contributors.
// Prints, per registered locale, how much of each dataset (main pack, privacy
// copy, security checklist) is translated and which keys come next.
//
// This is a report, never a gate: it always exits 0, whatever it finds.
// The rules a pack must obey live in tests/locale-packs.test.js.
//
// Usage: pnpm i18n-status [--locale zh] [--limit 20]
import fs from 'node:fs';
import { parseArgs } from 'node:util';

import { LOCALES, FALLBACK_LOCALE } from '../common/locale-registry.js';
import { flattenPack, isUntranslated } from '../common/locale-pack.js';

const localesDir = new URL('../frontend/locales/', import.meta.url);

const DATASETS = [
    { name: 'main pack', dir: '' },
    { name: 'privacy copy', dir: 'privacy/' },
    { name: 'checklist', dir: 'security-checklist/' },
];

const packUrl = (dir, code) => new URL(`${dir}${code}.json`, localesDir);
const readPack = (dir, code) => JSON.parse(fs.readFileSync(packUrl(dir, code), 'utf8'));

// Checklist slugs and priorities are data, not copy — they are supposed to be
// identical to en, so they stay out of the sameAsEn signal below.
const DATA_KEY = /(^|\.)(slug|priority)$/;

// A key counts as translated when it is present and not blank — except where
// en is blank too, which makes the empty value the correct translation.
// `sameAsEn` is a soft signal for reviewers: copied-over English reads as
// translated to every other check here, and sometimes that is even correct
// (product names, "MTR"), so it is reported, never judged.
const compare = (dir, code) => {
    const en = flattenPack(readPack(dir, FALLBACK_LOCALE));
    if (!fs.existsSync(packUrl(dir, code))) {
        return { total: en.size, done: 0, missing: [...en.keys()], sameAsEn: 0, file: false };
    }
    const pack = flattenPack(readPack(dir, code));
    const missing = [...en].filter(([key, enValue]) => {
        const value = pack.get(key);
        if (value === undefined) return true;
        return isUntranslated(value) && !isUntranslated(enValue);
    }).map(([key]) => key);
    const sameAsEn = [...en].filter(([key, enValue]) =>
        !DATA_KEY.test(key) && !isUntranslated(enValue) && pack.get(key) === enValue).length;
    return { total: en.size, done: en.size - missing.length, missing, sameAsEn, file: true };
};

const bar = (ratio, width = 24) => {
    const filled = Math.round(ratio * width);
    return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
};

const { values } = parseArgs({
    options: {
        locale: { type: 'string' },
        limit: { type: 'string', default: '10' },
        json: { type: 'boolean', default: false },
    },
});
const limit = Math.max(0, Number.parseInt(values.limit, 10) || 0);
const targets = LOCALES.filter((l) => l.code !== FALLBACK_LOCALE && (!values.locale || l.code === values.locale));

// --json: machine-readable snapshot of the same numbers, for CI's PR-comment
// pipeline. Counts and key paths only, no prose — the consumer treats every
// field as untrusted input and validates it before rendering anything.
if (values.json) {
    const locales = targets.map(({ code, status }) => {
        const reports = DATASETS.map((dataset) => ({ ...dataset, ...compare(dataset.dir, code) }));
        return {
            code,
            status,
            sameAsEn: reports.reduce((sum, r) => sum + r.sameAsEn, 0),
            datasets: reports.map((r) => ({ name: r.name, done: r.done, total: r.total, file: r.file })),
            nextUp: reports.flatMap((r) => r.missing.map((key) => `${r.dir}${key}`)).slice(0, limit),
        };
    });
    console.log(JSON.stringify({ locales }));
    process.exit(0);
}

console.log(`\nTranslation status — reference locale: ${FALLBACK_LOCALE}\n`);

if (targets.length === 0) {
    console.log(values.locale ? `No registered locale "${values.locale}".` : 'No locales to report yet.');
} else {
    for (const { code, nativeName, status } of targets) {
        const reports = DATASETS.map((dataset) => ({ ...dataset, ...compare(dataset.dir, code) }));
        const total = reports.reduce((sum, r) => sum + r.total, 0);
        const done = reports.reduce((sum, r) => sum + r.done, 0);

        const sameAsEn = reports.reduce((sum, r) => sum + r.sameAsEn, 0);

        console.log(`${code} — ${nativeName} [${status}]  ${bar(done / total)} ${((done / total) * 100).toFixed(1)}% (${done}/${total})`);
        for (const report of reports) {
            const note = report.file ? '' : '  (no file yet)';
            const pct = ((report.done / report.total) * 100).toFixed(1);
            console.log(`    ${report.name.padEnd(12)} ${pct.padStart(5)}%  ${report.done}/${report.total}${note}`);
        }

        if (sameAsEn > 0) console.log(`    ${'identical to en'.padEnd(12)}  ${sameAsEn} value(s) — worth a spot check`);

        const nextUp = reports.flatMap((r) => r.missing.map((key) => `${r.dir}${key}`));
        if (nextUp.length > 0 && limit > 0) {
            console.log(`    next up: ${nextUp.slice(0, limit).join(', ')}`);
            if (nextUp.length > limit) console.log(`    …and ${nextUp.length - limit} more`);
        }
        console.log('');
    }
}

console.log('Rules a pack must follow: tests/locale-packs.test.js — this report never fails a build.\n');
