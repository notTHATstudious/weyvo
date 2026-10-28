-- Account plan. Limits per plan live in configuration (app.plans.*), not in the database.
ALTER TABLE users
    ADD COLUMN plan            VARCHAR(10) NOT NULL DEFAULT 'FREE',
    ADD COLUMN plan_expires_at TIMESTAMPTZ,
    ADD CONSTRAINT users_plan_chk CHECK (plan IN ('FREE', 'PREMIUM'));

-- One row per accepted upload, for the per-hour upload limit. Kept separate from trip_photos so
-- replacing or deleting photos can't be used to reset the count.
CREATE TABLE photo_uploads (
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX photo_uploads_user_time_idx ON photo_uploads (user_id, created_at DESC);
