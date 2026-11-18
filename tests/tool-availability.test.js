// Tests for frontend/utils/tool-availability.js — the listing gate the
// Advanced Tools card grid and nav filter through — plus the gate fields the
// registry in frontend/data/tools.js declares.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isToolAvailable, listedTools } from '../frontend/utils/tool-availability.js';
import { ADVANCED_TOOLS, TOOL_BY_SLUG } from '../frontend/data/tools.js';

const PUBLIC = { slug: 'public' };
const ACCOUNT = { slug: 'account', requiresAccount: true };
const RADAR = { slug: 'radar', requiresConfig: 'cloudFlare' };
const BOTH = { slug: 'both', requiresAccount: true, requiresConfig: 'cloudFlare' };

describe('isToolAvailable', () => {
  it('an ungated tool is always available', () => {
    assert.equal(isToolAvailable(PUBLIC, {}), true);
    assert.equal(isToolAvailable(PUBLIC, undefined), true);
    assert.equal(isToolAvailable(PUBLIC, { accounts: false, cloudFlare: false }), true);
  });

  it('a gated tool is unavailable until configs land', () => {
    assert.equal(isToolAvailable(ACCOUNT, {}), false);
    assert.equal(isToolAvailable(RADAR, {}), false);
    assert.equal(isToolAvailable(RADAR, null), false);
  });

  it('requiresAccount follows capabilities.accounts', () => {
    assert.equal(isToolAvailable(ACCOUNT, { accounts: true }), true);
    assert.equal(isToolAvailable(ACCOUNT, { accounts: false }), false);
  });

  it('requiresConfig follows the named configs flag', () => {
    assert.equal(isToolAvailable(RADAR, { cloudFlare: true }), true);
    assert.equal(isToolAvailable(RADAR, { cloudFlare: false }), false);
    assert.equal(isToolAvailable(RADAR, { map: true }), false);
  });

  it('both gates must pass', () => {
    assert.equal(isToolAvailable(BOTH, { accounts: true, cloudFlare: true }), true);
    assert.equal(isToolAvailable(BOTH, { accounts: true, cloudFlare: false }), false);
    assert.equal(isToolAvailable(BOTH, { accounts: false, cloudFlare: true }), false);
  });

  it('no tool is unavailable', () => {
    assert.equal(isToolAvailable(null, { cloudFlare: true }), false);
    assert.equal(isToolAvailable(undefined, {}), false);
  });
});

describe('listedTools', () => {
  const tools = [PUBLIC, ACCOUNT, RADAR, BOTH];
  const slugs = (list) => list.map((tool) => tool.slug);

  it('applies the gates in registry order', () => {
    assert.deepEqual(slugs(listedTools(tools, {})), ['public']);
    assert.deepEqual(slugs(listedTools(tools, { accounts: true })), ['public', 'account']);
    assert.deepEqual(slugs(listedTools(tools, { accounts: false, cloudFlare: true })), ['public', 'radar']);
    assert.deepEqual(slugs(listedTools(tools, { accounts: true, cloudFlare: true })),
      ['public', 'account', 'radar', 'both']);
  });

  it('lists every registered tool once all gates pass', () => {
    const capabilities = { ipChecking: true, accounts: true, cloudFlare: true };
    assert.equal(listedTools(ADVANCED_TOOLS, capabilities).length, ADVANCED_TOOLS.length);
  });
});

describe('registry gates (data/tools.js)', () => {
  it('ASN Profile is gated on the Cloudflare Radar key only', () => {
    const asn = TOOL_BY_SLUG.get('asn');
    assert.ok(asn, 'asn tool is registered');
    assert.equal(asn.requiresConfig, 'cloudFlare');
    assert.equal(asn.requiresAccount, undefined);
    assert.equal(isToolAvailable(asn, { cloudFlare: false, ipChecking: true, accounts: true }), false);
    assert.equal(isToolAvailable(asn, { cloudFlare: true, ipChecking: false, accounts: false }), true);
  });

  it('the deep tools need the IPCheck.ing API and sign-in', () => {
    const deep = ADVANCED_TOOLS.filter((tool) => tool.category === 'deep');
    assert.equal(deep.length, 4);
    for (const tool of deep) {
      assert.equal(isToolAvailable(tool, { ipChecking: true, accounts: true }), true, tool.slug);
      assert.equal(isToolAvailable(tool, { ipChecking: true, accounts: false }), false, tool.slug);
      assert.equal(isToolAvailable(tool, { ipChecking: false, accounts: true }), false, tool.slug);
    }
  });

  it('every requiresConfig is a non-empty string', () => {
    for (const tool of ADVANCED_TOOLS.filter((entry) => 'requiresConfig' in entry)) {
      assert.equal(typeof tool.requiresConfig, 'string', tool.slug);
      assert.ok(tool.requiresConfig.length > 0, tool.slug);
    }
  });
});
