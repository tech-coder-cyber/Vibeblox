// VibeBlox multiplayer server
// ---------------------------------------------------------------
// Zero dependencies: just Node.js 18+ (no npm install needed).
// Every player generates the world from the same seed, so this server
// only has to share what CHANGES: block edits, player positions, chat,
// and the time of day. Block edits are saved to world.json so the
// world survives restarts.
//
// Settings (environment variables, all optional):
//   PORT=8080  MAX_PLAYERS=18  SEED=12345  WORLD_TYPE=default|superflat
//   (MAX_PLAYERS: normally 18 players, or 24 when the host is a Rising Creator; set it to force one number)
//   DEFAULT_MODE=survival|creative|adventure  WORLD_FILE=./world.json
//   WEATHER_CYCLE=1   (0 = the weather only changes when the host changes it)
//   EXPERIMENTAL=1    (a NEW world gets experimental features; fixed once the world exists)
//   SUPABASE_URL / SUPABASE_ANON_KEY   (the project that holds accounts, admins and global bans; used to
//                     check that a /panel action really comes from an admin. Defaults to the game's project.)
'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8080);
const ENV_MAX = process.env.MAX_PLAYERS ? Number(process.env.MAX_PLAYERS) : null;
// Players in a world, by the host's creator tier (plays on their worlds). Keep in step with PLAYER_CAP in src/ranks.ts.
const CAPS = { none: 18, rising: 24, popular: 32, star: 48 };
const TIER_PLAYS = { rising: 1_000, popular: 10_000, star: 100_000 };
const tierOfPlays = (plays) => (plays >= TIER_PLAYS.star ? 'star' : plays >= TIER_PLAYS.popular ? 'popular' : plays >= TIER_PLAYS.rising ? 'rising' : 'none');
const OWNER_NAME = 'master';
let hostTier = 'none';
const maxPlayers = () => (ENV_MAX && ENV_MAX > 0 ? ENV_MAX : CAPS[hostTier] || CAPS.none);
const WORLD_FILE = process.env.WORLD_FILE || path.join(__dirname, 'world.json');
const PROTOCOL = 17; // must match PROTOCOL_VERSION in the game (17: world roles + host hand-over (P2P worlds only; ignored here); 16: shared dropped items, host commands on players; 15: turned heads, low trapdoors; 14: /title, fake ranks, badges; 13: sleeping, whispers, admin panel)
const DAY_LENGTH = 600; // seconds, must match the game
const MAX_FRAME = 64 * 1024; // biggest message a client may send
const VALID_MODES = ['survival', 'creative', 'adventure'];
const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://okhtosecqytklgwouwxv.supabase.co').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_kyklbTdQk64bRSdGSrEX0w_1lKAD4X0';
const SLEEP_SECONDS = 3; // must match the game: how long you lie in bed before the night can pass

