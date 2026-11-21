-- Places inside a full issue (Goa: Candolim, Panjim, Baga), each a small story of its own: a note and 1-3 photos.
-- Stop photos use role STOP with position = stop * 3 + photo (0-2).
CREATE TABLE trip_stops (
    trip_id  BIGINT       NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    position INTEGER      NOT NULL,
    place    VARCHAR(120) NOT NULL,
    note     VARCHAR(300),
    PRIMARY KEY (trip_id, position)
);
ALTER TABLE trip_photos DROP CONSTRAINT trip_photos_role_chk;
ALTER TABLE trip_photos ADD CONSTRAINT trip_photos_role_chk CHECK (role IN ('COVER', 'SECTION', 'STOP'));
