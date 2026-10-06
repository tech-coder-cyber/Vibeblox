// Ranks and what they unlock. Ranks aren't on sale yet ("Coming Soon!"), so everyone is 'none' for now.
export type RankId = 'none' | 'vanguard' | 'elite' | 'champion';

/** How many planets (saved worlds) you can have at once. */
export const WORLD_LIMITS: Record<RankId, number> = { none: 5, vanguard: 8, elite: 10, champion: 15 };
export const RANK_NAMES: Record<RankId, string> = { none: 'No rank', vanguard: 'Vanguard', elite: 'Elite', champion: 'Champion' };

export function worldLimit(rank: RankId): number { return WORLD_LIMITS[rank] ?? WORLD_LIMITS.none; }

const KEY = 'vb-rank';
/** The rank on this device. When ranks go on sale, the store should set this (and the server should check it). */
export function readRank(): RankId {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'vanguard' || v === 'elite' || v === 'champion' ? v : 'none';
  } catch { return 'none'; }
}
export function setRank(rank: RankId): void {
  try { localStorage.setItem(KEY, rank); } catch { /* storage blocked */ }
}
