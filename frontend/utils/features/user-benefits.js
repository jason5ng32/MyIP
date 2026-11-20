// What the account dialog (User.vue) shows on this deployment: whether it
// exists at all, whether it carries the Usage tab, and the Benefits groups →
// tiers → items from data/user-benefits.js that pass their gates.

import { BENEFIT_GROUPS } from '../../data/user-benefits.js';
import { TOOL_BY_SLUG } from '../../data/tools.js';
import { isToolAvailable } from '../tool-availability.js';

// deployment: { capabilities, achievements, accountSync, usage, docsAssistant }
// — the store's capabilities and its account getters, plus the docs assistant
// gate. visitor: { signedIn, sponsor }.
export const userBenefitsView = (deployment = {}, visitor = {}) => {
    const facts = {
        achievements: Boolean(deployment.achievements),
        accountSync: Boolean(deployment.accountSync),
        usage: Boolean(deployment.usage),
        docsAssistant: Boolean(deployment.docsAssistant),
        tool: (slug) => isToolAvailable(TOOL_BY_SLUG.get(slug), deployment.capabilities),
    };
    const who = { signedIn: Boolean(visitor.signedIn), sponsor: Boolean(visitor.sponsor) };

    // A tier without items, and a group without tiers, are left out.
    const groups = BENEFIT_GROUPS
        .filter((group) => group.when(facts))
        .map((group) => ({
            id: group.id,
            titleKey: group.titleKey,
            tiers: group.tiers
                .map((tier) => ({
                    id: tier.id,
                    nameKey: tier.nameKey,
                    includesKey: tier.includesKey ?? null,
                    current: tier.current(who),
                    sponsorCta: Boolean(tier.sponsorCta),
                    items: tier.items.filter((item) => item.when(facts)).map(({ id, key }) => ({ id, key })),
                }))
                .filter((tier) => tier.items.length > 0),
        }))
        .filter((group) => group.tiers.length > 0);

    // The dialog exists when sign-in adds something; Usage only with the usage summary.
    const entry = facts.achievements || facts.accountSync || facts.usage;
    return {
        entry,
        usageTab: entry && facts.usage,
        titleKey: facts.usage ? 'user.Benefits.Title' : 'user.Benefits.Benefit',
        groups: entry ? groups : [],
    };
};
