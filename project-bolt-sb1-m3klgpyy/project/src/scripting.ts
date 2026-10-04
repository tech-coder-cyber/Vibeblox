// VibeBlox scripting & mods
// -----------------------------------------------------------------------
// Every script or mod runs inside its own Web Worker: a separate thread
// with no access to the page, the DOM, your saves or the game's memory.
// The only way it can affect the game is the `game` object below, which
// sends messages that the game checks before doing anything. An endless
// loop in a script can't freeze the game, and Stop kills it instantly.
// (No eval() is used anywhere in the game itself.)

export type ScriptHost = {
  /** Run one API call from a script. Throw an Error to send it back to the script. */
  call(method: string, args: unknown[], scriptId: string): unknown;
  /** Show script output in chat. */
  log(text: string, kind: 'log' | 'error'): void;
  /** Command names scripts aren't allowed to take over (/help, /gamemode, ...). */
  reservedCommands: Set<string>;
  /** Live picture of the player and mobs, so Miniblox-style code can read them instantly. */
  snapshot(): unknown;
};

export type ScriptCommand = { owner: string; description: string };

// Runs inside the worker before the user's code
const BOOTSTRAP = `
let __id = 0;
const __pending = new Map();
const __handlers = {};
const __commands = {};
const __post = (m) => postMessage(m);
function __report(e) { __post({ type: 'error', message: String((e && e.message) || e) }); }
function __call(method, ...args) {
  const id = ++__id;
  __post({ type: 'call', id, method, args });
  return new Promise((resolve, reject) => __pending.set(id, { resolve, reject }));
}
function __run(fn, ...args) {
  try { const r = fn(...args); if (r && typeof r.catch === 'function') r.catch(__report); } catch (e) { __report(e); }
}
let __snap = { player: null, entities: [], items: [] };
let __readyResolve;
const __ready = new Promise((r) => { __readyResolve = r; });
const __start = Date.now();
self.onmessage = (ev) => {
  const m = ev.data;
  if (m.type === 'snapshot') {
    const items = m.data && m.data.items && m.data.items.length ? m.data.items : __snap.items;
    __snap = Object.assign({}, m.data, { items });
    if (__readyResolve) { __readyResolve(); __readyResolve = null; }
    return;
  }
  if (m.type === 'result') {
    const p = __pending.get(m.id);
    if (!p) return;
    __pending.delete(m.id);
    if (m.error) p.reject(new Error(m.error)); else p.resolve(m.value);
  } else if (m.type === 'event') {
    for (const fn of __handlers[m.name] || []) __run(fn, m.data);
  } else if (m.type === 'command') {
    const fn = __commands[m.name];
    if (fn) __run(fn, m.args, m.raw);
  }
};

// ---------------- Miniblox-style layer ----------------
// Lets scripts written the Miniblox way run here: synchronous reads come
// from the snapshot, actions are sent to the game without waiting.
const __fire = (method, ...args) => { __call(method, ...args).catch(__report); };
const __soundMap = {
  'random.click': 'click', 'random.bow': 'bow', 'random.pop': 'pop', 'random.orb': 'ding', 'random.levelup': 'ding',
  'random.eat': 'eat', 'random.splash': 'splash', 'random.hurt': 'hurt', 'game.player.hurt': 'hurt', 'mob.endermen.portal': 'teleport',
};
function __sound(name, pitch) {
  const n = String(name);
  if (n === 'random.explode') return (pitch || 1) >= 1.2 ? 'gunshot' : 'explode';
  return __soundMap[n] || (/^[a-zA-Z]+$/.test(n) ? n : 'pop');
}
const __particleColors = { explode: '#e8e8e8', smoke: '#5a5a5a', flame: '#ff8a1a', crit: '#ffffff', heart: '#ff4d6d', portal: '#a050ff', happyVillager: '#5fe05f', angryVillager: '#3a3a3a', note: '#4dd2ff' };
function __mkPlayer() {
  const me = () => __snap.player || { pos: { x: 0, y: 0, z: 0 }, look: { x: 0, y: 0, z: -1 }, counts: {} };
  return {
    isPlayer: true, player: true,
    get id() { return me().id; }, get uuid() { return me().uuid; }, get name() { return me().name; },
    get pos() { return Object.assign({}, me().pos); }, get health() { return me().health; }, get hunger() { return me().hunger; },
    get gamemode() { return me().mode; },
    getLook: () => Object.assign({}, me().look), getVelocity: () => ({ x: 0, y: 0, z: 0 }),
    getHealth: () => me().health, getHunger: () => me().hunger, getGameMode: () => me().mode,
    isOnGround: () => !!me().onGround, isCreative: () => me().mode === 'creative', isSneaking: () => false,
    getHeldItem: () => me().heldItem, getOffhandItem: () => null,
    countItem: (item) => me().counts[item] || 0,
    hasItem: (item, n) => (me().counts[item] || 0) >= (n == null ? 1 : n),
    isHolding: (item) => !!me().heldItem && me().heldItem.item === item,
    removeItem: (item, n) => { const c = me().counts; c[item] = Math.max(0, (c[item] || 0) - (n == null ? 1 : n)); __fire('player.removeItem', item, n == null ? 1 : n); },
    give: (item, n) => { const c = me().counts; c[item] = (c[item] || 0) + (n == null ? 1 : n); __fire('player.give', item, n == null ? 1 : n); },
    teleport: (x, y, z) => __fire('player.teleport', x, y, z),
    damage: (n, cause) => __fire('player.damage', n, cause || 'Magic'),
    heal: (n) => __fire('player.heal', n),
    launch: (x, y, z) => __fire('player.launch', x * 20, y * 20, z * 20), // Miniblox speeds are per tick
    applyRecoil: (pitch) => __fire('player.recoil', pitch || 0),
    applyEffect: (name, ticks, amp) => __fire('player.applyEffect', name, Math.max(0.05, (ticks == null ? 200 : ticks) / 20), Math.max(1, amp || 1)),
    removeEffect: (name) => __fire('player.removeEffect', name),
    setGameMode: (m) => __fire('player.setGameMode', m),
    sendMessage: (t) => __fire('chat', String(t)),
    playSound: (name, vol, pitch) => __fire('sounds.play', __sound(name, pitch)),
  };
}
const __player = __mkPlayer();
const __P = () => (__snap.player ? __player : null);
const __near = (a, x, y, z, r) => Math.hypot(a.x - x, a.y - y, a.z - z) <= r;
const __entity = (e) => ({ id: e.id, type: e.type, kind: e.type, name: e.type, pos: { x: e.x, y: e.y, z: e.z }, health: e.health, maxHealth: e.maxHealth, isPlayer: false });

// stats & playerData: kept in memory, saved to this script's storage
let __stats = {}, __pdata = {}, __saveTimer = null;
const __save = () => {
  if (__saveTimer) return;
  __saveTimer = setTimeout(() => { __saveTimer = null; __fire('storage.set', '__stats', __stats); __fire('storage.set', '__pdata', __pdata); }, 1000);
};
async function __loadCompat() {
  try { __stats = (await __call('storage.get', '__stats')) || {}; } catch (e) { __stats = {}; }
  try { __pdata = (await __call('storage.get', '__pdata')) || {}; } catch (e) { __pdata = {}; }
}

// projectile types from installPack, and ids that can be returned right away
const __projTypes = {};
const __projLocal = {}; // host id -> local id
let __projSeq = 0;
function __spawnNamedProjectile(name, x, y, z, vx, vy, vz) {
  const t = __projTypes[name] || {};
  const local = 'p' + (++__projSeq);
  const c = t.trail && Array.isArray(t.trail.color) ? t.trail.color : null;
  const hex = c ? '#' + c.slice(0, 3).map((v) => Math.max(0, Math.min(255, Math.round(v > 1 ? v : v * 255))).toString(16).padStart(2, '0')).join('') : '#ffe08a';
  __call('world.spawnProjectile', {
    x, y, z, vx: vx * 20, vy: vy * 20, vz: vz * 20, gravity: (t.gravity || 0) * 400, damage: t.damage == null ? 4 : t.damage,
    color: hex, size: Math.max(0.05, (t.renderScale || 0.3) * 0.5), lifetime: 6, explosion: 0,
  }).then((hostId) => { __projLocal[hostId] = { id: local, kind: name }; }).catch(__report);
  return local;
}
let __deferred = [];
const __listen = (name, fn) => {
  (__handlers[name] = __handlers[name] || []).push(fn);
  __post({ type: 'listen', name: String(name) });
};
function __enrich(name, d) {
  const e = Object.assign({ cancel() {}, isCancelled: () => false }, d || {});
  if (!e.player) e.player = __P();
  if (name === 'projectileHit' && d) {
    const tracked = __projLocal[d.id];
    e.pos = { x: d.x, y: d.y, z: d.z };
    e.projectileId = tracked ? tracked.id : d.id;
    e.projectile = { id: e.projectileId, kind: tracked ? tracked.kind : 'projectile', pos: e.pos };
  }
  if (name === 'playerHit' && d && d.target) { e.target = Object.assign({ isPlayer: false }, d.target); }
  if (name === 'playerDamage' && d) e.damage = d.amount;
  return e;
}
const __on = (name, fn) => {
  // Miniblox-style event names map onto VibeBlox events
  if (name === 'playerInteract') {
    __listen('itemUse', (d) => fn(__enrich('', Object.assign({}, d, { item: { item: d.item, count: 1 }, button: 'right' }))));
    __listen('itemAttack', (d) => { if (d.pressed) fn(__enrich('', Object.assign({}, d, { item: { item: d.item, count: 1 }, button: 'left' }))); });
    return;
  }
  if (name === 'entityDamageByEntity') {
    __listen('playerHit', (d) => fn(__enrich('playerHit', Object.assign({}, d, { attacker: __P(), damager: __P(), entity: Object.assign({ isPlayer: false }, d.target) }))));
    return;
  }
  if (name === 'scriptLoad' || name === 'playerJoin') { __deferred.push([name, fn]); return; }
  if (name === 'playerQuit' || name === 'playerLeave') return; // single-player: nobody leaves mid-session
  __listen(name, (d) => fn(__enrich(name, d)));
};
const __command = (name, description, fn) => {
  if (typeof description === 'function') { fn = description; description = ''; }
  const n = String(name).toLowerCase();
  __commands[n] = fn;
  __post({ type: 'command', name: n, description: String(description || '') });
};
const __game = {
  chat: (text, color) => __call('chat', String(text), color),
  on: __on,
  command: __command,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  player: {
    get: () => __call('player.get'),
    teleport: (x, y, z) => __call('player.teleport', x, y, z),
    damage: (amount, cause) => __call('player.damage', amount, cause),
    heal: (amount) => __call('player.heal', amount),
    setHealth: (n) => __call('player.setHealth', n),
    setHunger: (n) => __call('player.setHunger', n),
    launch: (x, y, z) => __call('player.launch', x, y, z),
    give: (item, count) => __call('player.give', item, count == null ? 1 : count),
    removeItem: (item, count) => __call('player.removeItem', item, count == null ? 1 : count),
    countItem: (item) => __call('player.countItem', item),
    hasItem: async (item, count) => (await __call('player.countItem', item)) >= (count == null ? 1 : count),
    getInventory: () => __call('player.getInventory'),
    setInventorySlot: (slot, item, count) => __call('player.setSlot', slot, item, count == null ? 1 : count),
    getHeldItem: async () => (await __call('player.get')).heldItem,
    getArmor: async () => (await __call('player.get')).armor,
    setGameMode: (mode) => __call('player.setGameMode', mode),
    applyEffect: (effect, seconds, level) => __call('player.applyEffect', effect, seconds, level == null ? 1 : level),
    removeEffect: (effect) => __call('player.removeEffect', effect),
    getEffects: () => __call('player.getEffects'),
    recoil: (amount) => __call('player.recoil', amount),
    setZoom: (factor) => __call('player.setZoom', factor),
    setAiming: (on) => __call('player.setAiming', !!on),
    sendMessage: (text, color) => __call('chat', String(text), color),
    playSound: (name) => __call('sounds.play', name),
  },
  players: { all: async () => [await __call('player.get')] },
  world: {
    getBlock: (x, y, z) => __call('world.getBlock', x, y, z),
    setBlock: (x, y, z, block) => __call('world.setBlocks', [[x, y, z, block]]),
    setBlocks: (list) => __call('world.setBlocks', list),
    fill: (x1, y1, z1, x2, y2, z2, block) => __call('world.fill', x1, y1, z1, x2, y2, z2, block),
    explode: (x, y, z, power) => __call('world.explode', x, y, z, power == null ? 3 : power),
    dropItem: (x, y, z, item, count) => __call('world.dropItem', x, y, z, item, count == null ? 1 : count),
    getTime: () => __call('world.getTime'),
    setTime: (t) => __call('world.setTime', t),
    raycast: (origin, direction, maxDistance, options) => __call('world.raycast', origin || null, direction || null, maxDistance == null ? 50 : maxDistance, options || {}),
    spawnProjectile: (spec) => __call('world.spawnProjectile', spec),
    removeProjectile: (id) => __call('world.removeProjectile', id),
    getDimension: () => __call('dimensions.current'),
  },
  entities: {
    list: () => __call('entities.list'),
    near: async (x, y, z, radius) => (await __call('entities.list')).filter((e) => Math.hypot(e.x - x, e.y - y, e.z - z) <= radius),
    get: async (id) => (await __call('entities.list')).find((e) => e.id === id) || null,
    spawn: (type, x, y, z) => __call('entities.spawn', type, x, y, z),
    remove: (id) => __call('entities.remove', id),
    damage: (id, amount, knockback) => __call('entities.damage', id, amount, knockback == null ? 1 : knockback),
    knockback: (id, x, y, z) => __call('entities.knockback', id, x, y, z),
  },
  items: { register: (def) => __call('items.register', def) },
  blocks: { register: (def) => __call('blocks.register', def) },
  recipes: { register: (def) => __call('recipes.register', def) },
  particles: {
    spawn: (x, y, z, opts) => __call('particles.spawn', x, y, z, opts || {}),
    line: (x1, y1, z1, x2, y2, z2, opts) => __call('particles.line', x1, y1, z1, x2, y2, z2, opts || {}),
  },
  sounds: { play: (name, x, y, z) => __call('sounds.play', name, x, y, z) },
  gui: {
    toast: (text) => __call('gui.toast', String(text)),
    title: (text, subtitle) => __call('gui.title', String(text), subtitle == null ? '' : String(subtitle)),
    sidebar: (title, lines) => __call('gui.sidebar', String(title), lines || []),
    clearSidebar: () => __call('gui.clearSidebar'),
  },
  commands: { register: __command },
  storage: {
    get: (key) => __call('storage.get', String(key)),
    set: (key, value) => __call('storage.set', String(key), value),
  },
  scheduler: {
    after: (ms, fn) => setTimeout(() => __run(fn), Math.max(0, ms)),
    every: (ms, fn) => setInterval(() => __run(fn), Math.max(50, ms)),
    cancel: (id) => { clearTimeout(id); clearInterval(id); },
  },
  dimensions: {
    create: (spec) => __call('dimensions.create', spec),
    travel: (id, x, z) => __call('dimensions.travel', id, x, z),
    current: () => __call('dimensions.current'),
    list: () => __call('dimensions.list'),
  },
};
__game.raycast = __game.world.raycast;
// ---- Miniblox-style additions ----
Object.defineProperty(__game, 'tick', { get: () => Math.floor((Date.now() - __start) / 50) }); // 20 ticks per second
const __playersFn = () => (__P() ? [__P()] : []);
__playersFn.all = async () => [await __call('player.get')];
__game.players = __playersFn;
__game.getPlayer = (q) => { const p = __P(); return p && (q == null || q === p.id || q === p.uuid || q === p.name) ? p : null; };
__game.broadcast = (text) => __fire('chat', String(text));
__game.every = (seconds, fn) => setInterval(() => __run(fn), Math.max(50, seconds * 1000));
__game.after = (seconds, fn) => setTimeout(() => __run(fn), Math.max(0, seconds * 1000));
__game.stats = {
  get: (stat, uuid) => (__stats[stat] && __stats[stat][uuid] ? __stats[stat][uuid].value : 0),
  set: (stat, uuid, value, name) => { (__stats[stat] = __stats[stat] || {})[uuid] = { value: Number(value) || 0, name: name || uuid }; __save(); return value; },
  add: (stat, uuid, name, amount) => {
    const t = (__stats[stat] = __stats[stat] || {});
    const cur = t[uuid] ? t[uuid].value : 0;
    t[uuid] = { value: cur + (amount == null ? 1 : Number(amount)), name: name || (t[uuid] && t[uuid].name) || uuid };
    __save();
    return t[uuid].value;
  },
  top: (stat, n) => Object.entries(__stats[stat] || {}).map(([uuid, v]) => ({ uuid, name: v.name, value: v.value })).sort((a, b) => b.value - a.value).slice(0, n || 10),
};
__game.playerData = {
  get: (uuid, key, def) => {
    const v = __pdata[uuid] && __pdata[uuid][key];
    if (v !== undefined) return v;
    if (key === 'playtimeSec' && __snap.player && uuid === __snap.player.uuid) return __snap.player.playtimeSec;
    return def;
  },
  set: (uuid, key, value) => { (__pdata[uuid] = __pdata[uuid] || {})[key] = value; __save(); return value; },
  add: (uuid, key, amount) => { const t = (__pdata[uuid] = __pdata[uuid] || {}); t[key] = (Number(t[key]) || 0) + (amount == null ? 1 : Number(amount)); __save(); return t[key]; },
};
__game.scoreboard = {
  setFor: (playerId, title, lines) => __fire('gui.sidebar', String(title), lines || []),
  set: (title, lines) => __fire('gui.sidebar', String(title), lines || []),
  clear: () => __fire('gui.clearSidebar'),
};
const __nativeSpawn = __game.world.spawnProjectile;
__game.world.spawnProjectile = (a, ...rest) => (typeof a === 'string' ? __spawnNamedProjectile(a, ...rest) : __nativeSpawn(a));
__game.world.spawnParticles = (type, x, y, z, count, spread, speed) =>
  __fire('particles.spawn', x, y, z, { color: __particleColors[type] || '#ffe08a', count: Math.min(60, count || 8), speed: (spread || 0.5) * 2 + (speed || 0) * 10, size: 0.1, life: 0.8 });
__game.world.playSound = (name, x, y, z, vol, pitch) => __fire('sounds.play', __sound(name, pitch), x, y, z);
__game.world.getPlayersNear = (x, y, z, r) => (__snap.player && __near(__snap.player.pos, x, y, z, r) ? [__player] : []);
__game.world.getEntitiesNear = (x, y, z, r) => (__snap.entities || []).filter((e) => Math.hypot(e.x - x, e.y - y, e.z - z) <= r).map(__entity);
__game.world.getEntities = () => (__snap.entities || []).map(__entity);
__game.items.exists = (name) => (__snap.items || []).includes(String(name));
__game.mods = {
  installPack: (pack) => {
    for (const pr of (pack && pack.projectiles) || []) if (pr && pr.name) __projTypes[pr.name] = pr;
    if (pack && typeof pack.script === 'string') {
      try { new Function('game', 'print', 'console', pack.script)(__game, __print, __console); } catch (e) { __report(e); }
    }
  },
};
__game.gui = Object.assign(__game.gui, { open: () => __report(new Error('game.gui.open (custom windows) is not supported in VibeBlox yet')) });
// Older names from the first version of the API still work
__game.getPlayer = __game.player.get;
__game.getBlock = __game.world.getBlock;
__game.setBlock = __game.world.setBlock;
__game.setBlocks = __game.world.setBlocks;
__game.fill = __game.world.fill;
__game.teleport = __game.player.teleport;
__game.give = __game.player.give;
__game.setTime = __game.world.setTime;
__game.summon = (mob) => __call('entities.spawnNear', mob);
const __print = (...a) => __post({ type: 'log', text: a.map(String).join(' ') });
const __console = {
  log: (...a) => __post({ type: 'log', text: a.map(String).join(' ') }),
  warn: (...a) => __post({ type: 'log', text: a.map(String).join(' ') }),
  error: (...a) => __post({ type: 'error', message: a.map(String).join(' ') }),
};
`;

