// Player-hosted worlds: no server needed.
// ---------------------------------------------------------------
// When you play a world that isn't private, your own browser runs the "room" that server/server.js used to run:
// it shares block edits, positions, chat, the time and the weather with everyone who joins. Your own game talks to
// the room through a loopback; other players connect straight to your browser (WebRTC data channels). Supabase is
// only used to find each other (the "handshake" goes through a Supabase Realtime channel) and to check who people are.
// Speaks the same protocol as server/server.js, so multiplayer.ts works unchanged on both ends.
//
// This file is optional, like multiplayer.ts: if it's deleted the game still runs (you just can't host or join worlds).

/** Must match PROTOCOL_VERSION in multiplayer.ts (and PROTOCOL in server/server.js). */
export const ROOM_PROTOCOL = 14;
export type Privacy = 'private' | 'friends' | 'accounts' | 'public';
export const PRIVACY_LABELS: Record<Privacy, string> = { private: 'Private', friends: 'Friends only', accounts: 'Signed-in players', public: 'Public' };
type NetBlock = [number, number, number, number];
type Settings = { difficulty: 'peaceful' | 'easy' | 'normal' | 'hard'; keepInventory: boolean; scripts: boolean; mods: boolean; commands: boolean };
type Badge = { owner?: boolean; rank?: string; tier?: string };
type Look = { skin: string; cape: string; custom?: string };

/** One player's link to the room (the host's own loopback, or a peer's data channel). */
export type RoomConn = {
  send(obj: unknown): void;
  close(code?: number, reason?: string): void;
  closed: boolean;
  lastSeen: number;
  onmessage: ((text: string) => void) | null;
  onclose: (() => void) | null;
  /** The host's own game (trusted: plays under the host's name, can't be kicked). */
  local?: boolean;
};

/** Who is behind a sign-in token, and other lookups the room needs. Injected so the room can be tested offline. */
export type RoomServices = {
  /** The VibeBlox account behind an access token (null: not signed in, or not verified). */
  verify(token: string): Promise<{ name: string; id: string } | null>;
  /** Is this account a friend of the host? */
  isFriend(userId: string): Promise<boolean>;
  /** Banned from all of VibeBlox (admin panel)? */
  isBanned?(name: string): Promise<boolean>;
  /** Paid rank and creator tier, for the tags in front of names. */
  standing?(name: string): Promise<{ rank: string; tier: string }>;
  /** Is this token an admin's? (/panel actions) */
  isAdmin?(token: string): Promise<boolean>;
};

export type RoomOptions = {
  seed: number;
  worldType: 'default' | 'superflat';
  mode: 'survival' | 'creative' | 'adventure';
  changes: NetBlock[];
  /** 0..1, where the host's day is now */
  time: number;
  weather: 'clear' | 'rain' | 'snow';
  settings: Settings;
  ranks?: unknown;
  experimental?: boolean;
  privacy: Privacy;
  hostName: string;
  maxPlayers: number;
  bans?: string[];
  services: RoomServices;
  /** The number of players changed (for the world list). */
  onCount?: (n: number) => void;
  /** Someone was banned from this world (the host's game saves the list). */
  onBans?: (bans: string[]) => void;
};

const DAY_LENGTH = 600; // seconds, must match the game
const SLEEP_SECONDS = 3;
const DIFFICULTIES = ['peaceful', 'easy', 'normal', 'hard'];
const WEATHERS = ['clear', 'rain', 'snow'];
const VALID_MODES = ['survival', 'creative', 'adventure'];
const RANK_NAME_RE = /^[A-Za-z0-9_]{1,16}$/, PLAYER_RE = /^[A-Za-z0-9_]{3,16}$/;
const OWNER = 'master_at_pvp';

function cleanRanks(v: unknown) {
  const out: { defs: Record<string, { name: string; tag: string }>; members: Record<string, string> } = { defs: {}, members: {} };
  if (!v || typeof v !== 'object') return out;
  const o = v as { defs?: Record<string, { name?: unknown; tag?: unknown }>; members?: Record<string, unknown> };
  if (o.defs && typeof o.defs === 'object') {
    for (const [k, d] of Object.entries(o.defs)) {
      if (Object.keys(out.defs).length >= 30) break;
      if (!d || typeof d.name !== 'string' || typeof d.tag !== 'string' || !RANK_NAME_RE.test(d.name) || k !== d.name.toLowerCase()) continue;
      out.defs[k] = { name: d.name, tag: d.tag.slice(0, 80) };
    }
  }
  if (o.members && typeof o.members === 'object') {
    for (const [pl, r] of Object.entries(o.members)) {
      if (Object.keys(out.members).length >= 200) break;
      if (typeof r !== 'string' || !out.defs[r] || !PLAYER_RE.test(pl) || pl !== pl.toLowerCase()) continue;
      out.members[pl] = r;
    }
  }
  return out;
}

