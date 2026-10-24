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
  /** CPU a script may use per tick, in milliseconds (depends on your rank; Rising Creators get more). Unlimited if missing. */
  budgetMs?(): number;
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
    const __t0 = performance.now();
    for (const fn of __handlers[m.name] || []) __run(fn, m.data);
    if (m.name === 'tick') __post({ type: 'cpu', ms: performance.now() - __t0 }); // how long this tick took (the game enforces your CPU budget)
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
    getWeather: () => __call('world.getWeather'),
    setWeather: (w) => __call('world.setWeather', w),
    raycast: (origin, direction, maxDistance, options) => __call('world.raycast', origin || null, direction || null, maxDistance == null ? 50 : maxDistance, options || {}),
    spawnProjectile: (spec) => __call('world.spawnProjectile', spec),
    removeProjectile: (id) => __call('world.removeProjectile', id),
    getDimension: () => __call('dimensions.current'),
    getSign: (x, y, z) => __call('world.getSign', x, y, z),
    setSign: (x, y, z, lines) => __call('world.setSign', x, y, z, lines),
    getHighestBlock: (x, z) => __call('world.getHighestBlock', x, z),
    findBlock: (block, x, y, z, radius) => __call('world.findBlock', block, x, y, z, radius == null ? 8 : radius),
    setAlwaysDay: (on) => __call('world.setAlwaysDay', !!on),
    setWeatherCycle: (on) => __call('world.setWeatherCycle', !!on),
    isDay: async () => { const t = await __call('world.getTime'); return t < 12000; },
    sphere: async (x, y, z, r, block, hollow) => {
      r = Math.max(1, Math.min(14, Number(r) || 1));
      const list = [];
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d <= r + 0.3 && (!hollow || d >= r - 0.7)) list.push([x + dx, y + dy, z + dz, block]);
      }
      return __call('world.setBlocks', list);
    },
    line: async (x1, y1, z1, x2, y2, z2, block) => {
      const n = Math.max(1, Math.min(2000, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), Math.abs(z2 - z1)))));
      const list = [];
      for (let i = 0; i <= n; i++) { const t = i / n; list.push([Math.round(x1 + (x2 - x1) * t), Math.round(y1 + (y2 - y1) * t), Math.round(z1 + (z2 - z1) * t), block]); }
      return __call('world.setBlocks', list);
    },
  },
  entities: {
    list: () => __call('entities.list'),
    near: async (x, y, z, radius) => (await __call('entities.list')).filter((e) => Math.hypot(e.x - x, e.y - y, e.z - z) <= radius),
    get: async (id) => (await __call('entities.list')).find((e) => e.id === id) || null,
    spawn: (type, x, y, z) => __call('entities.spawn', type, x, y, z),
    remove: (id) => __call('entities.remove', id),
    damage: (id, amount, knockback) => __call('entities.damage', id, amount, knockback == null ? 1 : knockback),
    knockback: (id, x, y, z) => __call('entities.knockback', id, x, y, z),
    nearest: async (type, x, y, z, radius) => {
      let best = null, bd = radius == null ? 32 : radius;
      for (const e of await __call('entities.list')) { if (type && e.type !== type) continue; const d = Math.hypot(e.x - x, e.y - y, e.z - z); if (d <= bd) { bd = d; best = e; } }
      return best;
    },
    count: async (type) => (await __call('entities.list')).filter((e) => !type || e.type === type).length,
    removeAll: async (type) => { let n = 0; for (const e of await __call('entities.list')) if (!type || e.type === type) { __call('entities.remove', e.id); n++; } return n; },
  },
  util: {
    distance: (a, b) => Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0), (a.z || 0) - (b.z || 0)),
    randomInt: (min, max) => { min = Math.ceil(min); max = Math.floor(max); return Math.floor(Math.random() * (max - min + 1)) + min; },
    choice: (list) => (list && list.length ? list[Math.floor(Math.random() * list.length)] : undefined),
    shuffle: (list) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    formatTime: (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },
  },
  items: { register: (def) => __call('items.register', def) },
  blocks: { register: (def) => __call('blocks.register', def) },
  schematics: {
    paste: (name, x, y, z, options) => __call('schematics.paste', String(name), x, y, z, options || {}),
    list: () => __call('schematics.list'),
    info: (name) => __call('schematics.info', String(name)),
  },
  recipes: { register: (def) => __call('recipes.register', def) },
  particles: {
    spawn: (x, y, z, opts) => __call('particles.spawn', x, y, z, opts || {}),
    line: (x1, y1, z1, x2, y2, z2, opts) => __call('particles.line', x1, y1, z1, x2, y2, z2, opts || {}),
  },
  sounds: { play: (name, x, y, z) => __call('sounds.play', name, x, y, z) },
  gui: {
    toast: (text) => __call('gui.toast', String(text)),
    flash: (seconds) => __call('gui.flash', seconds == null ? 1 : Number(seconds)),
    title: (text, subtitle, seconds) => __call('gui.title', String(text), subtitle == null ? '' : String(subtitle), seconds == null ? 3 : Number(seconds)),
    sidebar: (title, lines) => __call('gui.sidebar', String(title), lines || []),
    clearSidebar: () => __call('gui.clearSidebar'),
  },
  commands: { register: __command, run: (text) => __call('commands.run', String(text)) },
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

