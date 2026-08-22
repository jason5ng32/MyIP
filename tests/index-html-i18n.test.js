// index.html is hand-maintained outside the bundle: its boot-screen copy
// (QUIPS / SLOW_HINTS), its JSON-LD and its language picker can't import
// common/locale-registry.js. This spec reads the file as text and holds those
// three inline copies to the registry, so a typo or a half-done sync fails here
// instead of shipping.
//
// Full locales must be covered; beta ones may skip the boot copy by design
// (docs/I18N-PLAN.md) — they resolve to a neighbour or to English at boot.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';

import {
    LOCALE_CODES,
    FULL_LOCALE_CODES,
    FALLBACK_LOCALE,
    toHtmlLang,
    matchLocale,
} from '../common/locale-registry.js';

const indexUrl = new URL('../index.html', import.meta.url);
const html = fs.readFileSync(indexUrl, 'utf8');

// Slice out one `const <name> = { … }` / `= (…) => { … }` literal by brace
// matching and evaluate it. Anchoring on the declaration rather than on line
// numbers keeps unrelated markup edits from moving the target.
const readDeclaration = (name) => {
    const start = html.indexOf(`const ${name} = `);
    assert.notEqual(start, -1, `index.html no longer declares \`${name}\` — update this spec with it`);
    const open = html.indexOf('{', start);
    assert.notEqual(open, -1, `index.html: \`${name}\` has no body`);
    let depth = 0;
    let end = -1;
    for (let i = open; i < html.length; i += 1) {
        if (html[i] === '{') depth += 1;
        else if (html[i] === '}') {
            depth -= 1;
            if (depth === 0) { end = i; break; }
        }
    }
    assert.notEqual(end, -1, `index.html: \`${name}\` is unbalanced`);
    return html.slice(start, end + 1);
};

const evalDeclaration = (name) => {
    const source = readDeclaration(name);
    try {
        return new Function(`${source}; return ${name};`)();
    } catch (err) {
        assert.fail(`index.html: \`${name}\` did not evaluate as plain JS (${err.message})`);
    }
};

const QUIPS = evalDeclaration('QUIPS');
const SLOW_HINTS = evalDeclaration('SLOW_HINTS');

// The boot copy objects, checked by the same rules.
const COPY = [
    { name: 'QUIPS', value: QUIPS },
    { name: 'SLOW_HINTS', value: SLOW_HINTS },
];

describe('index.html boot copy — languages match the registry', () => {
    for (const { name, value } of COPY) {
        it(`${name} keys are all registered locale codes`, () => {
            for (const code of Object.keys(value)) {
                assert.ok(LOCALE_CODES.includes(code),
                    `index.html ${name}: "${code}" is not in common/locale-registry.js — typo, or the locale was never registered`);
            }
        });

        it(`${name} covers every full locale`, () => {
            for (const code of FULL_LOCALE_CODES) {
                assert.ok(code in value,
                    `index.html ${name}: full locale "${code}" has no boot copy — translate it or mark the locale beta`);
            }
        });
    }

    it('QUIPS and SLOW_HINTS cover the same languages', () => {
        // pickLang() picks from QUIPS and then indexes SLOW_HINTS with the
        // result — a language in one object only renders `undefined`.
        assert.deepEqual(Object.keys(QUIPS), Object.keys(SLOW_HINTS),
            'index.html: QUIPS and SLOW_HINTS must list the same locales, in the same order');
    });
});

describe('index.html boot copy — shape holds across languages', () => {
    const referenceQuips = QUIPS[FALLBACK_LOCALE];

    it('en is present and its quip list is non-empty', () => {
        assert.ok(Array.isArray(referenceQuips) && referenceQuips.length > 0,
            'index.html QUIPS.en is the reference list — it must exist and be non-empty');
    });

    for (const [code, quips] of Object.entries(QUIPS)) {
        it(`QUIPS.${code} is a same-length list of non-empty strings`, () => {
            // The rotation shows one quip per tick and holds on the last one,
            // so a short list would end the copy early for that language only.
            assert.ok(Array.isArray(quips), `index.html QUIPS.${code} must be an array`);
            assert.equal(quips.length, referenceQuips.length,
                `index.html QUIPS.${code}: ${quips.length} quips against en's ${referenceQuips.length}`);
            for (const [i, quip] of quips.entries()) {
                assert.ok(typeof quip === 'string' && quip.trim() !== '',
                    `index.html QUIPS.${code}[${i}] is empty`);
            }
        });
    }

    for (const [code, hint] of Object.entries(SLOW_HINTS)) {
        it(`SLOW_HINTS.${code} is one sentence carrying the Lite link`, () => {
            assert.ok(typeof hint === 'string' && hint.trim() !== '',
                `index.html SLOW_HINTS.${code} is empty`);
            const links = hint.match(/<a\s+href="([^"]*)"/g) ?? [];
            assert.equal(links.length, 1,
                `index.html SLOW_HINTS.${code}: expected exactly one link, found ${links.length}`);
            assert.match(hint, /<a\s+href="https:\/\/lite\.ipcheck\.ing\/">/,
                `index.html SLOW_HINTS.${code}: the link must point at IPCheck.ing Lite`);
        });
    }
});

