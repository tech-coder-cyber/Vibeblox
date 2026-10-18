// Browser-side multiplayer client for VibeBlox. Talks JSON over a WebSocket
// to server/server.js. App.tsx wires these events into the game engine.

/** An item thrown on the ground that every player sees. d = a tool's wear/enchantments/name as JSON. */
export type NetDrop = { n: string; item: number; count: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; d?: string };
export const PROTOCOL_VERSION = 17; // 17: world roles (admin / co-owner / owner), hosts hand their world over when they leave; 16: dropped items shared, host commands on other players (@a); 15: turned heads, low trapdoors, block ids 2000+ (14: /title, fake ranks, rank badges (13: sleeping vote, whispers, admin panel (12: block ids up to 1399, items 1400+ (11: weather, host sets time/weather; 10: host, kick/ban, server settings))

export type NetBlock = [number, number, number, number]; // x, y, z, block id
export type NetMove = [number, number, number, number, number, number, string, number, number]; // id, x, y, z, yaw, pitch, mode, held item, action bits
export type NetLook = { skin: string; cape: string; /** A Champion's own skin (a small PNG as a data: URL), when skin is 'custom' */ custom?: string };
export type NetWeather = 'clear' | 'rain' | 'snow' | 'thunder';
/** What shows in front of a signed-in player's name besides a fake rank: owner, paid rank, creator tier. */
export type NetBadge = { owner?: boolean; rank?: string; tier?: string; staff?: string | null; og?: boolean; special?: string | null };
export type NetPlayerInfo = { id: number; name: string; x: number; y: number; z: number; yaw: number; pitch: number; mode: string; look?: NetLook; badge?: NetBadge };

export type ServerSettings = { difficulty: 'peaceful' | 'easy' | 'normal' | 'hard'; keepInventory: boolean; scripts: boolean; mods: boolean; commands: boolean; pvp?: boolean; /** who may run scripts: 'off' | 'all' | 'admin' | 'owner' */ scriptPerm?: 'off' | 'all' | 'admin' | 'owner' };
/** Roles in a world (lowercase name -> 'owner' | 'coowner' | 'admin') */
export type NetRoles = Record<string, string>;
/** A world being handed to you when its host leaves (see HostRoom.handOff in hosting.ts) */
export type NetHandoff = Record<string, unknown> & { seed: number; owner: string; name: string };
/** An online EggWars / Bridge Duels world (see hosting.ts). */
export type NetGame = { kind: 'eggwars' | 'bridge'; variant: number; teams: number; teamSize: number; winScore: number };
export type NetMatch = {
  phase: 'waiting' | 'countdown' | 'playing' | 'over'; left: number; round: number; winner: number | null;
  teams: Array<{ score: number; egg: boolean; out: boolean }>;
  /** [player id, team, out, kills, deaths] */
  members: Array<[number, number, boolean, number, number]>;
  kind: 'eggwars' | 'bridge'; winScore: number;
  starts?: number; auto?: boolean; min?: number;
};
export type Welcome = {
  hostId?: number | null;
  settings?: ServerSettings;
  id: number;
  name: string;
  seed: number;
  worldType: 'default' | 'superflat' | 'eggwars' | 'bridge';
  /** Set for an online EggWars / Bridge Duels world */
  game?: NetGame;
  mode: string;
  time: number;
  changes: NetBlock[];
  players: NetPlayerInfo[];
  weather?: NetWeather;
  /** How many players this server takes right now (18, or 24 when its host is a Rising Creator). */
  maxPlayers?: number;
  /** The fake ranks of this world (see fakeranks.ts). */
  ranks?: unknown;
  /** Roles in this world (player hosted worlds) */
  roles?: NetRoles;
  /** Items already lying on the ground */
  drops?: NetDrop[];
};

