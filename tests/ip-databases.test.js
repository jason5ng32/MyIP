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
  it('has 7 unique sequential ids', () => {
    assert.equal(IP_DATABASES.length, 7);
    const ids = IP_DATABASES.map((d) => d.id);
    assert.deepEqual(ids, [0, 1, 2, 3, 4, 5, 6]);
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
  const configs = { ipChecking: true, ipInfo: false, ipapiis: false, ip2location: true };

  it('follows the configKey flag for keyed sources', () => {
    const out = applyConfigAvailability(createInitialIpDBs(), configs);
    const byId = Object.fromEntries(out.map((db) => [db.id, db.enabled]));
    assert.equal(byId[0], true);   // ipChecking: true
    assert.equal(byId[1], false);  // ipInfo: false
    assert.equal(byId[3], false);  // ipapiis: false
    assert.equal(byId[4], true);   // ip2location: true
  });

  it('keeps key-free sources always enabled', () => {
    const allOff = applyConfigAvailability(createInitialIpDBs(),
      { ipChecking: false, ipInfo: false, ipapiis: false, ip2location: false });
    for (const id of [2, 5, 6]) {
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
    assert.equal(nearestEnabledId(3, dbs([0, 3, 6])), 3);
  });

  it('walks forward to the next available source', () => {
    assert.equal(nearestEnabledId(1, dbs([0, 4, 5])), 4);
  });

  it('wraps around past the end of the list', () => {
    assert.equal(nearestEnabledId(6, dbs([1])), 1);
  });

  it('starts from the head for unknown ids', () => {
    assert.equal(nearestEnabledId(42, dbs([2, 5])), 2);
  });

  it('leaves the preference unchanged when nothing is enabled', () => {
    assert.equal(nearestEnabledId(3, dbs([])), 3);
    assert.equal(nearestEnabledId(0, []), 0);
  });
});
