#!/bin/sh
# Builds vibeblox_all.sql (every SQL file in order). Run from the server folder.
cd "$(dirname "$0")"
{ cat <<'HDR'
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

HDR
for f in supabase_social vibeblox_round13 vibeblox_round16 vibeblox_round17 vibeblox_round18 vibeblox_round19 vibeblox_round20 vibeblox_round21 vibeblox_indev27 vibeblox_indev27_1 vibeblox_indev28 vibeblox_indev29 vibeblox_indev30 vibeblox_indev32 vibeblox_indev36 indev37_new indev37_1_new; do
  printf '\n-- ######################################################################################\n-- PART: %s.sql\n-- ######################################################################################\n\n' "$f"
  cat $f.sql
done; } > vibeblox_all.sql

# Indev 37 / 37.1: the one file to run if you have not run Indev 36 yet (Indev 36 + the new parts)
{ cat <<'HDR'
-- VibeBlox Indev 37.1 (cumulative): Indev 36 (several ranks, command blocks...) + edit/delete/report messages + MINIGAMES + rank badges in the games.
-- Run this once in the Supabase SQL editor. Safe to run again. If you already ran vibeblox_all.sql up to Indev 32 this still works.
HDR
cat vibeblox_indev36.sql; printf '\n'; cat indev37_new.sql; printf '\n'; cat indev37_1_new.sql; } > vibeblox_indev37.sql
