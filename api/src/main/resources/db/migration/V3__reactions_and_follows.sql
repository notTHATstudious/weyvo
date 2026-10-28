-- One row per (reader, trip, reaction). The primary key makes repeated taps harmless.
CREATE TABLE trip_reactions (
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    trip_id    BIGINT      NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    type       VARCHAR(8)  NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, trip_id, type),
    CONSTRAINT trip_reactions_type_chk CHECK (type IN ('BEEN', 'WANT', 'SAVE'))
);
CREATE INDEX trip_reactions_trip_idx ON trip_reactions (trip_id, type);
CREATE INDEX trip_reactions_user_idx ON trip_reactions (user_id, type, created_at DESC);

CREATE TABLE follows (
    follower_id BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    followee_id BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followee_id),
    CONSTRAINT follows_not_self_chk CHECK (follower_id <> followee_id)
);
CREATE INDEX follows_followee_idx ON follows (followee_id);
