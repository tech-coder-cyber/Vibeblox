// Private servers: a saved list of server addresses, and the pack of files people unpack to host their own.
import { makeZip, type ZipEntry } from './zip';

export type PrivateServer = { name: string; address: string };
const KEY = 'vb-private-servers';
export const MAX_PRIVATE_SERVERS = 30;

/** Cleans a saved list: at most 30 entries, short names, addresses without spaces, no repeats. */
export function cleanServers(v: unknown): PrivateServer[] {
  if (!Array.isArray(v)) return [];
  const out: PrivateServer[] = [];
  const seen = new Set<string>();
  for (const e of v) {
    if (!e || typeof e !== 'object') continue;
    const name = String((e as PrivateServer).name ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 32);
    const address = String((e as PrivateServer).address ?? '').trim().slice(0, 120);
    if (!name || !address || /\s/.test(address) || seen.has(address.toLowerCase())) continue;
    seen.add(address.toLowerCase());
    out.push({ name, address });
    if (out.length >= MAX_PRIVATE_SERVERS) break;
  }
  return out;
}
export function loadServers(): PrivateServer[] {
  try { return cleanServers(JSON.parse(localStorage.getItem(KEY) ?? '[]')); } catch { return []; }
}
export function saveServers(list: PrivateServer[]) {
  try { localStorage.setItem(KEY, JSON.stringify(cleanServers(list))); } catch { /* storage may be blocked */ }
}
/** Checks an address typed by hand. Returns an error message, or null when it looks fine. */
export function checkAddress(address: string): string | null {
  const a = address.trim();
  if (!a) return 'Type the server address';
  if (/\s/.test(a)) return 'An address has no spaces';
  const bare = a.replace(/^(wss?|https?):\/\//i, '').replace(/\/.*$/, '');
  if (!/^(\[[0-9a-f:]+\]|[a-z0-9]([a-z0-9.-]*[a-z0-9])?)(:\d{1,5})?$/i.test(bare)) return 'That does not look like a server address, e.g. play.example.com or localhost:8080';
  const port = /:(\d{1,5})$/.exec(bare);
  if (port && (Number(port[1]) < 1 || Number(port[1]) > 65535)) return 'The port must be between 1 and 65535';
  return null;
}

export type ServerPackOptions = { name: string; port: number; maxPlayers: number; seed: string; worldType: 'default' | 'superflat'; mode: 'survival' | 'creative' | 'adventure'; experimental: boolean };
export const DEFAULT_PACK: ServerPackOptions = { name: 'My VibeBlox Server', port: 8080, maxPlayers: 18, seed: '', worldType: 'default', mode: 'survival', experimental: false };

export function cleanPackOptions(o: Partial<ServerPackOptions>): ServerPackOptions {
  const port = Math.floor(Number(o.port));
  const max = Math.floor(Number(o.maxPlayers));
  const seedNum = String(o.seed ?? '').trim();
  return {
    name: String(o.name ?? DEFAULT_PACK.name).replace(/[^\w .'-]/g, '').trim().slice(0, 40) || DEFAULT_PACK.name,
    port: Number.isFinite(port) && port >= 1 && port <= 65535 ? port : DEFAULT_PACK.port,
    maxPlayers: Number.isFinite(max) ? Math.min(100, Math.max(1, max)) : DEFAULT_PACK.maxPlayers,
    seed: /^-?\d{1,10}$/.test(seedNum) ? seedNum : '',
    worldType: o.worldType === 'superflat' ? 'superflat' : 'default',
    mode: o.mode === 'creative' || o.mode === 'adventure' ? o.mode : 'survival',
    experimental: !!o.experimental,
  };
}

/** The files of the server pack (server.js is passed in because it is big and loaded only when needed). */
export function buildServerFiles(opts: Partial<ServerPackOptions>, serverJs: string): ZipEntry[] {
  const o = cleanPackOptions(opts);
  const env: Array<[string, string]> = [['PORT', String(o.port)], ['MAX_PLAYERS', String(o.maxPlayers)], ['WORLD_TYPE', o.worldType], ['DEFAULT_MODE', o.mode]];
  if (o.seed) env.push(['SEED', o.seed]);
  if (o.experimental) env.push(['EXPERIMENTAL', '1']);
  const bat = [
    '@echo off', `title ${o.name}`, 'cd /d "%~dp0"',
    ...env.map(([k, v]) => `set ${k}=${v}`),
    'where node >nul 2>nul', 'if errorlevel 1 (', '  echo Node.js is not installed. Get it from https://nodejs.org (the LTS version), then run this again.', '  pause', '  exit /b 1', ')',
    `echo Starting ${o.name} on port ${o.port}. Join it in the game with: localhost:${o.port}`, 'node server.js', 'pause', '',
  ].join('\r\n');
  const sh = [
    '#!/bin/sh', 'cd "$(dirname "$0")"',
    ...env.map(([k, v]) => `export ${k}=${v}`),
    'if ! command -v node >/dev/null 2>&1; then echo "Node.js is not installed. Get it from https://nodejs.org (the LTS version), then run this again."; exit 1; fi',
    `echo "Starting ${o.name} on port ${o.port}. Join it in the game with: localhost:${o.port}"`, 'exec node server.js', '',
  ].join('\n');
  const readme = [
    `${o.name}`,
    '='.repeat(Math.max(8, o.name.length)),
    '',
    'This is your own private VibeBlox server. It keeps its world in world.json next to server.js,',
    'so the world is still there after you stop and start it.',
    '',
    '1. Install Node.js 18 or newer (free): https://nodejs.org  (pick the LTS download).',
    '2. Unpack this folder anywhere.',
    '3. Start it:',
    '     Windows:      double-click start.bat',
    '     Mac / Linux:  open a terminal in this folder and run   sh start.sh',
    `4. Open VibeBlox, go to the Servers page and join:   localhost:${o.port}`,
    '   (Or add it to "My private servers" so it is one click next time.)',
    '',
    'PLAYING WITH FRIENDS',
    'The game page is on https, so a friend can only join through a secure address (wss://).',
    'Pick one of these:',
    ' - A tunnel (easiest, no router settings): run a free tunnel such as Cloudflare Tunnel',
    `   ("cloudflared tunnel --url http://localhost:${o.port}"), playit.gg or ngrok. It gives you an https address;`,
    '   your friends type that address (without https://) in the Servers page.',
    ' - A real server (always on): rent or host a small Linux machine, put Caddy in front of the server for https,',
    '   and point a domain at it. The steps are the same as hosting on Oracle Cloud; the guide is in the VibeBlox GitHub repo (server/ORACLE_SETUP.md).',
    '',
    'CHANGING THINGS',
    'Open start.bat (or start.sh) in a text editor. The lines that start with "set" / "export" are the settings:',
    '  PORT           the port to listen on',
    '  MAX_PLAYERS    how many players can be on at once',
    '  WORLD_TYPE     default or superflat (only used when the world is first made)',
    '  DEFAULT_MODE   survival, creative or adventure',
    '  SEED           a whole number for the world seed (leave out for a random one)',
    '  EXPERIMENTAL   1 turns on early-access features (only when the world is first made)',
    'To start a fresh world, stop the server and delete world.json.',
    '',
    'The host of the server is the first player to join; they can open Manage Server in the game menu to change the rules.',
    'In the game, hold Tab to see who is online. Keep this server file up to date: when VibeBlox updates,',
    'download a new server pack, and replace server.js (keep your world.json).',
    '',
  ].join('\n');
  const pkg = JSON.stringify({ name: 'vibeblox-server', version: '1.0.0', private: true, description: o.name, main: 'server.js', scripts: { start: 'node server.js' }, engines: { node: '>=18' } }, null, 2) + '\n';
  const dir = 'vibeblox-server/';
  return [
    { name: dir + 'README.txt', data: readme },
    { name: dir + 'server.js', data: serverJs },
    { name: dir + 'start.bat', data: bat },
    { name: dir + 'start.sh', data: sh, executable: true },
    { name: dir + 'package.json', data: pkg },
  ];
}
export function buildServerZip(opts: Partial<ServerPackOptions>, serverJs: string): Uint8Array {
  return makeZip(buildServerFiles(opts, serverJs));
}
