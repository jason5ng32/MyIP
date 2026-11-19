import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  transformDataFromIPapi,
  ADVANCED_CARD_FIELDS,
  hasExtendedFields,
} from '../frontend/utils/ip/transform-ip-data.js';

// simple i18n translation stub: return key with prefix for assertions, to verify template references rather than hardcoded translation text
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
      () => transformDataFromIPapi({ error: true, reason: 'nope' }, t, 'en'),
      /nope/,
    );
  });

  it('maps base fields verbatim', () => {
    const out = transformDataFromIPapi(basicRaw, t, 'en');
    assert.equal(out.country_name, 'Japan');
    assert.equal(out.country_code, 'JP');
    assert.equal(out.region, 'Tokyo');
    assert.equal(out.city, 'Shinjuku');
    assert.equal(out.isp, 'Example Telecom');
    assert.equal(out.asn, 'AS12345');
  });

  it('builds bgp.tools asnlink for AS-prefixed ASN', () => {
    const out = transformDataFromIPapi(basicRaw, t, 'en');
    assert.equal(out.asnlink, 'https://bgp.tools/as/AS12345');
  });

  it('returns asnlink=false when ASN is not AS-prefixed', () => {
    const out = transformDataFromIPapi({ ...basicRaw, asn: '12345' }, t, 'en');
    assert.equal(out.asnlink, false);
  });

  it('returns asnlink=false when ASN is missing', () => {
    const { asn, ...noAsn } = basicRaw;
    const out = transformDataFromIPapi(noAsn, t, 'en');
    assert.equal(out.asnlink, false);
    assert.equal(out.asn, '');
  });

  it('omits map URLs when lat/lon missing', () => {
    const { latitude, longitude, ...noCoord } = basicRaw;
    const out = transformDataFromIPapi(noCoord, t, 'en');
    assert.equal(out.mapUrl, '');
    assert.equal(out.mapUrl_dark, '');
  });

  it('keeps a coordinate of 0 and maps it', () => {
    const out = transformDataFromIPapi({ ...basicRaw, latitude: 0, longitude: 0 }, t, 'en');
    assert.equal(out.latitude, 0);
    assert.equal(out.longitude, 0);
    assert.equal(out.mapUrl, '/api/map?latitude=0.0&longitude=0.0&language=en');
  });

  it('omits map URLs when a coordinate is not a number', () => {
    for (const value of ['N/A', '', null, ' ']) {
      const out = transformDataFromIPapi({ ...basicRaw, latitude: value }, t, 'en');
      assert.equal(out.mapUrl, '', JSON.stringify(value));
      assert.equal(out.mapUrl_dark, '', JSON.stringify(value));
    }
    assert.equal(transformDataFromIPapi({ ...basicRaw, latitude: 'N/A' }, t, 'en').latitude, 'N/A');
  });

  it('builds map URLs with language + dark variant when lat/lon present', () => {
    const out = transformDataFromIPapi(basicRaw, t, 'zh');
    // Map request coords are quantized to 1 decimal for CF edge-cache sharing,
    // while the displayed lat/lon keep full precision.
    assert.match(out.mapUrl, /^\/api\/map\?latitude=35\.7&longitude=139\.7&language=zh$/);
    assert.match(out.mapUrl_dark, /CanvasMode=Dark$/);
    assert.equal(out.latitude, '35.6938');
    assert.equal(out.longitude, '139.7034');
  });

  it("treats country='N/A' as empty country_code", () => {
    const out = transformDataFromIPapi({ ...basicRaw, country: 'N/A' }, t, 'en');
    assert.equal(out.country_code, '');
  });

  it('localizes country_name from the code, ignoring the upstream string', () => {
    // upstream said 'Japan' but the UI language is zh → CLDR name wins
    const out = transformDataFromIPapi(basicRaw, t, 'zh');
    assert.equal(out.country_name, '日本');
  });

  it('falls back to the upstream country_name when the code is unusable', () => {
    const na = transformDataFromIPapi({ ...basicRaw, country: 'N/A' }, t, 'zh');
    assert.equal(na.country_name, 'Japan');
    const none = transformDataFromIPapi({ ...basicRaw, country: undefined, country_name: undefined }, t, 'zh');
    assert.equal(none.country_name, '');
  });

  it('adds no extended fields without an extended block', () => {
    const out = transformDataFromIPapi(basicRaw, t, 'en');
    for (const key of ADVANCED_CARD_FIELDS) assert.equal(key in out, false, key);
  });
});