type Running = { worker: Worker; name: string; listens: Set<string>; url: string; tickSentAt: number; strikes: number; lastMs: number };
/** A tick that takes longer than this to finish (an endless loop) switches the script off. */
const HANG_MS = 4000;
/** This many slow ticks in a row (a quarter-second each) and the script is switched off. */
const MAX_STRIKES = 8;

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
      const r: Running = { worker, name, listens: new Set(), url, tickSentAt: 0, strikes: 0, lastMs: 0 };
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
    const budget = this.host.budgetMs?.();
    for (const [id, r] of [...this.running]) {
      if (!r.listens.has(name)) continue;
      if (name === 'tick' && budget !== undefined) {
        const now = performance.now();
        if (r.tickSentAt && now - r.tickSentAt > HANG_MS) { // the last tick never finished: an endless loop
          this.stop(id);
          this.host.log(`[${r.name}] Stopped: it got stuck (a tick took over ${HANG_MS / 1000} seconds). Your CPU limit is ${budget} ms per tick.`, 'error');
          continue;
        }
        if (!r.tickSentAt) r.tickSentAt = now;
      }
      r.worker.postMessage({ type: 'event', name, data });
    }
  }

  /** The last tick's CPU use of a running script, in ms (0 if unknown). */
  cpuMs(id: string): number {
    return this.running.get(id)?.lastMs ?? 0;
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
        if (!error && value && typeof (value as { then?: unknown }).then === 'function') {
          // Slow calls (a big schematic paste) answer when they are done
          (value as Promise<unknown>).then(
            (v) => { try { r.worker.postMessage({ type: 'result', id: m.id, value: v }); } catch { /* script was stopped */ } },
            (e) => { try { r.worker.postMessage({ type: 'result', id: m.id, error: String((e as Error)?.message || e) }); } catch { /* script was stopped */ } },
          );
          break;
        }
        r.worker.postMessage({ type: 'result', id: m.id, value, error });
        break;
      }
      case 'cpu': {
        r.tickSentAt = 0;
        const ms = Number(m.ms);
        if (!Number.isFinite(ms)) break;
        r.lastMs = ms;
        const budget = this.host.budgetMs?.();
        if (budget === undefined) break;
        r.strikes = ms > budget ? r.strikes + 1 : Math.max(0, r.strikes - 1);
        if (r.strikes === 3) this.host.log(`[${r.name}] Slow: its ticks take about ${Math.round(ms)} ms and your CPU limit is ${budget} ms per tick.`, 'error');
        if (r.strikes >= MAX_STRIKES) {
          this.stop(id);
          this.host.log(`[${r.name}] Stopped: it used more than ${budget} ms of CPU per tick, too many times in a row. Rising Creators (1000 plays) and ranks get a bigger limit.`, 'error');
        }
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
import type { Schematic } from './schematics';
/** A mod. `schematics` are builds that come with it (a "mod pack"); they work while the mod is switched on. */
export type Mod = { id: string; name: string; author: string; description: string; code: string; official: boolean; version?: string; schematics?: Schematic[] };

export const OFFICIAL_MODS: Mod[] = [
  {
    id: 'guns',
    name: 'Guns',
    author: 'VibeBlox',
    official: true,
    description: 'Ten guns (Pistol, Revolver, Desert Eagle, SMG, AK-47, M4, Pump Shotgun, Sawed-Off, AWP...) plus grenades and flashbangs. Shotguns use their own shotgun shells (gunpowder + iron). Left-click shoots, right-click aims (the AWP scopes in); right-click throws grenades and flashbangs.',
    code: `// Guns: Desert Eagle, AK-47, Sawed-Off and AWP, plus grenades and flashbangs.
// Left-click shoots (hold it with the AK-47), right-click aims; the AWP scopes in.
// Bullets are crafted from an iron ingot + coal (smelt the ore in a furnace first); the shotguns use shotgun shells (gunpowder + iron ingot).
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


// ---- More guns: drawn from simple shapes (x0, y0, x1, y1, colour) with an outline added around them ----
const drawGun = (shapes) => {
  const g = Array.from({ length: 24 }, () => Array(32).fill('.'));
  for (const [x0, y0, x1, y1, c] of shapes) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = c;
  const out = g.map((r) => r.slice());
  for (let y = 0; y < 24; y++) for (let x = 0; x < 32; x++) {
    if (g[y][x] !== '.') continue;
    if ((y > 0 && g[y - 1][x] !== '.') || (y < 23 && g[y + 1][x] !== '.') || (x > 0 && g[y][x - 1] !== '.') || (x < 31 && g[y][x + 1] !== '.')) out[y][x] = 'K';
  }
  return out.map((r) => r.join(''));
};
ART.pistol = drawGun([[7, 9, 24, 9, 'A'], [7, 10, 24, 13, 'z'], [7, 14, 20, 15, 'm'], [8, 16, 13, 22, 'p'], [9, 17, 12, 21, 'P'], [14, 16, 17, 17, 'M'], [24, 10, 25, 11, 'N']]);
ART.revolver = drawGun([[10, 9, 28, 10, 'A'], [10, 11, 28, 12, 'z'], [11, 10, 16, 15, 'm'], [12, 11, 15, 14, 'M'], [5, 10, 11, 14, 'Z'], [5, 15, 10, 22, 'w'], [6, 16, 9, 21, 'W'], [11, 15, 17, 16, 'M'], [28, 9, 29, 9, 'y']]);
ART.smg = drawGun([[3, 10, 5, 12, 'M'], [6, 9, 22, 9, 'z'], [6, 10, 22, 14, 'Z'], [22, 10, 29, 11, 'm'], [30, 10, 30, 11, 'M'], [12, 15, 15, 23, 'N'], [13, 16, 14, 22, 'Q'], [6, 15, 10, 21, 'P'], [8, 7, 13, 8, 'M']]);
ART.shotgun = drawGun([[0, 10, 3, 16, 'W'], [4, 9, 12, 14, 'w'], [4, 10, 12, 10, 'W'], [13, 9, 31, 10, 'm'], [13, 12, 27, 13, 'Z'], [15, 12, 21, 14, 'V'], [13, 11, 31, 11, 'M'], [8, 15, 11, 18, 'P']]);
ART.m4 = drawGun([[0, 10, 7, 14, 'P'], [8, 9, 22, 13, 'N'], [8, 8, 18, 8, 'M'], [22, 10, 31, 11, 'M'], [22, 12, 28, 13, 'Z'], [13, 14, 16, 21, 'N'], [14, 15, 15, 20, 'Q'], [8, 14, 10, 19, 'P'], [30, 9, 31, 9, 'M']]);
const MORE_GUNS = {
  'guns:pistol': { name: 'Pistol', art: 'pistol', hold: 'one_hand', damage: 6, cooldown: 280, auto: false, pellets: 1,
    spread: 0.02, aimSpread: 0.006, range: 60, recoil: 0.05, zoom: 0.88, knockback: 0.5,
    lore: ['\\\\gray\\\\A light sidearm.', '\\\\white\\\\Damage: \\\\gold\\\\6 \\\\gray\\\\| Semi-auto', '\\\\white\\\\Quick to fire, easy to control'] },
  'guns:revolver': { name: 'Revolver', art: 'revolver', hold: 'one_hand', damage: 12, cooldown: 700, auto: false, pellets: 1,
    spread: 0.01, aimSpread: 0.002, range: 85, recoil: 0.11, zoom: 0.8, knockback: 1.1,
    lore: ['\\\\gray\\\\Six shots of pure punch.', '\\\\white\\\\Damage: \\\\gold\\\\12 \\\\gray\\\\| Slow, steady', '\\\\red\\\\Kicks hard'] },
  'guns:smg': { name: 'SMG', art: 'smg', hold: 'two_hands', damage: 3, cooldown: 65, auto: true, pellets: 1,
    spread: 0.055, aimSpread: 0.025, range: 45, recoil: 0.014, zoom: 0.85, knockback: 0.2,
    lore: ['\\\\gray\\\\Sprays fast at close range.', '\\\\white\\\\Damage: \\\\gold\\\\3 \\\\gray\\\\| Full-auto, \\\\gold\\\\900 RPM', '\\\\white\\\\Hold left-click to spray'] },
  'guns:shotgun': { name: 'Pump Shotgun', art: 'shotgun', hold: 'two_hands', damage: 2.5, cooldown: 950, auto: false, pellets: 7,
    spread: 0.09, aimSpread: 0.06, range: 22, recoil: 0.1, zoom: 0.9, knockback: 1.3, ammo: 'guns:shell',
    lore: ['\\\\gray\\\\Pump action.', '\\\\white\\\\Damage: \\\\gold\\\\2.5 x 7 pellets', '\\\\white\\\\Great up close', '\\\\yellow\\\\Loads shotgun shells'] },
  'guns:m4': { name: 'M4 Carbine', art: 'm4', hold: 'two_hands', damage: 4, cooldown: 80, auto: true, pellets: 1,
    spread: 0.026, aimSpread: 0.008, range: 90, recoil: 0.018, zoom: 0.72, knockback: 0.35,
    lore: ['\\\\gray\\\\Accurate and quick.', '\\\\white\\\\Damage: \\\\gold\\\\4 \\\\gray\\\\| Full-auto, \\\\gold\\\\750 RPM', '\\\\white\\\\Right-click to aim for tighter spread'] },
};

const GUNS = {
  'guns:deagle': { name: 'Desert Eagle', art: 'deagle', hold: 'one_hand', damage: 9, cooldown: 420, auto: false, pellets: 1,
    spread: 0.012, aimSpread: 0.003, range: 70, recoil: 0.08, zoom: 0.82, knockback: 0.8,
    lore: ['\\\\gray\\\\A hand cannon.', '\\\\white\\\\Damage: \\\\gold\\\\9 \\\\gray\\\\| Semi-auto', '\\\\white\\\\Held in one hand', '\\\\red\\\\Kicks hard'] },
  'guns:ak47': { name: 'AK-47', art: 'ak47', hold: 'two_hands', damage: 5, cooldown: 100, auto: true, pellets: 1,
    spread: 0.035, aimSpread: 0.012, range: 80, recoil: 0.022, zoom: 0.78, knockback: 0.4,
    lore: ['\\\\gray\\\\Classic assault rifle.', '\\\\white\\\\Damage: \\\\gold\\\\5 \\\\gray\\\\| Full-auto, 600 RPM', '\\\\white\\\\Hold left-click to spray'] },
  'guns:sawed_off': { name: 'Sawed-Off', art: 'sawed', hold: 'two_hands', damage: 3, cooldown: 750, auto: false, pellets: 9,
    spread: 0.12, aimSpread: 0.085, range: 18, recoil: 0.13, zoom: 0.9, knockback: 1.6, ammo: 'guns:shell',
    lore: ['\\\\gray\\\\Double barrel, sawn short.', '\\\\white\\\\Damage: \\\\gold\\\\3 x 9 pellets', '\\\\white\\\\Brutal up close, useless far away', '\\\\yellow\\\\Loads shotgun shells'] },
  'guns:awp': { name: 'AWP', art: 'awp', hold: 'two_hands', damage: 20, cooldown: 1400, auto: false, pellets: 1,
    spread: 0.07, aimSpread: 0, range: 160, recoil: 0.12, zoom: 0.22, scope: true, knockback: 1.2,
    lore: ['\\\\gray\\\\Bolt-action sniper rifle.', '\\\\white\\\\Damage: \\\\gold\\\\20 \\\\gray\\\\| One shot, most mobs', '\\\\white\\\\Right-click to scope in', '\\\\red\\\\Wild without the scope'] },
};

Object.assign(GUNS, MORE_GUNS);

game.items.register({ id: 'guns:bullet', name: 'Bullets', maxStack: 64,
  lore: ['\\\\gray\\\\Ammo for every gun.', '\\\\white\\\\Iron ingot + coal = 16'],
  icon: { palette: { b: '#c0c0c0', y: '#e3b341', Y: '#a8801f' }, pixels: [
    '', '', '', '...b....b....b..', '..bbb..bbb..bbb.', '..yyy..yyy..yyy.', '..yyy..yyy..yyy.', '..yyy..yyy..yyy.', '..yyy..yyy..yyy.', '..YYY..YYY..YYY.'] } });
game.items.register({ id: 'guns:shell', name: 'Shotgun Shells', maxStack: 64,
  lore: ['\\\\gray\\\\Ammo for the Pump Shotgun and the Sawed-Off.', '\\\\white\\\\Gunpowder + iron ingot = 8'],
  icon: { palette: { r: '#c0392b', R: '#8e2a20', y: '#e3b341', Y: '#a8801f' }, pixels: [
    '', '', '', '...r....r....r..', '..rrr..rrr..rrr.', '..rRr..rRr..rRr.', '..rrr..rrr..rrr.', '..rrr..rrr..rrr.', '..yyy..yyy..yyy.', '..YYY..YYY..YYY.'] } });
for (const [id, g] of Object.entries(GUNS)) {
  game.items.register({ id, name: g.name, maxStack: 1, hold: g.hold, leftClick: 'use', lore: g.lore, icon: { palette: PAL, pixels: ART[g.art] } });
}

game.recipes.register({ id: 'shotgun_shells', pattern: ['G', 'I'], key: { G: 'gunpowder', I: 'iron_ingot' }, output: 'guns:shell', count: 8 });
game.recipes.register({ id: 'bullets', pattern: ['I', 'C'], key: { I: 'iron_ingot', C: 'coal' }, output: 'guns:bullet', count: 16 });
game.recipes.register({ id: 'deagle', pattern: ['III', 'I  '], key: { I: 'iron_ingot' }, output: 'guns:deagle' });
game.recipes.register({ id: 'ak47', pattern: ['III', 'PIP'], key: { I: 'iron_ingot', P: 'planks' }, output: 'guns:ak47' });
game.recipes.register({ id: 'sawed_off', pattern: ['III', 'P  '], key: { I: 'iron_ingot', P: 'planks' }, output: 'guns:sawed_off' });
game.recipes.register({ id: 'awp', pattern: ['DII', 'III', 'P  '], key: { D: 'diamond', I: 'iron_ingot', P: 'planks' }, output: 'guns:awp' });
game.recipes.register({ id: 'pistol', pattern: ['II', 'I '], key: { I: 'iron_ingot' }, output: 'guns:pistol' });
game.recipes.register({ id: 'revolver', pattern: ['III', 'I P'], key: { I: 'iron_ingot', P: 'planks' }, output: 'guns:revolver' });
game.recipes.register({ id: 'smg', pattern: ['IIC', 'III'], key: { I: 'iron_ingot', C: 'coal' }, output: 'guns:smg' });
game.recipes.register({ id: 'pump_shotgun', pattern: ['III', 'PPI'], key: { I: 'iron_ingot', P: 'planks' }, output: 'guns:shotgun' });
game.recipes.register({ id: 'm4', pattern: ['III', 'IDP'], key: { I: 'iron_ingot', D: 'diamond', P: 'planks' }, output: 'guns:m4' });

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
    const ammo = g.ammo || 'guns:bullet';
    if ((await game.player.countItem(ammo)) < 1) {
      game.sounds.play('click');
      game.gui.toast(ammo === 'guns:shell' ? 'Out of shotgun shells! Craft them from gunpowder + iron' : 'Out of bullets! Craft them from iron ore + coal');
      stopAuto();
      return;
    }
    game.player.removeItem(ammo, 1);
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
    const hit = await game.world.raycast(p.eye, dir, g.range, { shot: true });
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

// ---------------- Grenades and flashbangs ----------------
// Right-click throws them. A grenade blows up where it lands; a flashbang goes off with a blinding flash:
// the closer you are and the more you face it, the longer you're blinded.
const THROWN = {};
game.items.register({ id: 'guns:grenade', name: 'Grenade', maxStack: 16, hold: 'item',
  lore: ['\\\\gray\\\\Right-click to throw.', '\\\\white\\\\Explodes where it lands', '\\\\red\\\\Breaks blocks!'],
  icon: { palette: { K: '#0e1012', g: '#5c7a3a', G: '#3e5526', d: '#2a3a1a', m: '#9aa0a6', M: '#5e646b', r: '#c8c8c8' }, pixels: [
    '................', '......KKK.......', '.....KmMmK......', '.....KMrMKKK....', '......KMK..rK...', '....KKKKKKK.K...', '...KgggggggK....', '..KggGgggGggK...',
    '..KgddddddddK...', '..KgGggGggGgK...', '..KggggggggGK...', '..KgddddddddK...', '..KgGggGggGgK...', '...KggggggGK....', '....KKKKKKK.....', '................'] } });
game.items.register({ id: 'guns:flashbang', name: 'Flashbang', maxStack: 16, hold: 'item',
  lore: ['\\\\gray\\\\Right-click to throw.', '\\\\white\\\\A blinding flash and a bang', "\\\\yellow\\\\Look away when it goes off!"],
  icon: { palette: { K: '#0e1012', a: '#e6eaef', A: '#b5bcc5', z: '#848c97', y: '#f4d567', m: '#9aa0a6', M: '#5e646b' }, pixels: [
    '................', '......KKK.......', '.....KmMmK......', '.....KMyMKKK....', '......KMK..yK...', '....KKKKKKK.K...', '....KaaaaaK.....', '....KAAAAAK.....',
    '....KyyyyyK.....', '....KAAAAAK.....', '....KaaaaaK.....', '....KzzzzzK.....', '....KAAAAAK.....', '....KaaaaaK.....', '.....KKKKK......', '................'] } });
game.recipes.register({ id: 'grenade', pattern: [' I ', 'IGI', ' I '], key: { I: 'iron_ingot', G: 'gunpowder' }, output: 'guns:grenade', count: 2 });
game.recipes.register({ id: 'flashbang', pattern: [' I ', 'IGI', ' Y '], key: { I: 'iron_ingot', G: 'gunpowder', Y: 'gold_ingot' }, output: 'guns:flashbang', count: 2 });

async function throwIt(item) {
  const p = await game.player.get();
  if (p.mode !== 'creative') {
    if ((await game.player.countItem(item)) < 1) return;
    game.player.removeItem(item, 1);
  }
  game.sounds.play('throw');
  const grenade = item === 'guns:grenade';
  const id = await game.world.spawnProjectile({
    x: p.eye.x + p.look.x * 0.6, y: p.eye.y + p.look.y * 0.6, z: p.eye.z + p.look.z * 0.6,
    vx: p.look.x * 17, vy: p.look.y * 17 + 3, vz: p.look.z * 17, gravity: 20,
    damage: grenade ? 2 : 0, knockback: 1, lifetime: 6,
    explosion: grenade ? 3 : 0, color: grenade ? '#4e6b30' : '#d8dde3', size: 0.22,
  });
  if (!grenade) THROWN[id] = 'flash';
}

async function flashAt(x, y, z) {
  game.sounds.play('explode');
  game.particles.spawn(x, y + 0.3, z, { color: '#ffffff', count: 30, speed: 6, size: 0.12, life: 0.4 });
  game.particles.spawn(x, y + 0.3, z, { color: '#fff3b0', count: 14, speed: 3, size: 0.2, life: 0.6 });
  const p = await game.player.get();
  const dx = x - p.eye.x, dy = y - p.eye.y, dz = z - p.eye.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist > 24) return;
  const facing = dist < 0.01 ? 1 : (dx * p.look.x + dy * p.look.y + dz * p.look.z) / dist; // 1 = looking right at it
  const strength = Math.max(0, 1 - dist / 24) * (facing > 0.3 ? 1 : facing > -0.2 ? 0.55 : 0.25);
  if (strength < 0.08) return;
  game.gui.flash(0.6 + strength * 4.5); // seconds of white
  if (strength > 0.4) game.player.applyEffect('slowness', Math.ceil(strength * 4), 1); // dazed
}

game.on('itemUse', (e) => {
  if (e.item === 'guns:grenade' || e.item === 'guns:flashbang') throwIt(e.item);
});
game.on('projectileHit', (e) => {
  if (THROWN[e.projectileId] !== 'flash') return;
  delete THROWN[e.projectileId];
  flashAt(e.x, e.y, e.z);
});
`,
  },
  {
    id: 'farmers-delight',
    name: "Farmer's Delight",
    author: 'VibeBlox',
    official: true,
    description: 'Six kitchen knives that hit harder, and a dozen hearty meals cooked from wheat, eggs, fish, apples and meat.',
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
  wooden: { name: 'Wooden Knife', bonus: 1, mat: 'planks', blade: '#a8793e', edge: '#d9a866' },
  emerald: { name: 'Emerald Knife', bonus: 5, mat: 'emerald', blade: '#2fd47a', edge: '#b8ffd8' },
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
  { id: 'fried_egg', name: 'Fried Egg', food: 5, icon: bowl('#fff3b0'), pattern: ['E'], key: { E: 'egg' } },
  { id: 'egg_sandwich', name: 'Egg Sandwich', food: 9, icon: bowl('#f0d070'), pattern: ['B', 'E', 'B'], key: { B: 'bread', E: 'egg' } },
  { id: 'pancakes', name: 'Pancakes', food: 8, icon: bowl('#d9a35a'), pattern: ['WWW', 'EEE'], key: { W: 'wheat', E: 'egg' } },
  { id: 'cane_cookies', name: 'Cane Cookies', food: 4, icon: bowl('#b8864a'), pattern: ['WCW'], key: { W: 'wheat', C: 'sugar_cane' } },
  { id: 'salmon_sandwich', name: 'Salmon Sandwich', food: 10, icon: bowl('#f08a6a'), pattern: ['B', 'S', 'B'], key: { B: 'bread', S: 'cooked_salmon' } },
  { id: 'fish_stew', name: 'Fish Stew', food: 12, icon: bowl('#e0a070'), pattern: ['CS', ' W'], key: { C: 'cooked_cod', S: 'cooked_salmon', W: 'wheat' } },
  { id: 'mutton_wrap', name: 'Mutton Wrap', food: 11, icon: bowl('#c87a5a'), pattern: ['W', 'M', 'W'], key: { W: 'wheat', M: 'cooked_mutton' } },
  { id: 'roast_dinner', name: 'Roast Dinner', food: 18, icon: bowl('#7a3a1a'), pattern: ['SPM', 'BAB'], key: { S: 'steak', P: 'cooked_porkchop', M: 'cooked_mutton', B: 'bread', A: 'apple' } },
  { id: 'stew', name: "Farmer's Stew", food: 14, icon: bowl('#a0552a'), pattern: ['SPC', ' W '], key: { S: 'steak', P: 'cooked_porkchop', C: 'cooked_chicken', W: 'wheat' } },
];
for (const m of meals) {
  game.items.register({ id: 'farmers:' + m.id, name: m.name, food: m.food, icon: m.icon });
  game.recipes.register({ id: m.id, pattern: m.pattern, key: m.key, output: 'farmers:' + m.id });
}
`,
  },
  {
    id: 'waystones',
    name: 'Waystones',
    author: 'VibeBlox',
    official: true,
    description: 'Craft and place Waystones. Right-click one to wake it up, then right-click again to hop to the next waystone you have found. /waystone list, go, name and remove. Warp Scrolls take you back to the last waystone you used.',
    code: `// Waystones: a network of teleport stones. Right-click a stone to wake it up; right-click it again to travel to the next one.
const tex = (pal, fn) => ({ palette: pal, pixels: Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => fn(x, y)).join('')) });
const STONE = { d: '#3f434b', s: '#8a8f98', S: '#767b84', c: '#6fd6ff', C: '#e8fbff' };
game.blocks.register({ id: 'waystones:waystone', name: 'Waystone', hardness: 3, tier: 1, use: true,
  texture: tex(STONE, (x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return 'd';
    const a = Math.abs(x - 7.5), b = Math.abs(y - 7.5);
    if (a + b < 1.6 + 0.1) return 'C';
    if (a + b > 2.4 && a + b < 4.1) return 'c';
    return (x + y) % 5 === 0 ? 'S' : 's';
  }) });
