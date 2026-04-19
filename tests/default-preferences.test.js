import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_PREFERENCES,
  createDefaultPreferences,
} from '../frontend/data/default-preferences.js';

describe('DEFAULT_PREFERENCES', () => {
  it('is frozen', () => {
    assert.equal(Object.isFrozen(DEFAULT_PREFERENCES), true);
  });

  it('contains the full preference shape with expected defaults', () => {
    assert.deepEqual(DEFAULT_PREFERENCES, {
      theme: 'auto',
      connectivityAutoRefresh: false,
      simpleMode: false,
      autoStart: true,
      hideUnavailableIPStack: false,
      popupConnectivityNotifications: true,
      ipCardsToShow: 4,
      ipGeoSource: 0,
      lang: 'auto',
      customConnectivityTargets: [],
    });
  });
});

describe('createDefaultPreferences()', () => {
  it('returns a writable copy with the same values', () => {
    const p = createDefaultPreferences();
    assert.deepEqual(p, DEFAULT_PREFERENCES);
    assert.equal(Object.isFrozen(p), false);
  });

  it('does not share reference with DEFAULT_PREFERENCES', () => {
    const p = createDefaultPreferences();
    assert.notEqual(p, DEFAULT_PREFERENCES);
    p.theme = 'dark';
    assert.equal(DEFAULT_PREFERENCES.theme, 'auto');
  });
});