type Player = {
  id: number; conn: RoomConn; name: string; joined: boolean; joining: boolean; verified: boolean; joinedAt: number;
  x: number; y: number; z: number; yaw: number; pitch: number; mode: string; held: number; act: number; moved: boolean;
  msgs: number; blocks: number; sleepSince: number; look?: Look; badge?: Badge;
};

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const int = (v: unknown): v is number => Number.isInteger(v);
const validBlock = (x: unknown, y: unknown, z: unknown, b: unknown) =>
  int(x) && int(y) && int(z) && int(b) && y >= 0 && y < 64 &&
  Math.abs(x) < 30_000_000 && Math.abs(z) < 30_000_000 && ((b >= 0 && b < 100) || (b >= 1000 && b < 1400));

/** The world everyone shares, run inside the host's browser. */
export class HostRoom {
  readonly opts: RoomOptions;
  private players = new Map<number, Player>();
  private nextId = 1;
  private hostId: number | null = null;
  private changes = new Map<string, number>();
  private timeBase: { at: number; value: number };
  private weather: 'clear' | 'rain' | 'snow';
  private weatherAt: number;
  private settings: Settings;
  private ranks: ReturnType<typeof cleanRanks>;
  private bans: string[];
  private timers: Array<ReturnType<typeof setInterval>> = [];
  private stopped = false;
  privacy: Privacy;

  constructor(opts: RoomOptions) {
    this.opts = opts;
    for (const [x, y, z, b] of opts.changes) if (validBlock(x, y, z, b)) this.changes.set(`${x},${y},${z}`, b);
    this.timeBase = { at: Date.now(), value: ((opts.time % 1) + 1) % 1 };
    this.weather = opts.weather;
    this.weatherAt = Date.now() + this.weatherGap(opts.weather);
    this.settings = { ...opts.settings };
    this.ranks = cleanRanks(opts.ranks);
    this.bans = (opts.bans ?? []).map((b) => b.toLowerCase());
    this.privacy = opts.privacy;
    // Everyone's movement 10 times a second, batched into one message
    this.timers.push(setInterval(() => this.flushMoves(), 100));
    // Rate limits, silent connections, sleeping, the weather
    this.timers.push(setInterval(() => this.everySecond(), 1000));
    this.timers.push(setInterval(() => this.checkSleepers(), 500));
    this.timers.push(setInterval(() => this.broadcast({ t: 'time', time: this.currentTime() }), 30_000));
  }

  get count(): number { return [...this.players.values()].filter((p) => p.joined).length; }
  get full(): boolean { return this.count >= this.opts.maxPlayers; }
  /** Everyone's names (the host's world list shows the count). */
  get names(): string[] { return [...this.players.values()].filter((p) => p.joined).map((p) => p.name); }

  private weatherGap(kind: string) { return (kind === 'clear' ? 420 + Math.random() * 600 : 180 + Math.random() * 240) * 1000; }
  currentTime(): number { return (this.timeBase.value + (Date.now() - this.timeBase.at) / 1000 / DAY_LENGTH) % 1; }

  private broadcast(obj: unknown, exceptId?: number) {
    for (const p of this.players.values()) if (p.joined && p.id !== exceptId) p.conn.send(obj);
  }
  private system(text: string) { this.broadcast({ t: 'system', text }); }
  private countChanged() { this.opts.onCount?.(this.count); }

  /** A new player connected (the host's loopback, or a peer). */
  addConnection(conn: RoomConn) {
    if (this.stopped) { conn.close(4009, 'This world is closed'); return; }
    const p: Player = {
      id: this.nextId++, conn, name: '', joined: false, joining: false, verified: false, joinedAt: 0,
      x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mode: 'survival', held: 0, act: 0, moved: false, msgs: 0, blocks: 0, sleepSince: 0,
    };
    this.players.set(p.id, p);
    conn.onmessage = (text) => {
      conn.lastSeen = Date.now();
      if (++p.msgs > 120) { conn.close(4002, 'Sending too fast'); return; }
      if (text.length > 64 * 1024) return;
      let msg: unknown;
      try { msg = JSON.parse(text); } catch { return; }
      if (msg && typeof msg === 'object') void this.handle(p, msg as Record<string, unknown>);
    };
    conn.onclose = () => this.dropped(p);
  }

  private dropped(p: Player) {
    if (!this.players.has(p.id)) return;
    this.players.delete(p.id);
    if (!p.joined) return;
    this.broadcast({ t: 'leave', id: p.id, name: p.name });
    this.system(`${p.name} left the game`);
    if (p.id === this.hostId) this.pickHost();
    this.countChanged();
  }

