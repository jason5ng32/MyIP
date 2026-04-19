import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  IP_DATABASES,
  createInitialIpDBs,
  buildDbUrl,
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
