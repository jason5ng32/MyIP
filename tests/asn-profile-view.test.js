// Tests for frontend/utils/asn-profile-view.js — the ASN Profile page's
// pure shaping over the one /api/asn-profile response: which sections
// render, hero identity and key facts, registration rows, customer cone,
// RPKI summary, prefix rows, country shares, neighbour groups, the
// reputation meters and the PeeringDB hero / facts / lists.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseCount, pickCountryCode, rdapDay,
  ASN_PROFILE_VERSION, asnProfileUrl, sectionData, isProfileEmpty, failedSources,
  hasTopology, isTier1Origin,
  heroIdentity, registrationFields, keyFacts, coneAsns,
  normalizeRpki, shapePrefixRows, familyCounts, filterPrefixRows, rpkiSummary, prefixListText,
  countryShareRows, neighbourGroups,
  ratioPosition, BASELINE_POSITION, reputationMeters, proxyListedCount, verdictLevel, VERDICT_TONE,
  PEERING_ENUMS, peeringEnumKey, websiteLink, peeringHero, peeringFacts, formatPortSpeed,
  exchangeRows, facilityRows, hasPeeringCard, visibleRows,
} from '../frontend/utils/asn-profile-view.js';
import en from '../frontend/locales/en.json' with { type: 'json' };

describe('parseCount', () => {
  it('reads server-formatted integers', () => {
    assert.equal(parseCount('2,346'), 2346);
    assert.equal(parseCount('2.346'), 2346);
    assert.equal(parseCount('0'), 0);
    assert.equal(parseCount(4200000), 4200000);
  });

  it('missing or digit-free is null', () => {
    for (const raw of [undefined, null, '', 'NaN', NaN, {}]) assert.equal(parseCount(raw), null, String(raw));
  });
});

describe('pickCountryCode / rdapDay', () => {
  it('takes the first alpha-2 code, upper-cased', () => {
    assert.equal(pickCountryCode(null, 'us', 'DE'), 'US');
    assert.equal(pickCountryCode('', 'USA', undefined), null);
  });

  it('keeps the registry-local calendar day', () => {
    assert.equal(rdapDay('2010-07-14T18:35:57-04:00'), '2010-07-14');
    assert.equal(rdapDay('2017-02-17'), '2017-02-17');
    assert.equal(rdapDay(null), null);
    assert.equal(rdapDay('July 2010'), null);
  });
});

describe('response helpers', () => {
  const profile = {
    asn: 64500,
    status: { radar: 'ok', prefixes: 'empty', connectivity: 'error', whois: 'ok', rank: 'error', reputation: 'disabled' },
    radar: { asnName: 'X' }, prefixes: null, connectivity: null, whois: { rir: 'ARIN' }, rank: null, reputation: null,
  };

  it('builds the versioned URL', () => {
    assert.equal(asnProfileUrl(13335), `/api/asn-profile?asn=13335&v=${ASN_PROFILE_VERSION}`);
  });

  it('hands out section data only for ok sections', () => {
    assert.deepEqual(sectionData(profile, 'radar'), { asnName: 'X' });
    assert.equal(sectionData(profile, 'prefixes'), null);
    assert.equal(sectionData({ status: { rank: 'empty' }, rank: { rank: null } }, 'rank'), null);
    assert.equal(sectionData(null, 'radar'), null);
  });

  it('is empty only when no section is ok', () => {
    assert.equal(isProfileEmpty(profile), false);
    assert.equal(isProfileEmpty({ status: { radar: 'error', prefixes: 'empty', whois: 'empty', reputation: 'disabled' } }), true);
    assert.equal(isProfileEmpty(undefined), true);
  });

  it('names failed sources once each', () => {
    assert.deepEqual(failedSources(profile), ['CAIDA AS Relationships', 'CAIDA AS Rank']);
    assert.deepEqual(failedSources({ status: { radar: 'error', prefixes: 'error' } }), ['Cloudflare Radar']);
  });
});

