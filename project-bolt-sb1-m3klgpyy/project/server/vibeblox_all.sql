-- ======================================================================================================
-- VibeBlox: EVERYTHING in one file (accounts, friends, messages, announcements, admins, bans, ranks,
-- hosted worlds, anti-cheat, levels, loyalty gifts, offline ranks, server tags, world likes, staff ranks, account deletion, player profiles, sleeping worlds, OG and YOUTUBE ranks, admin access levels, /undercover). Indev 32.
--
-- Run it once in Supabase: Dashboard -> SQL Editor -> New query -> paste ALL of it -> Run.
-- It is safe to run again and again (every part is "if not exists" / "or replace"), and it can be run on a
-- brand new project or on top of the old files (supabase_social.sql, vibeblox_round13/16/17/18/19.sql).
-- You do not need the other .sql files any more.
--
-- Order inside this file: accounts and social -> round 13 (owner, hosted worlds) -> round 16 (admins,
-- anti-cheat, levels) -> round 17 (temporary ranks) -> round 18 (loyalty rank gifts) -> round 19 (offline ranks)
-- -> round 20 (server tags and world likes) -> round 21 (OG rank and staff ranks) -> indev 27-30 -> indev 32 (admin access levels, /undercover).
-- ======================================================================================================


-- ######################################################################################
-- PART: supabase_social.sql
-- ######################################################################################

-- VibeBlox: accounts, friends, private messages, announcements, admins and global bans.
-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- It is safe to run again (everything is "if not exists" / "or replace").

-- ============ Profiles (one per account; the username is what players see) ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);
-- If the table already existed from an earlier version, bring it up to date
alter table public.profiles add column if not exists last_seen timestamptz not null default now();
-- Very old copies of this table have no join date. Add it, and give the accounts that already exist an early date
-- (the real day is not known), so later parts (OG, loyalty rewards, profile cards) can rely on it.
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'created_at') then
    alter table public.profiles add column created_at timestamptz;
    update public.profiles set created_at = timestamptz '2026-10-01 00:00:00+00';
    alter table public.profiles alter column created_at set default now();
    alter table public.profiles alter column created_at set not null;
  end if;
end $$;
alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_key on public.profiles (lower(username));

alter table public.profiles add column if not exists username_changed_at timestamptz;
alter table public.profiles add column if not exists rank text not null default 'none';
alter table public.profiles drop constraint if exists profiles_rank_check;
alter table public.profiles add constraint profiles_rank_check check (rank in ('none', 'vanguard', 'elite', 'champion'));

-- ============ The owner ============
-- The owner's username is Master. Nobody else can ever take that name: it is only given to the account whose
-- email is in this table. Put YOUR sign-up email in it (once), e.g.:
--   insert into public.owner_emails (email) values ('you@example.com') on conflict do nothing;
create table if not exists public.owner_emails (email text primary key);
alter table public.owner_emails enable row level security;
revoke all on public.owner_emails from anon, authenticated;

-- Names nobody but the owner may use
create or replace function public.name_ok(p_name text, p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select lower(p_name) <> 'master'
      or exists (select 1 from public.owner_emails o where lower(o.email) = lower(coalesce(p_email, '')));
$$;
create or replace function public.name_allowed(p_user uuid, p_name text) returns boolean
language sql stable security definer set search_path = public, auth as $$
  select public.name_ok(p_name, (select u.email from auth.users u where u.id = p_user));
$$;

-- Has the signed-in account verified its email? (Google sign-in counts as verified.)
create or replace function public.is_confirmed() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null);
$$;
grant execute on function public.is_confirmed() to anon, authenticated;

-- Makes the profile for a verified account (username from the sign-up form, or the start of their email)
create or replace function public.ensure_profile(p_id uuid, p_email text, p_wanted text) returns void
language plpgsql security definer set search_path = public as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  if exists (select 1 from public.profiles where id = p_id) then return; end if;
  base := regexp_replace(coalesce(nullif(p_wanted, ''), split_part(p_email, '@', 1), 'Player'), '[^A-Za-z0-9_]', '', 'g');
  base := left(base, 16);
  if length(base) < 3 then base := 'Player'; end if;
  if not public.name_ok(base, p_email) then base := 'Player'; end if;
  candidate := base;
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    n := n + 1;
    candidate := left(base, 12) || (floor(random() * 9000) + 1000)::int::text;
    exit when n > 20;
  end loop;
  insert into public.profiles (id, username) values (p_id, candidate) on conflict do nothing;
end $$;

-- A username is only held by an account that VERIFIED its email. Signing up with an unverified email does not
-- reserve anything, so nobody can squat a name (the first to verify gets it).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null then
    perform public.ensure_profile(new.id, new.email, new.raw_user_meta_data->>'username');
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null) execute function public.handle_new_user();

-- Names held by accounts that never verified their email are given back
delete from public.profiles p using auth.users u where u.id = p.id and u.email_confirmed_at is null;

-- Verified accounts that signed up before this script existed
insert into public.profiles (id, username)
select u.id,
       case when length(regexp_replace(split_part(u.email, '@', 1), '[^A-Za-z0-9_]', '', 'g')) >= 3
            then left(regexp_replace(split_part(u.email, '@', 1), '[^A-Za-z0-9_]', '', 'g'), 12) || (floor(random() * 9000) + 1000)::int::text
            else 'Player' || (floor(random() * 9000) + 1000)::int::text end
from auth.users u
where u.email_confirmed_at is not null and not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

alter table public.profiles enable row level security;
drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select using (true);
drop policy if exists "make your own profile" on public.profiles;
create policy "make your own profile" on public.profiles for insert to authenticated
  with check (id = auth.uid() and public.is_confirmed() and public.name_allowed(auth.uid(), username) and rank = 'none');
drop policy if exists "update your own profile" on public.profiles;
create policy "update your own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- Players may only touch last_seen. Usernames change through change_username() (once a week); ranks are only set by the owner/store.
revoke update on public.profiles from authenticated, anon;
grant update (last_seen) on public.profiles to authenticated;

-- ============ Admins (by username) ============
-- Put the usernames that may use /panel here. Nobody can read or write this table from the game.
create table if not exists public.admins (username text primary key);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- The account named "Master" is the owner: it is always an admin (see is_admin below), and can't be banned.
-- To add more admins, put their VibeBlox usernames here, e.g.:
-- insert into public.admins (username) values ('SomeName') on conflict do nothing;
delete from public.admins where lower(username) = 'master';  -- the owner used to be called Master
insert into public.admins (username) values ('Master') on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    left join public.admins a on lower(a.username) = lower(p.username)
    where p.id = auth.uid() and (a.username is not null or lower(p.username) = 'master')
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- Is the signed-in account the owner ("Master")?
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.username) = 'master');
$$;
grant execute on function public.is_owner() to anon, authenticated;

-- ============ Friends ============
create table if not exists public.friendships (
  id bigserial primary key,
  requester uuid not null references public.profiles(id) on delete cascade,
  addressee uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
-- one row per pair, whichever way round the request went
create unique index if not exists friendships_pair_key on public.friendships (least(requester, addressee), greatest(requester, addressee));

alter table public.friendships enable row level security;
drop policy if exists "see your friendships" on public.friendships;
create policy "see your friendships" on public.friendships for select to authenticated using (auth.uid() in (requester, addressee));
drop policy if exists "send a request" on public.friendships;
create policy "send a request" on public.friendships for insert to authenticated with check (requester = auth.uid() and status = 'pending');
drop policy if exists "accept a request" on public.friendships;
create policy "accept a request" on public.friendships for update to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid());
drop policy if exists "remove a friendship" on public.friendships;
create policy "remove a friendship" on public.friendships for delete to authenticated using (auth.uid() in (requester, addressee));
revoke update on public.friendships from authenticated;
grant update (status) on public.friendships to authenticated;

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted' and ((requester = a and addressee = b) or (requester = b and addressee = a))
  );
$$;

-- ============ Private messages ============
create table if not exists public.direct_messages (
  id bigserial primary key,
  sender uuid not null references public.profiles(id) on delete cascade,
  recipient uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists direct_messages_recipient_idx on public.direct_messages (recipient, id);
create index if not exists direct_messages_pair_idx on public.direct_messages (sender, recipient, id);

alter table public.direct_messages enable row level security;
drop policy if exists "read your messages" on public.direct_messages;
create policy "read your messages" on public.direct_messages for select to authenticated using (auth.uid() in (sender, recipient));
drop policy if exists "message a friend" on public.direct_messages;
create policy "message a friend" on public.direct_messages for insert to authenticated
  with check (sender = auth.uid() and public.are_friends(sender, recipient));
-- nobody edits or deletes messages from the game

-- ============ Announcements (/panel -> every server) ============
create table if not exists public.announcements (
  id bigserial primary key,
  body text not null check (char_length(body) between 1 and 300),
  author text not null,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
drop policy if exists "everyone reads announcements" on public.announcements;
create policy "everyone reads announcements" on public.announcements for select using (true);
drop policy if exists "admins announce" on public.announcements;
create policy "admins announce" on public.announcements for insert to authenticated with check (public.is_admin());
drop policy if exists "admins delete announcements" on public.announcements;
create policy "admins delete announcements" on public.announcements for delete to authenticated using (public.is_admin());

-- ============ Global bans ============
-- Servers look a name up here when someone joins. The names are public; only admins can change the list.
create table if not exists public.bans (
  username text primary key check (username = lower(username)),
  reason text not null default '',
  banned_by text not null default '',
  created_at timestamptz not null default now()
);
alter table public.bans enable row level security;
drop policy if exists "bans are public" on public.bans;
create policy "bans are public" on public.bans for select using (true);
drop policy if exists "admins ban" on public.bans;
create policy "admins ban" on public.bans for insert to authenticated with check (public.is_admin());
drop policy if exists "admins change bans" on public.bans;
create policy "admins change bans" on public.bans for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins unban" on public.bans;
create policy "admins unban" on public.bans for delete to authenticated using (public.is_admin());
-- nobody can ban the owner
alter table public.bans drop constraint if exists bans_not_owner;
alter table public.bans add constraint bans_not_owner check (username <> 'master');

-- ============ Who is playing what (the "N playing" on the home screen) ============
-- Each open game sends a heartbeat every 30 seconds with what it's playing (guests too, with a random
-- id that isn't linked to anyone). Nobody can read or write the table directly: only these two functions.
create table if not exists public.presence (
  session uuid primary key,
  activity text not null,
  last_seen timestamptz not null default now()
);
alter table public.presence enable row level security;
revoke all on public.presence from anon, authenticated;

create or replace function public.heartbeat(p_session uuid, p_activity text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_activity is null or p_activity = 'none' then
    delete from public.presence where session = p_session;
    return;
  end if;
  if p_activity not in ('survival', 'creative', 'superflat', 'oneblock', 'eggwars', 'bridge', 'other') then
    raise exception 'unknown activity';
  end if;
  insert into public.presence (session, activity, last_seen) values (p_session, p_activity, now())
  on conflict (session) do update set activity = excluded.activity, last_seen = now();
  delete from public.presence where last_seen < now() - interval '10 minutes';
end;
$$;
grant execute on function public.heartbeat(uuid, text) to anon, authenticated;

drop function if exists public.playing_counts();
create or replace function public.playing_counts() returns table (activity text, players bigint)
language sql stable security definer set search_path = public as $$
  select activity, count(*) from public.presence where last_seen > now() - interval '90 seconds' group by activity;
$$;
grant execute on function public.playing_counts() to anon, authenticated;

-- ============ Changing your username (once a week) ============
create or replace function public.change_username(p_new text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  cur public.profiles;
  wait interval := interval '7 days';
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'Sign in first'); end if;
  if not public.is_confirmed() then return jsonb_build_object('ok', false, 'error', 'Verify your email first'); end if;
  if p_new is null or p_new !~ '^[A-Za-z0-9_]{3,16}$' then
    return jsonb_build_object('ok', false, 'error', 'Usernames are 3-16 letters, numbers or underscores');
  end if;
  select * into cur from public.profiles where id = me;
  if not found then return jsonb_build_object('ok', false, 'error', 'No profile yet'); end if;
  if cur.username = p_new then return jsonb_build_object('ok', false, 'error', 'That is already your name'); end if;
  if exists (select 1 from public.bans b where b.username = lower(cur.username)) then
    return jsonb_build_object('ok', false, 'error', 'Banned accounts can not change their name');
  end if;
  if not public.name_allowed(me, p_new) then return jsonb_build_object('ok', false, 'error', 'That name is reserved'); end if;
  if cur.username_changed_at is not null and cur.username_changed_at > now() - wait then
    return jsonb_build_object('ok', false, 'error', 'You can change your name once a week', 'next', cur.username_changed_at + wait);
  end if;
  if exists (select 1 from public.profiles p where lower(p.username) = lower(p_new) and p.id <> me) then
    return jsonb_build_object('ok', false, 'error', 'That username is taken');
  end if;
  update public.profiles set username = p_new, username_changed_at = now() where id = me;
  return jsonb_build_object('ok', true, 'username', p_new, 'next', now() + wait);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'That username is taken');
end $$;
grant execute on function public.change_username(text) to authenticated;

-- ============ Ranks (set by the owner, or later by the store's webhook; never by the player) ============
create or replace function public.set_rank(p_username text, p_rank text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'owner only'; end if;
  if p_rank not in ('none', 'vanguard', 'elite', 'champion') then raise exception 'unknown rank'; end if;
  update public.profiles set rank = p_rank where lower(username) = lower(p_username);
end $$;
grant execute on function public.set_rank(text, text) to authenticated;

-- ============ Plays, the leaderboard and Rising Creator ============
-- A "play" is another verified player joining a game you host. One per player per day per host, never your own.
-- 1000 plays make you a Rising Creator (bigger script budget, 24 players instead of 18 in your world).
create table if not exists public.plays (
  id bigserial primary key,
  host uuid not null references public.profiles(id) on delete cascade,
  player uuid not null references public.profiles(id) on delete cascade,
  day date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now(),
  check (host <> player),
  unique (host, player, day)
);
create index if not exists plays_host_idx on public.plays (host);
alter table public.plays enable row level security;
revoke all on public.plays from anon, authenticated;

create or replace function public.record_play(p_host text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  h uuid;
  n int;
begin
  if me is null or not public.is_confirmed() then return false; end if;
  select id into h from public.profiles where lower(username) = lower(p_host);
  if h is null or h = me then return false; end if;
  insert into public.plays (host, player) values (h, me) on conflict do nothing;
  get diagnostics n = row_count;
  return n > 0;
exception when others then
  return false;
end $$;
grant execute on function public.record_play(text) to authenticated;

drop function if exists public.leaderboard(int); -- (later versions add columns, so a re-run has to start fresh)
drop function if exists public.leaderboard(int);
create or replace function public.leaderboard(p_limit int default 50) returns table (username text, plays bigint, rank text)
language sql stable security definer set search_path = public as $$
  select p.username, count(*)::bigint as plays, p.rank
  from public.plays pl join public.profiles p on p.id = pl.host
  group by p.id, p.username, p.rank
  order by count(*) desc, p.username
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;
grant execute on function public.leaderboard(int) to anon, authenticated;

-- One player's plays and rank (servers use this to size the world; the game uses it for Rising Creator)
drop function if exists public.player_standing(text);
create or replace function public.player_standing(p_username text) returns table (plays bigint, rank text, rising boolean)
language sql stable security definer set search_path = public as $$
  select coalesce((select count(*) from public.plays pl where pl.host = p.id), 0)::bigint,
         case when lower(p.username) = 'master' then 'champion' else p.rank end,
         coalesce((select count(*) from public.plays pl where pl.host = p.id), 0) >= 1000
  from public.profiles p where lower(p.username) = lower(p_username);
$$;
grant execute on function public.player_standing(text) to anon, authenticated;

-- ============ Joining friends ============
-- While you are on a multiplayer server, the game says which one. Only you and your friends can read it.
create table if not exists public.friend_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  server text not null check (char_length(server) between 3 and 200),
  updated_at timestamptz not null default now()
);
alter table public.friend_presence enable row level security;
revoke all on public.friend_presence from anon, authenticated;
grant select on public.friend_presence to authenticated;
drop policy if exists "friends see where you play" on public.friend_presence;
create policy "friends see where you play" on public.friend_presence for select to authenticated
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));

create or replace function public.set_presence(p_server text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then return; end if;
  if p_server is null or btrim(p_server) = '' then
    delete from public.friend_presence where user_id = me;
    return;
  end if;
  if p_server !~ '^(wss?://)?[A-Za-z0-9.-]+(:[0-9]{1,5})?(/[A-Za-z0-9._~/-]*)?$' or char_length(p_server) > 200 then return; end if;
  insert into public.friend_presence (user_id, server) values (me, p_server)
  on conflict (user_id) do update set server = excluded.server, updated_at = now();
exception when others then
  return;
end $$;
grant execute on function public.set_presence(text) to authenticated;

-- Let the API see the new tables right away
notify pgrst, 'reload schema';


-- ============ Round 13 (v21): see vibeblox_round13.sql (the same statements, kept here so a fresh setup has everything) ============
-- VibeBlox Round 13 (v21): run this once in Supabase -> SQL Editor -> New query -> paste -> Run.
-- Safe to run again. It does three things:
--   1. Makes the account named "Master" the owner and an admin (the Admin panel, announcements, giving ranks).
--      The name "Master" is reserved: only the email listed in owner_emails can take it.
--   2. Lets the owner give ranks from the Admin Panel (give_rank).
--   3. Adds the list of worlds players are hosting (Servers tab) and lets friends join them.

-- ============ 1. The owner is Master ============
create table if not exists public.owner_emails (email text primary key);
alter table public.owner_emails enable row level security;
revoke all on public.owner_emails from anon, authenticated;
-- Nobody else may take the name "Master" (put your own sign-up email in owner_emails if you ever need to re-create it)
create or replace function public.name_ok(p_name text, p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select lower(p_name) <> 'master'
      or exists (select 1 from public.owner_emails o where lower(o.email) = lower(coalesce(p_email, '')));
$$;
create table if not exists public.admins (username text primary key);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
delete from public.admins where lower(username) = 'master_at_pvp';
-- If your owner account is still called Master_at_Pvp, it becomes Master (unless someone already has that name)
update public.profiles set username = 'Master'
  where lower(username) = 'master_at_pvp' and not exists (select 1 from public.profiles where lower(username) = 'master');
insert into public.admins (username) values ('Master') on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    left join public.admins a on lower(a.username) = lower(p.username)
    where p.id = auth.uid() and (a.username is not null or lower(p.username) = 'master')
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.username) = 'master');
$$;
grant execute on function public.is_owner() to anon, authenticated;

do $$ begin
  if to_regclass('public.bans') is not null then
    alter table public.bans drop constraint if exists bans_not_owner;
    delete from public.bans where username = 'master';
    alter table public.bans add constraint bans_not_owner check (username <> 'master');
  end if;
end $$;

-- ============ 2. Ranks ============
alter table public.profiles add column if not exists rank text not null default 'none';
alter table public.profiles drop constraint if exists profiles_rank_check;
alter table public.profiles add constraint profiles_rank_check check (rank in ('none', 'vanguard', 'elite', 'champion'));

-- The owner gives (or takes away) a rank. Returns the player's name as stored, or null if nobody has that name.
create or replace function public.give_rank(p_username text, p_rank text) returns text
language plpgsql security definer set search_path = public as $$
declare found_name text;
begin
  if not public.is_owner() then raise exception 'owner only'; end if;
  if p_rank not in ('none', 'vanguard', 'elite', 'champion') then raise exception 'unknown rank'; end if;
  update public.profiles set rank = p_rank where lower(username) = lower(p_username) returning username into found_name;
  return found_name;
end $$;
revoke all on function public.give_rank(text, text) from anon;
grant execute on function public.give_rank(text, text) to authenticated;

-- The older set_rank keeps working too
create or replace function public.set_rank(p_username text, p_rank text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.give_rank(p_username, p_rank);
end $$;
grant execute on function public.set_rank(text, text) to authenticated;

-- ============ 3. Hosted worlds ============
create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted' and ((requester = a and addressee = b) or (requester = b and addressee = a))
  );
$$;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- A world someone is playing right now that others may join. The host's game keeps its row fresh every 20 seconds
-- and deletes it when they leave; rows older than 90 seconds are ignored (and cleaned up).
-- Who sees a row: public = everyone, accounts = anyone signed in, friends = the host's friends. Private worlds are never listed.
create table if not exists public.hosted_worlds (
  id text primary key check (id ~ '^[a-z0-9]{8,32}$'),
  host_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  host_name text not null,
  name text not null check (char_length(name) between 1 and 40),
  mode text not null default 'survival' check (mode in ('survival', 'creative', 'adventure')),
  world_type text not null default 'default' check (world_type in ('default', 'superflat')),
  privacy text not null default 'public' check (privacy in ('public', 'accounts', 'friends')),
  players int not null default 1 check (players between 0 and 100),
  max_players int not null default 18 check (max_players between 1 and 100),
  updated_at timestamptz not null default now()
);
create index if not exists hosted_worlds_fresh on public.hosted_worlds (updated_at desc);
alter table public.hosted_worlds enable row level security;
revoke all on public.hosted_worlds from anon, authenticated;
grant select on public.hosted_worlds to anon, authenticated;
grant insert, update, delete on public.hosted_worlds to authenticated;

drop policy if exists "see joinable worlds" on public.hosted_worlds;
create policy "see joinable worlds" on public.hosted_worlds for select to anon, authenticated using (
  privacy = 'public'
  or (privacy = 'accounts' and auth.uid() is not null)
  or host_id = auth.uid()
  or (privacy = 'friends' and auth.uid() is not null and public.are_friends(auth.uid(), host_id))
);
drop policy if exists "host lists their world" on public.hosted_worlds;
create policy "host lists their world" on public.hosted_worlds for insert to authenticated with check (
  host_id = auth.uid()
  and lower(host_name) = lower((select username from public.profiles where id = auth.uid()))
);
drop policy if exists "host updates their world" on public.hosted_worlds;
create policy "host updates their world" on public.hosted_worlds for update to authenticated
  using (host_id = auth.uid()) with check (host_id = auth.uid());
drop policy if exists "host removes their world" on public.hosted_worlds;
create policy "host removes their world" on public.hosted_worlds for delete to authenticated using (host_id = auth.uid());

-- Old rows (a host whose tab crashed) are cleaned up whenever someone lists worlds
create or replace function public.prune_hosted_worlds() returns void
language sql security definer set search_path = public as $$
  delete from public.hosted_worlds where updated_at < now() - interval '3 minutes';
$$;
grant execute on function public.prune_hosted_worlds() to anon, authenticated;

-- Friends see which world you are in: presence now also takes "p2p:<world id>"
do $$ begin
  if to_regclass('public.friend_presence') is null then
    create table public.friend_presence (
      user_id uuid primary key references public.profiles(id) on delete cascade,
      server text not null check (char_length(server) between 3 and 200),
      updated_at timestamptz not null default now()
    );
    alter table public.friend_presence enable row level security;
    revoke all on public.friend_presence from anon, authenticated;
    grant select on public.friend_presence to authenticated;
    create policy "friends see where you play" on public.friend_presence for select to authenticated
      using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));
  end if;