  private pickHost() {
    // The world's owner is the host while they are here; otherwise the longest-connected player
    const joined = [...this.players.values()].filter((o) => o.joined).sort((a, b) => Number(!!b.conn.local) - Number(!!a.conn.local) || a.joinedAt - b.joinedAt);
    this.hostId = joined.length ? joined[0].id : null;
    if (this.hostId !== null) this.broadcast({ t: 'host', id: this.hostId });
  }

  private cleanName(raw: string, id: number, verified: boolean): string {
    let name = String(raw || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
    if (name.length < 3) name = 'Player' + id;
    if (!verified && name.toLowerCase() === OWNER) name = 'Player' + id; // only the signed-in owner may use that name
    const taken = new Set([...this.players.values()].filter((o) => o.joined).map((o) => o.name.toLowerCase()));
    let final = name, n = 2;
    while (taken.has(final.toLowerCase())) final = name.slice(0, 13) + n++;
    return final;
  }

  private async hello(p: Player, msg: Record<string, unknown>) {
    if (p.joined || p.joining) return;
    if (msg.version !== ROOM_PROTOCOL) { p.conn.close(4000, 'Your game version does not match this world. Refresh the page to update.'); return; }
    if (!p.conn.local && this.full) { p.conn.close(4001, 'This world is full'); return; }
    p.joining = true;
    const svc = this.opts.services;
    let acct: { name: string; id: string } | null = null;
    if (p.conn.local) acct = { name: this.opts.hostName, id: 'host' };
    else if (typeof msg.token === 'string' && msg.token) acct = await svc.verify(msg.token).catch(() => null);
    if (p.conn.closed) return;
    // Who may come in
    if (!p.conn.local) {
      if (this.privacy === 'private') { p.conn.close(4007, 'This world is private'); return; }
      if (this.privacy === 'accounts' && !acct) { p.conn.close(4007, 'Sign in to join this world'); return; }
      if (this.privacy === 'friends') {
        const ok = !!acct && await svc.isFriend(acct.id).catch(() => false);
        if (p.conn.closed) return;
        if (!ok) { p.conn.close(4008, `Only ${this.opts.hostName}'s friends can join this world`); return; }
      }
    }
    p.verified = !!acct;
    p.name = this.cleanName(acct ? acct.name : String(msg.name ?? ''), p.id, !!acct);
    if (!p.conn.local) {
      if (this.bans.includes(p.name.toLowerCase())) { p.conn.close(4003, 'You are banned from this world'); return; }
      const banned = svc.isBanned ? await svc.isBanned(p.name).catch(() => false) : false;
      if (p.conn.closed) return;
      if (banned) { p.conn.close(4006, 'You are banned from VibeBlox'); return; }
      if (this.full) { p.conn.close(4001, 'This world is full'); return; }
    }
    this.finishJoin(p);
  }

  private finishJoin(p: Player) {
    p.joined = true;
    p.joinedAt = Date.now();
    if (this.hostId === null || !this.players.get(this.hostId)?.joined || p.conn.local) this.hostId = p.id;
    const others = [...this.players.values()].filter((o) => o.joined && o.id !== p.id)
      .map((o) => ({ id: o.id, name: o.name, x: o.x, y: o.y, z: o.z, yaw: o.yaw, pitch: o.pitch, mode: o.mode, look: o.look, badge: o.badge }));
    const changes: NetBlock[] = [];
    for (const [k, b] of this.changes) { const [x, y, z] = k.split(',').map(Number); changes.push([x, y, z, b]); }
    p.conn.send({
      t: 'welcome', id: p.id, name: p.name, seed: this.opts.seed, worldType: this.opts.worldType, mode: this.opts.mode, time: this.currentTime(),
      changes, players: others, hostId: this.hostId, settings: this.settings, weather: this.weather, experimental: !!this.opts.experimental,
      maxPlayers: this.opts.maxPlayers, ranks: this.ranks,
    });
    this.broadcast({ t: 'join', id: p.id, name: p.name }, p.id);
    if (p.conn.local) this.broadcast({ t: 'host', id: p.id }, p.id);
    void this.sendBadge(p);
    if (!p.conn.local) this.system(`${p.name} joined the game`);
    this.countChanged();
  }

  private async sendBadge(p: Player) {
    if (!p.verified || !this.opts.services.standing) return;
    const st = await this.opts.services.standing(p.name).catch(() => null);
    if (!st || p.conn.closed) return;
    const owner = p.name.toLowerCase() === OWNER;
    p.badge = { owner, rank: st.rank, tier: owner ? 'star' : st.tier };
    this.broadcast({ t: 'badge', id: p.id, ...p.badge });
  }

  private isNight() { const t = this.currentTime(); return t > 0.53 && t < 0.97; }

  private setWeather(kind: 'clear' | 'rain' | 'snow') {
    this.weather = kind;
    this.weatherAt = Date.now() + this.weatherGap(kind);
    this.broadcast({ t: 'weather', kind });
  }

  private checkSleepers() {
    if (!this.isNight()) { for (const p of this.players.values()) p.sleepSince = 0; return; }
    const joined = [...this.players.values()].filter((p) => p.joined);
    if (!joined.length) return;
    const now = Date.now();
    const ready = joined.filter((p) => p.sleepSince && now - p.sleepSince >= SLEEP_SECONDS * 1000);
    if (ready.length * 2 < joined.length) return;
    this.timeBase = { at: Date.now(), value: 0.02 };
    for (const p of this.players.values()) p.sleepSince = 0;
    this.broadcast({ t: 'time', time: this.currentTime() });
    if (this.weather !== 'clear') this.setWeather('clear');
    this.system(`${ready.length === 1 ? ready[0].name + ' slept' : ready.length + ' players slept'} through the night`);
  }

  private everySecond() {
    const now = Date.now();
    for (const p of this.players.values()) {
      p.msgs = 0;
      p.blocks = 0;
      if (!p.conn.local && now - p.conn.lastSeen > 45_000) p.conn.close(4003, 'Timed out');
    }
    if (now >= this.weatherAt) this.setWeather(this.weather === 'clear' ? 'rain' : 'clear');
  }

  private flushMoves() {
    const list: unknown[] = [];
    for (const p of this.players.values()) {
      if (p.joined && p.moved) {
        list.push([p.id, +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +p.yaw.toFixed(3), +p.pitch.toFixed(3), p.mode, p.held || 0, p.act || 0]);
        p.moved = false;
      }
    }
    if (list.length) this.broadcast({ t: 'moves', list });
  }

  private kickById(by: Player, id: number, ban: boolean) {
    const target = this.players.get(id);
    if (!target || !target.joined || target.id === by.id || target.conn.local) return;
    if (ban) {
      const n = target.name.toLowerCase();
      if (!this.bans.includes(n)) { this.bans.push(n); this.opts.onBans?.(this.bans.slice()); }
    }
    this.system(`${target.name} was ${ban ? 'banned' : 'kicked'} by the host`);
    target.conn.close(ban ? 4005 : 4004, ban ? 'You were banned from this world' : 'You were kicked by the host');
  }

  private async handleAdmin(p: Player, msg: Record<string, unknown>) {
    const reply = (text: string) => p.conn.send({ t: 'system', text });
    const isAdmin = this.opts.services.isAdmin;
    if (!isAdmin || typeof msg.token !== 'string' || !(await isAdmin(msg.token).catch(() => false))) { reply('You are not an admin'); return; }
    const name = typeof msg.name === 'string' ? msg.name.toLowerCase() : '';
    const target = name ? [...this.players.values()].find((o) => o.joined && o.name.toLowerCase() === name) : null;
    switch (msg.action) {
      case 'check': p.conn.send({ t: 'adminOk' }); return;
      case 'players': p.conn.send({ t: 'adminPlayers', list: [...this.players.values()].filter((o) => o.joined).map((o) => ({ id: o.id, name: o.name, mode: o.mode })) }); return;
      case 'kick':
      case 'ban':
        if (!target) { reply(`No player named ${String(msg.name || '').slice(0, 16)} here`); return; }
        if (target.id === p.id || target.conn.local) { reply("You can't remove that player"); return; }
        if (msg.action === 'ban') { const n = target.name.toLowerCase(); if (!this.bans.includes(n)) { this.bans.push(n); this.opts.onBans?.(this.bans.slice()); } }
        this.system(`${target.name} was ${msg.action === 'ban' ? 'banned' : 'kicked'} by an admin`);
        target.conn.close(msg.action === 'ban' ? 4005 : 4004, msg.action === 'ban' ? 'You were banned by an admin' : 'You were kicked by an admin');
        return;
      case 'gamemode': {
        if (!VALID_MODES.concat('spectator').includes(String(msg.mode))) { reply('Unknown game mode'); return; }
        const who = target || (name ? null : p);
        if (!who) { reply(`No player named ${String(msg.name || '').slice(0, 16)} here`); return; }
        who.conn.send({ t: 'setmode', mode: msg.mode, by: p.name });
        if (who !== p) reply(`${who.name} is now in ${String(msg.mode)} mode`);
        return;
      }
      default:
    }
  }

  private async handle(p: Player, msg: Record<string, unknown>) {
    if (!p.joined && msg.t !== 'hello') return;
    const isHost = p.id === this.hostId;
    switch (msg.t) {
      case 'hello': await this.hello(p, msg); return;
      case 'sleep': p.sleepSince = msg.on === true && this.isNight() ? Date.now() : 0; return;
      case 'whisper': {
        const text = typeof msg.text === 'string' ? msg.text.trim().slice(0, 256) : '';
        const to = typeof msg.to === 'string' ? msg.to.toLowerCase() : '';
        if (!text || !to) return;
        const target = [...this.players.values()].find((o) => o.joined && o.name.toLowerCase() === to);
        if (!target || target.id === p.id) { p.conn.send({ t: 'whisperFail', to: String(msg.to).slice(0, 16) }); return; }
        target.conn.send({ t: 'whisper', from: p.name, text });
        p.conn.send({ t: 'whispered', to: target.name, text });
        return;
      }
      case 'title': {
        if (!isHost) return;
        const text = typeof msg.text === 'string' ? msg.text.slice(0, 160) : '';
        const sub = typeof msg.sub === 'string' ? msg.sub.slice(0, 200) : '';
        const to = typeof msg.to === 'string' ? msg.to : '*';
        if (!text && !sub) return;
        const out = { t: 'title', text, sub };
        if (to === '*') this.broadcast(out, p.id);
        else { const target = [...this.players.values()].find((o) => o.joined && o.name.toLowerCase() === to.toLowerCase()); if (target && target.id !== p.id) target.conn.send(out); }
        return;
      }
      case 'ranks': if (!isHost) return; this.ranks = cleanRanks(msg.ranks); this.broadcast({ t: 'ranks', ranks: this.ranks }, p.id); return;
      case 'admin': await this.handleAdmin(p, msg); return;
      case 'settings': {
        if (!isHost) return;
        const s = (msg.settings ?? {}) as Partial<Settings>;
        const next = { ...this.settings };
        if (DIFFICULTIES.includes(String(s.difficulty))) next.difficulty = s.difficulty as Settings['difficulty'];
        for (const k of ['keepInventory', 'scripts', 'mods', 'commands'] as const) if (typeof s[k] === 'boolean') next[k] = s[k] as boolean;
        this.settings = next;
        this.broadcast({ t: 'settings', settings: next });
        return;
      }
      case 'settime':
        if (!isHost || !num(msg.time)) return;
        this.timeBase = { at: Date.now(), value: ((msg.time % 1) + 1) % 1 };
        this.broadcast({ t: 'time', time: this.currentTime() });
        return;
      case 'weather':
        if (!isHost || !WEATHERS.includes(String(msg.kind))) return;
        this.setWeather(msg.kind as 'clear' | 'rain' | 'snow');
        this.system(`The host set the weather to ${String(msg.kind)}`);
        return;
      case 'kick':
      case 'ban':
        if (!isHost || !int(msg.id)) return;
        this.kickById(p, msg.id, msg.t === 'ban');
        return;
      case 'move':
        if (![msg.x, msg.y, msg.z, msg.yaw, msg.pitch].every(num)) return;
        p.x = msg.x as number; p.y = msg.y as number; p.z = msg.z as number; p.yaw = msg.yaw as number; p.pitch = msg.pitch as number;
        p.mode = typeof msg.mode === 'string' ? msg.mode.slice(0, 12) : 'survival';
        p.held = int(msg.held) && msg.held >= 0 && msg.held < 2000 ? msg.held : 0;
        p.act = int(msg.act) ? msg.act & 31 : 0;
        p.moved = true;
        return;
      case 'look': {
        const ok = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9_]{1,24}$/.test(v);
        if (!ok(msg.skin) || !ok(msg.cape)) return;
        if (msg.skin === 'custom') {
          const png = typeof msg.custom === 'string' && msg.custom.length <= 12000 && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(msg.custom) ? msg.custom : null;
          if (!png || !p.verified || !this.opts.services.standing) return;
          const st = await this.opts.services.standing(p.name).catch(() => null);
          if (p.conn.closed || !st || (st.rank !== 'champion' && p.name.toLowerCase() !== OWNER)) return;
          p.look = { skin: 'custom', cape: msg.cape, custom: png };
          this.broadcast({ t: 'look', id: p.id, skin: 'custom', cape: msg.cape, custom: png }, p.id);
          return;
        }
        p.look = { skin: msg.skin, cape: msg.cape };
        this.broadcast({ t: 'look', id: p.id, skin: msg.skin, cape: msg.cape }, p.id);
        return;
      }
      case 'blocks': {
        if (!Array.isArray(msg.list) || msg.list.length > 512) return;
        const ok: NetBlock[] = [];
        for (const e of msg.list as unknown[]) {
          if (!Array.isArray(e) || e.length !== 4) continue;
          const [x, y, z, b] = e as unknown[];
          if (!validBlock(x, y, z, b)) continue;
          if (!p.conn.local && ++p.blocks > 600) break; // anti-griefing flood limit
          this.changes.set(`${x},${y},${z}`, b as number);
          ok.push([x as number, y as number, z as number, b as number]);
        }
        if (ok.length) this.broadcast({ t: 'blocks', list: ok, id: p.id }, p.id);
        return;
      }
      case 'ping': if (num(msg.n)) p.conn.send({ t: 'pong', n: msg.n }); return;
      case 'chat': {
        const text = typeof msg.text === 'string' ? msg.text.trim().slice(0, 256) : '';
        if (text) this.broadcast({ t: 'chat', id: p.id, name: p.name, text });
        return;
      }
      default:
    }
  }

