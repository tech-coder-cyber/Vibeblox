-- VibeBlox Indev 37.1 (cumulative): Indev 36 (several ranks, command blocks...) + edit/delete/report messages + MINIGAMES + rank badges in the games.
-- Run this once in the Supabase SQL editor. Safe to run again. If you already ran vibeblox_all.sql up to Indev 32 this still works.
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
