-- Drops the 7-day grace for older short stories: each now expires 7 days after it was actually posted,
-- so those already past that are deleted by the next ShortStoryExpiry run.
UPDATE trips SET expires_at = published_at + interval '7 days'
WHERE kind = 'SHORT' AND status = 'PUBLISHED' AND published_at IS NOT NULL;
