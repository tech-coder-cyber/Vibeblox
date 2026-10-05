// The logic behind the Mod Builder: turning drawn or uploaded pictures into a palette and
// rows of characters, and turning a project (a list of items, blocks and plants) into mod
// code that runs in the same sandbox as hand-written mods. Pure functions, no UI.

export type ThingKind = 'item' | 'block' | 'plant';
export type HoldStyle = 'item' | 'one_hand' | 'two_hands';
export type BuilderThing = {
  key: string;            // "ruby" -> the game id is "mymod:ruby"
  name: string;
  kind: ThingKind;
  size: number;           // the picture is size x size pixels (up to 64)
  rgba: number[];         // size*size*4 values (red, green, blue, alpha)
  maxStack: number;
  food: number;           // hunger points restored (items only; 0 = not food)
  hold: HoldStyle;        // how it is held in third person
  lore: string;
  hardness: number;       // blocks and plants
  tier: number;           // pickaxe tier needed (blocks)
  solid: boolean;
  dropsSelf: boolean;
  recipe: { cells: string[]; count: number } | null; // 9 item names (3x3), '' = empty
};
export type BuilderProject = { name: string; description: string; things: BuilderThing[] };

export const MAX_TEXTURE = 64;
export const PALETTE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const MAX_COLORS = PALETTE_CHARS.length; // 62

export const slug = (s: string, fallback = 'thing') => {
  const t = s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
  return t || fallback;
};

export function newThing(kind: ThingKind, n: number): BuilderThing {
  const size = 16;
  return {
    key: `${kind}_${n}`, name: kind === 'item' ? `Item ${n}` : kind === 'block' ? `Block ${n}` : `Plant ${n}`, kind, size,
    rgba: new Array(size * size * 4).fill(0), maxStack: 64, food: 0, hold: 'item', lore: '',
    hardness: 1, tier: 0, solid: true, dropsSelf: true, recipe: null,
  };
}

