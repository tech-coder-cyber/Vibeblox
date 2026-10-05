// Browser-side multiplayer client for VibeBlox. Talks JSON over a WebSocket
// to server/server.js. App.tsx wires these events into the game engine.

export const PROTOCOL_VERSION = 8; // 8: block ids 1000+, new biomes (7: held items; 6: farming, furnaces, glass, doors; 5: skins and capes)

export type NetBlock = [number, number, number, number]; // x, y, z, block id
export type NetMove = [number, number, number, number, number, number, string, number, number]; // id, x, y, z, yaw, pitch, mode, held item, action bits
export type NetLook = { skin: string; cape: string };
export type NetPlayerInfo = { id: number; name: string; x: number; y: number; z: number; yaw: number; pitch: number; mode: string; look?: NetLook };

export type Welcome = {
  id: number;
  name: string;
  seed: number;
  worldType: 'default' | 'superflat';
  mode: string;
  time: number;
  changes: NetBlock[];
  players: NetPlayerInfo[];
};

export type MultiplayerEvents = {
  onWelcome?: (w: Welcome) => void;
  onBlocks?: (list: NetBlock[]) => void;
  onMoves?: (list: NetMove[]) => void;
  onJoin?: (id: number, name: string) => void;
  onLeave?: (id: number, name: string) => void;
  onLook?: (id: number, look: NetLook) => void;
  onChat?: (name: string, text: string) => void;
  onSystem?: (text: string) => void;
  onTime?: (time: number) => void;
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
  events: MultiplayerEvents = {};

  // Tell the app exactly once why the connection ended
  private report(reason: string) {
    if (this.reported || this.closedByUs) return;
    this.reported = true;
    if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null; }
    try { this.ws?.close(); } catch { /* already closed */ }
    this.ws = null;
    this.events.onClose?.(reason);
  }

  connect(url: string, name: string) {
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
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', name, version: PROTOCOL_VERSION }));
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
        e.onWelcome?.(m as unknown as Welcome);
        break;
      case 'blocks': e.onBlocks?.(m.list as NetBlock[]); break;
      case 'moves': e.onMoves?.(m.list as NetMove[]); break;
      case 'join': e.onJoin?.(m.id as number, m.name as string); break;
      case 'leave': e.onLeave?.(m.id as number, m.name as string); break;
      case 'look': e.onLook?.(m.id as number, { skin: String(m.skin), cape: String(m.cape) }); break;
      case 'chat': e.onChat?.(m.name as string, m.text as string); break;
      case 'system': e.onSystem?.(m.text as string); break;
      case 'time': e.onTime?.(m.time as number); break;
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

  /** Tell everyone your skin and cape (send once after joining, and whenever it changes). */
  sendLook(look: NetLook) {
    this.send({ t: 'look', skin: look.skin, cape: look.cape });
  }

  sendChat(text: string) {
    this.send({ t: 'chat', text });
  }

  disconnect() {
    this.closedByUs = true;
    if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null; }
    this.ws?.close();
    this.ws = null;
  }
}
