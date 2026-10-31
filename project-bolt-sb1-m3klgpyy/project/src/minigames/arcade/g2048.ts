// 2048: slide tiles, equal tiles merge. Works offline.
export type Dir = 'left' | 'right' | 'up' | 'down';
export type Grid = number[]; // 16 values, row-major, 0 = empty

export type State = { grid: Grid; score: number; best: number; won: boolean; over: boolean; moves: number };
export type Rand = () => number;

export function newGame(rand: Rand = Math.random, best = 0): State {
  const s: State = { grid: new Array(16).fill(0), score: 0, best, won: false, over: false, moves: 0 };
  spawn(s.grid, rand); spawn(s.grid, rand);
  return s;
}
export function spawn(grid: Grid, rand: Rand): boolean {
  const empty: number[] = [];
  grid.forEach((v, i) => { if (!v) empty.push(i); });
  if (!empty.length) return false;
  grid[empty[Math.floor(rand() * empty.length)]] = rand() < 0.9 ? 2 : 4;
  return true;
}
/** Slide one line toward index 0. */
export function slideLine(line: number[]): { line: number[]; gained: number } {
  const t = line.filter((v) => v);
  const out: number[] = []; let gained = 0;
  for (let i = 0; i < t.length; i++) {
    if (i + 1 < t.length && t[i] === t[i + 1]) { out.push(t[i] * 2); gained += t[i] * 2; i++; } else out.push(t[i]);
  }
  while (out.length < 4) out.push(0);
  return { line: out, gained };
}
const idx = (dir: Dir, line: number, k: number): number => {
  switch (dir) {
    case 'left': return line * 4 + k;
    case 'right': return line * 4 + (3 - k);
    case 'up': return k * 4 + line;
    case 'down': return (3 - k) * 4 + line;
  }
};
/** Returns the new grid and points, or null if nothing moved. */
export function move(grid: Grid, dir: Dir): { grid: Grid; gained: number } | null {
  const out = grid.slice(); let gained = 0, changed = false;
  for (let l = 0; l < 4; l++) {
    const line = [0, 1, 2, 3].map((k) => grid[idx(dir, l, k)]);
    const r = slideLine(line);
    gained += r.gained;
    r.line.forEach((v, k) => { const i = idx(dir, l, k); if (out[i] !== v) changed = true; out[i] = v; });
  }
  return changed ? { grid: out, gained } : null;
}
export function canMove(grid: Grid): boolean {
  if (grid.some((v) => !v)) return true;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const v = grid[r * 4 + c]; if ((c < 3 && grid[r * 4 + c + 1] === v) || (r < 3 && grid[(r + 1) * 4 + c] === v)) return true; }
  return false;
}
export function play(s: State, dir: Dir, rand: Rand = Math.random): State {
  if (s.over) return s;
  const r = move(s.grid, dir);
  if (!r) return s;
  spawn(r.grid, rand);
  const score = s.score + r.gained;
  return { grid: r.grid, score, best: Math.max(s.best, score), won: s.won || r.grid.some((v) => v >= 2048), over: !canMove(r.grid), moves: s.moves + 1 };
}
export const maxTile = (g: Grid) => Math.max(...g);

// ---------- tiles that slide (used by the board so every tile can move smoothly to its new square) ----------
export type Tile = { id: number; v: number; r: number; c: number; /** just appeared */ fresh?: boolean; /** made by a merge */ merged?: boolean; /** slides into its partner, then disappears */ dying?: boolean };

/** The numbers on the board as a plain grid (tiles that are about to disappear don't count). */
export function gridOf(tiles: Tile[]): Grid {
  const g: Grid = new Array(16).fill(0);
  for (const t of tiles) if (!t.dying) g[t.r * 4 + t.c] = t.v;
  return g;
}
/** Put a new 2 (or sometimes a 4) on a random empty square. */
export function spawnTile(tiles: Tile[], nextId: number, rand: Rand = Math.random): { tiles: Tile[]; nextId: number } {
  const g = gridOf(tiles), empty: number[] = [];
  g.forEach((v, i) => { if (!v) empty.push(i); });
  if (!empty.length) return { tiles, nextId };
  const at = empty[Math.floor(rand() * empty.length)];
  return { tiles: [...tiles, { id: nextId, v: rand() < 0.9 ? 2 : 4, r: at >> 2, c: at & 3, fresh: true }], nextId: nextId + 1 };
}
export function startTiles(rand: Rand = Math.random): { tiles: Tile[]; nextId: number } {
  let s = { tiles: [] as Tile[], nextId: 1 };
  s = spawnTile(s.tiles, s.nextId, rand); s = spawnTile(s.tiles, s.nextId, rand);
  return s;
}
/** Slide every tile as far as it goes. Two tiles that merge both slide to the same square (they are marked dying) and a new doubled tile is made there. */
export function moveTiles(tiles: Tile[], dir: Dir, nextId: number): { tiles: Tile[]; gained: number; moved: boolean; nextId: number } {
  const at: Array<Tile | undefined> = new Array(16);
  for (const t of tiles) if (!t.dying) at[t.r * 4 + t.c] = t;
  const out: Tile[] = []; let gained = 0, moved = false, id = nextId;
  for (let l = 0; l < 4; l++) {
    const line: Tile[] = [];
    for (let k = 0; k < 4; k++) { const t = at[idx(dir, l, k)]; if (t) line.push(t); }
    let slot = 0;
    for (let i = 0; i < line.length; i++, slot++) {
      const t = line[i], to = idx(dir, l, slot), r = to >> 2, c = to & 3, next = line[i + 1];
      if (next && next.v === t.v) {
        gained += t.v * 2; moved = true;
        out.push({ id: t.id, v: t.v, r, c, dying: true }, { id: next.id, v: next.v, r, c, dying: true }, { id: id++, v: t.v * 2, r, c, merged: true });
        i++;
      } else {
        if (t.r !== r || t.c !== c) moved = true;
        out.push({ id: t.id, v: t.v, r, c });
      }
    }
  }
  return { tiles: out, gained, moved, nextId: id };
}
