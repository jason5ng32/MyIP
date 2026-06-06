// /api/service-status — the "Service Status" section's read endpoints.
//
// Both handlers serve slices of the in-memory snapshot maintained by
// common/service-status-store.js (a background timer refreshes every provider
// on a fixed 5-minute schedule). Neither touches an upstream — request volume
// has no effect on upstream load. Splitting overview vs per-provider detail
// keeps the initial page load light: the detail (sub-services + incidents) is
// fetched only when a user expands a provider card.
//
//   default        GET /api/service-status         → overview (status per provider)
//   detailHandler  GET /api/service-status/detail  → one provider's sub-services + incidents
//
// The detail handler's `id` query param is whitelisted by
// requireValidProviderId() in backend-server.js.

import { getServiceStatusOverview, getProviderDetail } from '../common/service-status-store.js';

// Overview: every provider's status light, no heavy detail arrays.
export default async (req, res) => {
    res.json(getServiceStatusOverview());
};

// One provider's sub-services + recent incidents in a single response — a user
// who expands a card looks at both, so we don't split them into two requests.
export const detailHandler = async (req, res) => {
    // Defensive method gate — the route already restricts to GET, but a smoke
    // test asserts on this branch directly against the handler.
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const id = req.query.id;
    const provider = getProviderDetail(id);
    res.json({
        id,
        components: provider ? provider.components : [],
        incidents: provider ? provider.incidents : [],
    });
};
