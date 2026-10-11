/*
# Revert VibeBlox owner back to Master

1. Data changes
- Updates the `admins` table: replaces `Master_at_Pvp` with `Master`.
- No player profiles, friendships, messages, or other user data are affected.

2. Authorization changes
- `is_admin()` and `is_owner()` now recognize `Master` (case-insensitive) as the owner.
- The ban-protection constraint now prevents banning `master` instead of `master_at_pvp`.

3. Compatibility
- Idempotent and safe to re-run.
*/

DELETE FROM public.admins WHERE lower(username) = 'master_at_pvp';
INSERT INTO public.admins (username) VALUES ('Master') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    LEFT JOIN public.admins a ON lower(a.username) = lower(p.username)
    WHERE p.id = auth.uid() AND (a.username IS NOT NULL OR lower(p.username) = 'master')
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_owner() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(p.username) = 'master'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_owner() TO anon, authenticated;

ALTER TABLE public.bans DROP CONSTRAINT IF EXISTS bans_not_owner;
ALTER TABLE public.bans ADD CONSTRAINT bans_not_owner CHECK (username <> 'master');

NOTIFY pgrst, 'reload schema';