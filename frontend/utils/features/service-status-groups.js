// Splits the Service Status providers into the page's two card groups —
// those reporting issues and the rest. Framework-free; tested in
// tests/service-status-groups.test.js.

// Indicators that put a provider in the issues group, most severe first.
const ISSUE_RANK = { critical: 0, major: 1, minor: 2, maintenance: 3 };

// Any indicator outside the Statuspage vocabulary (missing, failed fetch,
// unexpected string) reads as 'unknown'.
export const normalizeIndicator = (indicator) =>
    (indicator === 'none' || Object.hasOwn(ISSUE_RANK, indicator) ? indicator : 'unknown');

// providers: the static list, in display order · indicatorById: id → raw
// indicator from the overview. While loading or after a failed fetch every
// provider sits in the operational group. Issues sort by severity; the
// operational group keeps list order with unknown last; ties keep list order.
export const groupProviders = (providers, indicatorById = {}, { loading = false, failed = false } = {}) => {
    if (loading || failed) return { issues: [], operational: [...providers] };

    const entries = providers.map((provider, index) => ({
        provider, index, indicator: normalizeIndicator(indicatorById[provider.id]),
    }));
    const issues = entries
        .filter((e) => Object.hasOwn(ISSUE_RANK, e.indicator))
        .sort((a, b) => ISSUE_RANK[a.indicator] - ISSUE_RANK[b.indicator] || a.index - b.index);
    const up = entries.filter((e) => e.indicator === 'none');
    const unknown = entries.filter((e) => e.indicator === 'unknown');

    return {
        issues: issues.map((e) => e.provider),
        operational: [...up, ...unknown].map((e) => e.provider),
    };
};
