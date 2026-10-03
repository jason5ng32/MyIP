// Relationship counts that agree with the /api/asn-connectivity graph. The
// graph walk (buildTopology) drops the non-Tier-1 "providers" of an AS that
// is adjacent to the Tier 1 clique past either bar below — CAIDA tends to
// misinfer such links for hypergiants. These helpers apply that same rule
// when counting, so ASN Info (the Radar `asn` view) and the ASN Profile
// neighbour lists never show an upstream the graph leaves out. Nothing is
// reclassified: a distrusted provider is simply not counted.

import { providersOf, peersOf, customersOf, customerCountOf, isTier1, isAsRelLoaded } from './as-rel-db.js';

// Peering-only bar: the hypergiant signature is clique peering (Google 12,
// Cloudflare 7). Combined bar: multihomed hosters with a real non-T1
// upstream sit at ≤6 Tier-1 adjacencies. buildTopology reads these too.
export const TIER1_PEERING_TRUSTED = 5;
export const TIER1_ADJACENCY_TRUSTED = 8;

// Default adjacency API; tests inject a fixture instead.
const asRelApi = { providersOf, peersOf, customersOf, isTier1, customerCountOf };

const unique = (list) => [...new Set(list)];

// The graph's test for `asn`, verbatim: are its non-Tier-1 providers noise?
export const distrustsNonTier1Providers = (asn, rel = asRelApi) => {
    const tier1Providers = rel.providersOf(asn).filter((p) => rel.isTier1(p));
    const tier1Peers = rel.peersOf(asn).filter((p) => rel.isTier1(p));
    return tier1Peers.length >= TIER1_PEERING_TRUSTED
        || tier1Providers.length + tier1Peers.length >= TIER1_ADJACENCY_TRUSTED;
};

// Upstreams, peers and customers of `origin` (ASN arrays). Distrusted
// non-Tier-1 providers are left out; a pair listed as both transit and
// peering counts as transit only.
export const countedRelationships = (origin, rel = asRelApi) => {
    const distrust = distrustsNonTier1Providers(origin, rel);
    const providers = unique(rel.providersOf(origin)).filter((p) => !distrust || rel.isTier1(p));
    const customers = unique(rel.customersOf(origin));
    const transit = new Set([...rel.providersOf(origin), ...customers]);
    const peers = unique(rel.peersOf(origin)).filter((asn) => !transit.has(asn));
    return { providers, peers, customers };
};

// Counts for the Radar `asn` view (ASN Info): absent ({}) when the snapshot
// isn't loaded or the AS has no relationships in it.
export const relationshipCounts = (asn, { rel = asRelApi, loaded = isAsRelLoaded } = {}) => {
    if (!loaded()) return {};
    const { providers, peers, customers } = countedRelationships(Number(asn), rel);
    if (!providers.length && !peers.length && !customers.length) return {};
    return { upstreamCount: providers.length, downstreamCount: customers.length, peerCount: peers.length };
};
