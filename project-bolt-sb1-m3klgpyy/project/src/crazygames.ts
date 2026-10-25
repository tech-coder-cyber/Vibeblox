// Everything that is special about running on CrazyGames (Indev 35.3), in one place:
//
//  - Accounts: CrazyGames players are logged in AUTOMATICALLY. The game asks the CrazyGames SDK who is playing, sends the
//    signed token to our login function (functions/api/cg-login.ts), and gets a normal VibeBlox session back. Players who
//    are not logged in to CrazyGames just play as guests; the only login offered is "Login with CrazyGames".
//    (No email, no Google and no sign-out inside the game: CrazyGames forbids them.)
//  - Saving: progress and settings go through the CrazyGames data module (synced across devices for logged-in players,
//    kept in this browser for guests). Big things (your worlds, pictures, scripts) stay in this browser: the module holds 1 MB.
//  - Game settings from CrazyGames (chat off, sound off).
//
// None of this runs anywhere else: on vibeblox.online and Poki every function here does nothing.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { PLATFORM, initAds } from './adEconomy';

const w = (typeof window !== 'undefined' ? window : {}) as any;
const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>;

/** Where the CrazyGames login function lives (it runs on our own site, so the game on crazygames.com calls it by full address). */
export const CG_LOGIN_URL: string = (env.VITE_CG_LOGIN_URL ?? '').trim() || 'https://vibeblox.online/api/cg-login';
/** Accounts made for CrazyGames players use this email domain (never a real mailbox). */
export const CG_EMAIL_DOMAIN = 'cg.vibeblox.online';
export const isCgEmail = (email: string | null | undefined): boolean => !!email && email.toLowerCase().endsWith('@' + CG_EMAIL_DOMAIN);

export const onCrazyGames = PLATFORM === 'crazygames';
const sdk = (): any => w.CrazyGames?.SDK;

export type CgUser = { username: string; profilePictureUrl?: string } | null;

// ---------------------------------------------------------------- saving (data module)

/** Keys that are too big for the 1 MB data module (or that must stay on this device). */
const LOCAL_ONLY = new Set(['vb-worlds', 'vb-schematics', 'vb-scripts', 'vb-script-code', 'vb-mods', 'vb-custom-ids', 'vb-private-servers', 'vb-ai-dev-key', 'vb-ai-mode']);
const MAX_ROUTED = 120_000;
/** Is this one of the small progress / settings keys the data module should hold? */
export function isCloudKey(key: string, value?: string): boolean {
  if (!key.startsWith('vb-') || LOCAL_ONLY.has(key) || key.startsWith('vb-bg')) return false;
  return value === undefined || value.length <= MAX_ROUTED;
}

let guestPlayer = true;
/** true while nobody is logged in to CrazyGames */
export const cgIsGuest = (): boolean => guestPlayer;
let storageInstalled = false;

/**
 * Makes every localStorage.getItem / setItem / removeItem of a progress key go through the CrazyGames data module, so the
 * rest of the game needs no changes. Guests fall back to what this browser already holds (an older save is not lost).
 * A logged-in player never falls back to local data: a shared computer must not hand one player another's progress.
 */
export function installCrazyGamesStorage(data: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }, proto: Storage = Storage.prototype, local: Storage | null = (() => { try { return localStorage; } catch { return null; } })()): void {
  if (storageInstalled || !local) return;
  storageInstalled = true;
  const rawGet = proto.getItem, rawSet = proto.setItem, rawRemove = proto.removeItem;
  let inside = false; // the data module itself uses localStorage: let those calls through
  proto.getItem = function (this: Storage, key: string) {
    if (this === local && !inside && isCloudKey(String(key))) {
      inside = true;
      try { const v = data.getItem(String(key)); if (v !== null && v !== undefined) return v; } catch { /* fall back */ } finally { inside = false; }
      return guestPlayer ? rawGet.call(this, key) : null;
    }
    return rawGet.call(this, key);
  };
  proto.setItem = function (this: Storage, key: string, value: string) {
    if (this === local && !inside && isCloudKey(String(key), String(value))) {
      inside = true;
      try { data.setItem(String(key), String(value)); return; } catch { /* storage blocked: fall through to the browser */ } finally { inside = false; }
    }
    return rawSet.call(this, key, value);
  };
  proto.removeItem = function (this: Storage, key: string) {
    if (this === local && !inside && isCloudKey(String(key))) {
      inside = true;
      try { data.removeItem(String(key)); } catch { /* ignore */ } finally { inside = false; }
    }
    return rawRemove.call(this, key);
  };
}

// ---------------------------------------------------------------- the player

/** Who is logged in to CrazyGames right now (null: nobody, or accounts are not available here). */
export async function cgGetUser(): Promise<CgUser> {
  try {
    const s = sdk();
    if (!s || s.user?.isUserAccountAvailable === false) return null;
    return (await s.user.getUser()) ?? null;
  } catch { return null; }
}