// ---------------- World state ----------------
// Server rules the host can change from Manage Server (everyone gets them)
const DEFAULT_SETTINGS = { difficulty: 'normal', keepInventory: false, scripts: true, mods: true, commands: true };
const DIFFICULTIES = ['peaceful', 'easy', 'normal', 'hard'];
const WEATHERS = ['clear', 'rain', 'snow', 'thunder'];
const WEATHER_CYCLE = process.env.WEATHER_CYCLE !== '0';
// Fake ranks (/rank add Owner ...): names in front of players, set by the host. Same rules as cleanFakeRanks in src/fakeranks.ts.
const RANK_NAME_RE = /^[A-Za-z0-9_]{1,16}$/, PLAYER_RE = /^[A-Za-z0-9_]{3,16}$/;
function cleanRanks(v) {
  const out = { defs: {}, members: {} };
  if (!v || typeof v !== 'object') return out;
  if (v.defs && typeof v.defs === 'object') {
    for (const [k, d] of Object.entries(v.defs)) {
      if (Object.keys(out.defs).length >= 30) break;
      if (!d || typeof d.name !== 'string' || typeof d.tag !== 'string' || !RANK_NAME_RE.test(d.name) || k !== d.name.toLowerCase()) continue;
      out.defs[k] = { name: d.name, tag: d.tag.slice(0, 80) };
    }
  }
  if (v.members && typeof v.members === 'object') {
    for (const [pl, r] of Object.entries(v.members)) {
      if (Object.keys(out.members).length >= 200) break;
      if (typeof r !== 'string' || !out.defs[r] || !PLAYER_RE.test(pl) || pl !== pl.toLowerCase()) continue;
      out.members[pl] = r;
    }
  }
  return out;
}
function loadWorld() {
  try {
    const w = JSON.parse(fs.readFileSync(WORLD_FILE, 'utf8'));
    console.log(`Loaded ${WORLD_FILE}: seed ${w.seed}, ${Object.keys(w.changes || {}).length} block edits`);
    return { seed: w.seed, worldType: w.worldType || 'default', mode: w.mode || 'survival', changes: w.changes || {}, time: w.time ?? 0.02, settings: { ...DEFAULT_SETTINGS, ...(w.settings || {}) }, bans: Array.isArray(w.bans) ? w.bans : [], weather: WEATHERS.includes(w.weather) ? w.weather : 'clear', experimental: !!w.experimental, ranks: cleanRanks(w.ranks) };
  } catch {
    const seed = process.env.SEED ? Number(process.env.SEED) : 1 + Math.floor(Math.random() * 2_000_000_000);
    const worldType = process.env.WORLD_TYPE === 'superflat' ? 'superflat' : 'default';
    const mode = VALID_MODES.includes(process.env.DEFAULT_MODE) ? process.env.DEFAULT_MODE : 'survival';
    console.log(`Created a new world: seed ${seed}, ${worldType}, ${mode}`);
    const experimental = process.env.EXPERIMENTAL === '1';
    return { seed, worldType, mode, changes: {}, time: 0.02, settings: { ...DEFAULT_SETTINGS }, bans: [], weather: 'clear', experimental, ranks: cleanRanks(null) };
  }
}
const world = loadWorld();
let worldDirty = true;
const timeBase = { at: Date.now(), value: world.time };

function currentTime() {
  return (timeBase.value + (Date.now() - timeBase.at) / 1000 / DAY_LENGTH) % 1;
}

function saveWorld() {
  if (!worldDirty) return;
  world.time = currentTime();
  const tmp = WORLD_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(world));
  fs.renameSync(tmp, WORLD_FILE); // atomic: a crash mid-save can't corrupt the world
  worldDirty = false;
}
setInterval(saveWorld, 30_000);

