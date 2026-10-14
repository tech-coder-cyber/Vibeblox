// Anti-cheat for worlds players host (it runs inside the host's room, see hosting.ts).
// It only looks at what the room already sees: positions 10 times a second, hits on other players, block edits and
// chat. Nothing here is perfect: a check can be fooled by lag or a weird case, so a single slip is never punished.
// Each check adds "violation points" to the player; alerts go to the host (and to the admins' report list), and
// with auto-kick on, a player who keeps setting checks off is kicked.
//
// Checks:
//   fly          in the air for a long time without falling (survival / adventure only)
//   speed        moving faster than sprint-jumping with Speed II allows
//   reach        hitting a player from further away than an arm can reach
//   killaura     hitting players who are behind you, or several players in different directions at once
//   autoclicker  more than 16 hits a second, or clicks timed too perfectly for a hand
//   nuker        breaking or placing blocks much faster than a person can (survival)
//   spam         a flood of chat messages

export type CheatKind = 'fly' | 'speed' | 'reach' | 'killaura' | 'autoclicker' | 'nuker' | 'spam';
export const CHEAT_LABELS: Record<CheatKind, string> = {
  fly: 'Flying', speed: 'Speed', reach: 'Reach', killaura: 'Kill aura', autoclicker: 'Auto clicker', nuker: 'Nuker (fast building)', spam: 'Chat spam',
};
export type CheatAlert = { at: number; id: number; player: string; kind: CheatKind; detail: string; points: number };
export type AntiCheatSettings = { enabled: boolean; autoKick: boolean; kickAt: number };
export const DEFAULT_ANTICHEAT: AntiCheatSettings = { enabled: true, autoKick: true, kickAt: 12 };

type Sample = { t: number; x: number; y: number; z: number };
type Track = {
  name: string; mode: string;
  last: Sample | null;
  airSince: number; airStartY: number; lowestY: number; // fly: when they left the ground, and how far they fell since
  speedWindow: Sample[]; speedStrikes: number;
  hits: number[]; hitTargets: Array<{ t: number; dir: number }>;
  edits: number[];
  chats: number[];
  points: number;
  lastAlert: Partial<Record<CheatKind, number>>;
  graceUntil: number; // after joining or a teleport: positions settle first
};

/**
 * Tells the anti-cheat what the world looks like near a position (null: that part isn't loaded on the host,
 * so the check is skipped). It answers "is there anything to stand on, climb or swim in around this spot?".
 */
export type GroundProbe = (x: number, y: number, z: number) => boolean | null;

export class AntiCheat {
  settings: AntiCheatSettings;
  private tracks = new Map<number, Track>();
  constructor(private hooks: { onAlert: (a: CheatAlert) => void; onKick?: (id: number, reason: string) => void; ground?: GroundProbe; now?: () => number }, settings?: Partial<AntiCheatSettings>) {
    this.settings = { ...DEFAULT_ANTICHEAT, ...(settings ?? {}) };
  }
  private now() { return this.hooks.now ? this.hooks.now() : Date.now(); }
  private track(id: number, name: string): Track {
    let tr = this.tracks.get(id);
    if (!tr) {
      tr = { name, mode: 'survival', last: null, airSince: 0, airStartY: 0, lowestY: 0, speedWindow: [], speedStrikes: 0, hits: [], hitTargets: [], edits: [], chats: [], points: 0, lastAlert: {}, graceUntil: this.now() + 3000 };
      this.tracks.set(id, tr);
    }
    tr.name = name;
    return tr;
  }
  remove(id: number) { this.tracks.delete(id); }
  points(id: number) { return this.tracks.get(id)?.points ?? 0; }
  /** The host teleported this player (or they respawned): the next moves are not judged. */
  excuse(id: number, ms = 3000) { const tr = this.tracks.get(id); if (tr) { tr.graceUntil = this.now() + ms; tr.last = null; tr.airSince = 0; tr.speedWindow = []; } }

  private flag(id: number, tr: Track, kind: CheatKind, detail: string, points: number) {
    if (!this.settings.enabled) return;
    tr.points += points;
    const t = this.now();
    const quiet = (tr.lastAlert[kind] ?? 0) > t - 5000; // one alert per kind per player every 5 seconds
    if (!quiet) {
      tr.lastAlert[kind] = t;
      this.hooks.onAlert({ at: t, id, player: tr.name, kind, detail, points: tr.points });
    }
    if (this.settings.autoKick && tr.points >= this.settings.kickAt && this.hooks.onKick) {
      tr.points = 0;
      this.hooks.onKick(id, `Kicked by anti-cheat (${CHEAT_LABELS[kind].toLowerCase()})`);
    }
  }

