-- Profile pictures. The version goes into the picture's URL, so a new upload is never shown stale from cache.
ALTER TABLE users
    ADD COLUMN avatar_key     VARCHAR(200),
    ADD COLUMN avatar_version INTEGER;
