-- One row per user who chose what to sync: the enabled collection ids (empty = sync nothing).
CREATE TABLE sync_settings (
    user_id text PRIMARY KEY REFERENCES users(id),
    collections text[] NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);
