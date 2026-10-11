/*
# Enable VibeBlox owner administration

1. New tables
- `profiles`: signed-in player usernames used for account lookup and authorization.
- `admins`: usernames granted admin-panel access.
- `announcements`: messages admins can publish to players.
- `bans`: globally banned usernames managed by admins.

2. Security
- Enables row-level security on every new table.
- Profiles are publicly readable, while profile creation and last-seen updates are limited to the signed-in account.
- Admin membership is hidden from browser roles.
- Admin writes to announcements and bans require `is_admin()`.
- The owner account is `Master_at_Pvp`; it is always an admin and cannot be banned.

3. Compatibility
- Creates only missing tables and functions.
- Seeds `Master_at_Pvp` without deleting player data.
- Safe to re-run.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL CHECK (username ~ '^[A-Za-z0-9_]{3,16}$'),
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (lower(username));
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles are public" ON public.profiles;
CREATE POLICY "profiles are public" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "make your own profile" ON public.profiles;
CREATE POLICY "make your own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "update your own profile" ON public.profiles;
CREATE POLICY "update your own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (last_seen) ON public.profiles TO authenticated;

CREATE TABLE IF NOT EXISTS public.admins (username text PRIMARY KEY);
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admins FROM anon, authenticated;
INSERT INTO public.admins (username) VALUES ('Master_at_Pvp') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    LEFT JOIN public.admins a ON lower(a.username) = lower(p.username)
    WHERE p.id = auth.uid() AND (a.username IS NOT NULL OR lower(p.username) = 'master_at_pvp')
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_owner() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(p.username) = 'master_at_pvp'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_owner() TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.announcements (
  id bigserial PRIMARY KEY,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 300),
  author text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "everyone reads announcements" ON public.announcements;
CREATE POLICY "everyone reads announcements" ON public.announcements FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admins announce" ON public.announcements;
CREATE POLICY "admins announce" ON public.announcements FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admins delete announcements" ON public.announcements;
CREATE POLICY "admins delete announcements" ON public.announcements FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.bans (
  username text PRIMARY KEY CHECK (username = lower(username)),
  reason text NOT NULL DEFAULT '',
  banned_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bans are public" ON public.bans;
CREATE POLICY "bans are public" ON public.bans FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admins ban" ON public.bans;
CREATE POLICY "admins ban" ON public.bans FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admins change bans" ON public.bans;
CREATE POLICY "admins change bans" ON public.bans FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admins unban" ON public.bans;
CREATE POLICY "admins unban" ON public.bans FOR DELETE TO authenticated USING (public.is_admin());
ALTER TABLE public.bans DROP CONSTRAINT IF EXISTS bans_not_owner;
ALTER TABLE public.bans ADD CONSTRAINT bans_not_owner CHECK (username <> 'master_at_pvp');

NOTIFY pgrst, 'reload schema';