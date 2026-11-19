// ASN reputation from the IPCheck.ing API.

import { requestIpCheckingApi } from './ipcheck-ing-api.js';

// Resolves null when this deployment has no IPCheck.ing API configured, else
// { status, data } as the upstream answered (an unknown ASN is a 200 with
// found: false, a table still loading is a 503). A non-2xx body that isn't
// JSON comes back as data: null; a 2xx body that isn't JSON rejects, like a
// network failure — neither may pass for "no reputation". No visitor headers
// go along: the answer is the same for everyone.
export const requestAsnReputation = async (asn, { timeoutMs } = {}) => {
    const apiResponse = await requestIpCheckingApi('/asnreputation', { query: { asn }, timeoutMs });
    if (!apiResponse) return null;
    const data = apiResponse.ok
        ? await apiResponse.json()
        : await apiResponse.json().catch(() => null);
    return { status: apiResponse.status, data };
};
