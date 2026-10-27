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
