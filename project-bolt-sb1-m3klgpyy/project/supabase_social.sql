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
alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_key on public.profiles (lower(username));

alter table public.profiles add column if not exists username_changed_at timestamptz;
alter table public.profiles add column if not exists rank text not null default 'none';
alter table public.profiles drop constraint if exists profiles_rank_check;
alter table public.profiles add constraint profiles_rank_check check (rank in ('none', 'vanguard', 'elite', 'champion'));

-- ============ The owner ============
-- The owner's username is Master_at_Pvp. Nobody else can ever take that name: it is only given to the account whose
-- email is in this table. Put YOUR sign-up email in it (once), e.g.:
--   insert into public.owner_emails (email) values ('you@example.com') on conflict do nothing;
create table if not exists public.owner_emails (email text primary key);
alter table public.owner_emails enable row level security;
revoke all on public.owner_emails from anon, authenticated;

-- Names nobody but the owner may use
create or replace function public.name_ok(p_name text, p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select lower(p_name) <> 'master_at_pvp'
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

-- The account named "Master_at_Pvp" is the owner: it is always an admin (see is_admin below), and can't be banned.
-- To add more admins, put their VibeBlox usernames here, e.g.:
-- insert into public.admins (username) values ('SomeName') on conflict do nothing;
delete from public.admins where lower(username) = 'master';  -- the owner used to be called Master
insert into public.admins (username) values ('Master_at_Pvp') on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    left join public.admins a on lower(a.username) = lower(p.username)
    where p.id = auth.uid() and (a.username is not null or lower(p.username) = 'master_at_pvp')
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- Is the signed-in account the owner ("Master_at_Pvp")?
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.username) = 'master_at_pvp');
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
alter table public.bans add constraint bans_not_owner check (username <> 'master_at_pvp');

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
create or replace function public.player_standing(p_username text) returns table (plays bigint, rank text, rising boolean)
language sql stable security definer set search_path = public as $$
  select coalesce((select count(*) from public.plays pl where pl.host = p.id), 0)::bigint,
         case when lower(p.username) = 'master_at_pvp' then 'champion' else p.rank end,
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