function buildSource(code: string): string {
  return `${BOOTSTRAP}
(async () => {
  await __ready;
  await __loadCompat();
  await (async (game, console, print) => {
${code}
  })(__game, __console, __print);
  for (const [name, fn] of __deferred) __run(fn, name === 'playerJoin' ? { player: __P() } : {});
})().catch(__report);
`;
}

type Running = { worker: Worker; name: string; listens: Set<string>; url: string };

export class ScriptRunner {
  private running = new Map<string, Running>();
  readonly commands = new Map<string, ScriptCommand & { name: string }>();
  private host: ScriptHost;

  constructor(host: ScriptHost) {
    this.host = host;
  }

  /** Start (or restart) a script. `id` identifies it, e.g. "mod:builder" or "script:editor". */
  run(id: string, name: string, code: string): boolean {
    this.stop(id);
    let url = '';
    try {
      url = URL.createObjectURL(new Blob([buildSource(code)], { type: 'text/javascript' }));
      const worker = new Worker(url);
      const r: Running = { worker, name, listens: new Set(), url };
      this.running.set(id, r);
      worker.onmessage = (ev: MessageEvent) => this.onMessage(id, r, ev.data);
      worker.postMessage({ type: 'snapshot', data: this.host.snapshot() }); // scripts start once this arrives
      worker.onerror = (ev: ErrorEvent) => {
        ev.preventDefault();
        this.host.log(`[${name}] ${ev.message || 'Script crashed'}`, 'error');
      };
      return true;
    } catch (e) {
      if (url) URL.revokeObjectURL(url);
      this.host.log(`[${name}] Couldn't start: ${String((e as Error).message || e)}`, 'error');
      return false;
    }
  }

  stop(id: string) {
    const r = this.running.get(id);
    if (!r) return;
    r.worker.terminate();
    URL.revokeObjectURL(r.url);
    this.running.delete(id);
    for (const [name, c] of [...this.commands]) if (c.owner === id) this.commands.delete(name);
  }

  stopAll() {
    for (const id of [...this.running.keys()]) this.stop(id);
  }

  isRunning(id: string): boolean {
    return this.running.has(id);
  }

  /** Send a game event (tick, chat, blockBreak, blockPlace) to every script listening for it. */
  emit(name: string, data?: unknown) {
    for (const r of this.running.values()) {
      if (r.listens.has(name)) r.worker.postMessage({ type: 'event', name, data });
    }
  }

  /** Refresh every script's picture of the game (called 4 times a second). */
  pushSnapshot() {
    if (this.running.size === 0) return;
    const data = this.host.snapshot();
    for (const r of this.running.values()) r.worker.postMessage({ type: 'snapshot', data });
  }

  runningIds(): string[] {
    return [...this.running.keys()];
  }

  hasCommand(name: string): boolean {
    return this.commands.has(name);
  }

  runCommand(name: string, args: string[], raw: string) {
    const c = this.commands.get(name);
    const r = c && this.running.get(c.owner);
    if (r) r.worker.postMessage({ type: 'command', name, args, raw });
  }