// ---------------- pictures ----------------
/** Nearest-neighbour resize, so pixel art stays crisp. */
export function resample(rgba: ArrayLike<number>, from: number, to: number): number[] {
  const out = new Array(to * to * 4);
  for (let y = 0; y < to; y++) {
    for (let x = 0; x < to; x++) {
      const sx = Math.min(from - 1, Math.floor((x * from) / to)), sy = Math.min(from - 1, Math.floor((y * from) / to));
      for (let k = 0; k < 4; k++) out[(y * to + x) * 4 + k] = rgba[(sy * from + sx) * 4 + k];
    }
  }
  return out;
}
/** A w x h picture centred on a transparent square (items and block faces are square). */
export function padToSquare(rgba: ArrayLike<number>, w: number, h: number): { size: number; rgba: number[] } {
  const size = Math.max(w, h);
  const out = new Array(size * size * 4).fill(0);
  const ox = Math.floor((size - w) / 2), oy = Math.floor((size - h) / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++) out[((y + oy) * size + x + ox) * 4 + k] = rgba[(y * w + x) * 4 + k];
  return { size, rgba: out };
}

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** Rows of characters plus a palette. Over 62 colours are reduced with median cut. */
export function quantize(rgba: ArrayLike<number>, size: number): { pixels: string[]; palette: Record<string, string>; reduced: boolean; colors: number } {
  const counts = new Map<number, number>();
  for (let i = 0; i < size * size; i++) {
    if (rgba[i * 4 + 3] < 128) continue;
    const key = (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const unique = [...counts.entries()].map(([k, n]) => ({ r: (k >> 16) & 255, g: (k >> 8) & 255, b: k & 255, n, k }));
  let centers: Array<{ r: number; g: number; b: number }> = unique;
  const reduced = unique.length > MAX_COLORS;
  const mapTo = new Map<number, number>(); // packed colour -> index into centers
  if (!reduced) {
    unique.forEach((c, i) => mapTo.set(c.k, i));
  } else {
    type Box = typeof unique;
    const boxes: Box[] = [unique.slice()];
    const range = (bx: Box, ch: 'r' | 'g' | 'b') => { let lo = 255, hi = 0; for (const c of bx) { lo = Math.min(lo, c[ch]); hi = Math.max(hi, c[ch]); } return hi - lo; };
    while (boxes.length < MAX_COLORS) {
      let bi = -1, best = 0;
      boxes.forEach((bx, i) => { if (bx.length < 2) return; const score = Math.max(range(bx, 'r'), range(bx, 'g'), range(bx, 'b')) * Math.sqrt(bx.reduce((s, c) => s + c.n, 0)); if (score > best) { best = score; bi = i; } });
      if (bi < 0) break;
      const bx = boxes[bi];
      const ch = (['r', 'g', 'b'] as const).reduce((a, b) => (range(bx, b) > range(bx, a) ? b : a));
      const sorted = bx.slice().sort((a, b) => a[ch] - b[ch]);
      const total = sorted.reduce((s, c) => s + c.n, 0);
      let acc = 0, cut = 1;
      for (let i = 0; i < sorted.length - 1; i++) { acc += sorted[i].n; cut = i + 1; if (acc >= total / 2) break; }
      boxes.splice(bi, 1, sorted.slice(0, cut), sorted.slice(cut));
    }
    centers = boxes.map((bx) => {
      const n = bx.reduce((s, c) => s + c.n, 0);
      return { r: bx.reduce((s, c) => s + c.r * c.n, 0) / n, g: bx.reduce((s, c) => s + c.g * c.n, 0) / n, b: bx.reduce((s, c) => s + c.b * c.n, 0) / n };
    });
    for (const c of unique) {
      let bi = 0, bd = Infinity;
      centers.forEach((m, i) => { const d = (m.r - c.r) ** 2 + (m.g - c.g) ** 2 + (m.b - c.b) ** 2; if (d < bd) { bd = d; bi = i; } });
      mapTo.set(c.k, bi);
    }
  }
  // most-used colours get the first characters
  const use = new Array(centers.length).fill(0);
  for (const c of unique) use[mapTo.get(c.k)!] += c.n;
  const order = use.map((n, i) => ({ n, i })).sort((a, b) => b.n - a.n).map((o) => o.i);
  const charOf = new Map<number, string>();
  const palette: Record<string, string> = {};
  order.forEach((ci, rank) => { if (use[ci] === 0) return; const ch = PALETTE_CHARS[rank]; charOf.set(ci, ch); palette[ch] = hex(centers[ci].r, centers[ci].g, centers[ci].b); });
  const pixels: string[] = [];
  for (let y = 0; y < size; y++) {
    let row = '';
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (rgba[i * 4 + 3] < 128) { row += '.'; continue; }
      row += charOf.get(mapTo.get((rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2])!)!;
    }
    pixels.push(row);
  }
  return { pixels, palette, reduced, colors: Object.keys(palette).length };
}

/** The opposite of quantize: rows + palette back to pixels (used when re-opening a mod). */
export function unquantize(pixels: string[], palette: Record<string, string>, size: number): number[] {
  const out = new Array(size * size * 4).fill(0);
  for (let y = 0; y < Math.min(size, pixels.length); y++) {
    for (let x = 0; x < Math.min(size, pixels[y].length); x++) {
      const col = palette[pixels[y][x]];
      if (!col || !/^#[0-9a-fA-F]{6}$/.test(col)) continue;
      const i = (y * size + x) * 4;
      out[i] = parseInt(col.slice(1, 3), 16); out[i + 1] = parseInt(col.slice(3, 5), 16); out[i + 2] = parseInt(col.slice(5, 7), 16); out[i + 3] = 255;
    }
  }
  return out;
}

// ---------------- recipes ----------------
export const itemRef = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '_');
/** A 3x3 grid of item names -> a trimmed pattern like ['II', ' S'] and its key. */
export function recipeToPattern(cells: string[]): { pattern: string[]; key: Record<string, string> } | null {
  const names = cells.map(itemRef);
  const filled = names.map((n, i) => (n ? i : -1)).filter((i) => i >= 0);
  if (!filled.length) return null;
  const rows = filled.map((i) => Math.floor(i / 3)), cols = filled.map((i) => i % 3);
  const r0 = Math.min(...rows), r1 = Math.max(...rows), c0 = Math.min(...cols), c1 = Math.max(...cols);
  const letters = new Map<string, string>();
  const key: Record<string, string> = {};
  const pattern: string[] = [];
  for (let r = r0; r <= r1; r++) {
    let row = '';
    for (let c = c0; c <= c1; c++) {
      const n = names[r * 3 + c];
      if (!n) { row += ' '; continue; }
      if (!letters.has(n)) { const L = String.fromCharCode(65 + letters.size); letters.set(n, L); key[L] = n; }
      row += letters.get(n)!;
    }
    pattern.push(row);
  }
  return { pattern, key };
}
export function patternToRecipe(pattern: string[], key: Record<string, string>): string[] {
  const cells = new Array(9).fill('');
  pattern.slice(0, 3).forEach((row, r) => [...row.slice(0, 3)].forEach((ch, c) => { if (ch !== ' ') cells[r * 3 + c] = key[ch] ?? ''; }));
  return cells;
}

// ---------------- checking ----------------
export function validateProject(p: BuilderProject): string[] {
  const errs: string[] = [];
  if (!p.name.trim()) errs.push('Give your mod a name.');
  if (!p.things.length) errs.push('Add at least one item, block or plant.');
  const seen = new Set<string>();
  for (const t of p.things) {
    const label = t.name.trim() || t.key;
    if (!t.name.trim()) errs.push(`"${t.key}" needs a name.`);
    if (!/^[a-z0-9_]{1,24}$/.test(t.key)) errs.push(`"${label}" has an invalid id (use a-z, 0-9 and _).`);
    if (seen.has(t.key)) errs.push(`Two things share the id "${t.key}".`);
    seen.add(t.key);
    if (t.size < 1 || t.size > MAX_TEXTURE) errs.push(`"${label}" is bigger than ${MAX_TEXTURE}x${MAX_TEXTURE}.`);
    let opaque = 0;
    for (let i = 3; i < t.rgba.length; i += 4) if (t.rgba[i] >= 128) opaque++;
    if (!opaque) errs.push(`"${label}" has no picture yet. Draw something or upload an image.`);
    if (t.recipe && !recipeToPattern(t.recipe.cells)) errs.push(`"${label}" has an empty recipe (fill at least one square or remove it).`);
  }
  return errs;
}

// ---------------- the mod's code ----------------
const START = '// BUILDER-DATA-START';
const END = '// BUILDER-DATA-END';
export const BUILDER_MARK = '// Made with the VibeBlox Mod Builder';

export function buildModCode(p: BuilderProject): string {
  const ns = slug(p.name, 'mymod');
  const things = p.things.map((t) => {
    const q = quantize(t.rgba, t.size);
    const r = t.recipe ? recipeToPattern(t.recipe.cells) : null;
    return {
      key: t.key, name: t.name.trim().slice(0, 40), kind: t.kind, size: t.size, palette: q.palette, pixels: q.pixels,
      maxStack: Math.max(1, Math.min(64, Math.floor(t.maxStack))), food: Math.max(0, Math.min(20, Math.floor(t.food))), hold: t.hold,
      lore: t.lore.trim().slice(0, 80), hardness: Math.max(0, Math.min(30, t.hardness)), tier: Math.max(0, Math.min(5, Math.floor(t.tier))),
      solid: t.solid, dropsSelf: t.dropsSelf, recipe: r ? { pattern: r.pattern, key: r.key, count: Math.max(1, Math.min(64, Math.floor(t.recipe!.count))) } : null,
    };
  });
  const data = JSON.stringify({ name: p.name, description: p.description, things }, null, 1)
    .replace(/\*\//g, '* /'); // never close a comment by accident
  return `${BUILDER_MARK}. Open this mod in the Builder to keep editing it,
// or edit the code below by hand (keep the data block if you want the Builder to read it again).
${START}
const BUILDER = ${data};
${END}

const NS = ${JSON.stringify(ns)};
for (const t of BUILDER.things) {
  const id = NS + ':' + t.key;
  const picture = { palette: t.palette, pixels: t.pixels };
  if (t.kind === 'item') {
    game.items.register({ id, name: t.name, maxStack: t.maxStack, food: t.food, hold: t.hold, lore: t.lore ? [t.lore] : [], icon: picture });
  } else {
    game.blocks.register({
      id, name: t.name, texture: picture, shape: t.kind === 'plant' ? 'cross' : 'cube',
      solid: t.kind === 'block' && t.solid, hardness: t.hardness, tier: t.tier, drops: t.dropsSelf ? 'self' : null,
    });
  }
  if (t.recipe) game.recipes.register({ id: t.key, pattern: t.recipe.pattern, key: t.recipe.key, output: id, count: t.recipe.count });
}
`;
}

/** Reads a mod made by the Builder back into a project (null if it wasn't made by the Builder). */
export function parseModCode(code: string, fallbackName = 'My Mod'): BuilderProject | null {
  if (!code.includes(START) || !code.includes(END)) return null;
  try {
    const body = code.slice(code.indexOf(START) + START.length, code.indexOf(END));
    const json = body.slice(body.indexOf('{'), body.lastIndexOf('}') + 1);
    const d = JSON.parse(json) as { name?: string; description?: string; things: Array<Record<string, any>> };
    const things: BuilderThing[] = d.things.map((t) => ({
      key: String(t.key), name: String(t.name), kind: t.kind === 'block' || t.kind === 'plant' ? t.kind : 'item', size: Math.max(1, Math.min(MAX_TEXTURE, Number(t.size) || 16)),
      rgba: unquantize(t.pixels as string[], t.palette as Record<string, string>, Math.max(1, Math.min(MAX_TEXTURE, Number(t.size) || 16))),
      maxStack: Number(t.maxStack) || 64, food: Number(t.food) || 0, hold: t.hold === 'one_hand' || t.hold === 'two_hands' ? t.hold : 'item', lore: String(t.lore ?? ''),
      hardness: Number(t.hardness) || 0, tier: Number(t.tier) || 0, solid: t.solid !== false, dropsSelf: t.dropsSelf !== false,
      recipe: t.recipe ? { cells: patternToRecipe(t.recipe.pattern, t.recipe.key), count: Number(t.recipe.count) || 1 } : null,
    }));
    return { name: String(d.name ?? fallbackName), description: String(d.description ?? ''), things };
  } catch { return null; }
}
