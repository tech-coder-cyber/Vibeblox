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

-- Creates the profile when someone signs up (username from the sign-up form, or the start of their email)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), 'Player'), '[^A-Za-z0-9_]', '', 'g');
  base := left(base, 16);
  if length(base) < 3 then base := 'Player'; end if;
  candidate := base;
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    n := n + 1;
    candidate := left(base, 12) || (floor(random() * 9000) + 1000)::int::text;
    exit when n > 20;
  end loop;
  insert into public.profiles (id, username) values (new.id, candidate) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Accounts that signed up before this script existed
insert into public.profiles (id, username)
select u.id,
       case when length(regexp_replace(split_part(u.email, '@', 1), '[^A-Za-z0-9_]', '', 'g')) >= 3
            then left(regexp_replace(split_part(u.email, '@', 1), '[^A-Za-z0-9_]', '', 'g'), 12) || (floor(random() * 9000) + 1000)::int::text
            else 'Player' || (floor(random() * 9000) + 1000)::int::text end
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

alter table public.profiles enable row level security;
drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select using (true);
drop policy if exists "make your own profile" on public.profiles;
create policy "make your own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "update your own profile" on public.profiles;
create policy "update your own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- Players may only touch last_seen (usernames can not be changed after the fact)
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

create or replace function public.playing_counts() returns table (activity text, players bigint)
language sql stable security definer set search_path = public as $$
  select activity, count(*) from public.presence where last_seen > now() - interval '90 seconds' group by activity;
$$;
grant execute on function public.playing_counts() to anon, authenticated;

-- Let the API see the new tables right away
notify pgrst, 'reload schema';
