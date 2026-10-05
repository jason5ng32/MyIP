// Tests for the category layer of the Advanced Tools registry
// (frontend/data/tools.js): every tool sits in a known category, the 'deep'
// tools are exactly the original-site-only ones, and groupToolsByCategory
// builds the card groups Advanced.vue renders.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ADVANCED_TOOLS, TOOL_CATEGORIES, groupToolsByCategory } from '../frontend/data/tools.js';
import { isToolAvailable } from '../frontend/utils/tool-availability.js';

const CATEGORY_IDS = TOOL_CATEGORIES.map((c) => c.id);
const slugsByGroup = (groups) => Object.fromEntries(groups.map((g) => [g.id, g.tools.map((t) => t.slug)]));

describe('tool categories', () => {
  it('every tool has a known category', () => {
    for (const tool of ADVANCED_TOOLS) {
      assert.ok(CATEGORY_IDS.includes(tool.category), `${tool.slug}: ${tool.category}`);
    }
  });

  it('the deep tools are exactly the original-site-only ones', () => {
    const deep = ADVANCED_TOOLS.filter((t) => t.category === 'deep').map((t) => t.slug);
    const original = ADVANCED_TOOLS.filter((t) => t.requiresOriginalSite).map((t) => t.slug);
    assert.deepEqual(deep, original);
  });

  it('the registry lists tools grouped by category, in TOOL_CATEGORIES order', () => {
    const order = ADVANCED_TOOLS.map((t) => CATEGORY_IDS.indexOf(t.category));
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
  });
});

describe('groupToolsByCategory', () => {
  it('groups every tool once, in category order', () => {
    const groups = groupToolsByCategory(ADVANCED_TOOLS);
    assert.deepEqual(groups.map((g) => g.id), CATEGORY_IDS);
    assert.ok(groups.every((g) => g.titleKey));
    assert.equal(groups.flatMap((g) => g.tools).length, ADVANCED_TOOLS.length);
  });

  it('drops a group whose tools were all filtered out', () => {
    const fork = ADVANCED_TOOLS.filter((t) => isToolAvailable(t, { originalSite: false, cloudFlare: false }));
    const groups = slugsByGroup(groupToolsByCategory(fork));
    assert.deepEqual(Object.keys(groups), ['network', 'lookup']);
    assert.ok(!groups.lookup.includes('asn'));
  });

  it('no tools, no groups', () => {
    assert.deepEqual(groupToolsByCategory([]), []);
  });
});
