// Ranks and what they unlock. Ranks aren't on sale yet ("Coming Soon!"), so everyone is 'none' for now.
// The rank itself lives in the database (profiles.rank, only the owner / the store can set it).
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

/** The rank that counts: the one the database gave your account (the owner is always Champion). Guests have none. */
export function effectiveRank(account: { username: string; rank?: string } | null | undefined, isOwner = false): RankId {
  if (isOwner) return 'champion';
  const r = account?.rank;
  if (r === 'vanguard' || r === 'elite' || r === 'champion') return r;
  return account ? 'none' : readRank();
}

// ---- Rising Creator: 1000 plays on your worlds ----
/** How many players can be in your world at once. */
export const PLAYER_CAP = { normal: 18, rising: 24 };
export const playerCap = (rising: boolean) => (rising ? PLAYER_CAP.rising : PLAYER_CAP.normal);

/** Milliseconds of CPU a script may use per tick (a tick is 4 times a second) before it is switched off. */
export const SCRIPT_BUDGET_MS: Record<RankId, number> = { none: 8, vanguard: 15, elite: 25, champion: 75 };
/** Rising Creators get a bit more on top of their rank. */
export const RISING_BUDGET_FACTOR = 1.5;
export function scriptBudgetMs(rank: RankId, rising: boolean): number {
  const base = SCRIPT_BUDGET_MS[rank] ?? SCRIPT_BUDGET_MS.none;
  return Math.round(rising ? base * RISING_BUDGET_FACTOR : base);
}

/** Only Champions may upload their own skin. */
export const canUploadSkin = (rank: RankId) => rank === 'champion';
