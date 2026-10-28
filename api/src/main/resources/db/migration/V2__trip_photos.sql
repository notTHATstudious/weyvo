-- Processed photos. Bytes live in object storage under server-generated keys; this row owns them.
CREATE TABLE trip_photos (
    id         BIGSERIAL PRIMARY KEY,
    trip_id    BIGINT       NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    role       VARCHAR(8)   NOT NULL,
    position   INTEGER      NOT NULL DEFAULT 0,
    large_key  VARCHAR(200) NOT NULL,
    thumb_key  VARCHAR(200) NOT NULL,
    width      INTEGER      NOT NULL,
    height     INTEGER      NOT NULL,
    size_bytes INTEGER      NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT trip_photos_role_chk CHECK (role IN ('COVER', 'SECTION')),
    CONSTRAINT trip_photos_slot_uq UNIQUE (trip_id, role, position)
);
