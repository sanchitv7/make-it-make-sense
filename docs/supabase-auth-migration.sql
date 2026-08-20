-- Run in Supabase SQL Editor after enabling Email auth (Confirm email OFF for v1).
-- Adds Account ownership onto listening Sessions.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

-- Deny anon/authenticated direct table access; service role bypasses RLS.
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
-- no policies: anon/authenticated denied; service role bypasses
