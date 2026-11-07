// DNS Resolver row status → the locale keys that explain a row with no answer.
// Rows from /api/dnsresolver carry `status` ('ok' or a failure class); a row
// without one reads 'N/A' as unavailable.

export const DNS_FAILURE_STATUSES = ['nodata', 'nxdomain', 'servfail', 'refused', 'timeout', 'unavailable', 'malformed'];

export const dnsRowStatus = (entry) => {
    if (typeof entry?.status === 'string' && entry.status) return entry.status;
    return entry?.result === 'N/A' ? 'unavailable' : 'ok';
};

// null for an answered row; an unknown failure class falls back to unavailable.
export const dnsFailureKeys = (status) => {
    if (status === 'ok') return null;
    const key = DNS_FAILURE_STATUSES.includes(status) ? status : 'unavailable';
    return {
        label: `dnsresolver.Failure.${key}.Label`,
        hint: `dnsresolver.Failure.${key}.Hint`,
    };
};
