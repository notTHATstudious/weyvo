-- Open comments on a trip, with one level of replies.
CREATE TABLE trip_comments (
    id         BIGSERIAL PRIMARY KEY,
    trip_id    BIGINT       NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    author_id  BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    parent_id  BIGINT REFERENCES trip_comments (id) ON DELETE CASCADE,
    body       VARCHAR(500) NOT NULL,
    status     VARCHAR(20)  NOT NULL DEFAULT 'VISIBLE',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT trip_comments_status_chk CHECK (status IN ('VISIBLE', 'HIDDEN_BY_AUTHOR', 'HIDDEN_BY_REPORTS'))
);
CREATE INDEX trip_comments_trip_idx ON trip_comments (trip_id, created_at);
CREATE INDEX trip_comments_author_idx ON trip_comments (author_id, created_at DESC);

CREATE TABLE comment_reports (
    comment_id  BIGINT      NOT NULL REFERENCES trip_comments (id) ON DELETE CASCADE,
    reporter_id BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    reason      VARCHAR(16) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (comment_id, reporter_id),
    CONSTRAINT comment_reports_reason_chk CHECK (reason IN ('SPAM', 'ABUSE', 'OFF_TOPIC', 'OTHER'))
);

-- Comments and replies notify too; each comment notifies once.
ALTER TABLE notifications ADD COLUMN comment_id BIGINT REFERENCES trip_comments (id) ON DELETE CASCADE;
ALTER TABLE notifications DROP CONSTRAINT notifications_type_chk;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_chk
    CHECK (type IN ('FOLLOW', 'BEEN', 'WANT', 'QUESTION', 'ANSWER', 'COMMENT', 'REPLY'));
DROP INDEX notifications_once_uq;
CREATE UNIQUE INDEX notifications_once_uq
    ON notifications (recipient_id, actor_id, type, COALESCE(trip_id, 0), COALESCE(question_id, 0), COALESCE(comment_id, 0));