end $$;

create or replace function public.set_presence(p_server text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then return; end if;
  if p_server is null or btrim(p_server) = '' then
    delete from public.friend_presence where user_id = me;
    return;
  end if;
  if char_length(p_server) > 200 then return; end if;
  if p_server !~ '^p2p:[a-z0-9]{8,32}$' and p_server !~ '^(wss?://)?[A-Za-z0-9.-]+(:[0-9]{1,5})?(/[A-Za-z0-9._~/-]*)?$' then return; end if;
  insert into public.friend_presence (user_id, server) values (me, p_server)
  on conflict (user_id) do update set server = excluded.server, updated_at = now();
exception when others then
  return;
end $$;
grant execute on function public.set_presence(text) to authenticated;

notify pgrst, 'reload schema';

-- ######################################################################################
-- PART: vibeblox_round13.sql
-- ######################################################################################

-- VibeBlox Round 13 (v21): run this once in Supabase -> SQL Editor -> New query -> paste -> Run.
-- Safe to run again. It does three things:
--   1. Makes the account named "Master" the owner and an admin (the Admin panel, announcements, giving ranks).
--      The name "Master" is reserved: only the email listed in owner_emails can take it.
--   2. Lets the owner give ranks from the Admin Panel (give_rank).
--   3. Adds the list of worlds players are hosting (Servers tab) and lets friends join them.

-- ============ 1. The owner is Master ============
create table if not exists public.owner_emails (email text primary key);
alter table public.owner_emails enable row level security;
revoke all on public.owner_emails from anon, authenticated;
-- Nobody else may take the name "Master" (put your own sign-up email in owner_emails if you ever need to re-create it)
create or replace function public.name_ok(p_name text, p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select lower(p_name) <> 'master'
      or exists (select 1 from public.owner_emails o where lower(o.email) = lower(coalesce(p_email, '')));
$$;
create table if not exists public.admins (username text primary key);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
delete from public.admins where lower(username) = 'master_at_pvp';
-- If your owner account is still called Master_at_Pvp, it becomes Master (unless someone already has that name)
update public.profiles set username = 'Master'
  where lower(username) = 'master_at_pvp' and not exists (select 1 from public.profiles where lower(username) = 'master');
insert into public.admins (username) values ('Master') on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    left join public.admins a on lower(a.username) = lower(p.username)
    where p.id = auth.uid() and (a.username is not null or lower(p.username) = 'master')
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.username) = 'master');
$$;
grant execute on function public.is_owner() to anon, authenticated;

do $$ begin
  if to_regclass('public.bans') is not null then
    alter table public.bans drop constraint if exists bans_not_owner;
    delete from public.bans where username = 'master';
    alter table public.bans add constraint bans_not_owner check (username <> 'master');
  end if;
end $$;

-- ============ 2. Ranks ============
alter table public.profiles add column if not exists rank text not null default 'none';
alter table public.profiles drop constraint if exists profiles_rank_check;
alter table public.profiles add constraint profiles_rank_check check (rank in ('none', 'vanguard', 'elite', 'champion'));

-- The owner gives (or takes away) a rank. Returns the player's name as stored, or null if nobody has that name.
create or replace function public.give_rank(p_username text, p_rank text) returns text
language plpgsql security definer set search_path = public as $$
declare found_name text;
begin
  if not public.is_owner() then raise exception 'owner only'; end if;
  if p_rank not in ('none', 'vanguard', 'elite', 'champion') then raise exception 'unknown rank'; end if;
  update public.profiles set rank = p_rank where lower(username) = lower(p_username) returning username into found_name;
  return found_name;
end $$;
revoke all on function public.give_rank(text, text) from anon;
grant execute on function public.give_rank(text, text) to authenticated;

-- The older set_rank keeps working too
create or replace function public.set_rank(p_username text, p_rank text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.give_rank(p_username, p_rank);
end $$;
grant execute on function public.set_rank(text, text) to authenticated;

-- ============ 3. Hosted worlds ============
create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted' and ((requester = a and addressee = b) or (requester = b and addressee = a))
  );
$$;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- A world someone is playing right now that others may join. The host's game keeps its row fresh every 20 seconds
-- and deletes it when they leave; rows older than 90 seconds are ignored (and cleaned up).
-- Who sees a row: public = everyone, accounts = anyone signed in, friends = the host's friends. Private worlds are never listed.
create table if not exists public.hosted_worlds (
  id text primary key check (id ~ '^[a-z0-9]{8,32}$'),
  host_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  host_name text not null,
  name text not null check (char_length(name) between 1 and 40),
  mode text not null default 'survival' check (mode in ('survival', 'creative', 'adventure')),
  world_type text not null default 'default' check (world_type in ('default', 'superflat')),
  privacy text not null default 'public' check (privacy in ('public', 'accounts', 'friends')),
  players int not null default 1 check (players between 0 and 100),
  max_players int not null default 18 check (max_players between 1 and 100),
  updated_at timestamptz not null default now()
);
create index if not exists hosted_worlds_fresh on public.hosted_worlds (updated_at desc);
alter table public.hosted_worlds enable row level security;
revoke all on public.hosted_worlds from anon, authenticated;
grant select on public.hosted_worlds to anon, authenticated;
grant insert, update, delete on public.hosted_worlds to authenticated;

drop policy if exists "see joinable worlds" on public.hosted_worlds;
create policy "see joinable worlds" on public.hosted_worlds for select to anon, authenticated using (
  privacy = 'public'
  or (privacy = 'accounts' and auth.uid() is not null)
  or host_id = auth.uid()
  or (privacy = 'friends' and auth.uid() is not null and public.are_friends(auth.uid(), host_id))
);
drop policy if exists "host lists their world" on public.hosted_worlds;
create policy "host lists their world" on public.hosted_worlds for insert to authenticated with check (
  host_id = auth.uid()
  and lower(host_name) = lower((select username from public.profiles where id = auth.uid()))
);
drop policy if exists "host updates their world" on public.hosted_worlds;
create policy "host updates their world" on public.hosted_worlds for update to authenticated
  using (host_id = auth.uid()) with check (host_id = auth.uid());
drop policy if exists "host removes their world" on public.hosted_worlds;
create policy "host removes their world" on public.hosted_worlds for delete to authenticated using (host_id = auth.uid());

-- Old rows (a host whose tab crashed) are cleaned up whenever someone lists worlds
create or replace function public.prune_hosted_worlds() returns void
language sql security definer set search_path = public as $$
  delete from public.hosted_worlds where updated_at < now() - interval '3 minutes';
$$;
grant execute on function public.prune_hosted_worlds() to anon, authenticated;

-- Friends see which world you are in: presence now also takes "p2p:<world id>"
do $$ begin
  if to_regclass('public.friend_presence') is null then
    create table public.friend_presence (
      user_id uuid primary key references public.profiles(id) on delete cascade,
      server text not null check (char_length(server) between 3 and 200),
      updated_at timestamptz not null default now()
    );
    alter table public.friend_presence enable row level security;
    revoke all on public.friend_presence from anon, authenticated;
    grant select on public.friend_presence to authenticated;
    create policy "friends see where you play" on public.friend_presence for select to authenticated
      using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));
  end if;
end $$;

