-- Lifetime use counts per feature, for achievements only (never a quota).
CREATE TABLE feature_uses (
    user_id text NOT NULL REFERENCES users(id),
    feature text NOT NULL,
    times integer NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, feature)
);
