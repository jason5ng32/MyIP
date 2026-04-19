import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SECTION_IDS,
  DEFAULT_SECTION,
  createMountingStatus,
  createLoadingStatus,
} from '../frontend/data/sections.js';

describe('SECTION_IDS', () => {
  it('lists all 6 section DOM ids in render order', () => {
    assert.deepEqual(SECTION_IDS, [
      'IPInfo',
      'Connectivity',
      'WebRTC',
      'DNSLeakTest',
      'SpeedTest',
      'AdvancedTools',
    ]);
  });

  it('DEFAULT_SECTION is the first entry', () => {
    assert.equal(DEFAULT_SECTION, SECTION_IDS[0]);
  });
});

describe('createMountingStatus()', () => {
  it('returns all 6 mount keys set to false', () => {
    const s = createMountingStatus();
    assert.deepEqual(s, {
      ipcheck: false,
      connectivity: false,
      webrtc: false,
      dnsleaktest: false,
      speedtest: false,
      advancedtools: false,
    });
  });

  it('returns a fresh object each call', () => {
    const a = createMountingStatus();
    const b = createMountingStatus();
    assert.notEqual(a, b);
    a.ipcheck = true;
    assert.equal(b.ipcheck, false);
  });
});

describe('createLoadingStatus()', () => {
  it('returns the 4 loading keys set to false (subset of mounting keys)', () => {
    const s = createLoadingStatus();
    assert.deepEqual(s, {
      ipcheck: false,
      connectivity: false,
      webrtc: false,
      dnsleaktest: false,
    });
  });

  it('returns a fresh object each call', () => {
    const a = createLoadingStatus();
    const b = createLoadingStatus();
    assert.notEqual(a, b);
    a.webrtc = true;
    assert.equal(b.webrtc, false);
  });
});
