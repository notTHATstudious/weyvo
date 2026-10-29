-- "Been there" / "Want to go" on a destination itself, so places can be on your map without a story.
-- BEEN is public like story pins; WANT stays private, like Want to go on stories.
CREATE TABLE place_reactions (
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    place_id   BIGINT      NOT NULL REFERENCES places (id) ON DELETE CASCADE,
    type       VARCHAR(8)  NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, place_id, type),
    CONSTRAINT place_reactions_type_chk CHECK (type IN ('BEEN', 'WANT'))
);
CREATE INDEX place_reactions_place_idx ON place_reactions (place_id, type);