  /** The host changed who may join. Players already in who no longer may are sent away. */
  setPrivacy(privacy: Privacy) {
    this.privacy = privacy;
    if (privacy === 'private') for (const p of this.players.values()) if (!p.conn.local) p.conn.close(4007, 'The host made this world private');
  }

  /** The host left: everyone else is disconnected. */
  stop(reason = 'The host left the world') {
    if (this.stopped) return;
    this.stopped = true;
    for (const t of this.timers) clearInterval(t);
    for (const p of [...this.players.values()]) if (!p.conn.local) p.conn.close(4009, reason);
    for (const p of [...this.players.values()]) if (p.conn.local) p.conn.close(1000, '');
    this.players.clear();
  }
}

// ---------------- A socket the multiplayer client can use ----------------
/** What MultiplayerClient needs from a connection (a WebSocket has all of this too). */
export type SocketLike = {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((ev?: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { reason?: string; code?: number }) => void) | null;
  onerror: ((ev?: unknown) => void) | null;
};
class BasicSocket implements SocketLike {
  readyState = 0;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  sendImpl: (text: string) => void = () => {};
  closeImpl: () => void = () => {};
  send(data: string) { if (this.readyState === 1) this.sendImpl(data); }
  close() { if (this.readyState >= 2) return; this.readyState = 2; this.closeImpl(); }
  _open() { if (this.readyState !== 0) return; this.readyState = 1; this.onopen?.(); }
  _closed(reason: string, code = 1000) { if (this.readyState === 3) return; this.readyState = 3; this.onclose?.({ reason, code }); }
}

