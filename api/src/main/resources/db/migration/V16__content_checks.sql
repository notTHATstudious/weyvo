-- Posts the word filter flagged wait here for an admin. A held story is hidden like a removed one (its author
-- still sees it); a held comment or question is hidden like a reported one. Clearing held_reason ends the check.
ALTER TABLE trips ADD COLUMN held_reason VARCHAR(16);
ALTER TABLE trip_comments ADD COLUMN held_reason VARCHAR(16);
ALTER TABLE trip_questions ADD COLUMN held_reason VARCHAR(16);
CREATE INDEX trips_held_idx ON trips (id) WHERE held_reason IS NOT NULL;
CREATE INDEX trip_comments_held_idx ON trip_comments (id) WHERE held_reason IS NOT NULL;
CREATE INDEX trip_questions_held_idx ON trip_questions (id) WHERE held_reason IS NOT NULL;

-- Each post an admin takes down is a strike; three suspend the account.
ALTER TABLE users ADD COLUMN strikes INTEGER NOT NULL DEFAULT 0;
