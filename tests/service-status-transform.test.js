// Unit tests for the network-free Service Status normalizers and the
// status-vocab → tone mapping. No live upstream calls — inline fixtures only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    normalizeSummary, normalizeIncidents, assembleProvider,
    componentsFromStructure, indicatorFromComponents,
} from '../server/service-status-transform.js';
import {
    indicatorToTone, componentStatusToTone, impactLevel, incidentStatusTone,
} from '../frontend/utils/features/service-status-tone.js';

describe('normalizeSummary', () => {
    it('extracts indicator and component statuses', () => {
        const json = {
            status: { indicator: 'none', description: 'All Systems Operational' },
            components: [
                { id: 'a', name: 'API', status: 'operational' },
                { id: 'b', name: 'Web', status: 'degraded_performance' },
            ],
        };
        const out = normalizeSummary(json);
        assert.equal(out.indicator, 'none');
        assert.equal(out.components.length, 2);
        assert.deepEqual(out.components[0], { name: 'API', status: 'operational' });
    });

    // Shared 2-level fixture: one group header (g1) with two children, plus a
    // standalone top-level leaf.
    const GROUPED = {
        status: { indicator: 'minor', description: 'Partial' },
        components: [
            { id: 'g1', name: 'Core', status: 'operational', group: true },
            { id: 'c1', name: 'Login', status: 'operational', group_id: 'g1' },
            { id: 'c2', name: 'Search', status: 'partial_outage', group_id: 'g1' },
            { id: 's1', name: 'Standalone', status: 'operational' },
        ],
    };

    it('default selector keeps top-level rows (header + standalone), drops children', () => {
        const out = normalizeSummary(GROUPED);
        assert.deepEqual(out.components.map((c) => c.name), ['Core', 'Standalone']);
    });

    it('flatten selector keeps every leaf, drops group headers', () => {
        const out = normalizeSummary(GROUPED, { flatten: true });
        assert.deepEqual(out.components.map((c) => c.name), ['Login', 'Search', 'Standalone']);
    });

    it('include selector whitelists by name in the given order', () => {
        const out = normalizeSummary(GROUPED, { include: ['Search', 'Standalone', 'Missing'] });
        // 'Missing' isn't present → dropped; the rest keep the include order.
        assert.deepEqual(out.components.map((c) => c.name), ['Search', 'Standalone']);
        assert.equal(out.components[0].status, 'partial_outage');
    });

    it('exclude drops rows by id or name, on top of any mode', () => {
        // Default mode keeps top-level [Core, Standalone]; exclude Core by id.
        const byId = normalizeSummary(GROUPED, { exclude: ['g1'] });
        assert.deepEqual(byId.components.map((c) => c.name), ['Standalone']);
        // Exclude also matches by name, and composes with flatten.
        const byName = normalizeSummary(GROUPED, { flatten: true, exclude: ['Search'] });
        assert.deepEqual(byName.components.map((c) => c.name), ['Login', 'Standalone']);
    });

    it('rename relabels rows by id after selection, leaving the input untouched', () => {
        const snapshot = structuredClone(GROUPED);
        const out = normalizeSummary(GROUPED, { rename: { s1: 'Solo', nope: 'Ignored' } });
        assert.deepEqual(out.components.map((c) => c.name), ['Core', 'Solo']);
        assert.deepEqual(GROUPED, snapshot);
    });

    it('include / exclude still match the upstream names when rename is set', () => {
        const excluded = normalizeSummary(GROUPED, {
            flatten: true, exclude: ['Search'], rename: { c1: 'Sign-in', c2: 'Find' },
        });
        assert.deepEqual(excluded.components.map((c) => c.name), ['Sign-in', 'Standalone']);
        const included = normalizeSummary(GROUPED, { include: ['Search'], rename: { c2: 'Find' } });
        assert.deepEqual(included.components, [{ name: 'Find', status: 'partial_outage' }]);
    });

    it('caps the component list at the internal limit', () => {
        const components = Array.from({ length: 50 }, (_, i) => ({
            id: `c${i}`, name: `svc${i}`, status: 'operational',
        }));
        const out = normalizeSummary({ status: {}, components });
        assert.equal(out.components.length, 40);
    });

    it('defaults indicator to "unknown" on a malformed payload', () => {
        const out = normalizeSummary({});
        assert.equal(out.indicator, 'unknown');
        assert.deepEqual(out.components, []);
    });

    it('indicator "components" derives the light from the selected rows', () => {
        const json = {
            status: { indicator: 'major' },
            components: [
                { id: 'a', name: 'CDN', status: 'operational' },
                { id: 'b', name: 'DNS', status: 'operational' },
                { id: 'c', name: 'Workers', status: 'partial_outage' },
                { id: 'd', name: 'Europe PoP', status: 'major_outage' },
            ],
        };
        const healthy = normalizeSummary(json, { include: ['CDN', 'DNS'], indicator: 'components' });
        assert.equal(healthy.indicator, 'none');
        const partial = normalizeSummary(json, { include: ['CDN', 'Workers'], indicator: 'components' });
        assert.equal(partial.indicator, 'minor');
        // Without the flag, the page's own indicator wins.
        assert.equal(normalizeSummary(json, { include: ['CDN'] }).indicator, 'major');
    });
});