game.items.register({ id: 'waystones:warp_scroll', name: 'Warp Scroll', maxStack: 16,
  lore: ['\\\\gray\\\\Right-click to go back to the', '\\\\gray\\\\last waystone you used.', '\\\\white\\\\Used up when you read it'],
  icon: tex({ p: '#f1e6c4', P: '#cdbd8a', c: '#6fd6ff', r: '#b3552a' }, (x, y) => {
    if (x < 3 || x > 12 || y < 2 || y > 13) return '.';
    if (y === 2 || y === 13) return 'P';
    if (x === 3 || x === 12) return 'r';
    const a = Math.abs(x - 7.5), b = Math.abs(y - 7.5);
    return a + b < 3.2 ? 'c' : 'p';
  }) });
game.recipes.register({ id: 'waystone', pattern: ['SES', 'SSS'], key: { S: 'stone', E: 'ender_pearl' }, output: 'waystones:waystone' });
game.recipes.register({ id: 'warp_scroll', pattern: ['P', 'E', 'P'], key: { P: 'paper', E: 'ender_pearl' }, output: 'waystones:warp_scroll', count: 2 });

let ways = []; // { x, y, z, dim, name, on }
let lastUsed = null; // index key of the last waystone you used
let cursor = 0;
let readyAt = 0;
const keyOf = (w) => w.dim + ':' + w.x + ',' + w.y + ',' + w.z;
async function load() { const d = await game.storage.get('ways'); if (d) { ways = d.ways || []; lastUsed = d.last || null; } }
function save() { game.storage.set('ways', { ways, last: lastUsed }); }
const find = (x, y, z, dim) => ways.find((w) => w.x === x && w.y === y && w.z === z && w.dim === dim);
async function here() { const p = await game.player.get(); return { p, dim: p.dimension }; }

