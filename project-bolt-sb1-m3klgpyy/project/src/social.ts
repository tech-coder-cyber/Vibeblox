// Accounts, friends, private messages, announcements and admin tools for VibeBlox.
//
// Everything lives in the Supabase project (tables are created by server/supabase_social.sql). This file talks
// to it with plain fetch() calls to the REST API, using the access token of the signed-in player, so every
// request is checked by Row Level Security in the database -- a modified game can not read other people's
// messages, add itself as an admin or announce things.
//
// Nothing here throws: every function returns { ok, ... } with a message that is fine to show the player.

import { cleanTags } from './worldTags';
export const SUPABASE_URL = 'https://okhtosecqytklgwouwxv.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_kyklbTdQk64bRSdGSrEX0w_1lKAD4X0';

export type Account = { userId: string; username: string; token: string; /** 'none' | 'vanguard' | 'elite' | 'champion' (set by the database, never by the player) */ rank?: string; /** When a temporary rank runs out (ISO time), or null/undefined if it lasts for good */ rankUntil?: string | null; /** When the name was last changed (you can change it once a week) */ nameChangedAt?: string | null; /** An OG player (played before the OG rank ends): gets Elite's perks */ og?: boolean; /** 'helper' | 'mod' (set by the owner in the Admin panel) or null */ staff?: string | null };
export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

type Config = {
  url: string;
  anonKey: string;
  /** The current access token (or null when signed out). */
  getToken: () => Promise<string | null>;
  fetchImpl: typeof fetch;
  storage: { getItem(k: string): string | null; setItem(k: string, v: string): void };
};
const memory = new Map<string, string>();
const config: Config = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  getToken: async () => null,
  fetchImpl: (...a) => fetch(...a),
  storage: {
    getItem: (k) => { try { return localStorage.getItem(k); } catch { return memory.get(k) ?? null; } },
    setItem: (k, v) => { try { localStorage.setItem(k, v); } catch { memory.set(k, v); } },
  },
};
/** The app (and the tests) plug in how to get a token; everything else has working defaults. */
export function configureSocial(c: Partial<Config>) { Object.assign(config, c); }

const SETUP_HINT = "Friends and messages aren't set up on this project yet (run server/supabase_social.sql in Supabase)";

