-- Email verification and session revocation.
ALTER TABLE users
    ADD COLUMN email_verified_at TIMESTAMPTZ,
    -- Bumped on password reset; sessions carrying an older version stop working everywhere.
    ADD COLUMN session_version   INTEGER NOT NULL DEFAULT 0;

-- Accounts created before verification existed are treated as verified.
UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;

-- One-time 6-digit codes. Only a keyed hash is stored, never the code.
CREATE TABLE email_codes (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    purpose     VARCHAR(8)  NOT NULL,
    code_hash   VARCHAR(64) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    attempts    INTEGER     NOT NULL DEFAULT 0,
    consumed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT email_codes_purpose_chk CHECK (purpose IN ('VERIFY', 'RESET'))
);
CREATE INDEX email_codes_user_idx ON email_codes (user_id, purpose, created_at DESC);

-- Sliding-window rate limits. Buckets never contain raw emails or IPs, only hashes.
CREATE TABLE rate_events (
    bucket     VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX rate_events_bucket_idx ON rate_events (bucket, created_at DESC);
