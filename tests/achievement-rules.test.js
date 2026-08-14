// Tests for the achievement rule table (frontend/data/achievement-rules.js):
// structural validity (every slug exists in data/achievements.js) and the
// behavior of each `when` predicate.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ACHIEVEMENT_RULES } from '../frontend/data/achievement-rules.js';
import { createInitialAchievementsState } from '../frontend/data/achievements.js';

// Collect the rules for one event as { slug: rule } for easy lookup.
const rulesFor = (event) =>
  Object.fromEntries(ACHIEVEMENT_RULES.filter((r) => r.event === event).map((r) => [r.slug, r]));

// True when the rule fires for the given payload (rules without `when` always fire).
const fires = (rule, payload) => (rule.when ? !!rule.when(payload) : true);

describe('ACHIEVEMENT_RULES structure', () => {
  it('every rule has a non-empty event name and a known achievement slug', () => {
    const known = createInitialAchievementsState();
    for (const rule of ACHIEVEMENT_RULES) {
      assert.ok(typeof rule.event === 'string' && rule.event.length > 0, 'event name required');
      assert.ok(known[rule.slug], `unknown achievement slug: ${rule.slug}`);
      if (rule.when) assert.equal(typeof rule.when, 'function');
    }
  });

  it('no duplicate (event, slug) pairs', () => {
    const keys = ACHIEVEMENT_RULES.map((r) => `${r.event}|${r.slug}`);
    assert.equal(new Set(keys).size, keys.length);
  });

  it('predicates never throw on an empty payload', () => {
    for (const rule of ACHIEVEMENT_RULES) {
      if (rule.when) assert.doesNotThrow(() => rule.when({}), `when() of ${rule.slug} threw on {}`);
    }
  });
});

describe('speedtest:finished thresholds', () => {
  const rules = rulesFor('speedtest:finished');

  it('download thresholds unlock progressively at 100 / 500 / 1000 Mbps', () => {
    const at = (downloadSpeed) =>
      ['BarelyEnough', 'RapidPace', 'TorrentFlow'].filter((slug) => fires(rules[slug], { downloadSpeed }));
    assert.deepEqual(at(99.99), []);
    assert.deepEqual(at(100), ['BarelyEnough']);
    assert.deepEqual(at(500), ['BarelyEnough', 'RapidPace']);
    assert.deepEqual(at(1000), ['BarelyEnough', 'RapidPace', 'TorrentFlow']);
  });

  it('upload thresholds unlock progressively at 50 / 200 / 1000 Mbps', () => {
    const at = (uploadSpeed) =>
      ['SteadyGoing', 'TooFastTooSimple', 'SwiftAscent'].filter((slug) => fires(rules[slug], { uploadSpeed }));
    assert.deepEqual(at(49), []);
    assert.deepEqual(at(50), ['SteadyGoing']);
    assert.deepEqual(at(200), ['SteadyGoing', 'TooFastTooSimple']);
    assert.deepEqual(at(1000), ['SteadyGoing', 'TooFastTooSimple', 'SwiftAscent']);
  });

  it('an unmeasured speed ("-" placeholder) unlocks nothing', () => {
    for (const rule of Object.values(rules)) {
      assert.equal(fires(rule, { downloadSpeed: '-', uploadSpeed: '-' }), false);
    }
  });
});

describe('user:info-loaded', () => {
  const rules = rulesFor('user:info-loaded');

  it('IAmHuman always fires; MakingBigNews needs more than 1000 uses', () => {
    assert.equal(fires(rules.IAmHuman, { totalFunctionUses: 0 }), true);
    assert.equal(fires(rules.MakingBigNews, { totalFunctionUses: 1000 }), false);
    assert.equal(fires(rules.MakingBigNews, { totalFunctionUses: 1001 }), true);
  });
});

describe('censorship:tested', () => {
  it('ItIsOpen fires only when blocked', () => {
    const rule = rulesFor('censorship:tested').ItIsOpen;
    assert.equal(fires(rule, { blocked: true }), true);
    assert.equal(fires(rule, { blocked: false }), false);
  });
});

describe('securitychecklist:progress', () => {
  const rules = rulesFor('securitychecklist:progress');

  it('SurfaceCheck fires on the first checked item', () => {
    assert.equal(fires(rules.SurfaceCheck, { checked: 0, total: 10 }), false);
    assert.equal(fires(rules.SurfaceCheck, { checked: 1, total: 10 }), true);
  });

  it('HalfwayThere fires past 50%, FullySecured at 100%', () => {
    assert.equal(fires(rules.HalfwayThere, { checked: 5, total: 10 }), false);
    assert.equal(fires(rules.HalfwayThere, { checked: 6, total: 10 }), true);
    assert.equal(fires(rules.FullySecured, { checked: 9, total: 10 }), false);
    assert.equal(fires(rules.FullySecured, { checked: 10, total: 10 }), true);
  });

  it('a zero-item checklist unlocks nothing', () => {
    for (const rule of Object.values(rules)) {
      assert.equal(fires(rule, { checked: 0, total: 0 }), false);
    }
  });
});

