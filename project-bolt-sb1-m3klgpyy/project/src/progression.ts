// XP, levels, coins, the 2x XP booster, and owned/equipped cosmetics.
//
// Rules:
//   - 15 XP for every 30 minutes (1800 s) of ACTIVE play: the game window is visible, you're
//     in a world with the menu closed, and you've touched the keyboard/mouse in the last 2 minutes.
//   - Level = floor(sqrt(totalXP / 50)) + 1
//   - Each level up: the "ding" sound and +100 coins.
//   - Rewarded ad: +50 coins, or a 2x booster: 15 minutes of active play count double.
//
// Saving: this is a browser game with no account server, so progress lives on the player's
// device (and in their CrazyGames account on CrazyGames). It is signed so casual edits in
// devtools are rejected, but anything client-side can be cheated by a determined player:
// never let coins buy something with real value. Ranks bought with real money must be
// granted by a server (Tebex webhook), not by this file.
import { CAPES, SKINS, CUSTOM_SKIN_ID, isCustomSkinData, cleanLook, type PlayerLook } from './cosmetics';
import { portalStorage } from './adEconomy';

// ---- Put your links here ----
export const DISCORD_INVITE_URL = 'https://discord.gg/553EGmB8bf';
export const TEBEX_STORE_URL = 'https://YOUR-STORE.tebex.io';

export const XP_PER_PERIOD = 15;
export const SECONDS_PER_PERIOD = 1800;
export const LEVEL_UP_COINS = 100;
export const AD_COINS = 50;
export const BOOSTER_SECONDS = 15 * 60;
export const IDLE_AFTER_SECONDS = 120;
/** Players with a rank never see ads, so they claim the rewards instead, with limits: coins 5 times an hour, the booster once every 15 minutes. */
export const COIN_CLAIMS_PER_HOUR = 5;
export const COIN_CLAIM_WINDOW_MS = 60 * 60 * 1000;
export const BOOSTER_CLAIM_COOLDOWN_MS = 15 * 60 * 1000;
/** Shop prices (coins) */
export const FREEZE_PRICE = 150;
export const BOOSTER_PRICE = 120;
export const MAX_FREEZES = 10;

export function levelForXp(xp: number): number { return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1; }
/** Total XP needed to reach a level (inverse of the formula above). */
export function xpForLevel(level: number): number { return 50 * (level - 1) ** 2; }

export type Progress = {
  coins: number; xp: number; level: number;
  currentSkin: string; currentCape: string;
  ownedSkins: string[]; ownedCapes: string[];
  activeSeconds: number;   // active play not yet turned into XP (0..1799)
  boosterSeconds: number;  // 2x booster time left (counts down with active play only)
  totalActiveSeconds: number;
  /** Free claims (players with a rank, who never see ads): when each of the last coin claims happened, and the last booster claim (ms) */
  coinClaims?: number[];
  boosterClaimAt?: number;
  /** A Champion's own skin (PNG data URL); wearing it means currentSkin is 'custom' */
  customSkin?: string;
  /** Lootboxes waiting to be opened (no limit), and streak freezes (each one saves your daily streak for one missed day) */
  lootboxes?: number;
  freezes?: number;
  /** The daily reward: the last day claimed (YYYY-MM-DD, your own clock), the streak, the best streak and how many days in all */
  daily?: DailyState;
};
export type DailyState = { last: string; streak: number; best: number; total: number };

const KEY = 'vb-progress';
const SALT = 'vibeblox-progress-v1';

