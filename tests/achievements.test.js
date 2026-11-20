// Tests for the achievement list both halves read (common/codes/achievements.js), its badge images and the store's initial state.
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

import { ACHIEVEMENT_NAMES } from '../common/codes/achievements.js';
import { ACHIEVEMENT_NAMES as BRIDGED_NAMES } from '../frontend/utils/codes/achievements.js';
import { achievementImage, createInitialAchievementsState } from '../frontend/data/achievements.js';

const IMAGE_DIR = new URL('../public/achievements/', import.meta.url);

describe('ACHIEVEMENT_NAMES', () => {
  it('has exactly 27 frozen, distinct names', () => {
    assert.equal(ACHIEVEMENT_NAMES.length, 27);
    assert.ok(Object.isFrozen(ACHIEVEMENT_NAMES));
    assert.equal(new Set(ACHIEVEMENT_NAMES).size, ACHIEVEMENT_NAMES.length);
    for (const name of ACHIEVEMENT_NAMES) assert.match(name, /^[A-Z][A-Za-z]+$/);
  });

  it('the front end reads the very same list', () => {
    assert.equal(BRIDGED_NAMES, ACHIEVEMENT_NAMES);
  });

  it('names and badge images cannot drift: one image per name, no image without a name', () => {
    const images = readdirSync(IMAGE_DIR).filter((file) => file.endsWith('.webp')).map((file) => `/achievements/${file}`);
    assert.deepEqual(ACHIEVEMENT_NAMES.map(achievementImage).sort(), images.sort());
  });
});

describe('createInitialAchievementsState()', () => {
  it('returns an object keyed by achievement name, in list order', () => {
    const state = createInitialAchievementsState(ACHIEVEMENT_NAMES);
    assert.deepEqual(Object.keys(state), [...ACHIEVEMENT_NAMES]);
  });

  it('each entry has the expected runtime shape', () => {
    const state = createInitialAchievementsState(ACHIEVEMENT_NAMES);
    for (const name of Object.keys(state)) {
      assert.deepEqual(state[name], {
        name, img: achievementImage(name), achieved: false, achievedTime: null, showDetails: false,
      });
    }
  });

  it('returns a fresh object each call (no shared references)', () => {
    const a = createInitialAchievementsState(ACHIEVEMENT_NAMES);
    const b = createInitialAchievementsState(ACHIEVEMENT_NAMES);
    assert.notEqual(a, b);
    assert.notEqual(a.IAmHuman, b.IAmHuman);
    a.IAmHuman.achieved = true;
    assert.equal(b.IAmHuman.achieved, false, 'mutating one state must not affect the other');
  });
});
