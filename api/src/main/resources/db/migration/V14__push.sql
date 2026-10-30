-- Web push: each browser or home-screen app that turned notifications on.
CREATE TABLE push_subscriptions (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    endpoint   VARCHAR(1000) NOT NULL UNIQUE,
    p256dh     VARCHAR(200)  NOT NULL,
    auth       VARCHAR(100)  NOT NULL,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_user_idx ON push_subscriptions (user_id);

-- The server's own signing key for push (VAPID), made once on first use. One row only.
CREATE TABLE push_keys (
    id          SMALLINT PRIMARY KEY CHECK (id = 1),
    public_key  VARCHAR(200) NOT NULL,
    private_key VARCHAR(200) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
