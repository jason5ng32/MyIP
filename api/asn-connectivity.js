// /api/asn-connectivity — layered BFS over CAIDA AS-Relationships starting at
// the origin AS, halting at Tier 1s or MAX_DEPTH. Returns a graph the frontend
// renders dagre-style: origin (left) → intermediates → Tier 1s (right).
// Inspired by bgp.tools' /as/<N>#connectivity view.
//
// Edges carry a kind: 'transit' (p2c, customer → provider) or 'peering' (p2p
// with a Tier 1). Peering matters because hypergiants buy no transit — their
// backbone connectivity is settlement-free peering with the Tier 1 clique,
// invisible to a p2c-only walk.
//
// Data is fully local (common/as-rel-db.js + common/as-org-db.js), so the
// whole BFS is synchronous. We only hit RIPEstat for as-overview as a
// rare fallback when as2org doesn't have an ASN's org name.

import { resolveAsnOrgName } from '../common/ripestat.js';
import { providersOf, peersOf, customerCountOf, isTier1 } from '../common/as-rel-db.js';
import logger from '../common/logger.js';

// How deep to recurse from the origin. 3 covers regional networks reaching
// Tier 1s through 1-2 intermediates; deeper just adds noise at the periphery.
const MAX_DEPTH = 3;

// Per-node cap on non-Tier-1 providers to recurse into, ranked by
// customerCount as a proxy for "primary transit".
const MAX_INTERMEDIATE_BRANCH = 3;

// Past either bar, a node's non-Tier-1 "providers" are treated as CAIDA
// misinference and dropped. Peering-only bar: the hypergiant signature is
// clique peering (Google 12, Cloudflare 7). Combined bar: multihomed hosters
// with a real non-T1 upstream sit at ≤6 Tier-1 adjacencies.
const TIER1_PEERING_TRUSTED = 5;
const TIER1_ADJACENCY_TRUSTED = 8;

// Two-tier org name resolver lives in common/ripestat.js. No onError hook
// here — connectivity stays silent on as-overview fallback failures (a node
// just keeps name=null); asn-history is the one that warns.
const resolveOrgName = (asn) => resolveAsnOrgName(asn);

// Default adjacency API for buildTopology; tests inject a fixture instead.
const asRelApi = { providersOf, peersOf, isTier1, customerCountOf };

// Pure synchronous topology walk — no org names, no I/O. Exported for tests.
export const buildTopology = (origin, rel = asRelApi) => {
    const nodes = new Map();
    const edges = [];
    const edgeKeys = new Set();

    const addNode = (asn, type) => {
        if (!nodes.has(asn)) nodes.set(asn, { asn, type, name: null });
    };
    // First kind wins on a duplicate pair; transit is always added first.
    const addEdge = (from, to, kind) => {
        const key = `${from}->${to}`;
        if (edgeKeys.has(key)) return;
        edgeKeys.add(key);
        edges.push({ from, to, kind });
    };

    // A Tier-1 origin's graph is its peering edges into the rest of the clique.
    addNode(origin, rel.isTier1(origin) ? 'origin-tier1' : 'origin');

    let currentLayer = [origin];

    for (let depth = 0; depth < MAX_DEPTH; depth++) {
        if (currentLayer.length === 0) break;
        const nextLayer = [];

        for (const asn of currentLayer) {
            const providers = rel.providersOf(asn);
            const tier1Providers = providers.filter(p => rel.isTier1(p));
            const tier1Peers = rel.peersOf(asn).filter(p => rel.isTier1(p));

            // Tier 1 hits are terminal — record the edge + node, no recursion.
            for (const p of tier1Providers) {
                addEdge(asn, p, 'transit');
                addNode(p, 'tier1');
            }
            for (const p of tier1Peers) {
                addEdge(asn, p, 'peering');
                addNode(p, 'tier1');
            }

            // Clique-adjacent node: non-Tier-1 providers are noise.
            if (tier1Peers.length >= TIER1_PEERING_TRUSTED
                || tier1Providers.length + tier1Peers.length >= TIER1_ADJACENCY_TRUSTED) continue;

            const intermediates = providers
                .filter(p => !rel.isTier1(p))
                .sort((a, b) => rel.customerCountOf(b) - rel.customerCountOf(a))
                .slice(0, MAX_INTERMEDIATE_BRANCH);

            for (const p of intermediates) {
                addEdge(asn, p, 'transit');
                if (!nodes.has(p)) {
                    addNode(p, 'intermediate');
                    nextLayer.push(p);
                }
            }
        }

        currentLayer = nextLayer;
    }

    return pruneLeafIntermediates([...nodes.values()], edges);
};

async function buildGraph(origin) {
    const { nodes, edges } = buildTopology(origin);

    // Org lookups run concurrently; a failed one just keeps name=null.
    await Promise.all(nodes.map(async (node) => {
        try {
            const name = await resolveOrgName(node.asn);
            if (name) node.name = name;
        } catch {
            // node keeps name=null
        }
    }));

    return { nodes, edges };
}

// Iteratively drop intermediate nodes with no outgoing edge — visual
// dead-ends that contribute no info. Iterates to fixed-point because
// removing one leaf can turn its parent into a leaf. origin / origin-tier1
// / tier1 are never pruned.
function pruneLeafIntermediates(nodes, edges) {
    let currentNodes = nodes;
    let currentEdges = edges;
    while (true) {
        const hasOutgoing = new Set(currentEdges.map(e => e.from));
        const survivors = currentNodes.filter(n =>
            n.type !== 'intermediate' || hasOutgoing.has(n.asn)
        );
        if (survivors.length === currentNodes.length) {
            return { nodes: currentNodes, edges: currentEdges };
        }
        const survivorAsns = new Set(survivors.map(n => n.asn));
        currentEdges = currentEdges.filter(e =>
            survivorAsns.has(e.from) && survivorAsns.has(e.to)
        );
        currentNodes = survivors;
    }
}

export default async (req, res) => {
    // ASN presence + numeric validity guaranteed by requireValidASN middleware.
    const asn = parseInt(req.query.asn, 10);
    try {
        const graph = await buildGraph(asn);
        res.json({ origin: asn, ...graph });
    } catch (error) {
        logger.error({ err: error, asn }, 'asn-connectivity handler failed');
        res.status(500).json({ error: error.message });
    }
};