describe('componentsFromStructure', () => {
    const proxy = (items, affected = []) => ({
        summary: { structure: { items }, affected_components: affected },
    });

    it('rolls a group up to its worst child; bare components carry their own status', () => {
        const out = componentsFromStructure(proxy([
            { group: { id: 'g1', name: 'APIs', hidden: false, components: [
                { component_id: 'c1', name: 'Chat', hidden: false },
                { component_id: 'c2', name: 'Files', hidden: false },
                { component_id: 'c3', name: 'Batch', hidden: false },
            ] } },
            { component: { component_id: 'c4', name: 'Auth', hidden: false } },
            { component: { component_id: 'c5', name: 'Billing', hidden: false } },
        ], [
            { component_id: 'c1', status: 'degraded_performance' },
            { component_id: 'c2', status: 'major_outage' },
            { component_id: 'c3', status: 'under_maintenance' },
            { component_id: 'c5', status: 'partial_outage' },
        ]));
        assert.deepEqual(out, [
            { id: 'g1', name: 'APIs', status: 'major_outage' },
            { id: 'c4', name: 'Auth', status: 'operational' },
            { id: 'c5', name: 'Billing', status: 'partial_outage' },
        ]);
    });

    it('skips hidden items and hidden children', () => {
        const out = componentsFromStructure(proxy([
            { group: { id: 'g1', name: 'Core', hidden: false, components: [
                { component_id: 'c1', name: 'Visible', hidden: false },
                { component_id: 'c2', name: 'Secret', hidden: true },
            ] } },
            { group: { id: 'g2', name: 'Hidden group', hidden: true, components: [] } },
            { component: { component_id: 'c3', name: 'Hidden leaf', hidden: true } },
        ], [{ component_id: 'c2', status: 'major_outage' }]));
        assert.deepEqual(out, [{ id: 'g1', name: 'Core', status: 'operational' }]);
    });

    it('treats unlisted children, empty groups and unknown statuses as operational', () => {
        const out = componentsFromStructure(proxy([
            { group: { id: 'g1', name: 'Quiet', hidden: false, components: [
                { component_id: 'c1', name: 'A', hidden: false },
                { component_id: 'c2', name: 'B', hidden: false },
            ] } },
            { group: { id: 'g2', name: 'Empty', hidden: false, components: [] } },
            { group: { id: 'g3', name: 'Odd', hidden: false, components: [
                { component_id: 'c3', name: 'C', hidden: false },
            ] } },
        ], [{ component_id: 'c3', status: 'full_meltdown' }]));
        assert.deepEqual(out.map((c) => c.status), ['operational', 'operational', 'operational']);
    });

    it('keeps the structure order', () => {
        const out = componentsFromStructure(proxy([
            { component: { component_id: 'z', name: 'Zeta' } },
            { group: { id: 'a', name: 'Alpha', components: [] } },
            { component: { component_id: 'm', name: 'Mu' } },
        ]));
        assert.deepEqual(out.map((c) => c.name), ['Zeta', 'Alpha', 'Mu']);
    });

    it('returns [] on null or malformed input', () => {
        assert.deepEqual(componentsFromStructure(null), []);
        assert.deepEqual(componentsFromStructure({}), []);
        assert.deepEqual(componentsFromStructure({ summary: { structure: { items: 'x' } } }), []);
        assert.deepEqual(componentsFromStructure(proxy([null, {}, { group: null }])), []);
    });
});