game.on('scriptLoad', load);
game.on('blockPlace', async (e) => {
  if (e.block !== 'waystones:waystone' && e.block !== 'Waystone') return;
  const { dim } = await here();
  if (find(e.x, e.y, e.z, dim)) return;
  ways.push({ x: e.x, y: e.y, z: e.z, dim, name: 'Waystone ' + (ways.length + 1), on: false });
  save();
  game.gui.toast('Waystone placed. Right-click it to wake it up.');
});
game.on('blockBreak', async (e) => {
  if (e.block !== 'waystones:waystone') return;
  const { dim } = await here();
  const w = find(e.x, e.y, e.z, dim);
  if (!w) return;
  ways = ways.filter((o) => o !== w);
  if (lastUsed === keyOf(w)) lastUsed = null;
  save();
  game.chat('\\\\gray\\\\Waystone "' + w.name + '" is gone.');
});

async function travel(w) {
  const now = Date.now();
  if (now < readyAt) { game.gui.toast('The waystone is still humming...'); return; }
  readyAt = now + 2500;
  game.world.spawnParticles('portal', w.x + 0.5, w.y + 1, w.z + 0.5, 20, 0.6, 0.5);
  game.player.teleport(w.x + 0.5, w.y + 1.05, w.z + 0.5);
  game.sounds.play('teleport');
  lastUsed = keyOf(w);
  save();
  game.gui.title('', '\\\\aqua\\\\' + w.name, 2);
}
game.on('blockUse', async (e) => {
  if (e.block !== 'waystones:waystone') return;
  const { p, dim } = await here();
  let w = find(e.x, e.y, e.z, dim);
  if (!w) { w = { x: e.x, y: e.y, z: e.z, dim, name: 'Waystone ' + (ways.length + 1), on: false }; ways.push(w); }
  if (!w.on) {
    w.on = true;
    lastUsed = keyOf(w);
    save();
    game.sounds.play('ding');
    game.particles.spawn(e.x + 0.5, e.y + 1.2, e.z + 0.5, { color: '#6fd6ff', count: 24, speed: 2.5, size: 0.14, life: 0.8 });
    game.gui.title('\\\\aqua\\\\Waystone found', w.name, 2.5);
    game.chat('\\\\aqua\\\\' + w.name + ' \\\\gray\\\\is awake. Use /waystone name <new name> to rename it.');
    return;
  }
  const others = ways.filter((o) => o.on && o.dim === dim && o !== w);
  if (!others.length) { game.gui.toast('No other waystone is awake yet. Place and wake another one!'); return; }
  cursor = (cursor + 1) % others.length;
  const to = others[cursor];
  travel(to);
});
game.on('itemUse', async (e) => {
  if (e.item !== 'waystones:warp_scroll') return;
  const { p, dim } = await here();
  const w = ways.find((o) => keyOf(o) === lastUsed && o.dim === dim);
  if (!w) { game.gui.toast('The scroll fizzles: no waystone to go back to here.'); return; }
  if (p.mode !== 'creative') game.player.removeItem('waystones:warp_scroll', 1);
  readyAt = 0;
  travel(w);
});

