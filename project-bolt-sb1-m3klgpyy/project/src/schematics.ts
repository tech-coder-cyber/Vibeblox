// Schematics: a box of blocks you can save, share as a file and paste anywhere (rotated or flipped).
// This file is pure data handling (no game engine in here), so it is easy to test and safe to feed files from anyone.
//
// A grid is stored y-major: index = (y * d + z) * w + x, so every layer is one run of numbers.
// The saved form uses a palette (the block ids that are used) and run-length encoding.

export type Schematic = {
  v: 1;
  name: string;
  w: number; h: number; d: number;
  /** The point inside the box that lands where you paste (where you stood when you saved it). */
  ox: number; oy: number; oz: number;
  /** Built-in blocks are numbers; blocks from mods are their key ("mymod:ruby_block"). */
  palette: Array<number | string>;
  /** [paletteIndex, count, paletteIndex, count, ...] */
  runs: number[];
  created: number;
};
export type Grid = { w: number; h: number; d: number; ids: Int32Array; ox: number; oy: number; oz: number };

export const SCHEM_LIMITS = { maxDim: 128, maxVolume: 131072, maxCount: 60, maxStoreBytes: 3_000_000, nameMax: 32, maxPalette: 4096 };
export const SCHEM_MAGIC = 'vibeblox-schematic';

export const gridIndex = (g: { w: number; d: number }, x: number, y: number, z: number) => (y * g.d + z) * g.w + x;

/** A name people can type: letters, numbers, spaces, dashes and underscores. */
export function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const n = raw.trim().replace(/\s+/g, ' ');
  if (!n || n.length > SCHEM_LIMITS.nameMax) return null;
  return /^[A-Za-z0-9 _.-]+$/.test(n) ? n : null;
}
export const nameKey = (n: string) => n.trim().toLowerCase();

export function volumeError(w: number, h: number, d: number): string | null {
  const m = SCHEM_LIMITS.maxDim;
  if (![w, h, d].every((n) => Number.isInteger(n) && n >= 1)) return 'That box is empty';
  if (w > m || h > m || d > m) return `A schematic can be at most ${m} blocks in each direction (this one is ${w} x ${h} x ${d})`;
  if (w * h * d > SCHEM_LIMITS.maxVolume) return `A schematic can hold at most ${SCHEM_LIMITS.maxVolume.toLocaleString()} blocks (this one is ${(w * h * d).toLocaleString()})`;
  return null;
}

/** Make the saved form of a grid. `keyOf` turns a block id into what is saved (a number, or a key for mod blocks). */
export function encodeSchematic(name: string, g: Grid, keyOf: (id: number) => number | string, now = Date.now()): Schematic {
  const palette: Array<number | string> = [];
  const index = new Map<number, number>();
  const runs: number[] = [];
  let last = -1, count = 0;
  for (let i = 0; i < g.ids.length; i++) {
    const id = g.ids[i];
    let p = index.get(id);
    if (p === undefined) { p = palette.length; palette.push(keyOf(id)); index.set(id, p); }
    if (p === last) count++;
    else { if (count) runs.push(last, count); last = p; count = 1; }
  }
  if (count) runs.push(last, count);
  return { v: 1, name, w: g.w, h: g.h, d: g.d, ox: g.ox, oy: g.oy, oz: g.oz, palette, runs, created: now };
}

