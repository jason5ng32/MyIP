// Tests for frontend/utils/docs-assistant-gate.js — whether the docs
// assistant's nav entry point and privacy-policy section show.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isDocsAssistantAvailable } from '../frontend/utils/docs-assistant-gate.js';

describe('isDocsAssistantAvailable', () => {
    it('needs both a docs site and sign-in', () => {
        assert.equal(isDocsAssistantAvailable(true, { accounts: true }), true);
        assert.equal(isDocsAssistantAvailable(false, { accounts: true }), false);
        assert.equal(isDocsAssistantAvailable(true, { accounts: false }), false);
    });

    it('ignores the configs flags and tolerates missing capabilities', () => {
        assert.equal(isDocsAssistantAvailable(true, { ipChecking: true, cloudFlare: true }), false);
        assert.equal(isDocsAssistantAvailable(true, undefined), false);
        assert.equal(isDocsAssistantAvailable(true, {}), false);
    });
});