export type MultiplayerEvents = {
  onWelcome?: (w: Welcome) => void;
  onHost?: (id: number) => void;
  onSettings?: (s: ServerSettings) => void;
  onBlocks?: (list: NetBlock[]) => void;
  onMoves?: (list: NetMove[]) => void;
  onJoin?: (id: number, name: string) => void;
  onLeave?: (id: number, name: string) => void;
  onLook?: (id: number, look: NetLook) => void;
  onChat?: (name: string, text: string) => void;
  /** Another player threw an item (so everyone sees it and can pick it up). n = its shared id. */
  onDrop?: (d: NetDrop) => void;
  /** An item somebody threw was picked up (by someone else, or the server said yes/no to you). */
  onDropGone?: (n: string) => void;
  onPickupResult?: (n: string, ok: boolean) => void;
  /** The host ran a command (/give, /clear, /effect, /xp, /tp) on you. */
  onRemoteCmd?: (cmd: string, args: Record<string, unknown>, from: string) => void;
  /** The host ran /title on you. */
  onTitle?: (text: string, sub: string) => void;
  /** The host changed the fake ranks. */
  onRanks?: (ranks: unknown) => void;
  onBadge?: (id: number, badge: NetBadge) => void;
  onSystem?: (text: string) => void;
  onTime?: (time: number) => void;
  onWeather?: (kind: NetWeather) => void;
  /** Someone whispered to you / your whisper was delivered / nobody here has that name. */
  onWhisper?: (from: string, text: string) => void;
  onWhispered?: (to: string, text: string) => void;
  onWhisperFail?: (to: string) => void;
  /** An admin changed your game mode. */
  onSetMode?: (mode: string, by: string) => void;
  onAdminPlayers?: (list: Array<{ id: number; name: string; mode: string }>) => void;
  /** Online minigames: the score, eggs and teams; "everyone back to your island"; another player hit you; someone was hit. */
  onMatch?: (m: NetMatch) => void;
  onMatchReset?: (round: number) => void;
  onHurt?: (h: { by: number; name: string; dmg: number; kx: number; kz: number }) => void;
  onHurtFx?: (id: number) => void;
  /** Round trip time to the server, in milliseconds (measured every 2 seconds). */
  onPing?: (ms: number) => void;
  /** Roles changed (admin / co-owner); the owner is in the list too */
  onRoles?: (roles: NetRoles) => void;
  /** Co-owners: the anti-cheat settings, and its alerts */
  onAnticheat?: (settings: { enabled: boolean; autoKick: boolean; kickAt: number }) => void;
  onCheat?: (alert: Record<string, unknown>) => void;
  /** The host left: you are now running the world (start a room with this) */
  onBecomeHost?: (room: string, state: NetHandoff) => void;
  /** The host left and someone else keeps the world: reconnect to this room */
  onMigrate?: (room: string, host: string) => void;
  onClose?: (reason: string) => void;
};

