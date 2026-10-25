// Ranks and what they unlock. Ranks aren't on sale yet ("Coming Soon!"), so everyone is 'none' for now.
// The rank itself lives in the database (profiles.rank, only the owner / the store can set it).
export type RankId = 'none' | 'vanguard' | 'elite' | 'champion';

/** How many planets (saved worlds) you can have at once. */
export const WORLD_LIMITS: Record<RankId, number> = { none: 5, vanguard: 8, elite: 10, champion: 15 };
export const RANK_NAMES: Record<RankId, string> = { none: 'No rank', vanguard: 'Vanguard', elite: 'Elite', champion: 'Champion' };

const RANK_ORDER: RankId[] = ['none', 'vanguard', 'elite', 'champion'];
/** Ranks stack: Elite has everything Vanguard has, and Champion has everything Elite has. True if `rank` is `min` or better. */
export const rankAtLeast = (rank: RankId | string | undefined | null, min: RankId): boolean => RANK_ORDER.indexOf((rank as RankId) ?? 'none') >= RANK_ORDER.indexOf(min);
/** Custom menu theme colours: a Vanguard perk (so Elite and Champion get it too). Pass the rank whose perks you get (see perkRank). */
export const canCustomTheme = (perk: RankId | string | undefined | null): boolean => rankAtLeast(perk, 'vanguard');

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

/** The tags shown in front of a name for the things the game itself knows (owner, staff, paid rank, creator tier). */
export const OWNER_TAG = '\\crimson\\\\bold\\[OWNER]\\reset\\';
export type StaffId = 'helper' | 'mod';
export const STAFF_TAGS: Record<StaffId, string> = {
  helper: '\\mint\\\\bold\\[HELPER]\\reset\\',
  mod: '\\gold\\\\bold\\[MOD]\\reset\\',
};
export const isStaffId = (v: unknown): v is StaffId => v === 'helper' || v === 'mod';
/** [OG]: players who were here before it ended. They keep it for good; nobody can earn it any more. */
export const OG_TAG = '\\cyan\\\\shiny\\[OG]\\reset\\';
/** Special ranks the owner gives out by hand ([YOUTUBE] for video makers). They are not staff: no moderation powers. */
export type SpecialId = 'youtube';
export const SPECIAL_TAGS: Record<SpecialId, string> = { youtube: '\\red\\\\bold\\[\\white\\YOUTUBE\\red\\]\\reset\\' };
export const SPECIAL_LABELS: Record<SpecialId, string> = { youtube: 'YOUTUBE' };
export const isSpecialId = (v: unknown): v is SpecialId => v === 'youtube';

/**
 * The rank whose perks you get. OG players and staff (HELPER, MOD) get Elite's perks (a bigger planet limit, more script time,
 * no ads); [YOUTUBE] gets Champion's perks (15 planets, the biggest script budget, your own skin and cape); a paid rank that is
 * better than that still counts. The name tag shows the real rank, not this one.
 */
export function perkRank(rank: RankId, extra: { staff?: string | null; og?: boolean; special?: string | null } | null | undefined): RankId {
  if (rank === 'champion') return rank;
  if (extra && isSpecialId(extra.special)) return 'champion'; // [YOUTUBE] has everything Champion has
  return extra && (isStaffId(extra.staff) || extra.og) ? 'elite' : rank;
}
export const RANK_TAGS: Record<RankId, string> = {
  none: '',
  vanguard: '\\brown\\[Vanguard]\\reset\\',
  elite: '\\cyan\\[Elite]\\reset\\',
  champion: '\\gold\\\\shiny\\[Champion]\\reset\\',
};
export type Badge = { owner?: boolean; rank?: RankId | string; tier?: CreatorTier | string; staff?: StaffId | string | null; og?: boolean; special?: SpecialId | string | null; /** /undercover is on: [YOUTUBE], [OG] and the paid rank are hidden (staff tags and the owner tag never are) */ undercover?: boolean };
export function badgeTags(b: Badge | null | undefined): string[] {
  if (!b) return [];
  const out: string[] = [];
  if (b.owner) out.push(OWNER_TAG);
  if (isStaffId(b.staff)) out.push(STAFF_TAGS[b.staff]);
  const hide = b.undercover === true && !b.owner;
  if (!hide && isSpecialId(b.special)) out.push(SPECIAL_TAGS[b.special]);
  if (!hide && b.og) out.push(OG_TAG);
  const r = b.rank as RankId;
  if (!hide && r && RANK_TAGS[r]) out.push(RANK_TAGS[r]);
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

/** Only Champions (and [YOUTUBE], who has Champion's perks) may upload their own skin. */
export const canUploadSkin = (rank: RankId) => rank === 'champion';
/** ...and their own cape. */
export const canUploadCape = canUploadSkin;
/** [YOUTUBE] may hide their rank tags with /undercover. Nobody else can: not even staff. */
export const canGoUndercover = (special: string | null | undefined) => isSpecialId(special);

/** Questions to the AI helper per day. Champion has no limit. */
export const AI_DAILY_LIMIT: Record<RankId, number> = { none: 10, vanguard: 40, elite: 100, champion: Infinity };
const AI_KEY = 'vb-ai-uses';
const dayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
/** How many AI questions are left today for this rank. */
export function aiLeftToday(rank: RankId, now = Date.now()): number {
  const cap = AI_DAILY_LIMIT[rank] ?? AI_DAILY_LIMIT.none;
  if (cap === Infinity) return Infinity;
  try {
    const v = JSON.parse(localStorage.getItem(AI_KEY) || 'null') as { day: string; n: number } | null;
    return Math.max(0, cap - (v && v.day === dayKey(now) ? v.n : 0));
  } catch { return cap; }
}
export function countAiQuestion(now = Date.now()): void {
  try {
    const v = JSON.parse(localStorage.getItem(AI_KEY) || 'null') as { day: string; n: number } | null;
    localStorage.setItem(AI_KEY, JSON.stringify({ day: dayKey(now), n: (v && v.day === dayKey(now) ? v.n : 0) + 1 }));
  } catch { /* storage blocked */ }
}
