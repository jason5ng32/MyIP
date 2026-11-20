// Re-export of common/sync-collections.js, the synced collections registry shared with the backend.
export {
    SYNC_COLLECTIONS, SYNC_COLLECTION_IDS, syncCollectionOf, syncValueBytes,
    CONNECTIVITY_SYNC_VERSION, CONNECTIVITY_SYNC_ITEM_IDS, SYNC_OFF_CODE,
    SYNC_MAX_ITEMS_PER_REQUEST, SYNC_TOMBSTONE_TTL_MS, SYNC_MAX_BODY_BYTES,
} from '../../common/sync-collections.js';