/** The host's own game, connected to its own room (messages are copied like they would be over the network). */
export function loopback(room: HostRoom): SocketLike {
  const sock = new BasicSocket();
  const later = (fn: () => void) => setTimeout(fn, 0);
  const conn: RoomConn = {
    local: true, closed: false, lastSeen: Date.now(), onmessage: null, onclose: null,
    send: (obj) => { if (conn.closed) return; const text = JSON.stringify(obj); later(() => sock.onmessage?.({ data: text })); },
    close: (_code, reason = '') => {
      if (conn.closed) return;
      conn.closed = true;
      later(() => sock._closed(reason));
      conn.onclose?.();
    },
  };
  sock.sendImpl = (text) => { if (!conn.closed) later(() => conn.onmessage?.(text)); };
  sock.closeImpl = () => conn.close(1000, '');
  room.addConnection(conn);
  later(() => sock._open());
  return sock;
}

// ---------------- Peer-to-peer (WebRTC data channels) ----------------
/** A message to set up a connection. Offers go to the host; answers back to the one who asked. */
export type Signal = { kind: 'offer' | 'answer' | 'full'; from: string; to?: string; sdp?: string };
export type SignalLink = { send(s: Signal): void; leave(): void };
/** How peers find each other before they are connected. */
export type Signaling = { join(room: string, onSignal: (s: Signal) => void): Promise<SignalLink> };