describe('whois:lookup', () => {
  it('CuriousCat fires only for ipcheck.ing queries (case-insensitive)', () => {
    const rule = rulesFor('whois:lookup').CuriousCat;
    assert.equal(fires(rule, { query: 'example.com' }), false);
    assert.equal(fires(rule, { query: 'IPCheck.ing' }), true);
    assert.equal(fires(rule, { query: 'lite.ipcheck.ing' }), true);
    assert.equal(fires(rule, {}), false);
  });
});

describe('ruletest:finished', () => {
  it('CrossingTheWall needs exactly 8 unique IPs', () => {
    const rule = rulesFor('ruletest:finished').CrossingTheWall;
    assert.equal(fires(rule, { uniqueIPCount: 7 }), false);
    assert.equal(fires(rule, { uniqueIPCount: 8 }), true);
  });
});

describe('invisibility events', () => {
  it('JustInCase fires on start unconditionally', () => {
    assert.equal(fires(rulesFor('invisibility:started').JustInCase, {}), true);
  });

  it('HiddenWell needs both scores at 0; SlipUp needs either above 50', () => {
    const rules = rulesFor('invisibility:result');
    assert.equal(fires(rules.HiddenWell, { proxyScore: 0, vpnScore: 0 }), true);
    assert.equal(fires(rules.HiddenWell, { proxyScore: 0, vpnScore: 1 }), false);
    assert.equal(fires(rules.SlipUp, { proxyScore: 51, vpnScore: 0 }), true);
    assert.equal(fires(rules.SlipUp, { proxyScore: 0, vpnScore: 51 }), true);
    assert.equal(fires(rules.SlipUp, { proxyScore: 50, vpnScore: 50 }), false);
  });
});

describe('preferences events', () => {
  it('ResourceHog fires on any multiple-tests toggle', () => {
    assert.equal(fires(rulesFor('preferences:multiple-tests-toggled').ResourceHog, {}), true);
  });

  it('EnergySaver fires only when every auto-run module is off', () => {
    const rule = rulesFor('preferences:autorun-changed').EnergySaver;
    assert.equal(fires(rule, { allAutoRunOff: true }), true);
    assert.equal(fires(rule, { allAutoRunOff: false }), false);
  });
});

describe('shortcut:help-opened', () => {
  it('CleverTrickery fires unconditionally', () => {
    assert.equal(fires(rulesFor('shortcut:help-opened').CleverTrickery, {}), true);
  });
});

describe('ipinfo:finished card rules', () => {
  const rules = rulesFor('ipinfo:finished');
  const cards = (...qualityScores) => ({ cards: qualityScores.map((qualityScore) => ({ qualityScore })) });

  it('PrettyDirty needs a card at score 1, SqueakyClean at score 100', () => {
    assert.equal(fires(rules.PrettyDirty, cards(1, 50)), true);
    assert.equal(fires(rules.PrettyDirty, cards(2, 100)), false);
    assert.equal(fires(rules.SqueakyClean, cards(100, 50)), true);
    assert.equal(fires(rules.SqueakyClean, cards(99, 1)), false);
  });

  it('quality scores survive string form but not gated / absent states', () => {
    assert.equal(fires(rules.PrettyDirty, cards('1')), true);
    assert.equal(fires(rules.SqueakyClean, cards('100')), true);
    for (const rule of [rules.PrettyDirty, rules.SqueakyClean]) {
      assert.equal(fires(rule, cards('sign_in_required', 'unknown', undefined)), false);
      assert.equal(fires(rule, { cards: [] }), false);
      assert.equal(fires(rule, {}), false);
    }
  });

  it('WalkWithPenguins fires on an AQ card regardless of code case', () => {
    const withCountry = (...codes) => ({ cards: codes.map((country_code) => ({ country_code })) });
    assert.equal(fires(rules.WalkWithPenguins, withCountry('US', 'AQ')), true);
    assert.equal(fires(rules.WalkWithPenguins, withCountry('aq')), true);
    assert.equal(fires(rules.WalkWithPenguins, withCountry('US', undefined)), false);
    assert.equal(fires(rules.WalkWithPenguins, {}), false);
  });
});

describe('iphistory:updated', () => {
  it('GlobeTrotter needs 10 distinct countries', () => {
    const rule = rulesFor('iphistory:updated').GlobeTrotter;
    assert.equal(fires(rule, { countryCount: 9 }), false);
    assert.equal(fires(rule, { countryCount: 10 }), true);
    assert.equal(fires(rule, {}), false);
  });
});

describe('pulse:status-sent', () => {
  it('HelloWorld fires on any confirmed status', () => {
    assert.equal(fires(rulesFor('pulse:status-sent').HelloWorld, { status: 'vibing' }), true);
  });
});

describe('connectivity:custom-added', () => {
  it('AddSweetAdd fires on any hand-added target', () => {
    assert.equal(fires(rulesFor('connectivity:custom-added').AddSweetAdd, { name: 'x', url: 'https://x.tld/favicon.ico' }), true);
  });
});
