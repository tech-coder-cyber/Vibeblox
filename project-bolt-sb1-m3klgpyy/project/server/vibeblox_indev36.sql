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
