// Minesweeper: the board, opening squares, flags and "chording". Works offline.
export type Level = 'beginner' | 'intermediate' | 'expert';
export const LEVELS: Record<Level, { w: number; h: number; mines: number; label: string }> = {
  beginner: { w: 9, h: 9, mines: 10, label: 'Beginner' },
  intermediate: { w: 16, h: 16, mines: 40, label: 'Intermediate' },
  expert: { w: 30, h: 16, mines: 99, label: 'Expert' },
};
export type Cell = { mine: boolean; open: boolean; flag: boolean; n: number };
export type State = { w: number; h: number; mines: number; cells: Cell[]; status: 'ready' | 'playing' | 'won' | 'lost'; boom: number };
export type Rand = () => number;

export function newGame(level: Level): State {
  const { w, h, mines } = LEVELS[level];
  return { w, h, mines, cells: Array.from({ length: w * h }, () => ({ mine: false, open: false, flag: false, n: 0 })), status: 'ready', boom: -1 };
}
export function neighbours(s: { w: number; h: number }, i: number): number[] {
  const x = i % s.w, y = (i / s.w) | 0, out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < s.w && ny < s.h) out.push(ny * s.w + nx);
  }
  return out;
}
/** Lay the mines after the first click, so the first square (and the ones around it) are never mines. */
function lay(s: State, safe: number, rand: Rand) {
  const banned = new Set([safe, ...neighbours(s, safe)]);
  const spots: number[] = [];
  for (let i = 0; i < s.cells.length; i++) if (!banned.has(i)) spots.push(i);
  for (let k = spots.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [spots[k], spots[j]] = [spots[j], spots[k]]; }
  for (let k = 0; k < s.mines; k++) s.cells[spots[k]].mine = true;
  for (let i = 0; i < s.cells.length; i++) s.cells[i].n = neighbours(s, i).filter((j) => s.cells[j].mine).length;
}
const copy = (s: State): State => ({ ...s, cells: s.cells.map((c) => ({ ...c })) });
const open = (s: State, i: number) => {
  const stack = [i];
  while (stack.length) {
    const k = stack.pop()!, c = s.cells[k];
    if (c.open || c.flag) continue;
    c.open = true;
    if (c.mine) { s.status = 'lost'; s.boom = k; continue; }
    if (c.n === 0) for (const j of neighbours(s, k)) if (!s.cells[j].open) stack.push(j);
  }
};
const finish = (s: State) => {
  if (s.status === 'lost') { for (const c of s.cells) if (c.mine && !c.flag) c.open = true; return; }
  if (s.cells.every((c) => c.mine || c.open)) { s.status = 'won'; for (const c of s.cells) if (c.mine) c.flag = true; }
};
/** Open a square. Opening a number that already has enough flags around it opens the rest of its neighbours (chording). */
export function reveal(s0: State, i: number, rand: Rand = Math.random): State {
  if (s0.status === 'won' || s0.status === 'lost') return s0;
  const s = copy(s0);
  if (s.status === 'ready') { lay(s, i, rand); s.status = 'playing'; }
  const c = s.cells[i];
  if (c.flag) return s0;
  if (c.open) {
    if (c.n === 0) return s0;
    const ns = neighbours(s, i);
    if (ns.filter((j) => s.cells[j].flag).length !== c.n) return s0;
    for (const j of ns) if (!s.cells[j].flag) open(s, j);
  } else open(s, i);
  finish(s);
  return s;
}
export function toggleFlag(s0: State, i: number): State {
  if (s0.status === 'won' || s0.status === 'lost') return s0;
  const c0 = s0.cells[i];
  if (c0.open) return s0;
  const s = copy(s0);
  s.cells[i].flag = !c0.flag;
  return s;
}
export const flagsUsed = (s: State) => s.cells.filter((c) => c.flag).length;