// ---------------- Admins and global bans (Supabase) ----------------
// The game never trusts a client that says "I am an admin": it asks Supabase, using the access token
// the player signed in with, whether that account is in the admins table.
async function sb(pathAndQuery, token, init = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 4000);
  try {
    const res = await fetch(SUPABASE_URL + pathAndQuery, {
      ...init,
      signal: ctl.signal,
      headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${token || SUPABASE_ANON_KEY}`, 'content-type': 'application/json', ...(init.headers || {}) },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
const adminCache = new Map(); // token -> { ok, until }
const mutes = new Set(); // lowercase names muted by staff (until the server restarts)
async function isAdminToken(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return false;
  const hit = adminCache.get(token);
  if (hit && hit.until > Date.now()) return hit.ok;
  // admins and staff ([HELPER] / [MOD]) can use the /panel actions; older databases only have is_admin
  let r = await sb('/rest/v1/rpc/is_staff', token, { method: 'POST', body: '{}' });
  if (r !== true && r !== false) r = await sb('/rest/v1/rpc/is_admin', token, { method: 'POST', body: '{}' });
  const ok = r === true;
  adminCache.set(token, { ok, until: Date.now() + 60_000 });
  if (adminCache.size > 200) adminCache.clear();
  return ok;
}
/**
 * Who is behind an access token? Returns the VibeBlox username of that (email-verified) account, or null.
 * This is what stops anyone from joining as someone else's name (or as the owner).
 */
const whoCache = new Map(); // token -> { name, until }
async function verifiedName(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return null;
  const hit = whoCache.get(token);
  if (hit && hit.until > Date.now()) return hit.name;
  const user = await sb('/auth/v1/user', token);
  let name = null;
  if (user && typeof user.id === 'string' && /^[0-9a-f-]{36}$/i.test(user.id) && user.email_confirmed_at) {
    const rows = await sb(`/rest/v1/profiles?id=eq.${user.id}&select=username&limit=1`, token);
    if (Array.isArray(rows) && rows[0] && typeof rows[0].username === 'string' && /^[A-Za-z0-9_]{3,16}$/.test(rows[0].username)) name = rows[0].username;
  }
  whoCache.set(token, { name, until: Date.now() + 5 * 60_000 });
  if (whoCache.size > 300) whoCache.clear();
  return name;
}
/** Plays and rank of a username (public function in Supabase): decides 18/24 players and who may wear a custom skin. */
const standingCache = new Map(); // lowercase name -> { rising, rank, until }
async function standingOf(name) {
  const key = String(name).toLowerCase();
  const hit = standingCache.get(key);
  if (hit && hit.until > Date.now()) return hit;
  const r = await sb('/rest/v1/rpc/player_standing', null, { method: 'POST', body: JSON.stringify({ p_username: name }) });
  const row = Array.isArray(r) ? r[0] : null;
  const plays = row ? Number(row.plays) || 0 : 0;
  const out = { plays, tier: tierOfPlays(plays), rising: !!(row && row.rising), rank: row && typeof row.rank === 'string' ? row.rank : 'none', staff: row && (row.staff === 'helper' || row.staff === 'mod') ? row.staff : null, until: Date.now() + 5 * 60_000 };
  standingCache.set(key, out);
  if (standingCache.size > 300) standingCache.clear();
  return out;
}
/** The server is as big as its host's standing allows (18 normally, up to 48 for a Star Creator). */
async function refreshHostRising() {
  const h = hostId === null ? null : players.get(hostId);
  if (!h || !h.verified) { hostTier = 'none'; return; }
  hostTier = h.name.toLowerCase() === OWNER_NAME ? 'star' : (await standingOf(h.name)).tier;
}
/** What shows in front of a signed-in player's name: owner, paid rank and creator tier. Everyone is told. */
async function sendBadge(p) {
  if (!p.verified) return;
  const st = await standingOf(p.name);
  if (p.conn.closed) return;
  p.badge = { owner: p.name.toLowerCase() === OWNER_NAME, rank: st.rank, tier: p.name.toLowerCase() === OWNER_NAME ? 'star' : st.tier, staff: st.staff };
  broadcast({ t: 'badge', id: p.id, ...p.badge });
}

/** A global ban (set from the admin panel) keeps a name out of every server. Fails open if Supabase is down. */
async function isGloballyBanned(name) {
  const r = await sb(`/rest/v1/bans?username=eq.${encodeURIComponent(name.toLowerCase())}&select=username&limit=1`, null);
  return Array.isArray(r) && r.length > 0;
}

// ---------------- Weather ----------------
// The server decides the weather so everyone sees the same sky. Like the game offline,
// it turns to rain now and then (snow only comes from cold biomes or the host).
const randomBetween = (a, b) => a + Math.random() * (b - a);
let weatherChangeAt = Date.now() + (world.weather === 'clear' ? randomBetween(420, 1020) : randomBetween(180, 420)) * 1000;
function setWeather(kind) {
  world.weather = kind;
  worldDirty = true;
  weatherChangeAt = Date.now() + (kind === 'clear' ? randomBetween(420, 1020) : randomBetween(180, 420)) * 1000;
  broadcast({ t: 'weather', kind });
}
setInterval(() => {
  if (WEATHER_CYCLE && Date.now() >= weatherChangeAt) setWeather(world.weather === 'clear' ? 'rain' : 'clear');
}, 5000);
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { console.log('Saving world before exit...'); saveWorld(); process.exit(0); });
}

// ---------------- Minimal WebSocket (RFC 6455) ----------------
class Connection {
  constructor(socket) {
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.fragments = [];
    this.closed = false;
    this.lastSeen = Date.now();
    this.onmessage = null;
    this.onclose = null;
    socket.on('data', (d) => this._onData(d));
    socket.on('close', () => this._finish());
    socket.on('error', () => this._finish());
  }

  _onData(data) {
    this.lastSeen = Date.now();
    this.buf = Buffer.concat([this.buf, data]);
    if (this.buf.length > MAX_FRAME + 14) return this.close(1009, 'Message too big');
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0;
      const op = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) {
        if (this.buf.length < 4) return;
        len = this.buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (this.buf.length < 10) return;
        const big = this.buf.readBigUInt64BE(2);
        if (big > BigInt(MAX_FRAME)) return this.close(1009, 'Message too big');
        len = Number(big);
        off = 10;
      }
      if (len > MAX_FRAME) return this.close(1009, 'Message too big');
      if (!masked) return this.close(1002, 'Client frames must be masked');
      if (this.buf.length < off + 4 + len) return; // wait for the rest
      const mask = this.buf.subarray(off, off + 4);
      const payload = Buffer.alloc(len);
      for (let i = 0; i < len; i++) payload[i] = this.buf[off + 4 + i] ^ mask[i & 3];
      this.buf = this.buf.subarray(off + 4 + len);

      if (op === 0x8) return this.close(1000, '');
      if (op === 0x9) { this._send(0xa, payload); continue; } // ping -> pong
      if (op === 0xa) continue; // pong
      if (op === 0x1 || op === 0x0) {
        this.fragments.push(payload);
        if (this.fragments.reduce((n, f) => n + f.length, 0) > MAX_FRAME) return this.close(1009, 'Message too big');
        if (fin) {
          const text = Buffer.concat(this.fragments).toString('utf8');
          this.fragments = [];
          if (this.onmessage) this.onmessage(text);
        }
      }
      // binary frames (0x2) are ignored
    }
  }

  _send(op, payload) {
    if (this.closed) return;
    const len = payload.length;
    let header;
    if (len < 126) header = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | op; header[1] = 126; header.writeUInt16BE(len, 2); }
    else { header = Buffer.alloc(10); header[0] = 0x80 | op; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
    this.socket.write(Buffer.concat([header, payload]));
  }

  send(obj) {
    this._send(0x1, Buffer.from(JSON.stringify(obj), 'utf8'));
  }

  ping() {
    this._send(0x9, Buffer.alloc(0));
  }

  close(code = 1000, reason = '') {
    if (this.closed) return;
    const r = Buffer.from(String(reason).slice(0, 100), 'utf8');
    const p = Buffer.alloc(2 + r.length);
    p.writeUInt16BE(code, 0);
    r.copy(p, 2);
    this._send(0x8, p);
    this.socket.end();
    this._finish();
  }

  _finish() {
    if (this.closed && !this.onclose) return;
    this.closed = true;
    const cb = this.onclose;
    this.onclose = null;
    if (cb) cb();
  }
}

// ---------------- Players ----------------
const players = new Map(); // id -> player
let hostId = null; // the host runs the server: the first player in, then the longest-connected one
function pickHost() {
  const joined = [...players.values()].filter((o) => o.joined).sort((a, b) => a.joinedAt - b.joinedAt);
  hostId = joined.length ? joined[0].id : null;
  if (hostId !== null) { broadcast({ t: 'host', id: hostId }); system(`${players.get(hostId).name} is now the host`); }
  void refreshHostRising();
}
let nextId = 1;

function broadcast(obj, exceptId) {
  for (const p of players.values()) if (p.joined && p.id !== exceptId) p.conn.send(obj);
}

function system(text) {
  broadcast({ t: 'system', text });
}

function cleanName(raw, id, verified = false) {
  let name = String(raw || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
  if (name.length < 3) name = 'Player' + id;
  if (!verified && name.toLowerCase() === 'master') name = 'Player' + id; // only the signed-in owner may use this name
  const taken = new Set([...players.values()].filter((p) => p.joined).map((p) => p.name.toLowerCase()));
  let final = name, n = 2;
  while (taken.has(final.toLowerCase())) final = (name.slice(0, 13) + n++);
  return final;
}

/** Thrown items that are still on the ground (shared id -> when it was thrown). They expire like they do in the game (5 minutes). */
const drops = new Map();
setInterval(() => { const old = Date.now() - 305_000; for (const [n, t] of drops) if (t < old) drops.delete(n); }, 30_000);
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const int = (v) => Number.isInteger(v);
const validBlock = (x, y, z, b) =>
  int(x) && int(y) && int(z) && int(b) && y >= 0 && y < 64 &&
  Math.abs(x) < 30_000_000 && Math.abs(z) < 30_000_000 && ((b >= 0 && b < 100) || (b >= 1000 && b < 1400) || (b >= 2000 && b < 2400)); // 1000-1399: newer blocks (redstone, wool...); 2000+: stairs, slabs, turned heads, low trapdoors

function finishJoin(p) {
  if ([...players.values()].filter((o) => o.joined).length >= maxPlayers()) return p.conn.close(4001, 'Server is full');
  p.joined = true;
  p.joinedAt = Date.now();
  const becameHost = hostId === null || !players.get(hostId)?.joined;
  if (becameHost) { hostId = p.id; void refreshHostRising(); }
  const others = [...players.values()].filter((o) => o.joined && o.id !== p.id)
    .map((o) => ({ id: o.id, name: o.name, x: o.x, y: o.y, z: o.z, yaw: o.yaw, pitch: o.pitch, mode: o.mode, look: o.look, badge: o.badge }));
  const changes = Object.entries(world.changes).map(([k, b]) => {
    const [x, y, z] = k.split(',').map(Number);
    return [x, y, z, b];
  });
  p.conn.send({ t: 'welcome', id: p.id, name: p.name, seed: world.seed, worldType: world.worldType, mode: world.mode, time: currentTime(), changes, players: others, hostId, settings: world.settings, weather: world.weather, experimental: !!world.experimental, maxPlayers: maxPlayers(), ranks: world.ranks });
  broadcast({ t: 'join', id: p.id, name: p.name }, p.id);
  void sendBadge(p);
  system(`${p.name} joined the game`);
  console.log(`+ ${p.name} joined (${players.size} connected)`);
}

// The night matches the game: from dusk (0.53) to just before sunrise (0.97)
const isNight = () => { const t = currentTime(); return t > 0.53 && t < 0.97; };

/**
 * /panel actions. Every one is checked against Supabase with the sender's own access token, so a
 * modified game can not give itself admin powers. Kicks and bans only reach players on this server;
 * a ban is also written to the global ban list by the panel, which every server checks on join.
 */
async function handleAdmin(p, msg) {
  const reply = (text) => p.conn.send({ t: 'system', text });
  if (!(await isAdminToken(msg.token))) return reply('You are not an admin');
  const name = typeof msg.name === 'string' ? msg.name.toLowerCase() : '';
  const target = name ? [...players.values()].find((o) => o.joined && o.name.toLowerCase() === name) : null;
  switch (msg.action) {
    case 'check': return p.conn.send({ t: 'adminOk' });
    case 'players':
      return p.conn.send({ t: 'adminPlayers', list: [...players.values()].filter((o) => o.joined).map((o) => ({ id: o.id, name: o.name, mode: o.mode })) });
    case 'kick':
    case 'ban': {
      if (!target) return reply(`No player named ${String(msg.name || '').slice(0, 16)} on this server`);
      if (target.id === p.id || (target.badge && target.badge.owner)) return reply("You can't remove that player");
      if (msg.action === 'ban') {
        const n = target.name.toLowerCase();
        if (!world.bans.includes(n)) { world.bans.push(n); worldDirty = true; saveWorld(); }
      }
      system(`${target.name} was ${msg.action === 'ban' ? 'banned' : 'kicked'} by an admin`);
      target.conn.close(msg.action === 'ban' ? 4005 : 4004, msg.action === 'ban' ? 'You were banned by an admin' : 'You were kicked by an admin');
      return;
    }
    case 'mute':
    case 'unmute': {
      if (!name) return reply(`Usage: /${msg.action} <player>`);
      if (msg.action === 'mute') {
        if (!target) return reply(`No player named ${String(msg.name || '').slice(0, 16)} on this server`);
        if (target.id === p.id || (target.badge && target.badge.owner)) return reply("You can't mute that player");
        mutes.add(target.name.toLowerCase());
        system(`${target.name} was muted by ${p.name}`);
        target.conn.send({ t: 'system', text: 'You were muted. Nobody can see your messages.' });
      } else {
        if (!mutes.delete(name)) return reply(`${String(msg.name || '').slice(0, 16)} isn't muted`);
        system(`${String(msg.name).slice(0, 16)} can chat again`);
      }
      return;
    }
    case 'mutes': return reply(mutes.size ? `Muted here: ${[...mutes].join(', ')}` : 'Nobody is muted on this server');
    case 'gamemode': {
      if (!VALID_MODES.concat('spectator').includes(msg.mode)) return reply('Unknown game mode');
      const who = target || (name ? null : p);
      if (!who) return reply(`No player named ${String(msg.name || '').slice(0, 16)} on this server`);
      who.conn.send({ t: 'setmode', mode: msg.mode, by: p.name });
      if (who !== p) reply(`${who.name} is now in ${msg.mode} mode`);
      return;
    }
    default:
  }
}

