// Single source of truth for the Advanced Tools.
//
// This one registry drives every place a tool is referenced: the vue-router
// routes (router/index.js), the Advanced.vue card groups + bottom drawer, the
// standalone /tools/:slug pages, the nav menu and the keyboard shortcuts
// (use-shortcuts.js).
//
// Entry shape:
//   slug                 — stable URL/identifier (drawer query + /tools/:slug)
//   emoji                — card glyph + drawer header glyph
//   titleKey / noteKey   — i18n keys for the tool title and one-line description
//   category             — TOOL_CATEGORIES id: the card group it renders in
//   component            — lazy import of the tool's .vue (drawer + standalone)
//   requiresOriginalSite — gate: only shown on the original site (private API +
//                          sign-in required); omitted == public tool
//   requiresConfig       — gate: only shown when this `/api/configs` flag is
//                          true (e.g. 'cloudFlare' for the Radar-backed tools)
//
// Gates decide listing only (card grid + nav), via isToolAvailable() in
// utils/tool-availability.js; deep links (?tool= / /tools/:slug) ignore them.

export const ADVANCED_TOOLS = [
  { slug: 'pingtest', emoji: '⏱️', titleKey: 'pingtest.Title', noteKey: 'advancedtools.PingTestNote', category: 'network', component: () => import('@/components/advanced-tools/GlobalLatencyTest.vue') },
  { slug: 'mtrtest', emoji: '🚉', titleKey: 'mtrtest.Title', noteKey: 'advancedtools.MTRTestNote', category: 'network', component: () => import('@/components/advanced-tools/MtrTest.vue') },
  { slug: 'ruletest', emoji: '🚏', titleKey: 'ruletest.Title', noteKey: 'advancedtools.RuleTestNote', category: 'network', component: () => import('@/components/advanced-tools/RuleTest.vue') },
  { slug: 'dnsresolver', emoji: '📟', titleKey: 'dnsresolver.Title', noteKey: 'advancedtools.DNSResolverNote', category: 'network', component: () => import('@/components/advanced-tools/DnsResolver.vue') },
  { slug: 'censorshipcheck', emoji: '🚧', titleKey: 'censorshipcheck.Title', noteKey: 'advancedtools.CensorshipCheck', category: 'network', component: () => import('@/components/advanced-tools/CensorshipCheck.vue') },
  { slug: 'servicestatus', emoji: '📡', titleKey: 'serviceStatus.Title', noteKey: 'advancedtools.ServiceStatus', category: 'network', component: () => import('@/components/advanced-tools/ServiceStatus.vue') },
  { slug: 'browserinfo', emoji: '🖥️', titleKey: 'browserinfo.Title', noteKey: 'advancedtools.BrowserInfo', category: 'network', component: () => import('@/components/advanced-tools/BrowserInfo.vue') },
  { slug: 'securitychecklist', emoji: '📋', titleKey: 'securitychecklist.Title', noteKey: 'advancedtools.SecurityChecklist', category: 'network', component: () => import('@/components/advanced-tools/SecurityChecklist.vue') },
  { slug: 'whois', emoji: '📓', titleKey: 'whois.Title', noteKey: 'advancedtools.Whois', category: 'lookup', component: () => import('@/components/advanced-tools/Whois.vue') },
  { slug: 'asn', emoji: '🛂', titleKey: 'asnprofile.Title', noteKey: 'advancedtools.AsnProfile', category: 'lookup', component: () => import('@/components/advanced-tools/AsnProfile.vue'), requiresConfig: 'cloudFlare' },
  { slug: 'macchecker', emoji: '🗄️', titleKey: 'macchecker.Title', noteKey: 'advancedtools.MacChecker', category: 'lookup', component: () => import('@/components/advanced-tools/MacChecker.vue') },
  { slug: 'ipcalculator', emoji: '🔢', titleKey: 'ipcalculator.Title', noteKey: 'advancedtools.IpCalculator', category: 'lookup', component: () => import('@/components/advanced-tools/IpCalculator.vue') },
  { slug: 'invisibilitytest', emoji: '🫣', titleKey: 'invisibilitytest.Title', noteKey: 'advancedtools.InvisibilityTest', category: 'deep', component: () => import('@/components/advanced-tools/InvisibilityTest.vue'), requiresOriginalSite: true },
  { slug: 'enhanceddnsleaktest', emoji: '🌀', titleKey: 'enhanceddnsleaktest.Title', noteKey: 'advancedtools.EnhancedDnsLeakTest', category: 'deep', component: () => import('@/components/advanced-tools/EnhancedDnsLeakTest.vue'), requiresOriginalSite: true },
  // noStandalone: the check requires the homepage tests' results, and running
  // them navigates home — a /tools/ page for it would immediately bounce away.
  { slug: 'personacheck', emoji: '🎭', titleKey: 'personacheck.Title', noteKey: 'advancedtools.PersonaCheck', category: 'deep', component: () => import('@/components/advanced-tools/PersonaCheck.vue'), requiresOriginalSite: true, noStandalone: true },
];

// Fast slug → entry lookup (drawer + standalone page resolve a tool by slug).
export const TOOL_BY_SLUG = new Map(ADVANCED_TOOLS.map((tool) => [tool.slug, tool]));

// Card groups, in render order. On a self-hosted deployment the 'deep' tools
// (IPCheck.ing's private API) all fail their gates, and the group disappears.
export const TOOL_CATEGORIES = [
  { id: 'network', titleKey: 'advancedtools.category.network' },
  { id: 'lookup', titleKey: 'advancedtools.category.lookup' },
  { id: 'deep', titleKey: 'advancedtools.category.deep' },
];

// Tools grouped by category in TOOL_CATEGORIES order (each keeping registry
// order); groups left empty — every tool filtered out — are dropped.
export const groupToolsByCategory = (tools) => TOOL_CATEGORIES
  .map((c) => ({ ...c, tools: tools.filter((tool) => tool.category === c.id) }))
  .filter((group) => group.tools.length > 0);
