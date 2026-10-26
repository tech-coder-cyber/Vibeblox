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