  private onMessage(id: string, r: Running, m: { type?: string; [k: string]: unknown }) {
    if (!m || typeof m !== 'object') return;
    switch (m.type) {
      case 'call': {
        let value: unknown;
        let error: string | undefined;
        try {
          value = this.host.call(String(m.method), Array.isArray(m.args) ? m.args : [], id);
        } catch (e) {
          error = String((e as Error).message || e);
        }
        r.worker.postMessage({ type: 'result', id: m.id, value, error });
        break;
      }
      case 'log':
        this.host.log(`[${r.name}] ${String(m.text).slice(0, 300)}`, 'log');
        break;
      case 'error':
        this.host.log(`[${r.name}] Error: ${String(m.message).slice(0, 300)}`, 'error');
        break;
      case 'listen':
        r.listens.add(String(m.name));
        break;
      case 'command': {
        const name = String(m.name);
        if (!/^[a-z0-9_-]{1,24}$/.test(name)) return;
        if (this.host.reservedCommands.has(name)) {
          this.host.log(`[${r.name}] /${name} is a built-in command and can't be replaced`, 'error');
          return;
        }
        this.commands.set(name, { name, owner: id, description: String(m.description || '').slice(0, 120) });
        break;
      }
      default:
    }
  }
}

// ---------------- Mods ----------------
export type Mod = { id: string; name: string; author: string; description: string; code: string; official: boolean };