describe('index.html markup — declared languages', () => {
    // The JSON-LD block is the only application/ld+json script in the file.
    const jsonLd = (() => {
        const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
        assert.ok(match, 'index.html no longer carries a JSON-LD block');
        return JSON.parse(match[1]);
    })();

    it('JSON-LD inLanguage lists the full locales, as their htmlLang', () => {
        // full locales only. A beta locale is a partial translation sitting on
        // English copy — declaring it here would claim a translated site that
        // isn't one yet, and it would put index.html back on the critical path
        // of a first translation PR (one JSON + one registry line).
        assert.deepEqual(jsonLd.inLanguage, FULL_LOCALE_CODES.map(toHtmlLang),
            'index.html JSON-LD `inLanguage` must mirror the htmlLang of every FULL locale in '
            + 'common/locale-registry.js, in registry order. A beta locale does not belong here — '
            + "it joins inLanguage in the PR that promotes it to status:'full', together with its boot copy.");
    });

    it('<html lang> ships the fallback locale', () => {
        // Pre-Vue default only — i18n.js rewrites it to the active locale once
        // the bundle boots.
        const match = html.match(/<html lang="([^"]+)"/);
        assert.ok(match, 'index.html: <html> has no lang attribute');
        assert.equal(match[1], toHtmlLang(FALLBACK_LOCALE));
    });
});

describe('index.html matchLang — the inline twin of matchLocale', () => {
    // Sentinel. index.html can't import the registry, so its picker repeats
    // matchLocale()'s three steps by hand. Both implementations run against the
    // same tags below; a mismatch means ONE of the two moved:
    //   · common/locale-registry.js → matchLocale()
    //   · index.html → the `matchLang` in the boot-quips <script>
    // Sync whichever one you didn't touch — do not relax this test.
    const matchLang = evalDeclaration('matchLang');

    const CASES = [
        // [tag, codes]
        ['en', LOCALE_CODES],
        ['zh', LOCALE_CODES],
        ['EN-US', LOCALE_CODES],
        ['zh-TW', LOCALE_CODES],
        ['zh-Hans-CN', LOCALE_CODES],
        ['fr-CA', LOCALE_CODES],
        ['de-CH', LOCALE_CODES],
        ['tr', LOCALE_CODES],
        ['', LOCALE_CODES],
        [null, LOCALE_CODES],
        [undefined, LOCALE_CODES],
        // Variant-aware registries — the shapes beta locales will introduce.
        ['zh-TW', ['en', 'zh', 'zh-TW']],
        ['zh-TW', ['en', 'zh']],
        ['zh-CN', ['en', 'zh-TW']],
        ['pt-PT', ['en', 'pt-BR']],
        ['pt', ['en', 'pt-BR']],
        ['pt-AO', ['en', 'pt-PT', 'pt-BR']],
    ];

    for (const [tag, codes] of CASES) {
        it(`resolves ${JSON.stringify(tag)} against [${codes}] the same way`, () => {
            assert.equal(matchLang(tag, codes), matchLocale(tag, codes),
                'index.html `matchLang` and common/locale-registry.js `matchLocale` disagree — sync the two');
        });
    }

    it('only ever returns a code the caller offered', () => {
        for (const tag of ['zh-TW', 'fr-CA', 'de', 'xx-YY']) {
            const picked = matchLang(tag, Object.keys(QUIPS));
            assert.ok(picked === null || picked in QUIPS,
                `index.html matchLang returned "${picked}", which has no boot copy`);
        }
    });
});
