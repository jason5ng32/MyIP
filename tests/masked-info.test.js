import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { maskedInfo } from '../frontend/utils/masked-info.js';

// 简单 i18n 翻译桩：直接返回 key，便于断言模板引用而非硬编码翻译文本
const t = (key) => `<${key}>`;

describe('maskedInfo(t)', () => {
  const card = maskedInfo(t);

  it('returns a frozen-by-shape card with all expected keys', () => {
    const expectedKeys = [
      'ipv4', 'ipv6', 'dnsendpoints', 'webrtcip',
      'country_name', 'country_code', 'region', 'city',
      'latitude', 'longitude', 'isp', 'asn', 'asnlink',
      'mapUrl', 'mapUrl_dark',
      'showASNInfo', 'isProxy', 'type', 'isNativeIP',
      'qualityScore', 'proxyProtocol', 'proxyOperator',
    ];
    for (const key of expectedKeys) {
      assert.ok(key in card, `missing key: ${key}`);
    }
  });

  it('uses well-known public dummy IPs', () => {
    assert.equal(card.ipv4, '8.8.8.8');
    assert.equal(card.ipv6, '2001:4860:4860::8888');
  });

  it('geo fields describe Mountain View, US', () => {
    assert.equal(card.country_name, 'United States');
    assert.equal(card.country_code, 'US');
    assert.equal(card.region, 'California');
    assert.equal(card.city, 'Mountain View');
  });

  it('asnlink points to bgp.tools AS15169 (Google)', () => {
    assert.equal(card.asnlink, 'https://bgp.tools/as/AS15169');
  });

  it('default map URLs are relative', () => {
    assert.equal(card.mapUrl, '/res/defaultMap.webp');
    assert.equal(card.mapUrl_dark, '/res/defaultMap_dark.webp');
  });

  it('quality score is a perfect 100', () => {
    assert.equal(card.qualityScore, 100);
  });

  it('runs translator for i18n-backed fields', () => {
    assert.equal(card.isProxy, '<ipInfos.advancedData.proxyNo>');
    assert.equal(card.type, '<ipInfos.advancedData.type.Business>');
    assert.equal(card.proxyProtocol, '<ipInfos.advancedData.proxyUnknownProtocol>');
  });

  it('returns a fresh object each call', () => {
    assert.notStrictEqual(maskedInfo(t), maskedInfo(t));
  });
});