// A full `extended` block (common/ip-extended.js), as any source may send it.
const fullExtended = {
  anonymity: { code: 'vpn', provider: 'Acme', protocol: 'wireguard' },
  lineType: 'hosting',
  native: false,
  score: 72,
  abuse: 'low',
  scenarios: [{ id: 'email', level: 'high' }, { id: 'signup', level: 'low' }],
  scoreDetails: { dimensions: { reputation: { level: 'low' } } },
  flags: { isDatacenter: true, isVPN: true, isAnyAnonymizer: true, isNative: false },
  metrics: [{ id: 'fraudScore', value: 12, max: 100 }, { id: 'abuserScore', value: '0.0021 (Low)' }],
};
const withExtended = (extended) => transformDataFromIPapi({ ...basicRaw, extended }, t, 'en');

describe('extended block → card fields', () => {
  it('maps a full block onto the card fields, any source', () => {
    const out = withExtended(fullExtended);
    assert.equal(out.extendedGate, undefined);
    assert.equal(out.anonymity, '<ipInfos.anonymity.vpn>');
    assert.equal(out.anonymityCode, 'vpn');
    assert.equal(out.anonymityProvider, 'Acme');
    assert.equal(out.anonymityProtocol, 'wireguard');
    assert.equal(out.type, '<ipInfos.advancedData.type.Hosting>');
    assert.equal(out.ipTypeCode, 'hosting');
    assert.equal(out.isNativeIP, false);
    assert.equal(out.qualityScore, 72);
    assert.equal(out.abuseLevel, 'low');
    assert.equal(out.flags, fullExtended.flags);
    assert.equal(out.scoreDimensions, fullExtended.scoreDetails.dimensions);
    assert.equal(out.sourceMetrics, fullExtended.metrics);
    // Base fields stay as they are.
    assert.equal(out.country_code, 'JP');
    assert.equal(out.asn, 'AS12345');
  });

  it('orders friction scenarios for display, with their kind', () => {
    const out = withExtended({ scenarios: [{ id: 'email', level: 'high' }, { id: 'availability', level: 'medium' }, { id: 'signup', level: 'low' }] });
    assert.deepEqual(out.frictionScenarios, [
      { id: 'signup', level: 'low' },
      { id: 'availability', kind: 'availability', level: 'medium' },
      { id: 'email', level: 'high' },
    ]);
  });

  it('carries the gate alone, every display field absent', () => {
    for (const gate of ['auth', 'quota', 'cooldown']) {
      const out = withExtended({ gate });
      assert.equal(out.extendedGate, gate);
      for (const key of ADVANCED_CARD_FIELDS.filter((field) => field !== 'extendedGate')) {
        assert.equal(out[key], undefined, `${gate}: ${key}`);
      }
    }
  });

  it('labels an unknown line type with the unknown label and keeps its code', () => {
    const out = withExtended({ lineType: 'unknown' });
    assert.equal(out.type, '<ipInfos.advancedData.type.unknownType>');
    assert.equal(out.ipTypeCode, 'unknown');
  });

  it('keeps provider / protocol null when the block named no service', () => {
    const out = withExtended({ anonymity: { code: 'none' }, lineType: 'residential', score: 80 });
    assert.equal(out.anonymity, '<ipInfos.anonymity.none>');
    assert.equal(out.anonymityProvider, null);
    assert.equal(out.anonymityProtocol, null);
  });

  it('maps flags alone', () => {
    const flagsOnly = withExtended({ flags: { isMobile: true } });
    assert.deepEqual(flagsOnly.flags, { isMobile: true });
    assert.equal(flagsOnly.sourceMetrics, undefined);
    assert.equal(hasExtendedFields(flagsOnly), true);
  });

  it('maps metrics alone, and a reset to another answer clears them', () => {
    const out = withExtended({ metrics: [{ id: 'fraudScore', value: 0 }] });
    assert.deepEqual(out.sourceMetrics, [{ id: 'fraudScore', value: 0 }]);
    assert.equal(hasExtendedFields(out), true);
    assert.equal(hasExtendedFields({ sourceMetrics: [] }), true);
    assert.ok(ADVANCED_CARD_FIELDS.includes('sourceMetrics'));
    assert.equal(withExtended({ lineType: 'hosting' }).sourceMetrics, undefined);
    assert.equal(withExtended({ gate: 'auth' }).sourceMetrics, undefined);
  });

  it('localizes the plain yes of anonymity and abuse', () => {
    const out = withExtended({ anonymity: { code: 'detected', provider: 'Acme' }, abuse: 'detected' });
    assert.equal(out.anonymity, '<ipInfos.anonymity.detected>');
    assert.equal(out.anonymityCode, 'detected');
    assert.equal(out.anonymityProvider, 'Acme');
    assert.equal(out.abuseLevel, 'detected');
  });

  it('leaves the fields a partial block does not carry undefined', () => {
    const out = withExtended({ score: 'unknown' });
    assert.equal(out.qualityScore, 'unknown');
    for (const key of ['anonymity', 'anonymityCode', 'type', 'ipTypeCode', 'isNativeIP', 'abuseLevel', 'flags', 'scoreDimensions', 'sourceMetrics']) {
      assert.equal(out[key], undefined, key);
    }
    assert.equal(out.frictionScenarios, null);
  });

  it('ignores a malformed block as if absent', () => {
    for (const extended of [null, 'auth', [], { gate: 'locked' }, { gate: 'auth', score: 10 },
      { score: 101 }, { lineType: 'Hosting' }, { anonymity: { code: 'cloak' } }, { extra: true },
      { flags: { isBogon: true } }, { details: [{ group: 'weather', rows: [{ key: 'k', value: 'v' }] }] },
      { metrics: [{ id: 'trustScore', value: 1 }] }]) {
      const out = withExtended(extended);
      for (const key of ADVANCED_CARD_FIELDS) assert.equal(key in out, false, `${JSON.stringify(extended)}: ${key}`);
    }
  });

  it('every anonymity code has a label in the en pack and is a report code', async () => {
    const { ANONYMITY_I18N_KEYS } = await import('../frontend/utils/codes/ip-labels.js');
    const { ANONYMITY_CODES } = await import('../common/codes/ip.js');
    const fs = await import('node:fs');
    const en = JSON.parse(fs.readFileSync(new URL('../frontend/locales/en.json', import.meta.url), 'utf8'));
    const resolve = (path) => path.split('.').reduce((node, part) => node?.[part], en);
    assert.deepEqual(Object.keys(ANONYMITY_I18N_KEYS).sort(), [...ANONYMITY_CODES].sort());
    for (const code of ANONYMITY_CODES) {
      assert.equal(typeof resolve(ANONYMITY_I18N_KEYS[code]), 'string', code);
      assert.equal(withExtended({ anonymity: { code } }).anonymity, `<${ANONYMITY_I18N_KEYS[code]}>`);
    }
    assert.equal(typeof resolve('ipInfos.anonymity.label'), 'string');
  });
});

