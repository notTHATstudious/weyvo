-- "Ask the traveller": public questions on a trip, answered by its author.
CREATE TABLE trip_questions (
    id          BIGSERIAL PRIMARY KEY,
    trip_id     BIGINT       NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    asker_id    BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    body        VARCHAR(300) NOT NULL,
    answer      VARCHAR(500),
    answered_at TIMESTAMPTZ,
    status      VARCHAR(20)  NOT NULL DEFAULT 'VISIBLE',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT trip_questions_status_chk CHECK (status IN ('VISIBLE', 'HIDDEN_BY_AUTHOR', 'HIDDEN_BY_REPORTS'))
);
CREATE INDEX trip_questions_trip_idx ON trip_questions (trip_id, created_at);
CREATE INDEX trip_questions_asker_idx ON trip_questions (asker_id, created_at DESC);

CREATE TABLE question_reports (
    question_id BIGINT      NOT NULL REFERENCES trip_questions (id) ON DELETE CASCADE,
    reporter_id BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    reason      VARCHAR(16) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (question_id, reporter_id),
    CONSTRAINT question_reports_reason_chk CHECK (reason IN ('SPAM', 'ABUSE', 'OFF_TOPIC', 'OTHER'))
);

-- In-app notifications. The expression index stops repeat pings for the same event
-- (follow, unfollow, follow again) while still allowing one per distinct trip or question.
CREATE TABLE notifications (
    id           BIGSERIAL PRIMARY KEY,
    recipient_id BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    actor_id     BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type         VARCHAR(16) NOT NULL,
    trip_id      BIGINT REFERENCES trips (id) ON DELETE CASCADE,
    question_id  BIGINT REFERENCES trip_questions (id) ON DELETE CASCADE,
    read_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT notifications_type_chk CHECK (type IN ('FOLLOW', 'BEEN', 'WANT', 'QUESTION', 'ANSWER')),
    CONSTRAINT notifications_not_self_chk CHECK (recipient_id <> actor_id)
);
CREATE UNIQUE INDEX notifications_once_uq
    ON notifications (recipient_id, actor_id, type, COALESCE(trip_id, 0), COALESCE(question_id, 0));
CREATE INDEX notifications_inbox_idx ON notifications (recipient_id, created_at DESC);
