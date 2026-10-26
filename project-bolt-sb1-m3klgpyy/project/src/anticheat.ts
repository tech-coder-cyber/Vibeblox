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
//   spam         a flood of chat messages, or the same message again and again
//
// Violation points fade away: one point is forgiven every 45 seconds of play, so a laggy connection never adds up to a kick.
//   highjump     rising far higher than any jump (or Jump Boost) can take you without anything to stand on
//   teleport     many long jumps in a few seconds that are no ender pearls or respawns
//   multiaura    hitting three or more different players within half a second
//   aimbot       hit after hit with the crosshair dead on the target, far steadier than a hand
//   script       the player's game reports an outside script (Tampermonkey, Greasemonkey, a pasted console script...)
//
// Not cheating, so never flagged: creative / spectator, gliding with an elytra and firework boosts, the first moments after the
// game mode changes (any way: F3+F4, /gamemode, a menu), teleports, respawns and portals.

export type CheatKind = 'fly' | 'speed' | 'reach' | 'killaura' | 'autoclicker' | 'nuker' | 'spam' | 'script' | 'highjump' | 'teleport' | 'multiaura' | 'aimbot';
export const CHEAT_LABELS: Record<CheatKind, string> = {
  fly: 'Flying', speed: 'Speed', reach: 'Reach', killaura: 'Kill aura', autoclicker: 'Auto clicker', nuker: 'Nuker (fast building)', spam: 'Chat spam', script: 'Outside script', highjump: 'High jump', teleport: 'Teleporting', multiaura: 'Multi aura', aimbot: 'Aim assist',
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
  chats: number[]; lastChat: string; sameChats: number[];
  longJumps: number[]; hitIds: Array<{ t: number; id: number }>; aimStreak: number;
  points: number; pointsAt: number;
  lastAlert: Partial<Record<CheatKind, number>>;
  graceUntil: number; // after joining or a teleport: positions settle first
  glideUntil: number; // gliding with an elytra (and a few seconds after landing) is not flying
  scriptFlags: string;
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
      tr = { name, mode: 'survival', last: null, airSince: 0, airStartY: 0, lowestY: 0, speedWindow: [], speedStrikes: 0, hits: [], hitTargets: [], edits: [], chats: [], lastChat: '', sameChats: [], longJumps: [], hitIds: [], aimStreak: 0, points: 0, pointsAt: this.now(), lastAlert: {}, graceUntil: this.now() + 3000, glideUntil: 0, scriptFlags: '' };
      this.tracks.set(id, tr);
    }
    tr.name = name;
    return tr;
  }
  remove(id: number) { this.tracks.delete(id); }
  /** The player's mode was changed on purpose (/gamemode, F3+F4...): the next few seconds of movement are not judged. */
  modeChanged(id: number, mode?: string) { const tr = this.tracks.get(id); if (tr) { if (mode) tr.mode = mode; tr.graceUntil = this.now() + 4000; tr.airSince = 0; tr.speedWindow = []; tr.last = null; } }
  /**
   * The player's game says an outside script is running (userscript manager, pasted console script...). It can't be proven from
   * here, so it is one alert with some points, and the same flags don't raise it again.
   */
  onScript(id: number, name: string, flags: string[]) {
    const tr = this.track(id, name);
    const key = flags.slice().sort().join(',');
    if (!key || key === tr.scriptFlags) return;
    tr.scriptFlags = key;
    this.flag(id, tr, 'script', flags.join(', ').slice(0, 120), 4);
  }
  points(id: number) { return this.tracks.get(id)?.points ?? 0; }
  /** The host teleported this player (or they respawned): the next moves are not judged. */
  excuse(id: number, ms = 3000) { const tr = this.tracks.get(id); if (tr) { tr.graceUntil = this.now() + ms; tr.last = null; tr.airSince = 0; tr.speedWindow = []; } }

  private flag(id: number, tr: Track, kind: CheatKind, detail: string, points: number) {
    if (!this.settings.enabled) return;
    const t = this.now();
    // old points fade: 1 per 45 s since the last time this player was judged
    if (tr.points > 0) tr.points = Math.max(0, tr.points - Math.floor((t - tr.pointsAt) / 45000));
    tr.pointsAt = t;
    tr.points += points;
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
  onMove(id: number, name: string, x: number, y: number, z: number, mode: string, gliding = false) {
    const tr = this.track(id, name);
    const t = this.now();
    const changedMode = tr.mode !== mode;
    tr.mode = mode;
    if (changedMode) tr.graceUntil = Math.max(tr.graceUntil, t + 4000); // a mode change (creative <-> survival, however it happened) is never cheating
    if (gliding) tr.glideUntil = t + 5000; // elytra and firework boosts are fast and stay in the air on purpose
    const prev = tr.last;
    tr.last = { t, x, y, z };
    if (prev && t - prev.t > 500) { tr.airSince = 0; tr.speedWindow = []; return; } // a pause in the stream (lag, a hidden tab): what came before says nothing about what comes next
    const judged = mode === 'survival' || mode === 'adventure';
    if (!judged || changedMode || t < tr.graceUntil || t < tr.glideUntil || !prev) { tr.airSince = 0; tr.speedWindow = []; return; }
    const step = Math.hypot(x - prev.x, z - prev.z);
    if (step > 12 || Math.abs(y - prev.y) > 12) { // a teleport (ender pearl, /tp, respawn): not judged, but five of them in ten seconds is a cheat
      tr.airSince = 0; tr.speedWindow = [];
      tr.longJumps.push(t);
      while (tr.longJumps.length && t - tr.longJumps[0] > 10000) tr.longJumps.shift();
      if (tr.longJumps.length >= 5) { this.flag(id, tr, 'teleport', `${tr.longJumps.length} long jumps in 10 seconds`, 4); tr.longJumps = []; }
      return;
    }

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
    // no jump (even with Jump Boost III) rises more than about 5 blocks
    if (y - tr.airStartY > 5.5) {
      this.flag(id, tr, 'highjump', `rose ${(y - tr.airStartY).toFixed(1)} blocks in the air`, 3);
      tr.airSince = t; tr.airStartY = y; tr.lowestY = y;
      return;
    }
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
  onHit(id: number, name: string, from: { x: number; y: number; z: number; yaw: number }, to: { x: number; y: number; z: number }, maxReach = 4.6, targetId?: number) {
    const tr = this.track(id, name);
    const t = this.now();
    if (targetId !== undefined) { // hits on three different players within half a second
      tr.hitIds.push({ t, id: targetId });
      while (tr.hitIds.length && t - tr.hitIds[0].t > 500) tr.hitIds.shift();
      if (new Set(tr.hitIds.map((h) => h.id)).size >= 3) { this.flag(id, tr, 'multiaura', 'hit 3 players within half a second', 4); tr.hitIds = []; }
    }
    // reach: eye to the nearest point of the target's body
    const eyeY = from.y + 1.62;
    const cy = Math.max(to.y, Math.min(to.y + 1.8, eyeY));
    const dx = to.x - from.x, dz = to.z - from.z;
    const flat = Math.max(0, Math.hypot(dx, dz) - 0.3);
    const dist = Math.hypot(flat, cy - eyeY);
    if (dist > maxReach) this.flag(id, tr, 'reach', `hit from ${dist.toFixed(1)} blocks`, dist > maxReach + 1.4 ? 3 : 2);
    // kill aura: the target is behind them, or hits sweep round in different directions at once
    const dir = Math.atan2(dx, dz); // angle to the target
    const facing = Math.atan2(-Math.sin(from.yaw), -Math.cos(from.yaw));
    let off = Math.abs(dir - facing) % (Math.PI * 2);
    if (off > Math.PI) off = Math.PI * 2 - off;
    if (Math.hypot(dx, dz) > 1.2 && off > (115 * Math.PI) / 180) this.flag(id, tr, 'killaura', 'hit someone behind them', 3);
    // aim assist: eight hits in a row with the crosshair almost exactly on the target
    if (Math.hypot(dx, dz) > 2.5 && off < (0.6 * Math.PI) / 180) tr.aimStreak++; else tr.aimStreak = 0;
    if (tr.aimStreak >= 8) { this.flag(id, tr, 'aimbot', `${tr.aimStreak} hits in a row dead centre`, 3); tr.aimStreak = 0; }
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
  onChat(id: number, name: string, text = ''): boolean {
    const tr = this.track(id, name);
    const t = this.now();
    // the same message again and again
    const norm = text.trim().toLowerCase();
    if (norm.length > 3) {
      if (norm === tr.lastChat) { tr.sameChats.push(t); while (tr.sameChats.length && t - tr.sameChats[0] > 12000) tr.sameChats.shift(); } else { tr.lastChat = norm; tr.sameChats = [t]; }
      if (tr.sameChats.length >= 5) { this.flag(id, tr, 'spam', 'the same message 5 times', 1); return false; }
    }
    tr.chats.push(t);
    while (tr.chats.length && t - tr.chats[0] > 4000) tr.chats.shift();
    if (tr.chats.length > 7) { this.flag(id, tr, 'spam', `${tr.chats.length} messages in 4 seconds`, 1); return false; }
    return true;
  }
}
