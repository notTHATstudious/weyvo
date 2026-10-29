-- When each account was last seen (updated at most once a minute), and one row per account per day it was
-- active (India time). Together they give "active now", daily/weekly/monthly actives and retention,
-- with no tracking beyond our own database.
ALTER TABLE users ADD COLUMN last_seen_at TIMESTAMPTZ;
CREATE INDEX users_last_seen_idx ON users (last_seen_at);

CREATE TABLE user_activity_days (
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    day     DATE   NOT NULL,
    PRIMARY KEY (user_id, day)
);
CREATE INDEX user_activity_days_day_idx ON user_activity_days (day);

-- A share of a story (link or image). Counted only; who shared stays private to the admin totals.
CREATE TABLE trip_shares (
    id         BIGSERIAL PRIMARY KEY,
    trip_id    BIGINT      NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    user_id    BIGINT REFERENCES users (id) ON DELETE SET NULL,
    kind       VARCHAR(8)  NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT trip_shares_kind_chk CHECK (kind IN ('LINK', 'IMAGE'))
);
CREATE INDEX trip_shares_created_idx ON trip_shares (created_at);