export const OFFICIAL_MODS: Mod[] = [
  {
    id: 'guns',
    name: 'Guns',
    author: 'VibeBlox',
    official: true,
    description: 'Desert Eagle, AK-47, Sawed-Off and AWP. Left-click shoots, right-click aims (the AWP scopes in).',
    code: `// Guns: Desert Eagle, AK-47, Sawed-Off and AWP.
// Left-click shoots (hold it with the AK-47), right-click aims; the AWP scopes in.
// Bullets are crafted from an iron ingot + coal (smelt the ore in a furnace first).
const PAL = {"K": "#0e1012", "a": "#e6eaef", "A": "#b5bcc5", "z": "#848c97", "Z": "#585f69", "m": "#6d737c", "M": "#454a52", "N": "#26292e", "p": "#55585e", "P": "#33353a", "Q": "#1b1c1f", "w": "#cf8a4c", "W": "#a1612d", "V": "#6e3f1b", "o": "#7c9a52", "O": "#566f38", "U": "#37491f", "y": "#f4d567", "Y": "#c79b2f", "l": "#c8e8ff", "L": "#4e8fec", "I": "#1f4380", "r": "#d9432b"};
const ART = {
  deagle: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '........K.K.................K...',
    '.......KNKNK...............KNK..',
    '.......KNNNKKKKKKKKKKKKKKKKKNK..',
    '......KaaaaaaaaaaaaaaaaaaaaaaKK.',
    '......KAAzAzAzAAANNNNNNAAAAAAmmK',
    '....KKKAAzAzAzAAANMMNNNAAyAAAMNK',
    '...KmMMAAzAzAzAAAAAAAAAAAYAAAMNK',
    '...KMMMAAzAzAzAAAAAAAAAAAAAAANNK',
    '....KKKzzzzzzzzzzzzzzzzzzzzzzKK.',
    '......KzzzzzzzzzzzzzzzzzzzzzzK..',
    '.......KKpPPPPQzzzzzzzzKKKKKK...',
    '........KpPPPPQZZZZZZZZK........',
    '........KMQPQPPQMMMMMMMK........',
    '.........KpQPQPQNKKMKKK.........',
    '..........KQPQPPQKKMK...........',
    '..........KpQPQPQMMMK...........',
    '..........KpQPQPQKKK............',
    '...........KpQPQPQK.............',
    '...........KQPQPPQK.............',
    '...........KpPQPQQK.............',
    '...........KNNNNNNNK............',
    '............KKKKKKK.............',
    '................................',
    '................................',
    '................................'
  ],
  ak47: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '...........................K....',
    '..........................KNK...',
    '..........K.K........KKKKKKNK...',
    '.........KNKNK......KzzzzzzNzK..',
    '.........KNNNKKKKKKKKMMMMMMNMK..',
    '.KKKKKKKKmmmmmmmmmmmmmKKKKKKK.KK',
    'KQwwwwwwwMmmmmmmmmmmYMwwwwwwwKNN',
    'KQWWWWWWWMMMMMMNNNNMMMWWWWWWWzNN',
    'KQWWWWWWWMMMMMMMNNNMMMVVVVVVVMNN',
    'KQWVVVVVWMMMMMMMMMMMMMWWWWWWWKNN',
    'KQWWWWWWWNNNNNNNNNNNNNVVVVVVVKKK',
    'KQWWWWWWWWKKwWWNNmMMNKKKKKKKK...',
    'KQVVVVVVVVKKwWWNKNmMMNK.........',
    '.KKKKKKKKK..KwWNKKNNNNK.........',
    '............KwWNNNNmMMNK........',
    '............KwWWVKKmMMNK........',
    '.............KwWWVKKNNNNK.......',
    '.............KwWWVKKmMMNK.......',
    '.............KwWWVK.KmMMNK......',
    '..............KKKK..KNNNNK......',
    '.....................KmMMNK.....',
    '......................KKKK......',
    '................................',
    '................................'
  ],
  sawed: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '...........KK...................',
    '..........KNNK..................',
    '..........KMMKK................K',
    '.........KmmmmmKKKKKKKKKKKKKKKKN',
    '.........KMMYMMaaaaaaaaaaaaaaaNK',
    '.........KMMyMMzzzzzzzzzzzzzzzQK',
    '.........KMMMMMZZZZZZZZZZZZZZZNK',
    '.........KMMMMMZZZZZZZZZZZZZZZQK',
    '.........KMMMMMwwwwwwwwKKKKKKKK.',
    '........KwWWMMNNNNNVVVVK........',
    '........KwWWWNKKKKNVVVVK........',
    '.......KwWWWVNKNKKNKKKK.........',
    '.......KwWWWVNKKKKNK............',
    '......KwWWWVKNNNNNNK............',
    '......KwWWWVKKKKKKK.............',
    '.....KwWWWVK....................',
    '.....KwWWWVK....................',
    '....KwWWWVK.....................',
    '....KwWWWVK.....................',
    '...KwWWWVK......................',
    '....KKKKK.......................',
    '................................',
    '................................',
    '................................'
  ],
  awp: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.................KK.............',
    '......KKK.....KKKMMK..KKKK......',
    '.....KmmmKKKKKZZKMMKKKmmmmK.....',
    '.....KlMMmmmmmmmmmmmmmMMMMlK....',
    '.....KLMMNNNNNNNNNNNNNMMMMLK....',
    '...KKKMMMQQQQQQQQQQQQQMMMMIK....',
    '..KoooNNNKKZZKKKKKKZZKNNNNK..KKK',
    'KKKUUUUUUKKZZKKKKKKZZKKKKKKKKMMM',
    'QooooooooommmmmmmmmmzzzzzzzzzNMN',
    'QOOOOOOOOOMMMMNNNNMMMMMMMMMMMNMN',
    'QOOOOOOOOOMMMMMMMMMMoooooKKKKNNN',
    'QOOOOUUUOOMMMMMMMMMMOOOOOK...KKK',
    'QOOOOOOOOONNNNNNNNNNOOOOOK......',
    'QOOOOOOOOOoOOUMMMMZAUUNUUK......',
    'QUUUUUUUUUoOOUNNNNKAaKNKK.......',
    'KKKKKKKKKKKoOONZNNKKKNNNK.......',
    '..........KoOONNNNK..KKK........',
    '..........KoOOUKKK..............',
    '...........KoOOUK...............',
    '...........KoOOUK...............',
    '...........KoOOUK...............',
    '............KKKK................',
    '................................',
    '................................',
    '................................',
    '................................'
  ],
};

const GUNS = {
  'guns:deagle': { name: 'Desert Eagle', art: 'deagle', hold: 'one_hand', damage: 9, cooldown: 420, auto: false, pellets: 1,
    spread: 0.012, aimSpread: 0.003, range: 70, recoil: 0.08, zoom: 0.82, knockback: 0.8,
    lore: ['\\\\gray\\\\A hand cannon.', '\\\\white\\\\Damage: \\\\gold\\\\9 \\\\gray\\\\| Semi-auto', '\\\\white\\\\Held in one hand', '\\\\red\\\\Kicks hard'] },
  'guns:ak47': { name: 'AK-47', art: 'ak47', hold: 'two_hands', damage: 5, cooldown: 100, auto: true, pellets: 1,
    spread: 0.035, aimSpread: 0.012, range: 80, recoil: 0.022, zoom: 0.78, knockback: 0.4,
    lore: ['\\\\gray\\\\Classic assault rifle.', '\\\\white\\\\Damage: \\\\gold\\\\5 \\\\gray\\\\| Full-auto, 600 RPM', '\\\\white\\\\Hold left-click to spray'] },
  'guns:sawed_off': { name: 'Sawed-Off', art: 'sawed', hold: 'two_hands', damage: 3, cooldown: 750, auto: false, pellets: 9,
    spread: 0.12, aimSpread: 0.085, range: 18, recoil: 0.13, zoom: 0.9, knockback: 1.6,
    lore: ['\\\\gray\\\\Double barrel, sawn short.', '\\\\white\\\\Damage: \\\\gold\\\\3 x 9 pellets', '\\\\white\\\\Brutal up close, useless far away'] },
  'guns:awp': { name: 'AWP', art: 'awp', hold: 'two_hands', damage: 20, cooldown: 1400, auto: false, pellets: 1,
    spread: 0.07, aimSpread: 0, range: 160, recoil: 0.12, zoom: 0.22, scope: true, knockback: 1.2,
    lore: ['\\\\gray\\\\Bolt-action sniper rifle.', '\\\\white\\\\Damage: \\\\gold\\\\20 \\\\gray\\\\| One shot, most mobs', '\\\\white\\\\Right-click to scope in', '\\\\red\\\\Wild without the scope'] },
};

game.items.register({ id: 'guns:bullet', name: 'Bullets', maxStack: 64,
  lore: ['\\\\gray\\\\Ammo for every gun.', '\\\\white\\\\Iron ingot + coal = 16'],
  icon: { palette: { b: '#c0c0c0', y: '#e3b341', Y: '#a8801f' }, pixels: [
    '', '', '', '...b....b....b..', '..bbb..bbb..bbb.', '..yyy..yyy..yyy.', '..yyy..yyy..yyy.', '..yyy..yyy..yyy.', '..yyy..yyy..yyy.', '..YYY..YYY..YYY.'] } });
for (const [id, g] of Object.entries(GUNS)) {
  game.items.register({ id, name: g.name, maxStack: 1, hold: g.hold, leftClick: 'use', lore: g.lore, icon: { palette: PAL, pixels: ART[g.art] } });
}

game.recipes.register({ id: 'bullets', pattern: ['I', 'C'], key: { I: 'iron_ingot', C: 'coal' }, output: 'guns:bullet', count: 16 });
game.recipes.register({ id: 'deagle', pattern: ['III', 'I  '], key: { I: 'iron_ingot' }, output: 'guns:deagle' });
game.recipes.register({ id: 'ak47', pattern: ['III', 'PIP'], key: { I: 'iron_ingot', P: 'planks' }, output: 'guns:ak47' });
game.recipes.register({ id: 'sawed_off', pattern: ['III', 'P  '], key: { I: 'iron_ingot', P: 'planks' }, output: 'guns:sawed_off' });
game.recipes.register({ id: 'awp', pattern: ['DII', 'III', 'P  '], key: { D: 'diamond', I: 'iron_ingot', P: 'planks' }, output: 'guns:awp' });

const lastShot = {};
let aiming = null; // the gun being aimed, or null
let autoTimer = null;

async function fire(id) {
  const g = GUNS[id];
  const now = Date.now();
  if (now - (lastShot[id] || 0) < g.cooldown - 5) return; // fire-rate limit: one click can never shoot twice
  lastShot[id] = now;
  const p = await game.player.get();
  if (!p.heldItem || p.heldItem.item !== id) { stopAuto(); return; }
  if (p.mode !== 'creative') {
    if ((await game.player.countItem('guns:bullet')) < 1) {
      game.sounds.play('click');
      game.gui.toast('Out of bullets! Craft them from iron ore + coal');
      stopAuto();
      return;
    }
    game.player.removeItem('guns:bullet', 1);
  }
  const steady = aiming === id;
  game.sounds.play('gunshot');
  game.player.recoil(steady ? g.recoil * 0.6 : g.recoil);
  // muzzle flash just in front of the barrel
  const mx = p.eye.x + p.look.x * 1.1, my = p.eye.y + p.look.y * 1.1 - 0.15, mz = p.eye.z + p.look.z * 1.1;
  if (!(g.scope && steady)) game.particles.spawn(mx, my, mz, { color: '#ffd27a', count: 4, speed: 1.2, size: 0.07, life: 0.08 });
  for (let i = 0; i < g.pellets; i++) {
    const sp = steady ? g.aimSpread : g.spread;
    const r = () => (Math.random() - 0.5) * 2 * sp;
    const dir = { x: p.look.x + r(), y: p.look.y + r(), z: p.look.z + r() };
    const hit = await game.world.raycast(p.eye, dir, g.range);
    const len = Math.hypot(dir.x, dir.y, dir.z);
    const end = hit ? hit.point : { x: p.eye.x + (dir.x / len) * g.range, y: p.eye.y + (dir.y / len) * g.range, z: p.eye.z + (dir.z / len) * g.range };
    game.particles.line(mx, my, mz, end.x, end.y, end.z, { color: '#ffe08a' });
    if (hit && hit.type === 'entity') {
      game.entities.damage(hit.entity.id, g.damage, g.knockback);
      game.particles.spawn(end.x, end.y, end.z, { color: '#b01818', count: 6, speed: 2 });
    } else if (hit) {
      game.particles.spawn(end.x, end.y, end.z, { color: '#9a9a9a', count: 4, speed: 1.5 });
    }
  }
}

function stopAuto() {
  if (autoTimer) game.scheduler.cancel(autoTimer);
  autoTimer = null;
}

function stopAiming() {
  if (!aiming) return;
  aiming = null;
  game.player.setAiming(false);
  game.player.setZoom(1);
}

game.on('itemAttack', (e) => {
  const g = GUNS[e.item];
  if (!g) return;
  if (!e.pressed) return stopAuto();
  fire(e.item);
  if (g.auto) { stopAuto(); autoTimer = game.scheduler.every(g.cooldown, () => fire(e.item)); }
});
game.on('itemUse', (e) => {
  const g = GUNS[e.item];
  if (!g) return;
  aiming = e.item;
  game.player.setAiming(true);
  game.player.setZoom(g.zoom); // the AWP's 0.22 also switches on the scope view
});
game.on('itemUseEnd', (e) => { if (GUNS[e.item]) stopAiming(); });
game.on('playerDeath', () => { stopAuto(); stopAiming(); });
`,
  },
  {
    id: 'farmers-delight',
    name: "Farmer's Delight",
    author: 'VibeBlox',
    official: true,
    description: 'Kitchen knives that hit harder, and hearty meals cooked from vanilla wheat, apples and meat.',
    code: `// Farmer's Delight: kitchen knives and hearty meals.
// Farming itself (hoes, farmland, seeds, wheat, bread) is part of the base game now;
// this mod adds what you cook with it.
const bowl = (c) => ({ palette: { b: '#8a5a2b', B: '#5e3a17', c }, pixels: ['', '', '', '', '', '', '..cccccccccccc..', '.BbbbbbbbbbbbbbB.', '..BbbbbbbbbbbbB..', '...BbbbbbbbbbB...', '....BBBBBBBBB....'] });
const knifeIcon = (blade, edge) => ({ palette: { b: blade, e: edge, h: '#5e3a17', H: '#3e2610' }, pixels: [
  '', '............ee..', '...........ebe..', '..........ebb...', '.........ebb....', '........ebb.....', '.......ebb......', '......ebb.......',
  '.....hH.........', '....hH..........', '...hH...........', '..hH............'] });

// ---- Knives: one-handed, quick, extra damage on every hit ----
const knives = {
  stone: { name: 'Stone Knife', bonus: 2, mat: 'stone', blade: '#8a8a8a', edge: '#c8c8c8' },
  iron: { name: 'Iron Knife', bonus: 3, mat: 'iron_ingot', blade: '#c8c8c8', edge: '#ffffff' },
  golden: { name: 'Golden Knife', bonus: 3, mat: 'gold_ingot', blade: '#f2c230', edge: '#fff2a0' },
  diamond: { name: 'Diamond Knife', bonus: 5, mat: 'diamond', blade: '#4fd8e6', edge: '#c8fbff' },
};
for (const [key, k] of Object.entries(knives)) {
  game.items.register({ id: 'farmers:' + key + '_knife', name: k.name, maxStack: 1, hold: 'one_hand', icon: knifeIcon(k.blade, k.edge), lore: ['+' + k.bonus + ' damage on every hit'] });
  game.recipes.register({ id: key + '_knife', pattern: [' M', 'S '], key: { M: k.mat, S: 'stick' }, output: 'farmers:' + key + '_knife' });
}
game.on('playerHit', async (e) => {
  if (!e.target) return;
  const held = await game.player.getHeldItem();
  const key = held && Object.keys(knives).find((k) => held.item === 'farmers:' + k + '_knife');
  if (key) game.entities.damage(e.target.id, knives[key].bonus, 0.3);
});

// ---- Meals: bigger than their ingredients ----
const meals = [
  { id: 'apple_pie', name: 'Apple Pie', food: 9, icon: bowl('#e0a050'), pattern: ['AAA', 'WWW'], key: { A: 'apple', W: 'wheat' } },
  { id: 'burger', name: 'Steak Burger', food: 12, icon: bowl('#8a4a2a'), pattern: ['B', 'S', 'B'], key: { B: 'bread', S: 'steak' } },
  { id: 'chicken_sandwich', name: 'Chicken Sandwich', food: 11, icon: bowl('#e8aa6a'), pattern: ['B', 'C', 'B'], key: { B: 'bread', C: 'cooked_chicken' } },
  { id: 'fruit_salad', name: 'Fruit Salad', food: 7, icon: bowl('#d8322a'), pattern: ['AA', 'AW'], key: { A: 'apple', W: 'wheat' } },
  { id: 'stew', name: "Farmer's Stew", food: 14, icon: bowl('#a0552a'), pattern: ['SPC', ' W '], key: { S: 'steak', P: 'cooked_porkchop', C: 'cooked_chicken', W: 'wheat' } },
];
for (const m of meals) {
  game.items.register({ id: 'farmers:' + m.id, name: m.name, food: m.food, icon: m.icon });
  game.recipes.register({ id: m.id, pattern: m.pattern, key: m.key, output: 'farmers:' + m.id });
}
`,
  },
  {
    id: 'colorful-trails',
    name: 'Colorful Trails',
    author: 'VibeBlox',
    official: true,
    description: 'A rainbow particle trail follows you. /trail particles | concrete | off',
    code: `// Colorful Trails: a rainbow of particles follows you as you move.
// /trail particles | concrete | off
const colors = ['#ff4d4d', '#ffa53a', '#ffe14d', '#5fe05f', '#4dd2ff', '#9b6bff', '#ff6bd6'];
const concrete = ['white_concrete', 'yellow_concrete', 'orange_concrete', 'lime_concrete', 'cyan_concrete', 'purple_concrete'];
let mode = (await game.storage.get('mode')) || 'particles';
let i = 0;
let last = null;

game.commands.register('trail', 'Switch your trail: /trail particles | concrete | off', async (args) => {
  if (!['particles', 'concrete', 'off'].includes(args[0])) return game.chat('Usage: /trail particles | concrete | off', '#ff6b6b');
  mode = args[0];
  await game.storage.set('mode', mode);
  game.gui.toast('Trail: ' + mode);
});

game.on('tick', async () => {
  if (mode === 'off') return;
  const p = await game.player.get();
  if (last && Math.hypot(p.x - last.x, p.z - last.z) < 0.05) return; // only while moving
  last = p;
  if (mode === 'particles') {
    game.particles.spawn(p.x, p.y + 0.2, p.z, { color: colors[i++ % colors.length], count: 4, speed: 0.4, size: 0.12, life: 1.2 });
  } else {
    const x = Math.floor(p.x), y = Math.floor(p.y) - 1, z = Math.floor(p.z);
    const below = await game.world.getBlock(x, y, z);
    if (['air', 'water', 'lava', 'bedrock'].includes(below)) return;
    game.world.setBlock(x, y, z, concrete[i++ % concrete.length]);
  }
});
`,
  },
  {
    id: 'magic-wands',
    name: 'Magic Wands',
    author: 'VibeBlox',
    official: true,
    description: 'Four wands: hurl fireballs, call lightning, heal yourself, or teleport where you look. Right-click to cast.',
    code: `// Magic Wands: right-click to cast. Crafted in a table on a diagonal: gem, stick, stick.
const grid = () => Array.from({ length: 16 }, () => Array(16).fill('.'));
const wandIcon = (tip, glow) => {
  const g = grid();
  for (let i = 0; i < 11; i++) { g[14 - i][1 + i] = 's'; g[15 - i][1 + i] = 'S'; }
  for (let y = 1; y <= 4; y++) for (let x = 10; x <= 13; x++) g[y][x] = (x === 10 || x === 13 || y === 1 || y === 4) ? 'G' : 'g';
  g[2][11] = 'w';
  return { palette: { s: '#a8793e', S: '#6b4a1e', g: tip, G: glow, w: '#ffffff' }, pixels: g.map((r) => r.join('')) };
};
const last = {};
const ready = (k, ms) => { const n = Date.now(); if (last[k] && n - last[k] < ms) return false; last[k] = n; return true; };

const WANDS = {
  fire: { name: 'Fire Wand', tip: '#ff6a1a', glow: '#ffd23a', cd: 900, gem: 'infernium_ingot', lore: 'Right-click: hurl a fireball',
    cast: async (p) => {
      const d = p.look;
      game.world.spawnProjectile({ x: p.eye.x + d.x, y: p.eye.y + d.y - 0.1, z: p.eye.z + d.z, vx: d.x * 24, vy: d.y * 24, vz: d.z * 24,
        gravity: 0, damage: 7, color: '#ff6a1a', size: 0.3, lifetime: 3, explosion: 1, knockback: 3 });
      game.sounds.play('throw');
    } },
  lightning: { name: 'Lightning Wand', tip: '#bfe6ff', glow: '#4e8fec', cd: 2000, gem: 'diamond', lore: 'Right-click: strike where you look',
    cast: async (p) => {
      const hit = await game.world.raycast(p.eye, p.look, 60, { entities: true, blocks: true });
      if (!hit) { game.gui.toast('Nothing to strike'); return false; }
      const t = hit.point;
      game.particles.line(t.x, t.y + 14, t.z, t.x, t.y, t.z, { color: '#e8f4ff' });
      game.particles.line(p.eye.x, p.eye.y - 0.3, p.eye.z, t.x, t.y, t.z, { color: '#bfe6ff' });
      game.particles.spawn(t.x, t.y, t.z, { color: '#ffffff', count: 24, speed: 4, size: 0.2, life: 0.5 });
      if (hit.distance > 4) game.world.explode(t.x, t.y, t.z, 1);
      if (hit.type === 'entity' && hit.entity) game.entities.damage(hit.entity.id, 9, 1);
      game.sounds.play('explode');
    } },
  heal: { name: 'Healing Staff', tip: '#ff6b9a', glow: '#ffd0e0', cd: 8000, gem: 'ghast_tear', lore: 'Right-click: heal yourself',
    cast: async (p) => {
      game.player.heal(8);
      game.player.applyEffect('regeneration', 6, 1);
      game.world.spawnParticles('heart', p.x, p.y + 1.6, p.z, 6, 0.6, 0.1);
      game.sounds.play('ding');
    } },
  teleport: { name: 'Teleport Wand', tip: '#b070ff', glow: '#5a1a9a', cd: 3000, gem: 'ender_pearl', lore: 'Right-click: blink to where you look',
    cast: async (p) => {
      const hit = await game.world.raycast(p.eye, p.look, 40, { entities: false, blocks: true });
      if (!hit) { game.gui.toast('Nothing in range to teleport to'); return false; }
      const t = hit.point, d = p.look;
      game.world.spawnParticles('portal', p.x, p.y + 1, p.z, 20, 0.6, 0.5);
      if (d.y < -0.3) game.player.teleport(t.x, t.y + 0.1, t.z); // you looked at the ground: land on it
      else game.player.teleport(t.x - d.x * 1.2, t.y - 1.6, t.z - d.z * 1.2); // you looked at a wall: stop just in front
      game.sounds.play('teleport');
    } },
};
for (const [key, w] of Object.entries(WANDS)) {
  game.items.register({ id: 'wands:' + key, name: w.name, maxStack: 1, hold: 'one_hand', lore: [w.lore], icon: wandIcon(w.tip, w.glow) });
  game.recipes.register({ id: key + '_wand', pattern: ['  G', ' S ', 'S  '], key: { G: w.gem, S: 'stick' }, output: 'wands:' + key });
}
game.on('itemUse', async (e) => {
  const key = Object.keys(WANDS).find((k) => e.item === 'wands:' + k);
  if (!key || !ready(key, WANDS[key].cd)) return;
  const p = await game.player.get();
  if ((await WANDS[key].cast(p)) === false) delete last[key]; // nothing happened, so no cooldown
});
`,
  },
  {
    id: 'gadgets',
    name: 'Gadgets',
    author: 'VibeBlox',
    official: true,
    description: 'Grappling hook, jet feather and wind charge for getting around fast. Right-click to use.',
    code: `// Gadgets: right-click to use.
const grid = () => Array.from({ length: 16 }, () => Array(16).fill('.'));
const rect = (g, x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (g[y + j] && x + i < 16) g[y + j][x + i] = c; };
const out = (palette, g) => ({ palette, pixels: g.map((r) => r.join('')) });
const hookIcon = () => {
  const g = grid();
  rect(g, 3, 1, 5, 1, 'h'); rect(g, 2, 2, 1, 4, 'h'); rect(g, 8, 2, 1, 4, 'h'); rect(g, 3, 6, 5, 1, 'h'); rect(g, 8, 1, 1, 1, 'H');
  for (let i = 0; i < 8; i++) { g[7 + i][5 + i] = 'r'; if (g[7 + i][6 + i] === '.') g[7 + i][6 + i] = 'R'; }
  return out({ h: '#d0d0d0', H: '#8a8a8a', r: '#c9a24a', R: '#7a5a2a' }, g);
};
const featherIcon = () => {
  const g = grid();
  for (let i = 0; i < 10; i++) { const x = 3 + i, y = 12 - i; g[y][x] = 'f'; if (y > 0) g[y - 1][x] = 'f'; if (x + 1 < 16) g[y][x + 1] = 'F'; if (y + 1 < 16) g[y + 1][x] = 'F'; }
  rect(g, 1, 13, 2, 2, 's'); g[14][1] = 'S';
  return out({ f: '#f4f4f4', F: '#b8c0c8', s: '#9a8a6a', S: '#5a4a3a' }, g);
};
const windIcon = () => {
  const g = grid();
  for (let a = 0; a < 6.3; a += 0.15) { const r = 2 + a * 0.75; const x = Math.round(8 + Math.cos(a) * r), y = Math.round(8 + Math.sin(a) * r); if (g[y] && x >= 0 && x < 16) g[y][x] = a > 3.5 ? 'w' : 'W'; }
  return out({ w: '#e6f6ff', W: '#8fd0f0' }, g);
};
const last = {};
const ready = (k, ms) => { const n = Date.now(); if (last[k] && n - last[k] < ms) return false; last[k] = n; return true; };

const GADGETS = {
  grapple: { name: 'Grappling Hook', cd: 1200, icon: hookIcon, lore: 'Right-click a block: swing toward it',
    recipe: { pattern: ['II', 'S ', 'T '], key: { I: 'iron_ingot', S: 'stick', T: 'string' } },
    use: async (p) => {
      const hit = await game.world.raycast(p.eye, p.look, 50, { entities: false, blocks: true });
      if (!hit) { game.gui.toast('Nothing to grab'); return false; }
      const t = hit.point, dx = t.x - p.eye.x, dy = t.y - p.eye.y, dz = t.z - p.eye.z, dist = Math.hypot(dx, dy, dz) || 1;
      const speed = Math.min(30, 8 + dist * 0.7);
      game.particles.line(p.eye.x, p.eye.y - 0.4, p.eye.z, t.x, t.y, t.z, { color: '#c9a24a' });
      game.player.launch((dx / dist) * speed, (dy / dist) * speed + 4, (dz / dist) * speed);
      game.player.applyEffect('slow_falling', 3, 1); // a soft landing
      game.sounds.play('throw');
    } },
  jet: { name: 'Jet Feather', cd: 6000, icon: featherIcon, lore: 'Right-click: leap high and float down',
    recipe: { pattern: ['FFF', ' G '], key: { F: 'feather', G: 'gunpowder' } },
    use: async (p) => {
      game.player.launch(0, 17, 0);
      game.player.applyEffect('slow_falling', 8, 1);
      game.world.spawnParticles('smoke', p.x, p.y, p.z, 14, 0.4, 0.2);
      game.sounds.play('pop');
    } },
  wind: { name: 'Wind Charge', cd: 2000, icon: windIcon, lore: 'Right-click: dash forward',
    recipe: { pattern: ['FG', 'GF'], key: { F: 'feather', G: 'gunpowder' } },
    use: async (p) => {
      const d = p.look, h = Math.hypot(d.x, d.z) || 1;
      game.player.launch((d.x / h) * 24, 5, (d.z / h) * 24);
      game.world.spawnParticles('smoke', p.x, p.y + 1, p.z, 12, 0.5, 0.2);
      game.sounds.play('throw');
    } },
};
for (const [key, g] of Object.entries(GADGETS)) {
  game.items.register({ id: 'gadgets:' + key, name: g.name, maxStack: 1, hold: 'one_hand', lore: [g.lore], icon: g.icon() });
  game.recipes.register({ id: key, pattern: g.recipe.pattern, key: g.recipe.key, output: 'gadgets:' + key });
}
game.on('itemUse', async (e) => {
  const key = Object.keys(GADGETS).find((k) => e.item === 'gadgets:' + k);
  if (!key || !ready(key, GADGETS[key].cd)) return;
  const p = await game.player.get();
  if ((await GADGETS[key].use(p)) === false) delete last[key];
});
`,
  },
  {
    id: 'excavators',
    name: 'Excavators',
    author: 'VibeBlox',
    official: true,
    description: 'Power tools you right-click on a block: a 3x3 hammer, a drill that mines a whole ore vein (burns coal), and an axe that fells a whole tree.',
    code: `// Excavators: right-click a block. (Custom items cannot mine by themselves, so these work as abilities.)
const grid = () => Array.from({ length: 16 }, () => Array(16).fill('.'));
const rect = (g, x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (g[y + j] && x + i < 16) g[y + j][x + i] = c; };
const out = (palette, g) => ({ palette, pixels: g.map((r) => r.join('')) });
const hammerIcon = () => { const g = grid(); rect(g, 2, 1, 11, 5, 'h'); rect(g, 2, 1, 11, 1, 'H'); rect(g, 2, 5, 11, 1, 'd'); rect(g, 7, 6, 2, 9, 's'); rect(g, 8, 6, 1, 9, 'S'); return out({ h: '#9a9a9a', H: '#d0d0d0', d: '#5a5a5a', s: '#a8793e', S: '#6b4a1e' }, g); };
const drillIcon = () => { const g = grid(); rect(g, 5, 8, 6, 6, 'b'); rect(g, 5, 8, 6, 1, 'B'); rect(g, 5, 13, 6, 1, 'd'); rect(g, 7, 14, 2, 1, 's');
  for (let r = 0; r < 7; r++) { rect(g, 8 - Math.ceil((7 - r) / 2), r + 1, Math.max(1, (7 - r)), 1, r % 2 ? 'm' : 'M'); } return out({ b: '#c0392b', B: '#e8604f', d: '#7a2018', m: '#c8c8c8', M: '#8a8a8a', s: '#3a3a3a' }, g); };
const axeIcon = () => { const g = grid(); rect(g, 7, 3, 2, 12, 's'); rect(g, 8, 3, 1, 12, 'S'); rect(g, 2, 1, 6, 6, 'a'); rect(g, 2, 1, 6, 1, 'A'); rect(g, 2, 6, 6, 1, 'd'); rect(g, 2, 2, 1, 4, 'A'); return out({ a: '#9a9a9a', A: '#d8d8d8', d: '#5a5a5a', s: '#a8793e', S: '#6b4a1e' }, g); };

const SOFT = new Set(['stone', 'dirt', 'grass', 'sand', 'gravel', 'netherrack', 'soul_sand', 'snow']);
const VEIN = new Set(['coal_ore', 'iron_ore', 'gold_ore', 'nether_quartz_ore']); // diamonds and emeralds still need a real pickaxe
const DROP = { grass: 'dirt', coal_ore: 'coal', nether_quartz_ore: 'quartz' };
const dropOf = (b) => DROP[b] || b;
const last = {};
const ready = (k, ms) => { const n = Date.now(); if (last[k] && n - last[k] < ms) return false; last[k] = n; return true; };

// Breaks every listed [x, y, z, name] at once and drops the items in stacks
function clear(list, drops) {
  if (!list.length) return;
  game.world.setBlocks(list.map((b) => [b[0], b[1], b[2], 'air']));
  const totals = {};
  for (const b of list) { const item = drops(b[3]); if (item) totals[item] = (totals[item] || 0) + 1; }
  const c = list[0];
  for (const [item, n] of Object.entries(totals)) game.world.dropItem(c[0] + 0.5, c[1] + 0.5, c[2] + 0.5, item, n);
}
// Every block of the same kind touching the start (including diagonals), up to max
async function flood(x, y, z, match, max) {
  const seen = new Set([x + ',' + y + ',' + z]), queue = [[x, y, z]], found = [];
  while (queue.length && found.length < max) {
    const [cx, cy, cz] = queue.shift();
    const name = await game.world.getBlock(cx, cy, cz);
    if (!match(name)) continue;
    found.push([cx, cy, cz, name]);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const k = (cx + dx) + ',' + (cy + dy) + ',' + (cz + dz);
      if (!seen.has(k)) { seen.add(k); queue.push([cx + dx, cy + dy, cz + dz]); }
    }
  }
  return found;
}

const TOOLS = {
  hammer: { name: 'Excavator Hammer', cd: 400, icon: hammerIcon, lore: 'Right-click: break a 3x3 patch of soft blocks',
    recipe: { pattern: ['III', 'ISI', ' S '], key: { I: 'iron_ingot', S: 'stick' } },
    use: async (e, p) => {
      const ax = Math.abs(p.look.x), ay = Math.abs(p.look.y), az = Math.abs(p.look.z);
      const plane = ay > ax && ay > az ? 'xz' : ax > az ? 'yz' : 'xy'; // the flat 3x3 that faces you
      const list = [];
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const [dx, dy, dz] = plane === 'xz' ? [a, 0, b] : plane === 'yz' ? [0, a, b] : [a, b, 0];
        const name = await game.world.getBlock(e.x + dx, e.y + dy, e.z + dz);
        if (SOFT.has(name)) list.push([e.x + dx, e.y + dy, e.z + dz, name]);
      }
      if (!list.length) { game.gui.toast('Only soft blocks: stone, dirt, sand...'); return false; }
      clear(list, dropOf);
      game.sounds.play('pop');
    } },
  drill: { name: 'Vein Drill', cd: 800, icon: drillIcon, lore: 'Right-click an ore: mine the whole vein (uses 1 coal)',
    recipe: { pattern: ['IDI', 'ISI', ' S '], key: { I: 'iron_ingot', D: 'diamond', S: 'stick' } },
    use: async (e) => {
      if (!VEIN.has(e.block)) { game.gui.toast('Aim at coal, iron, gold or quartz ore'); return false; }
      if (!(await game.player.hasItem('coal', 1))) { game.gui.toast('The drill needs 1 coal as fuel'); return false; }
      const list = await flood(e.x, e.y, e.z, (n) => n === e.block, 32);
      game.player.removeItem('coal', 1);
      clear(list, dropOf);
      game.gui.toast('Drilled ' + list.length + ' ore');
      game.sounds.play('explode');
    } },
  axe: { name: 'Timber Axe', cd: 800, icon: axeIcon, lore: 'Right-click a log: fell the whole tree',
    recipe: { pattern: ['II', 'IS', ' S'], key: { I: 'iron_ingot', S: 'stick' } },
    use: async (e) => {
      if (e.block !== 'wood') { game.gui.toast('Aim at a tree trunk'); return false; }
      const logs = await flood(e.x, e.y, e.z, (n) => n === 'wood', 80);
      const leaves = [], seen = new Set();
      for (const l of logs) for (let dx = -2; dx <= 2; dx++) for (let dy = -1; dy <= 3; dy++) for (let dz = -2; dz <= 2; dz++) {
        const k = (l[0] + dx) + ',' + (l[1] + dy) + ',' + (l[2] + dz);
        if (seen.has(k)) continue; seen.add(k);
        if ((await game.world.getBlock(l[0] + dx, l[1] + dy, l[2] + dz)) === 'leaves') leaves.push([l[0] + dx, l[1] + dy, l[2] + dz, 'leaves']);
      }
      clear(logs.concat(leaves), (n) => (n === 'wood' ? 'wood' : null));
      game.gui.toast('Felled ' + logs.length + ' logs');
      game.sounds.play('pop');
    } },
};
for (const [key, t] of Object.entries(TOOLS)) {
  game.items.register({ id: 'excavators:' + key, name: t.name, maxStack: 1, hold: 'item', lore: [t.lore], icon: t.icon() });
  game.recipes.register({ id: key, pattern: t.recipe.pattern, key: t.recipe.key, output: 'excavators:' + key });
}
game.on('itemUse', async (e) => {
  const key = Object.keys(TOOLS).find((k) => e.item === 'excavators:' + k);
  if (!key || e.x === null || e.x === undefined) return; // aiming at the air
  if (!ready(key, TOOLS[key].cd)) return;
  const p = await game.player.get();
  if ((await TOOLS[key].use(e, p)) === false) delete last[key];
});
`,
  },

];

