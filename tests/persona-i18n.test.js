// Guards the Persona Check's i18n coverage the way changelog.test.js
// guards the changelog: a check id, a not-applicable reason or a detail field
// arriving from the evaluating API without its four locale entries fails here
// rather than rendering a raw key in front of a visitor.
//
// The expected vocabulary comes from utils/persona/check-ids.js, which is this
// front end's half of the contract with that API — adding a check upstream
// means adding its id there and translating it in the same change.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import en from '../frontend/locales/en.json' with { type: 'json' };
import zh from '../frontend/locales/zh.json' with { type: 'json' };
import fr from '../frontend/locales/fr.json' with { type: 'json' };
import ru from '../frontend/locales/ru.json' with { type: 'json' };
import {
    PERSONA_CHECK_IDS,
    PERSONA_DETAIL_KEYS,
    PERSONA_NOT_APPLICABLE_REASONS,
    PERSONA_UNKNOWN_REASONS,
    VERDICT,
    GRADE,
    AXIS,
    VISIBILITY,
} from '../frontend/utils/persona/check-ids.js';

// Every reason the report renders copy for: all not-applicable reasons plus
// the unknown reasons whitelisted to explain themselves.
const RENDERED_REASONS = [...PERSONA_NOT_APPLICABLE_REASONS, ...PERSONA_UNKNOWN_REASONS];

const LOCALES = { en, zh, fr, ru };

const flatten = (value, prefix = '') => {
    const keys = new Set();
    for (const [key, child] of Object.entries(value)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (child && typeof child === 'object') {
            for (const nested of flatten(child, path)) keys.add(nested);
        } else {
            keys.add(path);
        }
    }
    return keys;
};

describe('persona check i18n coverage', () => {
    it('every check has a title, a description and a fix in all four locales', () => {
        for (const id of PERSONA_CHECK_IDS) {
            for (const [lang, pack] of Object.entries(LOCALES)) {
                const entry = pack.personacheck.checks[id];
                assert.ok(entry, `${lang}: no copy for check "${id}"`);
                assert.ok(entry.title, `${lang}: check "${id}" has no title`);
                assert.ok(entry.fix, `${lang}: check "${id}" has no fix`);
                // Shown for passing rows as well — "why am I fine here" is
                // part of understanding the result.
                assert.ok(entry.what, `${lang}: check "${id}" has no description`);
            }
        }
    });

    it('carries no copy for checks the report can no longer show', () => {
        const live = new Set(PERSONA_CHECK_IDS);
        for (const [lang, pack] of Object.entries(LOCALES)) {
            const stale = Object.keys(pack.personacheck.checks).filter((id) => !live.has(id));
            assert.deepEqual(stale, [], `${lang}: copy left behind for removed checks`);
        }
    });

    it('labels every scalar detail field a result can carry, and nothing else', () => {
        for (const [lang, pack] of Object.entries(LOCALES)) {
            const labelled = Object.keys(pack.personacheck.detail);
            const missing = PERSONA_DETAIL_KEYS.filter((key) => !pack.personacheck.detail[key]);
            const stale = labelled.filter((key) => !PERSONA_DETAIL_KEYS.includes(key));
            assert.deepEqual(missing, [], `${lang}: unlabelled detail fields`);
            assert.deepEqual(stale, [], `${lang}: labels for detail fields nothing emits`);
        }
    });

    it('explains every rendered reason, and nothing else', () => {
        for (const [lang, pack] of Object.entries(LOCALES)) {
            const explained = Object.keys(pack.personacheck.reason);
            const missing = RENDERED_REASONS.filter((reason) => !pack.personacheck.reason[reason]);
            const stale = explained.filter((reason) => !RENDERED_REASONS.includes(reason));
            assert.deepEqual(missing, [], `${lang}: unexplained reasons`);
            assert.deepEqual(stale, [], `${lang}: explanations for reasons nothing emits`);
        }
    });

    it('labels every verdict state shown in the row header', () => {
        for (const [lang, pack] of Object.entries(LOCALES)) {
            for (const state of Object.values(VERDICT)) {
                assert.ok(pack.personacheck.report.state[state], `${lang}: no state label for "${state}"`);
                assert.ok(pack.personacheck.report.verdict[state], `${lang}: no verdict copy for "${state}"`);
            }
        }
    });

    it('names every grade and every visibility tier', () => {
        for (const [lang, pack] of Object.entries(LOCALES)) {
            for (const grade of Object.values(GRADE)) {
                assert.ok(pack.personacheck.report.grade[grade], `${lang}: no name for grade "${grade}"`);
                assert.ok(pack.personacheck.report.gradeNote[grade], `${lang}: no note for grade "${grade}"`);
            }
            for (const visibility of Object.values(VISIBILITY)) {
                assert.ok(pack.personacheck.report.visibility[visibility],
                    `${lang}: no copy for visibility "${visibility}"`);
            }
        }
    });

    it('names every axis a check can belong to', () => {
        // The axis chip is what tells a visitor that a coherence check never
        // claimed to measure the target country.
        for (const [lang, pack] of Object.entries(LOCALES)) {
            for (const axis of Object.values(AXIS)) {
                assert.ok(pack.personacheck.axis?.[axis], `${lang}: no label for axis "${axis}"`);
            }
        }
    });

    it('spells out the opaque hour-cycle enums', () => {
        // The intl-hour-cycle detail carries h11/h12/h23/h24, which mean
        // nothing to a visitor — each needs its label in every locale.
        for (const [lang, pack] of Object.entries(LOCALES)) {
            for (const cycle of ['h11', 'h12', 'h23', 'h24']) {
                assert.ok(pack.personacheck.hourCycle?.[cycle], `${lang}: no label for "${cycle}"`);
            }
        }
    });

    it('spells out boolean values instead of leaving true/false on screen', () => {
        for (const [lang, pack] of Object.entries(LOCALES)) {
            assert.ok(pack.personacheck.value?.yes, `${lang}: no label for a true value`);
            assert.ok(pack.personacheck.value?.no, `${lang}: no label for a false value`);
        }
    });

    it('reuses the app-wide IP type copy rather than translating it twice', () => {
        // The report renders detail.ipType through ipInfos.advancedData.type.*
        for (const [lang, pack] of Object.entries(LOCALES)) {
            for (const key of ['Residential', 'Wireless', 'Business', 'Hosting', 'unknownType']) {
                assert.ok(pack.ipInfos?.advancedData?.type?.[key], `${lang}: missing type.${key}`);
            }
        }
    });

    it('keeps the four locales structurally identical', () => {
        const reference = flatten(en.personacheck);
        for (const [lang, pack] of Object.entries(LOCALES)) {
            if (lang === 'en') continue;
            const other = flatten(pack.personacheck);
            const onlyInEn = [...reference].filter((key) => !other.has(key));
            const onlyInOther = [...other].filter((key) => !reference.has(key));
            assert.deepEqual(onlyInEn, [], `${lang}: missing keys present in en`);
            assert.deepEqual(onlyInOther, [], `${lang}: extra keys absent from en`);
        }
    });
});
