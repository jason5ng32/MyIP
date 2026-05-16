import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SECTION_IDS,
  createMountingStatus,
  createLoadingStatus,
} from '../frontend/data/sections.js';

describe('SECTION_IDS', () => {
  it('lists all 6 section DOM ids in render order', () => {
    assert.deepEqual(SECTION_IDS, [
      'IPInfo',
      'Connectivity',
      'DNSLeakTest',
      'WebRTC',
      'SpeedTest',
      'AdvancedTools',
    ]);
  });

});

describe('createMountingStatus()', () => {
  it('returns all 6 section ids as mount keys, set to false', () => {
    const s = createMountingStatus();
    assert.deepEqual(s, {
      IPInfo: false,
      Connectivity: false,
      DNSLeakTest: false,
      WebRTC: false,
      SpeedTest: false,
      AdvancedTools: false,
    });
  });

  it('returns a fresh object each call', () => {
    const a = createMountingStatus();
    const b = createMountingStatus();
    assert.notEqual(a, b);
    a.IPInfo = true;
    assert.equal(b.IPInfo, false);
  });
});

describe('createLoadingStatus()', () => {
  it('returns the 4 loading section ids set to false (subset of mounting keys)', () => {
    const s = createLoadingStatus();
    assert.deepEqual(s, {
      IPInfo: false,
      Connectivity: false,
      DNSLeakTest: false,
      WebRTC: false,
    });
  });

  it('returns a fresh object each call', () => {
    const a = createLoadingStatus();
    const b = createLoadingStatus();
    assert.notEqual(a, b);
    a.WebRTC = true;
    assert.equal(b.WebRTC, false);
  });
});
