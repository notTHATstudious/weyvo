-- When the username was last changed; another change is allowed 90 days later. Null means never changed.
ALTER TABLE users ADD COLUMN username_changed_at TIMESTAMPTZ;
