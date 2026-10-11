// The schematic data model: a Grid (what's in memory while you're copying/pasting) and a Schematic
// (what's saved to your library or exported as a .vbschem file). Kept apart from schemCommands.ts
// so the format and storage can be tested on their own, without a browser.

export type Grid = {
  w: number; h: number; d: number;
  /** Block ids, length w*h*d, ordered y outer, then z, then x: index = (y*d + z)*w + x. */
  ids: Int32Array;
  /** Where the player stood when this was copied/loaded, as an offset inside the box. */
  ox: number; oy: number; oz: number;
};

/** A palette entry is a numeric id for a built-in block, or a string key for a mod block (so it survives even if the id numbers change). */
type PaletteEntry = number | string;

export type Schematic = {
  name: string;
  w: number; h: number; d: number;
  ox: number; oy: number; oz: number;
  palette: PaletteEntry[];
  /** Index into palette for each cell, same order as Grid.ids. */
  cells: number[];
};

export const SCHEM_LIMITS = {
  nameMax: 32,
  maxCount: 40,
  maxDim: 100,
  maxVolume: 200_000,
  maxBytes: 4_000_000,
} as const;

const AIR = 0;
const STORE_KEY = 'vb-schematics';
const FILE_MAGIC = 'vibeblox-schematic';
const FILE_VERSION = 1;

function idx(w: number, d: number, x: number, y: number, z: number): number {
  return (y * d + z) * w + x;
}

export function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function sanitizeName(raw: string): string | null {
  const s = raw.replace(/[^A-Za-z0-9 _-]/g, '').trim().slice(0, SCHEM_LIMITS.nameMax);
  return s.length ? s : null;
}

export function volumeError(w: number, h: number, d: number): string | null {
  if (w <= 0 || h <= 0 || d <= 0) return 'That selection is empty.';
  if (w > SCHEM_LIMITS.maxDim || h > SCHEM_LIMITS.maxDim || d > SCHEM_LIMITS.maxDim) {
    return `That box is too big: no side can be over ${SCHEM_LIMITS.maxDim} blocks.`;
  }
  if (w * h * d > SCHEM_LIMITS.maxVolume) {
    return `That box is too big: ${(w * h * d).toLocaleString()} blocks is over the ${SCHEM_LIMITS.maxVolume.toLocaleString()} limit.`;
  }
  return null;
}

export function countBlocks(g: Grid): number {
  let n = 0;
  for (let i = 0; i < g.ids.length; i++) if (g.ids[i] !== AIR) n++;
  return n;
}

export function describe(s: { w: number; h: number; d: number }): string {
  return `${s.w} x ${s.h} x ${s.d}`;
}

/** Absolute-position block list for pasting: [x, y, z, id] for every cell (optionally skipping air). */
export function gridToList(g: Grid, atx: number, aty: number, atz: number, skipAir?: boolean): Array<[number, number, number, number]> {
  const out: Array<[number, number, number, number]> = [];
  for (let y = 0; y < g.h; y++) {
    for (let z = 0; z < g.d; z++) {
      for (let x = 0; x < g.w; x++) {
        const id = g.ids[idx(g.w, g.d, x, y, z)];
        if (skipAir && id === AIR) continue;
        out.push([atx + (x - g.ox), aty + (y - g.oy), atz + (z - g.oz), id]);
      }
    }
  }
  return out;
}

/** Turns the grid `quarters` * 90 degrees clockwise, seen from above (around the Y axis). */
export function rotateGrid(g: Grid, quarters: number, rotateId: (id: number, quarters: number) => number): Grid {
  const q = ((quarters % 4) + 4) % 4;
  if (q === 0) return g;
  let cur = g;
  for (let n = 0; n < q; n++) {
    const { w, h, d } = cur;
    const nw = d, nd = w;
    const ids = new Int32Array(nw * h * nd);
    for (let y = 0; y < h; y++) {
      for (let z = 0; z < d; z++) {
        for (let x = 0; x < w; x++) {
          const id = cur.ids[idx(w, d, x, y, z)];
          // (x, z) -> (d-1-z, x) for a clockwise quarter turn
          const nx = d - 1 - z, nz = x;
          ids[idx(nw, nd, nx, y, nz)] = id === AIR ? AIR : rotateId(id, 1);
        }
      }
    }
    const ox = cur.d - 1 - cur.oz, oz = cur.ox;
    cur = { w: nw, h, d: nd, ids, ox, oy: cur.oy, oz };
  }
  return cur;
}

/** Mirrors the grid along x (east/west) or z (north/south). */
export function flipGrid(g: Grid, axis: 'x' | 'y' | 'z', mirrorId: (id: number, axis: 'x' | 'z') => number): Grid {
  const { w, h, d } = g;
  const ids = new Int32Array(w * h * d);
  for (let y = 0; y < h; y++) {
    for (let z = 0; z < d; z++) {
      for (let x = 0; x < w; x++) {
        const id = g.ids[idx(w, d, x, y, z)];
        let nx = x, ny = y, nz = z;
        if (axis === 'x') nx = w - 1 - x;
        else if (axis === 'z') nz = d - 1 - z;
        else ny = h - 1 - y;
        ids[idx(w, d, nx, ny, nz)] = id === AIR || axis === 'y' ? id : mirrorId(id, axis);
      }
    }
  }
  const ox = axis === 'x' ? w - 1 - g.ox : g.ox;
  const oy = axis === 'y' ? h - 1 - g.oy : g.oy;
  const oz = axis === 'z' ? d - 1 - g.oz : g.oz;
  return { w, h, d, ids, ox, oy, oz };
}

