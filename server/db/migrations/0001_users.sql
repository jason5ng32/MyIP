-- One row per end user: the opaque user id and when the row was created, nothing else.
CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now()
);
