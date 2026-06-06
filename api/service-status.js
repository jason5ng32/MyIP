// /api/service-status — the "Service Status" section's read endpoints.
//
// All three handlers below serve slices of the in-memory snapshot maintained
// by common/service-status-store.js (a background timer refreshes every
// provider on a fixed 5-minute schedule). None of them touch an upstream —
// request volume has no effect on upstream load. The split into overview vs
// per-provider detail keeps the initial page load light: the components /
// incidents lists are only fetched when a user expands a provider card.
//
//   default            GET /api/service-status            → overview (light per provider)
//   componentsHandler  GET /api/service-status/components → one provider's sub-services
//   incidentsHandler   GET /api/service-status/incidents  → one provider's recent incidents
//
// The detail handlers' `id` query param is whitelisted by
// requireValidProviderId() in backend-server.js.

import { getServiceStatusOverview, getProviderDetail } from '../common/service-status-store.js';

// Overview: every provider's status light, no heavy detail arrays.
export default async (req, res) => {
    res.json(getServiceStatusOverview());
};

// One provider's first-level sub-service list. Loaded when a card expands.
export const componentsHandler = async (req, res) => {
    // Defensive method gate — the route already restricts to GET, but a smoke
    // test asserts on this branch directly against the handler.
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const id = req.query.id;
    const provider = getProviderDetail(id);
    res.json({ id, components: provider ? provider.components : [] });
};

// One provider's recent incident history. Loaded on the incidents tab.
export const incidentsHandler = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const id = req.query.id;
    const provider = getProviderDetail(id);
    res.json({ id, incidents: provider ? provider.incidents : [] });
};
