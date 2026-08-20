-- Run in Supabase SQL Editor.
-- Past Sessions board: wipe existing rows (no backfill) and add title/blurb.

DELETE FROM claims;
DELETE FROM sessions;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS blurb TEXT;