describe('keyFacts / coneAsns', () => {
  const rows = shapePrefixRows([
    { prefix: '192.0.2.0/24' }, { prefix: '198.51.100.0/24' }, { prefix: '2001:db8::/32' },
  ]);

  it('builds every fact when every source has data', () => {
    const facts = keyFacts({ radar: { estimatedUsers: '4,200,000' }, rank: { rank: 64 }, rows });
    assert.deepEqual(facts.map((f) => f.key), ['rank', 'announcedIpv4', 'prefixes', 'users']);
    const announced = facts.find((f) => f.key === 'announcedIpv4');
    assert.equal(announced.value, 512);
    assert.equal(announced.share, (512 / 2 ** 32) * 100);
  });

  it('prefix counts come from the list only, never from Radar routing stats', () => {
    const facts = keyFacts({ radar: { prefixesV4: '2,346', prefixesV6: '1,204' }, rows });
    assert.deepEqual(facts.find((f) => f.key === 'prefixes'), { key: 'prefixes', v4: 2, v6: 1 });
    assert.equal(keyFacts({ radar: { prefixesV4: '2,346' }, rows: [] }).find((f) => f.key === 'prefixes'), undefined);
  });

  it('a small AS with nothing known yields no facts and no NaN', () => {
    assert.deepEqual(keyFacts({ radar: { prefixesV4: '0', prefixesV6: '0' }, rank: null, rows: [] }), []);
    assert.deepEqual(keyFacts(), []);
  });

  it('cone size is the AS count only', () => {
    assert.equal(coneAsns({ cone: { asns: 963, prefixes: 35738, addresses: 32408873 } }), 963);
    assert.equal(coneAsns({ cone: { asns: null } }), null);
    assert.equal(coneAsns(null), null);
  });
});

describe('hasTopology / isTier1Origin', () => {
  it('needs at least one edge', () => {
    assert.equal(hasTopology({ nodes: [{}], edges: [] }), false);
    assert.equal(hasTopology({ edges: [{}] }), true);
    assert.equal(hasTopology(null), false);
  });

  it('reads the origin node type', () => {
    assert.equal(isTier1Origin({ origin: 174, nodes: [{ asn: 174, type: 'origin-tier1' }] }), true);
    assert.equal(isTier1Origin({ origin: 13335, nodes: [{ asn: 13335, type: 'origin' }, { asn: 174, type: 'tier1' }] }), false);
    assert.equal(isTier1Origin(undefined), false);
  });
});

describe('heroIdentity', () => {
  it('Radar, then RDAP, then ASRank — for name, org and country alike', () => {
    const info = { asnName: 'CLOUDFLARENET', asnOrgName: 'Cloudflare, Inc.', asnCountryCode: 'US' };
    assert.deepEqual(heroIdentity({ radar: info }), { name: 'CLOUDFLARENET', org: 'Cloudflare, Inc.', country: 'US' });
    assert.deepEqual(
      heroIdentity({ whois: { name: 'EXAMPLE-AS', registrant: 'Example Ltd', country: null }, rank: { country: 'gb' } }),
      { name: 'EXAMPLE-AS', org: 'Example Ltd', country: 'GB' },
    );
    assert.deepEqual(heroIdentity({}), { name: null, org: null, country: null });
  });

  it('Radar country wins over the registry (ASN Info shows Radar)', () => {
    assert.equal(heroIdentity({ radar: { asnCountryCode: 'US' }, whois: { country: 'NL' } }).country, 'US');
    assert.equal(heroIdentity({ radar: {}, whois: { country: 'NL' } }).country, 'NL');
  });

  it('drops an org identical to the name', () => {
    assert.equal(heroIdentity({ radar: { asnName: 'X', asnOrgName: 'X' } }).org, null);
  });
});

describe('registrationFields', () => {
  it('orders, formats dates and drops empties', () => {
    const whois = {
      rir: 'ARIN', status: ['active'], registered: '2010-07-14T18:35:57-04:00',
      lastChanged: null, abuse: 'abuse@example.net',
    };
    const fields = registrationFields(whois, (day) => `<${day}>`);
    assert.deepEqual(fields.map((f) => [f.key, f.value]), [
      ['registry', 'ARIN'], ['status', 'active'], ['registered', '<2010-07-14>'], ['abuse', 'abuse@example.net'],
    ]);
    assert.equal(fields.at(-1).mono, true);
  });

  it('no record → no rows', () => {
    assert.deepEqual(registrationFields(null), []);
    assert.deepEqual(registrationFields({ status: [] }), []);
  });
});

