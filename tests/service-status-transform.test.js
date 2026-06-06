// Unit tests for the network-free Service Status normalizers and the
// status-vocab → tone mapping. No live upstream calls — inline fixtures only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeSummary, normalizeIncidents, assembleProvider } from '../common/service-status-transform.js';
import {
    indicatorToTone, componentStatusToTone, impactLevel, incidentStatusTone,
} from '../frontend/utils/service-status-tone.js';

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

    it('keeps only first-level rows: group headers stay, nested children drop', () => {
        const json = {
            status: { indicator: 'minor', description: 'Partial' },
            components: [
                { id: 'g1', name: 'Core', status: 'operational', group: true },
                { id: 'c1', name: 'Login', status: 'operational', group_id: 'g1' },
                { id: 'c2', name: 'Search', status: 'partial_outage', group_id: 'g1' },
                { id: 's1', name: 'Standalone', status: 'operational' },
            ],
        };
        const out = normalizeSummary(json);
        // Top-level header 'Core' + standalone 'Standalone'; children dropped.
        assert.equal(out.components.length, 2);
        assert.deepEqual(out.components.map((c) => c.name), ['Core', 'Standalone']);
    });

    it('caps the component list at the limit', () => {
        const components = Array.from({ length: 50 }, (_, i) => ({
            id: `c${i}`, name: `svc${i}`, status: 'operational',
        }));
        const out = normalizeSummary({ status: {}, components }, 40);
        assert.equal(out.components.length, 40);
    });

    it('defaults indicator to "unknown" on a malformed payload', () => {
        const out = normalizeSummary({});
        assert.equal(out.indicator, 'unknown');
        assert.deepEqual(out.components, []);
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

    it('returns an empty array on a malformed payload', () => {
        assert.deepEqual(normalizeIncidents({}), []);
        assert.deepEqual(normalizeIncidents(null), []);
    });
});

describe('assembleProvider', () => {
    const provider = { id: 'openai', name: 'OpenAI', page: 'https://status.openai.com', api: 'https://status.openai.com' };

    it('combines config + summary + incidents into the frontend shape', () => {
        const summaryJson = {
            status: { indicator: 'minor', description: 'Partial' },
            components: [{ id: 'a', name: 'API', status: 'degraded_performance' }],
        };
        const incidentsJson = { incidents: [{ id: 'i1', name: 'Latency', status: 'monitoring', impact: 'minor' }] };
        const out = assembleProvider(provider, summaryJson, incidentsJson);
        assert.equal(out.id, 'openai');
        assert.equal(out.name, 'OpenAI');
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