function fresh(): Progress {
  return { coins: 0, xp: 0, level: 1, currentSkin: 'classic', currentCape: 'none', ownedSkins: ['classic'], ownedCapes: ['none'], activeSeconds: 0, boosterSeconds: 0, totalActiveSeconds: 0 };
}
function sign(body: string): string {
  let h = 0x811c9dc5; // FNV-1a
  const s = SALT + body + SALT;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
function sanitize(p: Partial<Progress>): Progress {
  const f = fresh();
  const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
  const out: Progress = {
    coins: Math.floor(n(p.coins, 0)), xp: n(p.xp, 0), level: 1,
    currentSkin: f.currentSkin, currentCape: f.currentCape,
    ownedSkins: Array.isArray(p.ownedSkins) ? p.ownedSkins.filter((s) => typeof s === 'string' && SKINS[s]) : [],
    ownedCapes: Array.isArray(p.ownedCapes) ? p.ownedCapes.filter((s) => typeof s === 'string' && CAPES[s]) : [],
    activeSeconds: Math.min(SECONDS_PER_PERIOD, n(p.activeSeconds, 0)),
    boosterSeconds: Math.min(BOOSTER_SECONDS * 20, n(p.boosterSeconds, 0)),
    totalActiveSeconds: n(p.totalActiveSeconds, 0),
  };
  const nowMs = Date.now();
  const claims = Array.isArray(p.coinClaims) ? p.coinClaims.filter((t) => typeof t === 'number' && Number.isFinite(t) && t > nowMs - COIN_CLAIM_WINDOW_MS && t <= nowMs + 60_000).sort((a, b) => a - b).slice(-COIN_CLAIMS_PER_HOUR) : [];
  if (claims.length) out.coinClaims = claims;
  if (typeof p.boosterClaimAt === 'number' && Number.isFinite(p.boosterClaimAt) && p.boosterClaimAt > nowMs - BOOSTER_CLAIM_COOLDOWN_MS && p.boosterClaimAt <= nowMs + 60_000) out.boosterClaimAt = p.boosterClaimAt;
  if (typeof p.lootboxes === 'number' && Number.isFinite(p.lootboxes) && p.lootboxes > 0) out.lootboxes = Math.min(100000, Math.floor(p.lootboxes));
  if (typeof p.freezes === 'number' && Number.isFinite(p.freezes) && p.freezes > 0) out.freezes = Math.min(MAX_FREEZES + 50, Math.floor(p.freezes));
  const d = p.daily as Partial<DailyState> | undefined;
  if (d && typeof d.last === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.last) && typeof d.streak === 'number' && Number.isFinite(d.streak) && d.streak >= 0) {
    out.daily = { last: d.last, streak: Math.floor(d.streak), best: Math.max(Math.floor(n(d.best, 0)), Math.floor(d.streak)), total: Math.floor(n(d.total, 0)) };
  }
  for (const s of ['classic']) if (!out.ownedSkins.includes(s)) out.ownedSkins.unshift(s);
  if (!out.ownedCapes.includes('none')) out.ownedCapes.unshift('none');
  out.level = levelForXp(out.xp);
  if (isCustomSkinData(p.customSkin)) out.customSkin = p.customSkin;
  const look = cleanLook({ skin: p.currentSkin, cape: p.currentCape, custom: out.customSkin });
  out.currentSkin = look.skin === CUSTOM_SKIN_ID ? CUSTOM_SKIN_ID : out.ownedSkins.includes(look.skin) ? look.skin : 'classic';
  out.currentCape = out.ownedCapes.includes(look.cape) ? look.cape : 'none';
  return out;
}

let state: Progress = load();
const listeners = new Set<() => void>();
const levelListeners = new Set<(level: number, coins: number, lootboxes: number) => void>();

function load(): Progress {
  try {
    const raw = portalStorage.get(KEY);
    if (!raw) return fresh();
    const { body, sig } = JSON.parse(raw) as { body: string; sig: string };
    if (typeof body !== 'string' || sign(body) !== sig) { console.warn('[progress] save failed its check; starting fresh'); return fresh(); }
    return sanitize(JSON.parse(body));
  } catch { return fresh(); }
}
function commit(next: Progress) {
  state = next;
  const body = JSON.stringify(state);
  portalStorage.set(KEY, JSON.stringify({ body, sig: sign(body) }));
  for (const l of listeners) l();
}