/** Signaling through a Supabase Realtime broadcast channel (nothing is stored in the database). */
export function supabaseSignaling(getClient: () => Promise<unknown>): Signaling {
  return {
    async join(room, onSignal) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = (await getClient()) as any;
      const ch = client.channel(`vbroom-${room}`, { config: { broadcast: { self: false, ack: false } } });
      ch.on('broadcast', { event: 'sig' }, (m: { payload?: Signal }) => { if (m && m.payload) onSignal(m.payload); });
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timed out')), 10_000);
        ch.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') { clearTimeout(t); resolve(); }
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { clearTimeout(t); reject(new Error(status)); }
        });
      });
      return {
        send: (s) => { void ch.send({ type: 'broadcast', event: 'sig', payload: s }); },
        leave: () => { try { void client.removeChannel(ch); } catch { /* already gone */ } },
      };
    },
  };
}

/** Public STUN servers (they help two browsers find a direct route; no game data goes through them). */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
];
/** A TURN relay can be added (for very strict networks) by setting window.VIBEBLOX_TURN = [{ urls, username, credential }]. */
function iceServers(): RTCIceServer[] {
  const extra = (globalThis as { VIBEBLOX_TURN?: RTCIceServer[] }).VIBEBLOX_TURN;
  return Array.isArray(extra) ? [...ICE_SERVERS, ...extra] : ICE_SERVERS;
}
function iceDone(pc: RTCPeerConnection, ms = 2500): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') { resolve(); return; }
    const t = setTimeout(resolve, ms);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); resolve(); } });
  });
}
export const randomId = (n = 16) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');