game.commands.register('waystone', 'Waystones: /waystone list | go <number or name> | name <new name> | remove', async (args) => {
  const sub = (args[0] || 'list').toLowerCase();
  const { p, dim } = await here();
  const mine = ways.filter((w) => w.on && w.dim === dim);
  const near = mine.find((w) => Math.hypot(w.x + 0.5 - p.x, w.y - p.y, w.z + 0.5 - p.z) < 4);
  if (sub === 'list') {
    if (!mine.length) { game.chat('\\\\gray\\\\No waystones found here yet.'); return; }
    mine.forEach((w, i) => game.chat('\\\\gold\\\\' + (i + 1) + '. \\\\white\\\\' + w.name + ' \\\\gray\\\\(' + w.x + ', ' + w.y + ', ' + w.z + ')'));
    return;
  }
  if (sub === 'go') {
    if (!near) { game.chat('\\\\red\\\\Stand next to an awake waystone first.'); return; }
    const q = args.slice(1).join(' ').toLowerCase();
    const n = Number(q);
    const to = Number.isInteger(n) && n >= 1 ? mine[n - 1] : mine.find((w) => w.name.toLowerCase() === q) || mine.find((w) => w.name.toLowerCase().includes(q));
    if (!to || !q) { game.chat('\\\\red\\\\No waystone like that. Try /waystone list'); return; }
    travel(to);
    return;
  }
  if (sub === 'name') {
    const nm = args.slice(1).join(' ').slice(0, 24).trim();
    if (!near || !nm) { game.chat('\\\\red\\\\Stand next to a waystone and type /waystone name <new name>'); return; }
    near.name = nm; save(); game.chat('\\\\aqua\\\\Renamed to ' + nm);
    return;
  }
  if (sub === 'remove') {
    if (!near) { game.chat('\\\\red\\\\Stand next to the waystone you want to forget.'); return; }
    near.on = false; save(); game.chat('\\\\gray\\\\The stone goes quiet. Right-click it to wake it again.');
    return;
  }
  game.chat('\\\\gray\\\\/waystone list | go <number or name> | name <new name> | remove');
});
`,
  },
  {
    id: 'furniture',
    name: 'Furniture',
    author: 'VibeBlox',
    official: true,
    description: 'Seven pieces to decorate with: Chair, Table, Sofa, Lamp, Clock, Cupboard and TV. Right-click a chair or sofa to sit and rest (a little healing), a clock to read the time, a TV to change channel.',
    code: `// Furniture: decorate your house. Chairs and sofas let you rest, the clock tells the time, the TV has channels.
const tex = (pal, fn) => ({ palette: pal, pixels: Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => fn(x, y)).join('')) });
const W = { w: '#b98a4e', W: '#9a6f3a', d: '#5e4020', l: '#d4a867', r: '#b32d2d', R: '#8a1f1f', k: '#1d1d22', b: '#3a7bd5', y: '#ffe07a', Y: '#d9a93a', g: '#9aa0a6', G: '#5e646b', c: '#f2f2ec', n: '#2a2a30' };
const woodBase = (x, y) => (y % 4 === 3 ? 'W' : (x + y * 3) % 7 === 0 ? 'l' : 'w');
const edge = (x, y) => x === 0 || y === 0 || x === 15 || y === 15;
const PIECES = {
  chair:    { name: 'Wooden Chair', use: true, hard: 1, tex: (x, y) => edge(x, y) ? 'd' : (y < 6 && x > 3 && x < 12) ? 'W' : (y > 9 && (x < 3 || x > 12)) ? 'd' : (y >= 6 && y <= 9) ? 'l' : woodBase(x, y) },
  table:    { name: 'Wooden Table', use: false, hard: 1, tex: (x, y) => edge(x, y) ? 'd' : (y < 5) ? 'l' : (y === 5) ? 'd' : (x < 3 || x > 12) ? 'W' : 'w' },
  sofa:     { name: 'Sofa', use: true, hard: 0.8, tex: (x, y) => edge(x, y) ? 'R' : (y < 5) ? 'R' : (y < 6) ? 'k' : ((x === 3 || x === 12) && y > 6) ? 'R' : (x < 3 || x > 12) ? 'R' : (x + y) % 6 === 0 ? 'R' : 'r' },
  lamp:     { name: 'Lamp', use: false, hard: 0.5, tex: (x, y) => edge(x, y) ? 'Y' : (x > 4 && x < 11 && y > 2 && y < 12) ? ((x + y) % 4 === 0 ? 'y' : 'y') : (y > 12) ? 'd' : 'Y' },
  clock:    { name: 'Wall Clock', use: true, hard: 0.8, tex: (x, y) => { if (edge(x, y)) return 'd'; const a = x - 7.5, b = y - 7.5, r = Math.hypot(a, b); if (r > 6) return 'W'; if (r > 5) return 'k'; if (Math.abs(a) < 0.8 && b < 0 && b > -4) return 'k'; if (Math.abs(b) < 0.8 && a > 0 && a < 3) return 'k'; return 'c'; } },
  cupboard: { name: 'Cupboard', use: true, hard: 1.2, tex: (x, y) => edge(x, y) ? 'd' : (x === 7 || x === 8) ? 'd' : (y > 6 && y < 9 && (x === 5 || x === 10)) ? 'y' : (y % 8 === 0) ? 'W' : woodBase(x, y) },
  tv:       { name: 'TV', use: true, hard: 1, tex: (x, y) => edge(x, y) || x === 1 || y === 1 || x === 14 || y === 14 ? 'n' : ((x + y) % 7 === 0 ? 'b' : (x * 3 + y) % 5 === 0 ? 'g' : 'k') },
};
for (const [key, f] of Object.entries(PIECES)) {
  game.blocks.register({ id: 'furniture:' + key, name: f.name, hardness: f.hard, use: f.use, texture: tex(W, f.tex) });
}
game.recipes.register({ id: 'chair', pattern: ['S  ', 'SPP', 'S S'], key: { S: 'stick', P: 'planks' }, output: 'furniture:chair', count: 2 });
game.recipes.register({ id: 'table', pattern: ['PPP', 'S S'], key: { S: 'stick', P: 'planks' }, output: 'furniture:table' });
game.recipes.register({ id: 'sofa', pattern: ['W  ', 'WWW', 'P P'], key: { W: 'white_wool', P: 'planks' }, output: 'furniture:sofa' });
game.recipes.register({ id: 'lamp', pattern: ['G', 'T', 'S'], key: { G: 'glass', T: 'torch', S: 'stick' }, output: 'furniture:lamp' });
game.recipes.register({ id: 'clock', pattern: ['PPP', 'PGP', 'PPP'], key: { G: 'gold_ingot', P: 'planks' }, output: 'furniture:clock' });
game.recipes.register({ id: 'cupboard', pattern: ['PSP', 'P P', 'PPP'], key: { S: 'stick', P: 'planks' }, output: 'furniture:cupboard' });
game.recipes.register({ id: 'tv', pattern: ['III', 'IGI', 'III'], key: { I: 'iron_ingot', G: 'glass' }, output: 'furniture:tv' });

let restAt = 0;
const SHOWS = ['Cooking show: how to bake bread', 'News: a creeper was seen near the village', 'Cartoon: a pig learns to fly', 'Weather: sunny with a chance of zombies', 'Quiz show: what do you get from cows?', 'Nature: the secret life of chickens'];
const STUFF = ['It smells of old wood.', 'Neatly stacked plates.', 'Just a spare candle and a sock.', 'A tin of cookies (empty).', 'Folded blankets.'];
game.on('blockUse', async (e) => {
  if (!e.block || e.block.indexOf('furniture:') !== 0) return;
  const kind = e.block.slice(10);
  if (kind === 'chair' || kind === 'sofa') {
    const now = Date.now();
    game.player.teleport(e.x + 0.5, e.y + 0.95, e.z + 0.5);
    if (now < restAt) { game.gui.toast('You sit down.'); return; }
    restAt = now + 15000;
    game.player.applyEffect('regeneration', 6, 1);
    game.world.spawnParticles('heart', e.x + 0.5, e.y + 1.6, e.z + 0.5, 3, 0.4, 0.1);
    game.gui.toast('You sit down and rest a moment...');
  } else if (kind === 'clock') {
    const t = await game.world.getTime();
    const mins = Math.floor(((t / 1000 + 6) % 24) * 60);
    const hh = String(Math.floor(mins / 60)).padStart(2, '0'), mm = String(mins % 60).padStart(2, '0');
    game.sounds.play('click');
    game.gui.toast('The clock says ' + hh + ':' + mm);
  } else if (kind === 'tv') {
    game.sounds.play('click');
    game.gui.toast('TV: ' + game.util.choice(SHOWS));
  } else if (kind === 'cupboard') {
    game.sounds.play('click');
    game.gui.toast(game.util.choice(STUFF));
  }
});
`,
  },
  {
    id: 'throwables',
    name: 'Throwables',
    author: 'VibeBlox',
    official: true,
    description: 'Five things to throw with right-click: Throwing Knives, Shuriken, Fire Bombs, Ice Balls and Confetti Poppers. They can hit a Target block to switch on redstone.',
    code: `// Throwables: right-click to throw. Knives and shuriken fly straight, bombs explode, ice balls chill, poppers just celebrate.