function handle(p, msg) {
  if (!p.joined && msg.t !== 'hello') return;
  switch (msg.t) {
    case 'hello': {
      if (p.joined || p.joining) return;
      if (msg.version !== PROTOCOL) return p.conn.close(4000, 'Your game version does not match this server');
      if ([...players.values()].filter((o) => o.joined).length >= maxPlayers()) return p.conn.close(4001, 'Server is full');
      p.joining = true;
      // Signed-in players prove who they are with their access token and play under their account name
      (typeof msg.token === 'string' && msg.token ? verifiedName(msg.token) : Promise.resolve(null)).then((acct) => {
        if (p.conn.closed) return;
        p.verified = !!acct;
        p.name = cleanName(acct || msg.name, p.id, !!acct);
        if (world.bans.includes(p.name.toLowerCase())) return p.conn.close(4003, 'You are banned from this server');
        return isGloballyBanned(p.name).then((banned) => {
          if (p.conn.closed) return;
          if (banned) return p.conn.close(4006, 'You are banned from VibeBlox');
          finishJoin(p);
        });
      });
      return;
    }
    case 'sleep': {
      p.sleepSince = msg.on === true && isNight() ? Date.now() : 0;
      if (p.sleepSince) p.slept = true;
      return;
    }
    case 'whisper': {
      const text = typeof msg.text === 'string' ? msg.text.trim().slice(0, 256) : '';
      const to = typeof msg.to === 'string' ? msg.to.toLowerCase() : '';
      if (!text || !to) return;
      const target = [...players.values()].find((o) => o.joined && o.name.toLowerCase() === to);
      if (!target || target.id === p.id) return p.conn.send({ t: 'whisperFail', to: String(msg.to).slice(0, 16) });
      target.conn.send({ t: 'whisper', from: p.name, text });
      p.conn.send({ t: 'whispered', to: target.name, text });
      return;
    }
    case 'title': {
      if (p.id !== hostId) return; // only the host (they are the one who may run commands)
      const text = typeof msg.text === 'string' ? msg.text.slice(0, 160) : '';
      const sub = typeof msg.sub === 'string' ? msg.sub.slice(0, 200) : '';
      const to = typeof msg.to === 'string' ? msg.to : '*';
      if (!text && !sub) return;
      const out = { t: 'title', text, sub };
      if (to === '*') broadcast(out, p.id);
      else {
        const target = [...players.values()].find((o) => o.joined && o.name.toLowerCase() === to.toLowerCase());
        if (target && target.id !== p.id) target.conn.send(out);
      }
      return;
    }
    case 'rcmd': { // the host runs /give, /clear, /effect, /xp or /tp on other players (@a, @p, a name)
      if (p.id !== hostId) return;
      const cmd = typeof msg.cmd === 'string' ? msg.cmd : '';
      if (!['give', 'clear', 'effect', 'effclear', 'xp', 'tp'].includes(cmd)) return;
      const args = msg.args && typeof msg.args === 'object' && JSON.stringify(msg.args).length < 600 ? msg.args : {};
      const to = typeof msg.to === 'string' ? msg.to : '*';
      const out = { t: 'rcmd', cmd, args, from: p.name };
      if (to === '*') broadcast(out, p.id);
      else {
        const target = [...players.values()].find((o) => o.joined && o.name.toLowerCase() === to.toLowerCase());
        if (target && target.id !== p.id) target.conn.send(out);
      }
      return;
    }
    case 'drop': { // a player threw an item: everyone sees it, and the first to pick it up gets it
      const n = typeof msg.n === 'string' && /^[a-z0-9]{3,16}$/.test(msg.n) ? msg.n : null;
      const item = msg.item, count = msg.count;
      if (!n || !Number.isInteger(item) || item < 1 || item >= 4000 || !Number.isInteger(count) || count < 1 || count > 64 * 36) return;
      if (![msg.x, msg.y, msg.z, msg.vx, msg.vy, msg.vz].every(num) || Math.abs(msg.vx) > 30 || Math.abs(msg.vy) > 30 || Math.abs(msg.vz) > 30) return;
      if (++p.dropsThisSecond > 40 || drops.has(n)) return;
      if (drops.size > 600) drops.delete(drops.keys().next().value);
      drops.set(n, Date.now());
      const d = typeof msg.d === 'string' && msg.d.length <= 500 ? msg.d : undefined;
      broadcast({ t: 'drop', n, item, count, x: msg.x, y: msg.y, z: msg.z, vx: msg.vx, vy: msg.vy, vz: msg.vz, ...(d ? { d } : {}) }, p.id);
      return;
    }
    case 'pickup': { // exactly one player gets each thrown item
      const n = typeof msg.n === 'string' ? msg.n : '';
      if (!drops.has(n)) return p.conn.send({ t: 'pickupNo', n: n.slice(0, 16) });
      drops.delete(n);
      p.conn.send({ t: 'pickupOk', n });
      broadcast({ t: 'gone', n }, p.id);
      return;
    }
    case 'ranks': {
      if (p.id !== hostId) return;
      world.ranks = cleanRanks(msg.ranks);
      worldDirty = true;
      broadcast({ t: 'ranks', ranks: world.ranks }, p.id);
      return;
    }
    case 'admin': {
      handleAdmin(p, msg);
      return;
    }
    case 'settings': {
      if (p.id !== hostId) return; // only the host
      const s = msg.settings || {};
      const next = { ...world.settings };
      if (DIFFICULTIES.includes(s.difficulty)) next.difficulty = s.difficulty;
      for (const k of ['keepInventory', 'scripts', 'mods', 'commands']) if (typeof s[k] === 'boolean') next[k] = s[k];
      if (['off', 'all', 'admin', 'owner'].includes(String(s.scriptPerm))) next.scriptPerm = s.scriptPerm;
      world.settings = next;
      worldDirty = true;
      broadcast({ t: 'settings', settings: next });
      return;
    }
    case 'settime': {
      if (p.id !== hostId) return; // only the host
      if (typeof msg.time !== 'number' || !Number.isFinite(msg.time)) return; // ignore anything odd (never "reset to sunrise")
      timeBase.at = Date.now();
      timeBase.value = ((msg.time % 1) + 1) % 1;
      worldDirty = true;
      broadcast({ t: 'time', time: currentTime() });
      return;
    }
    case 'weather': {
      if (p.id !== hostId || !WEATHERS.includes(msg.kind)) return;
      setWeather(msg.kind);
      system(`The host set the weather to ${msg.kind}`);
      return;
    }
    case 'kick':
    case 'ban': {
      if (p.id !== hostId) return;
      const target = players.get(msg.id);
      if (!target || !target.joined || target.id === p.id) return; // never yourself
      if (msg.t === 'ban') {
        const name = target.name.toLowerCase();
        if (!world.bans.includes(name)) world.bans.push(name);
        worldDirty = true;
        saveWorld();
      }
      system(`${target.name} was ${msg.t === 'ban' ? 'banned' : 'kicked'} by the host`);
      target.conn.close(msg.t === 'ban' ? 4005 : 4004, msg.t === 'ban' ? 'You were banned from this server' : 'You were kicked by the host');
      return;
    }
    case 'move': {
      if (![msg.x, msg.y, msg.z, msg.yaw, msg.pitch].every(num)) return;
      p.x = msg.x; p.y = msg.y; p.z = msg.z; p.yaw = msg.yaw; p.pitch = msg.pitch;
      p.mode = typeof msg.mode === 'string' ? msg.mode.slice(0, 12) : 'survival';
      p.held = Number.isInteger(msg.held) && msg.held >= 0 && msg.held < 4000 ? msg.held : 0; // item id in hand (1400+: newer items)
      p.act = Number.isInteger(msg.act) ? msg.act & 511 : 0; // (128: gliding, 256: burning) swinging / aiming / drawing a bow / blocking / sleeping / sneaking / swimming
      p.moved = true;
      return;
    }
    case 'look': {
      // Skin and cape names only (the game draws them); anything odd is ignored
      const ok = (v) => typeof v === 'string' && /^[a-z0-9_]{1,24}$/.test(v);
      if (!ok(msg.skin) || !ok(msg.cape)) return;
      if (msg.skin === 'custom') {
        // A custom skin is a small PNG. Only signed-in Champions (and the owner) may wear one.
        const png = typeof msg.custom === 'string' && msg.custom.length <= 12000 && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(msg.custom) ? msg.custom : null;
        if (!png || !p.verified) return;
        standingOf(p.name).then((st) => {
          if (p.conn.closed || st.rank !== 'champion') return;
          p.look = { skin: 'custom', cape: msg.cape, custom: png };
          broadcast({ t: 'look', id: p.id, skin: 'custom', cape: msg.cape, custom: png }, p.id);
        });
        return;
      }
      p.look = { skin: msg.skin, cape: msg.cape };
      broadcast({ t: 'look', id: p.id, skin: msg.skin, cape: msg.cape }, p.id);
      return;
    }
    case 'blocks': {
      if (!Array.isArray(msg.list) || msg.list.length > 512) return;
      const ok = [];
      for (const e of msg.list) {
        if (!Array.isArray(e) || e.length !== 4) continue;
        const [x, y, z, b] = e;
        if (!validBlock(x, y, z, b)) continue;
        if (++p.blocksThisSecond > 600) break; // anti-griefing flood limit
        world.changes[`${x},${y},${z}`] = b;
        ok.push([x, y, z, b]);
      }
      if (ok.length) {
        worldDirty = true;
        broadcast({ t: 'blocks', list: ok, id: p.id }, p.id);
      }
      return;
    }
    case 'ping': // the game shows your ping: just echo it straight back
      if (Number.isFinite(msg.n)) p.conn.send({ t: 'pong', n: msg.n });
      return;
    case 'chat': {
      const text = typeof msg.text === 'string' ? msg.text.trim().slice(0, 256) : '';
      if (!text) return;
      if (mutes.has(p.name.toLowerCase())) return p.conn.send({ t: 'system', text: 'You are muted.' });
      broadcast({ t: 'chat', id: p.id, name: p.name, text });
      return;
    }
    default:
  }
}

