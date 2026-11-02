-- Wey points are worked out from activity and published stories, so removed or deleted stories lose their points
-- on their own. Only spending is recorded: the points put towards a Premium order.
ALTER TABLE payments ADD COLUMN points_used INTEGER NOT NULL DEFAULT 0;
CREATE INDEX trips_owner_published_idx ON trips (owner_id, published_at) WHERE status = 'PUBLISHED';