describe('prefix rows', () => {
  const raw = [
    { prefix: '2606:4700::/32', rpki: 'Valid', peers: 300 },
    { prefix: '104.16.0.0/13', rpki: 'valid', peers: 290 },
    { prefix: '104.16.0.0/20', rpki: 'Invalid' },
    { prefix: '1.1.1.0/24', rpki: 'NotFound', peers: '12' },
    { prefix: 'garbage' },
    null,
  ];

  it('normalizes RPKI verdicts', () => {
    assert.equal(normalizeRpki('Valid'), 'valid');
    assert.equal(normalizeRpki('INVALID'), 'invalid');
    assert.equal(normalizeRpki('not-found'), 'unknown');
    assert.equal(normalizeRpki(undefined), 'unknown');
  });

  it('sorts v4 first, by address then length, dropping junk', () => {
    const rows = shapePrefixRows(raw);
    assert.deepEqual(rows.map((r) => r.prefix), ['1.1.1.0/24', '104.16.0.0/13', '104.16.0.0/20', '2606:4700::/32']);
    assert.deepEqual(rows.map((r) => r.rpki), ['unknown', 'valid', 'invalid', 'valid']);
    assert.deepEqual(rows.map((r) => r.peers), [12, 290, 0, 300]);
    assert.deepEqual(rows.map((r) => r.count), [256, 524288, 4096, 65536]);
    assert.deepEqual(shapePrefixRows(undefined), []);
  });

  it('counts and filters by family, exports one per line', () => {
    const rows = shapePrefixRows(raw);
    assert.deepEqual(familyCounts(rows), { v4: 3, v6: 1 });
    assert.equal(filterPrefixRows(rows, 'v6').length, 1);
    assert.equal(filterPrefixRows(rows, 'v4').length, 3);
    assert.equal(filterPrefixRows(rows, 'all'), rows);
    assert.equal(prefixListText(filterPrefixRows(rows, 'v6')), '2606:4700::/32');
  });
});

describe('rpkiSummary', () => {
  const rows = shapePrefixRows([
    { prefix: '192.0.2.0/24', rpki: 'Valid' }, { prefix: '198.51.100.0/24', rpki: 'Invalid' },
    { prefix: '203.0.113.0/24', rpki: 'Unknown' }, { prefix: '2001:db8::/32', rpki: 'Valid' },
  ]);

  it('counts the prefix rows', () => {
    const s = rpkiSummary(rows);
    assert.deepEqual(s.counts, { valid: 2, invalid: 1, unknown: 1 });
    assert.equal(s.total, 4);
    assert.equal(s.pct.valid, 50);
  });

  it('never rounds up to 100% valid', () => {
    const many = shapePrefixRows([
      ...Array.from({ length: 999 }, (_, i) => ({ prefix: `10.${Math.floor(i / 256)}.${i % 256}.0/24`, rpki: 'Valid' })),
      { prefix: '192.0.2.0/24', rpki: 'Invalid' },
    ]);
    assert.equal(rpkiSummary(many).validPct, 99.9);
    assert.equal(rpkiSummary(shapePrefixRows([{ prefix: '192.0.2.0/24', rpki: 'Valid' }])).validPct, 100);
  });

  it('nothing to count → null', () => {
    assert.equal(rpkiSummary([]), null);
    assert.equal(rpkiSummary(), null);
  });
});

