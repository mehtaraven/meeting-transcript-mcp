-- ============================================================
-- Migration: 001_api_keys
-- Description: Creates the api_keys table for API key auth.
--
-- How to apply:
--   1. Open your Supabase project dashboard at
--      https://supabase.com/dashboard/project/<your-project-id>
--   2. Go to the SQL Editor.
--   3. Paste this entire file and click "Run".
--   4. Verify the api_keys table appears under Table Editor.
-- ============================================================

-- Ensure uuid-ossp is available (already enabled by schema.sql, but safe to repeat)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE api_keys (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash     TEXT         NOT NULL UNIQUE,
  key_prefix   VARCHAR(8)   NOT NULL,
  name         VARCHAR(100) NOT NULL DEFAULT 'My API Key',
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_api_keys_user_id  ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own API keys"
  ON api_keys
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
