// ASN reputation from the main IPCheck.ing API

import { fetchUpstream } from '../common/fetch-with-timeout.js';

// Resolves null when this deployment has no private API configured, else
// { status, data } as the upstream answered (an unknown ASN is a 200 with
// found: false, a table still loading is a 503). A non-2xx body that isn't
// JSON comes back as data: null; a 2xx body that isn't JSON rejects, like a
// network failure — neither may pass for "no reputation".
export const requestAsnReputation = async (asn, headers, { timeoutMs } = {}) => {
    const apiKey = process.env.IPCHECKING_API_KEY;
    const apiEndpoint = process.env.IPCHECKING_API_ENDPOINT;
    if (!apiKey || !apiEndpoint) return null;

    const url = new URL(`${apiEndpoint}/asnreputation`);
    url.searchParams.set('asn', asn);
    url.searchParams.set('key', apiKey);
    const apiResponse = await fetchUpstream(url, { headers: { ...headers }, ...(timeoutMs && { timeoutMs }) });
    const data = apiResponse.ok
        ? await apiResponse.json()
        : await apiResponse.json().catch(() => null);
    return { status: apiResponse.status, data };
};