// ---------------- HTTP + upgrade ----------------
const server = http.createServer((req, res) => {
  const online = [...players.values()].filter((p) => p.joined).length;
  res.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' });
  res.end(`VibeBlox server is running. Players online: ${online}/${maxPlayers()}\n`);
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (String(req.headers.upgrade || '').toLowerCase() !== 'websocket' || !key) return socket.destroy();
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept}`, '', ''].join('\r\n'));
  socket.setNoDelay(true);

  const conn = new Connection(socket);
  const p = {
    id: nextId++, conn, name: '', joined: false,
    x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mode: 'survival', moved: false,
    msgsThisSecond: 0, blocksThisSecond: 0, dropsThisSecond: 0,
  };
  players.set(p.id, p);

  conn.onmessage = (text) => {
    if (++p.msgsThisSecond > 120) return conn.close(4002, 'Sending too fast');
    let msg;
    try { msg = JSON.parse(text); } catch { return; }
    if (msg && typeof msg === 'object') handle(p, msg);
  };
  conn.onclose = () => {
    players.delete(p.id);
    if (p.joined) {
      broadcast({ t: 'leave', id: p.id, name: p.name });
      system(`${p.name} left the game`);
      if (p.id === hostId) pickHost();
      checkSleepers();
      console.log(`- ${p.name} left (${players.size} connected)`);
    }
  };
});

// Send everyone's movement 10 times a second, batched into one message
setInterval(() => {
  const list = [];
  for (const p of players.values()) {
    if (p.joined && p.moved) {
      list.push([p.id, +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +p.yaw.toFixed(3), +p.pitch.toFixed(3), p.mode, p.held || 0, p.act || 0]);
      p.moved = false;
    }
  }
  if (list.length) broadcast({ t: 'moves', list });
}, 100);

// Reset rate limits every second; drop connections that went silent
setInterval(() => {
  const now = Date.now();
  for (const p of players.values()) {
    p.msgsThisSecond = 0;
    p.blocksThisSecond = 0;
    p.dropsThisSecond = 0;
    if (now - p.conn.lastSeen > 60_000) p.conn.close(4003, 'Timed out');
  }
}, 1000);
setInterval(() => { for (const p of players.values()) p.conn.ping(); }, 20_000);

// ---------------- Sleeping ----------------
// When at least half of the players have been in bed for 3 seconds, the night passes for everyone.
function checkSleepers() {
  if (!isNight()) { for (const p of players.values()) p.sleepSince = 0; return; }
  const joined = [...players.values()].filter((p) => p.joined);
  if (!joined.length) return;
  const now = Date.now();
  const ready = joined.filter((p) => p.sleepSince && now - p.sleepSince >= SLEEP_SECONDS * 1000);
  if (ready.length * 2 < joined.length) return;
  timeBase.at = Date.now();
  timeBase.value = 0.02;
  worldDirty = true;
  for (const p of players.values()) p.sleepSince = 0;
  broadcast({ t: 'time', time: currentTime() });
  if (world.weather !== 'clear') setWeather('clear'); // like Minecraft, a night's sleep clears the storm
  system(`${ready.length === 1 ? ready[0].name + ' slept' : ready.length + ' players slept'} through the night`);
}
setInterval(checkSleepers, 500);

// Keep everyone's day/night clock in step
setInterval(() => broadcast({ t: 'time', time: currentTime() }), 30_000);

server.listen(PORT, () => console.log(`VibeBlox server listening on port ${PORT}`));
