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
export function effectiveRank(account: { username: string; rank?: string; rankUntil?: string | null } | null | undefined, isOwner = false): RankId {
  if (isOwner) return 'champion';
  if (account?.rankUntil && Date.parse(account.rankUntil) <= Date.now()) return 'none'; // a temporary rank that ran out
  const r = account?.rank;
  if (r === 'vanguard' || r === 'elite' || r === 'champion') return r;
  return account ? 'none' : readRank();
}

// ---- Creator tiers: plays on your worlds (Rising 1,000 · Popular 10,000 · Star 100,000) ----
export type CreatorTier = 'none' | 'rising' | 'popular' | 'star';
export const CREATOR_PLAYS: Record<Exclude<CreatorTier, 'none'>, number> = { rising: 1_000, popular: 10_000, star: 100_000 };
export const CREATOR_NAMES: Record<CreatorTier, string> = { none: '', rising: 'Rising Creator', popular: 'Popular Creator', star: 'Star Creator' };
/** The tag colour codes for each tier (see fancytext.tsx). */
export const CREATOR_TAGS: Record<CreatorTier, string> = {
  none: '',
  rising: '\\green\\[Rising Creator]\\reset\\',
  popular: '\\gold\\\\shiny\\[Popular Creator]\\reset\\',
  star: '\\rainbow\\\\bold\\[Star Creator]\\reset\\',
};
export function creatorTier(plays: number): CreatorTier {
  const p = Number(plays) || 0;
  return p >= CREATOR_PLAYS.star ? 'star' : p >= CREATOR_PLAYS.popular ? 'popular' : p >= CREATOR_PLAYS.rising ? 'rising' : 'none';
}
const TIER_ORDER: CreatorTier[] = ['none', 'rising', 'popular', 'star'];
export const tierAtLeast = (t: CreatorTier, min: CreatorTier) => TIER_ORDER.indexOf(t) >= TIER_ORDER.indexOf(min);
/** How many players can be in your world at once (bigger for bigger creators). */
export const PLAYER_CAP: Record<CreatorTier, number> = { none: 18, rising: 24, popular: 32, star: 48 };
export const playerCap = (tier: CreatorTier | boolean) => PLAYER_CAP[tier === true ? 'rising' : tier === false ? 'none' : tier];

/** The tags shown in front of a name for the things the game itself knows (owner, staff, paid rank, OG, creator tier). */
export const OWNER_TAG = '\\crimson\\\\bold\\[OWNER]\\reset\\';
export const OG_TAG = '\\orange\\\\shiny\\[OG]\\reset\\';
export type StaffId = 'helper' | 'mod';
export const STAFF_TAGS: Record<StaffId, string> = {
  helper: '\\mint\\\\bold\\[HELPER]\\reset\\',
  mod: '\\cyan\\\\bold\\[MOD]\\reset\\',
};
export const isStaffId = (v: unknown): v is StaffId => v === 'helper' || v === 'mod';

/**
 * The rank whose perks you get. OG players and staff (HELPER, MOD) get Elite's perks (a bigger planet limit, more script
 * time, no ads); a paid rank that is better than Elite still counts. The name tag shows the real rank, not this one.
 */
export function perkRank(rank: RankId, extra: { og?: boolean; staff?: string | null } | null | undefined): RankId {
  if (rank === 'champion') return rank;
  return extra && (extra.og || isStaffId(extra.staff)) ? 'elite' : rank;
}
export const RANK_TAGS: Record<RankId, string> = {
  none: '',
  vanguard: '\\aqua\\[Vanguard]\\reset\\',
  elite: '\\light_purple\\[Elite]\\reset\\',
  champion: '\\gold\\\\shiny\\[Champion]\\reset\\',
};
export type Badge = { owner?: boolean; rank?: RankId | string; tier?: CreatorTier | string; og?: boolean; staff?: StaffId | string | null };
export function badgeTags(b: Badge | null | undefined): string[] {
  if (!b) return [];
  const out: string[] = [];
  if (b.owner) out.push(OWNER_TAG);
  if (isStaffId(b.staff)) out.push(STAFF_TAGS[b.staff]);
  const r = b.rank as RankId;
  if (r && RANK_TAGS[r]) out.push(RANK_TAGS[r]);
  if (b.og) out.push(OG_TAG);
  const t = b.tier as CreatorTier;
  if (t && CREATOR_TAGS[t]) out.push(CREATOR_TAGS[t]);
  return out;
}

/** Any rank (paid, owner) or being a Star Creator means no ads, ever. */
export function adsAllowedFor(rank: RankId | string | undefined | null, isOwner = false): boolean {
  return !isOwner && !(rank === 'vanguard' || rank === 'elite' || rank === 'champion');
}

/** Milliseconds of CPU a script may use per tick (a tick is 4 times a second) before it is switched off. */
export const SCRIPT_BUDGET_MS: Record<RankId, number> = { none: 8, vanguard: 15, elite: 25, champion: 75 };
/** Rising Creators get a bit more on top of their rank. */
export const RISING_BUDGET_FACTOR = 1.5;
/** More on top for Popular (x2) and Star (x2.5) Creators. */
export const TIER_BUDGET_FACTOR: Record<CreatorTier, number> = { none: 1, rising: RISING_BUDGET_FACTOR, popular: 2, star: 2.5 };
export function scriptBudgetMs(rank: RankId, tier: CreatorTier | boolean): number {
  const base = SCRIPT_BUDGET_MS[rank] ?? SCRIPT_BUDGET_MS.none;
  const t: CreatorTier = tier === true ? 'rising' : tier === false ? 'none' : tier;
  return Math.round(base * TIER_BUDGET_FACTOR[t]);
}

/** Only Champions may upload their own skin. */
export const canUploadSkin = (rank: RankId) => rank === 'champion';