// Big messages (the welcome carries every block edit) are cut into pieces and put back together on the other side.
const CHUNK = 16_000;
const PART = '\u0001';
class Framer {
  private queue: string[] = [];
  private seq = 0;
  constructor(private ch: RTCDataChannel) {
    ch.bufferedAmountLowThreshold = 256 * 1024;
    ch.addEventListener('bufferedamountlow', () => this.drain());
  }
  send(text: string) {
    if (text.length <= CHUNK && text[0] !== PART) this.queue.push(text);
    else {
      const id = (this.seq++).toString(36), n = Math.ceil(text.length / CHUNK);
      for (let i = 0; i < n; i++) this.queue.push(`${PART}${id}:${i}:${n}:${text.slice(i * CHUNK, (i + 1) * CHUNK)}`);
    }
    this.drain();
  }
  private drain() {
    while (this.queue.length && this.ch.readyState === 'open' && this.ch.bufferedAmount < 1024 * 1024) {
      try { this.ch.send(this.queue.shift()!); } catch { this.queue.length = 0; return; }
    }
  }
}
class Unframer {
  private parts = new Map<string, { n: number; got: number; list: string[] }>();
  /** Returns a whole message, or null while pieces are still coming. */
  push(raw: string): string | null {
    if (raw[0] !== PART) return raw;
    const a = raw.indexOf(':', 1), b = raw.indexOf(':', a + 1), c = raw.indexOf(':', b + 1);
    if (a < 0 || b < 0 || c < 0) return null;
    const id = raw.slice(1, a), i = Number(raw.slice(a + 1, b)), n = Number(raw.slice(b + 1, c));
    if (!Number.isInteger(i) || !Number.isInteger(n) || n < 1 || n > 4000 || i < 0 || i >= n) return null;
    let e = this.parts.get(id);
    if (!e) { e = { n, got: 0, list: new Array(n) }; this.parts.set(id, e); if (this.parts.size > 8) this.parts.delete(this.parts.keys().next().value as string); }
    if (e.list[i] === undefined) { e.list[i] = raw.slice(c + 1); e.got++; }
    if (e.got < e.n) return null;
    this.parts.delete(id);
    return e.list.join('');
  }
}

/** The host side: answers everyone who asks to join this room, and hands each new data channel to the room. */
export class PeerHost {
  private link: SignalLink | null = null;
  private peers = new Map<string, { pc: RTCPeerConnection; answer: string | null; at: number }>();
  private stopped = false;
  constructor(private roomId: string, private signaling: Signaling, private room: HostRoom) {}

  async start(): Promise<void> {
    this.link = await this.signaling.join(this.roomId, (s) => { void this.onSignal(s); });
    if (this.stopped) this.link.leave();
  }

  private async onSignal(s: Signal) {
    if (this.stopped || !this.link || s.kind !== 'offer' || typeof s.from !== 'string' || typeof s.sdp !== 'string' || s.sdp.length > 20_000) return;
    const known = this.peers.get(s.from);
    if (known) { if (known.answer) this.link.send({ kind: 'answer', from: 'host', to: s.from, sdp: known.answer }); return; } // they asked again
    if (this.room.full) { this.link.send({ kind: 'full', from: 'host', to: s.from }); return; }
    if (this.peers.size > 64) return;
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    const entry = { pc, answer: null as string | null, at: Date.now() };
    this.peers.set(s.from, entry);
    const forget = () => { if (this.peers.get(s.from) === entry) this.peers.delete(s.from); };
    pc.addEventListener('connectionstatechange', () => { if (pc.connectionState === 'failed' || pc.connectionState === 'closed') { forget(); try { pc.close(); } catch { /* closed */ } } });
    pc.addEventListener('datachannel', (ev) => {
      const ch = ev.channel;
      const attach = () => this.room.addConnection(channelConn(ch, pc, forget));
      if (ch.readyState === 'open') attach(); else ch.addEventListener('open', attach, { once: true });
    });
    setTimeout(() => { if (pc.connectionState !== 'connected') { forget(); try { pc.close(); } catch { /* closed */ } } }, 30_000);
    try {
      await pc.setRemoteDescription({ type: 'offer', sdp: s.sdp });
      await pc.setLocalDescription(await pc.createAnswer());
      await iceDone(pc);
      if (this.stopped) return;
      entry.answer = pc.localDescription?.sdp ?? null;
      if (entry.answer) this.link.send({ kind: 'answer', from: 'host', to: s.from, sdp: entry.answer });
    } catch {
      forget();
      try { pc.close(); } catch { /* closed */ }
    }
  }