describe('indicatorFromComponents', () => {
    const rows = (...statuses) => statuses.map((status, i) => ({ name: `c${i}`, status }));

    it('maps the worst status to a page indicator', () => {
        assert.equal(indicatorFromComponents(rows('operational', 'major_outage', 'partial_outage')), 'major');
        assert.equal(indicatorFromComponents(rows('operational', 'partial_outage')), 'minor');
        assert.equal(indicatorFromComponents(rows('degraded_performance', 'under_maintenance')), 'minor');
        assert.equal(indicatorFromComponents(rows('operational', 'under_maintenance')), 'maintenance');
        assert.equal(indicatorFromComponents(rows('operational', 'operational')), 'none');
        assert.equal(indicatorFromComponents(rows('operational', 'mystery')), 'none');
    });

    it('is "unknown" for an empty list', () => {
        assert.equal(indicatorFromComponents([]), 'unknown');
        assert.equal(indicatorFromComponents(null), 'unknown');
    });
});

describe('normalizeIncidents', () => {
    it('maps fields, builds the detail url from page+id, respects limit', () => {
        const json = {
            incidents: [
                { id: 'abc', name: 'Outage', status: 'resolved', impact: 'major', started_at: '2026-06-05T00:00:00Z' },
                { id: 'def', name: 'Slowness', status: 'monitoring', impact: 'minor', created_at: '2026-06-04T00:00:00Z' },
                { id: 'ghi', name: 'Old', status: 'resolved', impact: 'none' },
            ],
        };
        const out = normalizeIncidents(json, { limit: 2, pageUrl: 'https://status.openai.com' });
        assert.equal(out.length, 2);
        assert.deepEqual(out[0], {
            id: 'abc', name: 'Outage', status: 'resolved', impact: 'major',
            startedAt: '2026-06-05T00:00:00Z',
            url: 'https://status.openai.com/incidents/abc',
        });
        // Falls back to created_at when started_at is absent.
        assert.equal(out[1].startedAt, '2026-06-04T00:00:00Z');
    });

    it('trims a trailing slash on pageUrl before building the url', () => {
        const out = normalizeIncidents(
            { incidents: [{ id: 'x1', name: 'I' }] },
            { pageUrl: 'https://status.openai.com/' },
        );
        assert.equal(out[0].url, 'https://status.openai.com/incidents/x1');
    });

    it('falls back to the page url when an incident has no id', () => {
        const out = normalizeIncidents(
            { incidents: [{ name: 'No id' }] },
            { pageUrl: 'https://status.example.com' },
        );
        assert.equal(out[0].url, 'https://status.example.com');
    });

    it('sorts newest-first by the displayed timestamp, regardless of upstream order', () => {
        // Upstream order here is NOT chronological by start (mirrors incident.io,
        // which orders by updated_at) — the output must still be newest-first.
        const json = {
            incidents: [
                { id: 'a', name: 'older', created_at: '2026-06-05T13:00:00Z' },
                { id: 'b', name: 'newest', created_at: '2026-06-06T01:00:00Z' },
                { id: 'c', name: 'no-date' },
                { id: 'd', name: 'oldest', created_at: '2026-06-04T09:00:00Z' },
            ],
        };
        const out = normalizeIncidents(json, { pageUrl: 'https://x' });
        assert.deepEqual(out.map((i) => i.id), ['b', 'a', 'd', 'c']);
    });

    it('returns an empty array on a malformed payload', () => {
        assert.deepEqual(normalizeIncidents({}), []);
        assert.deepEqual(normalizeIncidents(null), []);
    });
});

