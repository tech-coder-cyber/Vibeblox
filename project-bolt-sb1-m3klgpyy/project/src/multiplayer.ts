// Browser-side multiplayer client for VibeBlox. Talks JSON over a WebSocket
// to server/server.js. App.tsx wires these events into the game engine.

export const PROTOCOL_VERSION = 14; // 14: /title, fake ranks, rank badges (13: sleeping vote, whispers, admin panel (12: block ids up to 1399, items 1400+ (11: weather, host sets time/weather; 10: host, kick/ban, server settings))

export type NetBlock = [number, number, number, number]; // x, y, z, block id
export type NetMove = [number, number, number, number, number, number, string, number, number]; // id, x, y, z, yaw, pitch, mode, held item, action bits
export type NetLook = { skin: string; cape: string; /** A Champion's own skin (a small PNG as a data: URL), when skin is 'custom' */ custom?: string };
export type NetWeather = 'clear' | 'rain' | 'snow';
/** What shows in front of a signed-in player's name besides a fake rank: owner, paid rank, creator tier. */
export type NetBadge = { owner?: boolean; rank?: string; tier?: string };
export type NetPlayerInfo = { id: number; name: string; x: number; y: number; z: number; yaw: number; pitch: number; mode: string; look?: NetLook; badge?: NetBadge };

export type ServerSettings = { difficulty: 'peaceful' | 'easy' | 'normal' | 'hard'; keepInventory: boolean; scripts: boolean; mods: boolean; commands: boolean };
export type Welcome = {
  hostId?: number | null;
  settings?: ServerSettings;
  id: number;
  name: string;
  seed: number;
  worldType: 'default' | 'superflat';
  mode: string;
  time: number;
  changes: NetBlock[];
  players: NetPlayerInfo[];
  weather?: NetWeather;
  /** How many players this server takes right now (18, or 24 when its host is a Rising Creator). */
  maxPlayers?: number;
  /** The fake ranks of this world (see fakeranks.ts). */
  ranks?: unknown;
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
  /** Round trip time to the server, in milliseconds (measured every 2 seconds). */
  onPing?: (ms: number) => void;
  onClose?: (reason: string) => void;
};

/** Accepts "play.example.com", "wss://play.example.com" or "ws://localhost:8080". */
export function normalizeServerUrl(input: string): string {
  const t = input.trim();
  if (/^wss?:\/\//i.test(t)) return t;
  if (/^https?:\/\//i.test(t)) return t.replace(/^http/i, 'ws');
  return 'wss://' + t;
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
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
    this.closedByUs = false;
    this.welcomed = false;
    this.reported = false;
    let ws: WebSocket;
    try {
      ws = new WebSocket(normalizeServerUrl(url));
    } catch {
      this.report('That server address is not valid');
      return;
    }
    this.ws = ws;
    const cantConnect = 'Could not connect. Check the address, and that the server is running with wss:// set up';
    // A firewall that silently drops packets can leave a socket hanging for minutes
    this.connectTimer = setTimeout(() => { if (!this.welcomed) this.report(cantConnect); }, 8000);
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
      case 'title': e.onTitle?.(String(m.text ?? ''), String(m.sub ?? '')); break;
      case 'ranks': e.onRanks?.(m.ranks); break;
      case 'badge': e.onBadge?.(m.id as number, { owner: !!m.owner, rank: String(m.rank ?? 'none'), tier: String(m.tier ?? 'none') }); break;
      case 'system': e.onSystem?.(m.text as string); break;
      case 'time': e.onTime?.(m.time as number); break;
      case 'whisper': e.onWhisper?.(String(m.from), String(m.text)); break;
      case 'whispered': e.onWhispered?.(String(m.to), String(m.text)); break;
      case 'whisperFail': e.onWhisperFail?.(String(m.to)); break;
      case 'setmode': e.onSetMode?.(String(m.mode), String(m.by)); break;
      case 'adminPlayers': e.onAdminPlayers?.(m.list as Array<{ id: number; name: string; mode: string }>); break;
      case 'weather': if (m.kind === 'clear' || m.kind === 'rain' || m.kind === 'snow') e.onWeather?.(m.kind); break;
      case 'pong': {
        const sent = this.pings.get(Number(m.n));
        if (sent !== undefined) { this.pings.delete(Number(m.n)); this.lastPing = Math.round(performance.now() - sent); e.onPing?.(this.lastPing); }
        break;
      }
      default:
    }
  }

  private send(obj: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  get connected(): boolean {
    return this.welcomed && !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  sendMove(x: number, y: number, z: number, yaw: number, pitch: number, mode: string, held = 0, act = 0) {
    this.send({ t: 'move', x, y, z, yaw, pitch, mode, held, act });
  }

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
  /** Host only: show a title on one player's screen (their name) or everyone's ('*'). */
  sendTitle(to: string, text: string, sub = '') { this.send({ t: 'title', to, text, sub }); }
  /** Host only: send the fake ranks list (it is kept with the world and everyone gets it). */
  sendRanks(ranks: unknown) { this.send({ t: 'ranks', ranks }); }
  /** A private message to a player on this server. */
  sendWhisper(to: string, text: string) { this.send({ t: 'whisper', to, text }); }
  /** Admin panel actions. The server checks the token with Supabase before doing anything. */
  sendAdmin(token: string, action: 'check' | 'players' | 'kick' | 'ban' | 'gamemode', extra: { name?: string; mode?: string } = {}) {
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
