import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  transformDataFromIPapi,
  extractAdvancedData,
} from '../frontend/utils/transform-ip-data.js';

// i18n 桩：返回带前缀的 key，便于断言是走了 t(...) 而不是硬编码
const t = (key) => `<${key}>`;

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
    assert.match(out.mapUrl, /^\/api\/map\?latitude=35\.6938&longitude=139\.7034&language=zh$/);
    assert.match(out.mapUrl_dark, /CanvasMode=Dark$/);
  });

  it("treats country='N/A' as empty country_code", () => {
    const out = transformDataFromIPapi({ ...basicRaw, country: 'N/A' }, 1, t, 'en');
    assert.equal(out.country_code, '');
  });

  it('merges advancedData when ipGeoSource === 0', () => {
    const withAdvanced = {
      ...basicRaw,
      advancedData: {
        tags: { isProxyOrVPN: false, isNative: true },
        operatorType: 'Business',
        score: 92,
        proxyProtocol: 'http',
        proxyProvider: 'Acme',
      },
    };
    const out = transformDataFromIPapi(withAdvanced, 0, t, 'en');
    assert.equal(out.isProxy, '<ipInfos.advancedData.proxyNo>');
    assert.equal(out.type, '<ipInfos.advancedData.type.Business>');
    assert.equal(out.qualityScore, 92);
    assert.equal(out.proxyProtocol, 'http');
    assert.equal(out.proxyOperator, 'Acme');
    assert.equal(out.isNativeIP, true);
  });
});

describe('extractAdvancedData()', () => {
  it('propagates sign_in_required sentinel verbatim for qualityScore / isNativeIP / isProxy', () => {
    const out = extractAdvancedData({
      tags: 'sign_in_required',
      score: 'sign_in_required',
      operatorType: 'Business',
      proxyProtocol: 'http',
    }, t);
    assert.equal(out.isProxy, 'sign_in_required');
    assert.equal(out.qualityScore, 'sign_in_required');
    assert.equal(out.isNativeIP, 'sign_in_required');
  });

  it("classifies isProxy='proxyYes' for VPN + known protocol", () => {
    const out = extractAdvancedData({
      tags: { isProxyOrVPN: true, isNative: false },
      operatorType: 'VPN',
      score: 10,
      proxyProtocol: 'http',
    }, t);
    assert.equal(out.isProxy, '<ipInfos.advancedData.proxyYes>');
  });

  it("classifies isProxy='proxyMaybe' for VPN with unknown protocol", () => {
    const out = extractAdvancedData({
      tags: { isProxyOrVPN: true, isNative: false },
      operatorType: 'VPN',
      score: 10,
      proxyProtocol: 'unknown',
    }, t);
    assert.equal(out.isProxy, '<ipInfos.advancedData.proxyMaybe>');
  });

  it('falls back type to operatorType for non-standard values', () => {
    const out = extractAdvancedData({
      tags: { isProxyOrVPN: false, isNative: true },
      operatorType: 'CustomType',
      score: 50,
      proxyProtocol: 'unknown',
    }, t);
    assert.equal(out.type, 'CustomType');
  });

  it('downgrades VPN with unknown protocol to Hosting type', () => {
    const out = extractAdvancedData({
      tags: { isProxyOrVPN: true, isNative: false },
      operatorType: 'VPN',
      score: 10,
      proxyProtocol: 'unknown',
    }, t);
    assert.equal(out.type, '<ipInfos.advancedData.type.Hosting>');
  });

  it('falls back proxyProtocol to unknown i18n when missing', () => {
    const out = extractAdvancedData({
      tags: { isProxyOrVPN: false, isNative: true },
      operatorType: 'Residential',
      score: 80,
    }, t);
    assert.equal(out.proxyProtocol, '<ipInfos.advancedData.proxyUnknownProtocol>');
  });
});
