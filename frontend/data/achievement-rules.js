// Achievement trigger rules — THE single place that maps domain events to
// achievement unlocks. Looking for "where does achievement X get triggered"?
// It's here, nowhere else.
//
// Each rule: { event, slug, when? }
//   event — app-event name emitted by a component (see utils/app-events.js)
//   slug  — achievement key from data/achievements.js
//   when  — optional pure predicate over the event payload; omitted = always
//
// Rules are evaluated by composables/use-achievement-engine.js, which owns
// the cross-cutting guards (signed-in check, already-achieved check, trigger
// spacing). Keep predicates pure — tests/achievement-rules.test.js unit-tests
// them and asserts every slug exists in data/achievements.js.

export const ACHIEVEMENT_RULES = [
    // Speed test finished — payload { downloadSpeed, uploadSpeed } in Mbps.
    { event: 'speedtest:finished', slug: 'BarelyEnough', when: (p) => p.downloadSpeed >= 100 },
    { event: 'speedtest:finished', slug: 'RapidPace', when: (p) => p.downloadSpeed >= 500 },
    { event: 'speedtest:finished', slug: 'TorrentFlow', when: (p) => p.downloadSpeed >= 1000 },
    { event: 'speedtest:finished', slug: 'SteadyGoing', when: (p) => p.uploadSpeed >= 50 },
    { event: 'speedtest:finished', slug: 'TooFastTooSimple', when: (p) => p.uploadSpeed >= 200 },
    { event: 'speedtest:finished', slug: 'SwiftAscent', when: (p) => p.uploadSpeed >= 1000 },

    // Remote user info loaded after sign-in — payload { totalFunctionUses }.
    { event: 'user:info-loaded', slug: 'IAmHuman' },
    { event: 'user:info-loaded', slug: 'MakingBigNews', when: (p) => p.totalFunctionUses > 1000 },

    // Censorship check completed — payload { blocked }.
    { event: 'censorship:tested', slug: 'ItIsOpen', when: (p) => p.blocked },

    // Security checklist progress — payload { checked, total }.
    { event: 'securitychecklist:progress', slug: 'SurfaceCheck', when: (p) => p.checked > 0 },
    { event: 'securitychecklist:progress', slug: 'HalfwayThere', when: (p) => p.total > 0 && p.checked / p.total > 0.5 },
    { event: 'securitychecklist:progress', slug: 'FullySecured', when: (p) => p.total > 0 && p.checked === p.total },

    // Whois lookup ran — payload { query }.
    { event: 'whois:lookup', slug: 'CuriousCat', when: (p) => (p.query || '').toLowerCase().includes('ipcheck.ing') },

    // Rule test finished — payload { uniqueIPCount }.
    { event: 'ruletest:finished', slug: 'CrossingTheWall', when: (p) => p.uniqueIPCount === 8 },

    // Invisibility test — payloads: {} / { proxyScore, vpnScore } (floored ints).
    { event: 'invisibility:started', slug: 'JustInCase' },
    { event: 'invisibility:result', slug: 'HiddenWell', when: (p) => p.proxyScore === 0 && p.vpnScore === 0 },
    { event: 'invisibility:result', slug: 'SlipUp', when: (p) => p.proxyScore > 50 || p.vpnScore > 50 },

    // Preferences — payloads: {} / { allAutoRunOff }.
    { event: 'preferences:multiple-tests-toggled', slug: 'ResourceHog' },
    { event: 'preferences:autorun-changed', slug: 'EnergySaver', when: (p) => p.allAutoRunOff },

    // Help modal opened via keyboard shortcut.
    { event: 'shortcut:help-opened', slug: 'CleverTrickery' },

    // IP cards settled — payload { cards: [{ country_code, qualityScore, … }] }.
    // qualityScore (1–100) only rides the IPCheck.ing card; Number() maps its
    // 'sign_in_required' / 'quota_exceeded' / absent states to NaN so they never match.
    { event: 'ipinfo:finished', slug: 'PrettyDirty', when: (p) => (p.cards || []).some((c) => Number(c.qualityScore) === 1) },
    { event: 'ipinfo:finished', slug: 'SqueakyClean', when: (p) => (p.cards || []).some((c) => Number(c.qualityScore) === 100) },
    { event: 'ipinfo:finished', slug: 'WalkWithPenguins', when: (p) => (p.cards || []).some((c) => (c.country_code || '').toUpperCase() === 'AQ') },

    // Local IP history snapshot — payload { countryCount } (distinct countries).
    { event: 'iphistory:updated', slug: 'GlobeTrotter', when: (p) => p.countryCount >= 10 },

    // Earth Online status posted (backend confirmed the write).
    { event: 'pulse:status-sent', slug: 'HelloWorld' },

    // Connectivity custom target hand-added (imported lists emit nothing).
    { event: 'connectivity:custom-added', slug: 'AddSweetAdd' },
];
