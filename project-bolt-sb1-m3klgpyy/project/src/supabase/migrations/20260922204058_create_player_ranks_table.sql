/*
# Create player_ranks table for VibeBlox premium store

1. New Tables
- `player_ranks`
  - `id` (uuid, primary key)
  - `username` (text, unique, not null) — the player's VibeBlox username
  - `rank` (text, not null, default 'free') — one of 'free', 'vanguard', 'elite', 'champion'
  - `updated_at` (timestamptz, default now())
2. Security
- Enable RLS on `player_ranks`.
- Allow anon + authenticated to SELECT rows (the dashboard reads rank by username without a full auth login).
- INSERT/UPDATE restricted to authenticated only (the Tebex webhook edge function runs as an authenticated service-role caller, but we keep it scoped to authenticated for principle of least privilege).
- DELETE restricted to authenticated only.
3. Important Notes
- The TEBEX_SECRET_KEY is stored as an edge function secret, not in the database.
- The edge function verifies the webhook signature using HMAC-SHA256 before updating rank.
- `rank` defaults to 'free' so every new player starts without a premium tier.
*/

CREATE TABLE IF NOT EXISTS player_ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  rank text NOT NULL DEFAULT 'free',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE player_ranks ENABLE ROW LEVEL SECURITY;

-- Allow anyone (anon + authenticated) to read ranks — the dashboard reads by username
DROP POLICY IF EXISTS "anon_select_player_ranks" ON player_ranks;
CREATE POLICY "anon_select_player_ranks"
ON player_ranks FOR SELECT
TO anon, authenticated USING (true);

-- Only authenticated users can insert (edge function with service role)
DROP POLICY IF EXISTS "auth_insert_player_ranks" ON player_ranks;
CREATE POLICY "auth_insert_player_ranks"
ON player_ranks FOR INSERT
TO authenticated WITH CHECK (true);

-- Only authenticated users can update ranks (edge function)
DROP POLICY IF EXISTS "auth_update_player_ranks" ON player_ranks;
CREATE POLICY "auth_update_player_ranks"
ON player_ranks FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

-- Only authenticated users can delete
DROP POLICY IF EXISTS "auth_delete_player_ranks" ON player_ranks;
CREATE POLICY "auth_delete_player_ranks"
ON player_ranks FOR DELETE
TO authenticated USING (true);
