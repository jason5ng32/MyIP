// Unit tests for the pure topology walk in api/asn-connectivity.js. The walk
// takes an injected adjacency API, so fixtures need no snapshot on disk.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildTopology } from '../api/asn-connectivity.js';

// Build a rel API from plain objects; ASNs 101+ are the Tier 1 clique.
const makeRel = ({ providers = {}, peers = {}, tier1s = [], customerCounts = {} }) => {
    const t1 = new Set(tier1s);
    return {
        providersOf: (asn) => providers[asn] || [],
        peersOf: (asn) => peers[asn] || [],
        isTier1: (asn) => t1.has(asn),
        customerCountOf: (asn) => customerCounts[asn] || 0,
    };
};

const edgeKey = (e) => `${e.from}->${e.to}:${e.kind}`;
const sortedEdges = (graph) => graph.edges.map(edgeKey).sort();
const nodeType = (graph, asn) => graph.nodes.find(n => n.asn === asn)?.type;

describe('buildTopology', () => {
    it('walks transit chains up to Tier 1s and types nodes', () => {
        // 10 buys from 20; 20 buys from 101 (T1) and 30; 30 buys from 101.
        const rel = makeRel({
            providers: { 10: [20], 20: [101, 30], 30: [101] },
            tier1s: [101],
        });
        const graph = buildTopology(10, rel);
        assert.deepEqual(sortedEdges(graph), [
            '10->20:transit',
            '20->101:transit',
            '20->30:transit',
            '30->101:transit',
        ]);
        assert.equal(nodeType(graph, 10), 'origin');
        assert.equal(nodeType(graph, 20), 'intermediate');
        assert.equal(nodeType(graph, 101), 'tier1');
    });

    it('records Tier-1 peers as terminal peering edges', () => {
        // 10's provider 20 reaches the backbone by peering, not transit.
        const rel = makeRel({
            providers: { 10: [20] },
            peers: { 20: [101, 102, 40] }, // 40 is a non-T1 peer — ignored
            tier1s: [101, 102],
        });
        const graph = buildTopology(10, rel);
        assert.deepEqual(sortedEdges(graph), [
            '10->20:transit',
            '20->101:peering',
            '20->102:peering',
        ]);
        assert.equal(graph.nodes.some(n => n.asn === 40), false);
    });

    it('drops non-Tier-1 providers of a node peering with the clique', () => {
        // 5 T1 peers hit the peering bar → misinferred "provider" 60 vanishes.
        const rel = makeRel({
            providers: { 99: [101, 60], 60: [103] },
            peers: { 99: [102, 103, 104, 105, 106] },
            tier1s: [101, 102, 103, 104, 105, 106],
        });
        const graph = buildTopology(99, rel);
        assert.deepEqual(sortedEdges(graph), [
            '99->101:transit',
            '99->102:peering',
            '99->103:peering',
            '99->104:peering',
            '99->105:peering',
            '99->106:peering',
        ]);
        assert.equal(graph.nodes.some(n => n.asn === 60), false);
    });

    it('keeps a multihomed hoster below both trusted bars expanding', () => {
        // 5 T1 transits + 2 T1 peers is under both bars.
        const rel = makeRel({
            providers: { 10: [101, 102, 103, 104, 105, 20], 20: [106] },
            peers: { 10: [105, 106] },
            tier1s: [101, 102, 103, 104, 105, 106],
        });
        const graph = buildTopology(10, rel);
        assert.ok(graph.edges.some(e => edgeKey(e) === '10->20:transit'));
        assert.ok(graph.edges.some(e => edgeKey(e) === '20->106:transit'));
    });

    it('drops non-Tier-1 providers on high combined Tier-1 adjacency', () => {
        // 8 T1 transits, no T1 peers: only the combined bar catches it.
        const rel = makeRel({
            providers: { 99: [101, 102, 103, 104, 105, 106, 107, 108, 60], 60: [101] },
            tier1s: [101, 102, 103, 104, 105, 106, 107, 108],
        });
        const graph = buildTopology(99, rel);
        assert.equal(graph.nodes.some(n => n.asn === 60), false);
        assert.equal(graph.edges.length, 8);
        assert.ok(graph.edges.every(e => e.kind === 'transit'));
    });

    it('gives a Tier-1 origin its peering edges into the clique', () => {
        const rel = makeRel({
            peers: { 101: [102, 103] },
            tier1s: [101, 102, 103],
        });
        const graph = buildTopology(101, rel);
        assert.equal(nodeType(graph, 101), 'origin-tier1');
        assert.deepEqual(sortedEdges(graph), [
            '101->102:peering',
            '101->103:peering',
        ]);
    });

    it('caps non-Tier-1 providers at the top 3 by customer count', () => {
        const rel = makeRel({
            providers: { 10: [21, 22, 23, 24, 25] },
            customerCounts: { 21: 500, 22: 400, 23: 300, 24: 200, 25: 100 },
            // Providers reach a T1 so pruning doesn't hide the cap result.
            peers: { 21: [101], 22: [101], 23: [101], 24: [101], 25: [101] },
            tier1s: [101],
        });
        const graph = buildTopology(10, rel);
        const kept = graph.edges.filter(e => e.from === 10).map(e => e.to).sort();
        assert.deepEqual(kept, [21, 22, 23]);
    });

    it('prunes intermediate chains that never reach a Tier 1', () => {
        // 10 → 20 → 30, nobody touches the clique → single-node graph.
        const rel = makeRel({
            providers: { 10: [20], 20: [30] },
            tier1s: [101],
        });
        const graph = buildTopology(10, rel);
        assert.deepEqual(graph.nodes.map(n => n.asn), [10]);
        assert.deepEqual(graph.edges, []);
    });

    it('keeps one edge per pair, transit winning over peering', () => {
        const rel = makeRel({
            providers: { 10: [101] },
            peers: { 10: [101] },
            tier1s: [101],
        });
        const graph = buildTopology(10, rel);
        assert.deepEqual(sortedEdges(graph), ['10->101:transit']);
    });
});
