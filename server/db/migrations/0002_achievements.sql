-- One row per unlocked achievement: the user, its name and when it was unlocked.
CREATE TABLE achievements (
    user_id text NOT NULL REFERENCES users(id),
    name text NOT NULL,
    achieved_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, name)
);
