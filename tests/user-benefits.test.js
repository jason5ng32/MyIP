// Tests for frontend/utils/features/user-benefits.js — which groups, tiers
// and items the account dialog lists on a deployment, whether the dialog and
// its Usage tab exist — over the registry in frontend/data/user-benefits.js.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { userBenefitsView } from '../frontend/utils/features/user-benefits.js';
import { BENEFIT_GROUPS } from '../frontend/data/user-benefits.js';
import en from '../frontend/locales/en.json' with { type: 'json' };

// A deployment the way the store derives it from its capabilities.
const deploymentOf = ({ accounts = false, userStorage = false, ipChecking = false, docs = false, probes = true } = {}) => {
    const capabilities = {
        accounts, userStorage, ipChecking,
        invisibilityProbe: probes, dnsLeakProbe: probes,
    };
    return {
        capabilities,
        achievements: accounts && userStorage,
        accountSync: accounts && userStorage,
        usage: accounts && ipChecking,
        docsAssistant: docs && accounts,
    };
};

// group id → tier id → item ids.
const shape = (view) => view.groups.map((group) => [group.id, group.tiers.map((tier) => [tier.id, tier.items.map((item) => item.id)])]);

const VISITOR = ['visitor', ['ipLookup', 'connectivity', 'leakTests', 'speedTest', 'tools', 'openSource']];
const IPCHECKING_SIGNED_IN = ['advancedIp', 'invisibilityTest', 'dnsLeakTest', 'personaCheck', 'monthlyQuota'];
const SPONSOR = ['sponsor', ['higherQuota', 'dailyLimit', 'supportProject']];

describe('userBenefitsView — the capability matrix', () => {
    it('no accounts: no dialog', () => {
        const view = userBenefitsView(deploymentOf());
        assert.equal(view.entry, false);
        assert.equal(view.usageTab, false);
        assert.deepEqual(view.groups, []);
    });

    it('accounts only: no dialog', () => {
        const view = userBenefitsView(deploymentOf({ accounts: true, docs: true }));
        assert.equal(view.entry, false);
        assert.deepEqual(view.groups, []);
    });

    it('accounts + storage: Basic only, no Usage tab, titled Benefits', () => {
        const view = userBenefitsView(deploymentOf({ accounts: true, userStorage: true, docs: true }));
        assert.equal(view.entry, true);
        assert.equal(view.usageTab, false);
        assert.equal(view.titleKey, 'user.Benefits.Benefit');
        assert.deepEqual(shape(view), [
            ['basic', [VISITOR, ['signedIn', ['achievements', 'accountSync']]]],
        ]);
    });

    it('accounts + ipChecking: Basic is the Visitor tier alone, IPCheck.ing benefits, Usage tab', () => {
        const view = userBenefitsView(deploymentOf({ accounts: true, ipChecking: true }));
        assert.equal(view.entry, true);
        assert.equal(view.usageTab, true);
        assert.equal(view.titleKey, 'user.Benefits.Title');
        assert.deepEqual(shape(view), [
            ['basic', [VISITOR]],
            ['ipChecking', [['signedIn', IPCHECKING_SIGNED_IN], SPONSOR]],
        ]);
    });

    it('all three: both groups in full', () => {
        const view = userBenefitsView(deploymentOf({ accounts: true, userStorage: true, ipChecking: true }));
        assert.equal(view.usageTab, true);
        assert.deepEqual(shape(view), [
            ['basic', [VISITOR, ['signedIn', ['achievements', 'accountSync']]]],
            ['ipChecking', [['signedIn', IPCHECKING_SIGNED_IN], SPONSOR]],
        ]);
    });

    it('the docs assistant adds IPilot before the monthly quota', () => {
        const view = userBenefitsView(deploymentOf({ accounts: true, ipChecking: true, docs: true }));
        const tier = view.groups.find((group) => group.id === 'ipChecking').tiers[0];
        assert.deepEqual(tier.items.map((item) => item.id),
            ['advancedIp', 'invisibilityTest', 'dnsLeakTest', 'personaCheck', 'ipilot', 'monthlyQuota']);
    });

    it('a tool gated off drops its item', () => {
        const view = userBenefitsView(deploymentOf({ accounts: true, ipChecking: true, probes: false }));
        const tier = view.groups.find((group) => group.id === 'ipChecking').tiers[0];
        assert.deepEqual(tier.items.map((item) => item.id), ['advancedIp', 'personaCheck', 'monthlyQuota']);
    });

    it('configs not loaded yet read as no dialog', () => {
        assert.equal(userBenefitsView().entry, false);
        assert.equal(userBenefitsView({ capabilities: {} }).entry, false);
    });
});

