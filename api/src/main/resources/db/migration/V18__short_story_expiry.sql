-- Short stories are deleted 7 days after posting. Those already posted get 7 days from this release.
ALTER TABLE trips ADD COLUMN expires_at TIMESTAMPTZ;
UPDATE trips SET expires_at = now() + interval '7 days' WHERE kind = 'SHORT' AND status = 'PUBLISHED';
CREATE INDEX trips_expires_idx ON trips (expires_at) WHERE expires_at IS NOT NULL;

-- Wey points outlive a short story that reached its 7 days; deleting one earlier still gives them up.
CREATE TABLE expired_short_stories (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    published_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX expired_short_stories_user_idx ON expired_short_stories (user_id);
