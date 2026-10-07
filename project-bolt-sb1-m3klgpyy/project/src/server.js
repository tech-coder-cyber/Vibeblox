// VibeBlox multiplayer server
// ---------------------------------------------------------------
// Zero dependencies: just Node.js 18+ (no npm install needed).
// Every player generates the world from the same seed, so this server
// only has to share what CHANGES: block edits, player positions, chat,
// and the time of day. Block edits are saved to world.json so the
// world survives restarts.
//
// Settings (environment variables, all optional):
//   PORT=8080  MAX_PLAYERS=20  SEED=12345  WORLD_TYPE=default|superflat
//   DEFAULT_MODE=survival|creative|adventure  WORLD_FILE=./world.json
//   WEATHER_CYCLE=1   (0 = the weather only changes when the host changes it)
//   EXPERIMENTAL=1    (a NEW world gets experimental features; fixed once the world exists)
'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8080);
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS || 20);
const WORLD_FILE = process.env.WORLD_FILE || path.join(__dirname, 'world.json');
const PROTOCOL = 11; // must match PROTOCOL_VERSION in the game
const DAY_LENGTH = 600; // seconds, must match the game
const MAX_FRAME = 64 * 1024; // biggest message a client may send
const VALID_MODES = ['survival', 'creative', 'adventure'];

// ---------------- World state ----------------
// Server rules the host can change from Manage Server (everyone gets them)
const DEFAULT_SETTINGS = { difficulty: 'normal', keepInventory: false, scripts: true, mods: true, commands: true };
const DIFFICULTIES = ['peaceful', 'easy', 'normal', 'hard'];
const WEATHERS = ['clear', 'rain', 'snow'];
const WEATHER_CYCLE = process.env.WEATHER_CYCLE !== '0';
function loadWorld() {
  try {
    const w = JSON.parse(fs.readFileSync(WORLD_FILE, 'utf8'));
    console.log(`Loaded ${WORLD_FILE}: seed ${w.seed}, ${Object.keys(w.changes || {}).length} block edits`);
    return { seed: w.seed, worldType: w.worldType || 'default', mode: w.mode || 'survival', changes: w.changes || {}, time: w.time ?? 0.02, settings: { ...DEFAULT_SETTINGS, ...(w.settings || {}) }, bans: Array.isArray(w.bans) ? w.bans : [], weather: WEATHERS.includes(w.weather) ? w.weather : 'clear', experimental: !!w.experimental };
  } catch {
    const seed = process.env.SEED ? Number(process.env.SEED) : 1 + Math.floor(Math.random() * 2_000_000_000);
    const worldType = process.env.WORLD_TYPE === 'superflat' ? 'superflat' : 'default';
    const mode = VALID_MODES.includes(process.env.DEFAULT_MODE) ? process.env.DEFAULT_MODE : 'survival';
    console.log(`Created a new world: seed ${seed}, ${worldType}, ${mode}`);
    const experimental = process.env.EXPERIMENTAL === '1';
    return { seed, worldType, mode, changes: {}, time: 0.02, settings: { ...DEFAULT_SETTINGS }, bans: [], weather: 'clear', experimental };
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
}
let nextId = 1;

function broadcast(obj, exceptId) {
  for (const p of players.values()) if (p.joined && p.id !== exceptId) p.conn.send(obj);
}

function system(text) {
  broadcast({ t: 'system', text });
}

function cleanName(raw, id) {
  let name = String(raw || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
  if (name.length < 3) name = 'Player' + id;
  const taken = new Set([...players.values()].filter((p) => p.joined).map((p) => p.name.toLowerCase()));
  let final = name, n = 2;
  while (taken.has(final.toLowerCase())) final = (name.slice(0, 13) + n++);
  return final;
}

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const int = (v) => Number.isInteger(v);
const validBlock = (x, y, z, b) =>
  int(x) && int(y) && int(z) && int(b) && y >= 0 && y < 64 &&
  Math.abs(x) < 30_000_000 && Math.abs(z) < 30_000_000 && ((b >= 0 && b < 100) || (b >= 1000 && b < 1200)); // 1000-1199: newer blocks

function handle(p, msg) {
  if (!p.joined && msg.t !== 'hello') return;
  switch (msg.t) {
    case 'hello': {
      if (p.joined) return;
      if (msg.version !== PROTOCOL) return p.conn.close(4000, 'Your game version does not match this server');
      if ([...players.values()].filter((o) => o.joined).length >= MAX_PLAYERS) return p.conn.close(4001, 'Server is full');
      p.name = cleanName(msg.name, p.id);
      if (world.bans.includes(p.name.toLowerCase())) return p.conn.close(4003, 'You are banned from this server');
      p.joined = true;
      p.joinedAt = Date.now();
      if (hostId === null || !players.get(hostId)?.joined) hostId = p.id;
      const others = [...players.values()].filter((o) => o.joined && o.id !== p.id)
        .map((o) => ({ id: o.id, name: o.name, x: o.x, y: o.y, z: o.z, yaw: o.yaw, pitch: o.pitch, mode: o.mode, look: o.look }));
      const changes = Object.entries(world.changes).map(([k, b]) => {
        const [x, y, z] = k.split(',').map(Number);
        return [x, y, z, b];
      });
      p.conn.send({ t: 'welcome', id: p.id, name: p.name, seed: world.seed, worldType: world.worldType, mode: world.mode, time: currentTime(), changes, players: others, hostId, settings: world.settings, weather: world.weather, experimental: !!world.experimental });
      broadcast({ t: 'join', id: p.id, name: p.name }, p.id);
      system(`${p.name} joined the game`);
      console.log(`+ ${p.name} joined (${players.size} connected)`);
      return;
    }
    case 'settings': {
      if (p.id !== hostId) return; // only the host
      const s = msg.settings || {};
      const next = { ...world.settings };
      if (DIFFICULTIES.includes(s.difficulty)) next.difficulty = s.difficulty;
      for (const k of ['keepInventory', 'scripts', 'mods', 'commands']) if (typeof s[k] === 'boolean') next[k] = s[k];
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
      p.held = Number.isInteger(msg.held) && msg.held >= 0 && msg.held < 1000 ? msg.held : 0; // item id in hand
      p.act = Number.isInteger(msg.act) ? msg.act & 15 : 0; // swinging / aiming / drawing a bow / blocking
      p.moved = true;
      return;
    }
    case 'look': {
      // Skin and cape names only (the game draws them); anything odd is ignored
      const ok = (v) => typeof v === 'string' && /^[a-z0-9_]{1,24}$/.test(v);
      if (!ok(msg.skin) || !ok(msg.cape)) return;
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
    case 'chat': {
      const text = typeof msg.text === 'string' ? msg.text.trim().slice(0, 256) : '';
      if (!text) return;
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
  res.end(`VibeBlox server is running. Players online: ${online}/${MAX_PLAYERS}\n`);
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
    msgsThisSecond: 0, blocksThisSecond: 0,
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
    if (now - p.conn.lastSeen > 60_000) p.conn.close(4003, 'Timed out');
  }
}, 1000);
setInterval(() => { for (const p of players.values()) p.conn.ping(); }, 20_000);
// Keep everyone's day/night clock in step
setInterval(() => broadcast({ t: 'time', time: currentTime() }), 30_000);

server.listen(PORT, () => console.log(`VibeBlox server listening on port ${PORT}`));