export const SCRIPT_EXAMPLES: Array<{ name: string; code: string }> = [
  {
    name: 'Hello world',
    code: `// Scripts talk to the game through "game". Try changing the message!
const p = await game.player.get();
game.chat('Hello ' + p.name + '! You are at ' + Math.floor(p.x) + ', ' + Math.floor(p.y) + ', ' + Math.floor(p.z));
`,
  },
  {
    name: 'Starter kit command',
    code: `// /kit gives a starter kit, once every 5 minutes.
game.commands.register('kit', 'Get a starter kit (every 5 minutes)', async () => {
  const last = (await game.storage.get('lastKit')) || 0;
  const wait = 5 * 60 * 1000 - (Date.now() - last);
  if (wait > 0) return game.chat('You can use /kit again in ' + Math.ceil(wait / 1000) + 's', '#ff6b6b');
  await game.player.give('stone_pickaxe', 1);
  await game.player.give('stone_sword', 1);
  await game.player.give('raw_beef', 8);
  await game.player.give('planks', 32);
  await game.storage.set('lastKit', Date.now());
  game.gui.title('Kit received!', 'Good luck out there');
  game.sounds.play('ding');
});
game.chat('Type /kit for a starter kit');
`,
  },
  {
    name: 'Custom dimension',
    code: `// A custom dimension of floating sky islands. /islands takes you there,
// /overworld brings you back.
await game.dimensions.create({
  id: 'sky_islands', name: 'Sky Islands', type: 'islands',
  top: 'grass', filler: 'dirt', base: 'stone',
  sky: '#8fd3ff', fog: '#d6f0ff', light: 1,
});
game.commands.register('islands', 'Travel to the Sky Islands', async () => {
  await game.dimensions.travel('sky_islands');
  game.gui.title('Sky Islands', "Don't look down");
  game.player.applyEffect('slow_falling', 60);
});
game.commands.register('overworld', 'Go back to the Overworld', () => game.dimensions.travel('overworld'));
game.chat('Type /islands to visit the Sky Islands!');
`,
  },
  {
    name: 'Builder Tools',
    code: `// Adds /fill, /sphere and /platform for fast building.
function rel(v, base) {
  return String(v).startsWith('~') ? base + (v.length > 1 ? Number(v.slice(1)) : 0) : Number(v);
}
game.commands.register('fill', 'Fill a box: /fill x1 y1 z1 x2 y2 z2 block (~ = where you are)', async (args) => {
  if (args.length < 7) return game.chat('Usage: /fill x1 y1 z1 x2 y2 z2 block', '#ff6b6b');
  const p = await game.player.get();
  const base = [p.x, p.y, p.z];
  const c = args.slice(0, 6).map((v, i) => Math.floor(rel(v, base[i % 3])));
  game.chat('Filled ' + (await game.world.fill(c[0], c[1], c[2], c[3], c[4], c[5], args[6])) + ' blocks', '#aaaaaa');
});
game.commands.register('sphere', 'Build a sphere in front of you: /sphere radius block [hollow]', async (args) => {
  const r = Math.min(12, Math.max(1, Number(args[0]) || 3));
  const block = args[1] || 'stone';
  const p = await game.player.get();
  const cx = Math.floor(p.x + p.look.x * (r + 2)), cz = Math.floor(p.z + p.look.z * (r + 2)), cy = Math.floor(p.y) + r;
  const list = [];
  for (let x = -r; x <= r; x++) for (let y = -r; y <= r; y++) for (let z = -r; z <= r; z++) {
    const d = Math.hypot(x, y, z);
    if (d <= r + 0.5 && (args[2] !== 'hollow' || d > r - 0.5)) list.push([cx + x, cy + y, cz + z, block]);
  }
  game.chat('Placed ' + (await game.world.setBlocks(list)) + ' blocks', '#aaaaaa');
});
game.commands.register('platform', 'A square platform under your feet: /platform size block', async (args) => {
  const s = Math.min(31, Math.max(1, Number(args[0]) || 5)), h = Math.floor(s / 2);
  const p = await game.player.get();
  const y = Math.floor(p.y) - 1;
  await game.world.fill(Math.floor(p.x) - h, y, Math.floor(p.z) - h, Math.floor(p.x) + h, y, Math.floor(p.z) + h, args[1] || 'white_concrete');
  game.chat('Built a ' + s + 'x' + s + ' platform', '#aaaaaa');
});
game.chat('Builder Tools loaded: /fill, /sphere, /platform');
`,
  },
  {
    name: 'Homes',
    code: `// /sethome saves your spot, /home takes you back (remembered between sessions).
game.commands.register('sethome', 'Save where you are as your home', async () => {
  const p = await game.player.get();
  await game.storage.set('home', { x: p.x, y: p.y, z: p.z, dimension: p.dimension });
  game.gui.toast('Home set!');
});
game.commands.register('home', 'Teleport to your home', async () => {
  const home = await game.storage.get('home');
  if (!home) return game.chat('No home yet. Use /sethome first.', '#ff6b6b');
  const p = await game.player.get();
  if (home.dimension && home.dimension !== p.dimension) await game.dimensions.travel(home.dimension);
  await game.player.teleport(home.x, home.y, home.z);
  game.gui.toast('Welcome home!');
});
`,
  },
  {
    name: 'Zombie wave',
    code: `// /wave spawns zombies around you and keeps score on a sidebar.
let kills = 0;
game.commands.register('wave', 'Start a zombie wave: /wave [size]', async (args) => {
  const n = Math.min(12, Math.max(1, Number(args[0]) || 5));
  const p = await game.player.get();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    await game.entities.spawn('zombie', p.x + Math.cos(a) * 10, p.y + 1, p.z + Math.sin(a) * 10);
  }
  game.gui.title('Wave incoming!', n + ' zombies');
  game.gui.sidebar('Zombie Wave', ['Kills: ' + kills]);
});
game.on('entityDeath', (e) => {
  if (e.type !== 'zombie') return;
  kills++;
  game.gui.sidebar('Zombie Wave', ['Kills: ' + kills]);
});
game.chat('Type /wave to start');
`,
  },
];

