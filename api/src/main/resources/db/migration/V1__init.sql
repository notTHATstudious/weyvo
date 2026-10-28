-- Accounts and profile fields (one table until profiles need their own lifecycle).
CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    email         VARCHAR(254) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    username      VARCHAR(30)  NOT NULL,
    display_name  VARCHAR(60)  NOT NULL,
    bio           VARCHAR(160),
    status        VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT users_status_chk CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETED'))
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));
CREATE UNIQUE INDEX users_username_uq ON users (lower(username));

-- Full trips and short stories share one table; kind decides which template rules apply.
CREATE TABLE trips (
    id           BIGSERIAL PRIMARY KEY,
    owner_id     BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    slug         VARCHAR(80)  NOT NULL UNIQUE,
    kind         VARCHAR(8)   NOT NULL,
    short_tag    VARCHAR(16),
    title        VARCHAR(60)  NOT NULL,
    place        VARCHAR(120) NOT NULL,
    start_date   DATE,
    end_date     DATE,
    intro        VARCHAR(250),
    final_note   VARCHAR(200),
    visibility   VARCHAR(10)  NOT NULL DEFAULT 'PRIVATE',
    status       VARCHAR(10)  NOT NULL DEFAULT 'DRAFT',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    CONSTRAINT trips_kind_chk CHECK (kind IN ('FULL', 'SHORT')),
    CONSTRAINT trips_short_tag_chk CHECK (
        (kind = 'SHORT' AND short_tag IN ('WEEKEND', 'ONE_NIGHT', 'LONG_DRIVE', 'DAY_TRIP'))
        OR (kind = 'FULL' AND short_tag IS NULL)),
    CONSTRAINT trips_visibility_chk CHECK (visibility IN ('PUBLIC', 'UNLISTED', 'PRIVATE')),
    CONSTRAINT trips_status_chk CHECK (status IN ('DRAFT', 'PUBLISHED')),
    CONSTRAINT trips_dates_chk CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);
CREATE INDEX trips_owner_idx ON trips (owner_id, updated_at DESC);
CREATE INDEX trips_feed_idx ON trips (published_at DESC) WHERE status = 'PUBLISHED' AND visibility = 'PUBLIC';

-- Story sections in order. For a short story these hold the per-photo captions.
CREATE TABLE trip_sections (
    id            BIGSERIAL PRIMARY KEY,
    trip_id       BIGINT       NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    position      SMALLINT     NOT NULL,
    heading       VARCHAR(60),
    body          VARCHAR(500) NOT NULL,
    photo_caption VARCHAR(120),
    CONSTRAINT trip_sections_position_uq UNIQUE (trip_id, position)
);

CREATE TABLE trip_moments (
    trip_id  BIGINT       NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    position INTEGER      NOT NULL,
    text     VARCHAR(120) NOT NULL,
    PRIMARY KEY (trip_id, position)
);
