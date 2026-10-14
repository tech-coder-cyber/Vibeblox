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
  /** A Champion's own skin (PNG data URL); wearing it means currentSkin is 'custom' */
  customSkin?: string;
};

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
const levelListeners = new Set<(level: number, coins: number) => void>();

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
export function onLevelUp(fn: (level: number, coins: number) => void): () => void { levelListeners.add(fn); return () => levelListeners.delete(fn); }
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
  const gained: number[] = [];
  while (s.activeSeconds >= SECONDS_PER_PERIOD) {
    s.activeSeconds -= SECONDS_PER_PERIOD;
    s.xp += XP_PER_PERIOD;
    const lvl = levelForXp(s.xp);
    while (s.level < lvl) { s.level++; s.coins += LEVEL_UP_COINS; gained.push(s.level); }
  }
  // Saving every tick would be wasteful: save on XP gains, and every ~30 s otherwise
  if (gained.length || s.xp !== state.xp || Math.floor(s.totalActiveSeconds / 30) !== Math.floor(state.totalActiveSeconds / 30) || (state.boosterSeconds > 0 && s.boosterSeconds === 0)) commit(s);
  else { state = s; for (const l of listeners) l(); }
  for (const lvl of gained) for (const fn of levelListeners) fn(lvl, LEVEL_UP_COINS);
  return gained;
}

export function rewardAdCoins() { commit({ ...state, coins: state.coins + AD_COINS }); }
export function rewardAdBooster() { commit({ ...state, boosterSeconds: state.boosterSeconds + BOOSTER_SECONDS }); }

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
  };
  const before = JSON.stringify(state);
  const next = sanitize(merged);
  if (JSON.stringify(next) === before) return false;
  commit(next);
  return true;
}
