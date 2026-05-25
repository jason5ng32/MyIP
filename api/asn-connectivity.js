// /api/asn-connectivity — BFS over CAIDA AS-Relationships starting at the
// origin AS, halting at Tier 1s or MAX_DEPTH. Returns a graph the frontend
// renders dagre-style: origin (left) → intermediates → Tier 1s (right).
// Inspired by bgp.tools' /as/<N>#connectivity view.
//
// Data is fully local (common/as-rel-db.js + common/as-org-db.js), so the
// whole BFS is synchronous. We only hit RIPEstat for as-overview as a
// rare fallback when as2org doesn't have an ASN's org name.

import { fetchAsOverview, extractOrgFromHolder } from '../common/ripestat.js';
import { lookupAsOrgName } from '../common/as-org-db.js';
import { providersOf, customerCountOf, isTier1 } from '../common/as-rel-db.js';
import logger from '../common/logger.js';

// How deep to recurse from the origin. 3 covers regional networks reaching
// Tier 1s through 1-2 intermediates; deeper just adds noise at the periphery.
const MAX_DEPTH = 3;

// Per-node cap on non-Tier-1 providers to recurse into. Matters mainly for
// hyperscalers (Cloudflare-class has 100+ providers); ranked by customerCount
// as a proxy for "primary transit".
const MAX_INTERMEDIATE_BRANCH = 3;

// Two-tier org name resolver: local CAIDA as2org first (µs), RIPEstat
// as-overview fallback when the snapshot doesn't have the ASN.
async function resolveOrgName(asn) {
    const local = lookupAsOrgName(asn);
    if (local) return local;
    try {
        const res = await fetchAsOverview(asn);
        if (!res.ok) return null;
        const payload = await res.json();
        return extractOrgFromHolder(payload?.data?.holder);
    } catch {
        return null;
    }
}

async function buildGraph(origin) {
    const nodes = new Map();
    const edgeSet = new Set();
    const orgPromises = new Map();

    // If the queried AS is itself a Tier 1, mark it 'origin-tier1' so the
    // frontend can render the combined origin+Tier1 styling; the rest of
    // the BFS is a no-op (Tier 1s have no providers) and the graph is
    // legitimately a single node.
    const originType = isTier1(origin) ? 'origin-tier1' : 'origin';
    nodes.set(origin, { asn: origin, type: originType, name: null });
    orgPromises.set(origin, resolveOrgName(origin));

    let currentLayer = [origin];

    for (let depth = 0; depth < MAX_DEPTH; depth++) {
        if (currentLayer.length === 0) break;
        const nextLayer = [];

        for (const asn of currentLayer) {
            const providers = providersOf(asn);
            if (providers.length === 0) continue;

            // Tier 1 hits are terminal — record the edge + node, no recursion.
            for (const p of providers) {
                if (!isTier1(p)) continue;
                edgeSet.add(`${asn}->${p}`);
                if (!nodes.has(p)) {
                    nodes.set(p, { asn: p, type: 'tier1', name: null });
                    orgPromises.set(p, resolveOrgName(p));
                }
            }

            // Non-Tier-1 providers: pick top-N by customerCount so when we
            // truncate, the displayed ones are the more meaningful transits.
            const intermediates = providers
                .filter(p => !isTier1(p))
                .sort((a, b) => customerCountOf(b) - customerCountOf(a))
                .slice(0, MAX_INTERMEDIATE_BRANCH);

            for (const p of intermediates) {
                edgeSet.add(`${asn}->${p}`);
                if (!nodes.has(p)) {
                    nodes.set(p, { asn: p, type: 'intermediate', name: null });
                    orgPromises.set(p, resolveOrgName(p));
                    nextLayer.push(p);
                }
            }
        }

        currentLayer = nextLayer;
    }

    // Await all org lookups. They've been running in the background since
    // each node was discovered, so most are already settled.
    for (const [asn, promise] of orgPromises) {
        try {
            const name = await promise;
            const node = nodes.get(asn);
            if (node && name) node.name = name;
        } catch {
            // node keeps name=null
        }
    }

    const allNodes = [...nodes.values()];
    const allEdges = [...edgeSet].map(s => {
        const [from, to] = s.split('->').map(Number);
        return { from, to };
    });
    return pruneLeafIntermediates(allNodes, allEdges);
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
