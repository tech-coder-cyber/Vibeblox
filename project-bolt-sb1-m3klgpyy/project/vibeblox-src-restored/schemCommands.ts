// The schematic actions (copy, save, load, paste, rotate, flip, undo, import, export) and the paste machinery, kept apart from App.tsx. The game is reached through `SchemEnv`
// so this runs (and is tested) without a browser.
import {
  type Grid, type Schematic, SCHEM_LIMITS, encodeSchematic, decodeSchematic, rotateGrid, flipGrid, gridToList, countBlocks,
  loadLibrary, saveLibrary, sanitizeName, nameKey, volumeError, schematicToFile, parseSchematicFile, describe,
} from './schematics';

export type SchemEnv = {
  readBlocks: (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => { x: number; y: number; z: number; w: number; h: number; d: number; ids: number[]; unloaded: number };
  setBlocks: (list: Array<[number, number, number, number]>) => number;
  getSelection: () => { p1: [number, number, number] | null; p2: [number, number, number] | null };
  /** Where the player stands (feet). */
  where: () => [number, number, number];
  maxY: number;
  out: (text: string) => void;
  fail: (text: string) => void;
  idOf: (key: string) => number | null;
  keyOf: (id: number) => number | string;
  rotateId: (id: number, quarters: number) => number;
  mirrorId: (id: number, axis: 'x' | 'z') => number;
  download: (filename: string, text: string) => void;
  pickFile: () => Promise<string | null>;
  /** Schematics that come with the mods you have switched on. */
  bundled?: () => Schematic[];
  alive: () => boolean;
};

type Clip = { grid: Grid; name: string };
let clipboard: Clip | null = null;
type Undo = { x: number; y: number; z: number; w: number; h: number; d: number; ids: number[]; label: string };
const undoStack: Undo[] = [];
const BATCH = 6000;

export function clipboardInfo(): { name: string; w: number; h: number; d: number } | null {
  return clipboard ? { name: clipboard.name, w: clipboard.grid.w, h: clipboard.grid.h, d: clipboard.grid.d } : null;
}
export function resetSchematicState() { clipboard = null; undoStack.length = 0; }
export function undoDepth(): number { return undoStack.length; }

/** Library plus what mods bring. A mod's schematics are found by name too (the library wins). */
export function findSchematic(name: string, env: Pick<SchemEnv, 'bundled'>): Schematic | null {
  const k = nameKey(name);
  const lib = loadLibrary();
  if (lib[k]) return lib[k];
  return env.bundled?.().find((s) => nameKey(s.name) === k) ?? null;
}

function parseCoord(tok: string, base: number): number { return tok.startsWith('~') ? Math.floor(base + (tok.length > 1 ? Number(tok.slice(1)) : 0)) : Math.floor(Number(tok)); }

function copyFromSelection(env: SchemEnv): Grid | null {
  const sel = env.getSelection();
  const a = sel.p1 ?? sel.p2, b = sel.p2 ?? sel.p1;
  if (!a || !b) { env.fail('Select a box first: take the Selection Wand and click two blocks, or use the corner buttons'); return null; }
  const x0 = Math.min(a[0], b[0]), y0 = Math.max(0, Math.min(a[1], b[1])), z0 = Math.min(a[2], b[2]);
  const x1 = Math.max(a[0], b[0]), y1 = Math.min(env.maxY, Math.max(a[1], b[1])), z1 = Math.max(a[2], b[2]);
  const w = x1 - x0 + 1, h = y1 - y0 + 1, d = z1 - z0 + 1;
  const ve = volumeError(w, h, d);
  if (ve) { env.fail(ve); return null; }
  const r = env.readBlocks(x0, y0, z0, x1, y1, z1);
  if (r.ids.length !== w * h * d) { env.fail('Could not read that box'); return null; }
  if (r.unloaded) env.out(`${r.unloaded.toLocaleString()} of those blocks are in chunks that are not loaded, so they were copied as air.`);
  const me = env.where();
  const cl = (v: number, lo: number, n: number) => Math.max(0, Math.min(n - 1, Math.floor(v) - lo));
  return { w, h, d, ids: Int32Array.from(r.ids), ox: cl(me[0], x0, w), oy: cl(me[1], y0, h), oz: cl(me[2], z0, d) };
}

async function applyBatches(list: Array<[number, number, number, number]>, env: SchemEnv): Promise<number> {
  let placed = 0;
  for (let i = 0; i < list.length; i += BATCH) {
    if (!env.alive()) return placed;
    placed += env.setBlocks(list.slice(i, i + BATCH));
    if (i + BATCH < list.length) await new Promise<void>((r) => setTimeout(r, 0));
  }
  return placed;
}

/** Paste a grid with its origin on (ax, ay, az). Remembers what was there so Undo works. */
export async function pasteGrid(g: Grid, at: [number, number, number], opts: { skipAir?: boolean; label?: string; remember?: boolean }, env: SchemEnv): Promise<{ placed: number; total: number }> {
  const list = gridToList(g, at[0], at[1], at[2], !!opts.skipAir);
  if (!env.alive()) return { placed: 0, total: list.length };
  if (opts.remember !== false) {
    const x0 = at[0] - g.ox, y0 = at[1] - g.oy, z0 = at[2] - g.oz;
    const old = env.readBlocks(x0, y0, z0, x0 + g.w - 1, y0 + g.h - 1, z0 + g.d - 1);
    if (old.ids.length === old.w * old.h * old.d && old.ids.length > 0) {
      undoStack.push({ x: old.x, y: old.y, z: old.z, w: old.w, h: old.h, d: old.d, ids: old.ids, label: opts.label ?? 'paste' });
      while (undoStack.length > 5) undoStack.shift();
    }
  }
  const placed = await applyBatches(list, env);
  return { placed, total: list.length };
}

function setClip(g: Grid, name: string) { clipboard = { grid: g, name }; }

function usage(env: SchemEnv) {
  env.fail('Usage: /schem copy · save <name> · load <name> · paste [-a] [x y z] · rotate <90|180|270> · flip <x|y|z> · list · info [name] · delete <name> · export [name] · import · undo');
}

export async function runSchem(args: string[], env: SchemEnv): Promise<void> {
  const sub = (args[0] ?? '').toLowerCase();
  const rest = args.slice(1);
  const lib = loadLibrary();
  const known = (n: string) => findSchematic(n, env);
  switch (sub) {
    case 'copy': {
      const g = copyFromSelection(env);
      if (!g) return;
      setClip(g, 'copied');
      env.out(`Copied ${describe(g)} (${countBlocks(g).toLocaleString()} blocks). Press Paste to put it down where you stand.`);
      return;
    }
    case 'save': {
      const name = sanitizeName(rest.join(' '));
      if (!name) { env.fail(`Type a name first: letters, numbers, spaces, - and _, up to ${SCHEM_LIMITS.nameMax} characters`); return; }
      const g = copyFromSelection(env);
      if (!g) return;
      const s = encodeSchematic(name, g, env.keyOf);
      const next = { ...lib, [nameKey(name)]: s };
      const err = saveLibrary(next);
      if (err) { env.fail(err); return; }
      setClip(g, name);
      env.out(`Saved "${name}" (${describe(g)}, ${countBlocks(g).toLocaleString()} blocks). Load it any time, in any world, and paste it.`);
      return;
    }
    case 'load': {
      const name = rest.join(' ');
      const s = name ? known(name) : null;
      if (!s) { env.fail(name ? `No schematic called "${name}".` : 'Pick a schematic to load'); return; }
      const { grid, missing, missingKeys } = decodeSchematic(s, env.idOf);
      setClip(grid, s.name);
      env.out(`Loaded "${s.name}" (${describe(s)}). Press Paste to put it where you stand.${missing ? ` ${missing.toLocaleString()} blocks come from mods you do not have (${missingKeys.slice(0, 3).join(', ')}) and will be left out.` : ''}`);
      return;
    }
    case 'paste': {
      if (!clipboard) { env.fail('Nothing to paste. Copy your selection or load a schematic first.'); return; }
      const flags = rest.filter((a) => a.startsWith('-'));
      const nums = rest.filter((a) => !a.startsWith('-'));
      const skipAir = flags.includes('-a');
      const me = env.where();
      let at: [number, number, number] = [Math.floor(me[0]), Math.floor(me[1]), Math.floor(me[2])];
      if (nums.length >= 3) {
        at = [parseCoord(nums[0], me[0]), parseCoord(nums[1], me[1]), parseCoord(nums[2], me[2])];
        if (at.some((v) => !Number.isFinite(v))) { env.fail('Usage: /schem paste [-a] [x y z]'); return; }
      } else if (nums.length) { env.fail('Usage: /schem paste [-a] [x y z]'); return; }
      const c = clipboard;
      const r = await pasteGrid(c.grid, at, { skipAir, label: `paste of "${c.name}"` }, env);
      env.out(`Pasted "${c.name}": ${r.placed.toLocaleString()} blocks${r.placed < r.total ? ` (${(r.total - r.placed).toLocaleString()} were in chunks that are not loaded)` : ''}. Undo takes it back.${skipAir ? '' : ' Tick "keep what is already there" to leave existing blocks where the schematic has air.'}`);
      return;
    }
    case 'rotate': {
      if (!clipboard) { env.fail('Nothing to rotate. Copy your selection or load a schematic first.'); return; }
      const t = (rest[0] ?? '').toLowerCase();
      const q = ({ '90': 1, right: 1, cw: 1, '180': 2, '270': 3, '-90': 3, left: 3, ccw: 3 } as Record<string, number>)[t];
      if (q === undefined) { env.fail('Usage: /schem rotate <90|180|270>  (clockwise, seen from above)'); return; }
      clipboard = { ...clipboard, grid: rotateGrid(clipboard.grid, q, env.rotateId) };
      env.out(`Turned it ${q * 90} degrees. It is now ${describe(clipboard.grid)}.`);
      return;
    }
    case 'flip': {
      if (!clipboard) { env.fail('Nothing to flip. Copy your selection or load a schematic first.'); return; }
      const ax = (rest[0] ?? '').toLowerCase();
      if (ax !== 'x' && ax !== 'y' && ax !== 'z') { env.fail('Usage: /schem flip <x|y|z>  (x swaps east and west, z swaps north and south, y turns it upside down)'); return; }
      clipboard = { ...clipboard, grid: flipGrid(clipboard.grid, ax, env.mirrorId) };
      env.out(`Flipped along ${ax}.`);
      return;
    }
    case 'list': {
      const mine = Object.values(lib);
      const bundled = env.bundled?.() ?? [];
      if (!mine.length && !bundled.length) { env.out('You have no schematics yet. Select a box with the wand and save it.'); return; }
      env.out(`Schematics (${mine.length}):`);
      for (const s of mine.sort((a, b) => a.name.localeCompare(b.name))) env.out(`  ${s.name} - ${describe(s)}`);
      if (bundled.length) { env.out(`From your mods (${bundled.length}):`); for (const s of bundled) env.out(`  ${s.name} - ${describe(s)}`); }
      return;
    }
    case 'info': {
      const name = rest.join(' ');
      if (!name) {
        if (!clipboard) { env.out('The clipboard is empty.'); return; }
        env.out(`Clipboard: "${clipboard.name}", ${describe(clipboard.grid)}, ${countBlocks(clipboard.grid).toLocaleString()} blocks.`);
        return;
      }
      const s = known(name);
      if (!s) { env.fail(`No schematic called "${name}"`); return; }
      const { grid } = decodeSchematic(s, env.idOf);
      env.out(`"${s.name}": ${describe(s)}, ${countBlocks(grid).toLocaleString()} blocks, ${s.palette.length} kinds of block.`);
      return;
    }
    case 'delete':
    case 'remove': {
      const k = nameKey(rest.join(' '));
      if (!k || !lib[k]) { env.fail(`No schematic called "${rest.join(' ')}"`); return; }
      const label = lib[k].name;
      delete lib[k];
      const err = saveLibrary(lib);
      if (err) { env.fail(err); return; }
      env.out(`Deleted "${label}".`);
      return;
    }
    case 'export': {
      const name = rest.join(' ');
      let s: Schematic | null = name ? known(name) : null;
      if (!s && !name && clipboard) s = encodeSchematic(sanitizeName(clipboard.name) ?? 'schematic', clipboard.grid, env.keyOf);
      if (!s) { env.fail(name ? `No schematic called "${name}"` : 'Pick a schematic to download (or copy something first)'); return; }
      env.download(`${s.name.replace(/[^A-Za-z0-9_.-]+/g, '_')}.vbschem`, schematicToFile(s));
      env.out(`Downloading "${s.name}" as a .vbschem file. Anyone can import it.`);
      return;
    }
    case 'import': {
      env.out('Pick a .vbschem file...');
      const text = await env.pickFile();
      if (text === null) { env.out('Import cancelled.'); return; }
      const s = parseSchematicFile(text);
      if (typeof s === 'string') { env.fail(s); return; }
      const err = saveLibrary({ ...loadLibrary(), [nameKey(s.name)]: s });
      if (err) { env.fail(err); return; }
      const { grid, missing } = decodeSchematic(s, env.idOf);
      setClip(grid, s.name);
      env.out(`Imported "${s.name}" (${describe(s)}) and loaded it. Press Paste to put it down.${missing ? ` ${missing.toLocaleString()} blocks come from mods you do not have.` : ''}`);
      return;
    }
    case 'undo': {
      const u = undoStack.pop();
      if (!u) { env.fail('Nothing to undo'); return; }
      const list: Array<[number, number, number, number]> = [];
      for (let y = 0; y < u.h; y++) for (let z = 0; z < u.d; z++) for (let x = 0; x < u.w; x++) list.push([u.x + x, u.y + y, u.z + z, u.ids[(y * u.d + z) * u.w + x]]);
      const placed = await applyBatches(list, env);
      env.out(`Undid the ${u.label} (${placed.toLocaleString()} blocks put back).${undoStack.length ? ` ${undoStack.length} more can be undone.` : ''}`);
      return;
    }
    default:
      usage(env);
  }
}

/** For scripts and mods: paste a schematic by name. Returns how many blocks were placed. */
export async function pasteByName(name: string, at: [number, number, number], opts: { rotate?: number; flipX?: boolean; flipZ?: boolean; skipAir?: boolean }, env: SchemEnv): Promise<{ ok: true; placed: number; total: number; w: number; h: number; d: number } | { ok: false; error: string }> {
  const s = findSchematic(name, env);
  if (!s) return { ok: false, error: `No schematic called "${name}"` };
  let { grid } = decodeSchematic(s, env.idOf);
  if (opts.rotate) grid = rotateGrid(grid, Math.round(opts.rotate / 90), env.rotateId);
  if (opts.flipX) grid = flipGrid(grid, 'x', env.mirrorId);
  if (opts.flipZ) grid = flipGrid(grid, 'z', env.mirrorId);
  const r = await pasteGrid(grid, at, { skipAir: !!opts.skipAir, label: `paste of "${s.name}"`, remember: false }, env);
  return { ok: true, placed: r.placed, total: r.total, w: grid.w, h: grid.h, d: grid.d };
}