const tex = (pal, fn) => ({ palette: pal, pixels: Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => fn(x, y)).join('')) });
const disc = (cx, cy, r) => (x, y) => Math.hypot(x - cx, y - cy) <= r;
const ITEMS = {
  knife: { name: 'Throwing Knife', speed: 30, grav: 6, damage: 7, size: 0.12, color: '#d8dde3', cd: 350, lore: ['\\\\white\\\\Damage: \\\\gold\\\\7', '\\\\gray\\\\Flies fast and straight'],
    icon: tex({ b: '#e6eaef', B: '#9aa0a6', h: '#6b4a2b', k: '#1d1d22' }, (x, y) => { const d = x + (15 - y); if (Math.abs(x - y) <= 1 && x > 5) return x - y === 0 ? 'b' : 'B'; if (Math.abs(x - y) <= 1 && x >= 2) return 'h'; return '.'; }),
    recipe: { id: 'throwing_knife', pattern: ['I', 'S'], key: { I: 'iron_ingot', S: 'stick' }, count: 4 } },
  shuriken: { name: 'Shuriken', speed: 34, grav: 3, damage: 4, size: 0.1, color: '#b8c0c8', cd: 250, lore: ['\\\\white\\\\Damage: \\\\gold\\\\4', '\\\\gray\\\\Quick and light'],
    icon: tex({ s: '#c8d0d8', S: '#7a828c', k: '#1d1d22' }, (x, y) => { const a = Math.abs(x - 7.5), b = Math.abs(y - 7.5); if (a < 1.2 && b < 1.2) return 'k'; if ((a < 1.3 && b < 7) || (b < 1.3 && a < 7)) return 's'; if (Math.abs(a - b) < 1.3 && a < 6) return 'S'; return '.'; }),
    recipe: { id: 'shuriken', pattern: ['I I', ' I ', 'I I'], key: { I: 'iron_ingot' }, count: 6 } },
  firebomb: { name: 'Fire Bomb', speed: 17, grav: 20, damage: 3, size: 0.22, color: '#ff7a1a', cd: 900, explosion: 1.2, lore: ['\\\\white\\\\Bursts into flames where it lands', '\\\\red\\\\Breaks blocks!'],
    icon: tex({ o: '#e8601a', O: '#a83c0c', y: '#ffd34a', k: '#1d1d22', f: '#c8c8c8' }, (x, y) => { if (y < 4 && x === 8) return 'f'; if (y < 4 && x === 9 && y > 1) return 'y'; if (disc(7.5, 9.5, 5.5)(x, y)) return Math.hypot(x - 6, y - 8) < 2.5 ? 'y' : (x + y) % 5 === 0 ? 'O' : 'o'; return '.'; }),
    recipe: { id: 'fire_bomb', pattern: ['GBG', 'GGG'], key: { G: 'gunpowder', B: 'blaze_powder' }, count: 3 } },
  iceball: { name: 'Ice Ball', speed: 20, grav: 14, damage: 3, size: 0.2, color: '#bfe6ff', cd: 500, knock: 2, lore: ['\\\\white\\\\Damage: \\\\gold\\\\3', '\\\\aqua\\\\Shoves what it hits'],
    icon: tex({ i: '#bfe6ff', I: '#7fc4ee', w: '#ffffff' }, (x, y) => { if (!disc(7.5, 7.5, 6)(x, y)) return '.'; if (x + y < 10 && x + y > 7 && x < 8) return 'w'; return (x * 2 + y) % 5 === 0 ? 'I' : 'i'; }),
    recipe: { id: 'ice_ball', pattern: ['S', 'I', 'S'], key: { S: 'snowball', I: 'ice' }, count: 3 } },
  popper: { name: 'Confetti Popper', speed: 16, grav: 20, damage: 0, size: 0.18, color: '#ff4fa3', cd: 400, lore: ['\\\\white\\\\Pops into confetti. No harm done.'],
    icon: tex({ p: '#ff4fa3', y: '#ffe07a', b: '#4fa8ff', g: '#5fd66b', w: '#f2f2ec' }, (x, y) => { if (y > 3 && y < 13 && Math.abs(x - 7.5) < (y - 3) * 0.55 + 0.5) return (x + y) % 3 === 0 ? 'y' : 'p'; if (y <= 3 && (x * 7 + y * 3) % 11 === 0) return 'b'; if (y <= 3 && (x * 5 + y) % 9 === 0) return 'g'; return '.'; }),
    recipe: { id: 'confetti_popper', pattern: ['P', 'G'], key: { P: 'paper', G: 'gunpowder' }, count: 3 } },
};
for (const [key, t] of Object.entries(ITEMS)) {
  game.items.register({ id: 'throwables:' + key, name: t.name, maxStack: 16, hold: 'item', lore: ['\\\\gray\\\\Right-click to throw.'].concat(t.lore), icon: t.icon });
  game.recipes.register(Object.assign({ output: 'throwables:' + key }, t.recipe));
}
const IN_AIR = {};
const readyAt = {};
async function throwIt(key) {
  const t = ITEMS[key];
  const now = Date.now();
  if (now < (readyAt[key] || 0)) return;
  readyAt[key] = now + t.cd;
  const p = await game.player.get();
  if (p.mode !== 'creative') {
    if ((await game.player.countItem('throwables:' + key)) < 1) return;
    game.player.removeItem('throwables:' + key, 1);
  }
  game.sounds.play('throw');
  const spec = { x: p.eye.x + p.look.x * 0.6, y: p.eye.y + p.look.y * 0.6, z: p.eye.z + p.look.z * 0.6,
    vx: p.look.x * t.speed, vy: p.look.y * t.speed + (key === 'knife' || key === 'shuriken' ? 0.6 : 3), vz: p.look.z * t.speed,
    gravity: t.grav, damage: t.damage, knockback: t.knock || 1, lifetime: 5, explosion: t.explosion || 0, color: t.color, size: t.size };
  const id = await game.world.spawnProjectile(spec);
  IN_AIR[id] = key;
}
game.on('itemUse', (e) => {
  if (!e.item || e.item.indexOf('throwables:') !== 0) return;
  throwIt(e.item.slice(11));
});
game.on('projectileHit', (e) => {
  const key = IN_AIR[e.projectileId];
  if (!key) return;
  delete IN_AIR[e.projectileId];
  if (key === 'firebomb') {
    game.particles.spawn(e.x, e.y + 0.3, e.z, { color: '#ff7a1a', count: 30, speed: 4, size: 0.2, life: 0.7 });
    game.particles.spawn(e.x, e.y + 0.3, e.z, { color: '#ffd34a', count: 18, speed: 2.5, size: 0.14, life: 0.9 });
  } else if (key === 'iceball') {
    game.particles.spawn(e.x, e.y + 0.2, e.z, { color: '#dff3ff', count: 22, speed: 3, size: 0.12, life: 0.6 });
    game.sounds.play('glass');
  } else if (key === 'popper') {
    for (const c of ['#ff4fa3', '#ffe07a', '#4fa8ff', '#5fd66b']) game.particles.spawn(e.x, e.y + 0.4, e.z, { color: c, count: 12, speed: 4, size: 0.1, life: 1 });
    game.sounds.play('pop');
  } else {
    game.particles.spawn(e.x, e.y, e.z, { color: '#c8d0d8', count: 4, speed: 1.2 });
    game.sounds.play('arrowHit');
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
    id: 'jetpacks',
    name: 'Jetpacks',
    author: 'VibeBlox',
    official: true,
    description: 'Iron, gold and diamond jetpacks. Hold right-click with one in your hand to fly up; look down to sink slowly. Burns Jet Fuel (free in creative).',
    code: `// Jetpacks: hold right-click with a jetpack in your hand to fly. Steer with WASD, look straight down to sink gently.
// In survival each jetpack burns Jet Fuel (craft 4 from coal and redstone). Better jetpacks climb faster and sip less fuel.
const grid = () => Array.from({ length: 16 }, () => Array(16).fill('.'));
const rect = (g, x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (g[y + j] && x + i < 16) g[y + j][x + i] = c; };
const packIcon = (body, dark) => {
  const g = grid();
  rect(g, 3, 2, 4, 9, 'b'); rect(g, 9, 2, 4, 9, 'b');   // two tanks
  rect(g, 3, 2, 4, 1, 'B'); rect(g, 9, 2, 4, 1, 'B');
  rect(g, 6, 4, 4, 5, 'B');                             // the frame between them
  rect(g, 4, 11, 2, 2, 'n'); rect(g, 10, 11, 2, 2, 'n'); // nozzles
  rect(g, 4, 13, 2, 2, 'f'); rect(g, 10, 13, 2, 2, 'f'); // flames
  g[15][4] = 'F'; g[15][11] = 'F'; g[5][4] = 'w'; g[5][10] = 'w';
  return { palette: { b: body, B: dark, n: '#3a3a3a', f: '#ff8a1a', F: '#ffd23a', w: '#ffffff' }, pixels: g.map((r) => r.join('')) };
};
const fuelIcon = () => {
  const g = grid();
  rect(g, 4, 3, 8, 11, 'c'); rect(g, 4, 3, 8, 1, 'C'); rect(g, 6, 1, 4, 2, 'C');
  rect(g, 5, 6, 6, 5, 'r'); rect(g, 6, 7, 4, 3, 'R');
  return { palette: { c: '#5a5a62', C: '#2e2e34', r: '#c0221a', R: '#ff5a3a' }, pixels: g.map((r) => r.join('')) };
};

const PACKS = {
  iron: { name: 'Iron Jetpack', lift: 7, fuelEvery: 2000, body: '#c8c8c8', dark: '#7a7a7a', mat: 'iron_ingot' },
  gold: { name: 'Golden Jetpack', lift: 9, fuelEvery: 3000, body: '#f2c230', dark: '#a8800e', mat: 'gold_ingot' },
  diamond: { name: 'Diamond Jetpack', lift: 11, fuelEvery: 4500, body: '#4fd8e6', dark: '#1f8a9a', mat: 'diamond' },
};
game.items.register({ id: 'jetpacks:fuel', name: 'Jet Fuel', maxStack: 64, icon: fuelIcon(), lore: ['Burned by jetpacks'] });
game.recipes.register({ id: 'jet_fuel', pattern: ['C', 'R'], key: { C: 'coal', R: 'redstone' }, output: 'jetpacks:fuel', count: 4 });
for (const [key, j] of Object.entries(PACKS)) {
  game.items.register({ id: 'jetpacks:' + key, name: j.name, maxStack: 1, hold: 'one_hand', icon: packIcon(j.body, j.dark),
    lore: ['Hold right-click: fly up', 'Look straight down: sink slowly', 'One Jet Fuel every ' + (j.fuelEvery / 1000) + 's'] });
  game.recipes.register({ id: key + '_jetpack', pattern: ['M M', 'MRM', 'G G'], key: { M: j.mat, R: 'redstone', G: 'gunpowder' }, output: 'jetpacks:' + key });
}

let flying = null; // { key, timer, lastFuel, free }
function stop(soft) {
  if (!flying) return;
  game.scheduler.cancel(flying.timer);
  flying = null;
  if (soft) game.player.applyEffect('slow_falling', 2, 1); // a short glide when you let go
}
game.on('itemUse', async (e) => {
  const key = Object.keys(PACKS).find((k) => e.item === 'jetpacks:' + k);
  if (!key || flying) return;
  const p = await game.player.get();
  const free = p.mode === 'creative' || p.mode === 'spectator';
  if (!free && (await game.player.countItem('jetpacks:fuel')) < 1) { game.gui.toast('Out of Jet Fuel: craft it from coal and redstone'); return; }
  const j = PACKS[key];
  flying = { key, lastFuel: 0, free };
  flying.timer = game.scheduler.every(60, async () => {
    if (!flying) return;
    const q = await game.player.get();
    if (!q.heldItem || q.heldItem.item !== 'jetpacks:' + flying.key) { stop(true); return; }
    if (!flying.free && Date.now() - flying.lastFuel >= j.fuelEvery) {
      if ((await game.player.countItem('jetpacks:fuel')) < 1) { game.gui.toast('Out of Jet Fuel'); stop(true); return; }
      game.player.removeItem('jetpacks:fuel', 1);
      flying.lastFuel = Date.now();
    }
    const vy = q.look.y < -0.75 ? -2.5 : j.lift; // looking down: let it sink gently
    game.player.launch(0, vy, 0);
    game.particles.spawn(q.x, q.y + 0.3, q.z, { color: Math.random() < 0.5 ? '#ffb347' : '#ff6a1a', count: 3, speed: 1.2, size: 0.12, life: 0.35 });
    if (Math.random() < 0.15) game.particles.spawn(q.x, q.y + 0.2, q.z, { color: '#9a9a9a', count: 2, speed: 0.8, size: 0.18, life: 0.9 });
  });
  game.sounds.play('hiss');
});
game.on('itemUseEnd', (e) => { if (flying && e.item === 'jetpacks:' + flying.key) stop(true); });
game.on('playerDeath', () => stop(false));
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
    name: 'Moon and jungle dimensions',
    code: `// Two dimensions of your own. /moon: low gravity and stars. /jungle: hills, lakes, trees and flowers.
// /overworld brings you back. Change the numbers and run it again to reshape them.
await game.dimensions.create({
  id: 'moon', name: 'The Moon', type: 'hills',
  top: 'andesite', filler: 'stone', base: 'stone',
  height: 20, amplitude: 4, scale: 0.05,
  sky: '#000008', fog: '#10101a', light: 0.7,
  gravity: 0.25, stars: true, ores: true,
});
await game.dimensions.create({
  id: 'jungle', name: 'Jungle Hills', type: 'hills',
  top: 'grass', filler: 'dirt', base: 'stone', liquid: 'water', waterLevel: 20,
  height: 22, amplitude: 9, scale: 0.03,
  trees: 'jungle', treeChance: 0.04, plants: ['tall_grass', 'poppy', 'dandelion'], plantChance: 0.15,
  sky: '#7fd0ff', fog: '#cfefff', light: 1, clouds: true, ores: true,
});
game.commands.register('moon', 'Fly to the Moon', async () => {
  await game.dimensions.travel('moon');
  game.gui.title('The Moon', 'Jump!');
});
game.commands.register('jungle', 'Visit the Jungle Hills', async () => {
  await game.dimensions.travel('jungle');
  game.gui.title('Jungle Hills', '');
});
game.commands.register('overworld', 'Go back to the Overworld', () => game.dimensions.travel('overworld'));
game.chat('Type /moon or /jungle to visit your dimensions!');
`,
  },
  {
    name: 'Custom dimension',
    code: `// A custom dimension of floating sky islands. /islands takes you there,
// /overworld brings you back.
await game.dimensions.create({
  id: 'sky_islands', name: 'Sky Islands', type: 'islands',
  top: 'grass', filler: 'dirt', base: 'stone',
  trees: 'oak', treeChance: 0.03, plants: ['tall_grass', 'cornflower'],
  sky: '#8fd3ff', fog: '#d6f0ff', light: 1, clouds: true,
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
export const AI_PROMPT_VERSION = 7;

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
  ['schematics.paste', '(name, x, y, z, { rotate?, flipX?, flipZ?, skipAir? }?)', 'Paste a saved schematic (yours, or one that comes with a mod) so its origin lands on x, y, z. rotate is 0, 90, 180 or 270. Returns { placed, total, w, h, d }. Big builds go in over a moment.'],
  ['schematics.list', '()', 'Names of the schematics you can paste.'],
  ['schematics.info', '(name)', '{ name, w, h, d } for one schematic, or null.'],
  ['world.explode', '(x, y, z, power?)', 'Explosion that breaks blocks and hurts things. power 0.5-6.'],
  ['world.dropItem', '(x, y, z, item, count?)', 'Drop an item stack on the ground.'],
  ['world.getTime', '()', '0-24000 (0 sunrise, 6000 noon, 12000 sunset, 18000 midnight).'],
  ['world.setTime', '(time)', '"sunrise" | "day" | "noon" | "sunset" | "night" | "midnight" | 0-24000.'],
  ['world.getWeather', '()', '"clear", "rain", "snow" or "thunder".'],
  ['world.setWeather', '(weather)', '"clear" | "rain" | "snow". Snow weather puts snow on the ground (snowy grass, snow layers).'],
  ['world.raycast', '(origin?, direction?, maxDistance?, { entities, blocks, shot }?)', 'shot: true counts as a bullet (it can hit a Target block). Defaults to your eye and look direction. Returns null or { type:"block"|"entity", point:{x,y,z}, distance, block:{x,y,z,name}|null, entity:{id,type}|null }.'],
  ['world.spawnProjectile', '(spec) or (name, x, y, z, vx, vy, vz)', 'spec = { x, y, z, vx, vy, vz, gravity, damage, color, size, lifetime, explosion, knockback }. Returns an id and later fires the projectileHit event.'],
  ['world.removeProjectile', '(id)', 'Delete a projectile.'],
  ['world.getDimension', '()', 'Name of the current dimension.'],
  ['world.spawnParticles', '(type, x, y, z, count, spread, speed)', 'Miniblox style. type: explode, smoke, flame, crit, heart, portal, happyVillager, angryVillager, note.'],
  ['world.playSound', '(name, x, y, z, volume?, pitch?)', 'Miniblox style names (random.click, random.explode, ...) or VibeBlox names.'],
  ['world.getPlayersNear', '(x, y, z, radius)', 'Synchronous: player objects within the radius.'],
  ['world.getEntitiesNear', '(x, y, z, radius)', 'Synchronous: mobs within the radius, as { id, type, pos, health, maxHealth }.'],
  ['world.getEntities', '()', 'Synchronous: every mob.'],
  ['world.getSign', '(x, y, z)', 'The 4 lines of text on a sign (array of 4 strings; empty strings for blank lines).'],
  ['world.setSign', '(x, y, z, lines)', 'Write up to 4 lines (15 characters each) on a sign that is already placed. Returns true if there is a sign there.'],
  ['world.getHighestBlock', '(x, z)', 'The y of the highest block that is not air or water in that column.'],
  ['world.findBlock', '(block, x, y, z, radius?)', 'Nearest block of that kind within the radius (default 8, max 16): { x, y, z } or null.'],
  ['world.setAlwaysDay', '(on)', 'true keeps the sky bright all the time (same as the Manage Server switch).'],
  ['world.setWeatherCycle', '(on)', 'false keeps the weather exactly as it is now (same as the Manage Server switch).'],
  ['world.isDay', '()', 'Async: true between sunrise and sunset.'],
  ['world.sphere', '(x, y, z, radius, block, hollow?)', 'Build a ball of blocks (radius 1-14). hollow: true makes a shell.'],
  ['world.line', '(x1, y1, z1, x2, y2, z2, block)', 'Place a straight line of blocks.'],

  // ---- mobs ----
  ['entities.list', '()', '[{ id, type, x, y, z, health, maxHealth }] for every mob.'],
  ['entities.near', '(x, y, z, radius)', 'Mobs within the radius.'],
  ['entities.get', '(id)', 'One mob, or null.'],
  ['entities.spawn', '(type, x, y, z)', 'Types: pig, cow, chicken, zombie, skeleton, creeper, spider, ghast, piglin, villager, iron_golem. Returns its id (max 80 mobs).'],
  ['entities.remove', '(id)', 'Remove a mob.'],
  ['entities.damage', '(id, amount, knockback?)', 'Hurt a mob.'],
  ['entities.knockback', '(id, vx, vy, vz)', 'Fling a mob.'],
  ['entities.nearest', '(type|null, x, y, z, radius?)', 'The closest mob of that type (any type if null) within the radius (default 32), or null.'],
  ['entities.count', '(type?)', 'How many mobs there are (of one type, if given).'],
  ['entities.removeAll', '(type?)', 'Remove every mob (or every mob of one type). Returns how many.'],

  // ---- helpers ----
  ['util.distance', '(a, b)', 'Synchronous: distance between two {x, y, z} points.'],
  ['util.randomInt', '(min, max)', 'Synchronous: a whole number from min to max (both included).'],
  ['util.choice', '(list)', 'Synchronous: a random item from an array.'],
  ['util.shuffle', '(list)', 'Synchronous: a shuffled copy of an array.'],
  ['util.clamp', '(value, min, max)', 'Synchronous: keeps a number between min and max.'],
  ['util.lerp', '(a, b, t)', 'Synchronous: a number between a and b (t 0-1).'],
  ['util.formatTime', '(ms)', 'Synchronous: 83000 becomes "1:23".'],

  // ---- new items, blocks and recipes ----
  ['items.register', '({ id, name, maxStack, food, lore, hold, leftClick, icon })', 'id is "mymod:thing". hold: "item" | "one_hand" | "two_hands". leftClick: "use" makes left-click fire the itemAttack event instead of mining. icon = { pixels: [16 or 32 rows of characters], palette: { char: "#hex" } } where "." is see-through. lore is a list of lines (color codes work). food = hunger points restored on right-click.'],
  ['items.exists', '(name)', 'Synchronous: true if the item name is known.'],
  ['blocks.register', '({ id, name, shape, solid, drops, hardness, tier, hidden, texture, use })', 'id is "mymod:thing". use: true makes right-click fire the blockUse event (crouch + right-click still places blocks against it). shape: "cube" | "cross" (plants). drops: omit for itself, null for nothing, or an item name. texture works like icon. At most 40 custom blocks.'],
  ['recipes.register', '({ id, pattern, key, output, count, table })', 'pattern is up to 3 rows of 3 characters, key maps each character to an item name. Example: pattern ["III", " S ", " S "], key { I: "iron_ore", S: "stick" }. table: true requires a crafting table (default: needed when bigger than 2x2).'],

  // ---- effects, sound and screen ----
  ['particles.spawn', '(x, y, z, { color, count, speed, size, life })', 'A burst of particles. color is "#hex".'],
  ['particles.line', '(x1, y1, z1, x2, y2, z2, { color })', 'A line of particles (bullet tracers).'],
  ['sounds.play', '(name, x?, y?, z?)', 'Names: gunshot, reload, click, ding, pop, hurt, pickup, eat, bow, splash, teleport, throw, explode, land, hiss, arrowHit.'],
  ['gui.toast', '(text)', 'Short message above the hotbar.'],
  ['gui.flash', '(seconds)', 'Turns the screen white, then fades back over that many seconds (flashbangs).'],
  ['gui.title', '(text, subtitle?, seconds?)', 'Big title in the middle of the screen. Colour codes and moving effects work, e.g. game.gui.title("\\green\\\\shiny\\ Hello world!", "\\rainbow\\Welcome"). Codes: colours (\\red\\ \\gold\\ \\#ff8800\\), \\bold\\ \\italic\\ \\underline\\ \\strike\\, effects \\shiny\\ \\rainbow\\ \\neon\\ \\toxic\\ \\pristine\\ \\glitched\\ \\wave\\ \\shake\\ \\pulse\\, fonts \\serif\\ \\mono\\ \\cursive\\ \\comic\\ \\impact\\ \\pixel\\ \\retro\\, \\reset\\.'],
  ['commands.run', '(text)', 'Run a game command like "/title @p \\gold\\ Hi" (title, say, effect, give, summon, tp, time, weather, playsound, rank). Returns { success, output }.'],
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
  ['dimensions.create', '({ id, name, type, top, filler, base, liquid, sky, fog, light, height, amplitude, scale, waterLevel, trees, treeChance, ores, plants, plantChance, gravity, stars, clouds })', 'Make your own dimension. type: "flat" | "void" | "islands" | "caves" | "hills" | "mountains". top/filler/base/liquid are block names. sky and fog are "#hex"; light is 0-1. hills/mountains: height = ground level (4-50), amplitude = how tall the bumps are (0-40), scale = how wide (0.002-0.2, smaller is wider). waterLevel: liquid fills hollows up to this height. trees: "oak" | "birch" | "spruce" | "jungle" | "none", treeChance 0-0.2. ores: true adds coal/iron/gold/diamond. plants: block names dotted on the ground (plantChance 0-0.5). gravity: 1 normal, 0.2 moon-like, up to 3. stars/clouds: true shows them. Creating the same id again updates it.'],
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
  blockUse: { x, y, z, block }               right-click on a block registered with use: true (block is its id, e.g. "mymod:thing")
  targetHit: { x, y, z }                     an arrow, bullet or thrown item hit a Target block (it gives redstone power for a moment)
  playerHit: { target: { id, type }, damage } the player hit a mob
  playerDamage: { amount, cause }   playerDeath: { cause }   playerRespawn: {}
  entityDeath: { id, type, x, y, z }
  projectileHit: { id, x, y, z, entity: { id, type } | null, block: { x, y, z } | null }
  dimensionChange: { dimension }
  throw: { item, x, y, z }                   the player threw an egg or a snowball
  eggHatch: { x, y, z }                      a thrown egg hatched into a baby chicken
Miniblox-style names also work: playerInteract (button "left"/"right"), entityDamageByEntity, playerJoin, scriptLoad.
There is also a global print(text) that writes to the script output.`;

const NAMESPACE_TITLES: Record<string, string> = {
  '': 'GENERAL', player: 'PLAYER', world: 'WORLD', entities: 'MOBS', items: 'ITEMS', blocks: 'BLOCKS', recipes: 'RECIPES',
  particles: 'PARTICLES', sounds: 'SOUNDS', gui: 'SCREEN', commands: 'COMMANDS', storage: 'SAVING', scheduler: 'TIMERS',
  dimensions: 'DIMENSIONS', stats: 'COUNTERS (Miniblox style)', playerData: 'COUNTERS (Miniblox style)', scoreboard: 'COUNTERS (Miniblox style)', mods: 'PACKS', util: 'HELPERS',
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
- Block and item names are lowercase with underscores ("stone", "iron_ore", "white_concrete", "diamond_sword"); modded ones look like "wands:fire". Use only names from the BLOCK NAMES / ITEM NAMES lists in the request.
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
  const hit = await game.world.raycast(null, null, 60, { shot: true });
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
