// Tests for common/as-relationships.js — relationship counts that follow
// the /api/asn-connectivity graph's own misinference rule: a distrusted
// non-Tier-1 provider is not counted (and not reclassified). The hypergiant
// fixture checks lists and graph agree; the graph itself is
// buildTopology, unchanged and covered in asn-connectivity.test.js.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    TIER1_PEERING_TRUSTED, TIER1_ADJACENCY_TRUSTED, distrustsNonTier1Providers,
    countedRelationships,
} from '../common/as-relationships.js';
import { buildTopology, buildNeighbours, fillNeighbourNames } from '../api/asn-connectivity.js';

// p2c and p2p edges → an adjacency API like common/as-rel-db.js.
const makeRel = ({ p2c = [], p2p = [], tier1s = [] }) => {
    const providers = new Map();
    const customers = new Map();
    const peers = new Map();
    const add = (map, k, v) => map.set(k, [...(map.get(k) || []), v]);
    for (const [provider, customer] of p2c) {
        add(providers, customer, provider);
        add(customers, provider, customer);
    }
    for (const [a, b] of p2p) {
        add(peers, a, b);
        add(peers, b, a);
    }
    const t1 = new Set(tier1s);
    return {
        providersOf: (asn) => providers.get(asn) || [],
        peersOf: (asn) => peers.get(asn) || [],
        customersOf: (asn) => customers.get(asn) || [],
        isTier1: (asn) => t1.has(asn),
        customerCountOf: (asn) => (customers.get(asn) || []).length,
    };
};

// 101–108 are the clique. HYPER peers with seven of them and is (wrongly)
// listed as a customer of REGIONAL, which itself buys from Tier 1 101.
const HYPER = 13335;
const REGIONAL = 500;
const CLIQUE = [101, 102, 103, 104, 105, 106, 107, 108];
const rel = makeRel({
    tier1s: CLIQUE,
    p2c: [[101, REGIONAL], [REGIONAL, HYPER], [REGIONAL, 800], [HYPER, 600], [REGIONAL, 900], [101, 900]],
    p2p: [...CLIQUE.slice(0, 7).map((t) => [HYPER, t]), [HYPER, 700]],
});

describe('distrustsNonTier1Providers', () => {
    it('applies the graph bars', () => {
        assert.equal(distrustsNonTier1Providers(HYPER, rel), true);
        assert.equal(distrustsNonTier1Providers(REGIONAL, rel), false);
        const peersOnly = makeRel({ tier1s: CLIQUE, p2p: CLIQUE.slice(0, TIER1_PEERING_TRUSTED - 1).map((t) => [1, t]) });
        assert.equal(distrustsNonTier1Providers(1, peersOnly), false);
        const mixed = makeRel({
            tier1s: CLIQUE,
            p2c: CLIQUE.slice(0, TIER1_ADJACENCY_TRUSTED - 4).map((t) => [t, 1]),
            p2p: CLIQUE.slice(4, 8).map((t) => [1, t]),
        });
        assert.equal(distrustsNonTier1Providers(1, mixed), true);
    });
});

describe('countedRelationships', () => {
    it('a hypergiant: the distrusted non-Tier-1 provider is not counted at all', () => {
        const { providers, peers, customers } = countedRelationships(HYPER, rel);
        assert.deepEqual(providers, []);
        assert.deepEqual(customers, [600]);
        assert.deepEqual(peers, [...CLIQUE.slice(0, 7), 700]);
        assert.equal(peers.includes(REGIONAL), false);
    });

    it('the other end is untouched: no customer-side inference', () => {
        const { providers, peers, customers } = countedRelationships(REGIONAL, rel);
        assert.deepEqual(providers, [101]);
        assert.deepEqual(customers, [HYPER, 800, 900]);
        assert.deepEqual(peers, []);
    });

    it('an ordinary AS keeps every provider; transit wins over peering', () => {
        const ordinary = makeRel({ p2c: [[20, 10], [21, 10], [10, 50]], p2p: [[10, 20], [10, 40]] });
        assert.deepEqual(countedRelationships(10, ordinary), { providers: [20, 21], peers: [40], customers: [50] });
    });
});

describe('lists and graph agree', () => {
    it('hypergiant: no upstream in the counts, none drawn', () => {
        const neighbours = buildNeighbours(HYPER, rel, () => null);
        assert.deepEqual(neighbours.counts, { providers: 0, peers: 8, customers: 1 });
        const graph = buildTopology(HYPER, rel);
        assert.equal(graph.nodes.some((n) => n.asn === REGIONAL), false);
        assert.ok(graph.edges.every((e) => e.kind === 'peering'));
    });

    it('regional: counts match the lists', () => {
        assert.deepEqual(buildNeighbours(REGIONAL, rel, () => null).counts, { providers: 1, peers: 0, customers: 3 });
    });
});

describe('fillNeighbourNames', () => {
    it('fills names as2org lacks from the graph nodes', () => {
        const neighbours = { providers: [{ asn: 1, name: null }], peers: [{ asn: 2, name: 'Kept' }], customers: [{ asn: 3, name: null }] };
        fillNeighbourNames(neighbours, [{ asn: 1, name: 'From graph' }, { asn: 2, name: 'Other' }]);
        assert.equal(neighbours.providers[0].name, 'From graph');
        assert.equal(neighbours.peers[0].name, 'Kept');
        assert.equal(neighbours.customers[0].name, null);
    });
});