// ===================================================================
//  The VibeBlox scripting API, documented once
// ===================================================================
// This table is the single source of truth. The in-game "API" panel, the
// AI assistant's prompt and the "does this function exist?" checker are all
// built from it, and a test compares it against the real sandbox, so the
// docs can't drift away from what actually works.
export const AI_PROMPT_VERSION = 5;

type ApiDoc = [path: string, signature: string, description: string];
export const API_DOCS: ApiDoc[] = [
  // ---- top level ----
  ['chat', '(text, color?)', 'Show a chat message. color is "#rrggbb", or put codes like \\red\\ \\gold\\ \\bold\\ in the text.'],
  ['on', '(event, fn)', 'Run fn when something happens. Events are listed below.'],
  ['command', '(name, description, fn(args))', 'Add a /name chat command (same as commands.register).'],
  ['sleep', '(ms)', 'await game.sleep(1000) pauses the script for a second.'],
  ['tick', '', 'A number (not a function): game ticks since the script started, 20 per second.'],
  ['players', '()', 'Synchronous: array holding the one player object (Miniblox style).'],
  ['players.all', '()', 'Async: [the same data as player.get()].'],
  ['getPlayer', '(nameOrId?)', 'Synchronous: the player object, or null (Miniblox style).'],
  ['broadcast', '(text)', 'Chat message to everyone (Miniblox style).'],
  ['every', '(seconds, fn)', 'Repeat fn every N seconds (Miniblox style).'],
  ['after', '(seconds, fn)', 'Run fn once after N seconds (Miniblox style).'],
  ['raycast', '(origin?, direction?, maxDistance?, options?)', 'Same as world.raycast.'],
  ['getBlock', '(x, y, z)', 'Older name for world.getBlock.'],
  ['setBlock', '(x, y, z, block)', 'Older name for world.setBlock.'],
  ['setBlocks', '(list)', 'Older name for world.setBlocks.'],
  ['fill', '(x1, y1, z1, x2, y2, z2, block)', 'Older name for world.fill.'],
  ['teleport', '(x, y, z)', 'Older name for player.teleport.'],
  ['give', '(item, count?)', 'Older name for player.give.'],
  ['setTime', '(time)', 'Older name for world.setTime.'],
  ['summon', '(mobType)', 'Spawn a mob in front of the player (types are listed under entities.spawn).'],

  // ---- the player ----
  ['player.get', '()', 'Returns { name, x, y, z, eye:{x,y,z}, look:{x,y,z} (unit vector), yaw, pitch, health, maxHealth, hunger, mode, dimension, onGround, heldItem:{item,count}|null, offhandItem, armor:[helmet,chest,legs,boots as names or null], effects:[{name,level,seconds}] }.'],
  ['player.teleport', '(x, y, z)', 'Move the player.'],
  ['player.damage', '(amount, cause?)', 'Hurt the player (armor reduces it).'],
  ['player.heal', '(amount)', 'Restore health.'],
  ['player.setHealth', '(n)', 'Set health, 1-20.'],
  ['player.setHunger', '(n)', 'Set hunger, 0-20.'],
  ['player.launch', '(vx, vy, vz)', 'Fling the player (blocks per second, e.g. 0, 18, 0 jumps high).'],
  ['player.give', '(item, count?)', 'Add items to the inventory. Returns how many fit.'],
  ['player.removeItem', '(item, count?)', 'Take items away. Returns how many were removed.'],
  ['player.countItem', '(item)', 'How many of an item the player carries.'],
  ['player.hasItem', '(item, count?)', 'true if the player has at least that many.'],
  ['player.getInventory', '()', '[{ slot, item, count }] for non-empty slots (0-8 is the hotbar, 9-35 the main inventory).'],
  ['player.setInventorySlot', '(slot, item|null, count?)', 'Put an item in slot 0-35 (null empties it).'],
  ['player.getHeldItem', '()', '{ item, count } or null.'],
  ['player.getArmor', '()', '[helmet, chestplate, leggings, boots] as item names or null.'],
  ['player.setGameMode', '(mode)', '"survival" | "creative" | "adventure" | "spectator".'],
  ['player.applyEffect', '(effect, seconds, level?)', 'Effects: speed, slowness, jump_boost, regeneration, resistance, slow_falling, night_vision.'],
  ['player.removeEffect', '(effect)', 'Remove an effect early.'],
  ['player.getEffects', '()', '[{ name, level, seconds }].'],
  ['player.recoil', '(radians)', 'Kick the camera up, e.g. 0.05.'],
  ['player.setZoom', '(factor)', '1 = normal, 0.25 = 4x zoom. Below 0.5 shows a scope view and hides the gun.'],
  ['player.setAiming', '(on)', 'Aim down sights: the held gun moves to the middle of the screen.'],
  ['player.sendMessage', '(text, color?)', 'Chat message to the player.'],
  ['player.playSound', '(name)', 'Play a sound (names under sounds.play).'],

  // ---- the world ----
  ['world.getBlock', '(x, y, z)', 'Block name at a position, e.g. "stone" ("air" when empty, "water", "lava").'],
  ['world.setBlock', '(x, y, z, block)', 'Place one block ("air" removes it).'],
  ['world.setBlocks', '([[x, y, z, block], ...])', 'Place many at once (max 32768). Returns how many were placed (only inside loaded chunks).'],
  ['world.fill', '(x1, y1, z1, x2, y2, z2, block)', 'Fill a box (max 32768 blocks).'],
  ['world.explode', '(x, y, z, power?)', 'Explosion that breaks blocks and hurts things. power 0.5-6.'],
  ['world.dropItem', '(x, y, z, item, count?)', 'Drop an item stack on the ground.'],
  ['world.getTime', '()', '0-24000 (0 sunrise, 6000 noon, 12000 sunset, 18000 midnight).'],
  ['world.setTime', '(time)', '"day" | "noon" | "sunset" | "night" | "midnight" | 0-24000.'],
  ['world.raycast', '(origin?, direction?, maxDistance?, { entities, blocks }?)', 'Defaults to your eye and look direction. Returns null or { type:"block"|"entity", point:{x,y,z}, distance, block:{x,y,z,name}|null, entity:{id,type}|null }.'],
  ['world.spawnProjectile', '(spec) or (name, x, y, z, vx, vy, vz)', 'spec = { x, y, z, vx, vy, vz, gravity, damage, color, size, lifetime, explosion, knockback }. Returns an id and later fires the projectileHit event.'],
  ['world.removeProjectile', '(id)', 'Delete a projectile.'],
  ['world.getDimension', '()', 'Name of the current dimension.'],
  ['world.spawnParticles', '(type, x, y, z, count, spread, speed)', 'Miniblox style. type: explode, smoke, flame, crit, heart, portal, happyVillager, angryVillager, note.'],
  ['world.playSound', '(name, x, y, z, volume?, pitch?)', 'Miniblox style names (random.click, random.explode, ...) or VibeBlox names.'],
  ['world.getPlayersNear', '(x, y, z, radius)', 'Synchronous: player objects within the radius.'],
  ['world.getEntitiesNear', '(x, y, z, radius)', 'Synchronous: mobs within the radius, as { id, type, pos, health, maxHealth }.'],
  ['world.getEntities', '()', 'Synchronous: every mob.'],

  // ---- mobs ----
  ['entities.list', '()', '[{ id, type, x, y, z, health, maxHealth }] for every mob.'],
  ['entities.near', '(x, y, z, radius)', 'Mobs within the radius.'],
  ['entities.get', '(id)', 'One mob, or null.'],
  ['entities.spawn', '(type, x, y, z)', 'Types: pig, cow, chicken, zombie, skeleton, creeper, spider, ghast, piglin, villager, iron_golem. Returns its id (max 80 mobs).'],
  ['entities.remove', '(id)', 'Remove a mob.'],
  ['entities.damage', '(id, amount, knockback?)', 'Hurt a mob.'],
  ['entities.knockback', '(id, vx, vy, vz)', 'Fling a mob.'],

  // ---- new items, blocks and recipes ----
  ['items.register', '({ id, name, maxStack, food, lore, hold, leftClick, icon })', 'id is "mymod:thing". hold: "item" | "one_hand" | "two_hands". leftClick: "use" makes left-click fire the itemAttack event instead of mining. icon = { pixels: [16 or 32 rows of characters], palette: { char: "#hex" } } where "." is see-through. lore is a list of lines (color codes work). food = hunger points restored on right-click.'],
  ['items.exists', '(name)', 'Synchronous: true if the item name is known.'],
  ['blocks.register', '({ id, name, shape, solid, drops, hardness, tier, hidden, texture })', 'id is "mymod:thing". shape: "cube" | "cross" (plants). drops: omit for itself, null for nothing, or an item name. texture works like icon. At most 40 custom blocks.'],
  ['recipes.register', '({ id, pattern, key, output, count, table })', 'pattern is up to 3 rows of 3 characters, key maps each character to an item name. Example: pattern ["III", " S ", " S "], key { I: "iron_ore", S: "stick" }. table: true requires a crafting table (default: needed when bigger than 2x2).'],

  // ---- effects, sound and screen ----
  ['particles.spawn', '(x, y, z, { color, count, speed, size, life })', 'A burst of particles. color is "#hex".'],
  ['particles.line', '(x1, y1, z1, x2, y2, z2, { color })', 'A line of particles (bullet tracers).'],
  ['sounds.play', '(name, x?, y?, z?)', 'Names: gunshot, reload, click, ding, pop, hurt, pickup, eat, bow, splash, teleport, throw, explode, land, hiss, arrowHit.'],
  ['gui.toast', '(text)', 'Short message above the hotbar.'],
  ['gui.title', '(text, subtitle?)', 'Big title in the middle of the screen.'],
  ['gui.sidebar', '(title, lines[])', 'Scoreboard on the right side (up to 15 lines, color codes work).'],
  ['gui.clearSidebar', '()', 'Hide the scoreboard.'],
  ['gui.open', '(...)', 'NOT SUPPORTED YET (custom windows). Never use it.'],

  // ---- commands, saving and timing ----
  ['commands.register', '(name, description, fn(args, raw))', 'Adds /name. args is an array of words.'],
  ['storage.get', '(key)', 'Read saved data (kept between sessions, 20 KB per script). null if missing.'],
  ['storage.set', '(key, value)', 'Save any JSON value.'],
  ['scheduler.after', '(ms, fn)', 'Run fn once later. Returns an id.'],
  ['scheduler.every', '(ms, fn)', 'Repeat (at least 50 ms). Returns an id.'],
  ['scheduler.cancel', '(id)', 'Stop a timer.'],

  // ---- dimensions ----
  ['dimensions.create', '({ id, name, type, top, filler, base, liquid, sky, fog, light })', 'type: "flat" | "void" | "islands" | "caves". top/filler/base/liquid are block names. sky and fog are "#hex". light is 0-1. Creating the same id again updates it.'],
  ['dimensions.travel', '(id, x?, z?)', 'Go to "overworld", "nether" or a dimension you created.'],
  ['dimensions.current', '()', 'Name of the current dimension.'],
  ['dimensions.list', '()', 'All dimension names.'],

  // ---- Miniblox-style counters and scoreboard ----
  ['stats.get', '(stat, uuid)', 'Synchronous counter (kills, deaths, ...). 0 if never set.'],
  ['stats.set', '(stat, uuid, value, name?)', 'Set a counter.'],
  ['stats.add', '(stat, uuid, name?, amount?)', 'Add to a counter (default 1) and return the new value.'],
  ['stats.top', '(stat, n?)', '[{ uuid, name, value }] highest first.'],
  ['playerData.get', '(uuid, key, default?)', 'Synchronous saved value. The key "playtimeSec" is built in.'],
  ['playerData.set', '(uuid, key, value)', 'Save a value.'],
  ['playerData.add', '(uuid, key, amount?)', 'Add to a saved number.'],
  ['scoreboard.setFor', '(playerId, title, lines[])', 'Miniblox style; same as gui.sidebar.'],
  ['scoreboard.set', '(title, lines[])', 'Same as gui.sidebar.'],
  ['scoreboard.clear', '()', 'Same as gui.clearSidebar.'],
  ['mods.installPack', '({ projectiles: [{ name, damage, gravity, renderScale, trail }], script })', 'Registers named projectile types for world.spawnProjectile(name, ...).'],
];

