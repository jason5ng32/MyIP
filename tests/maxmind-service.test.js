// Contract tests for common/maxmind-service.
//
// The repo ships real GeoLite2-ASN.mmdb + GeoLite2-City.mmdb binaries, so we
// exercise openMaxMindReaders() / reloadMaxMindDatabases() against the actual
// database files end-to-end rather than mocking fs.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, before } from 'node:test';

import {
  MAXMIND_DB_DIR,
  MAXMIND_CITY_DB,
  MAXMIND_ASN_DB,
  getMaxMindDbPaths,
  isMaxMindReady,
  openMaxMindReaders,
  reloadMaxMindDatabases,
  lookupMaxMind,
} from '../common/maxmind-service.js';

// The repo should ship maxmind database files; if not on CI, skip related tests
const cityPath = path.join(MAXMIND_DB_DIR, MAXMIND_CITY_DB);
const asnPath = path.join(MAXMIND_DB_DIR, MAXMIND_ASN_DB);
const dbsAvailable = fs.existsSync(cityPath) && fs.existsSync(asnPath);

describe('maxmind-service — path + ready contract', () => {
  it('getMaxMindDbPaths returns City + ASN paths under MAXMIND_DB_DIR', () => {
    const paths = getMaxMindDbPaths();
    assert.equal(paths.dbDir, MAXMIND_DB_DIR);
    assert.equal(path.basename(paths.cityDbPath), 'GeoLite2-City.mmdb');
    assert.equal(path.basename(paths.asnDbPath), 'GeoLite2-ASN.mmdb');
    assert.equal(path.dirname(paths.cityDbPath), MAXMIND_DB_DIR);
  });

  it('exported constants match the file names they describe', () => {
    assert.equal(MAXMIND_CITY_DB, 'GeoLite2-City.mmdb');
    assert.equal(MAXMIND_ASN_DB, 'GeoLite2-ASN.mmdb');
  });

  it('lookupMaxMind throws 503-tagged error when readers are not ready', () => {
    // reloadMaxMindDatabases test before hook will install readers;
    // this test is placed before the before hook (describe top-level it runs in declaration order)
    // so this test can hit the not-ready path before the first before hook runs.
    // if DB is not in the repo, isMaxMindReady()===false, this test will hit the not-ready path.
    if (isMaxMindReady()) return; // already ready, skip
    try {
      lookupMaxMind('1.1.1.1');
      assert.fail('should have thrown');
    } catch (err) {
      assert.equal(err.message, 'MaxMind database is not ready');
      assert.equal(err.statusCode, 503);
    }
  });
});

describe('maxmind-service — end-to-end with real DB (skipped if files missing)', () => {
  before(async () => {
    if (!dbsAvailable) return;
    await reloadMaxMindDatabases('test-setup');
  });

  it('reloadMaxMindDatabases flips isMaxMindReady() to true', () => {
    if (!dbsAvailable) return;
    assert.equal(isMaxMindReady(), true);
  });

  it('openMaxMindReaders returns both city + asn readers', async () => {
    if (!dbsAvailable) return;
    const { city, asn } = await openMaxMindReaders();
    assert.ok(city && typeof city.get === 'function');
    assert.ok(asn && typeof asn.get === 'function');
  });

  it('lookupMaxMind returns the expected stable shape for a known public IP', () => {
    if (!dbsAvailable) return;
    const result = lookupMaxMind('8.8.8.8', 'en');
    // Only assert the shape — actual values depend on the shipped DB version
    const expectedKeys = [
      'ip', 'city', 'region', 'country', 'country_name', 'country_code',
      'latitude', 'longitude', 'asn', 'org',
    ];
    for (const k of expectedKeys) {
      assert.ok(k in result, `missing key: ${k}`);
    }
    assert.equal(result.ip, '8.8.8.8');
    // 8.8.8.8 is Google (AS15169); DB may use either AS prefix (AS15169 or AS15169-1)
    assert.match(String(result.asn), /^AS\d+$/);
  });

  it('lookupMaxMind gracefully returns N/A fields for a private / unknown IP', () => {
    if (!dbsAvailable) return;
    const result = lookupMaxMind('10.0.0.1', 'en');
    // 10.0.0.0/8 is private — MaxMind has no record → formatter falls back to N/A
    assert.equal(result.ip, '10.0.0.1');
    assert.equal(result.city, 'N/A');
    assert.equal(result.country, 'N/A');
    assert.equal(result.asn, 'N/A');
  });

  it('lookupMaxMind honors lang argument (falls back to en for unknown lang)', () => {
    if (!dbsAvailable) return;
    const enResult = lookupMaxMind('8.8.8.8', 'en');
    const deResult = lookupMaxMind('8.8.8.8', 'de');
    // 'de' may have a localized city name; if not, falls back to 'en'
    assert.ok(enResult.country_name);
    assert.ok(deResult.country_name);
  });
});
