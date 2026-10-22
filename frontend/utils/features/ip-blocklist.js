// Pure layer of the IP Blocklist Check (advanced-tools/IpBlocklist.vue) over
// the /api/ipblocklist answer — the private API's /iphitlist: two parts
// (`dnsbl`, `static`), each `{ checkedAt, summary, results }`, every item
// carrying a status (listed / notice / clean / error) and a kind (abuse /
// anonymity). The API decides kinds and order; this only picks what to show.

// Listed counts by kind. An answer without `listedBy` counts every listing as
// abuse — never let a hit read as clean.
export const listedCounts = (summary) => ({
    abuse: summary?.listedBy?.abuse ?? summary?.listed ?? 0,
    anonymity: summary?.listedBy?.anonymity ?? 0,
});

// Headline verdict, worst first: a bad record outweighs an anonymizer mark,
// which outweighs advisory notices.
export const blocklistVerdict = (summary) => {
    const listedBy = listedCounts(summary);
    if (listedBy.abuse > 0) return 'abuse';
    if (listedBy.anonymity > 0) return 'anonymity';
    if (summary?.notice > 0) return 'notice';
    return 'clean';
};

// One part's rows: hits (listed + notice) stay open, the rest (clean + error)
// fold away. Keeps the API's order within each.
export const splitPart = (part) => {
    const results = Array.isArray(part?.results) ? part.results : [];
    return {
        hits: results.filter((r) => r.status === 'listed' || r.status === 'notice'),
        rest: results.filter((r) => r.status !== 'listed' && r.status !== 'notice'),
    };
};

// Tone of any row — one icon / color per tone: abuse | anonymity (listed, by
// kind) | notice (advisory whatever its kind) | clean | error.
export const itemTone = (item) => {
    if (item?.status === 'notice' || item?.status === 'clean' || item?.status === 'error') return item.status;
    return item?.kind === 'anonymity' ? 'anonymity' : 'abuse';
};

// i18n lookup for a reason key. IPsum's `feeds1`…`feeds8` share one
// parametrized string; any other key maps to its own entry.
export const reasonMessage = (reason) => {
    const feeds = /^feeds(\d+)$/.exec(reason);
    if (feeds) return { key: 'ipblocklist.reason.feeds', params: { n: Number(feeds[1]) } };
    return { key: `ipblocklist.reason.${reason}`, params: {} };
};