async function rest(method: string, path: string, body?: unknown, extra: Record<string, string> = {}, tokenOverride?: string): Promise<{ ok: true; data: any } | { ok: false; error: string; status: number }> {
  let token: string | null = tokenOverride ?? null;
  if (!token) { try { token = await config.getToken(); } catch { token = null; } }
  if (!token) return { ok: false, error: 'Sign in to use this', status: 401 };
  try {
    const res = await config.fetchImpl(`${config.url}/rest/v1/${path}`, {
      method,
      headers: { apikey: config.anonKey, authorization: `Bearer ${token}`, 'content-type': 'application/json', prefer: 'return=representation', ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) {
      const code = String(data?.code ?? '');
      if (res.status === 404 || code === 'PGRST205' || code === '42P01') return { ok: false, error: SETUP_HINT, status: res.status };
      if (code === '23505') return { ok: false, error: 'That already exists', status: res.status };
      if (res.status === 401 || code === 'PGRST301') return { ok: false, error: 'Your sign-in expired. Sign in again', status: res.status };
      if (res.status === 403 || code === '42501') return { ok: false, error: "You're not allowed to do that", status: res.status };
      return { ok: false, error: String(data?.message ?? `Something went wrong (${res.status})`), status: res.status };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Couldn't reach the server. Check your connection", status: 0 };
  }
}
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

// ---------------- Who is playing what (anyone, signed in or not) ----------------
export type Activity = 'survival' | 'creative' | 'superflat' | 'oneblock' | 'eggwars' | 'bridge' | 'other';
const SESSION_KEY = 'vb-play-session';
/** A random id for this browser (not linked to any account), so it is counted once. */
function playSession(): string {
  let id = config.storage.getItem(SESSION_KEY);
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
    const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
    config.storage.setItem(SESSION_KEY, id);
  }
  return id;
}
/** Calls a database function with just the public key (works for guests too). */
async function rpcPublic(fn: string, args: object): Promise<{ ok: true; data: any } | { ok: false }> {
  try {
    const res = await config.fetchImpl(`${config.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: config.anonKey, 'content-type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res.ok) return { ok: false };
    const text = await res.text();
    return { ok: true, data: text ? JSON.parse(text) : null };
  } catch {
    return { ok: false };
  }
}
/** "I'm playing this" (call it every 30 seconds while playing). null: stopped playing. */
export async function reportActivity(activity: Activity | null): Promise<boolean> {
  const r = await rpcPublic('heartbeat', { p_session: playSession(), p_activity: activity ?? 'none' });
  return r.ok;
}
/** How many people are playing each thing right now (null if it can't be reached / isn't set up). */
export async function fetchPlayingCounts(): Promise<Record<string, number> | null> {
  const r = await rpcPublic('playing_counts', {});
  if (!r.ok || !Array.isArray(r.data)) return null;
  const out: Record<string, number> = {};
  for (const row of r.data as Array<{ activity: string; players: number | string }>) out[row.activity] = Number(row.players) || 0;
  return out;
}

// ---------------- Names ----------------
export const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
/** The account named "Master" is the owner of VibeBlox (always an admin; the name is reserved in supabase_social.sql). */
export const OWNER_NAME = 'Master';
/** Plays you need to become a Rising Creator. */
export const RISING_CREATOR_PLAYS = 1000;
/** You can change your username once every 7 days. */
export const NAME_CHANGE_WAIT_MS = 7 * 24 * 3600 * 1000;
export const isOwnerName = (name: string | null | undefined) => !!name && name.toLowerCase() === OWNER_NAME.toLowerCase();
// Guests get a random name like "CoolCat382": an adjective, an animal and three numbers. Accounts can't use names
// shaped like that, so a guest is always recognised by their name alone.
export const GUEST_ADJECTIVES = ['Cool', 'Happy', 'Swift', 'Brave', 'Lucky', 'Sneaky', 'Mighty', 'Fuzzy', 'Silly', 'Clever', 'Shiny', 'Rapid', 'Sleepy', 'Jolly', 'Cosmic', 'Epic', 'Frosty', 'Golden', 'Noble', 'Wild', 'Tiny', 'Giant', 'Fierce', 'Calm', 'Bold', 'Witty', 'Zesty', 'Funky', 'Turbo', 'Pixel'];
export const GUEST_NOUNS = ['Cat', 'Fox', 'Panda', 'Tiger', 'Wolf', 'Otter', 'Falcon', 'Bunny', 'Dragon', 'Koala', 'Penguin', 'Shark', 'Llama', 'Moose', 'Eagle', 'Hippo', 'Gecko', 'Badger', 'Raven', 'Bear', 'Duck', 'Frog', 'Owl', 'Lion', 'Whale', 'Turtle', 'Pig', 'Cow', 'Bee', 'Creeper'];
const GUEST_RE = new RegExp(`^(${GUEST_ADJECTIVES.join('|')})(${GUEST_NOUNS.join('|')})\\d{3}$`, 'i');
export const isGuestName = (name: string) => /^Guest_/i.test(name) || GUEST_RE.test(name);
/** A new guest name, e.g. "CoolCat382". */
export function randomGuestName(rand: () => number = Math.random): string {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length) % a.length];
  return `${pick(GUEST_ADJECTIVES)}${pick(GUEST_NOUNS)}${String(Math.floor(rand() * 1000) % 1000).padStart(3, '0')}`;
}
const lower = (s: string) => s.toLowerCase();

// ---------------- Profiles ----------------
type Profile = { id: string; username: string; last_seen?: string };
async function profileByName(name: string): Promise<Result<{ profile: Profile | null }>> {
  const clean = name.trim();
  if (!USERNAME_RE.test(clean)) return { ok: true, profile: null };
  const r = await rest('GET', `profiles?select=id,username,last_seen&username=ilike.${encodeURIComponent(clean)}&limit=5`);
  if (!r.ok) return fail(r.error);
  const hit = (r.data as Profile[]).find((p) => lower(p.username) === lower(clean)) ?? null;
  return { ok: true, profile: hit };
}
async function profilesById(ids: string[]): Promise<Map<string, Profile>> {
  const out = new Map<string, Profile>();
  if (!ids.length) return out;
  const r = await rest('GET', `profiles?select=id,username,last_seen&id=in.(${ids.map(encodeURIComponent).join(',')})`);
  if (r.ok) for (const p of r.data as Profile[]) out.set(p.id, p);
  return out;
}

/** Makes sure the signed-in user has a profile (the database trigger normally does it) and returns their account. */
export async function loadAccount(userId: string, token: string, wantedName: string): Promise<Account> {
  type Full = Profile & { rank?: string; rank_until?: string | null; username_changed_at?: string | null; og?: boolean; staff?: string | null };
  const id = encodeURIComponent(userId);
  // Temporary ranks that ran out are taken away first (older databases just don't have this function)
  await rest('POST', 'rpc/expire_ranks', {}, {}, token).catch(() => undefined);
  // Older databases do not have the rank_until / rank / username_changed_at columns yet: fall back step by step
  let r = await rest('GET', `profiles?select=id,username,rank,rank_until,username_changed_at,og,staff&id=eq.${id}&limit=1`, undefined, {}, token);
  if (!r.ok) r = await rest('GET', `profiles?select=id,username,rank,rank_until,username_changed_at&id=eq.${id}&limit=1`, undefined, {}, token);
  if (!r.ok) r = await rest('GET', `profiles?select=id,username,rank,username_changed_at&id=eq.${id}&limit=1`, undefined, {}, token);
  if (!r.ok) r = await rest('GET', `profiles?select=id,username&id=eq.${id}&limit=1`, undefined, {}, token);
  const row = r.ok ? (r.data as Full[])[0] : undefined;
  if (row) return { userId, username: row.username, token, rank: row.rank ?? 'none', rankUntil: row.rank_until ?? null, nameChangedAt: row.username_changed_at ?? null, og: row.og === true, staff: row.staff === 'helper' || row.staff === 'mod' ? row.staff : null };
  // No profile yet (the SQL trigger was not installed, or this account is older): make one
  let name = wantedName.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
  if (name.length < 3) name = 'Player' + Math.floor(Math.random() * 9000 + 1000);
  for (let i = 0; i < 4; i++) {
    const candidate = i === 0 ? name : name.slice(0, 12) + Math.floor(Math.random() * 9000 + 1000);
    const c = await rest('POST', 'profiles', { id: userId, username: candidate }, {}, token);
    if (c.ok) return { userId, username: candidate, token, rank: 'none', nameChangedAt: null };
    if (c.status !== 409) break;
  }
  return { userId, username: name, token, rank: 'none', nameChangedAt: null };
}

/** Changes your username (the database allows it once a week and checks the name is free). */
export async function changeUsername(name: string): Promise<Result<{ username: string; next: string }>> {
  const clean = name.trim();
  if (!USERNAME_RE.test(clean)) return fail('Usernames are 3-16 letters, numbers or underscores');
  if (isGuestName(clean)) return fail('Names like that are kept for guests. Pick another one.');
  const r = await rest('POST', 'rpc/change_username', { p_new: clean });
  if (!r.ok) return fail(r.status === 404 ? 'Renaming is not set up yet (run server/supabase_social.sql again in Supabase)' : r.error);
  const d = r.data as { ok?: boolean; error?: string; username?: string; next?: string } | null;
  if (!d || !d.ok) {
    const when = d?.next ? Date.parse(d.next) : NaN;
    const extra = Number.isFinite(when) ? ` (next change: ${new Date(when).toLocaleDateString()})` : '';
    return fail(String(d?.error ?? 'Could not change the name') + extra);
  }
  return { ok: true, username: String(d.username ?? clean), next: String(d.next ?? '') };
}

// ---------------- Plays, the leaderboard and Rising Creator ----------------
export type LeaderRow = { username: string; plays: number; rank: string; level?: number };
/** The creators with the most plays (null if it can't be reached / isn't set up). */
export async function fetchLeaderboard(limit = 50): Promise<LeaderRow[] | null> {
  const r = await rpcPublic('leaderboard', { p_limit: limit });
  if (!r.ok || !Array.isArray(r.data)) return null;
  return (r.data as Array<{ username: string; plays: number | string; rank?: string; level?: number | string }>).map((x) => ({ username: x.username, plays: Number(x.plays) || 0, rank: x.rank ?? 'none', ...(x.level != null ? { level: Number(x.level) || 1 } : {}) }));
}
export type Standing = { plays: number; rank: string; rising: boolean; og?: boolean; staff?: string | null };
/** One player's plays and rank (null if unknown). */
export async function fetchStanding(username: string): Promise<Standing | null> {
  if (!USERNAME_RE.test(username)) return null;
  const r = await rpcPublic('player_standing', { p_username: username });
  if (!r.ok || !Array.isArray(r.data) || !r.data[0]) return null;
  const d = r.data[0] as { plays: number | string; rank?: string; rising?: boolean; og?: boolean; staff?: string | null };
  const plays = Number(d.plays) || 0;
  return { plays, rank: d.rank ?? 'none', rising: !!d.rising || plays >= RISING_CREATOR_PLAYS, og: d.og === true, staff: d.staff === 'helper' || d.staff === 'mod' ? d.staff : null };
}
/** "Someone joined the game you host": counts one play for the host (the database ignores repeats and your own). */
export async function recordPlay(hostName: string): Promise<boolean> {
  if (!USERNAME_RE.test(hostName)) return false;
  const r = await rest('POST', 'rpc/record_play', { p_host: hostName });
  return r.ok && r.data === true;
}

// ---------------- Joining friends ----------------
/** Says which multiplayer server you are on (friends see a Join button). null: you left. */
export async function setServerPresence(server: string | null): Promise<void> {
  await rest('POST', 'rpc/set_presence', { p_server: server });
}
const PRESENCE_FRESH_MS = 120_000;

/** Marks you as online (friends see a green dot while this keeps being called). */
export async function touchPresence(userId: string) {
  await rest('PATCH', `profiles?id=eq.${encodeURIComponent(userId)}`, { last_seen: new Date().toISOString() });
}
export const ONLINE_WITHIN_MS = 150_000;
export const isOnline = (lastSeen?: string, now = Date.now()) => !!lastSeen && now - Date.parse(lastSeen) < ONLINE_WITHIN_MS;

// ---------------- Worlds players are hosting ----------------
/** A world someone is playing right now that you may join (the table only shows you the ones you're allowed in). */
export type HostedWorld = {
  id: string; host: string; name: string; mode: string; worldType: string;
  privacy: 'public' | 'accounts' | 'friends'; players: number; max: number; updatedAt: string;
  /** What the host wrote about the world, and its picture (an image address or a small data: URL) */
  description?: string; image?: string;
  /** Up to three server tags (see worldTags.ts), and how many players like the world (and whether you do). Likes come from vibeblox_round20.sql. */
  tags: string[]; likes: number; liked: boolean;
};
export const HOSTED_FRESH_MS = 90_000;
export const HOSTED_ID_RE = /^[a-z0-9]{8,32}$/;
/** Signed in or not: anyone can see public worlds. */
async function restAny(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
  let token: string | null = null;
  try { token = await config.getToken(); } catch { token = null; }
  return rest(method, path, body, extra, token ?? config.anonKey);
}
type HostedRow = { id: string; host_name: string; name: string; mode: string; world_type: string; privacy: string; players: number; max_players: number; updated_at: string; description?: string | null; image?: string | null; tags?: unknown };
const toHosted = (r: HostedRow): HostedWorld => ({
  id: r.id, host: r.host_name, name: r.name, mode: r.mode, worldType: r.world_type,
  privacy: r.privacy === 'friends' || r.privacy === 'accounts' ? r.privacy : 'public', players: Number(r.players) || 0, max: Number(r.max_players) || 18, updatedAt: r.updated_at,
  description: r.description ?? undefined, image: r.image ?? undefined,
  tags: cleanTags(r.tags), likes: 0, liked: false,
});
const HOSTED_COLS = 'id,host_name,name,mode,world_type,privacy,players,max_players,updated_at';
/** The extra columns (description, picture, tags) come from vibeblox_round16.sql and vibeblox_round20.sql; without them the list still works. */
let hostedExtras = true;
let hostedTags = true;
export async function listHostedWorlds(): Promise<Result<{ worlds: HostedWorld[] }>> {
  void restAny('POST', 'rpc/prune_hosted_worlds', {}); // tidy up worlds whose host vanished (fire and forget)
  const since = new Date(Date.now() - HOSTED_FRESH_MS).toISOString();
  const q = (cols: string) => restAny('GET', `hosted_worlds?select=${cols}&updated_at=gte.${encodeURIComponent(since)}&order=players.desc,updated_at.desc&limit=60`);
  const cols = () => HOSTED_COLS + (hostedExtras ? ',description,image' : '') + (hostedTags ? ',tags' : '');
  let r = await q(cols());
  if (!r.ok && r.status === 400 && hostedTags) { hostedTags = false; r = await q(cols()); } // older database: no tags yet
  if (!r.ok && r.status === 400 && hostedExtras) { hostedExtras = false; r = await q(cols()); } // older database: no pictures yet
  if (!r.ok) return fail(r.status === 404 ? 'World list isn\'t set up yet (run vibeblox_round13.sql in Supabase)' : r.error);
  const worlds = (r.data as HostedRow[]).map(toHosted);
  await addLikes(worlds);
  return { ok: true, worlds };
}
/** Fills in how many players like each world, and whether you do. Quietly does nothing if the database has no likes yet. */
let likesAvailable = true;
async function addLikes(worlds: HostedWorld[]): Promise<void> {
  if (!likesAvailable || !worlds.length) return;
  const r = await restAny('POST', 'rpc/world_likes_for', { p_ids: worlds.map((w) => w.id) });
  if (!r.ok) { if (r.status === 404) likesAvailable = false; return; }
  const byId = new Map<string, { likes: number; liked: boolean }>();
  for (const row of (Array.isArray(r.data) ? r.data : []) as Array<{ world_id: string; likes: number | string; liked: boolean }>) byId.set(row.world_id, { likes: Number(row.likes) || 0, liked: !!row.liked });
  for (const w of worlds) { const l = byId.get(w.id); if (l) { w.likes = l.likes; w.liked = l.liked; } }
}
/** Like (on = true) or un-like a world. Gives the new like count, or says why not (guests, your own world...). */
export async function setWorldLike(id: string, on: boolean): Promise<Result<{ likes: number }>> {
  if (!HOSTED_ID_RE.test(id)) return fail('Bad world id');
  const r = await rest('POST', 'rpc/like_world', { p_id: id, p_on: on });
  if (r.ok) return { ok: true, likes: Number(r.data) || 0 };
  if (r.status === 404) return fail('Likes are not set up yet (run vibeblox_round20.sql in Supabase)');
  const m = /sign in to like|guests cannot like|your own world|not open any more/.exec(String(r.error));
  return fail(m ? ({ 'sign in to like': 'Sign in to like worlds', 'guests cannot like': 'Guests cannot like worlds. Sign in with an account.', 'your own world': 'You cannot like your own world', 'not open any more': 'That world is not open any more' } as Record<string, string>)[m[0]] : r.error);
}
/** One hosted world by id (null: it's gone, or you aren't allowed to see it). */
export async function getHostedWorld(id: string): Promise<HostedWorld | null> {
  if (!HOSTED_ID_RE.test(id)) return null;
  const r = await restAny('GET', `hosted_worlds?select=id,host_name,name,mode,world_type,privacy,players,max_players,updated_at&id=eq.${id}&limit=1`);
  return r.ok && Array.isArray(r.data) && r.data[0] ? toHosted(r.data[0] as HostedRow) : null;
}
/** Lists (or refreshes) the world you are hosting. Call it every ~20 seconds while you play. */
export async function publishHostedWorld(me: Account, w: { id: string; name: string; mode: string; worldType: string; privacy: string; players: number; max: number; description?: string; image?: string; tags?: string[] }): Promise<Result> {
  if (!HOSTED_ID_RE.test(w.id)) return fail('Bad world id');
  const row: Record<string, unknown> = {
    id: w.id, host_id: me.userId, host_name: me.username, name: w.name.slice(0, 40) || 'World', mode: w.mode, world_type: w.worldType,
    privacy: w.privacy, players: Math.max(0, Math.min(100, w.players)), max_players: Math.max(1, Math.min(100, w.max)), updated_at: new Date().toISOString(),
  };
  if (hostedExtras) { row.description = (w.description ?? '').slice(0, 200); row.image = cleanWorldImage(w.image); }
  if (hostedTags) row.tags = cleanTags(w.tags);
  let r = await rest('POST', 'hosted_worlds?on_conflict=id', row, { prefer: 'resolution=merge-duplicates,return=minimal' });
  if (!r.ok && hostedTags && r.status === 400) { // older database: no tags column yet
    hostedTags = false;
    delete row.tags;
    r = await rest('POST', 'hosted_worlds?on_conflict=id', row, { prefer: 'resolution=merge-duplicates,return=minimal' });
  }
  if (!r.ok && hostedExtras && r.status === 400) { // older database: no description/picture columns yet
    hostedExtras = false;
    delete row.description; delete row.image;
    r = await rest('POST', 'hosted_worlds?on_conflict=id', row, { prefer: 'resolution=merge-duplicates,return=minimal' });
  }
  return r.ok ? { ok: true } : fail(r.error);
}
/** A world picture that is safe to list: one of the game's own images, an https address, or a small JPEG/PNG. */
export function cleanWorldImage(img?: string): string | null {
  if (!img) return null;
  if (/^\/images\/[a-z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(img)) return img;
  if (/^https:\/\/[^\s"'<>]{4,300}$/.test(img)) return img;
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(img) && img.length <= 60_000) return img;
  return null;
}
export async function unpublishHostedWorld(id: string): Promise<void> {
  if (!HOSTED_ID_RE.test(id)) return;
  await rest('DELETE', `hosted_worlds?id=eq.${id}`);
}
/** Are these two accounts friends? (Uses your own token: you can always see your own friendships.) */
export async function isFriendOf(meId: string, otherId: string): Promise<boolean> {
  const ok = /^[0-9a-f-]{36}$/i;
  if (!ok.test(meId) || !ok.test(otherId)) return false;
  const r = await rest('GET', `friendships?select=id&status=eq.accepted&or=(and(requester.eq.${meId},addressee.eq.${otherId}),and(requester.eq.${otherId},addressee.eq.${meId}))&limit=1`);
  return r.ok && Array.isArray(r.data) && r.data.length > 0;
}
/** Who is behind someone else's sign-in token? (A hosted world checks everyone who joins.) */
const whoCache = new Map<string, { v: { name: string; id: string } | null; until: number }>();
export async function verifyToken(token: string): Promise<{ name: string; id: string } | null> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return null;
  const hit = whoCache.get(token);
  if (hit && hit.until > Date.now()) return hit.v;
  let v: { name: string; id: string } | null = null;
  try {
    const res = await config.fetchImpl(`${config.url}/auth/v1/user`, { headers: { apikey: config.anonKey, authorization: `Bearer ${token}` } });
    const user = res.ok ? await res.json() as { id?: string; email_confirmed_at?: string | null } : null;
    if (user && typeof user.id === 'string' && /^[0-9a-f-]{36}$/i.test(user.id) && user.email_confirmed_at) {
      const r = await rest('GET', `profiles?id=eq.${user.id}&select=username&limit=1`, undefined, {}, token);
      const name = r.ok && Array.isArray(r.data) && r.data[0] ? String((r.data[0] as { username?: string }).username ?? '') : '';
      if (USERNAME_RE.test(name)) v = { name, id: user.id };
    }
  } catch { v = null; }
  whoCache.set(token, { v, until: Date.now() + 5 * 60_000 });
  if (whoCache.size > 200) whoCache.clear();
  return v;
}
/** Is the account behind a token an admin or on the staff ([HELPER] / [MOD])? Staff can kick, ban, mute and use commands in every world. */
export async function isAdminToken(token: string): Promise<boolean> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return false;
  const r = await rest('POST', 'rpc/is_staff', {}, {}, token);
  if (r.ok) return r.data === true;
  if (r.status === 404) { const a = await rest('POST', 'rpc/is_admin', {}, {}, token); return a.ok && a.data === true; } // database without round 21
  return false;
}
/** Globally banned (admin panel)? */
export async function isBannedName(name: string): Promise<boolean> {
  if (!USERNAME_RE.test(name)) return false;
  const r = await restAny('GET', `bans?username=eq.${encodeURIComponent(name.toLowerCase())}&select=username&limit=1`);
  return r.ok && Array.isArray(r.data) && r.data.length > 0;
}

// ---------------- Friends ----------------
export type Friend = { id: string; username: string; online: boolean; lastSeen?: string; /** The multiplayer server they are on right now (you can join them there) */ server?: string; /** The world they are playing, when it's one they host ("p2p:...") */ worldName?: string };
export type FriendState = { friends: Friend[]; incoming: Friend[]; outgoing: Friend[] };
type Row = { id: number; requester: string; addressee: string; status: 'pending' | 'accepted' };

async function friendRows(me: string): Promise<Result<{ rows: Row[] }>> {
  const r = await rest('GET', `friendships?select=id,requester,addressee,status&or=(requester.eq.${me},addressee.eq.${me})&limit=500`);
  if (!r.ok) return fail(r.error);
  return { ok: true, rows: r.data as Row[] };
}

/** Where your friends are playing right now (the table only shows friends' rows to you). */
async function friendServers(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const r = await rest('GET', `friend_presence?select=user_id,server,updated_at&user_id=in.(${ids.map(encodeURIComponent).join(',')})`);
  if (r.ok && Array.isArray(r.data)) {
    for (const x of r.data as Array<{ user_id: string; server: string; updated_at: string }>) {
      if (Date.now() - Date.parse(x.updated_at) < PRESENCE_FRESH_MS) out.set(x.user_id, x.server);
    }
  }
  return out;
}

export async function loadFriends(me: string): Promise<Result<FriendState>> {
  const rows = await friendRows(me);
  if (!rows.ok) return rows;
  const others = rows.rows.map((x) => (x.requester === me ? x.addressee : x.requester));
  const profiles = await profilesById([...new Set(others)]);
  const servers = await friendServers(rows.rows.filter((x) => x.status === 'accepted').map((x) => (x.requester === me ? x.addressee : x.requester)));
  // Friends hosting (or in) a world: its name, and no Join button once it has closed
  const worldNames = new Map<string, string>();
  const p2pIds = [...new Set([...servers.values()].filter((v) => v.startsWith('p2p:')).map((v) => v.slice(4)).filter((v) => HOSTED_ID_RE.test(v)))];
  if (p2pIds.length) {
    const since = new Date(Date.now() - HOSTED_FRESH_MS).toISOString();
    const r = await rest('GET', `hosted_worlds?select=id,name&id=in.(${p2pIds.join(',')})&updated_at=gte.${encodeURIComponent(since)}`);
    if (r.ok && Array.isArray(r.data)) for (const w of r.data as Array<{ id: string; name: string }>) worldNames.set(w.id, w.name);
    for (const [uid, v] of servers) if (v.startsWith('p2p:') && !worldNames.has(v.slice(4))) servers.delete(uid);
  }
  const toFriend = (id: string): Friend => {
    const p = profiles.get(id);
    const server = servers.get(id);
    return { id, username: p?.username ?? 'Unknown', online: isOnline(p?.last_seen) || !!server, lastSeen: p?.last_seen, server, worldName: server?.startsWith('p2p:') ? worldNames.get(server.slice(4)) : undefined };
  };
  const state: FriendState = { friends: [], incoming: [], outgoing: [] };
  for (const x of rows.rows) {
    const other = x.requester === me ? x.addressee : x.requester;
    if (x.status === 'accepted') state.friends.push(toFriend(other));
    else if (x.addressee === me) state.incoming.push(toFriend(other));
    else state.outgoing.push(toFriend(other));
  }
  const byName = (a: Friend, b: Friend) => Number(b.online) - Number(a.online) || lower(a.username).localeCompare(lower(b.username));
  state.friends.sort(byName);
  state.incoming.sort(byName);
  state.outgoing.sort(byName);
  return { ok: true, ...state };
}

/** /friend <name>: sends a request, or accepts theirs if they already asked you. */
export async function addFriend(me: Account, name: string): Promise<Result<{ message: string; accepted: boolean }>> {
  if (isGuestName(me.username)) return fail('Create an account to add friends');
  const clean = name.trim();
  if (!USERNAME_RE.test(clean)) return fail('That is not a valid username');
  if (lower(clean) === lower(me.username)) return fail("You can't add yourself");
  if (isGuestName(clean)) return fail(`${clean} is a guest. Guests can't have friends until they sign in.`);
  const found = await profileByName(clean);
  if (!found.ok) return found;
  if (!found.profile) return fail(`No player named ${clean}`);
  const them = found.profile;
  const rows = await friendRows(me.userId);
  if (!rows.ok) return rows;
  const existing = rows.rows.find((x) => (x.requester === me.userId && x.addressee === them.id) || (x.requester === them.id && x.addressee === me.userId));
  if (existing) {
    if (existing.status === 'accepted') return fail(`You and ${them.username} are already friends`);
    if (existing.addressee === me.userId) {
      const u = await rest('PATCH', `friendships?id=eq.${existing.id}`, { status: 'accepted' });
      if (!u.ok) return fail(u.error);
      return { ok: true, accepted: true, message: `You and ${them.username} are now friends!` };
    }
    return fail(`You already sent ${them.username} a request`);
  }
  const c = await rest('POST', 'friendships', { requester: me.userId, addressee: them.id, status: 'pending' });
  if (!c.ok) return fail(c.error);
  return { ok: true, accepted: false, message: `Friend request sent to ${them.username}` };
}

async function rowWith(me: string, otherId: string): Promise<Row | null> {
  const rows = await friendRows(me);
  if (!rows.ok) return null;
  return rows.rows.find((x) => (x.requester === me && x.addressee === otherId) || (x.requester === otherId && x.addressee === me)) ?? null;
}
export async function acceptFriend(me: Account, otherId: string): Promise<Result> {
  const row = await rowWith(me.userId, otherId);
  if (!row || row.status !== 'pending' || row.addressee !== me.userId) return fail('That request is gone');
  const u = await rest('PATCH', `friendships?id=eq.${row.id}`, { status: 'accepted' });
  return u.ok ? { ok: true } : fail(u.error);
}
/** Decline a request, cancel one you sent, or unfriend (they all delete the row). */
export async function removeFriend(me: Account, otherId: string): Promise<Result> {
  const row = await rowWith(me.userId, otherId);
  if (!row) return { ok: true };
  const d = await rest('DELETE', `friendships?id=eq.${row.id}`);
  return d.ok ? { ok: true } : fail(d.error);
}
/** /unfriend <name> */
export async function unfriendByName(me: Account, name: string): Promise<Result<{ message: string }>> {
  const found = await profileByName(name);
  if (!found.ok) return found;
  if (!found.profile) return fail(`No player named ${name.trim()}`);
  const row = await rowWith(me.userId, found.profile.id);
  if (!row || row.status !== 'accepted') return fail(`${found.profile.username} isn't your friend`);
  const d = await removeFriend(me, found.profile.id);
  if (!d.ok) return d;
  return { ok: true, message: `You are no longer friends with ${found.profile.username}` };
}

// ---------------- Private messages ----------------
export type DM = { id: number; from: string; to: string; text: string; at: string };
type DMRow = { id: number; sender: string; recipient: string; body: string; created_at: string };
const toDM = (r: DMRow): DM => ({ id: r.id, from: r.sender, to: r.recipient, text: r.body, at: r.created_at });
export const DM_MAX = 300;

export async function sendDM(me: Account, friendId: string, text: string): Promise<Result<{ dm: DM }>> {
  const body = text.trim().slice(0, DM_MAX);
  if (!body) return fail('Type a message first');
  const r = await rest('POST', 'direct_messages', { sender: me.userId, recipient: friendId, body });
  if (!r.ok) return r.status === 403 ? fail('You can only message your friends') : fail(r.error);
  return { ok: true, dm: toDM((r.data as DMRow[])[0]) };
}
/** The conversation with one friend, oldest first. */
export async function loadConversation(me: string, friendId: string, limit = 60): Promise<Result<{ messages: DM[] }>> {
  const r = await rest('GET', `direct_messages?select=id,sender,recipient,body,created_at&or=(and(sender.eq.${me},recipient.eq.${friendId}),and(sender.eq.${friendId},recipient.eq.${me}))&order=id.desc&limit=${limit}`);
  if (!r.ok) return fail(r.error);
  return { ok: true, messages: (r.data as DMRow[]).map(toDM).reverse() };
}
/** Messages sent to you after `afterId` (for notifications and unread counts). */
export async function loadNewMessages(me: string, afterId: number): Promise<Result<{ messages: DM[] }>> {
  const r = await rest('GET', `direct_messages?select=id,sender,recipient,body,created_at&recipient=eq.${me}&id=gt.${Math.max(0, afterId)}&order=id.asc&limit=100`);
  if (!r.ok) return fail(r.error);
  return { ok: true, messages: (r.data as DMRow[]).map(toDM) };
}

// ---------------- Announcements ----------------
export type Announcement = { id: number; text: string; author: string; at: string };
type AnnRow = { id: number; body: string; author: string; created_at: string };
const toAnn = (r: AnnRow): Announcement => ({ id: r.id, text: r.body, author: r.author, at: r.created_at });
export const ANNOUNCE_MAX = 240;
/** How long after it's made an announcement still shows (it is checked every few seconds; a little slack for clocks) */
export const ANNOUNCE_LIVE_MS = 90_000;

/** Announcements with an id above `afterId` (everyone, signed in or not, can read them). */
export async function loadAnnouncements(afterId: number, token?: string | null): Promise<Result<{ items: Announcement[] }>> {
  let current: string | null = null;
  try { current = await config.getToken(); } catch { current = null; }
  const r = await rest('GET', `announcements?select=id,body,author,created_at&id=gt.${Math.max(0, afterId)}&order=id.asc&limit=20`, undefined, {}, current || token || config.anonKey); // guests read with the public key
  if (!r.ok) return fail(r.error);
  return { ok: true, items: (r.data as AnnRow[]).map(toAnn) };
}
export async function postAnnouncement(me: Account, text: string): Promise<Result<{ item: Announcement }>> {
  const body = text.trim().slice(0, ANNOUNCE_MAX);
  if (!body) return fail('Type the announcement first');
  const r = await rest('POST', 'announcements', { body, author: me.username });
  if (!r.ok) return r.status === 403 ? fail(isOwnerName(me.username) ? NOT_ADMIN_HINT : 'Only admins can do that') : fail(r.error);
  return { ok: true, item: toAnn((r.data as AnnRow[])[0]) };
}

// ---------------- Admin ----------------
/** Shown when the database refuses an admin action: usually its owner name doesn't match the game's. */
export const NOT_ADMIN_HINT = `The database doesn't see you as an admin. In Supabase, open SQL Editor and run vibeblox_round13.sql (it makes ${OWNER_NAME} the owner again).`;
export const RANKS = ['none', 'vanguard', 'elite', 'champion'] as const;
export type RankName = (typeof RANKS)[number];
export const RANK_LABELS: Record<RankName, string> = { none: 'No rank', vanguard: 'Vanguard', elite: 'Elite', champion: 'Champion' };
/** Owner only: give a player a rank (or take it away with 'none'). Returns their name as the database spells it. */
export async function giveRank(username: string, rank: string, hours?: number | null): Promise<Result<{ username: string; pending: boolean }>> {
  const name = username.trim();
  if (!USERNAME_RE.test(name)) return fail('That is not a valid username');
  if (!(RANKS as readonly string[]).includes(rank)) return fail('Pick a rank');
  const temp = hours != null && rank !== 'none';
  if (temp && !(Number.isInteger(hours) && hours! >= 1 && hours! <= 87600)) return fail('Pick how long the rank lasts (1 hour or more)');
  const r = await rest('POST', 'rpc/give_rank', temp ? { p_username: name, p_rank: rank, p_hours: hours } : { p_username: name, p_rank: rank });
  if (!r.ok && temp && /p_hours|function|schema cache|not find/i.test(r.error)) return fail('Run vibeblox_round17.sql in Supabase to give ranks for a limited time');
  if (!r.ok) return r.status === 403 || /owner only/i.test(r.error) ? fail('Only the owner can give ranks. ' + NOT_ADMIN_HINT) : fail(r.error);
  if (typeof r.data !== 'string' || !r.data) return fail(`Nobody is called ${name}`);
  // The player does not have to be online. With no account yet, the rank waits and they get it when they sign up.
  const pending = rank !== 'none' && (await rankInfo(r.data)) === null;
  return { ok: true, username: r.data, pending };
}
/** Is a rank waiting for a username that has no account yet? (owner only) */
export async function rankPending(username: string): Promise<boolean> {
  if (!USERNAME_RE.test(username.trim())) return false;
  const r = await rest('POST', 'rpc/rank_pending', { p_username: username.trim() });
  return r.ok && r.data === true;
}
/** A player's rank, or null if there is no such player. */
export async function rankOf(username: string): Promise<string | null> {
  const i = await rankInfo(username);
  return i ? i.rank : null;
}
/** A player's rank and when it runs out (until = null: it lasts for good), or null if there is no such player. */
export async function rankInfo(username: string): Promise<{ rank: string; until: string | null } | null> {
  if (!USERNAME_RE.test(username.trim())) return null;
  const q = encodeURIComponent(username.trim());
  await rest('POST', 'rpc/expire_ranks', {}).catch(() => undefined);
  let r = await rest('GET', `profiles?select=username,rank,rank_until&username=ilike.${q}&limit=1`);
  if (!r.ok) r = await rest('GET', `profiles?select=username,rank&username=ilike.${q}&limit=1`);
  if (!r.ok || !Array.isArray(r.data) || !r.data[0]) return null;
  const row = r.data[0] as { rank?: string; rank_until?: string | null };
  return { rank: String(row.rank ?? 'none'), until: row.rank_until ?? null };
}
// ---------------- Staff ranks ([HELPER], [MOD]): the owner adds them in the Admin panel ----------------
export const STAFF_RANKS = ['helper', 'mod'] as const;
export type StaffRank = (typeof STAFF_RANKS)[number];
export const STAFF_LABELS: Record<StaffRank, string> = { helper: 'HELPER', mod: 'MOD' };
export type StaffRow = { username: string; role: StaffRank };
/** Owner only: make a player a helper or a mod (role 'none' takes it away). Returns their name as the database spells it. */
export async function setStaffRank(username: string, role: StaffRank | 'none'): Promise<Result<{ username: string }>> {
  const name = username.trim();
  if (!USERNAME_RE.test(name)) return fail('That is not a valid username');
  if (isOwnerName(name)) return fail('The owner already has every power');
  const r = await rest('POST', 'rpc/set_staff', { p_username: name, p_role: role });
  if (!r.ok) return /owner only/i.test(r.error) || r.status === 403 ? fail('Only the owner can choose staff') : fail(/function|schema cache|not find/i.test(r.error) || r.status === 404 ? 'Run vibeblox_round21.sql in Supabase to add staff ranks' : r.error);
  if (typeof r.data !== 'string' || !r.data) return fail(`Nobody is called ${name}`);
  return { ok: true, username: r.data };
}
/** Everybody on the staff (admins only). */
export async function listStaff(): Promise<Result<{ staff: StaffRow[] }>> {
  const r = await rest('POST', 'rpc/list_staff', {});
  if (!r.ok) return fail(/function|schema cache|not find/i.test(r.error) || r.status === 404 ? 'Run vibeblox_round21.sql in Supabase to add staff ranks' : r.error);
  const rows = (Array.isArray(r.data) ? r.data : []) as Array<{ username?: string; role?: string }>;
  return { ok: true, staff: rows.filter((x) => x.role === 'helper' || x.role === 'mod').map((x) => ({ username: String(x.username), role: x.role as StaffRank })) };
}
export async function checkAdmin(): Promise<boolean> {
  const r = await rest('POST', 'rpc/is_admin', {});
  return r.ok && r.data === true;
}
// ---------------- Admins (the owner picks them in the Admin panel) ----------------
/** Everyone who can open the Admin panel. */
export async function listAdmins(): Promise<Result<{ admins: string[] }>> {
  const r = await rest('POST', 'rpc/list_admins', {});
  if (!r.ok) return fail(/function|schema cache|not find/i.test(r.error) ? 'Run vibeblox_round16.sql in Supabase to manage admins here' : r.error);
  return { ok: true, admins: (Array.isArray(r.data) ? r.data : []).map((x: unknown) => String((x as { username?: string }).username ?? x)) };
}
/** The owner makes someone an admin (on = true) or takes it away. Returns the name as stored. */
export async function setAdmin(username: string, on: boolean): Promise<Result<{ username: string }>> {
  const name = username.trim();
  if (!USERNAME_RE.test(name)) return fail('That is not a valid username');
  if (isOwnerName(name)) return fail('The owner is always an admin');
  const r = await rest('POST', 'rpc/set_admin', { p_username: name, p_on: on });
  if (!r.ok) return /owner only/i.test(r.error) || r.status === 403 ? fail('Only the owner can choose admins') : fail(/function|schema cache|not find/i.test(r.error) ? 'Run vibeblox_round16.sql in Supabase to manage admins here' : r.error);
  if (typeof r.data !== 'string' || !r.data) return fail(`Nobody is called ${name}`);
  return { ok: true, username: r.data };
}

// ---------------- Anti-cheat reports (hosts' games send them; admins read them) ----------------
export type CheatReport = { id: number; world: string; host: string; player: string; kind: string; detail: string; at: string };
/** Sent by the host's game when anti-cheat catches someone in their world. Fire and forget. */
export async function reportCheat(me: Account | null, rep: { world: string; player: string; kind: string; detail: string }): Promise<void> {
  if (!me) return;
  await rest('POST', 'anticheat_reports', {
    world: rep.world.slice(0, 40), host_name: me.username, player: rep.player.slice(0, 16), kind: rep.kind.slice(0, 20), detail: rep.detail.slice(0, 200),
  }, { prefer: 'return=minimal' });
}
/** The latest reports from every world (admins only). */
export async function listCheatReports(limit = 100): Promise<Result<{ reports: CheatReport[] }>> {
  const r = await rest('GET', `anticheat_reports?select=id,world,host_name,player,kind,detail,created_at&order=created_at.desc&limit=${Math.max(1, Math.min(300, limit))}`);
  if (!r.ok) return fail(r.error === SETUP_HINT ? 'Run vibeblox_round16.sql in Supabase to collect anti-cheat reports' : r.error);
  return { ok: true, reports: (r.data as Array<{ id: number; world: string; host_name: string; player: string; kind: string; detail: string; created_at: string }>).map((x) => ({ id: x.id, world: x.world, host: x.host_name, player: x.player, kind: x.kind, detail: x.detail, at: x.created_at })) };
}

// ---------------- Loyalty rewards (see loyalty.ts and vibeblox_round18.sql) ----------------
export type LoyaltyInfo = { createdAt: number; now: number; claimed: number[] };
/** How old your account is and which loyalty rewards you already took (null: not signed in, or not set up). */
export async function fetchLoyalty(): Promise<LoyaltyInfo | null> {
  const r = await rest('POST', 'rpc/loyalty_status', {});
  if (!r.ok || !r.data || typeof r.data !== 'object') return null;
  const d = r.data as { created_at?: string; now?: string; claimed?: number[] };
  const created = Date.parse(d.created_at ?? '');
  if (!Number.isFinite(created)) return null;
  const serverNow = Date.parse(d.now ?? '');
  return { createdAt: created, now: Number.isFinite(serverNow) ? serverNow : Date.now(), claimed: Array.isArray(d.claimed) ? d.claimed.filter((n) => typeof n === 'number') : [] };
}
/** Take a loyalty reward: the rank you picked (or 'skip' for the 1, 3, 5... month rewards). */
export async function claimLoyalty(month: number, choice: 'vanguard' | 'elite' | 'champion' | 'skip'): Promise<Result<{ outcome: 'ok' | 'kept' | 'skipped' }>> {
  const r = await rest('POST', 'rpc/claim_loyalty', { p_milestone: month, p_choice: choice });
  if (!r.ok) return fail(/function|schema cache|not find/i.test(r.error) ? 'Run vibeblox_round18.sql in Supabase to turn on loyalty rewards' : /not yet/i.test(r.error) ? 'This reward is not ready yet' : /already claimed/i.test(r.error) ? 'You already took this reward' : /earlier rewards/i.test(r.error) ? 'Take your earlier rewards first' : r.error);
  const o = r.data === 'kept' || r.data === 'skipped' ? r.data : 'ok';
  return { ok: true, outcome: o };
}

// ---------------- Your level, saved to your account ----------------
/** Saves your progress (level, XP, coins, cosmetics) to your account, so it follows you to other devices. */
export async function saveProgressToAccount(progress: unknown): Promise<boolean> {
  const r = await rest('POST', 'rpc/save_progress', { p_progress: progress });
  return r.ok;
}
/** The progress saved on your account (null: none yet, or not set up). */
export async function loadProgressFromAccount(): Promise<unknown | null> {
  const r = await rest('POST', 'rpc/my_progress', {});
  return r.ok && r.data && typeof r.data === 'object' ? r.data : null;
}
export type LevelRow = { username: string; level: number; xp: number; rank: string };
/** The players with the highest levels (null if it can't be reached / isn't set up). */
export async function fetchLevelLeaderboard(limit = 50): Promise<LevelRow[] | null> {
  const r = await rpcPublic('level_leaderboard', { p_limit: limit });
  if (!r.ok || !Array.isArray(r.data)) return null;
  return (r.data as Array<{ username: string; level: number | string; xp: number | string; rank?: string }>).map((x) => ({ username: x.username, level: Number(x.level) || 1, xp: Number(x.xp) || 0, rank: x.rank ?? 'none' }));
}

export type Ban = { username: string; reason: string; by: string };
export async function listBans(): Promise<Result<{ bans: Ban[] }>> {
  const r = await rest('GET', 'bans?select=username,reason,banned_by&order=created_at.desc&limit=100');
  if (!r.ok) return fail(r.error);
  return { ok: true, bans: (r.data as Array<{ username: string; reason: string; banned_by: string }>).map((b) => ({ username: b.username, reason: b.reason ?? '', by: b.banned_by ?? '' })) };
}
export async function banEverywhere(me: Account, username: string, reason = ''): Promise<Result> {
  const name = lower(username.trim());
  if (!USERNAME_RE.test(name)) return fail('That is not a valid username');
  if (name === lower(me.username)) return fail("You can't ban yourself");
  if (isOwnerName(name)) return fail("You can't ban the owner");
  const r = await rest('POST', 'bans', { username: name, reason: reason.slice(0, 120), banned_by: me.username }, { prefer: 'resolution=merge-duplicates,return=representation' });
  if (!r.ok) return r.status === 403 ? fail(isOwnerName(me.username) ? NOT_ADMIN_HINT : "You can't ban that player (staff can't ban admins or other staff; the owner must run vibeblox_indev27.sql in Supabase for staff bans)") : fail(r.error);
  return { ok: true };
}
export async function unbanEverywhere(username: string): Promise<Result> {
  const r = await rest('DELETE', `bans?username=eq.${encodeURIComponent(lower(username.trim()))}`);
  return r.ok ? { ok: true } : fail(r.error);
}

// ---------------- Keeping up (polling) ----------------
export type Poller = { stop: () => void; refresh: () => Promise<void> };
export type PollHandlers = {
  onMessages?: (messages: DM[]) => void;
  onAnnouncements?: (items: Announcement[]) => void;
  /** Called with the number of incoming friend requests whenever it changes. */
  onRequests?: (count: number, from: Friend[]) => void;
  /** Called when the setup problem (e.g. missing tables) means nothing will work. */
  onError?: (message: string) => void;
};
const lsKey = (userId: string, what: string) => `vibeblox_${what}_${userId}`;
export function getLastSeenDM(userId: string): number { return Number(config.storage.getItem(lsKey(userId, 'dm'))) || 0; }
export function setLastSeenDM(userId: string, id: number) { config.storage.setItem(lsKey(userId, 'dm'), String(id)); }
export function getLastAnnouncement(): number { return Number(config.storage.getItem('vibeblox_announce')) || 0; }
export function setLastAnnouncement(id: number) { config.storage.setItem('vibeblox_announce', String(id)); }

/**
 * Checks for new messages, friend requests and announcements every few seconds and keeps you "online".
 * The first run only reads (it never replays old announcements; messages arrive as unread).
 */
export function startPolling(account: Account | null, handlers: PollHandlers, everyMs = 8000): Poller {
  let stopped = false;
  let lastRequests = -1;
  let tick = 0;
  let failedOnce = false;
  let running: Promise<void> | null = null;
  const run = (): Promise<void> => {
    // Never let two checks overlap (they would both report the same new messages)
    if (!running) running = check().finally(() => { running = null; });
    return running;
  };
  const check = async () => {
    if (stopped) return;
    tick++;
    if (account && !isGuestName(account.username)) {
      if (tick % 4 === 1) void touchPresence(account.userId);
      const last = getLastSeenDM(account.userId);
      const m = await loadNewMessages(account.userId, last);
      if (m.ok) {
        if (m.messages.length) {
          setLastSeenDM(account.userId, m.messages[m.messages.length - 1].id);
          handlers.onMessages?.(m.messages);
        }
      } else if (!failedOnce) { failedOnce = true; handlers.onError?.(m.error); }
      if (tick % 2 === 1) {
        const f = await loadFriends(account.userId);
        if (f.ok && f.incoming.length !== lastRequests) {
          if (lastRequests !== -1 || f.incoming.length) handlers.onRequests?.(f.incoming.length, f.incoming);
          lastRequests = f.incoming.length;
        }
      }
    }
    const lastAnn = getLastAnnouncement();
    const a = await loadAnnouncements(lastAnn, account?.token);
    if (a.ok && a.items.length) {
      setLastAnnouncement(a.items[a.items.length - 1].id);
      // Announcements are live: you only see one if you are here when it's made (not old ones when you come back later)
      const fresh = a.items.filter((x) => Math.abs(Date.now() - Date.parse(x.at)) < ANNOUNCE_LIVE_MS);
      if (fresh.length) handlers.onAnnouncements?.(fresh);
    }
  };
  const timer = setInterval(() => { void run(); }, everyMs);
  void run();
  return { stop: () => { stopped = true; clearInterval(timer); }, refresh: run };
}
