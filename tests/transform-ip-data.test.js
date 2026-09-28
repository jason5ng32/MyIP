import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  transformDataFromIPapi,
  extractAdvancedData,
} from '../frontend/utils/transform-ip-data.js';

// simple i18n translation stub: return key with prefix for assertions, to verify template references rather than hardcoded translation text
const t = (key) => `<${key}>`;

// v3 tags with nothing flagged.
const cleanTags = {
  isBogon: false, isMobile: false, isResidential: false, isSatellite: false,
  isCrawler: false, isBenignBot: false, isDatacenter: false, isTor: false,
  isProxy: false, isVPN: false, isAnyAnonymizer: false, isRelay: false,
  isResidentialProxy: false, isAbuser: false, isNative: true,
};

const basicRaw = {
  country_name: 'Japan',
  country: 'JP',
  region: 'Tokyo',
  city: 'Shinjuku',
  latitude: '35.6938',
  longitude: '139.7034',
  org: 'Example Telecom',
  asn: 'AS12345',
};

describe('transformDataFromIPapi()', () => {
  it('throws when raw payload carries an error', () => {
    assert.throws(
      () => transformDataFromIPapi({ error: true, reason: 'nope' }, 1, t, 'en'),
      /nope/,
    );
  });

  it('maps base fields verbatim for non-source-0 callers', () => {
    const out = transformDataFromIPapi(basicRaw, 1, t, 'en');
    assert.equal(out.country_name, 'Japan');
    assert.equal(out.country_code, 'JP');
    assert.equal(out.region, 'Tokyo');
    assert.equal(out.city, 'Shinjuku');
    assert.equal(out.isp, 'Example Telecom');
    assert.equal(out.asn, 'AS12345');
  });

  it('builds bgp.tools asnlink for AS-prefixed ASN', () => {
    const out = transformDataFromIPapi(basicRaw, 1, t, 'en');
    assert.equal(out.asnlink, 'https://bgp.tools/as/AS12345');
  });

  it('returns asnlink=false when ASN is not AS-prefixed', () => {
    const out = transformDataFromIPapi({ ...basicRaw, asn: '12345' }, 1, t, 'en');
    assert.equal(out.asnlink, false);
  });

  it('returns asnlink=false when ASN is missing', () => {
    const { asn, ...noAsn } = basicRaw;
    const out = transformDataFromIPapi(noAsn, 1, t, 'en');
    assert.equal(out.asnlink, false);
    assert.equal(out.asn, '');
  });

  it('omits map URLs when lat/lon missing', () => {
    const { latitude, longitude, ...noCoord } = basicRaw;
    const out = transformDataFromIPapi(noCoord, 1, t, 'en');
    assert.equal(out.mapUrl, '');
    assert.equal(out.mapUrl_dark, '');
  });

  it('builds map URLs with language + dark variant when lat/lon present', () => {
    const out = transformDataFromIPapi(basicRaw, 1, t, 'zh');
    // Map request coords are quantized to 1 decimal for CF edge-cache sharing,
    // while the displayed lat/lon keep full precision.
    assert.match(out.mapUrl, /^\/api\/map\?latitude=35\.7&longitude=139\.7&language=zh$/);
    assert.match(out.mapUrl_dark, /CanvasMode=Dark$/);
    assert.equal(out.latitude, '35.6938');
    assert.equal(out.longitude, '139.7034');
  });

  it("treats country='N/A' as empty country_code", () => {
    const out = transformDataFromIPapi({ ...basicRaw, country: 'N/A' }, 1, t, 'en');
    assert.equal(out.country_code, '');
  });

  it('localizes country_name from the code, ignoring the upstream string', () => {
    // upstream said 'Japan' but the UI language is zh → CLDR name wins
    const out = transformDataFromIPapi(basicRaw, 1, t, 'zh');
    assert.equal(out.country_name, '日本');
  });

  it('falls back to the upstream country_name when the code is unusable', () => {
    const na = transformDataFromIPapi({ ...basicRaw, country: 'N/A' }, 1, t, 'zh');
    assert.equal(na.country_name, 'Japan');
    const none = transformDataFromIPapi({ ...basicRaw, country: undefined, country_name: undefined }, 1, t, 'zh');
    assert.equal(none.country_name, '');
  });

  it('merges advancedData when ipGeoSource === 0', () => {
    const withAdvanced = {
      ...basicRaw,
      advancedData: {
        tags: { ...cleanTags },
        operatorType: 'Business',
        score: 92,
        anonymityProtocol: 'http',
        anonymityProvider: 'Acme',
        dimensions: { anonymity: { class: null, sources: null, firstSeen: null, lastSeen: null } },
      },
    };
    const out = transformDataFromIPapi(withAdvanced, 0, t, 'en');
    assert.equal(out.anonymity, '<ipInfos.anonymity.none>');
    assert.equal(out.anonymityCode, 'none');
    assert.equal(out.type, '<ipInfos.advancedData.type.Business>');
    assert.equal(out.qualityScore, 92);
    assert.equal(out.anonymityProtocol, 'http');
    assert.equal(out.anonymityProvider, 'Acme');
    assert.equal(out.isNativeIP, true);
  });
});