describe('countries', () => {
  const countries = [
    { country: 'US', share: 0.8123 }, { country: 'de', share: 0.1 }, { country: 'XX1', share: 0.05 },
    { country: 'JP', share: 0 }, { country: 'NL', share: 0.0877 },
  ];

  it('top-N rows with percentages and relative bars', () => {
    const rows = countryShareRows(countries, 2);
    assert.deepEqual(rows.map((r) => [r.cc, r.pct]), [['US', 81.2], ['DE', 10]]);
    assert.equal(rows[0].bar, 100);
    assert.ok(Math.abs(rows[1].bar - (0.1 / 0.8123) * 100) < 1e-9);
    assert.deepEqual(countryShareRows(undefined), []);
  });

  it('floors bars at 2%', () => {
    const rows = countryShareRows([{ country: 'US', share: 0.999 }, { country: 'CA', share: 0.001 }]);
    assert.equal(rows[1].bar, 2);
  });

});

describe('neighbourGroups', () => {
  it('previews names, labels unnamed ASNs, counts the rest', () => {
    const neighbours = {
      counts: { providers: 2, peers: 340, customers: 0 },
      providers: [{ asn: 174, name: 'Cogent Communications' }, { asn: 64500, name: null }],
      peers: Array.from({ length: 50 }, (_, i) => ({ asn: 1000 + i, name: `Peer ${i}` })),
      customers: [],
    };
    const [providers, peers, customers] = neighbourGroups(neighbours, 8);
    assert.deepEqual(providers, {
      kind: 'providers', count: 2, more: 0,
      names: [{ asn: 174, label: 'Cogent Communications' }, { asn: 64500, label: 'AS64500' }],
    });
    assert.equal(peers.names.length, 8);
    assert.equal(peers.more, 332);
    assert.deepEqual(customers, { kind: 'customers', count: 0, names: [], more: 0 });
  });

  it('missing neighbours → three empty groups', () => {
    assert.deepEqual(neighbourGroups(undefined).map((g) => [g.kind, g.count, g.more]),
      [['providers', 0, 0], ['peers', 0, 0], ['customers', 0, 0]]);
  });
});

describe('reputation', () => {
  const rep = {
    found: true, ratio: { abuse: 3.537, vpn: 0.8 }, level: 'high',
    dropListed: false, proxy: 502, updatedAt: '2026-10-03T11:54:33.740Z',
  };

  it('log axis: 0 at 0, baseline near 15%, capped at 100', () => {
    assert.equal(ratioPosition(0), 0);
    assert.ok(BASELINE_POSITION > 14 && BASELINE_POSITION < 16);
    assert.equal(ratioPosition(1000), 100);
    assert.equal(ratioPosition(null), 0);
  });

  it('meters cover abuse and VPN only, toned by the baseline side', () => {
    const meters = reputationMeters(rep);
    assert.deepEqual(meters.map((m) => [m.key, m.ratio, m.tone]), [['abuse', 3.537, 'ok-slow'], ['vpn', 0.8, 'ok-fast']]);
    assert.equal(meters[0].pos, ratioPosition(3.537));
    assert.equal(reputationMeters({ ratio: { abuse: 0, vpn: null } })[0].pos, 1);
    assert.deepEqual(reputationMeters({ ratio: { abuse: null, vpn: null } }), []);
    assert.deepEqual(reputationMeters(null), []);
  });

  it('proxies detected: the listed count when > 0', () => {
    assert.equal(proxyListedCount(rep), 502);
    assert.equal(proxyListedCount({ ...rep, proxy: 0 }), null);
    assert.equal(proxyListedCount({ found: false, ratio: null }), null);
    assert.equal(proxyListedCount(null), null);
  });

  it('verdict follows the scoring level only when found', () => {
    assert.equal(verdictLevel(rep), 'high');
    assert.equal(VERDICT_TONE.high, 'fail');
    assert.equal(verdictLevel({ ...rep, found: false }), null);
    assert.equal(verdictLevel({ ...rep, level: null }), null);
  });
});

