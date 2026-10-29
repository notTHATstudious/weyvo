-- Blocking: either side of a block stops seeing and reaching the other.
CREATE TABLE user_blocks (
    blocker_id BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    blocked_id BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id),
    CONSTRAINT user_blocks_not_self_chk CHECK (blocker_id <> blocked_id)
);
CREATE INDEX user_blocks_blocked_idx ON user_blocks (blocked_id);

-- Admins review reports. Granted by hand in the database, never through the app.
ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;

-- Stories can be reported too. An admin can take a story down; its author still sees it.
CREATE TABLE trip_reports (
    trip_id     BIGINT      NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    reporter_id BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    reason      VARCHAR(16) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    PRIMARY KEY (trip_id, reporter_id),
    CONSTRAINT trip_reports_reason_chk CHECK (reason IN ('SPAM', 'ABUSE', 'OFF_TOPIC', 'OTHER'))
);
ALTER TABLE trips ADD COLUMN removed_at TIMESTAMPTZ;

-- A report leaves the admin queue once reviewed; later reports reopen it.
ALTER TABLE comment_reports ADD COLUMN reviewed_at TIMESTAMPTZ;
ALTER TABLE question_reports ADD COLUMN reviewed_at TIMESTAMPTZ;
CREATE INDEX comment_reports_open_idx ON comment_reports (comment_id) WHERE reviewed_at IS NULL;
CREATE INDEX question_reports_open_idx ON question_reports (question_id) WHERE reviewed_at IS NULL;
CREATE INDEX trip_reports_open_idx ON trip_reports (trip_id) WHERE reviewed_at IS NULL;