  /** A position update from a player. */
  onMove(id: number, name: string, x: number, y: number, z: number, mode: string) {
    const tr = this.track(id, name);
    const t = this.now();
    const changedMode = tr.mode !== mode;
    tr.mode = mode;
    const prev = tr.last;
    tr.last = { t, x, y, z };
    const judged = mode === 'survival' || mode === 'adventure';
    if (!judged || changedMode || t < tr.graceUntil || !prev) { tr.airSince = 0; tr.speedWindow = []; return; }
    const step = Math.hypot(x - prev.x, z - prev.z);
    if (step > 12 || Math.abs(y - prev.y) > 12) { tr.airSince = 0; tr.speedWindow = []; return; } // a teleport (ender pearl, /tp, respawn): not judged

    // ---- speed: horizontal distance over the last second ----
    tr.speedWindow.push({ t, x, y, z });
    while (tr.speedWindow.length > 2 && t - tr.speedWindow[0].t > 1000) tr.speedWindow.shift();
    const first = tr.speedWindow[0];
    const span = (t - first.t) / 1000;
    if (span >= 0.8) {
      const v = Math.hypot(x - first.x, z - first.z) / span;
      if (v > 13) { // sprint-jumping is about 7 blocks a second, with Speed II about 10; boats on ice are the exception
        tr.speedStrikes++;
        if (tr.speedStrikes >= 3) { this.flag(id, tr, 'speed', `${v.toFixed(1)} blocks/s`, 2); tr.speedStrikes = 0; }
      } else tr.speedStrikes = Math.max(0, tr.speedStrikes - 1);
    }

    // ---- fly: nothing to stand on, climb or swim in, and not falling ----
    const probe = this.hooks.ground;
    if (!probe) return;
    const support = probe(x, y, z);
    if (support === null || support) { tr.airSince = 0; return; }
    if (!tr.airSince) { tr.airSince = t; tr.airStartY = y; tr.lowestY = y; return; }
    tr.lowestY = Math.min(tr.lowestY, y);
    const airFor = (t - tr.airSince) / 1000;
    const fell = tr.airStartY - tr.lowestY;
    // a jump lasts about 0.6 s; after 1.6 s in the air a player who isn't flying has fallen a long way
    if (airFor > 1.6 && fell < 2 && y >= tr.lowestY - 0.5) {
      this.flag(id, tr, 'fly', `${airFor.toFixed(1)} s in the air, fell ${Math.max(0, fell).toFixed(1)} blocks`, 3);
      tr.airSince = t; tr.airStartY = y; tr.lowestY = y; // judge the next stretch on its own
    }
  }

  /**
   * A melee hit on another player. Positions are feet positions; yaw is where the attacker faces (radians, the
   * game's convention: forward is (-sin yaw, -cos yaw)).
   */
  onHit(id: number, name: string, from: { x: number; y: number; z: number; yaw: number }, to: { x: number; y: number; z: number }) {
    const tr = this.track(id, name);
    const t = this.now();
    // reach: eye to the nearest point of the target's body
    const eyeY = from.y + 1.62;
    const cy = Math.max(to.y, Math.min(to.y + 1.8, eyeY));
    const dx = to.x - from.x, dz = to.z - from.z;
    const flat = Math.max(0, Math.hypot(dx, dz) - 0.3);
    const dist = Math.hypot(flat, cy - eyeY);
    if (dist > 4.6) this.flag(id, tr, 'reach', `hit from ${dist.toFixed(1)} blocks`, dist > 6 ? 3 : 2);
    // kill aura: the target is behind them, or hits sweep round in different directions at once
    const dir = Math.atan2(dx, dz); // angle to the target
    const facing = Math.atan2(-Math.sin(from.yaw), -Math.cos(from.yaw));
    let off = Math.abs(dir - facing) % (Math.PI * 2);
    if (off > Math.PI) off = Math.PI * 2 - off;
    if (Math.hypot(dx, dz) > 1.2 && off > (115 * Math.PI) / 180) this.flag(id, tr, 'killaura', 'hit someone behind them', 3);
    tr.hitTargets.push({ t, dir });
    while (tr.hitTargets.length && t - tr.hitTargets[0].t > 400) tr.hitTargets.shift();
    for (const h of tr.hitTargets) {
      let d = Math.abs(h.dir - dir) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d > (100 * Math.PI) / 180) { this.flag(id, tr, 'killaura', 'hit players on opposite sides at once', 3); break; }
    }
    // auto clicker: hits a second, and how even the gaps are
    tr.hits.push(t);
    while (tr.hits.length && t - tr.hits[0] > 3000) tr.hits.shift();
    const lastSecond = tr.hits.filter((h) => t - h <= 1000).length;
    if (lastSecond > 16) this.flag(id, tr, 'autoclicker', `${lastSecond} hits in a second`, 2);
    else if (tr.hits.length >= 14) {
      const gaps = tr.hits.slice(1).map((h, i) => h - tr.hits[i]);
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
      if (mean < 150 && sd < 6) this.flag(id, tr, 'autoclicker', `clicks ${Math.round(mean)} ms apart, never more than ${Math.round(sd)} ms off`, 2);
    }
  }

  /** Blocks this player broke or placed (count in this message). */
  onBlocks(id: number, name: string, count: number, mode: string) {
    const tr = this.track(id, name);
    if (mode !== 'survival' && mode !== 'adventure') return;
    const t = this.now();
    for (let i = 0; i < Math.min(count, 200); i++) tr.edits.push(t);
    while (tr.edits.length && t - tr.edits[0] > 1000) tr.edits.shift();
    if (tr.edits.length > 25) { this.flag(id, tr, 'nuker', `${tr.edits.length} blocks in a second`, 2); tr.edits = []; }
  }

  /** A chat message. Returns false if it should be dropped (flooding). */
  onChat(id: number, name: string): boolean {
    const tr = this.track(id, name);
    const t = this.now();
    tr.chats.push(t);
    while (tr.chats.length && t - tr.chats[0] > 4000) tr.chats.shift();
    if (tr.chats.length > 7) { this.flag(id, tr, 'spam', `${tr.chats.length} messages in 4 seconds`, 1); return false; }
    return true;
  }
}