/** For React: useSyncExternalStore(subscribeProgress, getProgress) */
export function getProgress(): Progress { return state; }
export function subscribeProgress(fn: () => void): () => void { listeners.add(fn); return () => listeners.delete(fn); }
/** Called with the new level and the coins granted, once per level gained. */
export function onLevelUp(fn: (level: number, coins: number, lootboxes: number) => void): () => void { levelListeners.add(fn); return () => levelListeners.delete(fn); }
/** Re-read the save (e.g. once the CrazyGames SDK is ready and cloud data is available). */
export function reloadProgress() { state = load(); for (const l of listeners) l(); }
export function currentLook(): PlayerLook {
  if (state.currentSkin === CUSTOM_SKIN_ID && state.customSkin) return { skin: CUSTOM_SKIN_ID, cape: state.currentCape, custom: state.customSkin };
  return { skin: state.currentSkin === CUSTOM_SKIN_ID ? 'classic' : state.currentSkin, cape: state.currentCape };
}
/** Saves (and wears) your own skin, or removes it with null. The shop only offers this to Champions. */
export function setCustomSkin(png: string | null): boolean {
  if (png === null) { commit({ ...state, customSkin: undefined, currentSkin: state.currentSkin === CUSTOM_SKIN_ID ? 'classic' : state.currentSkin }); return true; }
  if (!isCustomSkinData(png)) return false;
  commit({ ...state, customSkin: png, currentSkin: CUSTOM_SKIN_ID });
  return true;
}

/** Feed in active play time. Returns the levels gained (usually none). */
export function addActiveSeconds(seconds: number): number[] {
  if (!(seconds > 0)) return [];
  const s = { ...state };
  const boosted = Math.min(seconds, s.boosterSeconds);
  s.boosterSeconds -= boosted;
  s.totalActiveSeconds += seconds;
  s.activeSeconds += seconds + boosted; // booster time counts twice
  const gained: number[] = [], boxesGained: number[] = [];
  while (s.activeSeconds >= SECONDS_PER_PERIOD) {
    s.activeSeconds -= SECONDS_PER_PERIOD;
    s.xp += XP_PER_PERIOD;
    const lvl = levelForXp(s.xp);
    while (s.level < lvl) { s.level++; s.coins += LEVEL_UP_COINS; const boxes = 1 + (Math.random() < 0.5 ? 1 : 0); s.lootboxes = (s.lootboxes ?? 0) + boxes; boxesGained.push(boxes); gained.push(s.level); }
  }
  // Saving every tick would be wasteful: save on XP gains, and every ~30 s otherwise
  if (gained.length || s.xp !== state.xp || Math.floor(s.totalActiveSeconds / 30) !== Math.floor(state.totalActiveSeconds / 30) || (state.boosterSeconds > 0 && s.boosterSeconds === 0)) commit(s);
  else { state = s; for (const l of listeners) l(); }
  gained.forEach((lvl, i) => { for (const fn of levelListeners) fn(lvl, LEVEL_UP_COINS, boxesGained[i]); });
  return gained;
}

export function rewardAdCoins() { commit({ ...state, coins: state.coins + AD_COINS }); }
export function rewardAdBooster() { commit({ ...state, boosterSeconds: state.boosterSeconds + BOOSTER_SECONDS }); }

export type ClaimStatus = {
  coinsLeft: number;      // claims left in this hour
  coinsWaitMs: number;    // 0 if you can claim now, else how long until the next claim opens
  boosterWaitMs: number;  // 0 if you can claim now
};
/** What a rank holder can claim right now. */
export function claimStatus(now = Date.now()): ClaimStatus {
  const recent = (state.coinClaims ?? []).filter((t) => t > now - COIN_CLAIM_WINDOW_MS);
  const coinsLeft = Math.max(0, COIN_CLAIMS_PER_HOUR - recent.length);
  const coinsWaitMs = coinsLeft > 0 ? 0 : Math.max(0, Math.min(...recent) + COIN_CLAIM_WINDOW_MS - now);
  const boosterWaitMs = state.boosterClaimAt ? Math.max(0, state.boosterClaimAt + BOOSTER_CLAIM_COOLDOWN_MS - now) : 0;
  return { coinsLeft, coinsWaitMs, boosterWaitMs };
}
export type ClaimResult = { ok: true } | { ok: false; waitMs: number };
/** Claim the coins without watching an ad (ranks): 5 times an hour. */
export function claimCoins(now = Date.now()): ClaimResult {
  const st = claimStatus(now);
  if (st.coinsLeft <= 0) return { ok: false, waitMs: st.coinsWaitMs };
  const recent = (state.coinClaims ?? []).filter((t) => t > now - COIN_CLAIM_WINDOW_MS);
  commit({ ...state, coins: state.coins + AD_COINS, coinClaims: [...recent, now] });
  return { ok: true };
}
/** Claim the 2x XP booster without watching an ad (ranks): once every 15 minutes. */
export function claimBooster(now = Date.now()): ClaimResult {
  const st = claimStatus(now);
  if (st.boosterWaitMs > 0) return { ok: false, waitMs: st.boosterWaitMs };
  commit({ ...state, boosterSeconds: state.boosterSeconds + BOOSTER_SECONDS, boosterClaimAt: now });
  return { ok: true };
}