/** Turns the CrazyGames login into a VibeBlox session. Resolves the player's name, or null when it did not work (they keep playing as a guest). */
let linking: Promise<{ username: string } | null> | null = null;
export function cgLinkAccount(fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<{ username: string } | null> {
  if (!linking) linking = linkOnce(fetchFn).finally(() => { linking = null; }); // one login at a time (React may start the same effect twice)
  return linking;
}
async function linkOnce(fetchFn: typeof fetch): Promise<{ username: string } | null> {
  try {
    const s = sdk();
    if (!s) return null;
    const token: string = await s.user.getUserToken(); // throws "userNotAuthenticated" for guests
    const res = await fetchFn(CG_LOGIN_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) });
    if (!res.ok) { console.warn('[crazygames] login function said', res.status); return null; }
    const j = await res.json();
    if (!j || !j.access_token || !j.refresh_token) return null;
    const A = await import('./auth/supabaseAuth');
    const r = await A.signInWithTokens(j.access_token, j.refresh_token);
    if (r.error) { console.warn('[crazygames] session not accepted:', r.error); return null; }
    guestPlayer = false;
    return { username: String(j.username ?? '') };
  } catch (e) {
    console.warn('[crazygames] could not log in:', e);
    return null;
  }
}

/** A guest on CrazyGames must not stay inside the account of whoever used this browser before. */
async function cgDropOldSession(): Promise<void> {
  try {
    const A = await import('./auth/supabaseAuth');
    const info = await A.getAccountInfo();
    if (isCgEmail(info.email)) await A.signOutAccount();
  } catch { /* nothing to drop */ }
}

/** At every start: find out who is playing and make the VibeBlox account match (also when somebody else used this browser before). */
export async function syncCrazyGamesAccount(): Promise<CgUser> {
  if (!onCrazyGames) return null;
  const user = await cgGetUser();
  if (user) { guestPlayer = false; if (!(await cgLinkAccount())) guestPlayer = true; }
  else { guestPlayer = true; await cgDropOldSession(); }
  return user;
}

/** The "Login with CrazyGames" button: CrazyGames' own log in / register window, then the same link-up as above. */
export async function cgShowLogin(): Promise<boolean> {
  if (!onCrazyGames) return false;
  try {
    const s = sdk();
    if (!s?.user || s.user.isUserAccountAvailable === false) return false;
    await s.user.showAuthPrompt();
    return !!(await cgLinkAccount());
  } catch { return false; } // the player closed the window
}

/** A guest who logs in while playing. (CrazyGames reloads the page itself in many cases; this covers the rest.) Returns a function that stops listening. */
export function cgWatchLogins(onLogin: (username: string) => void): () => void {
  const s = sdk();
  if (!onCrazyGames || !s?.user?.addAuthListener) return () => undefined;
  const listener = async (user: CgUser) => {
    if (!user) return;
    const r = await cgLinkAccount();
    if (r) onLogin(r.username);
  };
  try { s.user.addAuthListener(listener); } catch { return () => undefined; }
  return () => { try { s.user.removeAuthListener?.(listener); } catch { /* ignore */ } };
}

// ---------------------------------------------------------------- game settings from CrazyGames

export type CgSettings = { disableChat: boolean; muteAudio: boolean };
/** CrazyGames can switch chat and sound off for a player (parental settings, complaints). */
export function cgSettings(): CgSettings {
  const st = sdk()?.game?.settings;
  return { disableChat: !!st?.disableChat, muteAudio: !!st?.muteAudio };
}
export function cgWatchSettings(cb: (s: CgSettings) => void): () => void {
  const g = sdk()?.game;
  if (!onCrazyGames || !g?.addSettingsChangeListener) return () => undefined;
  const l = () => cb(cgSettings());
  try { g.addSettingsChangeListener(l); } catch { return () => undefined; }
  return () => { try { g.removeSettingsChangeListener?.(l); } catch { /* ignore */ } };
}

// ---------------------------------------------------------------- start-up

/**
 * Called once before the game is drawn (main.tsx): starts the SDK, reports that loading began, routes saving through the
 * data module and finds out whether a CrazyGames player is logged in. Never throws; if anything is missing the game starts as usual.
 */
export async function prepareCrazyGames(): Promise<void> {
  if (!onCrazyGames) return;
  try {
    const ok = await initAds(); // loads and starts the SDK
    if (!ok) return;
    try { sdk().game.loadingStart?.(); } catch { /* optional */ }
    const user = await cgGetUser();
    guestPlayer = !user;
    if (sdk().data) installCrazyGamesStorage(sdk().data);
  } catch (e) {
    console.warn('[crazygames] start-up problem:', e);
  }
}