describe('assembleProvider', () => {
    const provider = { id: 'chatgpt', name: 'ChatGPT', page: 'https://status.openai.com', api: 'https://status.openai.com' };

    it('combines config + summary + incidents into the frontend shape', () => {
        const summaryJson = {
            status: { indicator: 'minor', description: 'Partial' },
            components: [{ id: 'a', name: 'API', status: 'degraded_performance' }],
        };
        const incidentsJson = { incidents: [{ id: 'i1', name: 'Latency', status: 'monitoring', impact: 'minor' }] };
        const out = assembleProvider(provider, summaryJson, incidentsJson);
        assert.equal(out.id, 'chatgpt');
        assert.equal(out.name, 'ChatGPT');
        assert.equal(out.page, 'https://status.openai.com');
        assert.equal(out.indicator, 'minor');
        assert.equal(out.components.length, 1);
        assert.equal(out.incidents[0].url, 'https://status.openai.com/incidents/i1');
    });

    it('degrades to "unknown" with empty lists when payloads are null (failed fetch)', () => {
        const out = assembleProvider(provider, null, null);
        assert.equal(out.indicator, 'unknown');
        assert.deepEqual(out.components, []);
        assert.deepEqual(out.incidents, []);
    });

    it('threads the provider component selector through to normalizeSummary', () => {
        const withSelector = { ...provider, components: { flatten: true } };
        const summaryJson = {
            status: { indicator: 'none' },
            components: [
                { id: 'g', name: 'Group', status: 'operational', group: true },
                { id: 'k', name: 'Leaf', status: 'operational', group_id: 'g' },
            ],
        };
        const out = assembleProvider(withSelector, summaryJson, null);
        // flatten drops the header, keeps the leaf.
        assert.deepEqual(out.components.map((c) => c.name), ['Leaf']);
    });

    describe('with an incident.io structure payload', () => {
        const summaryJson = {
            status: { indicator: 'minor' },
            components: [{ id: 'x', name: 'Flattened leaf', status: 'operational' }],
        };
        const structureJson = {
            summary: {
                structure: { items: [
                    { group: { id: 'g1', name: 'APIs', components: [{ component_id: 'c1', name: 'Chat' }] } },
                    { component: { component_id: 'c2', name: 'Codex' } },
                ] },
                affected_components: [{ component_id: 'c1', status: 'degraded_performance' }],
            },
        };

        it('takes the rows from the structure, the indicator from the summary', () => {
            const out = assembleProvider(provider, summaryJson, null, structureJson);
            assert.deepEqual(out.components, [
                { name: 'APIs', status: 'degraded_performance' },
                { name: 'Codex', status: 'operational' },
            ]);
            assert.equal(out.indicator, 'minor');
        });

        it('still applies the include selector by name', () => {
            const out = assembleProvider({ ...provider, components: { include: ['Codex'] } }, summaryJson, null, structureJson);
            assert.deepEqual(out.components.map((c) => c.name), ['Codex']);
        });

        it('applies rename to structure rows by id', () => {
            const out = assembleProvider({ ...provider, components: { rename: { g1: 'Platform APIs' } } }, summaryJson, null, structureJson);
            assert.deepEqual(out.components.map((c) => c.name), ['Platform APIs', 'Codex']);
        });

        it('falls back to the summary components when the structure yields no rows', () => {
            const out = assembleProvider(provider, summaryJson, null, { summary: {} });
            assert.deepEqual(out.components.map((c) => c.name), ['Flattened leaf']);
        });
    });
});

describe('tone mapping', () => {
    it('maps provider indicators to tones', () => {
        assert.equal(indicatorToTone('none'), 'ok-fast');
        assert.equal(indicatorToTone('minor'), 'ok-slow');
        assert.equal(indicatorToTone('maintenance'), 'ok-slow');
        assert.equal(indicatorToTone('major'), 'fail');
        assert.equal(indicatorToTone('critical'), 'fail');
        assert.equal(indicatorToTone('unknown'), 'wait');
    });

    it('maps component statuses to tones', () => {
        assert.equal(componentStatusToTone('operational'), 'ok-fast');
        assert.equal(componentStatusToTone('degraded_performance'), 'ok-slow');
        assert.equal(componentStatusToTone('partial_outage'), 'ok-slow');
        assert.equal(componentStatusToTone('major_outage'), 'fail');
        assert.equal(componentStatusToTone('under_maintenance'), 'ok-slow');
    });

    it('maps incident impact to a "!" count (no color)', () => {
        assert.equal(impactLevel('none'), 0);
        assert.equal(impactLevel('minor'), 1);
        assert.equal(impactLevel('major'), 2);
        assert.equal(impactLevel('critical'), 3);
        assert.equal(impactLevel(undefined), 0);
    });

    it('colors the incident status by lifecycle, not severity', () => {
        assert.equal(incidentStatusTone('resolved'), 'ok-fast');
        assert.equal(incidentStatusTone('postmortem'), 'ok-fast');
        assert.equal(incidentStatusTone('completed'), 'ok-fast');
        assert.equal(incidentStatusTone('investigating'), 'fail');
        assert.equal(incidentStatusTone('identified'), 'ok-slow');
        assert.equal(incidentStatusTone('monitoring'), 'ok-slow');
        assert.equal(incidentStatusTone('scheduled'), 'wait');
    });
});