describe('userBenefitsView — lead lines, badges and the sponsor button', () => {
    const all = deploymentOf({ accounts: true, userStorage: true, ipChecking: true });
    const tierOf = (view, groupId, tierId) => view.groups.find((g) => g.id === groupId).tiers.find((t) => t.id === tierId);
    const currentIds = (view) => view.groups.map((group) => [group.id, group.tiers.filter((t) => t.current).map((t) => t.id)]);

    it('the lead line sits only where it is true', () => {
        const view = userBenefitsView(all);
        assert.equal(tierOf(view, 'basic', 'visitor').includesKey, null);
        assert.equal(tierOf(view, 'basic', 'signedIn').includesKey, 'user.Benefits.Tiers.SignedIn.IncludesVisitor');
        assert.equal(tierOf(view, 'ipChecking', 'signedIn').includesKey, null);
        assert.equal(tierOf(view, 'ipChecking', 'sponsor').includesKey, 'user.Benefits.Tiers.Sponsor.IncludesSignedIn');
    });

    it('a guest: Visitor is current, nothing in IPCheck.ing benefits', () => {
        assert.deepEqual(currentIds(userBenefitsView(all, { signedIn: false })),
            [['basic', ['visitor']], ['ipChecking', []]]);
    });

    it('signed in: Signed-in in both groups', () => {
        assert.deepEqual(currentIds(userBenefitsView(all, { signedIn: true })),
            [['basic', ['signedIn']], ['ipChecking', ['signedIn']]]);
    });

    it('a sponsor: Sponsor in IPCheck.ing benefits', () => {
        assert.deepEqual(currentIds(userBenefitsView(all, { signedIn: true, sponsor: true })),
            [['basic', ['signedIn']], ['ipChecking', ['sponsor']]]);
    });

    it('only the Sponsor tier carries the sponsor button', () => {
        const view = userBenefitsView(all);
        const withCta = view.groups.flatMap((g) => g.tiers.filter((t) => t.sponsorCta).map((t) => `${g.id}/${t.id}`));
        assert.deepEqual(withCta, ['ipChecking/sponsor']);
    });
});

describe('BENEFIT_GROUPS registry', () => {
    it('ids are unique per level and every entry has its keys and predicates', () => {
        const groupIds = BENEFIT_GROUPS.map((g) => g.id);
        assert.equal(new Set(groupIds).size, groupIds.length);
        for (const group of BENEFIT_GROUPS) {
            assert.equal(typeof group.when, 'function');
            assert.ok(group.titleKey.startsWith('user.Benefits.'));
            const tierIds = group.tiers.map((t) => t.id);
            assert.equal(new Set(tierIds).size, tierIds.length, group.id);
            for (const tier of group.tiers) {
                assert.equal(typeof tier.current, 'function');
                const itemIds = tier.items.map((i) => i.id);
                assert.equal(new Set(itemIds).size, itemIds.length, `${group.id}/${tier.id}`);
                for (const item of tier.items) {
                    assert.equal(typeof item.when, 'function', item.id);
                    assert.ok(item.key.startsWith('user.Benefits.Tiers.'), item.key);
                }
            }
        }
    });

    it('every key resolves in the en pack', () => {
        const lookup = (key) => key.split('.').reduce((node, part) => node?.[part], en);
        const keys = BENEFIT_GROUPS.flatMap((group) => [
            group.titleKey,
            ...group.tiers.flatMap((tier) => [tier.nameKey, tier.includesKey, ...tier.items.map((item) => item.key)]),
        ]).filter(Boolean);
        keys.push('user.Benefits.Title', 'user.Benefits.Benefit', 'user.Benefits.Intro', 'user.Usage.Title');
        assert.deepEqual(keys.filter((key) => typeof lookup(key) !== 'string' || !lookup(key)), []);
    });
});
