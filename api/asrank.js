// /api/asrank — CAIDA ASRank rank, customer cone and degree for one ASN.
// An ASN unknown to ASRank and an upstream failure both answer 200 with the
// same all-null record, so the page just hides the tiles; isAsRankHit is the
// route's cacheIf predicate, keeping those misses off the long edge cache.

import { fetchAsRank } from '../common/asrank.js';

const EMPTY_RECORD = {
    rank: null, asnName: null, orgName: null, country: null, degree: null, cone: null,
};

// Only a record with a rank is worth caching for days.
export const isAsRankHit = (body) => body?.rank != null;

export default async (req, res) => {
    // ASN presence + numeric validity guaranteed by requireValidASN middleware.
    const asn = Number(req.query.asn);
    const record = await fetchAsRank(asn);
    res.json({ asn, ...(record || EMPTY_RECORD) });
};
