-- Places resolved from the free-text "place" on trips, via OpenStreetMap's Nominatim.
-- Each distinct place text is looked up once; misses are remembered too so they aren't retried endlessly.
CREATE TABLE places (
    id         BIGSERIAL PRIMARY KEY,
    query_key  VARCHAR(160)     NOT NULL UNIQUE,
    found      BOOLEAN          NOT NULL,
    slug       VARCHAR(140) UNIQUE,
    name       VARCHAR(120),
    country    VARCHAR(80),
    lat        DOUBLE PRECISION,
    lng        DOUBLE PRECISION,
    created_at TIMESTAMPTZ      NOT NULL DEFAULT now()
);

ALTER TABLE trips
    ADD COLUMN place_id      BIGINT REFERENCES places (id) ON DELETE SET NULL,
    -- The place text that place_id was resolved from; when the text changes, the trip is resolved again.
    ADD COLUMN geocoded_text VARCHAR(120);
CREATE INDEX trips_place_idx ON trips (place_id) WHERE place_id IS NOT NULL;
CREATE INDEX trips_geocode_pending_idx ON trips (id) WHERE geocoded_text IS NULL;