  stop() {
    this.stopped = true;
    this.link?.leave();
    this.link = null;
    for (const { pc } of this.peers.values()) { try { pc.close(); } catch { /* closed */ } }
    this.peers.clear();
  }
}

function channelConn(ch: RTCDataChannel, pc: RTCPeerConnection, onGone: () => void): RoomConn {
  const out = new Framer(ch);
  const inbox = new Unframer();
  const conn: RoomConn = {
    closed: false, lastSeen: Date.now(), onmessage: null, onclose: null,
    send: (obj) => { if (!conn.closed && ch.readyState === 'open') out.send(JSON.stringify(obj)); },
    close: (code = 1000, reason = '') => {
      if (conn.closed) return;
      // tell them why first (a data channel has no close reason of its own)
      if (ch.readyState === 'open') { try { ch.send(JSON.stringify({ t: '__close', code, reason })); } catch { /* gone */ } }
      conn.closed = true;
      setTimeout(() => { try { ch.close(); pc.close(); } catch { /* closed */ } }, 300);
      onGone();
      conn.onclose?.();
    },
  };
  ch.addEventListener('message', (ev) => {
    if (typeof ev.data !== 'string') return;
    const text = inbox.push(ev.data);
    if (text !== null) conn.onmessage?.(text);
  });
  const gone = () => { if (conn.closed) return; conn.closed = true; onGone(); conn.onclose?.(); };
  ch.addEventListener('close', gone);
  pc.addEventListener('connectionstatechange', () => { if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') gone(); });
  return conn;
}

/** The joining side: asks the host's room for a connection and gives back a socket for MultiplayerClient. */
export function openPeerSocket(roomId: string, signaling: Signaling, hostName = 'the host'): SocketLike {
  const sock = new BasicSocket();
  const me = randomId(12);
  let pc: RTCPeerConnection | null = null;
  let link: SignalLink | null = null;
  let done = false;
  let framer: Framer | null = null;
  const inbox = new Unframer();
  let closeReason = '';
  const finish = (reason: string) => {
    if (done) return;
    done = true;
    link?.leave();
    try { pc?.close(); } catch { /* closed */ }
    sock._closed(reason, 1006);
  };
  sock.sendImpl = (text) => framer?.send(text);
  sock.closeImpl = () => finish('');
  void (async () => {
    try {
      pc = new RTCPeerConnection({ iceServers: iceServers() });
      const ch = pc.createDataChannel('vibeblox', { ordered: true });
      framer = new Framer(ch);
      ch.addEventListener('open', () => { link?.leave(); link = null; sock._open(); });
      ch.addEventListener('message', (ev) => {
        if (typeof ev.data !== 'string') return;
        const text = inbox.push(ev.data);
        if (text === null) return;
        if (text.startsWith('{"t":"__close"')) { try { closeReason = String(JSON.parse(text).reason ?? ''); } catch { /* odd */ } return; }
        sock.onmessage?.({ data: text });
      });
      ch.addEventListener('close', () => finish(closeReason || (sock.readyState === 1 ? 'Lost connection to the world' : '')));
      pc.addEventListener('connectionstatechange', () => {
        if (pc && (pc.connectionState === 'failed' || (pc.connectionState === 'disconnected' && sock.readyState === 1))) finish(closeReason || 'Lost connection to the world');
      });
      let answered = false;
      link = await signaling.join(roomId, (s) => {
        if (s.to !== me || answered || done || !pc) return;
        if (s.kind === 'full') { finish(`${hostName}'s world is full`); return; }
        if (s.kind !== 'answer' || typeof s.sdp !== 'string') return;
        answered = true;
        pc.setRemoteDescription({ type: 'answer', sdp: s.sdp }).catch(() => finish(`Couldn't connect to ${hostName}'s world`));
      });
      await pc.setLocalDescription(await pc.createOffer());
      await iceDone(pc);
      const offer = { kind: 'offer' as const, from: me, sdp: pc.localDescription?.sdp ?? '' };
      // ask, and ask again a few times in case the host missed it
      for (let i = 0; i < 5 && !answered && !done; i++) {
        link?.send(offer);
        await new Promise((r) => setTimeout(r, 2500));
      }
      if (!answered && !done) { finish(`${hostName}'s world didn't answer. They may have just left.`); return; }
      // connected yet?
      setTimeout(() => {
        if (sock.readyState === 0 && !done) finish(`Couldn't connect to ${hostName}'s world. Your network (or theirs) may block direct connections.`);
      }, 12_000);
    } catch {
      finish(`Couldn't reach ${hostName}'s world. Check your connection.`);
    }
  })();
  return sock;
}
