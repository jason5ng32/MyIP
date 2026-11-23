// The Benefits list of the account dialog (User.vue): groups → tiers → items,
// each item shown only when its own `when` holds on this deployment.
//
// Predicates read the facts built by utils/features/user-benefits.js:
//   achievements / accountSync / usage — the store's account capabilities
//   docsAssistant                      — the docs assistant is offered
//   tool(slug)                         — that Advanced Tool passes its gates
// A group's `when` gates the whole group. A tier's `current` reads the
// visitor ({ signedIn, sponsor }) for the "Current" badge; its `includesKey`
// is the "everything in the previous tier" lead line, never counted as an item.

const always = () => true;

export const BENEFIT_GROUPS = [
    {
        id: 'basic',
        titleKey: 'user.Benefits.Groups.Basic',
        when: always,
        tiers: [
            {
                id: 'visitor',
                nameKey: 'user.Benefits.Tiers.Visitor.Name',
                current: (v) => !v.signedIn,
                items: [
                    { id: 'ipLookup', key: 'user.Benefits.Tiers.Visitor.IpLookup', when: always },
                    { id: 'connectivity', key: 'user.Benefits.Tiers.Visitor.Connectivity', when: always },
                    { id: 'leakTests', key: 'user.Benefits.Tiers.Visitor.LeakTests', when: always },
                    { id: 'speedTest', key: 'user.Benefits.Tiers.Visitor.SpeedTest', when: always },
                    { id: 'tools', key: 'user.Benefits.Tiers.Visitor.Tools', when: always },
                    { id: 'openSource', key: 'user.Benefits.Tiers.Visitor.OpenSource', when: always },
                ],
            },
            {
                id: 'signedIn',
                nameKey: 'user.Benefits.Tiers.SignedIn.Name',
                includesKey: 'user.Benefits.Tiers.SignedIn.IncludesVisitor',
                current: (v) => v.signedIn,
                items: [
                    { id: 'achievements', key: 'user.Benefits.Tiers.SignedIn.Achievements', when: (f) => f.achievements },
                    { id: 'accountSync', key: 'user.Benefits.Tiers.SignedIn.AccountSync', when: (f) => f.accountSync },
                ],
            },
        ],
    },
    {
        id: 'ipChecking',
        titleKey: 'user.Benefits.Groups.IpChecking',
        when: (f) => f.usage,
        tiers: [
            {
                id: 'signedIn',
                nameKey: 'user.Benefits.Tiers.SignedIn.Name',
                current: (v) => v.signedIn && !v.sponsor,
                items: [
                    { id: 'advancedIp', key: 'user.Benefits.Tiers.SignedIn.AdvancedIp', when: always },
                    { id: 'invisibilityTest', key: 'user.Benefits.Tiers.SignedIn.InvisibilityTest', when: (f) => f.tool('invisibilitytest') },
                    { id: 'dnsLeakTest', key: 'user.Benefits.Tiers.SignedIn.DnsLeakTest', when: (f) => f.tool('enhanceddnsleaktest') },
                    { id: 'personaCheck', key: 'user.Benefits.Tiers.SignedIn.PersonaCheck', when: (f) => f.tool('personacheck') },
                    { id: 'ipilot', key: 'user.Benefits.Tiers.SignedIn.IPilot', when: (f) => f.docsAssistant },
                    { id: 'monthlyQuota', key: 'user.Benefits.Tiers.SignedIn.MonthlyQuota', when: always },
                ],
            },
            {
                id: 'sponsor',
                nameKey: 'user.Benefits.Tiers.Sponsor.Name',
                includesKey: 'user.Benefits.Tiers.Sponsor.IncludesSignedIn',
                current: (v) => v.signedIn && v.sponsor,
                sponsorCta: true,
                items: [
                    { id: 'higherQuota', key: 'user.Benefits.Tiers.Sponsor.HigherQuota', when: always },
                    { id: 'dailyLimit', key: 'user.Benefits.Tiers.Sponsor.DailyLimit', when: always },
                    { id: 'supportProject', key: 'user.Benefits.Tiers.Sponsor.SupportProject', when: always },
                ],
            },
        ],
    },
];