/** Packs a Grid into a Schematic: ids become palette keys (strings for mod blocks) so it stays portable. */
export function encodeSchematic(name: string, g: Grid, keyOf: (id: number) => number | string): Schematic {
  const palette: PaletteEntry[] = [AIR];
  const lookup = new Map<PaletteEntry, number>([[AIR, 0]]);
  const cells = new Array<number>(g.ids.length);
  for (let i = 0; i < g.ids.length; i++) {
    const id = g.ids[i];
    const key: PaletteEntry = id === AIR ? AIR : keyOf(id);
    let pi = lookup.get(key);
    if (pi === undefined) { pi = palette.length; palette.push(key); lookup.set(key, pi); }
    cells[i] = pi;
  }
  return { name, w: g.w, h: g.h, d: g.d, ox: g.ox, oy: g.oy, oz: g.oz, palette, cells };
}

/** Unpacks a Schematic back into a Grid, resolving mod-block keys with idOf. Keys that no longer resolve become air. */
export function decodeSchematic(s: Schematic, idOf: (key: string) => number | null): { grid: Grid; missing: number; missingKeys: string[] } {
  const resolved: number[] = s.palette.map((p) => (p === AIR ? AIR : typeof p === 'number' ? p : (idOf(p) ?? -1)));
  const ids = new Int32Array(s.cells.length);
  let missing = 0;
  const missingSet = new Set<string>();
  for (let i = 0; i < s.cells.length; i++) {
    const r = resolved[s.cells[i]];
    if (r === -1) {
      ids[i] = AIR;
      missing++;
      const key = s.palette[s.cells[i]];
      if (typeof key === 'string') missingSet.add(key);
    } else {
      ids[i] = r;
    }
  }
  return { grid: { w: s.w, h: s.h, d: s.d, ox: s.ox, oy: s.oy, oz: s.oz, ids }, missing, missingKeys: [...missingSet] };
}

function isSchematicShape(d: unknown): d is Schematic {
  if (!d || typeof d !== 'object') return false;
  const o = d as Record<string, unknown>;
  return typeof o.name === 'string' && typeof o.w === 'number' && typeof o.h === 'number' && typeof o.d === 'number'
    && typeof o.ox === 'number' && typeof o.oy === 'number' && typeof o.oz === 'number'
    && Array.isArray(o.palette) && Array.isArray(o.cells);
}

/** Checks an untrusted object (from a mod, an import, or storage) and returns a clean Schematic, or an error string. */
export function validateSchematic(raw: unknown): Schematic | string {
  if (!isSchematicShape(raw)) return 'That is not a valid schematic.';
  const ve = volumeError(raw.w, raw.h, raw.d);
  if (ve) return ve;
  if (raw.cells.length !== raw.w * raw.h * raw.d) return 'That schematic is the wrong size for its data.';
  if (raw.palette.some((p) => typeof p !== 'number' && typeof p !== 'string')) return 'That schematic has a broken palette.';
  if (raw.cells.some((c) => typeof c !== 'number' || c < 0 || c >= raw.palette.length)) return 'That schematic has broken data.';
  const name = sanitizeName(raw.name) ?? 'schematic';
  return { name, w: raw.w, h: raw.h, d: raw.d, ox: raw.ox, oy: raw.oy, oz: raw.oz, palette: raw.palette.slice(), cells: raw.cells.slice() };
}

export function libraryBytes(lib: Record<string, Schematic>): number {
  try { return new Blob([JSON.stringify(lib)]).size; } catch { return JSON.stringify(lib).length; }
}

export function loadLibrary(): Record<string, Schematic> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, Schematic> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const sc = validateSchematic(v);
      if (typeof sc !== 'string') out[k] = sc;
    }
    return out;
  } catch {
    return {};
  }
}

/** Returns an error message if it could not be saved (too many, too big), otherwise writes it and returns null. */
export function saveLibrary(lib: Record<string, Schematic>): string | null {
  const count = Object.keys(lib).length;
  if (count > SCHEM_LIMITS.maxCount) return `Your library is full (${SCHEM_LIMITS.maxCount} max). Delete one first.`;
  const bytes = libraryBytes(lib);
  if (bytes > SCHEM_LIMITS.maxBytes) return 'Your library has gotten too big to save. Delete a large schematic first.';
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(lib));
    return null;
  } catch {
    return 'Could not save your library (your browser storage may be full).';
  }
}

export function schematicToFile(s: Schematic): string {
  return JSON.stringify({ magic: FILE_MAGIC, version: FILE_VERSION, schematic: s }, null, 0);
}

export function parseSchematicFile(text: string): Schematic | string {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return 'That file is not a schematic (it will not parse).'; }
  const obj = parsed as Record<string, unknown>;
  const body = obj && typeof obj === 'object' && obj.magic === FILE_MAGIC ? obj.schematic : parsed;
  return validateSchematic(body);
}
