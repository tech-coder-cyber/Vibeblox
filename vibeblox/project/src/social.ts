// Accounts, friends, private messages, announcements and admin tools for VibeBlox.
//
// Everything lives in the Supabase project (tables are created by server/supabase_social.sql). This file talks
// to it with plain fetch() calls to the REST API, using the access token of the signed-in player, so every
// request is checked by Row Level Security in the database -- a modified game can not read other people's
// messages, add itself as an admin or announce things.
//
// Nothing here throws: every function returns { ok, ... } with a message that is fine to show the player.

export const SUPABASE_URL = 'https://okhtosecqytklgwouwxv.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_kyklbTdQk64bRSdGSrEX0w_1lKAD4X0';

export type Account = { userId: string; username: string; token: string };
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

// ---------------- Names ----------------
export const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
export const isGuestName = (name: string) => /^Guest_/i.test(name);
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
  const r = await rest('GET', `profiles?select=id,username&id=eq.${encodeURIComponent(userId)}&limit=1`, undefined, {}, token);
  if (r.ok && (r.data as Profile[])[0]) return { userId, username: (r.data as Profile[])[0].username, token };
  // No profile yet (the SQL trigger was not installed, or this account is older): make one
  let name = wantedName.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
  if (name.length < 3) name = 'Player' + Math.floor(Math.random() * 9000 + 1000);
  for (let i = 0; i < 4; i++) {
    const candidate = i === 0 ? name : name.slice(0, 12) + Math.floor(Math.random() * 9000 + 1000);
    const c = await rest('POST', 'profiles', { id: userId, username: candidate }, {}, token);
    if (c.ok) return { userId, username: candidate, token };
    if (c.status !== 409) break;
  }
  return { userId, username: name, token };
}

/** Marks you as online (friends see a green dot while this keeps being called). */
export async function touchPresence(userId: string) {
  await rest('PATCH', `profiles?id=eq.${encodeURIComponent(userId)}`, { last_seen: new Date().toISOString() });
}
export const ONLINE_WITHIN_MS = 150_000;
export const isOnline = (lastSeen?: string, now = Date.now()) => !!lastSeen && now - Date.parse(lastSeen) < ONLINE_WITHIN_MS;

// ---------------- Friends ----------------
export type Friend = { id: string; username: string; online: boolean; lastSeen?: string };
export type FriendState = { friends: Friend[]; incoming: Friend[]; outgoing: Friend[] };
type Row = { id: number; requester: string; addressee: string; status: 'pending' | 'accepted' };

async function friendRows(me: string): Promise<Result<{ rows: Row[] }>> {
  const r = await rest('GET', `friendships?select=id,requester,addressee,status&or=(requester.eq.${me},addressee.eq.${me})&limit=500`);
  if (!r.ok) return fail(r.error);
  return { ok: true, rows: r.data as Row[] };
}

export async function loadFriends(me: string): Promise<Result<FriendState>> {
  const rows = await friendRows(me);
  if (!rows.ok) return rows;
  const others = rows.rows.map((x) => (x.requester === me ? x.addressee : x.requester));
  const profiles = await profilesById([...new Set(others)]);
  const toFriend = (id: string): Friend => {
    const p = profiles.get(id);
    return { id, username: p?.username ?? 'Unknown', online: isOnline(p?.last_seen), lastSeen: p?.last_seen };
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
  if (!r.ok) return r.status === 403 ? fail('Only admins can announce') : fail(r.error);
  return { ok: true, item: toAnn((r.data as AnnRow[])[0]) };
}

// ---------------- Admin ----------------
export async function checkAdmin(): Promise<boolean> {
  const r = await rest('POST', 'rpc/is_admin', {});
  return r.ok && r.data === true;
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
  const r = await rest('POST', 'bans', { username: name, reason: reason.slice(0, 120), banned_by: me.username }, { prefer: 'resolution=merge-duplicates,return=representation' });
  if (!r.ok) return r.status === 403 ? fail('Only admins can ban') : fail(r.error);
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
      // The first time ever, only show announcements from the last 10 minutes (not the whole history)
      const fresh = lastAnn === 0 ? a.items.filter((x) => Date.now() - Date.parse(x.at) < 600_000) : a.items;
      if (fresh.length) handlers.onAnnouncements?.(fresh);
    }
  };
  const timer = setInterval(() => { void run(); }, everyMs);
  void run();
  return { stop: () => { stopped = true; clearInterval(timer); }, refresh: run };
}
