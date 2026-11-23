import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  IP_DATABASES,
  createInitialIpDBs,
  buildDbUrl,
  applyConfigAvailability,
  nearestEnabledId,
} from '../frontend/data/ip-databases.js';

describe('IP_DATABASES', () => {
  it('has 7 unique ids covering 0–6', () => {
    assert.equal(IP_DATABASES.length, 7);
    const ids = IP_DATABASES.map((d) => d.id);
    assert.deepEqual([...ids].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6]);
  });

  // ids are stored in visitors' preferences: reordering the list must never
  // move an id to another source.
  it('keeps each source on its stored id', () => {
    const idByName = Object.fromEntries(IP_DATABASES.map((d) => [d.text, d.id]));
    assert.deepEqual(idByName, {
      'IPCheck.ing': 0,
      'IPAPI.is': 1,
      'IP2Location.io': 2,
      'IP-API.com': 3,
      BigDataCloud: 4,
      'IPLocate.io': 5,
      MaxMind: 6,
    });
  });

  it('marks the sources whose answer carries the extended block', () => {
    const extended = IP_DATABASES.filter((d) => d.extended === true).map((d) => d.id);
    assert.deepEqual([...extended].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
    for (const db of IP_DATABASES) assert.ok(db.extended === undefined || db.extended === true, db.text);
  });

  it('gives every source an https attribution link', () => {
    for (const db of IP_DATABASES) {
      assert.deepEqual(Object.keys(db.attribution), ['url'], db.text);
      assert.equal(new URL(db.attribution.url).protocol, 'https:', db.text);
    }
  });

  it('ties only the IPCheck.ing source to a metered feature (ipinfo)', () => {
    const metered = IP_DATABASES.filter((d) => 'quotaKey' in d).map((d) => [d.text, d.quotaKey]);
    assert.deepEqual(metered, [['IPCheck.ing', 'ipinfo']]);
  });

  it('every entry has url + text + enabled fields', () => {
    for (const db of IP_DATABASES) {
      assert.ok(db.text);
      assert.ok(db.url.startsWith('/api/'));
      assert.equal(typeof db.enabled, 'boolean');
    }
  });
});

describe('createInitialIpDBs()', () => {
  it('returns fresh array and fresh entries', () => {
    const a = createInitialIpDBs();
    const b = createInitialIpDBs();
    assert.notEqual(a, b);
    assert.notEqual(a[0], b[0]);
    a[0].enabled = false;
    assert.equal(b[0].enabled, true, 'mutating one copy must not affect the other');
    assert.equal(IP_DATABASES[0].enabled, true, 'must not mutate the static definition');
  });
});

describe('buildDbUrl()', () => {
  const db = { id: 0, url: '/api/x?ip={{ip}}&lang={{lang}}' };

  it('substitutes {{ip}} and {{lang}}', () => {
    assert.equal(buildDbUrl(db, '1.1.1.1', 'zh'), '/api/x?ip=1.1.1.1&lang=zh');
  });

  it('defaults lang to "en" when falsy', () => {
    assert.equal(buildDbUrl(db, '1.1.1.1', undefined), '/api/x?ip=1.1.1.1&lang=en');
    assert.equal(buildDbUrl(db, '1.1.1.1', ''), '/api/x?ip=1.1.1.1&lang=en');
    assert.equal(buildDbUrl(db, '1.1.1.1', null), '/api/x?ip=1.1.1.1&lang=en');
  });

  it('handles urls without {{lang}} placeholder', () => {
    const noLangDb = { url: '/api/y?ip={{ip}}' };
    assert.equal(buildDbUrl(noLangDb, '8.8.8.8', 'zh'), '/api/y?ip=8.8.8.8');
  });

  it('returns null for missing db', () => {
    assert.equal(buildDbUrl(null, '1.1.1.1', 'en'), null);
    assert.equal(buildDbUrl(undefined, '1.1.1.1', 'en'), null);
    assert.equal(buildDbUrl({}, '1.1.1.1', 'en'), null);
  });
});

describe('applyConfigAvailability()', () => {
  // Shape of a real /api/configs payload (booleans only).
  const configs = { ipChecking: true, iplocate: false, bigdatacloud: true, ipapiis: false, ip2locationio: true };

  it('follows the configKey flag for keyed sources', () => {
    const out = applyConfigAvailability(createInitialIpDBs(), configs);
    const byId = Object.fromEntries(out.map((db) => [db.id, db.enabled]));
    assert.equal(byId[0], true);   // ipChecking: true
    assert.equal(byId[1], false);  // ipapiis: false
    assert.equal(byId[2], true);   // ip2locationio: true
    assert.equal(byId[4], true);   // bigdatacloud: true
    assert.equal(byId[5], false);  // iplocate: false
  });

  it('drops IPCheck.ing (id 0) when ipChecking is false', () => {
    const out = applyConfigAvailability(createInitialIpDBs(), { ...configs, ipChecking: false });
    assert.equal(out.find((db) => db.id === 0).enabled, false);
  });

  it('keeps key-free sources always enabled', () => {
    const allOff = applyConfigAvailability(createInitialIpDBs(),
      { ipChecking: false, iplocate: false, bigdatacloud: false, ipapiis: false, ip2locationio: false });
    for (const id of [3, 6]) {
      assert.equal(allOff.find((db) => db.id === id).enabled, true, `id ${id} must stay enabled`);
    }
  });

  it('returns fresh entries without mutating the input', () => {
    const input = createInitialIpDBs();
    const out = applyConfigAvailability(input, configs);
    assert.notEqual(out, input);
    assert.notEqual(out[1], input[1]);
    assert.equal(input[1].enabled, true, 'input must be untouched');
  });
});

describe('nearestEnabledId()', () => {
  const dbs = (enabledIds) =>
    createInitialIpDBs().map((db) => ({ ...db, enabled: enabledIds.includes(db.id) }));

  it('keeps the preference when it is still available', () => {
    assert.equal(nearestEnabledId(1, dbs([0, 1, 6])), 1);
  });

  it('walks forward to the next available source', () => {
    assert.equal(nearestEnabledId(1, dbs([0, 3, 4])), 3);
  });

  it('wraps around past the end of the list', () => {
    assert.equal(nearestEnabledId(6, dbs([5])), 5);
  });

  it('starts from the head for unknown ids', () => {
    assert.equal(nearestEnabledId(42, dbs([3, 4])), 3);
  });

  it('leaves the preference unchanged when nothing is enabled', () => {
    assert.equal(nearestEnabledId(1, dbs([])), 1);
    assert.equal(nearestEnabledId(0, []), 0);
  });
});