create or replace function public.set_presence(p_server text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then return; end if;
  if p_server is null or btrim(p_server) = '' then
    delete from public.friend_presence where user_id = me;
    return;
  end if;
  if char_length(p_server) > 200 then return; end if;
  if p_server !~ '^p2p:[a-z0-9]{8,32}$' and p_server !~ '^(wss?://)?[A-Za-z0-9.-]+(:[0-9]{1,5})?(/[A-Za-z0-9._~/-]*)?$' then return; end if;
  insert into public.friend_presence (user_id, server) values (me, p_server)
  on conflict (user_id) do update set server = excluded.server, updated_at = now();
exception when others then
  return;
end $$;
grant execute on function public.set_presence(text) to authenticated;

notify pgrst, 'reload schema';

-- ######################################################################################
-- PART: vibeblox_round16.sql
-- ######################################################################################

-- VibeBlox Round 16 (v24): run this once in Supabase -> SQL Editor -> New query -> paste -> Run.
-- Safe to run again. Run vibeblox_round13.sql first if you never did (this builds on it).
-- It adds:
--   1. Admins chosen from the Admin panel (the owner adds and removes them; no more SQL for that).
--   2. Anti-cheat reports: hosts' games report cheaters, admins see them in the Admin panel.
--   3. Your level saved to your account (it follows you to other devices) and a level leaderboard.
--   4. Pictures and descriptions for open worlds on the Servers page, and online EggWars / Bridge Duels worlds.

-- ============ 1. Admins ============
create table if not exists public.admins (username text primary key);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
insert into public.admins (username) values ('Master') on conflict do nothing;

-- Everyone who can open the Admin panel (admins only)
drop function if exists public.list_admins();
create or replace function public.list_admins() returns table (username text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  return query select a.username from public.admins a order by lower(a.username);
end $$;
revoke all on function public.list_admins() from anon;
grant execute on function public.list_admins() to authenticated;

-- The owner makes someone an admin (p_on = true) or takes it away. Returns the name as stored, or null if nobody has it.
create or replace function public.set_admin(p_username text, p_on boolean) returns text
language plpgsql security definer set search_path = public as $$
declare found_name text;
begin
  if not public.is_owner() then raise exception 'owner only'; end if;
  if lower(p_username) = 'master' then raise exception 'The owner is always an admin'; end if;
  select username into found_name from public.profiles where lower(username) = lower(p_username);
  if found_name is null then return null; end if;
  if p_on then
    insert into public.admins (username) values (found_name) on conflict do nothing;
  else
    delete from public.admins where lower(username) = lower(found_name);
  end if;
  return found_name;
end $$;
revoke all on function public.set_admin(text, boolean) from anon;
grant execute on function public.set_admin(text, boolean) to authenticated;

-- ============ 2. Anti-cheat reports ============
create table if not exists public.anticheat_reports (
  id bigserial primary key,
  world text not null default '' check (char_length(world) <= 40),
  host_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  host_name text not null check (char_length(host_name) <= 16),
  player text not null check (player ~ '^[A-Za-z0-9_]{1,16}$'),
  kind text not null check (char_length(kind) <= 20),
  detail text not null default '' check (char_length(detail) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists anticheat_reports_recent on public.anticheat_reports (created_at desc);
alter table public.anticheat_reports enable row level security;
revoke all on public.anticheat_reports from anon, authenticated;
grant select, insert on public.anticheat_reports to authenticated;
grant usage on sequence public.anticheat_reports_id_seq to authenticated;

drop policy if exists "hosts report cheaters" on public.anticheat_reports;
create policy "hosts report cheaters" on public.anticheat_reports for insert to authenticated with check (
  host_id = auth.uid()
  and lower(host_name) = lower((select username from public.profiles where id = auth.uid()))
  -- at most 30 reports a minute from one host
  and (select count(*) from public.anticheat_reports r where r.host_id = auth.uid() and r.created_at > now() - interval '1 minute') < 30
);
drop policy if exists "admins read reports" on public.anticheat_reports;
create policy "admins read reports" on public.anticheat_reports for select to authenticated using (public.is_admin());
-- Reports older than two weeks go away
create or replace function public.prune_anticheat_reports() returns void
language sql security definer set search_path = public as $$
  delete from public.anticheat_reports where created_at < now() - interval '14 days';
$$;
grant execute on function public.prune_anticheat_reports() to authenticated;

-- ============ 3. Levels saved to your account ============
alter table public.profiles add column if not exists xp bigint not null default 0;
alter table public.profiles add column if not exists progress jsonb;

create or replace function public.save_progress(p_progress jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_xp bigint;
begin
  if auth.uid() is null then return false; end if;
  if p_progress is null or jsonb_typeof(p_progress) <> 'object' or length(p_progress::text) > 40000 then return false; end if;
  v_xp := greatest(0, least(100000000, coalesce((p_progress->>'xp')::numeric, 0)::bigint));
  update public.profiles set progress = p_progress, xp = v_xp where id = auth.uid();
  return true;
exception when others then
  return false;
end $$;
revoke all on function public.save_progress(jsonb) from anon;
grant execute on function public.save_progress(jsonb) to authenticated;

create or replace function public.my_progress() returns jsonb
language sql stable security definer set search_path = public as $$
  select progress from public.profiles where id = auth.uid();
$$;
grant execute on function public.my_progress() to authenticated;

-- Level = floor(sqrt(xp / 50)) + 1 (the same formula as the game)
create or replace function public.level_of(p_xp bigint) returns int
language sql immutable as $$ select floor(sqrt(greatest(coalesce(p_xp, 0), 0) / 50.0))::int + 1 $$;

-- The plays leaderboard now also shows each player's level
drop function if exists public.leaderboard(int);
create or replace function public.leaderboard(p_limit int default 50) returns table (username text, plays bigint, rank text, level int)
language sql stable security definer set search_path = public as $$
  select p.username, count(*)::bigint as plays, p.rank, public.level_of(p.xp)
  from public.plays pl join public.profiles p on p.id = pl.host
  group by p.id, p.username, p.rank, p.xp
  order by count(*) desc, p.username
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;
grant execute on function public.leaderboard(int) to anon, authenticated;

drop function if exists public.level_leaderboard(int);
create or replace function public.level_leaderboard(p_limit int default 50) returns table (username text, level int, xp bigint, rank text)
language sql stable security definer set search_path = public as $$
  select p.username, public.level_of(p.xp), p.xp, p.rank
  from public.profiles p
  where p.xp > 0
  order by p.xp desc, p.username
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;
grant execute on function public.level_leaderboard(int) to anon, authenticated;

-- ============ 4. Open worlds: pictures, descriptions, minigames ============
alter table public.hosted_worlds add column if not exists description text not null default '';
alter table public.hosted_worlds add column if not exists image text;
alter table public.hosted_worlds drop constraint if exists hosted_worlds_description_check;
alter table public.hosted_worlds add constraint hosted_worlds_description_check check (char_length(description) <= 200);
alter table public.hosted_worlds drop constraint if exists hosted_worlds_image_check;
alter table public.hosted_worlds add constraint hosted_worlds_image_check check (image is null or char_length(image) <= 60000);
alter table public.hosted_worlds drop constraint if exists hosted_worlds_world_type_check;
alter table public.hosted_worlds add constraint hosted_worlds_world_type_check check (world_type in ('default', 'superflat', 'eggwars', 'bridge'));

-- ######################################################################################
-- PART: vibeblox_round17.sql
-- ######################################################################################

-- VibeBlox Round 17 (v25): run this once in Supabase -> SQL Editor -> New query -> paste -> Run.
-- Safe to run again. Run vibeblox_round16.sql first if you never did (this builds on it).
-- It adds temporary ranks: in the Admin panel the owner can give a rank for a number of hours or days (or forever).
-- When the time is up the rank goes away by itself.

alter table public.profiles add column if not exists rank_until timestamptz;

-- Takes away every rank whose time has run out
create or replace function public.expire_ranks() returns void
language sql security definer set search_path = public as $$
  update public.profiles set rank = 'none', rank_until = null
  where rank_until is not null and rank_until <= now();
$$;
grant execute on function public.expire_ranks() to anon, authenticated;

-- The owner gives (or takes away) a rank. p_hours = how long it lasts, or null for good.
-- Returns the player's name as stored, or null if nobody has that name.
drop function if exists public.give_rank(text, text);
create or replace function public.give_rank(p_username text, p_rank text, p_hours int default null) returns text
language plpgsql security definer set search_path = public as $$
declare found_name text;
begin
  if not public.is_owner() then raise exception 'owner only'; end if;
  if p_rank not in ('none', 'vanguard', 'elite', 'champion') then raise exception 'unknown rank'; end if;
  if p_hours is not null and (p_hours < 1 or p_hours > 87600) then raise exception 'hours must be between 1 and 87600'; end if;
  update public.profiles
    set rank = p_rank,
        rank_until = case when p_rank = 'none' or p_hours is null then null else now() + make_interval(hours => p_hours) end
    where lower(username) = lower(p_username)
    returning username into found_name;
  return found_name;
end $$;
revoke all on function public.give_rank(text, text, int) from anon;
grant execute on function public.give_rank(text, text, int) to authenticated;

-- The older set_rank keeps working (it gives the rank for good)
create or replace function public.set_rank(p_username text, p_rank text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.give_rank(p_username, p_rank, null);
end $$;
grant execute on function public.set_rank(text, text) to authenticated;

-- The leaderboards never show a rank that has run out
drop function if exists public.leaderboard(int);
create or replace function public.leaderboard(p_limit int default 50) returns table (username text, plays bigint, rank text, level int)
language sql stable security definer set search_path = public as $$
  select p.username, count(*)::bigint as plays,
         case when p.rank_until is not null and p.rank_until <= now() then 'none' else p.rank end,
         public.level_of(p.xp)
  from public.plays pl join public.profiles p on p.id = pl.host
  group by p.id, p.username, p.rank, p.rank_until, p.xp
  order by count(*) desc, p.username
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;
grant execute on function public.leaderboard(int) to anon, authenticated;

drop function if exists public.level_leaderboard(int);
create or replace function public.level_leaderboard(p_limit int default 50) returns table (username text, level int, xp bigint, rank text)
language sql stable security definer set search_path = public as $$
  select p.username, public.level_of(p.xp), p.xp,
         case when p.rank_until is not null and p.rank_until <= now() then 'none' else p.rank end
  from public.profiles p
  where p.xp > 0
  order by p.xp desc, p.username
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;
grant execute on function public.level_leaderboard(int) to anon, authenticated;

-- Clean up expired ranks every 10 minutes (needs the pg_cron extension; if your project doesn't have it, nothing breaks:
-- the game also cleans up whenever someone signs in or the owner gives a rank)
do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule('vibeblox-expire-ranks') where exists (select 1 from cron.job where jobname = 'vibeblox-expire-ranks');
  perform cron.schedule('vibeblox-expire-ranks', '*/10 * * * *', 'select public.expire_ranks()');
exception when others then
  raise notice 'pg_cron is not available; expired ranks are cleaned up when players sign in instead.';
end $$;

notify pgrst, 'reload schema';

-- ######################################################################################
-- PART: vibeblox_round18.sql
-- ######################################################################################

-- VibeBlox Round 18 (v26): run this once in Supabase -> SQL Editor -> New query -> paste -> Run.
-- Safe to run again. Run vibeblox_round16.sql and vibeblox_round17.sql first if you never did (this builds on them).
--
-- It adds the loyalty rewards: a free rank to choose from after your account is 1 month old, then every 2 months
-- (month 1, 3, 5, 7, 9, 11), and a bigger one on the 1 year mark (and every year after). The server keeps count,
-- so nobody can claim one early or twice.
--
--   Months 1, 3, 5, 7, 9, 11, 13 ...   Vanguard for 7 days, or Elite for 5 days, or Champion for 3 days (you may skip it)
--   Months 12, 24 ...                  Vanguard for good, or Elite for 3 months, or Champion for 1 month (you must pick one)
--
-- A month counts as 365/12 days, so month 12 lands exactly on the account's birthday.

create table if not exists public.loyalty_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  milestone int not null check (milestone >= 1 and milestone <= 600),
  choice text not null check (choice in ('vanguard', 'elite', 'champion', 'skip')),
  claimed_at timestamptz not null default now(),
  primary key (user_id, milestone)
);
alter table public.loyalty_claims enable row level security;
drop policy if exists "loyalty: see your own" on public.loyalty_claims;
create policy "loyalty: see your own" on public.loyalty_claims for select using (auth.uid() = user_id);
-- (nobody inserts directly: claim_loyalty below does it)

-- Is this month a reward month? 1, 3, 5, 7 ... and every 12th.
create or replace function public.is_loyalty_milestone(m int) returns boolean
language sql immutable as $$ select m >= 1 and (m % 12 = 0 or m % 2 = 1) $$;

-- How old the account has to be (in days) for a milestone
create or replace function public.loyalty_days(m int) returns int
language sql immutable as $$ select round(m * 365.0 / 12.0)::int $$;

-- Your account's age and what you already claimed
create or replace function public.loyalty_status() returns json
language plpgsql security definer set search_path = public as $$
declare born timestamptz; claimed int[];
begin
  if auth.uid() is null then return null; end if;
  select created_at into born from public.profiles where id = auth.uid();
  if born is null then return null; end if;
  select coalesce(array_agg(milestone order by milestone), '{}') into claimed from public.loyalty_claims where user_id = auth.uid();
  return json_build_object('created_at', born, 'now', now(), 'claimed', claimed);
end $$;
grant execute on function public.loyalty_status() to authenticated;

-- Claim a milestone. p_choice = 'vanguard' | 'elite' | 'champion' (or 'skip' for the 1, 3, 5... months only).
-- Returns 'ok', 'kept' (you already had a better rank, so nothing changed), 'skipped', or raises an error.
create or replace function public.claim_loyalty(p_milestone int, p_choice text) returns text
language plpgsql security definer set search_path = public as $$
declare
  born timestamptz; cur_rank text; cur_until timestamptz; special boolean; hrs int; rank_val int; cur_val int; active boolean; new_until timestamptz;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if not public.is_loyalty_milestone(p_milestone) then raise exception 'not a reward month'; end if;
  if p_choice not in ('vanguard', 'elite', 'champion', 'skip') then raise exception 'unknown choice'; end if;
  special := p_milestone % 12 = 0;
  if special and p_choice = 'skip' then raise exception 'the 1 year reward cannot be skipped'; end if;
  select created_at, rank, rank_until into born, cur_rank, cur_until from public.profiles where id = auth.uid() for update;
  if born is null then raise exception 'no profile'; end if;
  if now() < born + make_interval(days => public.loyalty_days(p_milestone)) then raise exception 'not yet'; end if;
  if exists (select 1 from public.loyalty_claims where user_id = auth.uid() and milestone = p_milestone) then raise exception 'already claimed'; end if;
  -- the older rewards have to be dealt with first, so nothing is lost by claiming out of order
  if exists (
    select 1 from generate_series(1, p_milestone - 1) m
    where public.is_loyalty_milestone(m) and now() >= born + make_interval(days => public.loyalty_days(m))
      and not exists (select 1 from public.loyalty_claims c where c.user_id = auth.uid() and c.milestone = m)
  ) then raise exception 'claim your earlier rewards first'; end if;

  insert into public.loyalty_claims (user_id, milestone, choice) values (auth.uid(), p_milestone, p_choice);
  if p_choice = 'skip' then return 'skipped'; end if;

  hrs := case p_choice
    when 'vanguard' then case when special then null else 7 * 24 end
    when 'elite' then case when special then 90 * 24 else 5 * 24 end
    else case when special then 30 * 24 else 3 * 24 end end;
  rank_val := case p_choice when 'vanguard' then 1 when 'elite' then 2 else 3 end;
  cur_val := case cur_rank when 'vanguard' then 1 when 'elite' then 2 when 'champion' then 3 else 0 end;
  active := cur_val > 0 and (cur_until is null or cur_until > now());
  if not active then cur_val := 0; cur_until := null; end if;

  if cur_val > rank_val then return 'kept'; end if;                               -- you already have something better
  if cur_val = rank_val then
    if cur_until is null then return 'kept'; end if;                              -- you already have it for good
    if hrs is null then new_until := null; else new_until := cur_until + make_interval(hours => hrs); end if; -- same rank: add the time on
  else
    if hrs is null then new_until := null; else new_until := now() + make_interval(hours => hrs); end if;
  end if;
  update public.profiles set rank = p_choice, rank_until = new_until where id = auth.uid();
  return 'ok';
end $$;
grant execute on function public.claim_loyalty(int, text) to authenticated;

notify pgrst, 'reload schema';

-- ######################################################################################
-- PART: vibeblox_round19.sql
-- ######################################################################################

-- VibeBlox Round 19 (Indev 26.1): run this once in Supabase -> SQL Editor -> New query -> paste -> Run.
-- Safe to run again. (vibeblox_all.sql already contains this; you only need this file if you ran the others before.)
--
-- Ranks no longer depend on the player being online or even having an account yet:
--   1. A rank is stored on the account, so a player who is offline gets it and finds it when they sign in.
--      A rank that has a time limit counts down by the clock, online or not.
--   2. The owner can give a rank to a username that has no account yet. It waits (for 30 days) and is
--      applied the moment an account with that name is created. A temporary rank starts when the account is made.
--   3. Everything that reads a player's rank (the game, hosted worlds, leaderboards) ignores a rank whose
--      time has run out, even if the clean-up job has not run yet.

alter table public.profiles add column if not exists rank_until timestamptz;

-- ============ Ranks waiting for an account that does not exist yet ============
create table if not exists public.pending_ranks (
  username text not null check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  rank text not null check (rank in ('vanguard', 'elite', 'champion')),
  hours int check (hours is null or (hours >= 1 and hours <= 87600)),   -- null = for good
  created_at timestamptz not null default now()
);
create unique index if not exists pending_ranks_name on public.pending_ranks (lower(username));
alter table public.pending_ranks enable row level security;
revoke all on public.pending_ranks from anon, authenticated;

-- The owner gives (or takes away) a rank. p_hours = how long it lasts, or null for good.
-- Works whether or not the player is online. If nobody has that name yet the rank waits for them (see above)
-- and the name comes back as typed; the game checks rank_info() to tell the two cases apart.
drop function if exists public.give_rank(text, text, int);
create or replace function public.give_rank(p_username text, p_rank text, p_hours int default null) returns text
language plpgsql security definer set search_path = public as $$
declare found_name text;
begin
  if not public.is_owner() then raise exception 'owner only'; end if;
  if p_rank not in ('none', 'vanguard', 'elite', 'champion') then raise exception 'unknown rank'; end if;
  if p_hours is not null and (p_hours < 1 or p_hours > 87600) then raise exception 'hours must be between 1 and 87600'; end if;
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,16}$' then raise exception 'not a valid username'; end if;
  update public.profiles
    set rank = p_rank,
        rank_until = case when p_rank = 'none' or p_hours is null then null else now() + make_interval(hours => p_hours) end
    where lower(username) = lower(p_username)
    returning username into found_name;
  if found_name is not null then
    delete from public.pending_ranks where lower(username) = lower(p_username);
    return found_name;
  end if;
  -- no account with that name (yet)
  if p_rank = 'none' then
    delete from public.pending_ranks where lower(username) = lower(p_username);
    return null;
  end if;
  insert into public.pending_ranks (username, rank, hours) values (p_username, p_rank, p_hours)
  on conflict (lower(username)) do update set rank = excluded.rank, hours = excluded.hours, created_at = now();
  return p_username;
end $$;
revoke all on function public.give_rank(text, text, int) from anon;
grant execute on function public.give_rank(text, text, int) to authenticated;

-- Is a rank waiting for this name? (owner only; lets the Admin panel say "they get it when they sign up")
create or replace function public.rank_pending(p_username text) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'owner only'; end if;
  return exists (select 1 from public.pending_ranks where lower(username) = lower(p_username) and created_at > now() - interval '30 days');
end $$;
revoke all on function public.rank_pending(text) from anon;
grant execute on function public.rank_pending(text) to authenticated;

-- When an account is created, hand over the rank that was waiting for its name
create or replace function public.apply_pending_rank() returns trigger
language plpgsql security definer set search_path = public as $$
declare pr public.pending_ranks%rowtype;
begin
  select * into pr from public.pending_ranks where lower(username) = lower(new.username) and created_at > now() - interval '30 days';
  if found then
    update public.profiles
      set rank = pr.rank, rank_until = case when pr.hours is null then null else now() + make_interval(hours => pr.hours) end
      where id = new.id;
  end if;
  delete from public.pending_ranks where lower(username) = lower(new.username) or created_at <= now() - interval '30 days';
  return null;
end $$;
drop trigger if exists profiles_pending_rank on public.profiles;
create trigger profiles_pending_rank after insert on public.profiles for each row execute function public.apply_pending_rank();

-- ============ A rank that ran out is never shown, even before the clean-up job runs ============
-- One player's plays and rank (hosted worlds use this for the name tags and world size; the game uses it for Rising Creator)
drop function if exists public.player_standing(text);
create or replace function public.player_standing(p_username text) returns table (plays bigint, rank text, rising boolean)
language sql stable security definer set search_path = public as $$
  select coalesce((select count(*) from public.plays pl where pl.host = p.id), 0)::bigint,
         case when lower(p.username) = 'master' then 'champion'
              when p.rank_until is not null and p.rank_until <= now() then 'none'
              else p.rank end,
         coalesce((select count(*) from public.plays pl where pl.host = p.id), 0) >= 1000
  from public.profiles p where lower(p.username) = lower(p_username);
$$;
grant execute on function public.player_standing(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ######################################################################################
-- PART: vibeblox_round20.sql
-- ######################################################################################

-- VibeBlox Round 20 (Indev 26.2): run this once in Supabase -> SQL Editor -> New query -> paste -> Run.
-- Safe to run again. (vibeblox_all.sql already contains this; you only need this file if you ran the others before.)
--
--   1. Server tags: a hosted world can carry up to 3 tags (Survival, PvP, Minigames, ...), so the Servers page can be filtered.
--   2. Likes: signed-in players can like a world. A like belongs to the world's id, so it is still there when the host
--      closes the world and opens it again later. You cannot like your own world, and guests cannot like.

-- ============ 1. Tags ============
alter table public.hosted_worlds add column if not exists tags text[] not null default '{}';
alter table public.hosted_worlds drop constraint if exists hosted_worlds_tags_check;
alter table public.hosted_worlds add constraint hosted_worlds_tags_check check (
  cardinality(tags) <= 3
  and tags <@ array['survival','pvp','minigames','creative','building','adventure','roleplay','redstone','parkour','skyblock','friendly','modded']::text[]
);

-- ============ 2. Likes ============
create table if not exists public.world_likes (
  world_id text not null check (world_id ~ '^[a-z0-9]{8,32}$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (world_id, user_id)
);
create index if not exists world_likes_by_world on public.world_likes (world_id);
alter table public.world_likes enable row level security;
revoke all on public.world_likes from anon, authenticated;   -- only the two functions below touch it

-- Like (p_on = true) or un-like a world. Returns the new number of likes.
create or replace function public.like_world(p_id text, p_on boolean) returns int
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); w public.hosted_worlds%rowtype; uname text;
begin
  if me is null then raise exception 'sign in to like worlds'; end if;
  select username into uname from public.profiles where id = me;
  if uname is null or uname ~* '^guest_' then raise exception 'guests cannot like worlds'; end if;
  if p_id is null or p_id !~ '^[a-z0-9]{8,32}$' then raise exception 'bad world'; end if;
  if coalesce(p_on, true) then
    -- you can only like a world you could see in the list right now (and not your own)
    select * into w from public.hosted_worlds where id = p_id;
    if not found then raise exception 'that world is not open any more'; end if;
    if w.host_id = me then raise exception 'you cannot like your own world'; end if;
    if w.privacy = 'friends' and not public.are_friends(me, w.host_id) then raise exception 'that world is not open any more'; end if;
    insert into public.world_likes (world_id, user_id) values (p_id, me) on conflict do nothing;
  else
    delete from public.world_likes where world_id = p_id and user_id = me;
  end if;
  return (select count(*)::int from public.world_likes where world_id = p_id);
end $$;
revoke all on function public.like_world(text, boolean) from anon;
grant execute on function public.like_world(text, boolean) to authenticated;

-- Likes for a list of worlds at once (anyone may look). `liked` is whether *you* liked it.
drop function if exists public.world_likes_for(text[]);
create or replace function public.world_likes_for(p_ids text[]) returns table (world_id text, likes bigint, liked boolean)
language sql stable security definer set search_path = public as $$
  select l.world_id, count(*)::bigint, coalesce(bool_or(l.user_id = auth.uid()), false)
  from public.world_likes l
  where l.world_id = any (p_ids[1:100])
  group by l.world_id;
$$;
grant execute on function public.world_likes_for(text[]) to anon, authenticated;

notify pgrst, 'reload schema';

-- ######################################################################################
-- PART: vibeblox_round21.sql
-- ######################################################################################

-- VibeBlox Round 21 (Indev 26.3): run this once in Supabase -> SQL Editor -> New query -> paste -> Run.
-- Safe to run again. (vibeblox_all.sql already contains this; you only need this file if you ran the others before.)
--
--   1. [OG]: every account that exists now (and every one made until you end it) is an OG player. It gets Elite's perks.
--      When you want it gone, run:   select public.end_og();     (everyone loses it and new accounts stop getting it)
--   2. Staff ranks [HELPER] and [MOD]: the owner picks them in the Admin panel (Staff tab). They get Elite's perks, and in
--      every world they can kick, ban, mute and use commands/cheats. (Banning is for that world; only admins ban everywhere.)

-- ============ 1. OG ============
alter table public.profiles add column if not exists og boolean not null default true;   -- existing accounts become OG right here
-- ============ 2. Staff ============
alter table public.profiles add column if not exists staff text;
alter table public.profiles drop constraint if exists profiles_staff_check;
alter table public.profiles add constraint profiles_staff_check check (staff is null or staff in ('helper', 'mod'));

-- Is the signed-in player an admin or staff? (the game and hosted worlds ask this before kick / ban / mute / commands)
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.staff is not null);
$$;
grant execute on function public.is_staff() to anon, authenticated;

-- Which staff rank do I have? ('helper', 'mod' or null)
create or replace function public.my_staff() returns text
language sql stable security definer set search_path = public as $$
  select p.staff from public.profiles p where p.id = auth.uid();
$$;
grant execute on function public.my_staff() to anon, authenticated;

-- The owner gives or takes away a staff rank. p_role = 'helper', 'mod' or 'none'. Returns the name as stored, or null if nobody has it.
create or replace function public.set_staff(p_username text, p_role text) returns text
language plpgsql security definer set search_path = public as $$
declare found_name text;
begin
  if not public.is_owner() then raise exception 'owner only'; end if;
  if p_role not in ('helper', 'mod', 'none') then raise exception 'unknown staff rank'; end if;
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,16}$' then raise exception 'not a valid username'; end if;
  update public.profiles set staff = case when p_role = 'none' then null else p_role end
    where lower(username) = lower(p_username) returning username into found_name;
  return found_name;
end $$;
revoke all on function public.set_staff(text, text) from anon;
grant execute on function public.set_staff(text, text) to authenticated;

-- Everyone on the staff (admins only can look)
drop function if exists public.list_staff();
create or replace function public.list_staff() returns table (username text, role text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  return query select p.username, p.staff from public.profiles p where p.staff is not null order by lower(p.username);
end $$;
revoke all on function public.list_staff() from anon;
grant execute on function public.list_staff() to authenticated;

-- Owner only: the end of the OG rank. Everybody loses it and new accounts do not get it.
create or replace function public.end_og() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_owner() then raise exception 'owner only'; end if;
  update public.profiles set og = false where og;
  get diagnostics n = row_count;
  alter table public.profiles alter column og set default false;
  return n;
end $$;
revoke all on function public.end_og() from anon;
grant execute on function public.end_og() to authenticated;

-- ============ Name tags in hosted worlds ask for this (now with OG and staff) ============
drop function if exists public.player_standing(text);
create or replace function public.player_standing(p_username text) returns table (plays bigint, rank text, rising boolean, og boolean, staff text)
language sql stable security definer set search_path = public as $$
  select coalesce((select count(*) from public.plays pl where pl.host = p.id), 0)::bigint,
         case when lower(p.username) = 'master' then 'champion'
              when p.rank_until is not null and p.rank_until <= now() then 'none'
              else p.rank end,
         coalesce((select count(*) from public.plays pl where pl.host = p.id), 0) >= 1000,
         p.og,
         p.staff
  from public.profiles p where lower(p.username) = lower(p_username);
$$;
grant execute on function public.player_standing(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ######################################################################################
-- PART: vibeblox_indev27.sql
-- ######################################################################################

-- VibeBlox Indev 27: [HELPER] and [MOD] staff can ban players from all of VibeBlox (not just one world).
-- Staff can't ban admins, other staff, or the owner; admins still can ban anyone but the owner.
-- Run this once in Supabase (SQL Editor), after vibeblox_round21.sql. Safe to run again.

create or replace function public.can_ban(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (
    public.is_staff()
    and lower(p_username) <> 'master'
    and not exists (select 1 from public.admins a where lower(a.username) = lower(p_username))
    and not exists (select 1 from public.profiles p where lower(p.username) = lower(p_username) and p.staff is not null)
  );
$$;
grant execute on function public.can_ban(text) to anon, authenticated;

drop policy if exists "admins ban" on public.bans;
create policy "admins ban" on public.bans for insert to authenticated with check (public.can_ban(username));
drop policy if exists "admins change bans" on public.bans;
create policy "admins change bans" on public.bans for update to authenticated using (public.can_ban(username)) with check (public.can_ban(username));
drop policy if exists "admins unban" on public.bans;
create policy "admins unban" on public.bans for delete to authenticated using (public.is_staff());

notify pgrst, 'reload schema';

-- ######################################################################################
-- PART: vibeblox_indev27_1.sql
-- ######################################################################################

-- VibeBlox Indev 27.1: Settings > Account > Danger zone > Delete account.
-- Run this once in Supabase (SQL Editor). Safe to run again.
-- Deleting the sign-in also removes the profile, friends, messages, likes, hosted worlds and everything else that hangs off it.
-- The owner account (Master) can't be deleted from here.

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  me uuid := auth.uid();
  nm text;
begin
  if me is null then raise exception 'Not signed in.'; end if;
  select username into nm from public.profiles where id = me;
  if lower(coalesce(nm, '')) = 'master' then raise exception 'The owner account can not be deleted.'; end if;
  if nm is not null then
    delete from public.admins where lower(username) = lower(nm);
    delete from public.pending_ranks where lower(username) = lower(nm);
  end if;
  delete from auth.users where id = me;   -- cascades to the profile and everything linked to it
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

notify pgrst, 'reload schema';

-- ######################################################################################
-- PART: vibeblox_indev28.sql
-- ######################################################################################

-- VibeBlox Indev 28: the OG rank is gone, and players have profiles.
-- Run this once in Supabase (SQL Editor). Safe to run again.

-- 1. OG can no longer be earned: new accounts do not get it. (Indev 30: players who already have it KEEP it. This part
--    used to take it from everybody; it no longer touches anyone's OG.)
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'og') then
    alter table public.profiles alter column og set default false;
  end if;
end $$;

-- 2. Player profiles: what the profile card shows for any player (read only, nothing private).
drop function if exists public.player_profile(text);
create or replace function public.player_profile(p_username text)
returns table (username text, level int, xp bigint, rank text, staff text, plays bigint, joined timestamptz, friends bigint, worlds bigint)
language sql stable security definer set search_path = public as $$
  select p.username,
         public.level_of(p.xp),
         p.xp,
         case when lower(p.username) = 'master' then 'champion'
              when p.rank_until is not null and p.rank_until <= now() then 'none'
              else p.rank end,
         case when p.staff in ('helper', 'mod') then p.staff else null end,
         coalesce((select count(*) from public.plays pl where pl.host = p.id), 0)::bigint,
         p.created_at,
         coalesce((select count(*) from public.friendships f where f.status = 'accepted' and (f.requester = p.id or f.addressee = p.id)), 0)::bigint,
         coalesce((select count(*) from public.hosted_worlds w where w.host_id = p.id), 0)::bigint
  from public.profiles p
  where lower(p.username) = lower(p_username)
  limit 1;
$$;
grant execute on function public.player_profile(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ######################################################################################
-- PART: vibeblox_indev29.sql
-- ######################################################################################

-- ======================================================================================================
-- Indev 29: worlds that can be joined even when their host has left ("sleeping worlds").
-- While someone hosts a world, their game saves a snapshot of it here (blocks, time, settings, roles, bans).
-- When the host leaves and nobody takes over, the world shows up on the Servers page as "Sleeping" and the first
-- player who joins wakes it up: their browser becomes the host from the snapshot. Safe to run again.
-- ======================================================================================================

create table if not exists public.world_snapshots (
  id text primary key check (id ~ '^[a-z0-9]{8,32}$'),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  host_id uuid references public.profiles(id) on delete set null,   -- who is running it now (null: sleeping)
  owner_name text not null,
  name text not null check (char_length(name) between 1 and 40),
  mode text not null default 'survival' check (mode in ('survival', 'creative', 'adventure')),
  world_type text not null default 'default' check (world_type in ('default', 'superflat')),
  privacy text not null default 'public' check (privacy in ('public', 'accounts', 'friends')),
  max_players int not null default 18 check (max_players between 1 and 100),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint world_snapshot_size check (pg_column_size(data) < 3000000)
);
alter table public.world_snapshots enable row level security;
revoke all on public.world_snapshots from anon, authenticated;   -- everything goes through the functions below

-- Save (or create) the snapshot of a world you host. Only the owner, or whoever woke it up, can save it.
drop function if exists public.save_world_snapshot(text, text, text, text, text, int, jsonb);
create or replace function public.save_world_snapshot(p_id text, p_name text, p_mode text, p_world_type text, p_privacy text, p_max int, p_data jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); uname text; r public.world_snapshots;
begin
  if uid is null then raise exception 'sign in first'; end if;
  select username into uname from public.profiles where id = uid;
  if uname is null then raise exception 'no profile'; end if;
  if p_privacy not in ('public', 'accounts', 'friends') then
    delete from public.world_snapshots where id = p_id and owner_id = uid;   -- a private world is not kept
    return false;
  end if;
  select * into r from public.world_snapshots where id = p_id;
  if not found then
    insert into public.world_snapshots (id, owner_id, host_id, owner_name, name, mode, world_type, privacy, max_players, data)
    values (p_id, uid, uid, uname, left(p_name, 40), p_mode, p_world_type, p_privacy, greatest(1, least(100, p_max)), p_data);
    return true;
  end if;
  if r.owner_id <> uid and r.host_id is distinct from uid then raise exception 'not your world'; end if;
  update public.world_snapshots set host_id = uid, name = left(p_name, 40), mode = p_mode, world_type = p_world_type, privacy = p_privacy,
    max_players = greatest(1, least(100, p_max)), data = p_data, updated_at = now() where id = p_id;
  return true;
end $$;
grant execute on function public.save_world_snapshot(text, text, text, text, text, int, jsonb) to authenticated;

-- The host left for good: the world goes to sleep (joinable by anyone who may see it)
drop function if exists public.release_world(text);
create or replace function public.release_world(p_id text) returns void language sql security definer set search_path = public as $$
  update public.world_snapshots set host_id = null, updated_at = now() where id = p_id and host_id = auth.uid();
$$;
grant execute on function public.release_world(text) to authenticated;

-- Worlds with nobody running them that you are allowed to see (same rules as the Servers page)
drop function if exists public.list_sleeping_worlds();
create or replace function public.list_sleeping_worlds()
returns table (id text, name text, owner_name text, mode text, world_type text, privacy text, max_players int, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.owner_name, s.mode, s.world_type, s.privacy, s.max_players, s.updated_at
  from public.world_snapshots s
  where (s.host_id is null or s.updated_at < now() - interval '3 minutes')
    and s.updated_at > now() - interval '60 days'
    and auth.uid() is not null
    and (s.privacy in ('public', 'accounts') or s.owner_id = auth.uid()
         or (s.privacy = 'friends' and public.are_friends(auth.uid(), s.owner_id)))
  order by s.updated_at desc limit 40;
$$;
grant execute on function public.list_sleeping_worlds() to authenticated;

-- Wake a sleeping world: you get the snapshot and you are the one running it from now on
drop function if exists public.claim_world(text);
create or replace function public.claim_world(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r public.world_snapshots;
begin
  if uid is null then raise exception 'sign in first'; end if;
  select * into r from public.world_snapshots where id = p_id for update;
  if not found then raise exception 'no such world'; end if;
  if not (r.privacy in ('public', 'accounts') or r.owner_id = uid or (r.privacy = 'friends' and public.are_friends(uid, r.owner_id))) then
    raise exception 'no such world';
  end if;
  if r.host_id is not null and r.host_id <> uid and r.updated_at > now() - interval '3 minutes' then raise exception 'world is awake'; end if;
  update public.world_snapshots set host_id = uid, updated_at = now() where id = p_id;
  return jsonb_build_object('id', r.id, 'name', r.name, 'owner', r.owner_name, 'mode', r.mode, 'worldType', r.world_type,
    'privacy', r.privacy, 'maxPlayers', r.max_players, 'data', r.data);
end $$;
grant execute on function public.claim_world(text) to authenticated;

-- The owner can delete their world's snapshot (when the planet is deleted)
drop function if exists public.delete_world_snapshot(text);
create or replace function public.delete_world_snapshot(p_id text) returns void language sql security definer set search_path = public as $$
  delete from public.world_snapshots where id = p_id and owner_id = auth.uid();
$$;
grant execute on function public.delete_world_snapshot(text) to authenticated;

-- A host who leaves while another player takes over passes the saved world on to them
drop function if exists public.transfer_world(text, text);
create or replace function public.transfer_world(p_id text, p_to text) returns void language sql security definer set search_path = public as $$
  update public.world_snapshots set host_id = (select id from public.profiles where lower(username) = lower(p_to)), updated_at = now()
  where id = p_id and host_id = auth.uid();
$$;
grant execute on function public.transfer_world(text, text) to authenticated;

-- ######################################################################################
-- PART: vibeblox_indev30.sql
-- ######################################################################################

-- VibeBlox Indev 30: [OG] is back for the players who had it (it can never be earned again), the [YOUTUBE] rank,
-- and a safer sign-up. Run this once in Supabase (SQL Editor). Safe to run again.

-- ============ 1. OG: kept forever, not obtainable ============
alter table public.profiles add column if not exists og boolean not null default false;
alter table public.profiles alter column og set default false;     -- new accounts never get it

-- Indev 28 took OG away from everybody. Give it back, ONCE, to every account that existed back then.
-- (If you want a different day, change the date below before you run this the first time.)
create table if not exists public.vb_migrations (name text primary key, done_at timestamptz not null default now());
alter table public.vb_migrations enable row level security;
do $$ begin
  if not exists (select 1 from public.vb_migrations where name = 'og_restore_indev30') then
    update public.profiles set og = true where created_at < timestamptz '2026-10-18 18:00:00+00';
    insert into public.vb_migrations (name) values ('og_restore_indev30');
  end if;
end $$;

-- OG can not be ended any more (this used to take it from everybody).
create or replace function public.end_og() returns int
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'OG is permanent now';
end $$;
revoke all on function public.end_og() from anon;
grant execute on function public.end_og() to authenticated;

-- The owner can fix one player by hand (for example someone whose account was made just after the day above).
create or replace function public.set_og(p_username text, p_on boolean) returns text
language plpgsql security definer set search_path = public as $$
declare found_name text;
begin
  if not public.is_owner() then raise exception 'owner only'; end if;
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,16}$' then raise exception 'not a valid username'; end if;
  update public.profiles set og = coalesce(p_on, false) where lower(username) = lower(p_username) returning username into found_name;
  return found_name;
end $$;
revoke all on function public.set_og(text, boolean) from anon;
grant execute on function public.set_og(text, boolean) to authenticated;

-- ============ 2. [YOUTUBE]: a special rank the owner gives in the Admin panel ============
alter table public.profiles add column if not exists special text;
alter table public.profiles drop constraint if exists profiles_special_check;
alter table public.profiles add constraint profiles_special_check check (special is null or special in ('youtube'));

create or replace function public.my_special() returns text
language sql stable security definer set search_path = public as $$
  select p.special from public.profiles p where p.id = auth.uid();
$$;
grant execute on function public.my_special() to anon, authenticated;

-- The owner gives or takes away a special rank. p_role = 'youtube' or 'none'. Returns the name as stored, or null if nobody has it.
create or replace function public.set_special(p_username text, p_role text) returns text
language plpgsql security definer set search_path = public as $$
declare found_name text;
begin
  if not public.is_owner() then raise exception 'owner only'; end if;
  if p_role not in ('youtube', 'none') then raise exception 'unknown special rank'; end if;
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,16}$' then raise exception 'not a valid username'; end if;
  update public.profiles set special = case when p_role = 'none' then null else p_role end
    where lower(username) = lower(p_username) returning username into found_name;
  return found_name;
end $$;
revoke all on function public.set_special(text, text) from anon;
grant execute on function public.set_special(text, text) to authenticated;

drop function if exists public.list_special();
create or replace function public.list_special() returns table (username text, role text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  return query select p.username, p.special from public.profiles p where p.special is not null order by lower(p.username);
end $$;
revoke all on function public.list_special() from anon;
grant execute on function public.list_special() to authenticated;

-- ============ 3. Sign-up can not pick its own badges (a player used to be able to add them to the request) ============
drop policy if exists "make your own profile" on public.profiles;
create policy "make your own profile" on public.profiles for insert to authenticated
  with check (id = auth.uid() and public.is_confirmed() and public.name_allowed(auth.uid(), username) and rank = 'none'
              and og = false and staff is null and special is null);

-- ============ 4. What name tags and profile cards ask for (now with OG and YOUTUBE) ============
drop function if exists public.player_standing(text);
create or replace function public.player_standing(p_username text) returns table (plays bigint, rank text, rising boolean, og boolean, staff text, special text)
language sql stable security definer set search_path = public as $$
  select coalesce((select count(*) from public.plays pl where pl.host = p.id), 0)::bigint,
         case when lower(p.username) = 'master' then 'champion'
              when p.rank_until is not null and p.rank_until <= now() then 'none'
              else p.rank end,
         coalesce((select count(*) from public.plays pl where pl.host = p.id), 0) >= 1000,
         p.og,
         p.staff,
         p.special
  from public.profiles p where lower(p.username) = lower(p_username);
$$;
grant execute on function public.player_standing(text) to anon, authenticated;

drop function if exists public.player_profile(text);
create or replace function public.player_profile(p_username text)
returns table (username text, level int, xp bigint, rank text, staff text, plays bigint, joined timestamptz, friends bigint, worlds bigint, og boolean, special text)
language sql stable security definer set search_path = public as $$
  select p.username,
         public.level_of(p.xp),
         p.xp,
         case when lower(p.username) = 'master' then 'champion'
              when p.rank_until is not null and p.rank_until <= now() then 'none'
              else p.rank end,
         case when p.staff in ('helper', 'mod') then p.staff else null end,
         coalesce((select count(*) from public.plays pl where pl.host = p.id), 0)::bigint,
         p.created_at,
         coalesce((select count(*) from public.friendships f where f.status = 'accepted' and (f.requester = p.id or f.addressee = p.id)), 0)::bigint,
         coalesce((select count(*) from public.hosted_worlds w where w.host_id = p.id), 0)::bigint,
         p.og,
         p.special
  from public.profiles p
  where lower(p.username) = lower(p_username)
  limit 1;
$$;
grant execute on function public.player_profile(text) to anon, authenticated;

-- ============ Anti-cheat reports: admins can dismiss them ============
-- (a report can be lag, or a player who only changed game mode; dismissing removes it from the list)
drop function if exists public.dismiss_cheat_reports(bigint[]);
create or replace function public.dismiss_cheat_reports(p_ids bigint[]) returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_ids is null or array_length(p_ids, 1) is null then return 0; end if;
  delete from public.anticheat_reports where id = any(p_ids[1:300]);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
grant execute on function public.dismiss_cheat_reports(bigint[]) to authenticated;

-- Dismiss everything about one player ('' = every report)
drop function if exists public.clear_cheat_reports(text);
create or replace function public.clear_cheat_reports(p_player text default '') returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if coalesce(p_player, '') = '' then
    delete from public.anticheat_reports;
  else
    delete from public.anticheat_reports where lower(player) = lower(p_player);
  end if;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
grant execute on function public.clear_cheat_reports(text) to authenticated;


notify pgrst, 'reload schema';

-- ######################################################################################
-- PART: vibeblox_indev32.sql
-- ######################################################################################

-- VibeBlox Indev 32: admin access levels (full or limited, with a "can give ranks" switch), /undercover for [YOUTUBE],
-- and the player standing now says who may wear their own skin and cape.
-- Run this once in Supabase (SQL Editor), after the older files (or just run vibeblox_all.sql). Safe to run again.

-- ============ 1. Admin access levels ============
-- admins.perms = NULL means FULL ACCESS (every admin from before this update keeps it).
-- Otherwise it lists what this admin may do: 'announce', 'bans', 'anticheat', 'ranks'.
-- (Everyone who is an admin can always use the Players tab, Ads and My account. Only the owner chooses admins.)
alter table public.admins add column if not exists perms text[];
alter table public.admins drop constraint if exists admins_perms_check;
alter table public.admins add constraint admins_perms_check check (perms is null or perms <@ array['announce', 'bans', 'anticheat', 'ranks']::text[]);

-- May the signed-in player do this? (the owner always may; an admin with perms = NULL may do everything)
create or replace function public.admin_can(p_perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    left join public.admins a on lower(a.username) = lower(p.username)
    where p.id = auth.uid()
      and (lower(p.username) = 'master' or (a.username is not null and (a.perms is null or p_perm = any (a.perms))))
  );
$$;
grant execute on function public.admin_can(text) to anon, authenticated;

-- What may I do? (NULL = I am not an admin)
create or replace function public.my_admin_perms() returns text[]
language sql stable security definer set search_path = public as $$
  select case when lower(p.username) = 'master' or a.perms is null then array['announce', 'bans', 'anticheat', 'ranks']::text[] else a.perms end
  from public.profiles p
  left join public.admins a on lower(a.username) = lower(p.username)
  where p.id = auth.uid() and (a.username is not null or lower(p.username) = 'master');
$$;
grant execute on function public.my_admin_perms() to anon, authenticated;

-- Everyone who can open the Admin panel, and what they may do (admins only can look)
drop function if exists public.list_admins();
create or replace function public.list_admins() returns table (username text, perms text[], full_access boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  return query select a.username, a.perms, (a.perms is null) from public.admins a order by lower(a.username);
end $$;
revoke all on function public.list_admins() from anon;
grant execute on function public.list_admins() to authenticated;

-- The owner makes someone an admin (p_on = true) or takes it away. p_perms = NULL gives full access.
drop function if exists public.set_admin(text, boolean);
create or replace function public.set_admin(p_username text, p_on boolean, p_perms text[] default null) returns text
language plpgsql security definer set search_path = public as $$
declare found_name text;
begin
  if not public.is_owner() then raise exception 'owner only'; end if;
  if lower(p_username) = 'master' then raise exception 'The owner is always an admin'; end if;
  if p_perms is not null and not (p_perms <@ array['announce', 'bans', 'anticheat', 'ranks']::text[]) then raise exception 'unknown permission'; end if;
  select username into found_name from public.profiles where lower(username) = lower(p_username);
  if found_name is null then return null; end if;
  delete from public.admins where lower(username) = lower(found_name);
  if p_on then insert into public.admins (username, perms) values (found_name, p_perms); end if;
  return found_name;
end $$;
revoke all on function public.set_admin(text, boolean, text[]) from anon;
grant execute on function public.set_admin(text, boolean, text[]) to authenticated;

-- What each permission guards
drop policy if exists "admins announce" on public.announcements;
create policy "admins announce" on public.announcements for insert to authenticated with check (public.admin_can('announce'));
drop policy if exists "admins delete announcements" on public.announcements;
create policy "admins delete announcements" on public.announcements for delete to authenticated using (public.admin_can('announce'));

create or replace function public.can_ban(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.admin_can('bans') or (
    public.is_staff()
    and lower(p_username) <> 'master'
    and not exists (select 1 from public.admins a where lower(a.username) = lower(p_username))
    and not exists (select 1 from public.profiles p where lower(p.username) = lower(p_username) and p.staff is not null)
  );
$$;
grant execute on function public.can_ban(text) to anon, authenticated;
drop policy if exists "admins unban" on public.bans;
create policy "admins unban" on public.bans for delete to authenticated
  using (public.admin_can('bans') or exists (select 1 from public.profiles p where p.id = auth.uid() and p.staff is not null));

drop policy if exists "admins read reports" on public.anticheat_reports;
create policy "admins read reports" on public.anticheat_reports for select to authenticated using (public.admin_can('anticheat'));

create or replace function public.dismiss_cheat_reports(p_ids bigint[]) returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not public.admin_can('anticheat') then raise exception 'admins only'; end if;
  if p_ids is null or array_length(p_ids, 1) is null then return 0; end if;
  delete from public.anticheat_reports where id = any(p_ids[1:300]);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
grant execute on function public.dismiss_cheat_reports(bigint[]) to authenticated;

create or replace function public.clear_cheat_reports(p_player text default '') returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not public.admin_can('anticheat') then raise exception 'admins only'; end if;
  if coalesce(p_player, '') = '' then
    delete from public.anticheat_reports;
  else
    delete from public.anticheat_reports where lower(player) = lower(p_player);
  end if;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
grant execute on function public.clear_cheat_reports(text) to authenticated;

-- ============ 2. Everything in the Ranks tab: the owner, or an admin with the "ranks" permission ============
-- (only the owner can change the owner's own account)
drop function if exists public.give_rank(text, text, int);
create or replace function public.give_rank(p_username text, p_rank text, p_hours int default null) returns text
language plpgsql security definer set search_path = public as $$
declare found_name text;
begin
  if not public.admin_can('ranks') then raise exception 'owner only'; end if;
  if p_rank not in ('none', 'vanguard', 'elite', 'champion') then raise exception 'unknown rank'; end if;
  if p_hours is not null and (p_hours < 1 or p_hours > 87600) then raise exception 'hours must be between 1 and 87600'; end if;
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,16}$' then raise exception 'not a valid username'; end if;
  if lower(p_username) = 'master' and not public.is_owner() then raise exception 'owner only'; end if;
  update public.profiles
    set rank = p_rank,
        rank_until = case when p_rank = 'none' or p_hours is null then null else now() + make_interval(hours => p_hours) end
    where lower(username) = lower(p_username)
    returning username into found_name;
  if found_name is not null then
    delete from public.pending_ranks where lower(username) = lower(p_username);
    return found_name;
  end if;
  -- no account with that name (yet)
  if p_rank = 'none' then
    delete from public.pending_ranks where lower(username) = lower(p_username);
    return null;
  end if;
  insert into public.pending_ranks (username, rank, hours) values (p_username, p_rank, p_hours)
  on conflict (lower(username)) do update set rank = excluded.rank, hours = excluded.hours, created_at = now();
  return p_username;
end $$;
revoke all on function public.give_rank(text, text, int) from anon;
grant execute on function public.give_rank(text, text, int) to authenticated;

create or replace function public.rank_pending(p_username text) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.admin_can('ranks') then raise exception 'owner only'; end if;
  return exists (select 1 from public.pending_ranks where lower(username) = lower(p_username) and created_at > now() - interval '30 days');
end $$;
revoke all on function public.rank_pending(text) from anon;
grant execute on function public.rank_pending(text) to authenticated;

create or replace function public.set_staff(p_username text, p_role text) returns text
language plpgsql security definer set search_path = public as $$
declare found_name text;
begin
  if not public.admin_can('ranks') then raise exception 'owner only'; end if;
  if p_role not in ('helper', 'mod', 'none') then raise exception 'unknown staff rank'; end if;
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,16}$' then raise exception 'not a valid username'; end if;
  if lower(p_username) = 'master' then raise exception 'The owner already has every power'; end if;
  update public.profiles set staff = case when p_role = 'none' then null else p_role end
    where lower(username) = lower(p_username) returning username into found_name;
  return found_name;
end $$;
revoke all on function public.set_staff(text, text) from anon;
grant execute on function public.set_staff(text, text) to authenticated;

drop function if exists public.list_staff();
create or replace function public.list_staff() returns table (username text, role text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.admin_can('ranks') then raise exception 'admins only'; end if;
  return query select p.username, p.staff from public.profiles p where p.staff is not null order by lower(p.username);
end $$;
revoke all on function public.list_staff() from anon;
grant execute on function public.list_staff() to authenticated;

-- [YOUTUBE]: giving it or taking it away. Taking it away also turns /undercover off.
alter table public.profiles add column if not exists undercover boolean not null default false;

create or replace function public.set_special(p_username text, p_role text) returns text
language plpgsql security definer set search_path = public as $$
declare found_name text;
begin
  if not public.admin_can('ranks') then raise exception 'owner only'; end if;
  if p_role not in ('youtube', 'none') then raise exception 'unknown special rank'; end if;
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,16}$' then raise exception 'not a valid username'; end if;
  if lower(p_username) = 'master' then raise exception 'The owner already has every power'; end if;
  update public.profiles
    set special = case when p_role = 'none' then null else p_role end,
        undercover = case when p_role = 'none' then false else undercover end
    where lower(username) = lower(p_username) returning username into found_name;
  return found_name;
end $$;
revoke all on function public.set_special(text, text) from anon;
grant execute on function public.set_special(text, text) to authenticated;

drop function if exists public.list_special();
create or replace function public.list_special() returns table (username text, role text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.admin_can('ranks') then raise exception 'admins only'; end if;
  return query select p.username, p.special from public.profiles p where p.special is not null order by lower(p.username);
end $$;
revoke all on function public.list_special() from anon;
grant execute on function public.list_special() to authenticated;

create or replace function public.set_og(p_username text, p_on boolean) returns text
language plpgsql security definer set search_path = public as $$
declare found_name text;
begin
  if not public.admin_can('ranks') then raise exception 'owner only'; end if;
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,16}$' then raise exception 'not a valid username'; end if;
  update public.profiles set og = coalesce(p_on, false) where lower(username) = lower(p_username) returning username into found_name;
  return found_name;
end $$;
revoke all on function public.set_og(text, boolean) from anon;
grant execute on function public.set_og(text, boolean) to authenticated;

-- ============ 3. /undercover: only a [YOUTUBE] player can hide their tags ============
create or replace function public.set_undercover(p_on boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.profiles set undercover = coalesce(p_on, false) where id = auth.uid() and special = 'youtube';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'YOUTUBE only'; end if;
  return coalesce(p_on, false);
end $$;
revoke all on function public.set_undercover(boolean) from anon;
grant execute on function public.set_undercover(boolean) to authenticated;

-- What name tags and profile cards ask for. While a player is undercover their [YOUTUBE], [OG] and paid rank are hidden from
-- everyone (staff tags and the owner are never hidden). "cosmetics" says who may wear their own skin and cape, hidden or not.
drop function if exists public.player_standing(text);
create or replace function public.player_standing(p_username text) returns table (plays bigint, rank text, rising boolean, og boolean, staff text, special text, cosmetics boolean)
language sql stable security definer set search_path = public as $$
  select coalesce((select count(*) from public.plays pl where pl.host = p.id), 0)::bigint,
         case when lower(p.username) = 'master' then 'champion'
              when p.undercover then 'none'
              when p.rank_until is not null and p.rank_until <= now() then 'none'
              else p.rank end,
         coalesce((select count(*) from public.plays pl where pl.host = p.id), 0) >= 1000,
         p.og and not p.undercover,
         p.staff,
         case when p.undercover then null else p.special end,
         (lower(p.username) = 'master' or coalesce(p.special = 'youtube', false)
          or (p.rank = 'champion' and (p.rank_until is null or p.rank_until > now())))
  from public.profiles p where lower(p.username) = lower(p_username);
$$;
grant execute on function public.player_standing(text) to anon, authenticated;

drop function if exists public.player_profile(text);
create or replace function public.player_profile(p_username text)
returns table (username text, level int, xp bigint, rank text, staff text, plays bigint, joined timestamptz, friends bigint, worlds bigint, og boolean, special text)
language sql stable security definer set search_path = public as $$
  select p.username,
         public.level_of(p.xp),
         p.xp,
         case when lower(p.username) = 'master' then 'champion'
              when p.undercover then 'none'
              when p.rank_until is not null and p.rank_until <= now() then 'none'
              else p.rank end,
         case when p.staff in ('helper', 'mod') then p.staff else null end,
         coalesce((select count(*) from public.plays pl where pl.host = p.id), 0)::bigint,
         p.created_at,
         coalesce((select count(*) from public.friendships f where f.status = 'accepted' and (f.requester = p.id or f.addressee = p.id)), 0)::bigint,
         coalesce((select count(*) from public.hosted_worlds w where w.host_id = p.id), 0)::bigint,
         p.og and not p.undercover,
         case when p.undercover then null else p.special end
  from public.profiles p
  where lower(p.username) = lower(p_username)
  limit 1;
$$;
grant execute on function public.player_profile(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ######################################################################################
-- PART: vibeblox_indev36.sql
-- ######################################################################################

-- VibeBlox Indev 36: players can own several paid ranks and switch between them in the Shop.
-- Run this once in the Supabase SQL editor. Safe to run again.

alter table public.profiles add column if not exists owned_ranks text[] not null default '{}';
-- whoever already has a rank owns it
update public.profiles set owned_ranks = array[rank] where rank <> 'none' and owned_ranks = '{}';

-- The owner (or the store's webhook) gives a rank: it is added to what the player owns and turned on.
create or replace function public.set_rank(p_username text, p_rank text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'owner only'; end if;
  if p_rank not in ('none', 'vanguard', 'elite', 'champion') then raise exception 'unknown rank'; end if;
  if p_rank = 'none' then
    update public.profiles set rank = 'none', owned_ranks = '{}' where lower(username) = lower(p_username);
  else
    update public.profiles
       set rank = p_rank,
           owned_ranks = (select array_agg(distinct x) from unnest(owned_ranks || p_rank) as x)
     where lower(username) = lower(p_username);
  end if;
end $$;
grant execute on function public.set_rank(text, text) to authenticated;

-- A player turns on one of the ranks they own (or turns them all off with 'none').
create or replace function public.switch_rank(p_rank text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if p_rank not in ('none', 'vanguard', 'elite', 'champion') then raise exception 'unknown rank'; end if;
  if p_rank <> 'none' and not exists (select 1 from public.profiles where id = auth.uid() and p_rank = any(owned_ranks)) then
    raise exception 'you do not own that rank';
  end if;
  update public.profiles set rank = p_rank where id = auth.uid();
end $$;
grant execute on function public.switch_rank(text) to authenticated;

-- ######################################################################################
-- PART: indev37_new.sql
-- ######################################################################################


-- ============ Indev 37: edit, delete and report private messages ============
alter table public.direct_messages add column if not exists edited_at timestamptz;

-- Edit your own message. A second edit keeps the same "edited" mark.
create or replace function public.edit_dm(p_id bigint, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if p_body is null or char_length(trim(p_body)) = 0 or char_length(p_body) > 500 then raise exception 'bad message'; end if;
  update public.direct_messages set body = trim(p_body), edited_at = coalesce(edited_at, now())
   where id = p_id and sender = auth.uid();
  if not found then raise exception 'not your message'; end if;
end $$;
grant execute on function public.edit_dm(bigint, text) to authenticated;

-- Delete your own message (it disappears for both of you).
create or replace function public.delete_dm(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  delete from public.direct_messages where id = p_id and sender = auth.uid();
  if not found then raise exception 'not your message'; end if;
end $$;
grant execute on function public.delete_dm(bigint) to authenticated;

-- Reports: a copy of the message is kept, so it still counts if the sender deletes it afterwards.
create table if not exists public.message_reports (
  id bigserial primary key,
  reporter uuid not null references public.profiles(id) on delete cascade,
  reported uuid not null references public.profiles(id) on delete cascade,
  message_id bigint,
  body text not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);
alter table public.message_reports enable row level security;
drop policy if exists "no direct access to message reports" on public.message_reports;
create policy "no direct access to message reports" on public.message_reports for select to authenticated using (false);

create or replace function public.report_dm(p_id bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.direct_messages%rowtype;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select * into m from public.direct_messages where id = p_id and recipient = auth.uid();
  if not found then raise exception 'you can only report messages sent to you'; end if;
  if exists (select 1 from public.message_reports where message_id = p_id and reporter = auth.uid()) then return; end if;
  insert into public.message_reports (reporter, reported, message_id, body, reason)
  values (auth.uid(), m.sender, p_id, m.body, left(coalesce(p_reason, ''), 200));
end $$;
grant execute on function public.report_dm(bigint, text) to authenticated;

drop function if exists public.list_message_reports();
create or replace function public.list_message_reports() returns table (id bigint, reporter text, reported text, body text, reason text, at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  return query
    select r.id, (select username from public.profiles where profiles.id = r.reporter),
           (select username from public.profiles where profiles.id = r.reported), r.body, r.reason, r.created_at
      from public.message_reports r order by r.created_at desc limit 200;
end $$;
grant execute on function public.list_message_reports() to authenticated;

create or replace function public.dismiss_message_report(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  delete from public.message_reports where id = p_id;
end $$;
grant execute on function public.dismiss_message_report(bigint) to authenticated;

-- ======================================================================================================
-- Indev 37: MINIGAMES (chess and checkers online, ratings, leaderboards, spectating, fair play)
-- ======================================================================================================

-- A paused account cannot join rated games (set by a fair-play review).
alter table public.profiles add column if not exists mg_banned_until timestamptz;

-- ---------- ratings (one row per player per game) ----------
create table if not exists public.mg_ratings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null check (game in ('chess', 'checkers', 'puzzle')),
  rating int not null default 1200 check (rating between 100 and 3200),
  games int not null default 0,
  sum_opp bigint not null default 0,
  pts numeric not null default 0,
  peak int not null default 1200,
  wins int not null default 0,
  losses int not null default 0,
  draws int not null default 0,
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);
alter table public.mg_ratings enable row level security;
revoke all on public.mg_ratings from anon, authenticated;
grant select on public.mg_ratings to authenticated;
drop policy if exists "ratings are public" on public.mg_ratings;
create policy "ratings are public" on public.mg_ratings for select to authenticated using (true);

-- Same maths as src/minigames/ratings.ts: the first 5 games give a performance estimate, then Elo with FIDE K factors.
drop function if exists public.mg_next_rating(int, int, bigint, numeric, int, numeric);
create or replace function public.mg_next_rating(r int, n int, sum_opp bigint, pts numeric, opp int, score numeric)
returns table (nr int, nn int, nsum bigint, npts numeric)
language plpgsql immutable as $$
declare n2 int := n + 1; s2 bigint := sum_opp + opp; p2 numeric := pts + score; res numeric; g numeric; p double precision; k int; d double precision;
begin
  if n2 <= 5 then
    g := n2 + 1;
    p := ((p2 + 0.5) / g)::double precision;
    if p >= 0.995 then d := 800; elsif p <= 0.005 then d := -800; else d := greatest(-800, least(800, 400 * log(p / (1 - p)))); end if;
    res := (s2 + 1200)::numeric / g + d::numeric;
  else
    k := case when n < 30 then 40 when r < 2400 then 20 else 10 end;
    res := r + k * (score - 1 / (1 + power(10::numeric, (opp - r) / 400.0)));
  end if;
  nr := greatest(100, least(3200, round(res)))::int; nn := n2; nsum := s2; npts := p2;
  return next;
end $$;

-- ---------- best scores of the solo games (2048, tic tac toe) ----------
create table if not exists public.mg_scores (
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null check (game in ('2048', 'tictactoe')),
  score int not null default 0 check (score between 0 and 4000000),
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);
alter table public.mg_scores enable row level security;
revoke all on public.mg_scores from anon, authenticated;
grant select on public.mg_scores to authenticated;
drop policy if exists "scores are public" on public.mg_scores;
create policy "scores are public" on public.mg_scores for select to authenticated using (true);

create or replace function public.mg_submit_score(p_game text, p_score int, p_extra jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare lim int := (case when p_game = '2048' then 4000000 else 100000 end);
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if p_game not in ('2048', 'tictactoe') then raise exception 'unknown game'; end if;
  if p_score < 0 or p_score > lim then raise exception 'bad score'; end if;
  if pg_column_size(p_extra) > 2000 then p_extra := '{}'::jsonb; end if;
  insert into public.mg_scores (user_id, game, score, extra) values (auth.uid(), p_game, p_score, p_extra)
  on conflict (user_id, game) do update
    set score = greatest(public.mg_scores.score, excluded.score),
        extra = case when excluded.score >= public.mg_scores.score then excluded.extra else public.mg_scores.extra end,
        updated_at = now();
end $$;
grant execute on function public.mg_submit_score(text, int, jsonb) to authenticated;

-- ---------- puzzles and bot crowns (kept in the rating row's "extra") ----------
create or replace function public.mg_save_puzzle(p_rating int, p_n int, p_solved int[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if p_rating < 100 or p_rating > 3200 or p_n < 0 or p_n > 100000 then raise exception 'bad rating'; end if;
  insert into public.mg_ratings (user_id, game, rating, games, peak, extra)
  values (auth.uid(), 'puzzle', p_rating, p_n, p_rating, jsonb_build_object('solved', to_jsonb(coalesce(p_solved, '{}'::int[]))))
  on conflict (user_id, game) do update
    set rating = excluded.rating, games = excluded.games, peak = greatest(public.mg_ratings.peak, excluded.rating),
        extra = excluded.extra, updated_at = now();
end $$;
grant execute on function public.mg_save_puzzle(int, int, int[]) to authenticated;

create or replace function public.mg_save_extra(p_game text, p_extra jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if p_game not in ('chess', 'checkers') then raise exception 'unknown game'; end if;
  if pg_column_size(p_extra) > 4000 then raise exception 'too big'; end if;
  insert into public.mg_ratings (user_id, game, extra) values (auth.uid(), p_game, p_extra)
  on conflict (user_id, game) do update set extra = excluded.extra, updated_at = now();
end $$;
grant execute on function public.mg_save_extra(text, jsonb) to authenticated;

-- ---------- leaderboards ----------
drop function if exists public.mg_leaderboard(text, int);
create or replace function public.mg_leaderboard(p_game text, p_limit int default 50)
returns table (username text, rank text, rating int, games int, wins int, losses int, draws int)
language sql stable security definer set search_path = public as $$
  select p.username, p.rank, r.rating, r.games, r.wins, r.losses, r.draws
    from public.mg_ratings r join public.profiles p on p.id = r.user_id
   where r.game = p_game and r.games >= (case when p_game = 'puzzle' then 3 else 5 end)
     and (p.mg_banned_until is null or p.mg_banned_until < now())
   order by r.rating desc, r.games desc
   limit least(greatest(p_limit, 1), 200);
$$;
grant execute on function public.mg_leaderboard(text, int) to anon, authenticated;

drop function if exists public.mg_score_board(text, int);
create or replace function public.mg_score_board(p_game text, p_limit int default 50)
returns table (username text, rank text, score int)
language sql stable security definer set search_path = public as $$
  select p.username, p.rank, s.score
    from public.mg_scores s join public.profiles p on p.id = s.user_id
   where s.game = p_game and s.score > 0
   order by s.score desc, s.updated_at
   limit least(greatest(p_limit, 1), 200);
$$;
grant execute on function public.mg_score_board(text, int) to anon, authenticated;

-- ---------- matchmaking ----------
create table if not exists public.mg_queue (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  game text not null check (game in ('chess', 'checkers')),
  base_s int not null check (base_s between 60 and 5400),
  inc_s int not null check (inc_s between 0 and 60),
  rating int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mg_queue enable row level security;
revoke all on public.mg_queue from anon, authenticated;
grant select on public.mg_queue to authenticated;
drop policy if exists "queue is visible to friends" on public.mg_queue;
create policy "queue is visible to friends" on public.mg_queue for select to authenticated
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));

-- ---------- games and moves ----------
create table if not exists public.mg_games (
  id uuid primary key default gen_random_uuid(),
  game text not null check (game in ('chess', 'checkers')),
  p0 uuid not null references public.profiles(id) on delete cascade,
  p1 uuid not null references public.profiles(id) on delete cascade,
  p0_name text not null,
  p1_name text not null,
  p0_rating int not null,
  p1_rating int not null,
  base_s int not null,
  inc_s int not null,
  rated boolean not null default true,
  status text not null default 'live' check (status in ('live', 'done', 'disputed')),
  turn smallint not null default 0 check (turn in (0, 1)),
  plies int not null default 0,
  p0_ms bigint not null,
  p1_ms bigint not null,
  turn_at timestamptz not null default now(),
  draw_offer smallint check (draw_offer in (0, 1)),
  result text check (result in ('1-0', '0-1', '1/2-1/2')),
  reason text,
  p0_report text,
  p1_report text,
  report_at timestamptz,
  p0_delta int,
  p1_delta int,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists mg_games_live on public.mg_games (game, status, plies desc);
create index if not exists mg_games_p0 on public.mg_games (p0, finished_at desc);
create index if not exists mg_games_p1 on public.mg_games (p1, finished_at desc);
alter table public.mg_games enable row level security;
revoke all on public.mg_games from anon, authenticated;
grant select on public.mg_games to authenticated;
drop policy if exists "games can be watched" on public.mg_games;
create policy "games can be watched" on public.mg_games for select to authenticated using (true);

create table if not exists public.mg_moves (
  game_id uuid not null references public.mg_games(id) on delete cascade,
  ply int not null,
  mv text not null,
  ms int not null default 0,
  blur_ms int not null default 0,
  blurs int not null default 0,
  created_at timestamptz not null default now(),
  primary key (game_id, ply)
);
alter table public.mg_moves enable row level security;
revoke all on public.mg_moves from anon, authenticated;
grant select on public.mg_moves to authenticated;
drop policy if exists "moves can be watched" on public.mg_moves;
create policy "moves can be watched" on public.mg_moves for select to authenticated using (true);

create table if not exists public.mg_chat (
  id bigserial primary key,
  game_id uuid not null references public.mg_games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists mg_chat_game on public.mg_chat (game_id, id);
alter table public.mg_chat enable row level security;
revoke all on public.mg_chat from anon, authenticated;
grant select on public.mg_chat to authenticated;
drop policy if exists "game chat can be read" on public.mg_chat;
create policy "game chat can be read" on public.mg_chat for select to authenticated using (true);

-- Finishes a game and updates ratings. Only other functions here call it.
create or replace function public.mg_finish(p_id uuid, p_result text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare g public.mg_games; s0 numeric; s1 numeric; ra public.mg_ratings; rb public.mg_ratings; a record; b record;
begin
  select * into g from public.mg_games where id = p_id for update;
  if not found or g.status <> 'live' then return; end if;
  if p_result not in ('1-0', '0-1', '1/2-1/2') then p_result := '1/2-1/2'; end if;
  s0 := case p_result when '1-0' then 1 when '0-1' then 0 else 0.5 end;
  s1 := 1 - s0;
  if g.rated and g.plies >= 4 then
    insert into public.mg_ratings (user_id, game) values (g.p0, g.game), (g.p1, g.game) on conflict do nothing;
    select * into ra from public.mg_ratings where user_id = g.p0 and game = g.game;
    select * into rb from public.mg_ratings where user_id = g.p1 and game = g.game;
    select * into a from public.mg_next_rating(ra.rating, ra.games, ra.sum_opp, ra.pts, rb.rating, s0);
    select * into b from public.mg_next_rating(rb.rating, rb.games, rb.sum_opp, rb.pts, ra.rating, s1);
    update public.mg_ratings set rating = a.nr, games = a.nn, sum_opp = a.nsum, pts = a.npts, peak = greatest(peak, a.nr),
      wins = wins + (s0 = 1)::int, losses = losses + (s0 = 0)::int, draws = draws + (s0 = 0.5)::int, updated_at = now()
      where user_id = g.p0 and game = g.game;
    update public.mg_ratings set rating = b.nr, games = b.nn, sum_opp = b.nsum, pts = b.npts, peak = greatest(peak, b.nr),
      wins = wins + (s1 = 1)::int, losses = losses + (s1 = 0)::int, draws = draws + (s1 = 0.5)::int, updated_at = now()
      where user_id = g.p1 and game = g.game;
    update public.mg_games set p0_delta = a.nr - ra.rating, p1_delta = b.nr - rb.rating where id = p_id;
  end if;
  update public.mg_games set status = 'done', result = p_result, reason = left(p_reason, 24), finished_at = now(), draw_offer = null where id = p_id;
end $$;
revoke all on function public.mg_finish(uuid, text, text) from public, anon, authenticated;

create or replace function public.mg_start_game(p_game text, p_a uuid, p_b uuid, p_base int, p_inc int) returns uuid
language plpgsql security definer set search_path = public as $$
declare gid uuid; w uuid; bl uuid; wr int; br int; wn text; bn text;
begin
  if random() < 0.5 then w := p_a; bl := p_b; else w := p_b; bl := p_a; end if;
  select coalesce((select rating from public.mg_ratings where user_id = w and game = p_game), 1200) into wr;
  select coalesce((select rating from public.mg_ratings where user_id = bl and game = p_game), 1200) into br;
  select username into wn from public.profiles where id = w;
  select username into bn from public.profiles where id = bl;
  insert into public.mg_games (game, p0, p1, p0_name, p1_name, p0_rating, p1_rating, base_s, inc_s, p0_ms, p1_ms)
  values (p_game, w, bl, wn, bn, wr, br, p_base, p_inc, p_base * 1000, p_base * 1000) returning id into gid;
  delete from public.mg_queue where user_id in (p_a, p_b);
  return gid;
end $$;
revoke all on function public.mg_start_game(text, uuid, uuid, int, int) from public, anon, authenticated;

-- Join the queue, or get paired if someone fitting is waiting. Call it every couple of seconds until it returns a game id.
create or replace function public.mg_find_match(p_game text, p_base int, p_inc int) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); gid uuid; myr int; opp record; banned timestamptz;
begin
  if me is null then raise exception 'sign in first'; end if;
  if p_game not in ('chess', 'checkers') then raise exception 'unknown game'; end if;
  if p_base not between 60 and 5400 or p_inc not between 0 and 60 then raise exception 'bad time control'; end if;
  select mg_banned_until into banned from public.profiles where id = me;
  if banned is not null and banned > now() then raise exception 'Rated play is paused on your account while a fair-play review finishes'; end if;
  select id into gid from public.mg_games where status = 'live' and (p0 = me or p1 = me) order by created_at desc limit 1;
  if gid is not null then delete from public.mg_queue where user_id = me; return gid; end if;
  select coalesce((select rating from public.mg_ratings where user_id = me and game = p_game), 1200) into myr;
  select q.* into opp from public.mg_queue q
   where q.game = p_game and q.base_s = p_base and q.inc_s = p_inc and q.user_id <> me
     and q.updated_at > now() - interval '30 seconds'
     and abs(q.rating - myr) <= least(1200, 150 + 30 * extract(epoch from (now() - q.created_at)))
   order by abs(q.rating - myr), q.created_at limit 1 for update skip locked;
  if found then
    return public.mg_start_game(p_game, me, opp.user_id, p_base, p_inc);
  end if;
  insert into public.mg_queue (user_id, game, base_s, inc_s, rating) values (me, p_game, p_base, p_inc, myr)
  on conflict (user_id) do update
    set created_at = case when public.mg_queue.game = excluded.game and public.mg_queue.base_s = excluded.base_s and public.mg_queue.inc_s = excluded.inc_s
                          then public.mg_queue.created_at else now() end,
        game = excluded.game, base_s = excluded.base_s, inc_s = excluded.inc_s, rating = excluded.rating, updated_at = now();
  return null;
end $$;
grant execute on function public.mg_find_match(text, int, int) to authenticated;

create or replace function public.mg_leave_queue() returns void
language sql security definer set search_path = public as $$ delete from public.mg_queue where user_id = auth.uid(); $$;
grant execute on function public.mg_leave_queue() to authenticated;

-- A friend is searching for a match: take it.
create or replace function public.mg_join_friend(p_friend uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); q public.mg_queue; banned timestamptz;
begin
  if me is null then raise exception 'sign in first'; end if;
  if not public.are_friends(me, p_friend) then raise exception 'not friends'; end if;
  select mg_banned_until into banned from public.profiles where id = me;
  if banned is not null and banned > now() then raise exception 'Rated play is paused on your account while a fair-play review finishes'; end if;
  select * into q from public.mg_queue where user_id = p_friend and updated_at > now() - interval '30 seconds' for update;
  if not found then raise exception 'Your friend is not searching any more'; end if;
  if exists (select 1 from public.mg_games where status = 'live' and (p0 = me or p1 = me)) then raise exception 'finish your game first'; end if;
  return public.mg_start_game(q.game, me, p_friend, q.base_s, q.inc_s);
end $$;
grant execute on function public.mg_join_friend(uuid) to authenticated;

create or replace function public.mg_my_game() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.mg_games where status = 'live' and (p0 = auth.uid() or p1 = auth.uid()) order by created_at desc limit 1;
$$;
grant execute on function public.mg_my_game() to authenticated;

-- ---------- playing ----------
-- The server only keeps order and the clock. The rules are checked by both players' games (each one checks the other's moves).
create or replace function public.mg_move(p_game uuid, p_ply int, p_move text, p_blur_ms int default 0, p_blurs int default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); g public.mg_games; side smallint; remain bigint; elapsed bigint; after_ms bigint;
begin
  select * into g from public.mg_games where id = p_game for update;
  if not found then raise exception 'no such game'; end if;
  if g.status <> 'live' then raise exception 'game is over'; end if;
  side := case when me = g.p0 then 0 when me = g.p1 then 1 else null end;
  if side is null then raise exception 'not your game'; end if;
  if g.turn <> side then raise exception 'not your turn'; end if;
  if p_ply <> g.plies + 1 then raise exception 'out of sync'; end if;
  if g.game = 'chess' and p_move !~ '^[a-h][1-8][a-h][1-8][qrbn]?$' then raise exception 'bad move'; end if;
  if g.game = 'checkers' and p_move !~ '^[0-9]{1,2}([-x][0-9]{1,2})+$' then raise exception 'bad move'; end if;
  elapsed := (extract(epoch from (now() - g.turn_at)) * 1000)::bigint;
  remain := case side when 0 then g.p0_ms else g.p1_ms end;
  if g.plies >= 2 then
    if elapsed >= remain then
      perform public.mg_finish(p_game, case side when 0 then '0-1' else '1-0' end, 'timeout');
      return jsonb_build_object('over', true, 'reason', 'timeout');
    end if;
    after_ms := remain - elapsed + g.inc_s * 1000;
  else
    after_ms := remain;
  end if;
  insert into public.mg_moves (game_id, ply, mv, ms, blur_ms, blurs)
  values (p_game, p_ply, p_move, least(elapsed, 3600000)::int, greatest(0, least(coalesce(p_blur_ms, 0), 3600000)), greatest(0, least(coalesce(p_blurs, 0), 1000)));
  update public.mg_games set plies = p_ply, turn = 1 - side, turn_at = now(),
         p0_ms = case when side = 0 then after_ms else p0_ms end,
         p1_ms = case when side = 1 then after_ms else p1_ms end,
         draw_offer = case when draw_offer is not null and draw_offer = side then draw_offer else null end,
         p0_report = null, p1_report = null, report_at = null
   where id = p_game;
  return jsonb_build_object('over', false);
end $$;
grant execute on function public.mg_move(uuid, int, text, int, int) to authenticated;

create or replace function public.mg_resign(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g public.mg_games;
begin
  select * into g from public.mg_games where id = p_game for update;
  if not found or g.status <> 'live' then return; end if;
  if auth.uid() = g.p0 then perform public.mg_finish(p_game, '0-1', 'resign');
  elsif auth.uid() = g.p1 then perform public.mg_finish(p_game, '1-0', 'resign');
  else raise exception 'not your game'; end if;
end $$;
grant execute on function public.mg_resign(uuid) to authenticated;

-- Leave before anyone has really started: nobody is rated.
create or replace function public.mg_abort(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g public.mg_games;
begin
  select * into g from public.mg_games where id = p_game for update;
  if not found or g.status <> 'live' then return; end if;
  if auth.uid() not in (g.p0, g.p1) then raise exception 'not your game'; end if;
  if g.plies >= 2 then raise exception 'too late to abort, resign instead'; end if;
  update public.mg_games set status = 'done', result = '1/2-1/2', reason = 'aborted', rated = false, finished_at = now() where id = p_game;
end $$;
grant execute on function public.mg_abort(uuid) to authenticated;

-- The player who is NOT on move can claim the win when the other one's clock has run out.
create or replace function public.mg_claim_timeout(p_game uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare g public.mg_games; me uuid := auth.uid(); remain bigint; elapsed bigint;
begin
  select * into g from public.mg_games where id = p_game for update;
  if not found or g.status <> 'live' then return false; end if;
  if me not in (g.p0, g.p1) then raise exception 'not your game'; end if;
  if g.plies < 2 then return false; end if;
  if (g.turn = 0 and me = g.p0) or (g.turn = 1 and me = g.p1) then return false; end if;
  elapsed := (extract(epoch from (now() - g.turn_at)) * 1000)::bigint;
  remain := case g.turn when 0 then g.p0_ms else g.p1_ms end;
  if elapsed < remain then return false; end if;
  perform public.mg_finish(p_game, case g.turn when 0 then '0-1' else '1-0' end, 'timeout');
  return true;
end $$;
grant execute on function public.mg_claim_timeout(uuid) to authenticated;

create or replace function public.mg_offer_draw(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g public.mg_games; side smallint;
begin
  select * into g from public.mg_games where id = p_game for update;
  if not found or g.status <> 'live' then return; end if;
  side := case when auth.uid() = g.p0 then 0 when auth.uid() = g.p1 then 1 else null end;
  if side is null then raise exception 'not your game'; end if;
  if g.plies < 2 then raise exception 'play a few moves first'; end if;
  if g.draw_offer is null then update public.mg_games set draw_offer = side where id = p_game; end if;
end $$;
grant execute on function public.mg_offer_draw(uuid) to authenticated;

create or replace function public.mg_answer_draw(p_game uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare g public.mg_games; side smallint;
begin
  select * into g from public.mg_games where id = p_game for update;
  if not found or g.status <> 'live' then return; end if;
  side := case when auth.uid() = g.p0 then 0 when auth.uid() = g.p1 then 1 else null end;
  if side is null then raise exception 'not your game'; end if;
  if g.draw_offer is null or g.draw_offer = side then return; end if;
  if p_accept then perform public.mg_finish(p_game, '1/2-1/2', 'agreed');
  else update public.mg_games set draw_offer = null where id = p_game; end if;
end $$;
grant execute on function public.mg_answer_draw(uuid, boolean) to authenticated;

-- A game that ends by the rules (mate, stalemate, repetition...): both players' games say how it ended.
-- If they agree it is final. If they disagree it is "disputed" and nobody is rated. If the other player stays silent
-- for 20 seconds and makes no move, call mg_settle and the report stands.
create or replace function public.mg_report_result(p_game uuid, p_result text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare g public.mg_games; side smallint; mine text; theirs text;
begin
  if p_result not in ('1-0', '0-1', '1/2-1/2') then raise exception 'bad result'; end if;
  if p_reason !~ '^[a-z-]{3,20}$' then raise exception 'bad reason'; end if;
  select * into g from public.mg_games where id = p_game for update;
  if not found or g.status <> 'live' then return; end if;
  side := case when auth.uid() = g.p0 then 0 when auth.uid() = g.p1 then 1 else null end;
  if side is null then raise exception 'not your game'; end if;
  mine := p_result || '|' || p_reason;
  if side = 0 then update public.mg_games set p0_report = mine, report_at = coalesce(report_at, now()) where id = p_game;
  else update public.mg_games set p1_report = mine, report_at = coalesce(report_at, now()) where id = p_game; end if;
  theirs := case side when 0 then g.p1_report else g.p0_report end;
  if theirs is null then return; end if;
  if split_part(theirs, '|', 1) = p_result then
    perform public.mg_finish(p_game, p_result, split_part(mine, '|', 2));
  else
    update public.mg_games set status = 'disputed', rated = false, finished_at = now() where id = p_game;
  end if;
end $$;
grant execute on function public.mg_report_result(uuid, text, text) to authenticated;

create or replace function public.mg_settle(p_game uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare g public.mg_games; rep text;
begin
  select * into g from public.mg_games where id = p_game for update;
  if not found or g.status <> 'live' then return false; end if;
  if auth.uid() not in (g.p0, g.p1) then raise exception 'not your game'; end if;
  rep := coalesce(g.p0_report, g.p1_report);
  if rep is null or g.report_at is null or g.report_at > now() - interval '20 seconds' then return false; end if;
  if g.p0_report is not null and g.p1_report is not null then return false; end if;
  perform public.mg_finish(p_game, split_part(rep, '|', 1), split_part(rep, '|', 2));
  return true;
end $$;
grant execute on function public.mg_settle(uuid) to authenticated;

-- Chat between the two players (anyone watching can read it, only the players can write)
create or replace function public.mg_say(p_game uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare g public.mg_games; t text := btrim(coalesce(p_body, ''));
begin
  if char_length(t) = 0 or char_length(t) > 200 then raise exception 'bad message'; end if;
  select * into g from public.mg_games where id = p_game;
  if not found or auth.uid() not in (g.p0, g.p1) then raise exception 'not your game'; end if;
  if (select count(*) from public.mg_chat where user_id = auth.uid() and created_at > now() - interval '10 seconds') >= 6 then raise exception 'slow down'; end if;
  insert into public.mg_chat (game_id, user_id, body) values (p_game, auth.uid(), t);
end $$;
grant execute on function public.mg_say(uuid, text) to authenticated;

-- ---------- fair play ----------
create table if not exists public.mg_fairplay (
  id bigserial primary key,
  game_id uuid not null references public.mg_games(id) on delete cascade,
  target uuid not null references public.profiles(id) on delete cascade,
  reporter uuid not null references public.profiles(id) on delete cascade,
  level text not null check (level in ('watch', 'review')),
  score int not null check (score between 0 and 100),
  signals jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open', 'cleared', 'confirmed')),
  note text,
  created_at timestamptz not null default now(),
  unique (game_id, target, reporter)
);
alter table public.mg_fairplay enable row level security;
revoke all on public.mg_fairplay from anon, authenticated;

-- After a game each player's game checks the other one's moves with the engine and files the result here.
-- Only "review" results need a human; nobody is penalised automatically.
create or replace function public.mg_report_fairplay(p_game uuid, p_level text, p_score int, p_signals jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare g public.mg_games; tgt uuid;
begin
  if p_level not in ('watch', 'review') then raise exception 'bad level'; end if;
  select * into g from public.mg_games where id = p_game;
  if not found or g.status <> 'done' or auth.uid() not in (g.p0, g.p1) then raise exception 'not your game'; end if;
  tgt := case when auth.uid() = g.p0 then g.p1 else g.p0 end;
  if pg_column_size(p_signals) > 3000 then p_signals := '[]'::jsonb; end if;
  insert into public.mg_fairplay (game_id, target, reporter, level, score, signals) values (p_game, tgt, auth.uid(), p_level, greatest(0, least(100, p_score)), p_signals)
  on conflict (game_id, target, reporter) do nothing;
end $$;
grant execute on function public.mg_report_fairplay(uuid, text, int, jsonb) to authenticated;

drop function if exists public.mg_list_fairplay(text);
create or replace function public.mg_list_fairplay(p_status text default 'open')
returns table (id bigint, game_id uuid, game text, target_name text, reporter_name text, level text, score int, signals jsonb, status text, note text, created_at timestamptz, previous_reviews bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  return query
    select f.id, f.game_id, g.game, t.username, r.username, f.level, f.score, f.signals, f.status, f.note, f.created_at,
           (select count(*) from public.mg_fairplay o where o.target = f.target and o.id <> f.id and o.level = 'review')
      from public.mg_fairplay f
      join public.mg_games g on g.id = f.game_id
      join public.profiles t on t.id = f.target
      join public.profiles r on r.id = f.reporter
     where f.status = p_status and f.level = 'review'
     order by f.score desc, f.created_at desc limit 100;
end $$;
grant execute on function public.mg_list_fairplay(text) to authenticated;

-- 'clear' dismisses the report. 'confirm' pauses rated play for that many days. Staff only.
create or replace function public.mg_resolve_fairplay(p_id bigint, p_action text, p_days int default 7, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare f public.mg_fairplay;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  select * into f from public.mg_fairplay where id = p_id;
  if not found then raise exception 'no such report'; end if;
  if p_action = 'clear' then
    update public.mg_fairplay set status = 'cleared', note = left(p_note, 200) where id = p_id;
  elsif p_action = 'confirm' then
    update public.mg_fairplay set status = 'confirmed', note = left(p_note, 200) where id = p_id;
    update public.profiles set mg_banned_until = now() + (greatest(1, least(p_days, 365)) || ' days')::interval where id = f.target and lower(username) <> 'master';
  else raise exception 'unknown action'; end if;
end $$;
grant execute on function public.mg_resolve_fairplay(bigint, text, int, text) to authenticated;

-- ---------- friends can see you are searching / playing ----------
create or replace function public.set_presence(p_server text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then return; end if;
  if p_server is null or btrim(p_server) = '' then
    delete from public.friend_presence where user_id = me;
    return;
  end if;
  if p_server !~ '^p2p:[a-z0-9]{8,32}$'
     and p_server !~ '^mgq:(chess|checkers)$'
     and p_server !~ '^mg:(chess|checkers):[0-9a-f-]{36}$'
     and p_server !~ '^(wss?://)?[A-Za-z0-9.-]+(:[0-9]{1,5})?(/[A-Za-z0-9._~/-]*)?$' then return; end if;
  insert into public.friend_presence (user_id, server) values (me, p_server)
  on conflict (user_id) do update set server = excluded.server, updated_at = now();
exception when others then
  return;
end $$;
grant execute on function public.set_presence(text) to authenticated;

-- Old finished games and stale queue rows go away
create or replace function public.mg_prune() returns void
language sql security definer set search_path = public as $$
  delete from public.mg_queue where updated_at < now() - interval '2 minutes';
  delete from public.mg_games where status <> 'live' and finished_at < now() - interval '90 days';
  delete from public.mg_games where status = 'live' and turn_at < now() - interval '3 days';
  delete from public.mg_fairplay where status <> 'open' and created_at < now() - interval '90 days';
$$;
grant execute on function public.mg_prune() to authenticated;

-- ######################################################################################
-- PART: indev37_1_new.sql
-- ######################################################################################

-- ======================================================================================================
-- Indev 37.1: rank badges in the games.
-- Leaderboards and game screens can now show each player's badges (OWNER, HELPER, MOD, OG, YOUTUBE, Vanguard, Elite, Champion).
-- Safe to run again. Until it is run, the games still work, just without other players' badges.
-- ======================================================================================================

-- Leaderboards now also return the extra badge columns.
drop function if exists public.mg_leaderboard(text, int);
create or replace function public.mg_leaderboard(p_game text, p_limit int default 50)
returns table (username text, rank text, rating int, games int, wins int, losses int, draws int, staff text, special text, og boolean, owner boolean)
language sql stable security definer set search_path = public as $$
  select p.username,
         case when coalesce(p.undercover, false) then 'none' else p.rank end,
         r.rating, r.games, r.wins, r.losses, r.draws,
         p.staff,
         case when coalesce(p.undercover, false) then null else p.special end,
         case when coalesce(p.undercover, false) then false else coalesce(p.og, false) end,
         lower(p.username) = 'master'
    from public.mg_ratings r join public.profiles p on p.id = r.user_id
   where r.game = p_game and r.games >= (case when p_game = 'puzzle' then 3 else 5 end)
     and (p.mg_banned_until is null or p.mg_banned_until < now())
   order by r.rating desc, r.games desc
   limit least(greatest(p_limit, 1), 200);
$$;
grant execute on function public.mg_leaderboard(text, int) to anon, authenticated;

drop function if exists public.mg_score_board(text, int);
create or replace function public.mg_score_board(p_game text, p_limit int default 50)
returns table (username text, rank text, score int, staff text, special text, og boolean, owner boolean)
language sql stable security definer set search_path = public as $$
  select p.username,
         case when coalesce(p.undercover, false) then 'none' else p.rank end,
         s.score,
         p.staff,
         case when coalesce(p.undercover, false) then null else p.special end,
         case when coalesce(p.undercover, false) then false else coalesce(p.og, false) end,
         lower(p.username) = 'master'
    from public.mg_scores s join public.profiles p on p.id = s.user_id
   where s.game = p_game and s.score > 0
   order by s.score desc, s.updated_at
   limit least(greatest(p_limit, 1), 200);
$$;
grant execute on function public.mg_score_board(text, int) to anon, authenticated;

-- The badges of a few players (the two players of a game). /undercover hides the rank, OG and special badges, as everywhere else.
drop function if exists public.mg_player_badges(uuid[]);
create or replace function public.mg_player_badges(p_ids uuid[])
returns table (user_id uuid, rank text, staff text, special text, og boolean, owner boolean)
language sql stable security definer set search_path = public as $$
  select p.id,
         case when coalesce(p.undercover, false) then 'none' else p.rank end,
         p.staff,
         case when coalesce(p.undercover, false) then null else p.special end,
         case when coalesce(p.undercover, false) then false else coalesce(p.og, false) end,
         lower(p.username) = 'master'
    from public.profiles p
   where p.id = any (p_ids)
   limit 10;
$$;
grant execute on function public.mg_player_badges(uuid[]) to anon, authenticated;
