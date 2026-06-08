// Single source of truth for the Advanced Tools.
//
// This one registry drives every place a tool is referenced:
//   - the vue-router routes (router/index.js)
//   - the Advanced.vue card grid + bottom drawer
//   - the standalone /tools/:slug pages (added in a later stage)
//   - the keyboard shortcuts (use-shortcuts.js)
//
// Previously the router's routes[] and Advanced.vue's cards[] were two parallel
// hand-maintained arrays that drifted out of order (the Advanced.vue comment
// still warns about it). Keying everything off one slug-ordered list removes
// that failure mode.
//
// Entry shape:
//   slug                 — stable URL/identifier (drawer query + /tools/:slug)
//   emoji                — card glyph + drawer header glyph
//   titleKey / noteKey   — i18n keys for the tool title and one-line description
//   component            — lazy import of the tool's .vue (drawer + standalone)
//   requiresOriginalSite — gate: only shown on the original site (private API +
//                          sign-in required); omitted == public tool

export const ADVANCED_TOOLS = [
  { slug: 'pingtest', emoji: '⏱️', titleKey: 'pingtest.Title', noteKey: 'advancedtools.PingTestNote', component: () => import('@/components/advanced-tools/GlobalLatencyTest.vue') },
  { slug: 'mtrtest', emoji: '🚉', titleKey: 'mtrtest.Title', noteKey: 'advancedtools.MTRTestNote', component: () => import('@/components/advanced-tools/MtrTest.vue') },
  { slug: 'ruletest', emoji: '🚏', titleKey: 'ruletest.Title', noteKey: 'advancedtools.RuleTestNote', component: () => import('@/components/advanced-tools/RuleTest.vue') },
  { slug: 'dnsresolver', emoji: '📟', titleKey: 'dnsresolver.Title', noteKey: 'advancedtools.DNSResolverNote', component: () => import('@/components/advanced-tools/DnsResolver.vue') },
  { slug: 'censorshipcheck', emoji: '🚧', titleKey: 'censorshipcheck.Title', noteKey: 'advancedtools.CensorshipCheck', component: () => import('@/components/advanced-tools/CensorshipCheck.vue') },
  { slug: 'whois', emoji: '📓', titleKey: 'whois.Title', noteKey: 'advancedtools.Whois', component: () => import('@/components/advanced-tools/Whois.vue') },
  { slug: 'macchecker', emoji: '🗄️', titleKey: 'macchecker.Title', noteKey: 'advancedtools.MacChecker', component: () => import('@/components/advanced-tools/MacChecker.vue') },
  { slug: 'browserinfo', emoji: '🖥️', titleKey: 'browserinfo.Title', noteKey: 'advancedtools.BrowserInfo', component: () => import('@/components/advanced-tools/BrowserInfo.vue') },
  { slug: 'securitychecklist', emoji: '📋', titleKey: 'securitychecklist.Title', noteKey: 'advancedtools.SecurityChecklist', component: () => import('@/components/advanced-tools/SecurityChecklist.vue') },
  { slug: 'servicestatus', emoji: '📡', titleKey: 'serviceStatus.Title', noteKey: 'advancedtools.ServiceStatus', component: () => import('@/components/advanced-tools/ServiceStatus.vue') },
  { slug: 'invisibilitytest', emoji: '🫣', titleKey: 'invisibilitytest.Title', noteKey: 'advancedtools.InvisibilityTest', component: () => import('@/components/advanced-tools/InvisibilityTest.vue'), requiresOriginalSite: true },
  { slug: 'enhanceddnsleaktest', emoji: '🌀', titleKey: 'enhanceddnsleaktest.Title', noteKey: 'advancedtools.EnhancedDnsLeakTest', component: () => import('@/components/advanced-tools/EnhancedDnsLeakTest.vue'), requiresOriginalSite: true },
];

// Fast slug → entry lookup (drawer + standalone page resolve a tool by slug).
export const TOOL_BY_SLUG = new Map(ADVANCED_TOOLS.map((tool) => [tool.slug, tool]));