/** Check anything that claims to be a schematic (from a file or from storage). Returns the clean schematic, or why not. */
export function validateSchematic(raw: unknown): Schematic | string {
  if (!raw || typeof raw !== 'object') return 'That is not a schematic';
  const s = raw as Record<string, unknown>;
  if (s.v !== 1) return 'This schematic is from a newer version of the game';
  const name = sanitizeName(s.name);
  if (!name) return 'The schematic has no usable name';
  const { w, h, d } = s as { w: number; h: number; d: number };
  const ve = volumeError(w, h, d);
  if (ve) return ve;
  const palette = s.palette;
  if (!Array.isArray(palette) || palette.length < 1 || palette.length > SCHEM_LIMITS.maxPalette) return 'The block list is damaged';
  for (const p of palette) {
    if (typeof p === 'number') { if (!Number.isInteger(p) || p < 0 || p > 65535) return 'The block list is damaged'; }
    else if (typeof p !== 'string' || p.length > 80) return 'The block list is damaged';
  }
  const runs = s.runs;
  if (!Array.isArray(runs) || runs.length % 2 !== 0 || runs.length > SCHEM_LIMITS.maxVolume * 2) return 'The block data is damaged';
  let total = 0;
  for (let i = 0; i < runs.length; i += 2) {
    const p = runs[i], c = runs[i + 1];
    if (!Number.isInteger(p) || p < 0 || p >= palette.length || !Number.isInteger(c) || c < 1) return 'The block data is damaged';
    total += c;
    if (total > w * h * d) return 'The block data is damaged';
  }
  if (total !== w * h * d) return 'The block data is damaged';
  const cl = (v: unknown, max: number) => (Number.isInteger(v) ? Math.max(0, Math.min(max - 1, v as number)) : 0);
  return { v: 1, name, w, h, d, ox: cl(s.ox, w), oy: cl(s.oy, h), oz: cl(s.oz, d), palette: palette.slice() as Array<number | string>, runs: runs.slice() as number[], created: Number.isFinite(s.created) ? (s.created as number) : 0 };
}

/**
 * Unpack a schematic. `idOf` turns a saved key back into a block id on this game (null = unknown mod block, which becomes air).
 * Returns the grid and how many blocks had to be skipped.
 */
export function decodeSchematic(s: Schematic, idOf: (key: string) => number | null): { grid: Grid; missing: number; missingKeys: string[] } {
  const ids = new Int32Array(s.w * s.h * s.d);
  const real = s.palette.map((p) => (typeof p === 'number' ? p : idOf(p)));
  let at = 0, missing = 0;
  const missingKeys = new Set<string>();
  for (let i = 0; i < s.runs.length; i += 2) {
    const id = real[s.runs[i]], c = s.runs[i + 1];
    if (id === null) { missing += c; missingKeys.add(String(s.palette[s.runs[i]])); at += c; continue; }
    ids.fill(id, at, at + c);
    at += c;
  }
  return { grid: { w: s.w, h: s.h, d: s.d, ids, ox: s.ox, oy: s.oy, oz: s.oz }, missing, missingKeys: [...missingKeys] };
}

/** Turn the grid a quarter turn clockwise (seen from above), `quarters` times. `mapId(id, q)` turns facing blocks (doors, stairs...). */
export function rotateGrid(g: Grid, quarters: number, mapId: (id: number, quarters: number) => number = (id) => id): Grid {
  const q = ((Math.round(quarters) % 4) + 4) % 4;
  if (q === 0) return g;
  const odd = q % 2 === 1;
  const w2 = odd ? g.d : g.w, d2 = odd ? g.w : g.d;
  const ids = new Int32Array(g.ids.length);
  const xz = (x: number, z: number): [number, number] => (q === 1 ? [g.d - 1 - z, x] : q === 2 ? [g.w - 1 - x, g.d - 1 - z] : [z, g.w - 1 - x]);
  for (let y = 0; y < g.h; y++) for (let z = 0; z < g.d; z++) for (let x = 0; x < g.w; x++) {
    const [nx, nz] = xz(x, z);
    ids[(y * d2 + nz) * w2 + nx] = mapId(g.ids[(y * g.d + z) * g.w + x], q);
  }
  const [ox, oz] = xz(g.ox, g.oz);
  return { w: w2, h: g.h, d: d2, ids, ox, oy: g.oy, oz };
}