describe('extractAdvancedData()', () => {
  it('propagates sign_in_required sentinel verbatim for type / qualityScore / isNativeIP / anonymity', () => {
    const out = extractAdvancedData({
      tags: 'sign_in_required',
      score: 'sign_in_required',
      operatorType: 'sign_in_required',
      anonymityProvider: 'sign_in_required',
      anonymityProtocol: 'sign_in_required',
    }, t);
    assert.equal(out.anonymity, 'sign_in_required');
    assert.equal(out.type, 'sign_in_required');
    assert.equal(out.qualityScore, 'sign_in_required');
    assert.equal(out.isNativeIP, 'sign_in_required');
    // Sentinels never pose as a service name.
    assert.equal(out.anonymityProvider, null);
    assert.equal(out.anonymityProtocol, null);
  });

  it('propagates quota_exceeded sentinel verbatim, and drops the report codes', () => {
    const out = extractAdvancedData({
      tags: 'quota_exceeded',
      score: 'quota_exceeded',
      operatorType: 'quota_exceeded',
      anonymityProtocol: 'quota_exceeded',
    }, t);
    assert.equal(out.anonymity, 'quota_exceeded');
    assert.equal(out.type, 'quota_exceeded');
    assert.equal(out.qualityScore, 'quota_exceeded');
    assert.equal(out.isNativeIP, 'quota_exceeded');
    // Locale-free report codes must be absent for gated data.
    assert.equal(out.anonymityCode, undefined);
    assert.equal(out.ipTypeCode, undefined);
  });

  it('keeps provider / protocol null when the API named no service', () => {
    const out = extractAdvancedData({
      tags: { ...cleanTags }, operatorType: 'Residential', score: 80,
      anonymityProvider: null, anonymityProtocol: null,
    }, t);
    assert.equal(out.anonymityProvider, null);
    assert.equal(out.anonymityProtocol, null);
    const missing = extractAdvancedData({ tags: { ...cleanTags }, operatorType: 'Residential', score: 80 }, t);
    assert.equal(missing.anonymityProvider, null);
  });

  describe('anonymity verdict (display text + report code agree)', () => {
    const verdict = (tags, anonymity) => {
      const out = extractAdvancedData({
        tags, operatorType: 'Hosting', score: 50, anonymityProtocol: 'socks5',
        ...(anonymity !== undefined ? { dimensions: { anonymity } } : {}),
      }, t);
      return [out.anonymity, out.anonymityCode];
    };
    const key = (name) => `<ipInfos.anonymity.${name}>`;
    const anon = (cls, sources = 'single') => ({ class: cls, sources, firstSeen: null, lastSeen: null });

    it('Tor first, then iCloud Private Relay', () => {
      assert.deepEqual(verdict({ ...cleanTags, isAnyAnonymizer: true, isTor: true, isProxy: true }, anon('tor', 'multi')),
        [key('tor'), 'tor']);
      assert.deepEqual(verdict({ ...cleanTags, isAnyAnonymizer: true, isRelay: true }, anon('relay')),
        [key('relay'), 'relay']);
    });

    it('confirmed residential proxy', () => {
      const tags = { ...cleanTags, isProxy: true, isAnyAnonymizer: true, isResidentialProxy: true };
      assert.deepEqual(verdict(tags, anon('residential_proxy', 'multi')), [key('residential'), 'residential']);
    });

    it('proxy class: multi → proxy, otherwise possible proxy', () => {
      const tags = { ...cleanTags, isProxy: true, isAnyAnonymizer: true };
      assert.deepEqual(verdict(tags, anon('proxy', 'multi')), [key('proxy'), 'proxy']);
      assert.deepEqual(verdict(tags, anon('proxy', 'single')), [key('proxySuspected'), 'proxy_suspected']);
      assert.deepEqual(verdict(tags, anon('proxy', null)), [key('proxySuspected'), 'proxy_suspected']);
    });

    it('vpn class: multi → VPN, otherwise possible VPN (isProxy may be true too)', () => {
      const tags = { ...cleanTags, isVPN: true, isProxy: true, isAnyAnonymizer: true };
      assert.deepEqual(verdict(tags, anon('vpn', 'multi')), [key('vpn'), 'vpn']);
      assert.deepEqual(verdict(tags, anon('vpn', 'single')), [key('vpnSuspected'), 'vpn_suspected']);
    });

    it('residential proxy only our sighting history reports → suspected', () => {
      assert.deepEqual(verdict({ ...cleanTags, isResidentialProxy: true }, anon('residential_proxy')),
        [key('suspectedResidential'), 'suspected_residential']);
    });

    it('nothing detected → none (also without dimensions)', () => {
      assert.deepEqual(verdict(cleanTags, { class: null, sources: null }), [key('none'), 'none']);
      assert.deepEqual(verdict(cleanTags), [key('none'), 'none']);
    });

    it('every code has a label in the en pack and is a report code', async () => {
      const { ANONYMITY_I18N_KEYS } = await import('../frontend/utils/transform-ip-data.js');
      const { ANONYMITY_CODES } = await import('../common/report-schema.js');
      const fs = await import('node:fs');
      const en = JSON.parse(fs.readFileSync(new URL('../frontend/locales/en.json', import.meta.url), 'utf8'));
      const resolve = (path) => path.split('.').reduce((node, part) => node?.[part], en);
      assert.deepEqual(Object.keys(ANONYMITY_I18N_KEYS).sort(), [...ANONYMITY_CODES].sort());
      for (const code of ANONYMITY_CODES) {
        assert.equal(typeof resolve(ANONYMITY_I18N_KEYS[code]), 'string', code);
      }
      assert.equal(typeof resolve('ipInfos.anonymity.label'), 'string');
    });
  });

  it('passes tags / dimensions / scoreVersion through for the score-details panel', () => {
    const dimensions = {
      reputation: { level: 'none', lastSeen: null },
      anonymity: { class: null, sources: null, firstSeen: null, lastSeen: null },
      network: { level: 'low', asn: 18144 },
    };
    const tags = { ...cleanTags };
    const out = extractAdvancedData({ tags, operatorType: 'Business', score: 90, scoreVersion: 3, dimensions }, t);
    assert.equal(out.scoreTags, tags);
    assert.equal(out.scoreDimensions, dimensions);
    assert.equal(out.scoreVersion, 3);
  });

  it('leaves the score-details fields undefined when gated', () => {
    const gated = extractAdvancedData({ tags: 'quota_exceeded', score: 'quota_exceeded', operatorType: 'quota_exceeded' }, t);
    assert.equal(gated.scoreTags, undefined);
    assert.equal(gated.scoreDimensions, undefined);
    assert.equal(gated.scoreVersion, undefined);
  });
});