/** Every callable path (e.g. "world.setBlock"). "tick" is a property, not a function. */
export const API_PATHS: string[] = API_DOCS.map((d) => d[0]);
/** How many callable functions there are (game.tick is a property, so it isn't counted). */
export const API_FUNCTION_COUNT = API_PATHS.filter((p) => p !== 'tick').length;

export const EVENTS_HELP = `Events (game.on(name, fn); fn gets one data object):
  tick: {}                                   4 times a second
  chat: { text }                             the player sent a chat message
  blockBreak, blockPlace: { x, y, z, block }
  itemUse: { item, x, y, z, block, placeX, placeY, placeZ }   right-click held (x/block are null when aiming at air)
  itemUseEnd: { item }                       right-click released
  itemAttack: { item, pressed }              left-click, only for items registered with leftClick: "use"
  playerHit: { target: { id, type }, damage } the player hit a mob
  playerDamage: { amount, cause }   playerDeath: { cause }   playerRespawn: {}
  entityDeath: { id, type, x, y, z }
  projectileHit: { id, x, y, z, entity: { id, type } | null, block: { x, y, z } | null }
  dimensionChange: { dimension }
Miniblox-style names also work: playerInteract (button "left"/"right"), entityDamageByEntity, playerJoin, scriptLoad.
There is also a global print(text) that writes to the script output.`;

