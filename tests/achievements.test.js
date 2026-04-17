import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ACHIEVEMENTS_DEFINITIONS,
  createInitialAchievementsState,
} from '../frontend/data/achievements.js';

describe('ACHIEVEMENTS_DEFINITIONS', () => {
  it('has exactly 21 entries', () => {
    assert.equal(ACHIEVEMENTS_DEFINITIONS.length, 21);
  });

  it('each entry has name and img with absolute /achievements/*.webp path', () => {
    for (const def of ACHIEVEMENTS_DEFINITIONS) {
      assert.ok(def.name && typeof def.name === 'string', `missing name`);
      assert.ok(def.img && typeof def.img === 'string', `missing img for ${def.name}`);
      assert.match(def.img, /^\/achievements\/.+\.webp$/,
        `${def.name} image path must start with /achievements/ and end with .webp`);
    }
  });

  it('has no duplicate names', () => {
    const names = ACHIEVEMENTS_DEFINITIONS.map((d) => d.name);
    assert.equal(new Set(names).size, names.length);
  });
});

describe('createInitialAchievementsState()', () => {
  it('returns an object keyed by achievement name', () => {
    const state = createInitialAchievementsState();
    for (const def of ACHIEVEMENTS_DEFINITIONS) {
      assert.ok(def.name in state, `missing ${def.name} in state`);
    }
    assert.equal(Object.keys(state).length, ACHIEVEMENTS_DEFINITIONS.length);
  });

  it('each entry has the expected runtime shape', () => {
    const state = createInitialAchievementsState();
    for (const name of Object.keys(state)) {
      const entry = state[name];
      assert.equal(entry.name, name);
      assert.equal(entry.achieved, false);
      assert.equal(entry.achievedTime, null);
      assert.equal(entry.showDetails, false);
      assert.ok(entry.img && typeof entry.img === 'string');
    }
  });

  it('returns a fresh object each call (no shared references)', () => {
    const a = createInitialAchievementsState();
    const b = createInitialAchievementsState();
    assert.notEqual(a, b);
    assert.notEqual(a.IAmHuman, b.IAmHuman);
    a.IAmHuman.achieved = true;
    assert.equal(b.IAmHuman.achieved, false, 'mutating one state must not affect the other');
  });
});
