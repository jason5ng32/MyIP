// Tests for frontend/utils/docs-run-tests.js — the pure half of the docs
// assistant's `run_my_tests` tool: the section → command-bus mapping and the
// defensive normalization of GitBook's (unverified) tool-call arguments.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    RUNNABLE_SECTION_COMMANDS,
    RUNNABLE_SECTION_IDS,
    normalizeRunSections,
} from '../frontend/utils/docs-run-tests.js';

describe('runnable section commands', () => {
    it('covers exactly the four core tests', () => {
        assert.deepEqual(RUNNABLE_SECTION_IDS, ['ipinfo', 'connectivity', 'webrtc', 'dnsleak']);
    });

    it('maps each section to its owner command and payload', () => {
        assert.deepEqual(RUNNABLE_SECTION_COMMANDS.ipinfo, { command: 'ipinfo:refresh', payload: {} });
        assert.deepEqual(RUNNABLE_SECTION_COMMANDS.connectivity, { command: 'connectivity:run', payload: { trigger: 'manual' } });
        assert.deepEqual(RUNNABLE_SECTION_COMMANDS.webrtc, { command: 'webrtc:run', payload: { isRefresh: true } });
        assert.deepEqual(RUNNABLE_SECTION_COMMANDS.dnsleak, { command: 'dnsleak:run', payload: { isRefresh: true } });
    });
});

describe('normalizeRunSections', () => {
    it('runs all four when args are omitted entirely', () => {
        assert.deepEqual(normalizeRunSections(undefined), { requested: RUNNABLE_SECTION_IDS, unknown: [] });
    });

    it('runs all four on an empty or missing sections list', () => {
        assert.deepEqual(normalizeRunSections({}).requested, RUNNABLE_SECTION_IDS);
        assert.deepEqual(normalizeRunSections({ sections: [] }).requested, RUNNABLE_SECTION_IDS);
    });

    it('runs all four when sections is malformed (not an array)', () => {
        assert.deepEqual(normalizeRunSections({ sections: 'webrtc' }).requested, RUNNABLE_SECTION_IDS);
        assert.deepEqual(normalizeRunSections({ sections: { 0: 'webrtc' } }).requested, RUNNABLE_SECTION_IDS);
        assert.deepEqual(normalizeRunSections(null).requested, RUNNABLE_SECTION_IDS);
    });

    it('keeps a valid subset in request order, deduped', () => {
        const { requested, unknown } = normalizeRunSections({ sections: ['dnsleak', 'ipinfo', 'dnsleak'] });
        assert.deepEqual(requested, ['dnsleak', 'ipinfo']);
        assert.deepEqual(unknown, []);
    });

    it('splits unknown ids out instead of failing, keeping the valid ones', () => {
        const { requested, unknown } = normalizeRunSections({ sections: ['webrtc', 'speedtest', 'speedtest', 42] });
        assert.deepEqual(requested, ['webrtc']);
        assert.deepEqual(unknown, ['speedtest', '42']);
    });

    it('runs nothing when a non-empty list names only unknown ids', () => {
        const { requested, unknown } = normalizeRunSections({ sections: ['speedtest', 'mtrtest'] });
        assert.deepEqual(requested, []);
        assert.deepEqual(unknown, ['speedtest', 'mtrtest']);
    });

    it('returns a fresh array — mutating requested never leaks into the id list', () => {
        const { requested } = normalizeRunSections({ sections: [] });
        requested.pop();
        assert.equal(RUNNABLE_SECTION_IDS.length, 4);
    });
});