const NAMESPACE_TITLES: Record<string, string> = {
  '': 'GENERAL', player: 'PLAYER', world: 'WORLD', entities: 'MOBS', items: 'ITEMS', blocks: 'BLOCKS', recipes: 'RECIPES',
  particles: 'PARTICLES', sounds: 'SOUNDS', gui: 'SCREEN', commands: 'COMMANDS', storage: 'SAVING', scheduler: 'TIMERS',
  dimensions: 'DIMENSIONS', stats: 'COUNTERS (Miniblox style)', playerData: 'COUNTERS (Miniblox style)', scoreboard: 'COUNTERS (Miniblox style)', mods: 'PACKS',
};

/** The full reference, grouped by area. Shown in the editor's API panel and sent to the AI. */
export function buildApiReference(): string {
  const groups = new Map<string, string[]>();
  for (const [path, sig, desc] of API_DOCS) {
    const dot = path.indexOf('.');
    const ns = dot >= 0 && !path.startsWith('players') ? path.slice(0, dot) : '';
    const title = NAMESPACE_TITLES[ns] ?? ns.toUpperCase();
    const lines = groups.get(title) ?? [];
    lines.push(`game.${path}${sig}\n    ${desc}`);
    groups.set(title, lines);
  }
  const body = [...groups.entries()].map(([t, ls]) => `== ${t} ==\n${ls.join('\n')}`).join('\n\n');
  return `Native calls return promises: use await when you need the answer. Synchronous ones are marked.\n\n${body}\n\n${EVENTS_HELP}\n\nText colors: put codes like \\red\\ \\gold\\ \\bold\\ in chat, lore and scoreboard text.`;
}

export const SCRIPT_API_HELP = buildApiReference();

// ---------------- "does that function exist?" checker ----------------
const API_SET = new Set(API_PATHS.filter((p) => p !== 'gui.open'));
const API_NAMESPACES = new Set<string>();
for (const p of API_PATHS) {
  const parts = p.split('.');
  for (let i = 1; i < parts.length; i++) API_NAMESPACES.add(parts.slice(0, i).join('.'));
}

/** Blanks out comments and string contents so text like "game.over" in a message isn't mistaken for code. */
export function stripCommentsAndStrings(code: string): string {
  let out = '';
  let i = 0;
  while (i < code.length) {
    const c = code[i], n = code[i + 1];
    if (c === '/' && n === '/') { while (i < code.length && code[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      out += q;
      i++;
      while (i < code.length && code[i] !== q) { if (code[i] === '\\') i++; i++; }
      out += q;
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return dp[a.length][b.length];
}

export type ApiIssue = { call: string; message: string; suggestion?: string };

/**
 * Finds calls to things that don't exist (game.spawnObject, vibeblox.playSound, ...).
 * Only looks at "game.x.y" chains, so it never flags your own variables.
 */
export function checkApiUsage(code: string): ApiIssue[] {
  const clean = stripCommentsAndStrings(code);
  const issues: ApiIssue[] = [];
  const seen = new Set<string>();
  const add = (i: ApiIssue) => { if (!seen.has(i.call)) { seen.add(i.call); issues.push(i); } };
  const re = /\bgame\s*\.\s*([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    const chain = m[1].replace(/\s+/g, '');
    if (chain === 'tick' || API_SET.has(chain) || API_NAMESPACES.has(chain)) continue;
    if (chain === 'gui.open') { add({ call: 'game.gui.open', message: "game.gui.open (custom windows) isn't supported yet." }); continue; }
    // Walking into a function's own properties (like game.players.all) is fine when the function exists
    const parts = chain.split('.');
    if (parts.length > 1 && API_SET.has(parts.slice(0, -1).join('.')) && /^(call|apply|bind)$/.test(parts[parts.length - 1])) continue;
    let best: string | undefined;
    let bestD = Infinity;
    for (const p of API_SET) {
      const d = editDistance(chain, p);
      if (d < bestD) { bestD = d; best = p; }
    }
    const near = best !== undefined && bestD <= Math.max(3, Math.floor(chain.length * 0.3));
    add({ call: `game.${chain}`, message: `game.${chain} isn't part of the VibeBlox API.`, suggestion: near ? `game.${best}` : undefined });
  }
  for (const v of clean.matchAll(/\bvibeblox\s*\.\s*([A-Za-z_$][\w$]*)/g)) {
    add({ call: `vibeblox.${v[1]}`, message: `There is no "vibeblox" object. Everything lives on "game" (for example game.world.setBlock).` });
  }
  return issues;
}

// ===================================================================
//  AI assistant (shared by the game and the server function)
// ===================================================================
// Model ids checked against Google's model list (Oct 2026). The 2.5 models
// are limited to existing users, so new keys should use these.
export type AiMode = 'normal' | 'high-effort';
export type AiTurn = { role: 'user' | 'assistant'; text: string };
export const AI_MODELS = {
  normal: { model: 'gemini-3.5-flash-lite', thinkingLevel: 'low', maxOutputTokens: 8192, label: 'Normal', note: 'Gemini 3.5 Flash-Lite · fast' },
  'high-effort': { model: 'gemini-3.8-flash', thinkingLevel: 'high', maxOutputTokens: 16384, label: 'High Effort', note: 'Gemini 3.8 Flash · deep reasoning' },
} as const;

/** The system instruction: the whole VibeBlox API, patterns that work, and a strict SEARCH/REPLACE answer format. */
export function buildSystemPrompt(): string {
  return `You are the VibeBlox Script Assistant, built into the code editor of VibeBlox, a Minecraft/Miniblox-style voxel game.
You write and edit the player's script, which is shown to you as CURRENT EDITOR CODE.
The API below is COMPLETE and EXACT. Every function that exists is listed. If a function is not listed, it does not exist: never invent one (no vibeblox.* object, no game.spawnObject, no game.getPlayers(), no custom windows).

OUTPUT FORMAT (STRICT)
Reply ONLY with one or more SEARCH/REPLACE blocks. No other text, no markdown fences, no explanations outside the code:
<<<< SEARCH
[exact lines copied from the current editor code]
====
[the new lines]
>>>> REPLACE

Rules for blocks:
- SEARCH must copy existing lines character for character (spacing, comments, quotes). Use a few lines that appear only once.
- If the editor is empty, or to add code at the end, use an EMPTY search section.
- To delete code, leave the replace section empty.
- Blocks are applied in order, top to bottom. Never repeat a block.
- Put any explanation for the player in short // comments inside the new code.
- If something is impossible with this API, add a // comment saying so and write the closest thing that works.

HOW SCRIPTS RUN
- Code runs inside an async function in a sandboxed Web Worker: top-level await works.
- The ONLY way to affect the game is the global "game" object below, plus print(). Never use document, window, fetch, import, require, localStorage, eval.
- Block and item names are lowercase with underscores ("stone", "iron_ore", "white_concrete", "diamond_sword"); modded ones look like "guns:ak47". Use only names from the BLOCK NAMES / ITEM NAMES lists in the request.
- Limits: 32768 blocks per setBlocks/fill; 200 live projectiles; 80 mobs; 20 KB storage per script; 40 custom blocks; icons and textures are pixel art up to 64x64 (16x16, 32x32 or 64x64 are the usual sizes).
- Single-player: there is exactly one player. Not available: custom windows, networking, other players, custom mob models, cancelling events, keybinds.

API REFERENCE
${SCRIPT_API_HELP}

PATTERNS THAT WORK (copy the shapes, change the details)
// a command with a cooldown
game.commands.register('kit', 'Get a starter kit', async () => {
  const last = (await game.storage.get('last')) || 0;
  if (Date.now() - last < 300000) return game.chat('Wait a bit!', '#ff6b6b');
  await game.player.give('stone_pickaxe', 1);
  await game.storage.set('last', Date.now());
  game.gui.title('Kit received!', 'Good luck');
});

// right-click an item to do something (the item must be registered first)
game.items.register({ id: 'mymod:wand', name: 'Wand', maxStack: 1, lore: ['\\\\gold\\\\Launches you!'],
  icon: { palette: { a: '#caa14a', b: '#6b4a1e' }, pixels: ['', '', '', '..........aa....', '.........aaa....', '........aab.....', '.......aab......', '......aab.......', '.....aab........', '....bb..........'] } });
game.on('itemUse', (e) => { if (e.item === 'mymod:wand') game.player.launch(0, 18, 0); });

// a gun: left-click fires, the bullet is a raycast
game.items.register({ id: 'mymod:pistol', name: 'Pistol', maxStack: 1, hold: 'one_hand', leftClick: 'use', icon: { color: '#888888' } });
game.on('itemAttack', async (e) => {
  if (e.item !== 'mymod:pistol' || !e.pressed) return;
  const hit = await game.world.raycast(null, null, 60);
  if (hit && hit.type === 'entity') game.entities.damage(hit.entity.id, 6, 0.5);
  game.sounds.play('gunshot');
});

// zombies drop diamonds when they die
game.on('entityDeath', (e) => { if (e.type === 'zombie' && Math.random() < 0.3) game.world.dropItem(e.x, e.y, e.z, 'diamond', 1); });

// a scoreboard that updates every second
let kills = 0;
game.on('entityDeath', () => kills++);
game.scheduler.every(1000, () => game.gui.sidebar('\\\\gold\\\\Stats', ['Kills: ' + kills]));

// a custom dimension with a command to visit it
await game.dimensions.create({ id: 'sky', name: 'Sky', type: 'islands', top: 'grass', filler: 'dirt', base: 'stone', sky: '#8fd3ff', fog: '#d6f0ff', light: 1 });
game.commands.register('sky', 'Visit the sky islands', () => game.dimensions.travel('sky'));

// a grenade: a projectile that explodes where it lands
game.on('itemUse', async (e) => {
  if (e.item !== 'mymod:grenade') return;
  const p = await game.player.get();
  game.world.spawnProjectile({ x: p.eye.x, y: p.eye.y, z: p.eye.z, vx: p.look.x * 18, vy: p.look.y * 18 + 3, vz: p.look.z * 18, gravity: 20, explosion: 3, color: '#3a5a2a', size: 0.25 });
  await game.player.removeItem('mymod:grenade', 1);
});

EXAMPLE ANSWER for an empty editor
<<<< SEARCH
====
// /heal restores your health and gives a short regeneration boost
game.commands.register('heal', 'Restore your health', async () => {
  game.player.heal(20);
  game.player.applyEffect('regeneration', 10, 1);
  game.gui.toast('You feel better');
});
>>>> REPLACE`;
}

/** Builds the Gemini request. The editor's current code rides along with the newest message. */
export function buildGeminiRequest(mode: AiMode, history: AiTurn[], code: string, names: { blocks: string[]; items: string[] }, withThinking = true) {
  const cfg = AI_MODELS[mode] ?? AI_MODELS.normal;
  const turns = history.slice(-10).map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(t.text).slice(0, 12000) }] }));
  const last = turns.pop() ?? { role: 'user', parts: [{ text: '' }] };
  const list = (a: string[]) => a.slice(0, 800).map((n) => String(n).slice(0, 48)).join(', ');
  last.parts[0].text = `CURRENT EDITOR CODE (copy lines exactly in SEARCH; empty means the editor is empty):
<<<CODE
${String(code).slice(0, 60000)}
CODE>>>

BLOCK NAMES: ${list(names.blocks)}
ITEM NAMES: ${list(names.items)}

REQUEST:
${last.parts[0].text}`;
  const body = {
    systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
    contents: [...turns, last],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: cfg.maxOutputTokens,
      ...(withThinking ? { thinkingConfig: { thinkingLevel: cfg.thinkingLevel } } : {}),
    },
  };
  return { model: cfg.model, body };
}

/** Pulls the answer text (not the hidden reasoning) out of one streamed Gemini chunk. */
export function geminiChunkText(chunk: unknown): string {
  const c = chunk as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
  return (c.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
}
