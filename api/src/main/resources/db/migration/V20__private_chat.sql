-- Private, Snapchat-style chat. A request becomes the chat once accepted. Messages wait here only until they're
-- read and both people have left (or 2 hours after reading, or 12 hours unread), then they're deleted.
CREATE TABLE chat_requests (
    id          BIGSERIAL PRIMARY KEY,
    from_id     BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    to_id       BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status      VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at  TIMESTAMPTZ,
    CONSTRAINT chat_requests_status_chk CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
    CONSTRAINT chat_requests_not_self_chk CHECK (from_id <> to_id)
);
-- One row per pair of people, whichever way round.
CREATE UNIQUE INDEX chat_requests_pair_uq ON chat_requests (LEAST(from_id, to_id), GREATEST(from_id, to_id));
CREATE INDEX chat_requests_to_idx ON chat_requests (to_id, status);
CREATE INDEX chat_requests_from_idx ON chat_requests (from_id, created_at);

CREATE TABLE chat_messages (
    id         BIGSERIAL PRIMARY KEY,
    chat_id    BIGINT       NOT NULL REFERENCES chat_requests (id) ON DELETE CASCADE,
    sender_id  BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    body       VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    read_at    TIMESTAMPTZ
);
CREATE INDEX chat_messages_chat_idx ON chat_messages (chat_id, id);
CREATE INDEX chat_messages_unread_idx ON chat_messages (created_at) WHERE read_at IS NULL;
CREATE INDEX chat_messages_read_idx ON chat_messages (read_at) WHERE read_at IS NOT NULL;

-- A report keeps a copy of the last messages, since the chat itself vanishes. Admins read only these.
CREATE TABLE chat_reports (
    id          BIGSERIAL PRIMARY KEY,
    reporter_id BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    reported_id BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    transcript  TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ
);
CREATE INDEX chat_reports_open_idx ON chat_reports (created_at) WHERE reviewed_at IS NULL;