/** Mirror the grid along an axis ('x' swaps east and west, 'z' swaps north and south, 'y' turns it upside down). */
export function flipGrid(g: Grid, axis: 'x' | 'y' | 'z', mapId: (id: number, axis: 'x' | 'z') => number = (id) => id): Grid {
  const ids = new Int32Array(g.ids.length);
  for (let y = 0; y < g.h; y++) for (let z = 0; z < g.d; z++) for (let x = 0; x < g.w; x++) {
    const nx = axis === 'x' ? g.w - 1 - x : x, ny = axis === 'y' ? g.h - 1 - y : y, nz = axis === 'z' ? g.d - 1 - z : z;
    const id = g.ids[(y * g.d + z) * g.w + x];
    ids[(ny * g.d + nz) * g.w + nx] = axis === 'y' ? id : mapId(id, axis);
  }
  return { w: g.w, h: g.h, d: g.d, ids, ox: axis === 'x' ? g.w - 1 - g.ox : g.ox, oy: axis === 'y' ? g.h - 1 - g.oy : g.oy, oz: axis === 'z' ? g.d - 1 - g.oz : g.oz };
}

/** The blocks to place, with the grid's origin point landing on (ax, ay, az). */
export function gridToList(g: Grid, ax: number, ay: number, az: number, skipAir = false): Array<[number, number, number, number]> {
  const out: Array<[number, number, number, number]> = [];
  for (let y = 0; y < g.h; y++) for (let z = 0; z < g.d; z++) for (let x = 0; x < g.w; x++) {
    const id = g.ids[(y * g.d + z) * g.w + x];
    if (skipAir && id === 0) continue;
    out.push([ax - g.ox + x, ay - g.oy + y, az - g.oz + z, id]);
  }
  return out;
}

export function countBlocks(g: Grid): number { let n = 0; for (let i = 0; i < g.ids.length; i++) if (g.ids[i] !== 0) n++; return n; }

// ---------------- Files ----------------
export function schematicToFile(s: Schematic): string {
  return JSON.stringify({ magic: SCHEM_MAGIC, ...s });
}
export function parseSchematicFile(text: string): Schematic | string {
  if (typeof text !== 'string' || text.length > 12_000_000) return 'That file is too big to be a schematic';
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return 'That file is not a schematic'; }
  if (!raw || typeof raw !== 'object' || (raw as Record<string, unknown>).magic !== SCHEM_MAGIC) return 'That file is not a VibeBlox schematic';
  return validateSchematic(raw);
}

// ---------------- The library (kept in the browser) ----------------
export type KeyValueStore = { getItem(k: string): string | null; setItem(k: string, v: string): void };
const LIB_KEY = 'vb-schematics';

export function loadLibrary(store: KeyValueStore | null = defaultStore()): Record<string, Schematic> {
  const out: Record<string, Schematic> = {};
  try {
    const raw = store?.getItem(LIB_KEY);
    if (!raw) return out;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return out;
    for (const v of Object.values(parsed as Record<string, unknown>)) {
      const s = validateSchematic(v);
      if (typeof s !== 'string') out[nameKey(s.name)] = s;
    }
  } catch { /* storage blocked or damaged: start empty */ }
  return out;
}
/** Returns an error message, or null when it was saved. */
export function saveLibrary(lib: Record<string, Schematic>, store: KeyValueStore | null = defaultStore()): string | null {
  if (!store) return 'This browser will not let the game save schematics';
  if (Object.keys(lib).length > SCHEM_LIMITS.maxCount) return `You can keep up to ${SCHEM_LIMITS.maxCount} schematics. Delete or export some first.`;
  const text = JSON.stringify(lib);
  if (text.length > SCHEM_LIMITS.maxStoreBytes) return 'Your schematics take up too much space. Export (download) the big ones and delete them here.';
  try { store.setItem(LIB_KEY, text); } catch { return 'The browser has no room left to save this. Export (download) some schematics and delete them here.'; }
  return null;
}
function defaultStore(): KeyValueStore | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}
export function libraryBytes(lib: Record<string, Schematic>): number { return JSON.stringify(lib).length; }
export function describe(s: { w: number; h: number; d: number }): string { return `${s.w} x ${s.h} x ${s.d}`; }
