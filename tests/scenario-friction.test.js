// Tests for frontend/utils/features/scenario-friction.js — scenario normalization,
// display order, level sorting, card dot order, tones, locale keys and level shares.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

import {
    SCENARIOS,
    LEVEL_TONE,
    normalizeScenarios,
    scenarioTone,
    sortByLevel,
    scenarioNameKey,
    verdictKey,
    frictionShares,
    frictionDots,
} from '../frontend/utils/features/scenario-friction.js';

const ORDER = ['signup', 'payments', 'finance', 'streaming', 'availability',
    'browsing', 'posting', 'crossBorderSocial', 'automation', 'email'];

const en = JSON.parse(readFileSync(new URL('../frontend/locales/en.json', import.meta.url), 'utf8'));
const lookup = (key) => key.split('.').reduce((node, part) => node?.[part], en);

const item = (id, level = 'low') => ({ id, level });
const full = (level = 'low') => ({ version: 1, items: ORDER.map((id) => item(id, level)) });

describe('scenario-friction', () => {
    describe('SCENARIOS', () => {
        it('lists the ten ids in display order with one availability kind', () => {
            assert.deepEqual(SCENARIOS.map((s) => s.id), ORDER);
            assert.deepEqual(SCENARIOS.filter((s) => s.kind === 'availability').map((s) => s.id), ['availability']);
        });

        it('has an English name for every scenario', () => {
            for (const s of SCENARIOS) assert.ok(typeof lookup(scenarioNameKey(s)) === 'string' && lookup(scenarioNameKey(s)), s.id);
        });

        it('names the country in social-as-a-local only when one is given', () => {
            const social = { id: 'crossBorderSocial' };
            assert.equal(scenarioNameKey(social), 'ipInfos.scenarioFriction.scenarios.localSocial');
            assert.equal(scenarioNameKey(social, 'Japan'), 'ipInfos.scenarioFriction.scenarios.localSocialIn');
            assert.match(lookup(scenarioNameKey(social, 'Japan')), /\{country\}/);
            assert.equal(scenarioNameKey({ id: 'email' }, 'Japan'), 'ipInfos.scenarioFriction.scenarios.email');
        });
    });

    describe('tones', () => {
        it('maps low to green, medium to light yellow, high to full yellow, never red', () => {
            assert.deepEqual({ ...LEVEL_TONE }, { low: 'ok-fast', medium: 'ok-mild', high: 'ok-slow' });
            assert.equal(scenarioTone(item('a', 'medium')), 'ok-mild');
            assert.equal(scenarioTone(item('a', 'high')), 'ok-slow');
            assert.equal(scenarioTone(item('a', 'weird')), 'ok-fast');
            assert.ok(!Object.values(LEVEL_TONE).includes('fail'));
        });
    });

    describe('sortByLevel()', () => {
        it('puts low first, then medium, then high', () => {
            const out = sortByLevel([item('a', 'high'), item('b', 'low'), item('c', 'medium'), item('d', 'low')]);
            assert.deepEqual(out.map((s) => s.level), ['low', 'low', 'medium', 'high']);
        });

        it('keeps display order within a level, unknown levels as low', () => {
            const raw = { version: 1, items: ORDER.map((id, i) => item(id, ['low', 'medium', 'high'][i % 3])) };
            const out = sortByLevel(normalizeScenarios(raw));
            assert.deepEqual(out.map((s) => s.id), [
                'signup', 'streaming', 'posting', 'email',
                'payments', 'availability', 'crossBorderSocial',
                'finance', 'browsing', 'automation',
            ]);
            assert.deepEqual(sortByLevel([item('z', 'medium'), item('x', 'weird'), item('y', 'low')]).map((s) => s.id),
                ['x', 'y', 'z']);
        });

        it('returns a new array without mutating its input', () => {
            const input = Object.freeze([item('a', 'high'), item('b', 'low')]);
            const out = sortByLevel(input);
            assert.notEqual(out, input);
            assert.deepEqual(input.map((s) => s.id), ['a', 'b']);
            assert.deepEqual(out.map((s) => s.id), ['b', 'a']);
            assert.deepEqual(sortByLevel(), []);
        });
    });

    describe('normalizeScenarios()', () => {
        it('returns null for missing, gated or malformed blocks', () => {
            for (const raw of [undefined, null, 'sign_in_required', 'quota_exceeded', 42, [], {},
                { version: 1 }, { version: 1, items: {} }, { version: 1, items: [] }]) {
                assert.equal(normalizeScenarios(raw), null, JSON.stringify(raw));
            }
        });

        it('accepts any positive integer version', () => {
            for (const version of [1, 2, 17]) {
                assert.equal(normalizeScenarios({ ...full('high'), version })?.length, 10, String(version));
            }
        });

        it('returns null for a missing or non-integer version', () => {
            for (const version of ['1', 1.5, 0, -1, null, NaN]) {
                assert.equal(normalizeScenarios({ ...full(), version }), null, String(version));
            }
            const { version, ...noVersion } = full();
            assert.equal(normalizeScenarios(noVersion), null);
        });

        it('returns { id, kind?, level } in display order regardless of input order', () => {
            const out = normalizeScenarios({ version: 1, items: [...ORDER].reverse().map((id) => item(id, 'medium')) });
            assert.deepEqual(out.map((s) => s.id), ORDER);
            assert.deepEqual(out[0], { id: 'signup', level: 'medium' });
            assert.deepEqual(out.find((s) => s.id === 'availability'), { id: 'availability', kind: 'availability', level: 'medium' });
        });

        it('ignores extra fields such as reasons', () => {
            const out = normalizeScenarios({ version: 1, items: [{ id: 'email', level: 'high', reasons: ['home_line'], score: 3 }] });
            assert.deepEqual(out, [{ id: 'email', level: 'high' }]);
        });

        it('keeps a partial list, dropping unknown ids and items with unknown levels', () => {
            const out = normalizeScenarios({
                version: 1,
                items: [
                    item('email', 'high'),
                    item('teleport', 'high'),
                    item('signup', 'severe'),
                    item('finance', null),
                    { id: 'payments' },
                    null,
                    'browsing',
                    item('posting', 'low'),
                ],
            });
            assert.deepEqual(out.map((s) => [s.id, s.level]), [['posting', 'low'], ['email', 'high']]);
        });

        it('returns null when no valid item survives', () => {
            assert.equal(normalizeScenarios({ version: 1, items: [item('teleport'), item('signup', 'weird'), null] }), null);
        });

        it('keeps the first of duplicate ids', () => {
            const out = normalizeScenarios({ version: 1, items: [item('signup', 'high'), item('signup', 'low')] });
            assert.deepEqual(out.map((s) => s.level), ['high']);
        });

        it('never throws on hostile input', () => {
            assert.doesNotThrow(() => normalizeScenarios({ version: 1, items: [Object.create(null), [], () => {}] }));
        });
    });

    it('keys verdicts per kind, unknown levels as low', () => {
        const words = (s) => lookup(verdictKey(s));
        assert.equal(words(item('a', 'low')), 'Smooth');
        assert.equal(words(item('a', 'medium')), 'Extra checks');
        assert.equal(words(item('a', 'high')), 'May be restricted');
        assert.equal(words(item('a', 'weird')), 'Smooth');
        const avail = (level) => ({ id: 'availability', kind: 'availability', level });
        assert.equal(words(avail('low')), 'Available');
        assert.equal(words(avail('medium')), 'Limited');
        assert.equal(words(avail('high')), 'May be blocked');
    });

    it('counts scenarios per level, unknown levels as smooth', () => {
        assert.deepEqual(frictionShares([item('a', 'low'), item('b', 'medium'), item('c', 'high'), item('d', 'weird')]),
            { total: 4, smooth: 2, checks: 1, restricted: 1 });
        assert.deepEqual(frictionShares(normalizeScenarios(full('high'))), { total: 10, smooth: 0, checks: 0, restricted: 10 });
        assert.deepEqual(frictionShares(normalizeScenarios(full())), { total: 10, smooth: 10, checks: 0, restricted: 0 });
        assert.deepEqual(frictionShares([]), { total: 0, smooth: 0, checks: 0, restricted: 0 });
        assert.deepEqual(frictionShares(), { total: 0, smooth: 0, checks: 0, restricted: 0 });
    });

    describe('frictionDots()', () => {
        it('follows the details list order (sortByLevel)', () => {
            const raw = { version: 1, items: ORDER.map((id, i) => item(id, ['low', 'medium', 'high'][i % 3])) };
            const scenarios = normalizeScenarios(raw);
            assert.deepEqual(frictionDots(scenarios).map((d) => d.id), sortByLevel(scenarios).map((s) => s.id));
        });

        it('carries one level tone per scenario, unknown levels as low', () => {
            const out = frictionDots([item('a', 'high'), item('b', 'weird'), item('c', 'medium'), item('d', 'low')]);
            assert.deepEqual(out, [
                { id: 'b', tone: 'ok-fast' }, { id: 'd', tone: 'ok-fast' },
                { id: 'c', tone: 'ok-mild' }, { id: 'a', tone: 'ok-slow' },
            ]);
            assert.equal(frictionDots(normalizeScenarios(full('high'))).length, 10);
        });

        it('does not mutate its input and handles empty lists', () => {
            const input = Object.freeze([item('a', 'high'), item('b', 'low')]);
            assert.deepEqual(frictionDots(input).map((d) => d.id), ['b', 'a']);
            assert.deepEqual(input.map((s) => s.id), ['a', 'b']);
            assert.deepEqual(frictionDots([]), []);
            assert.deepEqual(frictionDots(), []);
        });
    });

    it('has a breakdown string in every full locale naming the three counts', () => {
        for (const locale of ['en', 'zh', 'zh-TW', 'fr', 'ru', 'pt-BR']) {
            const pack = JSON.parse(readFileSync(new URL(`../frontend/locales/${locale}.json`, import.meta.url), 'utf8'));
            const params = [...pack.ipInfos.scenarioFriction.breakdown.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
            assert.deepEqual(params, ['checks', 'restricted', 'smooth'], locale);
        }
    });
});
