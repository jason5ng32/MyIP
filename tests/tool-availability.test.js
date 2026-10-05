// Tests for frontend/utils/tool-availability.js — the listing gate the
// Advanced Tools card grid, nav and tools menu filter through — plus the gate
// fields the registry in frontend/data/tools.js declares.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isToolAvailable, listedTools } from '../frontend/utils/tool-availability.js';
import { ADVANCED_TOOLS, TOOL_BY_SLUG } from '../frontend/data/tools.js';

const PUBLIC = { slug: 'public' };
const ORIGINAL = { slug: 'original', requiresOriginalSite: true };
const RADAR = { slug: 'radar', requiresConfig: 'cloudFlare' };
const BOTH = { slug: 'both', requiresOriginalSite: true, requiresConfig: 'cloudFlare' };

describe('isToolAvailable', () => {
  it('an ungated tool is always available', () => {
    assert.equal(isToolAvailable(PUBLIC, {}), true);
    assert.equal(isToolAvailable(PUBLIC, undefined), true);
    assert.equal(isToolAvailable(PUBLIC, { originalSite: false, cloudFlare: false }), true);
  });

  it('a gated tool is unavailable until configs land', () => {
    assert.equal(isToolAvailable(ORIGINAL, {}), false);
    assert.equal(isToolAvailable(RADAR, {}), false);
    assert.equal(isToolAvailable(RADAR, null), false);
  });

  it('requiresOriginalSite follows configs.originalSite', () => {
    assert.equal(isToolAvailable(ORIGINAL, { originalSite: true }), true);
    assert.equal(isToolAvailable(ORIGINAL, { originalSite: false }), false);
  });

  it('requiresConfig follows the named configs flag', () => {
    assert.equal(isToolAvailable(RADAR, { cloudFlare: true }), true);
    assert.equal(isToolAvailable(RADAR, { cloudFlare: false }), false);
    assert.equal(isToolAvailable(RADAR, { map: true }), false);
  });

  it('both gates must pass', () => {
    assert.equal(isToolAvailable(BOTH, { originalSite: true, cloudFlare: true }), true);
    assert.equal(isToolAvailable(BOTH, { originalSite: true, cloudFlare: false }), false);
    assert.equal(isToolAvailable(BOTH, { originalSite: false, cloudFlare: true }), false);
  });

  it('no tool is unavailable', () => {
    assert.equal(isToolAvailable(null, { cloudFlare: true }), false);
    assert.equal(isToolAvailable(undefined, {}), false);
  });

  it('filters a list in registry order', () => {
    const tools = [PUBLIC, ORIGINAL, RADAR, BOTH];
    const listed = (configs) => tools.filter((tool) => isToolAvailable(tool, configs)).map((tool) => tool.slug);
    assert.deepEqual(listed({}), ['public']);
    assert.deepEqual(listed({ originalSite: false, cloudFlare: true }), ['public', 'radar']);
    assert.deepEqual(listed({ originalSite: true, cloudFlare: true }), ['public', 'original', 'radar', 'both']);
  });
});

describe('listedTools', () => {
  const PAGELESS = { slug: 'pageless', noStandalone: true };
  const GATED_PAGELESS = { slug: 'gated-pageless', requiresOriginalSite: true, noStandalone: true };
  const tools = [PUBLIC, PAGELESS, ORIGINAL, GATED_PAGELESS];
  const slugs = (list) => list.map((tool) => tool.slug);

  it('applies the gates in registry order', () => {
    assert.deepEqual(slugs(listedTools(tools, {})), ['public', 'pageless']);
    assert.deepEqual(slugs(listedTools(tools, { originalSite: true })),
      ['public', 'pageless', 'original', 'gated-pageless']);
  });

  it('standaloneOnly also drops the noStandalone tools', () => {
    assert.deepEqual(slugs(listedTools(tools, { originalSite: true }, { standaloneOnly: true })),
      ['public', 'original']);
    assert.deepEqual(slugs(listedTools(tools, {}, { standaloneOnly: true })), ['public']);
  });

  it('the registry lists Persona Check only for callers that open the drawer', () => {
    const configs = { originalSite: true, cloudFlare: true };
    assert.ok(slugs(listedTools(ADVANCED_TOOLS, configs)).includes('personacheck'));
    assert.ok(!slugs(listedTools(ADVANCED_TOOLS, configs, { standaloneOnly: true })).includes('personacheck'));
    assert.equal(listedTools(ADVANCED_TOOLS, configs).length, ADVANCED_TOOLS.length);
  });
});

describe('registry gates (data/tools.js)', () => {
  it('ASN Profile is gated on the Cloudflare Radar key only', () => {
    const asn = TOOL_BY_SLUG.get('asn');
    assert.ok(asn, 'asn tool is registered');
    assert.equal(asn.requiresConfig, 'cloudFlare');
    assert.equal(asn.requiresOriginalSite, undefined);
    assert.equal(isToolAvailable(asn, { cloudFlare: false, originalSite: true }), false);
    assert.equal(isToolAvailable(asn, { cloudFlare: true, originalSite: false }), true);
  });

  it('every requiresConfig is a non-empty string', () => {
    for (const tool of ADVANCED_TOOLS.filter((entry) => 'requiresConfig' in entry)) {
      assert.equal(typeof tool.requiresConfig, 'string', tool.slug);
      assert.ok(tool.requiresConfig.length > 0, tool.slug);
    }
  });
});