// ---------------- Daily reward, streaks, freezes, lootboxes ----------------
// Claim once a day (by your own clock). Claim on consecutive days to build a streak; a streak freeze saves it for one
// missed day. The reward goes round a 7 day cycle: day 7 is a random skin you don't own yet (coins if you own them all).
// Lootboxes come from the daily reward and from levelling up (1 or 2 every level, no limit).
export const DAILY_COINS = [20, 25, 30, 35, 40, 50, 75];
/** Which days of the 7 day cycle also give a lootbox */
export const DAILY_LOOTBOX_DAYS = [3, 5, 7];
export const WEEKLY_FALLBACK_COINS = 200;
const pad2 = (n: number) => String(n).padStart(2, '0');
/** Your calendar day (YYYY-MM-DD) for a time. */
export function dayKey(ms: number): string { const d = new Date(ms); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
/** Whole days from one day key to a later one (0: same day, 1: the next day...). */
export function daysApart(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number), [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}
export type DailyStatus = {
  canClaim: boolean;
  /** the streak you have right now (0 if you lost it), and what it becomes if you claim today */
  streak: number; nextStreak: number;
  /** which day of the 7 day cycle you claim today (1-7) */
  cycleDay: number;
  /** missed days a freeze will cover when you claim, or true if the streak is lost */
  freezesNeeded: number; streakLost: boolean;
  best: number; total: number; freezes: number; lootboxes: number;
  /** what today's claim gives (before doubling) */
  preview: { coins: number; lootboxes: number; skin: boolean };
  /** the clock went backwards: no claim until it catches up */
  clockOff: boolean;
};
function unownedSkins(st: Progress): string[] { return Object.keys(SKINS).filter((id) => id !== 'classic' && !st.ownedSkins.includes(id)); }
function unownedCapes(st: Progress): string[] { return Object.keys(CAPES).filter((id) => id !== 'none' && !st.ownedCapes.includes(id)); }
export function dailyStatus(now = Date.now()): DailyStatus {
  const d = state.daily;
  const today = dayKey(now);
  const gap = d ? daysApart(d.last, today) : Infinity;
  const clockOff = !!d && gap < 0;
  const canClaim = !clockOff && (!d || gap >= 1);
  const missed = d && gap >= 2 ? gap - 1 : 0;
  const freezes = state.freezes ?? 0;
  const lost = missed > freezes;
  const streak = !d ? 0 : gap <= 1 ? d.streak : lost ? 0 : d.streak;
  const nextStreak = (d && !lost ? d.streak : 0) + 1;
  const cycleDay = ((nextStreak - 1) % 7) + 1;
  const weekly = cycleDay === 7;
  const skin = weekly && unownedSkins(state).length > 0;
  return {
    canClaim, streak, nextStreak, cycleDay,
    freezesNeeded: missed > 0 && !lost ? missed : 0, streakLost: missed > 0 && lost,
    best: d?.best ?? 0, total: d?.total ?? 0, freezes, lootboxes: state.lootboxes ?? 0,
    preview: { coins: weekly && skin ? 0 : weekly ? WEEKLY_FALLBACK_COINS : DAILY_COINS[cycleDay - 1], lootboxes: DAILY_LOOTBOX_DAYS.includes(cycleDay) ? 1 : 0, skin },
    clockOff,
  };
}
export type DailyGrant = {
  cycleDay: number; streak: number; coins: number; lootboxes: number; skin: string | null;
  freezesUsed: number; streakLost: boolean; doubled: boolean;
};
/** Claim today's reward. double: it is doubled (a watched ad, or a rank, which never sees ads). The skin is never doubled. */
export function claimDaily(double: boolean, now = Date.now(), rng: () => number = Math.random): { ok: true; grant: DailyGrant } | { ok: false } {
  const st = dailyStatus(now);
  if (!st.canClaim) return { ok: false };
  const s = { ...state };
  const today = dayKey(now);
  const used = st.freezesNeeded;
  s.freezes = Math.max(0, (s.freezes ?? 0) - used);
  const streak = st.nextStreak;
  const day = st.cycleDay;
  let coins = DAILY_COINS[day - 1], boxes = DAILY_LOOTBOX_DAYS.includes(day) ? 1 : 0, skin: string | null = null;
  if (day === 7) {
    const pool = unownedSkins(s);
    if (pool.length) { skin = pool[Math.floor(rng() * pool.length)]; coins = 0; s.ownedSkins = [...s.ownedSkins, skin]; }
    else coins = WEEKLY_FALLBACK_COINS; // you own every skin already: coins instead
  }
  if (double) { coins *= 2; boxes *= 2; }
  s.coins += coins;
  if (boxes) s.lootboxes = (s.lootboxes ?? 0) + boxes;
  s.daily = { last: today, streak, best: Math.max(state.daily?.best ?? 0, streak), total: (state.daily?.total ?? 0) + 1 };
  commit(s);
  return { ok: true, grant: { cycleDay: day, streak, coins, lootboxes: boxes, skin, freezesUsed: used, streakLost: st.streakLost, doubled: double } };
}

export type LootResult =
  | { kind: 'coins'; amount: number }
  | { kind: 'freeze' }
  | { kind: 'booster'; seconds: number }
  | { kind: 'skin'; id: string; rare: boolean }
  | { kind: 'cape'; id: string; rare: boolean };
/** Open one lootbox. Mostly coins, streak freezes and XP boosters; now and then a skin, and rarely a top skin or cape. */
export function openLootbox(rng: () => number = Math.random): LootResult | null {
  if ((state.lootboxes ?? 0) <= 0) return null;
  const s = { ...state, lootboxes: (state.lootboxes ?? 0) - 1 };
  if (s.lootboxes === 0) delete s.lootboxes;
  const skins = unownedSkins(s), capes = unownedCapes(s);
  const rare = [...skins.filter((id) => SKINS[id].price >= 600).map((id) => ['skin', id] as const), ...capes.filter((id) => CAPES[id].price >= 600).map((id) => ['cape', id] as const)];
  let res: LootResult;
  const roll = rng();
  if (roll < 0.34) res = { kind: 'coins', amount: 30 + Math.floor(rng() * 91) };
  else if (roll < 0.52) res = (s.freezes ?? 0) < MAX_FREEZES ? { kind: 'freeze' } : { kind: 'coins', amount: 60 };
  else if (roll < 0.78) res = { kind: 'booster', seconds: BOOSTER_SECONDS * (rng() < 0.2 ? 2 : 1) };
  else if (roll < 0.93) {
    const cheap = skins.filter((id) => SKINS[id].price < 600);
    res = cheap.length ? { kind: 'skin', id: cheap[Math.floor(rng() * cheap.length)], rare: false } : { kind: 'coins', amount: 100 };
  } else if (rare.length) { const [k, id] = rare[Math.floor(rng() * rare.length)]; res = { kind: k, id, rare: true }; }
  else res = { kind: 'coins', amount: 150 };
  if (res.kind === 'coins') s.coins += res.amount;
  else if (res.kind === 'freeze') s.freezes = (s.freezes ?? 0) + 1;
  else if (res.kind === 'booster') s.boosterSeconds = Math.min(BOOSTER_SECONDS * 20, s.boosterSeconds + res.seconds);
  else if (res.kind === 'skin') s.ownedSkins = [...s.ownedSkins, res.id];
  else s.ownedCapes = [...s.ownedCapes, res.id];
  commit(s);
  return res;
}
/** Shop: a streak freeze, or an XP booster (15 minutes of play counting double). */
export function buyShopItem(item: 'freeze' | 'booster'): 'ok' | 'poor' | 'full' {
  if (item === 'freeze') {
    if ((state.freezes ?? 0) >= MAX_FREEZES) return 'full';
    if (state.coins < FREEZE_PRICE) return 'poor';
    commit({ ...state, coins: state.coins - FREEZE_PRICE, freezes: (state.freezes ?? 0) + 1 });
    return 'ok';
  }
  if (state.coins < BOOSTER_PRICE) return 'poor';
  commit({ ...state, coins: state.coins - BOOSTER_PRICE, boosterSeconds: Math.min(BOOSTER_SECONDS * 20, state.boosterSeconds + BOOSTER_SECONDS) });
  return 'ok';
}
/** For tests and tools: give lootboxes / freezes (not used by the game itself). */
export function debugGrant(g: { lootboxes?: number; freezes?: number; coins?: number }) {
  commit({ ...state, lootboxes: (state.lootboxes ?? 0) + (g.lootboxes ?? 0), freezes: (state.freezes ?? 0) + (g.freezes ?? 0), coins: state.coins + (g.coins ?? 0) });
}

export type BuyResult = 'ok' | 'owned' | 'poor' | 'unknown';
export function buyCosmetic(kind: 'skin' | 'cape', id: string): BuyResult {
  const def = kind === 'skin' ? SKINS[id] : CAPES[id];
  if (!def) return 'unknown';
  const owned = kind === 'skin' ? state.ownedSkins : state.ownedCapes;
  if (owned.includes(id)) return 'owned';
  if (state.coins < def.price) return 'poor';
  const s = { ...state, coins: state.coins - def.price };
  if (kind === 'skin') { s.ownedSkins = [...s.ownedSkins, id]; s.currentSkin = id; } else { s.ownedCapes = [...s.ownedCapes, id]; s.currentCape = id; }
  commit(s);
  return 'ok';
}
export function equipCosmetic(kind: 'skin' | 'cape', id: string): boolean {
  if (kind === 'skin' && id === CUSTOM_SKIN_ID) { if (!state.customSkin) return false; commit({ ...state, currentSkin: CUSTOM_SKIN_ID }); return true; }
  const owned = kind === 'skin' ? state.ownedSkins : state.ownedCapes;
  if (!owned.includes(id)) return false;
  commit(kind === 'skin' ? { ...state, currentSkin: id } : { ...state, currentCape: id });
  return true;
}

// ---------------- Saving to your account ----------------
// Signed-in players keep their level, XP, coins and cosmetics on their account too (vibeblox_round16.sql), so they
// follow them to other devices and show on the level leaderboard. The account copy is just the same Progress.
/** What gets saved to the account. */
export function progressForAccount(): Progress { return { ...state }; }
/**
 * A save from the account arrived: keep whichever has more XP (so you never lose levels), with every skin and
 * cape either one owns. Returns true if anything here changed.
 */
export function mergeAccountProgress(remote: unknown): boolean {
  if (!remote || typeof remote !== 'object') return false;
  const r = sanitize(remote as Partial<Progress>);
  const base = r.xp > state.xp ? r : state;
  const merged: Progress = {
    ...base,
    ownedSkins: [...new Set([...state.ownedSkins, ...r.ownedSkins])],
    ownedCapes: [...new Set([...state.ownedCapes, ...r.ownedCapes])],
    customSkin: base.customSkin ?? state.customSkin ?? r.customSkin,
    // claim limits can't be dodged by switching device: keep every claim either side knows about
    coinClaims: [...new Set([...(state.coinClaims ?? []), ...(r.coinClaims ?? [])])].sort((a, b) => a - b).slice(-COIN_CLAIMS_PER_HOUR),
    boosterClaimAt: Math.max(state.boosterClaimAt ?? 0, r.boosterClaimAt ?? 0) || undefined,
    // the daily reward can't be claimed twice by switching device: the side that claimed more recently (then more days) wins, along with its boxes and freezes
    ...mergeDaily(state, r),
  };
  const before = JSON.stringify(state);
  const next = sanitize(merged);
  if (JSON.stringify(next) === before) return false;
  commit(next);
  return true;
}

function mergeDaily(a: Progress, b: Progress): Partial<Progress> {
  const da = a.daily, db = b.daily;
  const pick = !db ? a : !da ? b : da.last !== db.last ? (da.last > db.last ? a : b) : da.total >= db.total ? a : b;
  return { daily: pick.daily, lootboxes: pick.lootboxes, freezes: pick.freezes };
}
