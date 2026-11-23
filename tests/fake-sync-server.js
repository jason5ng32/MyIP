// An in-memory stand-in for the account sync endpoints (GET / PUT /api/sync and /api/sync/:collection), for specs.
import { SYNC_COLLECTIONS, SYNC_COLLECTION_IDS, SYNC_OFF_CODE } from '../frontend/utils/sync-collections.js';

// The composable's SYNC_ENDPOINT (frontend/composables/use-account-sync.js).
const SYNC_ENDPOINT = '/api/sync';

export const httpError = (status, code) => Object.assign(new Error(`HTTP ${status}`), { status, ...(code ? { code } : {}) });

export const BOTH = ['preferences', 'connectivity'];

// The settings and item endpoints over memory: per collection a seq-ordered item map, the newer `updatedAt` winning;
// an item route of a collection that is off answers 409 sync_off; turning one off deletes its rows. `settings: null`
// is an account with no stored choice: every collection on.
export const fakeServer = ({ settings = { collections: BOTH }, pageSize } = {}) => {
    const rows = Object.fromEntries(SYNC_COLLECTION_IDS.map((id) => [id, new Map()]));
    let seq = 0;
    const enabled = () => server.settings?.collections ?? SYNC_COLLECTION_IDS;
    const server = {
        calls: [],
        rows,
        settings: settings && { ...settings },
        fail: null, // (collection, method) → an error to throw, or null
        hold: null, // a promise every item request waits on
        holdSettings: null, // a promise the settings GET waits on
        seed(collection, item) {
            seq += 1;
            rows[collection].set(item.id, { ...item, deleted: Boolean(item.deleted), seq });
        },
        live(collection) {
            return Object.fromEntries([...rows[collection].values()].filter((row) => !row.deleted).map((row) => [row.id, row.value]));
        },
        async request(url, method = 'GET', body = null) {
            const { pathname, searchParams } = new URL(url, 'http://test');
            const collection = pathname === SYNC_ENDPOINT ? 'settings' : pathname.slice(SYNC_ENDPOINT.length + 1);
            server.calls.push({ collection, method, body, since: searchParams.get('since') });
            if (collection === 'settings') {
                if (method === 'GET' && server.holdSettings) await server.holdSettings;
                const error = server.fail?.('settings', method);
                if (error) throw error;
                if (method === 'PUT') {
                    server.settings = { collections: body.collections };
                    for (const id of Object.keys(rows)) if (!body.collections.includes(id)) rows[id].clear();
                }
                return { collections: [...enabled()] };
            }
            if (server.hold) await server.hold;
            const error = server.fail?.(collection, method);
            if (error) throw error;
            if (!enabled().includes(collection)) throw httpError(409, SYNC_OFF_CODE);
            const registry = SYNC_COLLECTIONS[collection];
            if (method === 'GET') {
                const since = Number(searchParams.get('since'));
                const size = pageSize ?? registry.pageSize;
                const all = [...rows[collection].values()].filter((row) => row.seq > since).sort((a, b) => a.seq - b.seq);
                const page = all.slice(0, size);
                return {
                    cursor: page.length ? page.at(-1).seq : since,
                    more: all.length > size,
                    items: page.map(({ id, updatedAt, deleted, value }) => (deleted ? { id, updatedAt, deleted } : { id, updatedAt, deleted, value })),
                };
            }
            const base = seq;
            const conflicts = [];
            const refused = [];
            for (const item of body.items) {
                if (!item.deleted && !registry.isValidValue(item.id, item.value)) {
                    refused.push({ id: item.id, reason: 'invalid' });
                    continue;
                }
                const stored = rows[collection].get(item.id);
                if (stored && stored.updatedAt >= item.updatedAt) {
                    const { seq: _, ...rest } = stored;
                    conflicts.push(rest);
                    continue;
                }
                server.seed(collection, item);
            }
            return { base, cursor: seq, conflicts, refused };
        },
    };
    return server;
};