/** Accepts "play.example.com", "wss://play.example.com" or "ws://localhost:8080". A server on this very computer ("localhost:8080") needs no certificate, so it uses plain ws://. */
export function normalizeServerUrl(input: string): string {
  const t = input.trim();
  if (/^wss?:\/\//i.test(t)) return t;
  if (/^https?:\/\//i.test(t)) return t.replace(/^http/i, 'ws');
  if (/^(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?(\/.*)?$/i.test(t)) return 'ws://' + t;
  return 'wss://' + t;
}

/** Anything that carries text messages like a WebSocket does (a hosted world's loopback or peer connection). */
export type SocketLike = {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((ev?: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { reason?: string; code?: number }) => void) | null;
  onerror: ((ev?: unknown) => void) | null;
};
const OPEN = 1;

export class MultiplayerClient {
  private ws: SocketLike | null = null;
  private welcomed = false;
  private closedByUs = false;
  private reported = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pings = new Map<number, number>();
  private pingN = 0;
  /** The last measured ping in ms (-1 until the first answer; old servers never answer). */
  lastPing = -1;
  events: MultiplayerEvents = {};

  // Tell the app exactly once why the connection ended
  private report(reason: string) {
    if (this.reported || this.closedByUs) return;
    this.reported = true;
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null; }
    try { this.ws?.close(); } catch { /* already closed */ }
    this.ws = null;
    this.events.onClose?.(reason);
  }

  /** `token` is your VibeBlox sign-in token (omit it as a guest): with it the server knows who you really are. */
  connect(url: string, name: string, token?: string | null) {
    let ws: SocketLike;
    try {
      ws = new WebSocket(normalizeServerUrl(url)) as unknown as SocketLike;
    } catch {
      this.closedByUs = false;
      this.reported = false;
      this.report('That server address is not valid');
      return;
    }
    this.attach(ws, name, token, 'Could not connect. Check the address, and that the server is running with wss:// set up', 8000);
  }

  /** Play over a connection made some other way (a world hosted in someone's browser, or your own). */
  connectSocket(sock: SocketLike, name: string, token?: string | null, cantConnect = "Couldn't connect to that world", waitMs = 30_000) {
    this.attach(sock, name, token, cantConnect, waitMs);
  }

  private attach(ws: SocketLike, name: string, token: string | null | undefined, cantConnect: string, waitMs: number) {
    this.closedByUs = false;
    this.welcomed = false;
    this.reported = false;
    this.ws = ws;
    // A firewall that silently drops packets can leave a socket hanging for minutes
    this.connectTimer = setTimeout(() => { if (!this.welcomed) this.report(cantConnect); }, waitMs);
    // Some WebSocket implementations fire "error" without a "close" when refused
    ws.onerror = () => { if (!this.welcomed) this.report(cantConnect); };
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', name, version: PROTOCOL_VERSION, ...(token ? { token } : {}) }));
    ws.onmessage = (ev) => {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      this.dispatch(msg);
    };
    ws.onclose = (ev) => {
      this.report(ev.reason || (this.welcomed ? 'Lost connection to the server' : cantConnect));
    };
  }

  private dispatch(m: Record<string, unknown>) {
    const e = this.events;
    switch (m.t) {
      case 'welcome':
        this.welcomed = true;
        if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null; }
        if (!this.pingTimer) this.pingTimer = setInterval(() => this.ping(), 2000);
        this.ping();
        e.onWelcome?.(m as unknown as Welcome);
        break;
      case 'blocks': e.onBlocks?.(m.list as NetBlock[]); break;
      case 'moves': e.onMoves?.(m.list as NetMove[]); break;
      case 'join': e.onJoin?.(m.id as number, m.name as string); break;
      case 'host': e.onHost?.(m.id as number); break;
      case 'settings': e.onSettings?.(m.settings as ServerSettings); break;
      case 'leave': e.onLeave?.(m.id as number, m.name as string); break;
      case 'look': e.onLook?.(m.id as number, { skin: String(m.skin), cape: String(m.cape), ...(typeof m.custom === 'string' ? { custom: m.custom } : {}) }); break;
      case 'chat': e.onChat?.(m.name as string, m.text as string); break;
      case 'drop': e.onDrop?.({ n: String(m.n), item: Number(m.item), count: Number(m.count), x: Number(m.x), y: Number(m.y), z: Number(m.z), vx: Number(m.vx), vy: Number(m.vy), vz: Number(m.vz), ...(typeof m.d === 'string' ? { d: m.d } : {}) }); break;
      case 'gone': e.onDropGone?.(String(m.n)); break;
      case 'pickupOk': e.onPickupResult?.(String(m.n), true); break;
      case 'pickupNo': e.onPickupResult?.(String(m.n), false); break;
      case 'rcmd': e.onRemoteCmd?.(String(m.cmd), (m.args && typeof m.args === 'object' ? m.args : {}) as Record<string, unknown>, String(m.from ?? 'The host')); break;
      case 'title': e.onTitle?.(String(m.text ?? ''), String(m.sub ?? '')); break;
      case 'ranks': e.onRanks?.(m.ranks); break;
      case 'badge': e.onBadge?.(m.id as number, { owner: !!m.owner, rank: String(m.rank ?? 'none'), tier: String(m.tier ?? 'none'), staff: m.staff === 'helper' || m.staff === 'mod' ? m.staff : null, og: m.og === true, special: m.special === 'youtube' ? 'youtube' : null }); break;
      case 'system': e.onSystem?.(m.text as string); break;
      case 'time': e.onTime?.(m.time as number); break;
      case 'whisper': e.onWhisper?.(String(m.from), String(m.text)); break;
      case 'whispered': e.onWhispered?.(String(m.to), String(m.text)); break;
      case 'whisperFail': e.onWhisperFail?.(String(m.to)); break;
      case 'setmode': e.onSetMode?.(String(m.mode), String(m.by)); break;
      case 'adminPlayers': e.onAdminPlayers?.(m.list as Array<{ id: number; name: string; mode: string }>); break;
      case 'match': e.onMatch?.(m as unknown as NetMatch); break;
      case 'mgReset': e.onMatchReset?.(Number(m.round) || 0); break;
      case 'hurt': if (typeof m.dmg === 'number') e.onHurt?.({ by: Number(m.by), name: String(m.name ?? 'Someone'), dmg: m.dmg, kx: Number(m.kx) || 0, kz: Number(m.kz) || 0 }); break;
      case 'hurtFx': e.onHurtFx?.(Number(m.id)); break;
      case 'roles': if (m.roles && typeof m.roles === 'object') e.onRoles?.(m.roles as NetRoles); break;
      case 'acset': if (m.settings && typeof m.settings === 'object') e.onAnticheat?.(m.settings as { enabled: boolean; autoKick: boolean; kickAt: number }); break;
      case 'cheat': if (m.alert && typeof m.alert === 'object') e.onCheat?.(m.alert as Record<string, unknown>); break;
      case 'becomeHost': if (typeof m.room === 'string' && m.state && typeof m.state === 'object') e.onBecomeHost?.(m.room, m.state as NetHandoff); break;
      case 'migrate': if (typeof m.room === 'string') e.onMigrate?.(m.room, String(m.host ?? 'another player')); break;
      case 'weather': if (m.kind === 'clear' || m.kind === 'rain' || m.kind === 'snow' || m.kind === 'thunder') e.onWeather?.(m.kind); break;
      case 'pong': {
        const sent = this.pings.get(Number(m.n));
        if (sent !== undefined) { this.pings.delete(Number(m.n)); this.lastPing = Math.round(performance.now() - sent); e.onPing?.(this.lastPing); }
        break;
      }
      default:
    }
  }

  private send(obj: unknown) {
    if (this.ws && this.ws.readyState === OPEN) this.ws.send(JSON.stringify(obj));
  }

  get connected(): boolean {
    return this.welcomed && !!this.ws && this.ws.readyState === OPEN;
  }

  sendMove(x: number, y: number, z: number, yaw: number, pitch: number, mode: string, held = 0, act = 0) {
    this.send({ t: 'move', x, y, z, yaw, pitch, mode, held, act });
  }

  /** Tell the world's host that this page runs an outside script (see integrity.ts). Only flags it knows are sent. */
  sendIntegrity(flags: string[]) { this.send({ t: 'integrity', flags: flags.slice(0, 6).map((f) => String(f).slice(0, 30)) }); }

  sendBlocks(list: NetBlock[]) {
    for (let i = 0; i < list.length; i += 256) this.send({ t: 'blocks', list: list.slice(i, i + 256) });
  }

  /** Host only: change the server's rules. */
  sendSettings(settings: Partial<ServerSettings>) { this.send({ t: 'settings', settings }); }
  /** Host only: remove a player (ban also keeps them out). */
  /** Host only: set the time of day (0 sunrise, 0.25 noon, 0.5 sunset, 0.75 midnight) or the weather. */
  sendTime(time: number) { this.send({ t: 'settime', time }); }
  sendWeather(kind: NetWeather) { this.send({ t: 'weather', kind }); }
  kick(id: number) { this.send({ t: 'kick', id }); }
  ban(id: number) { this.send({ t: 'ban', id }); }

  /** Tell everyone your skin and cape (send once after joining, and whenever it changes). */
  sendLook(look: NetLook) {
    this.send({ t: 'look', skin: look.skin, cape: look.cape, ...(look.skin === 'custom' && look.custom ? { custom: look.custom } : {}) });
  }

  /** Tell the server you got into / out of bed (the night passes when half the players sleep). */
  sendSleep(on: boolean) { this.send({ t: 'sleep', on }); }
  /** You threw an item: everyone else sees it. */
  sendDrop(d: NetDrop) { this.send({ t: 'drop', ...d }); }
  /** You walked up to a thrown item: the server says whether you got it (pickupOk) or somebody else did (pickupNo). */
  sendPickup(n: string) { this.send({ t: 'pickup', n }); }
  /** Host only: run a command on another player ('*' = everyone else): give, clear, effect, xp, tp. */
  sendRemoteCmd(to: string, cmd: string, args: Record<string, unknown>) { this.send({ t: 'rcmd', to, cmd, args }); }
  /** Host only: show a title on one player's screen (their name) or everyone's ('*'). */
  sendTitle(to: string, text: string, sub = '') { this.send({ t: 'title', to, text, sub }); }
  /** Host only: send the fake ranks list (it is kept with the world and everyone gets it). */
  sendRanks(ranks: unknown) { this.send({ t: 'ranks', ranks }); }
  /** Give a player a role in this world ('none' takes it away) */
  sendPromote(name: string, role: 'admin' | 'coowner' | 'none') { this.send({ t: 'promote', name, role }); }
  /** World admins: kick, ban or unban by name */
  sendMod(action: 'kick' | 'ban' | 'unban', name: string) { this.send({ t: 'mod', action, name }); }
  /** Co-owners: change the anti-cheat settings */
  sendAnticheat(settings: { enabled: boolean; autoKick: boolean; kickAt: number }) { this.send({ t: 'acset', settings }); }
  /** A private message to a player on this server. */
  sendWhisper(to: string, text: string) { this.send({ t: 'whisper', to, text }); }
  /** You hit another player: dmg before their armor, k = the direction they get knocked (unit vector on the ground). */
  sendHit(id: number, dmg: number, kx: number, kz: number, bow = false) { this.send({ t: 'hit', id, dmg: Math.round(dmg * 10) / 10, kx: Math.round(kx * 100) / 100, kz: Math.round(kz * 100) / 100, ...(bow ? { bow: true } : {}) }); }
  /** Online minigames: start (host), you died (by: who killed you), you broke a team's egg, you scored in a team's goal. */
  sendMatchStart() { this.send({ t: 'mgStart' }); }
  sendMatchDied(by: number | null) { this.send({ t: 'mgDied', ...(by !== null ? { by } : {}) }); }
  sendMatchEgg(team: number) { this.send({ t: 'mgEgg', team }); }
  sendMatchGoal(team: number) { this.send({ t: 'mgGoal', team }); }
  /** You ran out of respawns (your egg broke while you were waiting to come back) */
  sendMatchOut() { this.send({ t: 'mgOut' }); }
  /** Admin panel actions. The server checks the token with Supabase before doing anything. */
  sendAdmin(token: string, action: 'check' | 'players' | 'kick' | 'ban' | 'unban' | 'bans' | 'gamemode' | 'mute' | 'unmute' | 'mutes', extra: { name?: string; mode?: string } = {}) {
    this.send({ t: 'admin', token, action, ...extra });
  }

  sendChat(text: string) {
    this.send({ t: 'chat', text });
  }

  private ping() {
    if (!this.connected) return;
    const n = ++this.pingN;
    this.pings.set(n, performance.now());
    if (this.pings.size > 10) this.pings.delete(this.pings.keys().next().value as number);
    this.send({ t: 'ping', n });
  }

  disconnect() {
    this.closedByUs = true;
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null; }
    this.ws?.close();
    this.ws = null;
  }
}