describe('PeeringDB', () => {
  const pdb = {
    website: 'https://www.example.net/about',
    types: ['Content', 'NSP'],
    scope: 'Global',
    traffic: '1-5Tbps',
    ratio: 'Mostly Outbound',
    policy: 'Open',
    irrAsSet: 'AS-EXAMPLE',
    ixs: [
      { name: 'IX.br (PTT.br) São Paulo', city: 'São Paulo/SP', country: 'BR', speed: 1800000, rsPeer: true },
      { name: 'DE-CIX Frankfurt', city: 'Frankfurt', country: 'de', speed: 100000, rsPeer: false },
      { name: '', city: 'x', country: 'US', speed: 1 },
    ],
    facilities: [{ name: 'Equinix FR5', city: null, country: 'XX1' }],
  };

  it('maps every PeeringDB vocabulary value to an English label', () => {
    for (const [group, values] of Object.entries(PEERING_ENUMS)) {
      for (const value of Object.keys(values)) {
        const key = peeringEnumKey(group, value);
        const label = key.split('.').reduce((node, part) => node?.[part], en);
        assert.equal(typeof label, 'string', key);
      }
    }
    assert.equal(peeringEnumKey('types', 'Something New'), null);
    assert.equal(peeringEnumKey('nope', 'Open'), null);
  });

  it('website links are http(s) only, labelled by host', () => {
    assert.deepEqual(websiteLink('https://www.example.net/about'), { href: 'https://www.example.net/about', label: 'example.net' });
    assert.equal(websiteLink('http://ripe.net').label, 'ripe.net');
    for (const bad of ['javascript:alert(1)', 'ftp://x.example', 'http://noc.isp@mail.example', 'not a url', null]) {
      assert.equal(websiteLink(bad), null, String(bad));
    }
  });

  it('hero carries only what is present', () => {
    assert.deepEqual(peeringHero(pdb), { types: ['Content', 'NSP'], website: websiteLink(pdb.website), scope: 'Global' });
    assert.deepEqual(peeringHero(null), { types: [], website: null, scope: null });
  });

  it('facts keep display order and drop empties', () => {
    assert.deepEqual(peeringFacts(pdb).map((fact) => fact.key), ['policy', 'traffic', 'ratio', 'irr']);
    assert.deepEqual(peeringFacts({ policy: 'Open', ratio: null }), [{ key: 'policy', value: 'Open', group: 'policies' }]);
    assert.deepEqual(peeringFacts(null), []);
  });

  it('formats port capacity as M / G / T', () => {
    assert.equal(formatPortSpeed(100), '100M');
    assert.equal(formatPortSpeed(1000), '1G');
    assert.equal(formatPortSpeed(10000), '10G');
    assert.equal(formatPortSpeed(2500), '2.5G');
    assert.equal(formatPortSpeed(1800000), '1.8T');
    assert.equal(formatPortSpeed(1234567), '1.2T');
    assert.equal(formatPortSpeed(0), '');
    assert.equal(formatPortSpeed(400000, (n) => `<${n}>`), '<400>G');
  });

  it('list rows: unnamed entries dropped, country codes checked, city as written', () => {
    assert.deepEqual(exchangeRows(pdb), [
      { name: 'IX.br (PTT.br) São Paulo', city: 'São Paulo/SP', cc: 'BR', speed: 1800000, rsPeer: true },
      { name: 'DE-CIX Frankfurt', city: 'Frankfurt', cc: 'DE', speed: 100000, rsPeer: false },
    ]);
    assert.deepEqual(facilityRows(pdb), [{ name: 'Equinix FR5', city: '', cc: null }]);
    assert.deepEqual(exchangeRows(null), []);
  });

  it('the card shows only when a list has an entry', () => {
    assert.equal(hasPeeringCard(pdb), true);
    assert.equal(hasPeeringCard({ facilities: [{ name: 'F' }] }), true);
    assert.equal(hasPeeringCard({ policy: 'Open', irr: 'AS-EXAMPLE' }), false);
    assert.equal(hasPeeringCard({ website: 'https://x.example', types: ['NSP'], scope: 'Global' }), false);
    assert.equal(hasPeeringCard(null), false);
  });

  it('lists show the first rows until expanded', () => {
    const rows = Array.from({ length: 25 }, (_, i) => i);
    assert.equal(visibleRows(rows, false).length, 10);
    assert.equal(visibleRows(rows, true).length, 25);
    assert.equal(visibleRows(rows.slice(0, 4), false).length, 4);
  });
});
