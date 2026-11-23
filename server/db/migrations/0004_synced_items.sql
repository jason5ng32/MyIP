-- One row per synced item (a preference, a Connectivity list model) per user, collection and schema version; `seq` orders a user's changes for incremental pulls.
CREATE SEQUENCE synced_items_seq;

CREATE TABLE synced_items (
    user_id text NOT NULL REFERENCES users(id),
    collection text NOT NULL,
    schema_version integer NOT NULL,
    item_id text NOT NULL,
    updated_at bigint NOT NULL,
    deleted boolean NOT NULL DEFAULT false,
    data jsonb,
    seq bigint NOT NULL,
    PRIMARY KEY (user_id, collection, schema_version, item_id)
);

ALTER SEQUENCE synced_items_seq OWNED BY synced_items.seq;

CREATE INDEX synced_items_user_seq ON synced_items (user_id, collection, schema_version, seq);