describe('ADVANCED_CARD_FIELDS', () => {
  // The card reset clears exactly these keys, so they must be every key an
  // extended block can add — full or gated.
  it('is exactly what an extended block adds over the base fields', () => {
    const base = Object.keys(transformDataFromIPapi(basicRaw, t, 'en'));
    for (const extended of [fullExtended, { gate: 'auth' }]) {
      const added = Object.keys(withExtended(extended)).filter((key) => !base.includes(key));
      assert.deepEqual(added.sort(), [...ADVANCED_CARD_FIELDS].sort());
    }
  });

  it('adds the gate and abuse level, no score version', () => {
    assert.ok(ADVANCED_CARD_FIELDS.includes('extendedGate'));
    assert.ok(ADVANCED_CARD_FIELDS.includes('abuseLevel'));
    assert.equal(ADVANCED_CARD_FIELDS.includes('scoreVersion'), false);
  });
});

describe('hasExtendedFields()', () => {
  it('is false for a card without an extended block', () => {
    assert.equal(hasExtendedFields(transformDataFromIPapi(basicRaw, t, 'en')), false);
  });

  it('is true for a gated or a full block', () => {
    assert.equal(hasExtendedFields(withExtended({ gate: 'auth' })), true);
    assert.equal(hasExtendedFields(withExtended(fullExtended)), true);
  });

  it('is false for a valid but empty block', () => {
    assert.equal(hasExtendedFields(withExtended({})), false);
  });

  it('is false for a missing card', () => {
    assert.equal(hasExtendedFields(null), false);
    assert.equal(hasExtendedFields(undefined), false);
  });

  it('counts false and 0 as present', () => {
    assert.equal(hasExtendedFields({ isNativeIP: false }), true);
    assert.equal(hasExtendedFields({ qualityScore: 0 }), true);
  });
});
